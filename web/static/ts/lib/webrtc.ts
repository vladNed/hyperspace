import { Identity } from "./auth.js";
import {
  CHUNK_SIZE,
  FileStatus,
  ICE_SERVERS,
  PeerEvent,
  PeerMessageType,
  PeerState,
  SignalingEvent,
} from "./constants.js";
import { handleDisplayFileStatus } from "./handlers.js";
import type {
  InitPayload,
  PeerMessage,
  TransferSession,
  SDPEventMessage,
  FileUpdateEvent,
  ReceiveTransferMessage,
} from "./types.js";
import {
  addDownloadLink,
  getFileID,
  hashFile,
  preProcessFile,
} from "./utils.js";
import { signallingEmitter } from "./websocket.js";

export class PeerEmitter extends EventTarget {
  dispatchPeerEvent<T>(name: PeerEvent, detail: T): void {
    this.dispatchEvent(new CustomEvent(name.valueOf(), { detail }));
  }
}

export const peerEmitter = new PeerEmitter();

export class WebRTCPeer {
  private peerConnection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private state: PeerState = PeerState.IDLE;
  private transferSession: TransferSession | null = null;

  constructor(
    isOfferer: boolean = false,
    private identity: Identity,
  ) {
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
    if (isOfferer) {
      this.dataChannel = this.setOffererDataChannel();
    } else {
      this.setAnswererDataChannel();
    }

    this.peerConnection.onicecandidate = (
      event: RTCPeerConnectionIceEventInit,
    ) => {
      if (!event) return;
      if (this.peerConnection.iceGatheringState === "complete") {
        switch (this.state) {
          case PeerState.OFFER_CREATED:
            peerEmitter.dispatchPeerEvent<SDPEventMessage>(
              PeerEvent.OFFER_CREATED,
              {
                sdp: this.peerConnection.localDescription!,
              },
            );
            this.state = PeerState.OFFER_SET;
            break;
          case PeerState.OFFER_ACCEPTED:
            peerEmitter.dispatchPeerEvent<SDPEventMessage>(
              PeerEvent.OFFER_ACCEPTED,
              {
                sdp: this.peerConnection.localDescription!,
              },
            );
            this.state = PeerState.ANSWER_CREATED;
            break;
          default:
            console.error("ICE ERROR: Unknown state", this.state);
            break;
        }
      }
    };

    this.peerConnection.onconnectionstatechange = (
      event: Event | undefined,
    ) => {
      if (!event) return;
      switch (this.peerConnection.connectionState) {
        case "connected":
          this.state = PeerState.CONNECTED;
          peerEmitter.dispatchPeerEvent(PeerEvent.PEER_CONNECTED, {});
          break;
        case "disconnected":
          peerEmitter.dispatchPeerEvent(
            PeerEvent.CONNECTION_STATUS_CHANGED,
            {},
          );
          break;
        default:
          break;
      }
    };
  }

  getState(): PeerState {
    return this.state;
  }

  private setOffererDataChannel(): RTCDataChannel {
    const dataChannel = this.peerConnection.createDataChannel(
      "hypserspace-protocol",
    );

    dataChannel.binaryType = "arraybuffer";

    dataChannel.onclose = (event: Event) => {
      this.handleOnChannelDisconnect();
    };

    dataChannel.onmessage = (event: MessageEvent) => {
      this.handleOnMessageEvent(event);
    };

    return dataChannel;
  }

  private setAnswererDataChannel(): void {
    this.peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
      this.dataChannel = event.channel;
      this.dataChannel.binaryType = "arraybuffer";

      this.dataChannel.onclose = (_event: Event) => {
        this.handleOnChannelDisconnect();
      };

      this.dataChannel.onmessage = async (event: MessageEvent) => {
        await this.handleOnMessageEvent(event);
      };
    };
  }

  public async createOffer(): Promise<void> {
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.state = PeerState.OFFER_CREATED;
    } catch (error) {
      console.error("SDP ERROR: Cannot create new offer: ", error);
      throw new Error("SDP ERROR: Cannot create new offer");
    }
  }

  public async acceptOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      await this.peerConnection.setRemoteDescription(offer);
      this.state = PeerState.OFFER_ACCEPTED;
    } catch (error) {
      console.error("SDP ERROR: Cannot set offer: ", error);
      throw new Error("SDP ERROR: Cannot set offer");
    }
  }

  public async acceptAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      await this.peerConnection.setRemoteDescription(answer);
      this.state = PeerState.ANSWER_SET;
    } catch (error) {
      console.error("SDP ERROR: Cannot set answer: ", error);
      throw new Error("SDP ERROR: Cannot set answer");
    }
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    try {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error("SDP ERROR: Cannot create new answer: ", error);
      throw new Error("SDP ERROR: Cannot create new answer");
    }
  }
  private resetPeer(): void {
    this.transferSession = null;
    this.state = PeerState.CONNECTED;
  }

  /**
   * Initializes the transfer session and sends the metadata to the peer.
   * @param file The file to be send
   * @param fileId The file id which is used to identity which component in FE to update.
   */
  public async initTransfer(file: File, fileId: string): Promise<void> {
    if (this.state !== PeerState.CONNECTED && this.transferSession !== null)
      return;

    try {
      const metadata = await preProcessFile(file);
      const transferSession: TransferSession = {
        metadata,
        file,
        dataSent: 0,
        chunksIndex: 0,
        chunks: [],
        fileId,
      };
      this.transferSession = transferSession;
      this.state = PeerState.SENDING;
      this.send(
        JSON.stringify({
          type: PeerMessageType.INIT,
          body: metadata,
        } as PeerMessage),
      );
    } catch (error) {
      console.error("Could not start transfer session:", error);
      this.resetPeer();
    }
  }

  /**
   * Main handler for onmessage events from the data channel. The handler
   * will switch between the different states of the peer to handle the
   * incoming messages.
   */
  private async handleOnMessageEvent(event: MessageEvent): Promise<void> {
    const handlers = new Map([
      [
        PeerState.CONNECTED,
        async () => {
          const eventData = (event as MessageEvent<ArrayBuffer>).data;
          const peerMessage = await this.decodeMessage(eventData);
          await this.handleInitMessage(peerMessage.body as InitPayload);
        },
      ],
      [
        PeerState.RECEIVING,
        async () => {
          await this.handlePayloadMessage(
            (event as MessageEvent<ArrayBuffer>).data,
          );
        },
      ],
      [
        PeerState.SENDING,
        async () => {
          const eventData = (event as MessageEvent<ArrayBuffer>).data;
          const peerMessage = await this.decodeMessage(eventData);
          if (peerMessage.type === PeerMessageType.OK) {
            await this.handleOkMessage();
          } else {
            console.error("Unknown message type", peerMessage);
          }
        },
      ],
    ]);

    const handler = handlers.get(this.state);
    if (handler === undefined) {
      console.error("peer cannot accept incoming");
      return;
    }

    await handler();
  }

  private handleOnChannelDisconnect(): void {
    peerEmitter.dispatchPeerEvent(PeerEvent.PEER_STATUS_CHANGED, {
      status: "Disconnected",
    });
    this.resetPeer();
  }

  private async decodeMessage(data: ArrayBuffer): Promise<PeerMessage> {
    const decryptedData = await this.identity.decrypt(data);
    const decodedData = new TextDecoder().decode(decryptedData);
    return JSON.parse(decodedData) as PeerMessage;
  }

  private async send(data: string): Promise<void>;
  private async send(data: ArrayBuffer): Promise<void>;
  private async send(data: string | ArrayBuffer): Promise<void> {
    if (this.dataChannel === null) {
      throw new Error("Data channel not set");
    }

    let encryptedData: ArrayBuffer;
    if (typeof data === "string") {
      let encoder = new TextEncoder();
      let encodedData = encoder.encode(data);
      encryptedData = await this.identity.encrypt(encodedData.buffer);
    } else {
      encryptedData = await this.identity.encrypt(data);
    }

    this.dataChannel.send(encryptedData);
  }

  private completeTransfer(): void {
    handleDisplayFileStatus(this.transferSession!.fileId, FileStatus.DONE);
    const eof = new ArrayBuffer(0);
    this.dataChannel!.send(eof);
    this.state = PeerState.CONNECTED;
    this.transferSession = null;
  }

  private async sendOk(): Promise<void> {
    let okMsg: PeerMessage = { type: PeerMessageType.OK };
    await this.send(JSON.stringify(okMsg));
  }

  /**
   * Handles initiating the transfer session and preparing the peer
   * to receive the chunks.
   * @param payload The transfer metadata payload
   */
  private async handleInitMessage(payload: InitPayload): Promise<void> {
    const fileId = await getFileID();
    this.transferSession = {
      metadata: payload,
      chunksIndex: 0,
      chunks: [] as Blob[],
      fileId,
    };
    this.state = PeerState.RECEIVING;
    await this.sendOk();

    peerEmitter.dispatchPeerEvent<ReceiveTransferMessage>(
      PeerEvent.TRANSFER_INITIATED,
      {
        fileId,
        fileName: payload.fileName,
      },
    );
  }

  /**
   * Handles incoming chunk payloads from the peer. Acknowledges the
   * receipt of the chunk and prepares to receive the next chunk.
   * @param payload A chunk of a file
   */
  private async handlePayloadMessage(payload: ArrayBuffer): Promise<void> {
    if (payload.byteLength === 0) {
      this.handleEOF();
      return;
    }
    const decryptedPayload = await this.identity.decrypt(payload);
    const { chunksIndex } = this.transferSession!;
    handleDisplayFileStatus(
      this.transferSession!.fileId,
      FileStatus.TRANSFERRING,
    );
    peerEmitter.dispatchPeerEvent<FileUpdateEvent>(PeerEvent.FILE_UPDATE, {
      fileId: this.transferSession!.fileId,
      currentData: Math.min(
        chunksIndex * CHUNK_SIZE || CHUNK_SIZE,
        this.transferSession!.metadata.fileSize,
      ),
      totalData: this.transferSession!.metadata.fileSize,
    });

    const blob = new Blob([decryptedPayload]);
    this.transferSession!.chunks!.push(blob);
    this.transferSession!.chunksIndex++;
    await this.sendOk();
  }

  /**
   * Handles the OK message from the peer, indicating that the peer has
   * received the chunk and is ready for the next chunk.
   */
  private async handleOkMessage(): Promise<void> {
    const { dataSent, metadata, file, fileId } = this.transferSession!;
    if (dataSent === metadata.fileSize) {
      this.completeTransfer();
      return;
    }
    handleDisplayFileStatus(fileId, FileStatus.TRANSFERRING);
    const nextChunkEnd = Math.min(dataSent! + CHUNK_SIZE, metadata.fileSize);
    const chunk = file!.slice(dataSent, nextChunkEnd, metadata.fileType);
    const payloadData = await chunk.arrayBuffer();
    await this.send(payloadData);
    this.transferSession!.dataSent = nextChunkEnd;
    this.transferSession!.chunksIndex++;
    peerEmitter.dispatchPeerEvent<FileUpdateEvent>(PeerEvent.FILE_UPDATE, {
      fileId,
      currentData: nextChunkEnd,
      totalData: metadata.fileSize,
    });
  }

  private async handleEOF(): Promise<void> {
    const { chunks, metadata } = this.transferSession!;
    const blob = new Blob(chunks!, { type: metadata.fileType });
    if (blob.size !== metadata.fileSize) {
      alert("File mismatch !! Transfer session might be corrupted.");
      throw new Error("File size mismatch");
    }
    const hashBlob = await hashFile(blob);
    if (hashBlob !== this.transferSession?.metadata.hash) {
      alert("File mismatch !! Transfer session might be corrupted.");
      throw new Error("File hash mismatch");
    }
    handleDisplayFileStatus(this.transferSession!.fileId, FileStatus.DONE);
    this.downloadFile(blob, metadata, this.transferSession!.fileId);
    this.state = PeerState.CONNECTED;
    this.transferSession = null;
  }

  private downloadFile(file: Blob, metadata: InitPayload, fileId: string) {
    addDownloadLink(fileId, file, metadata.fileName);
  }
}

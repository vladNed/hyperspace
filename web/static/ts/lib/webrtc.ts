import { Identity } from "./auth.js";
import {
  FileStatus,
  ICE_SERVERS,
  MAX_CHUNK_SIZE,
  PeerEvent,
  PeerMessageType,
  PeerState,
  SignalingEvent,
} from "./constants.js";
import {
  handleClearDb,
  handleDisplayFileStatus,
  handleFailedFileTransfer,
  handleRemoveFileDiv,
  handleRetrieveFromDisk,
  handleSaveToDisk,
} from "./handlers.js";
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
  buildHash,
  getFileID,
  preProcessFile,
} from "./utils.js";

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
  private currentChunkSize: number = 0;

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
    const dataChannel = this.peerConnection.createDataChannel("main");
    dataChannel.binaryType = "arraybuffer";

    dataChannel.onopen = async () => {
      const chunkSize = Math.min(
        MAX_CHUNK_SIZE,
        this.peerConnection.sctp?.maxMessageSize || 0,
      );
      this.currentChunkSize = chunkSize - Math.ceil(chunkSize * 0.02);
      await handleClearDb();
      sessionStorage.removeItem("__SdbVersion");
    };

    dataChannel.onclose = (event: Event) => {
      this.handleOnChannelDisconnect();
    };

    dataChannel.onerror = (event: RTCErrorEvent) => {
      if (!this.transferSession) {
        return;
      }
      handleFailedFileTransfer(this.transferSession!.fileId);
      console.error(event);
      if (dataChannel.readyState == "open") {
        this.sendErr();
      }
      this.resetPeer();
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

      this.dataChannel.onopen = async () => {
        const chunkSize = Math.min(
          MAX_CHUNK_SIZE,
          this.peerConnection.sctp?.maxMessageSize || 0,
        );
        this.currentChunkSize = chunkSize - Math.ceil(chunkSize * 0.02);
        await handleClearDb();
      };

      this.dataChannel.onclose = (_event: Event) => {
        this.handleOnChannelDisconnect();
      };

      this.dataChannel.onerror = (event: RTCErrorEvent) => {
        if (!this.transferSession) {
          console.error("No transfer session", event.error);
          return;
        }
        handleFailedFileTransfer(this.transferSession!.fileId);
        console.error(event);
        if (this.dataChannel?.readyState == "open") {
          this.sendErr();
        }
        this.resetPeer();
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
      throw new Error("SDP ERROR: Cannot create new offer");
    }
  }

  public async acceptOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      await this.peerConnection.setRemoteDescription(offer);
      this.state = PeerState.OFFER_ACCEPTED;
    } catch (error) {
      throw new Error("SDP ERROR: Cannot set offer");
    }
  }

  public async acceptAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      await this.peerConnection.setRemoteDescription(answer);
      this.state = PeerState.ANSWER_SET;
    } catch (error) {
      throw new Error("SDP ERROR: Cannot set answer");
    }
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    try {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      return answer;
    } catch (error) {
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
    if (this.state !== PeerState.CONNECTED && this.transferSession !== null) {
      console.error("Peer not in correct state", this.state);
      return;
    }

    try {
      const metadata = await preProcessFile(file, this.currentChunkSize);
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

  public async cancelTransfer(cancelledFileId: string): Promise<void> {
    if (
      this.state !== PeerState.SENDING &&
      this.state !== PeerState.RECEIVING
    ) {
      return;
    }

    this.state = PeerState.CANCEL;
    const { fileId } = this.transferSession!;
    if (fileId !== cancelledFileId) {
      return;
    }

    await this.sendCancel();
    handleRemoveFileDiv(fileId);
    this.resetPeer();
  }

  async checkCancelSignal(payload: ArrayBuffer): Promise<boolean> {
    if (payload.byteLength === 1 && new Uint8Array(payload)[0] === 0xff) {
      handleDisplayFileStatus(this.transferSession!.fileId, FileStatus.CANCEL);
      this.resetPeer();
      return true;
    }

    return false;
  }

  /**
   * Main handler for onmessage events from the data channel. The handler
   * will switch between the different states of the peer to handle the
   * incoming messages.
   */
  private async handleOnMessageEvent(event: MessageEvent): Promise<void> {
    const eventData = (event as MessageEvent<ArrayBuffer>).data;
    const handlers = new Map([
      [
        PeerState.CONNECTED,
        async () => {
          const peerMessage = await this.decodeMessage(eventData);
          if (peerMessage.type === PeerMessageType.INIT) {
            await this.handleInitMessage(peerMessage.body as InitPayload);
          }
        },
      ],
      [
        PeerState.RECEIVING,
        async () => {
          if (await this.checkCancelSignal(eventData)) {
            return;
          }
          await this.handlePayloadMessage(eventData);
        },
      ],
      [
        PeerState.SENDING,
        async () => {
          if (await this.checkCancelSignal(eventData)) {
            return;
          }
          const peerMessage = await this.decodeMessage(eventData);
          if (peerMessage.type === PeerMessageType.OK) {
            await this.handleOkMessage();
            return;
          }
          handleFailedFileTransfer(this.transferSession!.fileId);
          this.sendErr();
          this.resetPeer();
        },
      ],
      [PeerState.CANCEL, async () => {}],
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

    try {
      this.dataChannel?.send(encryptedData);
    } catch (error) {
      handleFailedFileTransfer(this.transferSession!.fileId);
      this.resetPeer();
    }
  }

  private completeTransfer(): void {
    handleDisplayFileStatus(this.transferSession!.fileId, FileStatus.SENT);
    const eof = new ArrayBuffer(0);
    this.dataChannel!.send(eof);
    this.state = PeerState.CONNECTED;
    this.transferSession = null;
  }

  private async sendOk(): Promise<void> {
    let okMsg: PeerMessage = { type: PeerMessageType.OK };
    await this.send(JSON.stringify(okMsg));
  }

  private async sendErr(): Promise<void> {
    let errMessage: PeerMessage = { type: PeerMessageType.ERROR };
    await this.send(JSON.stringify(errMessage));
  }

  private async sendCancel(): Promise<void> {
    const eof = new Uint8Array([0xff]).buffer;
    this.dataChannel!.send(eof);
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
        fileSize: payload.fileSize,
      },
    );
    handleDisplayFileStatus(fileId, FileStatus.TRANSFERRING, true);
  }

  /**
   * Handles incoming chunk payloads from the peer. Acknowledges the
   * receipt of the chunk and prepares to receive the next chunk.
   * @param payload A chunk of a file
   */
  private async handlePayloadMessage(payload: ArrayBuffer): Promise<void> {
    if (!this.transferSession) return;
    if (payload.byteLength === 0) {
      this.handleEOF();
      return;
    }
    const decryptedPayload = await this.identity.decrypt(payload);
    const { chunksIndex, metadata, fileId } = this.transferSession!;
    peerEmitter.dispatchPeerEvent<FileUpdateEvent>(PeerEvent.FILE_UPDATE, {
      fileId,
      currentData: Math.min(
        chunksIndex * this.currentChunkSize || this.currentChunkSize,
        metadata.fileSize,
      ),
      totalData: metadata.fileSize,
    });

    const blob = new Blob([decryptedPayload]);
    const chunkIndex = this.transferSession!.chunksIndex + 1;
    await handleSaveToDisk(blob, chunkIndex, fileId);
    this.transferSession!.chunksIndex++;
    await this.sendOk();
  }

  /**
   * Handles the OK message from the peer, indicating that the peer has
   * received the chunk and is ready for the next chunk.
   */
  private async handleOkMessage(): Promise<void> {
    if (!this.transferSession) return;
    const { dataSent, metadata, file, fileId } = this.transferSession!;
    if (dataSent === metadata.fileSize) {
      this.completeTransfer();
      return;
    }
    if (dataSent === 0) {
      handleDisplayFileStatus(fileId, FileStatus.TRANSFERRING);
    }
    const nextChunkEnd = Math.min(
      dataSent! + this.currentChunkSize,
      metadata.fileSize,
    );
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
    const { metadata, fileId, chunksIndex } = this.transferSession!;
    const chunks = await handleRetrieveFromDisk(fileId);
    const blob = new Blob(chunks, { type: metadata.fileType });
    if (blob.size !== metadata.fileSize) {
      alert("File mismatch !! Transfer session might be corrupted.");
      this.resetPeer();
      throw new Error("File size mismatch");
    }
    const chunksBuffer = await Promise.all(
      chunks!.map(async (chunk) => {
        const data = await chunk.arrayBuffer();
        return new Uint8Array(data);
      }),
    );
    const hash = await buildHash(chunksBuffer);
    if (hash !== this.transferSession?.metadata.hash) {
      alert("File mismatch !! Transfer session might be corrupted.");
      handleFailedFileTransfer(fileId);
      this.resetPeer();
      throw new Error("File hash mismatch");
    }
    handleDisplayFileStatus(fileId, FileStatus.DONE);
    peerEmitter.dispatchPeerEvent<FileUpdateEvent>(PeerEvent.FILE_UPDATE, {
      fileId,
      currentData: metadata.fileSize,
      totalData: metadata.fileSize,
    });
    this.downloadFile(blob, metadata, fileId);
    this.state = PeerState.CONNECTED;
    this.transferSession = null;
  }

  private downloadFile(file: Blob, metadata: InitPayload, fileId: string) {
    addDownloadLink(fileId, file, metadata.fileName);
  }
}

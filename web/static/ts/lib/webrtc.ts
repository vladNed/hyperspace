import { Identity } from "./auth.js";
import {
  CHUNK_SIZE,
  ICE_SERVERS,
  PeerEvent,
  PeerMessageType,
  PeerState,
} from "./constants.js";
import type {
  InitPayload,
  PeerMessage,
  TransferSession,
  SDPEventMessage,
  FileUpdateEvent,
  ReceiveTransferMessage,
} from "./types.js";
import { getFileID, preProcessFile } from "./utils.js";

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

    this.peerConnection.onicecandidate = (event: Event | undefined) => {
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
      console.log(
        "New on connection state change evnet:",
        this.peerConnection.connectionState,
      );
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

  private setOffererDataChannel(): RTCDataChannel {
    const dataChannel = this.peerConnection.createDataChannel(
      "hypserspace-protocol",
    );

    dataChannel.binaryType = "arraybuffer";

    dataChannel.onclose = (event: Event | undefined) => {
      console.log("Data Channel Closed", event);
    };

    dataChannel.onmessage = (event: MessageEvent | undefined) => {
      if (!event) return;
      this.handleOnMessageEvent(event);
    };

    return dataChannel;
  }

  private setAnswererDataChannel(): void {
    this.peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
      this.dataChannel = event.channel;
      this.dataChannel.binaryType = "arraybuffer";

      this.dataChannel.onclose = (event: Event | undefined) => {
        console.log("Data Channel Closed", event);
      };

      this.dataChannel.onmessage = async (event: MessageEvent | undefined) => {
        if (!event) return;
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

  public async initTransfer(file: File, fileId: string): Promise<void> {
    if (this.state !== PeerState.CONNECTED && this.transferSession !== null)
      return;
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

    if (this.dataChannel === null) {
      throw new Error("Data channel not set");
    }

    const peerMessage: PeerMessage = {
      type: PeerMessageType.INIT,
      body: metadata,
    };
    this.dataChannel.send(JSON.stringify(peerMessage));
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
          const peerMessage = JSON.parse(
            (event as MessageEvent<string>).data,
          ) as PeerMessage;
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
          const eventPayload = event as MessageEvent<string>;
          const msg = JSON.parse(eventPayload.data) as PeerMessage;
          if (msg.type === PeerMessageType.OK) {
            await this.handleOkMessage();
          } else {
            console.error("Unknown message type", msg);
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

  private completeTransfer(): void {
    const eof = new ArrayBuffer(0);
    this.dataChannel!.send(eof);
    this.state = PeerState.CONNECTED;
    this.transferSession = null;
  }

  private async sendChunk(chunk: ArrayBuffer): Promise<void> {
    let encryptedChunk = await this.identity.encrypt(chunk);
    this.dataChannel!.send(encryptedChunk);
  }

  private sendOk(): void {
    const okMsg: PeerMessage = { type: PeerMessageType.OK };
    this.dataChannel!.send(JSON.stringify(okMsg));
  }

  /**
   * Handles initiating the transfer session and preparing the peer
   * to receive the chunks.
   * @param payload The transfer metadata payload
   */
  private async handleInitMessage(payload: InitPayload): Promise<void> {
    const fileId = await getFileID(payload.hash); // TODO: Generate a unique file ID using other means
    this.transferSession = {
      metadata: payload,
      chunksIndex: 0,
      chunks: [] as Blob[],
      fileId,
    };
    this.state = PeerState.RECEIVING;
    this.dataChannel!.send(
      JSON.stringify({ type: PeerMessageType.OK } as PeerMessage),
    );

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
    peerEmitter.dispatchPeerEvent<FileUpdateEvent>(PeerEvent.FILE_UPDATE, {
      fileId: this.transferSession!.fileId,
      currentData: this.transferSession!.chunksIndex * CHUNK_SIZE,
      totalData: this.transferSession!.metadata.fileSize,
    });

    const blob = new Blob([decryptedPayload]);
    this.transferSession!.chunks!.push(blob);
    this.transferSession!.chunksIndex++;
    this.sendOk();
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
    const nextChunkEnd = Math.min(dataSent! + CHUNK_SIZE, metadata.fileSize);
    const chunk = file!.slice(dataSent, nextChunkEnd, metadata.fileType);
    const payloadData = await chunk.arrayBuffer();
    await this.sendChunk(payloadData);
    this.transferSession!.dataSent = nextChunkEnd;
    this.transferSession!.chunksIndex++;
    peerEmitter.dispatchPeerEvent<FileUpdateEvent>(PeerEvent.FILE_UPDATE, {
      fileId,
      currentData: nextChunkEnd,
      totalData: metadata.fileSize,
    });
  }

  private handleEOF(): void {
    const { chunks, metadata } = this.transferSession!;
    const blob = new Blob(chunks!, { type: metadata.fileType });
    if (blob.size !== metadata.fileSize) {
      console.error(
        `Chunks: ${chunks?.length}, Blob size: ${blob.size}, Meta total size: ${metadata.fileSize}`,
      );
      throw new Error("File size mismatch");
    }

    this.downloadFile(blob, metadata);
    this.state = PeerState.CONNECTED;
    this.transferSession = null;
  }

  private downloadFile(file: Blob, metadata: InitPayload) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = metadata.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

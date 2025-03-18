import { CHUNK_SIZE, ICE_SERVERS, PeerEvent, PeerState } from "./constants.js";
import {
  type FileMetadata,
  type FilePayload,
  PeerMessageType,
  type PeerMessage,
  type TransferSession,
} from "./types.js";
import { preProcessFile } from "./utils.js";

export class PeerEmitter extends EventTarget {
  dispatchPeerEvent<T>(name: PeerEvent, detail: T): void {
    this.dispatchEvent(new CustomEvent(name.valueOf(), { detail }));
  }
}

export const peerEmitter = new PeerEmitter();

export interface SDPEventMessage {
  sdp: RTCSessionDescriptionInit;
}

export interface InitTransferMessage {
  file: File;
}

export class WebRTCPeer {
  private peerConnection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private state: PeerState = PeerState.IDLE;
  private transferSession: TransferSession | null = null;

  constructor(isOfferer: boolean = false) {
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
          console.log("Peer disconnected");
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

      this.dataChannel.onclose = (event: Event | undefined) => {
        console.log("Data Channel Closed", event);
      };

      this.dataChannel.onmessage = (event: MessageEvent | undefined) => {
        if (!event) return;
        this.handleOnMessageEvent(event);
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

  public async initTransfer(file: File): Promise<void> {
    if (this.state !== PeerState.CONNECTED && this.transferSession !== null)
      return;
    const metadata = await preProcessFile(file);
    const transferSession: TransferSession = {
      metadata,
      file,
      totalData: file.size,
      dataSent: 0,
    };
    this.transferSession = transferSession;
    this.state = PeerState.TRANSFERRING;

    if (this.dataChannel === null) {
      throw new Error("Data channel not set");
    }

    const peerMessage: PeerMessage = {
      type: PeerMessageType.INIT.valueOf(),
      body: metadata,
    };
    this.dataChannel.send(JSON.stringify(peerMessage));
  }

  private handleOnMessageEvent(event: MessageEvent): void {
    const peerMessage: PeerMessage = JSON.parse(event.data);
    switch (peerMessage.type) {
      case PeerMessageType.INIT:
        this.handleInitMessage(peerMessage.body as FileMetadata);
        break;
      case PeerMessageType.PAYLOAD:
        this.handlePayloadMessage(peerMessage.body as FilePayload);
        break;
      case PeerMessageType.ERROR:
        this.handleErrorMessage();
        break;
      case PeerMessageType.OK:
        this.handleOkMessage();
        break;
      case PeerMessageType.DONE:
        this.handleDoneMessage();
        break;
      default:
        console.error("Unknown message type", peerMessage);
        break;
    }
  }

  private requirePeerState(state: PeerState): boolean {
    if (this.state === state) return true;

    const errorMsg: PeerMessage = {
      type: PeerMessageType.ERROR,
      body: { msg: "Peer in wrong state to start new transfer" },
    };
    this.dataChannel!.send(JSON.stringify(errorMsg));

    return false;
  }

  private completeTransfer(): void {
    const doneMsg: PeerMessage = {
      type: PeerMessageType.DONE,
      body: null,
    };

    this.dataChannel!.send(JSON.stringify(doneMsg));
    this.state = PeerState.CONNECTED;
    this.transferSession = null;
  }

  private sendChunk(chunk: FilePayload): void {
    const chunkMsg: PeerMessage = {
      type: PeerMessageType.PAYLOAD,
      body: chunk,
    };

    this.dataChannel!.send(JSON.stringify(chunkMsg));
  }

  private handleInitMessage(payload: FileMetadata): void {
    if (!this.requirePeerState(PeerState.CONNECTED)) return;
    this.transferSession = {
      metadata: payload,
      file: null,
      dataSent: 0,
      totalData: 0,
    };
    this.state = PeerState.TRANSFERRING;
    const okMsg: PeerMessage = {
      type: PeerMessageType.OK,
      body: null,
    };
    this.dataChannel!.send(JSON.stringify(okMsg));
  }

  private handlePayloadMessage(payload: FilePayload): void {
    if (!this.requirePeerState(PeerState.TRANSFERRING)) return;
    const data = payload.data;
    const sess = this.transferSession!;
    sess.dataSent += data.size;
    if (sess.chunks === undefined) {
      sess.chunks = [];
    }
    sess.chunks!.push(data);

    const okMsgPayload: PeerMessage = {
      type: PeerMessageType.OK,
      body: null,
    };
    this.dataChannel!.send(JSON.stringify(okMsgPayload));
  }

  private handleErrorMessage(): void {
    if (!this.requirePeerState(PeerState.TRANSFERRING)) return;
    this.state = PeerState.CONNECTED;
    this.transferSession = null;
  }

  private handleOkMessage(): void {
    if (!this.requirePeerState(PeerState.TRANSFERRING)) return;
    const { totalData, dataSent, file, metadata } = this.transferSession!;
    if (totalData === dataSent) {
      this.completeTransfer();
      return;
    }

    const nextChunkEnd = Math.min(dataSent + CHUNK_SIZE, totalData);
    const chunk = file!.slice(dataSent, nextChunkEnd);

    this.sendChunk({ data: chunk, hash: metadata.hash });
    this.transferSession!.dataSent += chunk.size;
  }

  private handleDoneMessage(): void {
    if (!this.requirePeerState(PeerState.TRANSFERRING)) return;
    const { chunks, metadata } = this.transferSession!;
    const file = new File(chunks!, metadata.name, {
      type: metadata.fileType,
    });

    console.log(file);

    this.state = PeerState.CONNECTED;
    this.transferSession = null;
  }
}

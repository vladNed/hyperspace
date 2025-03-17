import { ICE_SERVERS, PeerEvent, PeerState } from "./constants.js";

export class PeerEmitter extends EventTarget {
  dispatchPeerEvent<T>(name: PeerEvent, detail: T): void {
    this.dispatchEvent(new CustomEvent(name.valueOf(), { detail }));
  }
}

export const peerEmitter = new PeerEmitter();

export interface SDPEventMessage {
  sdp: RTCSessionDescriptionInit;
}

export class WebRTCPeer {
  private peerConnection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null;
  private state: PeerState = PeerState.IDLE;

  constructor(isOfferer: boolean = false) {
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
    this.dataChannel = null;
    if (isOfferer) {
      this.setOffererDataChannel();
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

  private setOffererDataChannel(): void {
    this.dataChannel = this.peerConnection.createDataChannel(
      "hypserspace-protocol",
    );

    this.dataChannel.onopen = (event: Event | undefined) => {
      console.log("Data Channel Opened", event);
    };

    this.dataChannel.onclose = (event: Event | undefined) => {
      console.log("Data Channel Closed", event);
    };

    this.dataChannel.onmessage = (event: MessageEvent | undefined) => {
      console.log("Data Channel Message", event);
    };
  }

  private setAnswererDataChannel(): void {
    this.peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
      this.dataChannel = event.channel;

      this.dataChannel.onopen = (event: Event | undefined) => {
        console.log("Data Channel Opened", event);
        this.dataChannel?.send("Hello there");
      };

      this.dataChannel.onclose = (event: Event | undefined) => {
        console.log("Data Channel Closed", event);
      };

      this.dataChannel.onmessage = (event: MessageEvent | undefined) => {
        console.log("Data Channel Message", event);
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
}

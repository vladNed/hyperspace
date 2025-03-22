import { PeerEvent, SignalingEvent, SignalingState } from "./constants.js";
import {
  handleDisplayStatusChange,
  handleSessionResponseError,
} from "./handlers.js";
import type {
  AnswerDataResponse,
  OfferDataResponse,
  Response,
  SDPEventMessage,
  SessionResponse,
} from "./types.js";
import { decodeSDP, encodeSDP } from "./utils.js";
import { peerEmitter } from "./webrtc.js";

export class SignallingEmitter extends EventTarget {
  dispatchPeerEvent<T>(name: SignalingEvent, detail: T): void {
    this.dispatchEvent(new CustomEvent(name.valueOf(), { detail }));
  }
}

export const signallingEmitter = new SignallingEmitter();

export class WSConnect {
  private client: WebSocket;
  private state: SignalingState = SignalingState.IDLE;

  constructor() {
    this.client = new WebSocket((window as any).SERVER_CONFIG?.WS_URL || "");

    this.client.onopen = () => {
      signallingEmitter.dispatchPeerEvent(SignalingEvent.CONNECTED, {});
    };

    this.client.onmessage = (event: MessageEvent<string>) => {
      switch (this.state) {
        case SignalingState.OFFER_SENT:
          const message = JSON.parse(event.data) as SessionResponse<Response>;
          if (message.type == "error") {
            handleSessionResponseError(message.payload.message);
          } else if (message.type == "ok") {
            this.state = SignalingState.WAITING_FOR_ANSWER;
            handleDisplayStatusChange("Waiting for others to join");
          }
          break;
        case SignalingState.GATHERING:
          const offerDataMsg = JSON.parse(event.data) as SessionResponse<
            OfferDataResponse | Response
          >;
          if (
            offerDataMsg.type == "error" &&
            (offerDataMsg.payload as Response).message
          ) {
            handleSessionResponseError(
              (offerDataMsg.payload as Response).message,
            );
          } else if (offerDataMsg.type == "ok") {
            const offerData = offerDataMsg.payload as OfferDataResponse;
            const offerSDP = decodeSDP(offerData.offerSDP);
            signallingEmitter.dispatchPeerEvent(SignalingEvent.OFFER_FETCHED, {
              offerSDP,
              pubKey: offerData.pubKey,
            });
          }
          break;
        case SignalingState.WAITING_FOR_ANSWER:
          const answerData = JSON.parse(event.data) as AnswerDataResponse;
          peerEmitter.dispatchPeerEvent(PeerEvent.ANSWER_CREATED, {
            sdp: decodeSDP(answerData.answerSDP),
            pubKey: answerData.pubKey,
          });

          break;
        default: {
          handleDisplayStatusChange("Left in unkown state. Please refresh.");
          break;
        }
      }
    };
  }

  public sendOffer(
    sdp: RTCSessionDescriptionInit,
    sessionId: string,
    pubKey: string,
  ) {
    const payload = {
      type: "offer",
      payload: {
        sessionId,
        offerSDP: encodeSDP(sdp),
        timestamp: new Date().toISOString(),
        pubKey,
      },
    };

    this.client.send(JSON.stringify(payload));
    this.state = SignalingState.OFFER_SENT;
    handleDisplayStatusChange("Connecting to server");
  }

  public getSessionData(sessionId: string) {
    const payload = {
      type: "get_offer",
      payload: {
        sessionId: sessionId,
      },
    };

    this.client.send(JSON.stringify(payload));
    this.state = SignalingState.GATHERING;
    handleDisplayStatusChange("Fetching session data");
  }

  public sendAnswer(
    sdp: RTCSessionDescriptionInit,
    sessionId: string,
    pubKey: string,
  ) {
    const payload = {
      type: "answer",
      payload: {
        sessionId,
        answerSDP: encodeSDP(sdp),
        timestamp: new Date().toISOString(),
        pubKey,
      },
    };

    this.client.send(JSON.stringify(payload));
    this.state = SignalingState.ANSWER_SENT;
    handleDisplayStatusChange("Connecting to peer");
  }

  public close() {
    this.client.close();
  }
}

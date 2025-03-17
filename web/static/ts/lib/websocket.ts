import { SignalingState } from "./constants.js";
import {
  handleDisplayStatusChange,
  handleSessionResponseError,
} from "./handlers.js";
import type { Response, SessionResponse } from "./types.js";
import { encodeSDP } from "./utils.js";

export class WSConnect {
  private client: WebSocket;
  private state: SignalingState = SignalingState.IDLE;

  constructor() {
    this.client = new WebSocket("ws://localhost:8080/ws/v1/session/");

    this.client.onopen = () => {
      console.log("Connected to signaling server");
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
        default: {
          console.log(event, this.state);
          handleDisplayStatusChange("Left in unkown state. Please refresh.");
          break;
        }
      }
    };
  }

  public sendOffer(sdp: RTCSessionDescriptionInit, sessionId: string) {
    const payload = {
      type: "offer",
      payload: {
        sessionId: sessionId,
        offerSDP: encodeSDP(sdp),
        timestamp: new Date().toISOString(),
      },
    };

    this.client.send(JSON.stringify(payload));
    this.state = SignalingState.OFFER_SENT;
  }
}

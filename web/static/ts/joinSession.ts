import { PeerEvent, SignalingEvent } from "./lib/constants.js";
import { handleDisplayStatusChange } from "./lib/handlers.js";
import { peerEmitter, SDPEventMessage, WebRTCPeer } from "./lib/webrtc.js";
import { signallingEmitter, WSConnect } from "./lib/websocket.js";

let localPeer: WebRTCPeer | null = null;
let signalingChannel: WSConnect = new WSConnect();

document.addEventListener("DOMContentLoaded", async () => {
  if (localPeer === null) {
    // Created an answerer peer
    localPeer = new WebRTCPeer(false);
  }
});

const startBtn = document.getElementById("session-start-btn")!;
startBtn.addEventListener("click", async () => {
  const sessionInput = document.getElementById("sessionId") as HTMLInputElement;
  if (sessionInput.value === "") {
    alert("Please enter a session ID");
    return;
  }
  signalingChannel.getSessionData(sessionInput.value);
});

peerEmitter.addEventListener(PeerEvent.OFFER_ACCEPTED, (event: Event) => {
  const customevent = event as CustomEvent<SDPEventMessage>;
});

peerEmitter.addEventListener(PeerEvent.PEER_CONNECTED, async (event: Event) => {
  handleDisplayStatusChange("Connected to peer");
  signalingChannel.close();
});

signallingEmitter.addEventListener(
  SignalingEvent.OFFER_FETCHED,
  async (event: Event) => {
    if (localPeer === null) {
      // Created an answerer peer
      localPeer = new WebRTCPeer(false);
    }
    const customEvent = event as CustomEvent<{
      offerSDP: RTCSessionDescription;
    }>;
    await localPeer.acceptOffer(customEvent.detail.offerSDP);
    const answer = await localPeer.createAnswer();

    const sessionInput = document.getElementById(
      "sessionId",
    ) as HTMLInputElement;

    signalingChannel.sendAnswer(answer, sessionInput.value);
  },
);

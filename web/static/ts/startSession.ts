import { PeerEvent } from "./lib/constants.js";
import { handleCreateOffer, handleOfferAcceptedEvent } from "./lib/handlers.js";
import { type SDPEventMessage, WebRTCPeer, peerEmitter } from "./lib/webrtc.js";
import { WSConnect } from "./lib/websocket.js";

let localPeer: WebRTCPeer | null = null;
let signalingChannel: WSConnect = new WSConnect();

peerEmitter.addEventListener(PeerEvent.OFFER_CREATED, (event: Event) => {
  const customevent = event as CustomEvent<SDPEventMessage>;
  const sessionIdInput = document.getElementById(
    "sessionId",
  ) as HTMLInputElement;
  signalingChannel.sendOffer(customevent.detail.sdp, sessionIdInput.value);
});

peerEmitter.addEventListener(PeerEvent.OFFER_ACCEPTED, (event: Event) => {
  const customevent = event as CustomEvent<SDPEventMessage>;
  handleOfferAcceptedEvent(customevent.detail.sdp);
});

document.addEventListener("DOMContentLoaded", async () => {
  if (localPeer === null) {
    localPeer = new WebRTCPeer(true);
  }
  await handleCreateOffer(localPeer);
});

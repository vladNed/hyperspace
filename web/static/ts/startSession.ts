import { PeerEvent } from "./lib/constants.js";
import {
  handleCreateOffer,
  handleDisplayStatusChange,
} from "./lib/handlers.js";
import { type SDPEventMessage, WebRTCPeer, peerEmitter } from "./lib/webrtc.js";
import { WSConnect } from "./lib/websocket.js";

declare var htmx: any;

let localPeer: WebRTCPeer | null = null;
let signalingChannel: WSConnect = new WSConnect();

peerEmitter.addEventListener(PeerEvent.OFFER_CREATED, (event: Event) => {
  const customevent = event as CustomEvent<SDPEventMessage>;
  const sessionIdInput = document.getElementById(
    "sessionId",
  ) as HTMLInputElement;
  signalingChannel.sendOffer(customevent.detail.sdp, sessionIdInput.value);
});

peerEmitter.addEventListener(PeerEvent.ANSWER_CREATED, async (event: Event) => {
  const customevent = event as CustomEvent<SDPEventMessage>;
  await localPeer!.acceptAnswer(customevent.detail.sdp);
});

peerEmitter.addEventListener(PeerEvent.PEER_CONNECTED, async (event: Event) => {
  handleDisplayStatusChange("Connected to peer");
  signalingChannel.close();
  const sessionInput = document.getElementById("sessionId") as HTMLInputElement;
  htmx.ajax("GET", "/session/connected/" + sessionInput.value + "/", {
    target: "#main-container",
    swap: "innerHTML",
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  if (localPeer === null) {
    localPeer = new WebRTCPeer(true);
  }
  await handleCreateOffer(localPeer);
});

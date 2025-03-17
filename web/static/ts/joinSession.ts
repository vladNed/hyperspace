import { WebRTCPeer } from "./lib/webrtc.js";
import { WSConnect } from "./lib/websocket.js";

let localPeer: WebRTCPeer | null = null;
let signalingChannel: WSConnect = new WSConnect();

document.addEventListener("DOMContentLoaded", async () => {
  if (localPeer === null) {
    // Created an answerer peer
    localPeer = new WebRTCPeer(false);
  }
});

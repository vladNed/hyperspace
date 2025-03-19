import { PeerEvent, SignalingEvent } from "./lib/constants.js";
import { handleDisplayStatusChange } from "./lib/handlers.js";
import type {
  FileUpdateEvent,
  InitTransferMessage,
  ReceiveTransferMessage,
  SDPEventMessage,
} from "./lib/types.js";
import { addFileDiv } from "./lib/utils.js";
import { peerEmitter, WebRTCPeer } from "./lib/webrtc.js";
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
  const sessionInput = document.getElementById("sessionId") as HTMLInputElement;

  signalingChannel.sendAnswer(customevent.detail.sdp, sessionInput.value);
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

signallingEmitter.addEventListener(
  SignalingEvent.OFFER_FETCHED,
  async (event: Event) => {
    if (localPeer === null) {
      localPeer = new WebRTCPeer(false);
    }
    const customEvent = event as CustomEvent<{
      offerSDP: RTCSessionDescription;
    }>;
    await localPeer.acceptOffer(customEvent.detail.offerSDP);
    await localPeer.createAnswer();
  },
);

peerEmitter.addEventListener(PeerEvent.INIT_TRANSFER, (event) => {
  const customEvent = event as CustomEvent<InitTransferMessage>;
  localPeer?.initTransfer(customEvent.detail.file, customEvent.detail.fileId);
});

peerEmitter.addEventListener(PeerEvent.FILE_UPDATE, (event) => {
  const eventMessage = event as CustomEvent<FileUpdateEvent>;
  const { currentData, totalData, fileId } = eventMessage.detail;
  const fileDiv = document.getElementById(fileId) as HTMLDivElement;
  const progressBar = fileDiv.querySelector(
    ".metadata  .progress-top  .progress",
  ) as HTMLDivElement;

  const progress = Math.round((currentData / totalData) * 100);

  progressBar.innerText = `${progress}%`;
  progressBar.style.width = `${progress}%`;

  if (progress === 100) {
    const icon = fileDiv.querySelector(".transfer-icon");
    icon!.innerHTML = '<i data-lucide="check" class="size-6"></i>';
    lucide.createIcons();
  }
});

peerEmitter.addEventListener(PeerEvent.TRANSFER_INITIATED, (event) => {
  const customEvent = event as CustomEvent<ReceiveTransferMessage>;
  const { fileName, fileId } = customEvent.detail;
  addFileDiv(fileId, fileName);
});

import { PeerEvent, PeerState } from "./lib/constants.js";
import {
  handleCreateOffer,
  handleDisplayStatusChange,
} from "./lib/handlers.js";
import type {
  FileUpdateEvent,
  InitTransferMessage,
  ReceiveTransferMessage,
  SDPEventMessage,
} from "./lib/types.js";
import { addFileDiv } from "./lib/utils.js";
import { WebRTCPeer, peerEmitter } from "./lib/webrtc.js";
import { WSConnect } from "./lib/websocket.js";

lucide.createIcons();

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

peerEmitter.addEventListener(PeerEvent.INIT_TRANSFER, (event) => {
  const customEvent = event as CustomEvent<InitTransferMessage>;
  localPeer?.initTransfer(customEvent.detail.file, customEvent.detail.fileId);
});

peerEmitter.addEventListener(PeerEvent.CONNECTION_STATUS_CHANGED, () => {
  window.location.reload();
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

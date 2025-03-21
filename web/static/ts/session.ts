import { Identity, importPubKey } from "./lib/auth.js";
import { PeerEvent, PeerState, SignalingEvent } from "./lib/constants.js";
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
import { addFileDiv, getFileID } from "./lib/utils.js";
import { peerEmitter, WebRTCPeer } from "./lib/webrtc.js";
import { signallingEmitter, WSConnect } from "./lib/websocket.js";

lucide.createIcons();

let localPeer: WebRTCPeer | null = null;
let signallingChannel: WSConnect = new WSConnect();
let identity: Identity | null = null;

export async function transferFile(file: File) {}

document.addEventListener("DOMContentLoaded", async () => {
  const peerType = document.getElementById("peer-type") as HTMLInputElement;
  if (peerType === null) {
    throw new Error("Cannot initialize session peer");
  }
  identity = await Identity.init();
  if (peerType.value === "offer") {
    localPeer = new WebRTCPeer(true, identity);
    await handleCreateOffer(localPeer);
  } else {
    localPeer = new WebRTCPeer(false, identity);
  }
});

const startBtn = document.getElementById("session-start-btn")!;
if (startBtn !== null) {
  startBtn.addEventListener("click", async () => {
    const sessionInput = document.getElementById(
      "sessionId",
    ) as HTMLInputElement;
    if (sessionInput.value === "") {
      alert("Please enter a session ID");
      return;
    }
    signallingChannel.getSessionData(sessionInput.value);
  });
}

peerEmitter.addEventListener(PeerEvent.OFFER_CREATED, async (event: Event) => {
  const { detail } = event as CustomEvent<SDPEventMessage>;
  const sessionIdInput = document.getElementById(
    "sessionId",
  ) as HTMLInputElement;
  let pubKey = await identity!.exportPubKey();
  signallingChannel.sendOffer(detail.sdp, sessionIdInput.value, pubKey);
});

peerEmitter.addEventListener(PeerEvent.OFFER_ACCEPTED, async (event: Event) => {
  const { detail } = event as CustomEvent<SDPEventMessage>;
  const sessionInput = document.getElementById("sessionId") as HTMLInputElement;
  let pubKey = await identity!.exportPubKey();
  signallingChannel.sendAnswer(detail.sdp, sessionInput.value, pubKey);
});

peerEmitter.addEventListener(PeerEvent.ANSWER_CREATED, async (event: Event) => {
  const { detail } = event as CustomEvent<{
    sdp: RTCSessionDescriptionInit;
    pubKey: string;
  }>;
  let pubKey = await importPubKey(detail.pubKey);
  await Promise.all([
    localPeer!.acceptAnswer(detail.sdp),
    identity!.deriveSharedSecret(pubKey),
  ]);
});

peerEmitter.addEventListener(PeerEvent.PEER_CONNECTED, async (event: Event) => {
  handleDisplayStatusChange("Connected to peer");
  signallingChannel.close();
  const sessionInput = document.getElementById("sessionId") as HTMLInputElement;
  htmx.ajax("GET", "/session/connected/" + sessionInput.value + "/", {
    target: "#main-container",
    swap: "outerHTML",
  });
});

peerEmitter.addEventListener(PeerEvent.INIT_TRANSFER, async (event) => {
  if (localPeer!.getState() !== PeerState.CONNECTED) return;
  const { detail } = event as CustomEvent<InitTransferMessage>;
  const fileId = await getFileID();
  addFileDiv(fileId, detail.file.name, false);
  localPeer!.initTransfer(detail.file, fileId);
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

peerEmitter.addEventListener(PeerEvent.CONNECTION_STATUS_CHANGED, () => {
  window.location.reload();
});

peerEmitter.addEventListener(PeerEvent.TRANSFER_INITIATED, (event) => {
  const customEvent = event as CustomEvent<ReceiveTransferMessage>;
  const { fileName, fileId } = customEvent.detail;
  addFileDiv(fileId, fileName, true);
});

signallingEmitter.addEventListener(
  SignalingEvent.OFFER_FETCHED,
  async (event: Event) => {
    const { detail } = event as CustomEvent<{
      offerSDP: RTCSessionDescription;
      pubKey: string;
    }>;
    await localPeer!.acceptOffer(detail.offerSDP);
    await localPeer!.createAnswer();
    const pubKey = await importPubKey(detail.pubKey);
    await identity!.deriveSharedSecret(pubKey);
  },
);

peerEmitter.addEventListener(PeerEvent.PEER_STATUS_CHANGED, (event) => {
  const { detail } = event as CustomEvent<{ status: string }>;
  handleDisplayStatusChange(detail.status);
});

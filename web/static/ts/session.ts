import { Identity, importPubKey } from "./lib/auth.js";
import { PeerEvent, PeerState, SignalingEvent } from "./lib/constants.js";
import {
  handleCreateOffer,
  handleDisplayStatusChange,
} from "./lib/handlers.js";
import type {
  FileUpdateEvent,
  InitTransferMessage,
  PinReceivedEvent,
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

signallingEmitter.addEventListener(SignalingEvent.CONNECTED, async () => {
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

signallingEmitter.addEventListener(SignalingEvent.PROMPT_PIN, async () => {
  const pinBtn = document.getElementById("pin-event-btn") as HTMLButtonElement;
  pinBtn.click();
  handleDisplayStatusChange("Confirmation Pin");
});

signallingEmitter.addEventListener(
  SignalingEvent.PIN_RECEIVED,
  async (event) => {
    const { detail } = event as CustomEvent<PinReceivedEvent>;
    sessionStorage.setItem("senders-x-pin", detail.pin);
    const pinEventBtn = document.getElementById("pin-event-btn")!;
    pinEventBtn.click();
    handleDisplayStatusChange("Confirmation Pin");
  },
);

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
  sessionStorage.setItem("senders-x-session", sessionIdInput.value);
});

peerEmitter.addEventListener(PeerEvent.OFFER_ACCEPTED, async (event: Event) => {
  const { detail } = event as CustomEvent<SDPEventMessage>;
  const sessionInput = document.getElementById("sessionId") as HTMLInputElement;
  let pubKey = await identity!.exportPubKey();
  signallingChannel.sendAnswer(detail.sdp, sessionInput.value, pubKey);
  sessionStorage.setItem("senders-x-session", sessionInput.value);
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
  const sessionId = sessionStorage.getItem("senders-x-session")!;
  htmx.ajax("GET", "/session/connect/" + sessionId + "/", {
    target: "#main-container",
    swap: "outerHTML",
  });
});

peerEmitter.addEventListener(PeerEvent.INIT_TRANSFER, async (event) => {
  if (localPeer!.getState() !== PeerState.CONNECTED) {
    console.error("Peer not in correct state", localPeer!.getState());
    return;
  }
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

signallingEmitter.addEventListener(SignalingEvent.CLOSE, () => {
  signallingChannel.close();
});

peerEmitter.addEventListener(PeerEvent.PEER_STATUS_CHANGED, (event) => {
  const { detail } = event as CustomEvent<{ status: string }>;
  handleDisplayStatusChange(detail.status);
});

signallingEmitter.addEventListener(
  SignalingEvent.REQUEST_ANSWER_WITH_PIN,
  (event) => {
    const { detail } = event as CustomEvent<{ pin: string; sessionId: string }>; // TODO: refactor this into type
    signallingChannel.requestAnswer(detail.pin, detail.sessionId);
  },
);

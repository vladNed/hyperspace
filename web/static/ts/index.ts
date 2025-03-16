import { PeerEvent } from "./lib/constants.js";
import {
  handleCreateOffer,
  handleCreateOfferEvent,
  handleOfferAcceptedEvent,
  handleSetAnswer,
  handleSetOffer,
} from "./lib/handlers.js";
import { type SDPEventMessage, WebRTCPeer, peerEmitter } from "./lib/webrtc.js";

let localPeer: WebRTCPeer | null = null;

const createOfferButton = document.getElementById("createOfferBtn");
createOfferButton?.addEventListener("click", async () => {
  if (localPeer === null) {
    localPeer = new WebRTCPeer(true);
  }

  await handleCreateOffer(localPeer);
});

const answerOfferButton = document.getElementById("answerOfferBtn");
answerOfferButton?.addEventListener("click", async () => {
  if (localPeer === null) {
    localPeer = new WebRTCPeer();
  }

  await handleSetOffer(localPeer);
});

const acceptAnswerButton = document.getElementById("acceptAnswerBtn");
acceptAnswerButton?.addEventListener("click", async () => {
  if (localPeer === null) throw new Error("Local Peer is not initialized");
  await handleSetAnswer(localPeer);
});

peerEmitter.addEventListener(PeerEvent.OFFER_CREATED, (event: Event) => {
  const customevent = event as CustomEvent<SDPEventMessage>;
  handleCreateOfferEvent(customevent.detail.sdp);
});

peerEmitter.addEventListener(PeerEvent.OFFER_ACCEPTED, (event: Event) => {
  const customevent = event as CustomEvent<SDPEventMessage>;
  handleOfferAcceptedEvent(customevent.detail.sdp);
});

const sessionInput = document.getElementById("sessionName") as HTMLInputElement;
sessionInput.addEventListener("input", (event: Event) => {
  console.log("works");
  const sessionInputLabel = document.querySelector(
    ".app-input-container label",
  ) as HTMLLabelElement;
  const value = sessionInput.value.trim();
  if (sessionInput.value.trim() !== "") {
    sessionInputLabel.classList.add("activated");
  } else {
    sessionInputLabel.classList.remove("activated");
    sessionInput.value = "";
  }
});

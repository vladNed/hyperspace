import { decodeSDP, encodeSDP } from "./utils.js";
import { WebRTCPeer } from "./webrtc.js";

/**
 * This function is called when the "Create Offer" button is clicked.
 * It creates an offer and sets the local description. If an error occurs, it displays the error message.
 */
export async function handleCreateOffer(localPeer: WebRTCPeer): Promise<void> {
  const errorContainer = document.getElementById("errorContainer");
  try {
    const offer = await localPeer.createOffer();
  } catch (error) {
    if (errorContainer && error instanceof Error) {
      errorContainer.innerText = error.message;
    }
  }
}

/**
 * After the ice candidate is created and the state is changed to complete,
 * this function is called to handle and display the event in the frontend.
 */
export function handleCreateOfferEvent(sdp: RTCSessionDescription): void {
  const offerContainer = document.getElementById(
    "offerContainer",
  ) as HTMLInputElement;
  offerContainer.value = encodeSDP(sdp);
}

/**
 * This function is called when the "Answer Offer" button is clicked.
 * Sets the remote description and sets the state to OFFER_ACCEPTED.
 */
export async function handleSetOffer(localPeer: WebRTCPeer): Promise<void> {
  const errorContainer = document.getElementById("errorContainer");
  const offerInput = document.getElementById("offerInput") as HTMLInputElement;

  try {
    await localPeer.acceptOffer(decodeSDP(offerInput.value));
    await localPeer.createAnswer();
  } catch (error) {
    if (errorContainer && error instanceof Error) {
      errorContainer.innerText = error.message;
    }
  }
}

/**
 * This function is called when the offer is accepted by the answerer and the local description is set.
 * @param sdp The local description set by the answerer
 */
export function handleOfferAcceptedEvent(sdp: RTCSessionDescription): void {
  const answerContainer = document.getElementById(
    "answerContainer",
  ) as HTMLInputElement;
  answerContainer.value = encodeSDP(sdp);
}

/**
 * The offerer sets the answer received from the answerer.
 * @param localPeer The local description set by the answerer
 */
export async function handleSetAnswer(localPeer: WebRTCPeer): Promise<void> {
  const errorContainer = document.getElementById("errorContainer");
  const answerInput = document.getElementById(
    "acceptAnswer",
  ) as HTMLInputElement;

  try {
    const decodedAnswer = decodeSDP(answerInput.value);
    await localPeer.acceptAnswer(decodedAnswer);
  } catch (error) {
    if (errorContainer && error instanceof Error) {
      errorContainer.innerText = error.message;
    }
  }
}

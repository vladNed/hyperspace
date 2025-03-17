import { decodeSDP, encodeSDP } from "./utils.js";
import { WebRTCPeer } from "./webrtc.js";

/**
 * This function is called when the "Create Offer" button is clicked.
 * It creates an offer and sets the local description. If an error occurs, it displays the error message.
 */
export async function handleCreateOffer(localPeer: WebRTCPeer): Promise<void> {
  const errorContainer = document.getElementById("error-box");
  try {
    await localPeer.createOffer();
  } catch (error) {
    if (errorContainer && error instanceof Error) {
      handleSessionResponseError(error.message);
    }
  }
}

export function handleSessionResponseError(message: string): void {
  const errorContainer = document.getElementById("error-box") as HTMLDivElement;
  errorContainer.innerText = "[* " + message + " *]";
  errorContainer.hidden = false;
}

export function handleDisplayStatusChange(message: string): void {
  const statusInput = document.getElementById("status") as HTMLInputElement;
  statusInput.value = message;
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

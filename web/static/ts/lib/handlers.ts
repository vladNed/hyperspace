import { FileStatus } from "./constants.js";
import { WebRTCPeer } from "./webrtc.js";

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
  const statusInput = document.getElementById("status") as HTMLDivElement;
  statusInput.textContent = message;
}

export function handleDisplayFileStatus(
  fileId: string,
  status: FileStatus,
): void {
  const statusElement = document.getElementById(fileId + "-status");
  if (statusElement) {
    statusElement.textContent = status.valueOf();
  }
}

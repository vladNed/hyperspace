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

export function handleFailedFileTransfer(fileId: string): void {
  const fileDiv = document.getElementById(fileId) as HTMLDivElement;
  const progressBar = fileDiv.querySelector(
    ".metadata  .progress-top  .progress",
  ) as HTMLDivElement;
  progressBar.innerText = "0%";
  progressBar.style.width = "0%";
  const icon = fileDiv.querySelector(".transfer-icon");
  icon!.innerHTML =
    ' <i data-lucide="cloud-alert" class="size-6 text-red-500"></i>';
  handleDisplayFileStatus(fileId, FileStatus.FAILED);
  lucide.createIcons();
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

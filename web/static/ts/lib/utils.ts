import { CHUNK_SIZE } from "./constants.js";
import type { InitPayload } from "./types.js";

export function encodeSDP(sdp: RTCSessionDescriptionInit): string {
  return btoa(JSON.stringify(sdp));
}

export function decodeSDP(sdp: string): RTCSessionDescriptionInit {
  return JSON.parse(atob(sdp));
}

export async function hashFile(file: File): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return btoa(String.fromCharCode(...hashArray));
}

export async function getFileID(): Promise<string> {
  const uuid = crypto.getRandomValues(new Uint8Array(12)).buffer;
  const timestamp = Date.now().toString();
  const timestampBuffer = new TextEncoder().encode(timestamp);
  const combinedBuffer = new Uint8Array(
    uuid.byteLength + timestampBuffer.byteLength,
  );

  combinedBuffer.set(new Uint8Array(uuid), 0);
  combinedBuffer.set(timestampBuffer, uuid.byteLength);

  const hashBuffer = await crypto.subtle.digest("SHA-256", combinedBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => ("00" + b.toString(16)).slice(-2))
    .join("");

  return hashHex;
}

export async function preProcessFile(file: File): Promise<InitPayload> {
  const totalData = file.size;
  const fileHash = await hashFile(file);
  let stages = 0;
  for (let i = 0; i < totalData; i += CHUNK_SIZE) {
    stages++;
  }

  const metadata: InitPayload = {
    fileName: file.name,
    fileType: file.type,
    fileSize: totalData,
    hash: fileHash,
    totalChunks: stages,
  };

  return metadata;
}

export function addFileDiv(
  fileId: string,
  fileName: string,
  isDownload: boolean,
): void {
  const fileContainer = document.getElementById("file-container");
  if (fileContainer === null) {
    throw new Error("File container not found");
  }
  const fileDiv = document.createElement("div");
  fileDiv.id = fileId;
  fileDiv.classList.add("transfer-file");

  const metadataDiv = document.createElement("div");
  metadataDiv.classList.add("metadata");
  const titleDiv = document.createElement("p");
  titleDiv.textContent = fileName;
  metadataDiv.appendChild(titleDiv);
  const progressDiv = document.createElement("div");
  progressDiv.classList.add("progress-top");
  const progressBar = document.createElement("div");
  progressBar.classList.add("progress");
  progressBar.innerText = "0%";
  progressBar.style.width = "0%";
  progressDiv.appendChild(progressBar);
  metadataDiv.appendChild(progressDiv);

  const iconDiv = document.createElement("div");
  iconDiv.classList.add("transfer-icon");
  if (isDownload) {
    iconDiv.innerHTML = '<i data-lucide="download" class="size-6"></i>';
  } else {
    iconDiv.innerHTML = '<i data-lucide="upload" class="size-6"></i>';
  }

  fileDiv.appendChild(metadataDiv);
  fileDiv.appendChild(iconDiv);
  fileContainer.appendChild(fileDiv);
  lucide.createIcons();
}

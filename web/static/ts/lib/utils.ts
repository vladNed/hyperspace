import type { InitPayload } from "./types.js";

export function encodeSDP(sdp: RTCSessionDescriptionInit): string {
  return btoa(JSON.stringify(sdp));
}

export function decodeSDP(sdp: string): RTCSessionDescriptionInit {
  return JSON.parse(atob(sdp));
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
  const hashHex = btoa(
    hashArray.map((byte) => String.fromCharCode(byte)).join(""),
  );
  return hashHex;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  return Array.from(uint8Array)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildHash(chunks: Uint8Array[]): Promise<string> {
  const chunksQueue = [...chunks];
  while (chunksQueue.length > 1) {
    const [el1, el2] = chunksQueue.splice(0, 2);
    const combined = new Uint8Array(el1.byteLength + el2.byteLength);
    combined.set(new Uint8Array(el1), 0);
    combined.set(new Uint8Array(el2), el1.byteLength);
    const hash = await crypto.subtle.digest("SHA-256", combined);
    const hashData = new Uint8Array(hash);
    chunksQueue.push(hashData);
  }

  const hex = arrayBufferToHex(chunksQueue[0]);
  return hex;
}

export async function preProcessFile(
  file: File,
  chunkSize: number,
): Promise<InitPayload> {
  const totalData = file.size;
  const chunks: Uint8Array[] = [];
  let currentEnd = 0;
  while (currentEnd < file.size) {
    const nextChunk = Math.min(currentEnd + chunkSize, file.size);
    const chunk = file.slice(currentEnd, nextChunk);
    currentEnd = nextChunk;
    console.log(chunk);
    const data = await chunk.arrayBuffer();
    chunks.push(new Uint8Array(data));
  }
  const hash = await buildHash(chunks);
  const metadata: InitPayload = {
    fileName: file.name,
    fileType: file.type,
    fileSize: totalData,
    hash,
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

  // Metadata div holds file name, status, and progress bar
  const metadataDiv = document.createElement("div");
  metadataDiv.classList.add("metadata");

  // Title and status div
  const topDiv = document.createElement("div");
  topDiv.classList.add("flex", "gap-4");

  // Name element
  const titleDiv = document.createElement("p");
  titleDiv.textContent = fileName;

  // Status element
  const titleStatus = document.createElement("p");
  titleStatus.classList.add("text-neutral-500");
  titleStatus.id = fileId + "-status";
  titleStatus.textContent = "Processing";
  topDiv.appendChild(titleDiv);
  topDiv.appendChild(titleStatus);

  metadataDiv.appendChild(topDiv);

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
    iconDiv.innerHTML =
      '<i data-lucide="cloud-download" class="size-6 animate-pulse"></i>';
  } else {
    iconDiv.innerHTML =
      '<i data-lucide="cloud-upload" class="size-6 animate-pulse"></i>';
  }

  fileDiv.appendChild(metadataDiv);
  fileDiv.appendChild(iconDiv);
  fileContainer.appendChild(fileDiv);
  lucide.createIcons();
}

/**
 * Replaces the upload icon with a download icon and adds a download link to the file div
 */
export function addDownloadLink(fileId: string, file: Blob, fileName: string) {
  const url = URL.createObjectURL(file);
  const fileDiv = document.getElementById(fileId);
  if (fileDiv === null) {
    throw new Error("File div not found");
  }

  const iconDiv = fileDiv.querySelector(".transfer-icon");
  if (iconDiv === null) {
    throw new Error("Icon div not found");
  }

  const newContainer = document.createElement("div");
  const link = document.createElement("a");
  link.classList.add("transfer-icon");
  link.title = "Download file";
  link.innerHTML = '<i data-lucide="download" class="size-6"></i>';
  link.href = url;
  link.download = fileName;
  newContainer.appendChild(link);

  fileDiv.replaceChild(newContainer, iconDiv);
  lucide.createIcons();
}

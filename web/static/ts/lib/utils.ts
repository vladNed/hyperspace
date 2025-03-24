import { CHUNK_SIZE } from "./constants.js";
import type { InitPayload } from "./types.js";

export function encodeSDP(sdp: RTCSessionDescriptionInit): string {
  return btoa(JSON.stringify(sdp));
}

export function decodeSDP(sdp: string): RTCSessionDescriptionInit {
  return JSON.parse(atob(sdp));
}

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
  }

  return new Blob(chunks).arrayBuffer();
}

export async function hashFile(file: Blob): Promise<string>;
export async function hashFile(file: File): Promise<string>;
export async function hashFile(file: File | Blob): Promise<string> {
  let hashBuffer: ArrayBuffer;
  if (file instanceof Blob) {
    hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      await file.arrayBuffer(),
    );
  } else {
    hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      await streamToBuffer((file as File).stream()),
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return btoa(String.fromCharCode(...hashArray));
  }

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

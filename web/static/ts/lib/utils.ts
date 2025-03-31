import type { InitPayload } from "./types.js";

export function encodeSDP(sdp: RTCSessionDescriptionInit): string {
  return btoa(JSON.stringify(sdp));
}

export function decodeSDP(sdp: string): RTCSessionDescriptionInit {
  return JSON.parse(atob(sdp));
}

export async function getFileID(): Promise<string> {
  const uuid = crypto.getRandomValues(new Uint8Array(8)).buffer;
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

function formatFileSize(bytes: number): string {
  console.log(bytes);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1000 && unitIndex < units.length - 1) {
    size /= 1000;
    unitIndex++;
  }

  return `${Math.round(size * 10) / 10} ${units[unitIndex]}`;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  return Array.from(uint8Array)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildHash(chunks: Uint8Array[]): Promise<string> {
  const chunksQueue = [...chunks];
  if (chunks.length === 1) {
    const hash = await crypto.subtle.digest("SHA-256", chunks[0]);
    const hashData = new Uint8Array(hash);
    const hex = arrayBufferToHex(hashData);
    return hex;
  }
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

export function addFileDiv(id: string, name: string, size: number): void {
  const fileContainer = document.getElementById("file-container");
  if (fileContainer === null) {
    throw new Error("File container not found");
  }

  const formatedFileSize = formatFileSize(size);
  const fileDiv = document.createElement("div");
  fileDiv.id = id;
  fileDiv.classList.add("transfer-file");
  fileDiv.innerHTML = `
    <div class="content-body">
        <div class="metadata">
            <div class="file-info">
                <p class="font-semibold text-ellipsis">${name}</p>
                <p class="text-gray-500 dark:text-gray-400">${formatedFileSize}</p>
            </div>
            <div id="${id}-status" class="file-status">Processing file</div>
            <div>
                <button type="button" class="close-button" onclick="cancelFileTransfer('${id}')">
                    <i data-lucide="x" class="size-4"></i>
                </button>
            </div>
        </div>
        <div class="low-bar">
            <div class="progress-top">
                <div class="progress" style="width: 0%">0%</div>
            </div>
            <div class="transfer-icon">
              <i data-lucide="loader" class="size-7 animate-spin"></i>
            </div>
        </div>
    </div>
    `;
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
  link.innerHTML = '<i data-lucide="download" class="size-7"></i>';
  link.href = url;
  link.download = fileName;
  newContainer.appendChild(link);

  const lowBarParent = fileDiv.querySelector(".low-bar")!;
  lowBarParent.replaceChild(newContainer, iconDiv);
  lucide.createIcons();
}

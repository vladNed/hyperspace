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
            <div id="close-button-body">
                <button type="button" class="close-button" id="close-button" onclick="cancelFileTransfer('${id}')">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
            </div>
        </div>
        <div class="low-bar">
            <div class="progress-top">
                <div class="progress" style="width: 0%">0%</div>
            </div>
            <div class="transfer-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-icon lucide-loader animate-spin">
                <path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/>
                <path d="M18 12h4"/>
                <path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/>
                <path d="m4.9 19.1 2.9-2.9"/>
                <path d="M2 12h4"/>
                <path d="m4.9 4.9 2.9 2.9"/>
              </svg>
            </div>
        </div>
    </div>
    `;
  fileContainer.appendChild(fileDiv);
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
  link.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-7">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>`;
  link.href = url;
  link.download = fileName;
  newContainer.appendChild(link);

  const lowBarParent = fileDiv.querySelector(".low-bar")!;
  lowBarParent.replaceChild(newContainer, iconDiv);
}

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

export async function handleSaveToDisk(
  chunk: Blob,
  chunkId: number,
  fileId: string,
): Promise<void> {
  const request = window.indexedDB.open("tempStorage", 2);
  return new Promise<void>((resolve, reject) => {
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("files")) {
        const newStore = db.createObjectStore("files", {
          keyPath: ["fileId", "chunkIndex"],
        });
        newStore.createIndex("fileId", "fileId", { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("files", "readwrite");
      const data = {
        fileId,
        chunkIndex: chunkId,
        chunk,
      };
      tx.objectStore("files").put(data);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject("Failed to save chunk to disk");
    };

    request.onerror = (e) => reject(e);
  });
}

export async function handleRetrieveFromDisk(fileId: string): Promise<Blob[]> {
  const request = window.indexedDB.open("tempStorage", 2);
  return new Promise<Blob[]>((resolve, reject) => {
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("files", "readonly");
      const store = tx.objectStore("files");
      const storeIndex = store.index("fileId");
      const keyRangeVal = IDBKeyRange.only(fileId);
      const chunks: Blob[] = [];

      storeIndex.openCursor(keyRangeVal).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          chunks.push(cursor.value.chunk);
          cursor.continue();
        } else {
          tx.oncomplete = () => resolve(chunks);
        }
      };
    };

    request.onerror = () => reject("Failed to open database");
  });
}

export async function handleClearDb(): Promise<void> {
  const request = window.indexedDB.deleteDatabase("tempStorage");
  return new Promise<void>((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error("Could not delete db");
      reject("Failed to delete database");
    };
  });
}

window.onbeforeunload = function () {
  const request = indexedDB.deleteDatabase("tempStorage");

  request.onerror = function (event) {
    console.error("Error deleting database:");
  };
};

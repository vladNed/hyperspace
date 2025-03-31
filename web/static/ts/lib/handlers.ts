import { FileStatus, PeerEvent } from "./constants.js";
import { CancelTransferEvent } from "./types.js";
import { WebRTCPeer, peerEmitter } from "./webrtc.js";

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
    ".content-body .low-bar  .progress-top  .progress",
  ) as HTMLDivElement;
  progressBar.innerText = "0%";
  progressBar.style.width = "0%";
  const icon = fileDiv.querySelector(".transfer-icon");
  icon!.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-7 text-red-500">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>`;
  handleDisplayFileStatus(fileId, FileStatus.FAILED);
}

export function handleRemoveFileDiv(fileId: string): void {
  const fileDiv = document.getElementById(fileId);
  if (fileDiv) {
    fileDiv.remove();
  }
}

export function handleDisplayFileStatus(
  fileId: string,
  status: FileStatus,
  receiving: boolean = false,
): void {
  const statusElement = document.getElementById(fileId + "-status");
  if (!statusElement) {
    throw new Error("Status element not found");
  }
  statusElement.textContent = status.valueOf();
  const fileDiv = document.getElementById(fileId) as HTMLDivElement;
  const iconDiv = fileDiv.querySelector(
    ".content-body .low-bar .transfer-icon",
  );
  console.log(">>>>>> WILL CHANGE STATUS TOOOO ->>>>", status.valueOf());
  switch (status) {
    case FileStatus.TRANSFERRING:
      if (receiving) {
        iconDiv!.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-7 animate-pulse">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9.75v6.75m0 0-3-3m3 3 3-3m-8.25 6a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
          </svg>`;
      } else {
        iconDiv!.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-7 animate-pulse">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
          </svg>`;
      }
      break;
    case FileStatus.CANCEL:
      iconDiv!.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-7 text-red-600">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>`;
      const closeBtnCancel = fileDiv.querySelector(
        ".content-body #close-button-body .close-button",
      ) as HTMLButtonElement;
      console.log("Close btn");
      closeBtnCancel.onclick = () => handleRemoveFileDiv(fileId);
      console.log(closeBtnCancel);
      break;
    case FileStatus.SENT:
    case FileStatus.FAILED:
    case FileStatus.DONE:
      const closeBtn = fileDiv.querySelector(
        ".content-body #close-button-body .close-button",
      ) as HTMLButtonElement;
      closeBtn.onclick = () => handleRemoveFileDiv(fileId);
      console.log("Just added a new onclick");
      break;
    default:
      break;
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

export async function handleCancelFile(fileId: string) {
  peerEmitter.dispatchPeerEvent<CancelTransferEvent>(
    PeerEvent.CANCEL_TRANSFER,
    { fileId },
  );
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

import { PeerEvent } from "./lib/constants.js";
import { preProcessFile } from "./lib/utils.js";
import { type InitTransferMessage, peerEmitter } from "./lib/webrtc.js";

lucide.createIcons();

const dropZone = document.getElementById("drag-drop-zone");
if (dropZone === null) {
  throw new Error("Drop zone not found");
}

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", (event) => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = event.dataTransfer!.files[0];
  transferFile(file);
});

function transferFile(file: File) {
  const fileContainer = document.getElementById("file-container");
  if (fileContainer === null) {
    throw new Error("File container not found");
  }

  const fileDiv = document.createElement("div");
  fileDiv.id = file.name;
  fileDiv.classList.add("transfer-file");

  const fileNameDiv = document.createElement("div");
  fileNameDiv.textContent = file.name;

  const iconDiv = document.createElement("div");
  iconDiv.id = "transfer-icon";
  iconDiv.classList.add("uploading");
  iconDiv.innerHTML = '<i data-lucide="cloud-upload" class="size-6"></i>';

  fileDiv.appendChild(fileNameDiv);
  fileDiv.appendChild(iconDiv);
  fileContainer.appendChild(fileDiv);
  lucide.createIcons();
  peerEmitter.dispatchPeerEvent<InitTransferMessage>(PeerEvent.INIT_TRANSFER, {
    file,
  });
}

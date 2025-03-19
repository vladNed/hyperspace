import { PeerEvent } from "./lib/constants.js";
import type { InitTransferMessage } from "./lib/types.js";
import { addFileDiv, getFileID, hashFile } from "./lib/utils.js";
import { peerEmitter } from "./lib/webrtc.js";

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

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = event.dataTransfer!.files[0];
  await transferFile(file);
});

async function transferFile(file: File) {
  const fileHash = await hashFile(file);
  const fileId = await getFileID(fileHash);

  addFileDiv(fileId, file.name);
  peerEmitter.dispatchPeerEvent<InitTransferMessage>(PeerEvent.INIT_TRANSFER, {
    file,
    fileId: fileId,
  });
}

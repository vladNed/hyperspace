import { PeerEvent, SignalingEvent } from "./lib/constants.js";
import { handleRemoveFileDiv } from "./lib/handlers.js";
import { InitTransferMessage } from "./lib/types.js";
import { peerEmitter } from "./lib/webrtc.js";
import { signallingEmitter } from "./lib/websocket.js";

setTimeout(() => {
  signallingEmitter.dispatchPeerEvent(SignalingEvent.CLOSE, {});
}, 3000);

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
  peerEmitter.dispatchPeerEvent<InitTransferMessage>(PeerEvent.INIT_TRANSFER, {
    file,
  });
});

const fileContainer = document.getElementById("file-container");

const observer = new MutationObserver(() => {
  requestAnimationFrame(() => {
    fileContainer!.scrollTo({
      top: fileContainer!.scrollHeight + 50, // Overscroll buffer
      behavior: "smooth",
    });
  });
});

observer.observe(fileContainer!, { childList: true });

const inputFile = document.getElementById("select-file-input");
if (inputFile === null) {
  throw new Error("Input file not found");
}
inputFile.addEventListener("change", async (event) => {
  event.preventDefault();
  console.log("triggered", event);
  const file = (inputFile as HTMLInputElement).files![0];
  peerEmitter.dispatchPeerEvent<InitTransferMessage>(PeerEvent.INIT_TRANSFER, {
    file,
  });
});

export function cancelFileTransfer(id: string) {
  peerEmitter.dispatchPeerEvent(PeerEvent.CANCEL_TRANSFER, { fileId: id });
}

(window as any).cancelFileTransfer = cancelFileTransfer;

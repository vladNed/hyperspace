import { PeerEvent, SignalingEvent } from "./lib/constants.js";
import { InitTransferMessage } from "./lib/types.js";
import { peerEmitter } from "./lib/webrtc.js";
import { signallingEmitter } from "./lib/websocket.js";

lucide.createIcons();

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

export function cancelFileTransfer(id: string) {
  peerEmitter.dispatchPeerEvent(PeerEvent.CANCEL_TRANSFER, { fileId: id });
}

(window as any).cancelFileTransfer = cancelFileTransfer;

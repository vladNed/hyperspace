import { PeerEvent, SignalingEvent } from "./lib/constants.js";
import { InitTransferMessage } from "./lib/types.js";
import { peerEmitter } from "./lib/webrtc.js";
import { signallingEmitter } from "./lib/websocket.js";

signallingEmitter.dispatchPeerEvent(SignalingEvent.CLOSE, {});

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
  peerEmitter.dispatchPeerEvent<InitTransferMessage>(PeerEvent.INIT_TRANSFER, {
    file,
  });
});

import { SignalingEvent } from "./lib/constants.js";
import { signallingEmitter } from "./lib/websocket.js";

signallingEmitter.addEventListener(SignalingEvent.CONNECTED, () => {
  document.getElementById("session-start-btn")!.click();
});

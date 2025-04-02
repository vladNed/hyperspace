import { SignalingEvent } from "./lib/constants.js";
import { signallingEmitter } from "./lib/websocket.js";

const inputs = document.getElementsByClassName(
  "pin-input",
) as HTMLCollectionOf<HTMLInputElement>;
Array.from(inputs).forEach((input) => {
  input.addEventListener("input", (event) => {
    const target = event.target! as HTMLInputElement;
    const id = parseInt(input.id.split("input")[1]);
    const isNumber = /^[0-9]$/.test(target.value);
    if (!isNumber) {
      target.value = "";
      return;
    }
    document.getElementById(`input${id + 1}`)?.focus();
  });
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Backspace") {
    const activeElement = document.activeElement! as HTMLInputElement;
    if (activeElement.tagName.toLowerCase() === "input") {
      const id = parseInt(activeElement.id.split("input")[1]);
      if (id > 1) {
        document.getElementById(`input${id - 1}`)?.focus();
      }
      activeElement.value = "";
    }
  }
});

document.addEventListener("paste", (e) => {
  const pastedText = (e.clipboardData || (window as any).clipboardData).getData(
    "text",
  ) as string;

  if (pastedText.length === 6 && /^\d{6}$/.test(pastedText)) {
    pastedText.split("").forEach((digit, index) => {
      if (inputs[index]) {
        inputs[index].value = digit;
      }
    });
  } else {
    e.preventDefault();
  }
});

const continueButton = document.getElementById("pin-continue-btn");
if (continueButton) {
  continueButton.addEventListener("click", () => {
    const inputs = document.getElementsByClassName(
      "pin-input",
    ) as HTMLCollectionOf<HTMLInputElement>;
    const pin = Array.from(inputs)
      .map((input) => input.value)
      .join("");
    if (pin.length !== 6) {
      alert("Please fill in the pin");
      return;
    }

    const sessionId = sessionStorage.getItem("SafeFiles-x-session")!;
    signallingEmitter.dispatchPeerEvent<{ pin: string; sessionId: string }>(
      SignalingEvent.REQUEST_ANSWER_WITH_PIN,
      {
        pin,
        sessionId,
      },
    );
  });
}

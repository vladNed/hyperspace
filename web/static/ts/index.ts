document.querySelectorAll(".app-input-container").forEach((container) => {
  const input = container.querySelector("input");
  if (input === null) return;
  input.addEventListener("input", (event) => {
    const label = container.querySelector("label");
    if (label === null) return;
    if (input.value !== "") {
      label.classList.add("activated");
    } else {
      label.classList.remove("activated");
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
});

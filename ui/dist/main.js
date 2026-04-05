const { invoke } = window.__TAURI__.core;

async function init() {
  const msg = await invoke("greet", { name: "World" });
  const content = document.querySelector(".content");
  if (content) {
    content.innerHTML = `<p>${msg}</p>`;
  }
}

window.addEventListener("DOMContentLoaded", init);

// Sidebar navigation
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector(".nav-item.active")?.classList.remove("active");
    btn.classList.add("active");
  });
});

// Play button toggle
const playBtn = document.getElementById("btn-play");
let playing = false;
playBtn?.addEventListener("click", () => {
  playing = !playing;
  playBtn.innerHTML = playing
    ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
    : '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
});

// Progress bar click
const progressBar = document.querySelector(".progress-bar");
const progressFill = document.getElementById("progress-fill");
progressBar?.addEventListener("click", (e) => {
  const rect = progressBar.getBoundingClientRect();
  const pct = ((e.clientX - rect.left) / rect.width) * 100;
  if (progressFill) progressFill.style.width = pct + "%";
});

// Volume bar click
const volumeBar = document.querySelector(".volume-bar");
const volumeFill = document.getElementById("volume-fill");
volumeBar?.addEventListener("click", (e) => {
  const rect = volumeBar.getBoundingClientRect();
  const pct = ((e.clientX - rect.left) / rect.width) * 100;
  if (volumeFill) volumeFill.style.width = pct + "%";
});

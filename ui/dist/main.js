// ── Mock Track Data ──────────────────────────────────────
const MOCK_TRACKS = [
  { id: 1, title: "Midnight Drive", artist: "Neon Waves", album: "After Hours", duration: 234, color: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" },
  { id: 2, title: "Golden Hour", artist: "Solstice", album: "Daybreak", duration: 198, color: "linear-gradient(135deg, #f09819, #edde5d)" },
  { id: 3, title: "Static Dreams", artist: "Echo Chamber", album: "White Noise", duration: 312, color: "linear-gradient(135deg, #2c3e50, #4ca1af)" },
  { id: 4, title: "Velvet Sky", artist: "Luna Park", album: "Cosmic Drift", duration: 267, color: "linear-gradient(135deg, #2b1055, #d53369)" },
  { id: 5, title: "Rust & Rails", artist: "Iron Coast", album: "Heavy Metal", duration: 185, color: "linear-gradient(135deg, #c94b4b, #4b134f)" },
  { id: 6, title: "Crystal Clear", artist: "Frostbite", album: "Below Zero", duration: 241, color: "linear-gradient(135deg, #00c6ff, #0072ff)" },
  { id: 7, title: "Paper Planes", artist: "Origami", album: "Fold & Fly", duration: 202, color: "linear-gradient(135deg, #f5af19, #f12711)" },
  { id: 8, title: "Ocean Floor", artist: "Deep Current", album: "Pressure", duration: 279, color: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)" },
  { id: 9, title: "Neon Lights", artist: "City Pulse", album: "Downtown", duration: 156, color: "linear-gradient(135deg, #fc466b, #3f5efb)" },
  { id: 10, title: "Autumn Leaves", artist: "Maple Road", album: "Seasons", duration: 223, color: "linear-gradient(135deg, #8e2de2, #ff6a00)" },
];

// ── Playback State ───────────────────────────────────────
const state = {
  tracks: [...MOCK_TRACKS],
  currentIndex: -1,
  playing: false,
  shuffle: false,
  repeat: 0, // 0=off, 1=all, 2=one
  progress: 0, // seconds
  volume: 70,
  shuffleOrder: [],
  shufflePos: -1,
};

// ── DOM References ───────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  heroArt: $("#hero-album-art"),
  heroTitle: $("#hero-title"),
  heroArtist: $("#hero-artist"),
  heroMeta: $("#hero-meta"),
  tracklistBody: $("#tracklist-body"),
  playerArt: $("#player-album-art"),
  playerTitle: $("#player-title"),
  playerArtist: $("#player-artist"),
  btnPlay: $("#btn-play"),
  btnPrev: $("#btn-prev"),
  btnNext: $("#btn-next"),
  btnShuffle: $("#btn-shuffle"),
  btnRepeat: $("#btn-repeat"),
  progressBar: $(".progress-bar"),
  progressFill: $("#progress-fill"),
  timeCurrent: $(".time-current"),
  timeTotal: $(".time-total"),
  volumeBar: $(".volume-bar"),
  volumeFill: $("#volume-fill"),
};

// ── Helpers ──────────────────────────────────────────────
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

function generateShuffleOrder() {
  const indices = state.tracks.map((_, i) => i);
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  state.shuffleOrder = indices;
  state.shufflePos = state.currentIndex >= 0
    ? indices.indexOf(state.currentIndex)
    : -1;
}

// ── Render Tracklist ─────────────────────────────────────
function renderTracklist() {
  dom.tracklistBody.innerHTML = state.tracks.map((track, i) => `
    <div class="track-row${i === state.currentIndex ? " playing" : ""}" data-index="${i}">
      <span class="col-num">
        <span class="row-number">${i + 1}</span>
        <span class="playing-icon">
          <span class="playing-bar"></span>
          <span class="playing-bar"></span>
          <span class="playing-bar"></span>
        </span>
      </span>
      <span class="col-title">${track.title}</span>
      <span class="col-artist">${track.artist}</span>
      <span class="col-album">${track.album}</span>
      <span class="col-duration">${formatTime(track.duration)}</span>
    </div>
  `).join("");

  // Click to play track
  dom.tracklistBody.querySelectorAll(".track-row").forEach((row) => {
    row.addEventListener("click", () => {
      const idx = parseInt(row.dataset.index, 10);
      playTrack(idx);
    });
    row.addEventListener("dblclick", () => {
      const idx = parseInt(row.dataset.index, 10);
      playTrack(idx);
    });
  });
}

// ── Update UI ────────────────────────────────────────────
function updateNowPlaying() {
  const track = state.currentIndex >= 0 ? state.tracks[state.currentIndex] : null;

  if (track) {
    // Hero
    dom.heroArt.style.background = track.color;
    dom.heroArt.classList.add("has-art");
    dom.heroTitle.textContent = track.title;
    dom.heroArtist.textContent = track.artist;
    dom.heroMeta.innerHTML = `
      <span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        ${track.album}
      </span>
      <span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${formatTime(track.duration)}
      </span>
      <span>Track ${state.currentIndex + 1} of ${state.tracks.length}</span>
    `;

    // Player bar
    dom.playerArt.style.background = track.color;
    dom.playerArt.classList.add("has-art");
    dom.playerTitle.textContent = track.title;
    dom.playerArtist.textContent = track.artist;
    dom.timeTotal.textContent = formatTime(track.duration);
  } else {
    dom.heroArt.style.background = "";
    dom.heroArt.classList.remove("has-art");
    dom.heroTitle.textContent = "No Track Selected";
    dom.heroArtist.textContent = "Browse or search to get started";
    dom.heroMeta.innerHTML = "";

    dom.playerArt.style.background = "";
    dom.playerArt.classList.remove("has-art");
    dom.playerTitle.textContent = "\u2014";
    dom.playerArtist.textContent = "\u2014";
    dom.timeTotal.textContent = "0:00";
  }

  // Highlight active track row
  $$(".track-row").forEach((row, i) => {
    row.classList.toggle("playing", i === state.currentIndex);
  });
}

function updatePlayButton() {
  dom.btnPlay.innerHTML = state.playing
    ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
    : '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
}

function updateProgress() {
  const track = state.currentIndex >= 0 ? state.tracks[state.currentIndex] : null;
  const dur = track ? track.duration : 0;
  const pct = dur > 0 ? (state.progress / dur) * 100 : 0;
  dom.progressFill.style.width = pct + "%";
  dom.timeCurrent.textContent = formatTime(state.progress);
}

// ── Playback Actions ─────────────────────────────────────
let progressTimer = null;

function startProgressTimer() {
  stopProgressTimer();
  progressTimer = setInterval(() => {
    const track = state.tracks[state.currentIndex];
    if (!track) return;
    state.progress += 0.25;
    if (state.progress >= track.duration) {
      state.progress = 0;
      handleTrackEnd();
      return;
    }
    updateProgress();
  }, 250);
}

function stopProgressTimer() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function playTrack(index) {
  state.currentIndex = index;
  state.progress = 0;
  state.playing = true;
  if (state.shuffle) {
    state.shufflePos = state.shuffleOrder.indexOf(index);
  }
  updateNowPlaying();
  updatePlayButton();
  updateProgress();
  startProgressTimer();
}

function togglePlay() {
  if (state.currentIndex < 0) {
    playTrack(state.shuffle ? state.shuffleOrder[0] : 0);
    return;
  }
  state.playing = !state.playing;
  updatePlayButton();
  if (state.playing) {
    startProgressTimer();
  } else {
    stopProgressTimer();
  }
}

function getNextIndex() {
  if (state.repeat === 2) return state.currentIndex; // repeat one
  if (state.shuffle) {
    const next = state.shufflePos + 1;
    if (next >= state.shuffleOrder.length) {
      return state.repeat === 1 ? state.shuffleOrder[0] : -1;
    }
    state.shufflePos = next;
    return state.shuffleOrder[next];
  }
  const next = state.currentIndex + 1;
  if (next >= state.tracks.length) {
    return state.repeat === 1 ? 0 : -1;
  }
  return next;
}

function getPrevIndex() {
  if (state.shuffle) {
    const prev = state.shufflePos - 1;
    if (prev < 0) {
      return state.repeat === 1
        ? state.shuffleOrder[state.shuffleOrder.length - 1]
        : state.currentIndex;
    }
    state.shufflePos = prev;
    return state.shuffleOrder[prev];
  }
  const prev = state.currentIndex - 1;
  if (prev < 0) {
    return state.repeat === 1 ? state.tracks.length - 1 : 0;
  }
  return prev;
}

function handleTrackEnd() {
  const next = getNextIndex();
  if (next < 0) {
    state.playing = false;
    state.progress = 0;
    stopProgressTimer();
    updatePlayButton();
    updateProgress();
    return;
  }
  playTrack(next);
}

function playNext() {
  if (state.currentIndex < 0) return;
  // If more than 3 seconds in, restart; else go to previous
  const next = getNextIndex();
  if (next >= 0) playTrack(next);
}

function playPrev() {
  if (state.currentIndex < 0) return;
  if (state.progress > 3) {
    // Restart current track
    state.progress = 0;
    updateProgress();
    return;
  }
  const prev = getPrevIndex();
  if (prev >= 0) playTrack(prev);
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  dom.btnShuffle.classList.toggle("active", state.shuffle);
  if (state.shuffle) generateShuffleOrder();
}

function cycleRepeat() {
  state.repeat = (state.repeat + 1) % 3;
  dom.btnRepeat.classList.toggle("active", state.repeat > 0);
  // Update icon for repeat-one
  if (state.repeat === 2) {
    dom.btnRepeat.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg><span style="position:absolute;top:-2px;right:-8px;font-size:9px;font-weight:700;color:var(--accent)">1</span>';
  } else {
    dom.btnRepeat.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
  }
}

// ── Event Listeners ──────────────────────────────────────

// Playback buttons
dom.btnPlay.addEventListener("click", togglePlay);
dom.btnNext.addEventListener("click", playNext);
dom.btnPrev.addEventListener("click", playPrev);
dom.btnShuffle.addEventListener("click", toggleShuffle);
dom.btnRepeat.addEventListener("click", cycleRepeat);

// Sidebar navigation
$$(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    $(".nav-item.active")?.classList.remove("active");
    btn.classList.add("active");
  });
});

// Progress bar seek
dom.progressBar.addEventListener("click", (e) => {
  if (state.currentIndex < 0) return;
  const rect = dom.progressBar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  state.progress = pct * state.tracks[state.currentIndex].duration;
  updateProgress();
});

// Volume bar
dom.volumeBar.addEventListener("click", (e) => {
  const rect = dom.volumeBar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  state.volume = pct;
  dom.volumeFill.style.width = pct + "%";
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Don't capture when typing in search
  if (e.target.tagName === "INPUT") return;

  switch (e.code) {
    case "Space":
      e.preventDefault();
      togglePlay();
      break;
    case "ArrowRight":
      if (state.currentIndex >= 0) {
        state.progress = Math.min(state.progress + 5, state.tracks[state.currentIndex].duration);
        updateProgress();
      }
      break;
    case "ArrowLeft":
      state.progress = Math.max(state.progress - 5, 0);
      updateProgress();
      break;
    case "ArrowUp":
      state.volume = Math.min(state.volume + 5, 100);
      dom.volumeFill.style.width = state.volume + "%";
      break;
    case "ArrowDown":
      state.volume = Math.max(state.volume - 5, 0);
      dom.volumeFill.style.width = state.volume + "%";
      break;
  }
});

// ── Initialize ───────────────────────────────────────────
renderTracklist();

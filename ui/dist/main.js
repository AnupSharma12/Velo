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
let nextImportId = 100; // IDs for imported tracks start above mock range

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
  playlists: [
    { id: "pl_1", name: "Liked Songs", trackIds: [1, 3, 6] },
    { id: "pl_2", name: "Recently Played", trackIds: [2, 5, 9, 10] },
    { id: "pl_3", name: "Chill Mix", trackIds: [3, 6, 8] },
  ],
  nextPlaylistId: 4,
  activePlaylistId: null,
  editingPlaylistId: null, // for rename modal
  contextPlaylistId: null, // for right-click menu
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
  // Playlist
  playlistList: $("#playlist-list"),
  btnNewPlaylist: $("#btn-new-playlist"),
  playlistModal: $("#playlist-modal"),
  modalTitle: $("#modal-title"),
  modalNameInput: $("#playlist-name-input"),
  modalSave: $("#modal-save"),
  modalCancel: $("#modal-cancel"),
  modalClose: $("#modal-close"),
  contextMenu: $("#playlist-context-menu"),
  // Visualizer
  visualizer: $("#visualizer"),
  // Drop overlay
  dropOverlay: $("#drop-overlay"),
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
renderPlaylists();
initVisualizer();
initDragDrop();
initAuth();

// ── Playlist Management ──────────────────────────────────

function renderPlaylists() {
  dom.playlistList.innerHTML = state.playlists.map((pl) => `
    <li class="playlist-item${pl.id === state.activePlaylistId ? ' active' : ''}"
        data-id="${pl.id}" draggable="true">
      ${escapeHtml(pl.name)}
    </li>
  `).join("");
  bindPlaylistEvents();
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function bindPlaylistEvents() {
  let dragSrcId = null;

  dom.playlistList.querySelectorAll(".playlist-item").forEach((li) => {
    // Click to select
    li.addEventListener("click", () => {
      state.activePlaylistId = li.dataset.id;
      renderPlaylists();
    });

    // Right-click context menu
    li.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      state.contextPlaylistId = li.dataset.id;
      dom.contextMenu.style.left = e.clientX + "px";
      dom.contextMenu.style.top = e.clientY + "px";
      dom.contextMenu.classList.add("open");
    });

    // Drag & drop reorder
    li.addEventListener("dragstart", (e) => {
      dragSrcId = li.dataset.id;
      li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
      dom.playlistList.querySelectorAll(".playlist-item").forEach((el) => el.classList.remove("drag-over"));
    });

    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      li.classList.add("drag-over");
    });

    li.addEventListener("dragleave", () => {
      li.classList.remove("drag-over");
    });

    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("drag-over");
      if (!dragSrcId || dragSrcId === li.dataset.id) return;
      const fromIdx = state.playlists.findIndex((p) => p.id === dragSrcId);
      const toIdx = state.playlists.findIndex((p) => p.id === li.dataset.id);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = state.playlists.splice(fromIdx, 1);
      state.playlists.splice(toIdx, 0, moved);
      renderPlaylists();
    });
  });
}

// Modal helpers
function openModal(title, saveBtnText, prefill) {
  dom.modalTitle.textContent = title;
  dom.modalSave.textContent = saveBtnText;
  dom.modalNameInput.value = prefill || "";
  dom.playlistModal.classList.add("open");
  setTimeout(() => dom.modalNameInput.focus(), 100);
}

function closeModal() {
  dom.playlistModal.classList.remove("open");
  state.editingPlaylistId = null;
}

// New playlist button
dom.btnNewPlaylist.addEventListener("click", () => {
  state.editingPlaylistId = null;
  openModal("New Playlist", "Create", "");
});

// Modal save
dom.modalSave.addEventListener("click", () => {
  const name = dom.modalNameInput.value.trim();
  if (!name) return;

  if (state.editingPlaylistId) {
    // Rename
    const pl = state.playlists.find((p) => p.id === state.editingPlaylistId);
    if (pl) pl.name = name;
  } else {
    // Create
    state.playlists.push({
      id: "pl_" + state.nextPlaylistId++,
      name,
      trackIds: [],
    });
  }
  closeModal();
  renderPlaylists();
});

// Modal cancel / close
dom.modalCancel.addEventListener("click", closeModal);
dom.modalClose.addEventListener("click", closeModal);
dom.playlistModal.addEventListener("click", (e) => {
  if (e.target === dom.playlistModal) closeModal();
});

// Submit on Enter
dom.modalNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") dom.modalSave.click();
  if (e.key === "Escape") closeModal();
});

// Context menu actions
dom.contextMenu.querySelectorAll(".context-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    const pl = state.playlists.find((p) => p.id === state.contextPlaylistId);
    dom.contextMenu.classList.remove("open");

    if (action === "rename" && pl) {
      state.editingPlaylistId = pl.id;
      openModal("Rename Playlist", "Save", pl.name);
    } else if (action === "delete" && pl) {
      state.playlists = state.playlists.filter((p) => p.id !== pl.id);
      if (state.activePlaylistId === pl.id) state.activePlaylistId = null;
      renderPlaylists();
    }
  });
});

// Close context menu on outside click
document.addEventListener("click", () => {
  dom.contextMenu.classList.remove("open");
});

// ── Waveform / Spectrum Visualization ─────────────────────

let vizCtx = null;
let vizAnimId = null;
let vizBars = [];

function initVisualizer() {
  const canvas = dom.visualizer;
  vizCtx = canvas.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Generate initial random bar heights
  const barCount = 64;
  vizBars = Array.from({ length: barCount }, () => ({
    height: Math.random() * 0.3,
    target: Math.random() * 0.3,
    velocity: 0,
  }));

  drawVisualizerFrame();
}

function resizeCanvas() {
  const canvas = dom.visualizer;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
}

function drawVisualizerFrame() {
  const canvas = dom.visualizer;
  const ctx = vizCtx;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const barCount = vizBars.length;
  const gap = 2 * devicePixelRatio;
  const barW = (w - gap * (barCount - 1)) / barCount;
  const isPlaying = state.playing && state.currentIndex >= 0;

  // Animate bars
  for (let i = 0; i < barCount; i++) {
    const bar = vizBars[i];
    if (isPlaying) {
      // Randomize targets for active feel
      if (Math.random() < 0.08) {
        bar.target = 0.15 + Math.random() * 0.85;
      }
    } else {
      bar.target = 0.05 + Math.random() * 0.12;
    }
    // Spring physics
    const spring = 0.08;
    const damping = 0.7;
    bar.velocity += (bar.target - bar.height) * spring;
    bar.velocity *= damping;
    bar.height += bar.velocity;
    bar.height = Math.max(0.02, Math.min(1, bar.height));

    const barH = bar.height * h;
    const x = i * (barW + gap);
    const y = h - barH;

    // Color: accent gradient
    const grad = ctx.createLinearGradient(x, y, x, h);
    if (isPlaying) {
      grad.addColorStop(0, "rgba(0, 201, 107, 0.9)");
      grad.addColorStop(1, "rgba(0, 201, 107, 0.3)");
    } else {
      grad.addColorStop(0, "rgba(106, 106, 106, 0.5)");
      grad.addColorStop(1, "rgba(106, 106, 106, 0.15)");
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    const radius = Math.min(barW / 2, 3 * devicePixelRatio);
    ctx.roundRect(x, y, barW, barH, [radius, radius, 0, 0]);
    ctx.fill();
  }

  canvas.classList.toggle("active", isPlaying);
  vizAnimId = requestAnimationFrame(drawVisualizerFrame);
}

// ── Drag & Drop File Import ───────────────────────────────

const AUDIO_EXTENSIONS = new Set([
  "mp3", "flac", "wav", "ogg", "aac", "m4a", "wma", "opus", "webm",
]);

function isAudioFile(name) {
  const ext = name.split(".").pop().toLowerCase();
  return AUDIO_EXTENSIONS.has(ext);
}

function trackFromFile(file) {
  const name = file.name;
  const base = name.replace(/\.[^.]+$/, "");
  // Try "Artist - Title" pattern
  let title = base;
  let artist = "Unknown Artist";
  const dashIdx = base.indexOf(" - ");
  if (dashIdx > 0) {
    artist = base.substring(0, dashIdx).trim();
    title = base.substring(dashIdx + 3).trim();
  }
  return {
    id: nextImportId++,
    title,
    artist,
    album: "Local Import",
    duration: 0, // unknown until decoded
    color: `hsl(${Math.floor(Math.random() * 360)}, 50%, 25%)`,
    file, // keep reference for future audio decode
  };
}

// Recursively read entries from a dropped folder
function readEntriesRecursive(entry) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((f) => {
        if (isAudioFile(f.name)) resolve([f]);
        else resolve([]);
      }, () => resolve([]));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const allFiles = [];
      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve(allFiles);
            return;
          }
          for (const e of entries) {
            const files = await readEntriesRecursive(e);
            allFiles.push(...files);
          }
          readBatch(); // directories may return entries in batches
        }, () => resolve(allFiles));
      };
      readBatch();
    } else {
      resolve([]);
    }
  });
}

async function handleDrop(e) {
  e.preventDefault();
  dom.dropOverlay.classList.remove("visible");

  const items = e.dataTransfer.items;
  if (!items || items.length === 0) return;

  const audioFiles = [];

  // Use webkitGetAsEntry for folder support
  const entries = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (entries.length > 0) {
    for (const entry of entries) {
      const files = await readEntriesRecursive(entry);
      audioFiles.push(...files);
    }
  } else {
    // Fallback: plain file list
    for (const file of e.dataTransfer.files) {
      if (isAudioFile(file.name)) audioFiles.push(file);
    }
  }

  if (audioFiles.length === 0) return;

  // Convert to track objects and add to state
  const newTracks = audioFiles.map(trackFromFile);
  state.tracks.push(...newTracks);

  // Update shuffle order if active
  if (state.shuffle) generateShuffleOrder();

  renderTracklist();
}

let dragCounter = 0;

function initDragDrop() {
  // Show overlay when files dragged over the window
  document.addEventListener("dragenter", (e) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounter++;
    dom.dropOverlay.classList.add("visible");
  });

  document.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dom.dropOverlay.classList.remove("visible");
    }
  });

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  document.addEventListener("drop", (e) => {
    dragCounter = 0;
    handleDrop(e);
  });
}

// ── Auth ──────────────────────────────────────────────────

const authState = {
  mode: "login",
  user: null,
  session: null,
  loading: false,
};

async function tauriInvoke(cmd, args) {
  if (window.__TAURI__) {
    return window.__TAURI__.core.invoke(cmd, args);
  }
  throw new Error("Tauri not available");
}

const authDom = {
  screen: $("#auth-screen"),
  form: $("#auth-form"),
  email: $("#auth-email"),
  password: $("#auth-password"),
  error: $("#auth-error"),
  submit: $("#auth-submit"),
  skip: $("#auth-skip"),
  tabs: $$("#auth-screen .auth-tab"),
  topbarUser: $("#topbar-user"),
  userEmail: $("#user-email"),
  btnLogout: $("#btn-logout"),
};

function showAuthScreen() {
  authDom.screen.classList.remove("hidden");
}

function hideAuthScreen() {
  authDom.screen.classList.add("hidden");
}

function setAuthMode(mode) {
  authState.mode = mode;
  authDom.tabs.forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === mode);
  });
  authDom.submit.textContent = mode === "login" ? "Log In" : "Sign Up";
  authDom.error.textContent = "";
}

function updateUserUI() {
  if (authState.user) {
    authDom.topbarUser.style.display = "flex";
    authDom.userEmail.textContent = authState.user.email || "User";
  } else {
    authDom.topbarUser.style.display = "none";
    authDom.userEmail.textContent = "";
  }
}

// Tab switching (event delegation on parent)
const authTabsContainer = $("#auth-screen .auth-tabs");
if (authTabsContainer) {
  authTabsContainer.addEventListener("click", (e) => {
    const tab = e.target.closest(".auth-tab");
    if (tab && tab.dataset.tab) {
      setAuthMode(tab.dataset.tab);
    }
  });
}

// Form submit
authDom.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (authState.loading) return;

  const email = authDom.email.value.trim();
  const password = authDom.password.value;
  if (!email || !password) return;

  authState.loading = true;
  authDom.submit.disabled = true;
  authDom.error.textContent = "";

  try {
    const cmd = authState.mode === "login" ? "auth_sign_in" : "auth_sign_up";
    const session = await tauriInvoke(cmd, { email, password });
    authState.session = session;
    authState.user = session.user;
    hideAuthScreen();
    updateUserUI();
  } catch (err) {
    let msg = String(err);
    try {
      const parsed = JSON.parse(msg.replace(/^[^{]*/, ""));
      msg = parsed.msg || parsed.error_description || parsed.message || msg;
    } catch {}
    authDom.error.textContent = msg;
  } finally {
    authState.loading = false;
    authDom.submit.disabled = false;
  }
});

// Skip (offline mode)
authDom.skip.addEventListener("click", () => {
  hideAuthScreen();
  updateUserUI();
});

// Logout
authDom.btnLogout.addEventListener("click", async () => {
  try {
    await tauriInvoke("auth_sign_out", {});
  } catch {}
  authState.user = null;
  authState.session = null;
  updateUserUI();
  showAuthScreen();
});

// Check existing session on load
async function initAuth() {
  try {
    const session = await tauriInvoke("auth_get_session", {});
    if (session) {
      authState.session = session;
      authState.user = session.user;
      hideAuthScreen();
      updateUserUI();
      return;
    }
  } catch {}
  // No session — auth screen stays visible
}

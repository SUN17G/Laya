// ==========================================
// 1. GLOBAL VARIABLES & STATE
// ==========================================
let currentIndex = -1;
let isPlaying = false;
let downloadedIds = [];
let isShuffle = false;
let isRepeat = false;
let currentSongId = null;
let currentPlaylistId = null;
let selectedSongId = null;
let allSongs = [];
let songs = [];
let current = 0;
let queue = [];
let recentSearches = JSON.parse(localStorage.getItem("recent")) || [];
const token = localStorage.getItem("token");

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const audio = document.getElementById("audio");
const volumeSlider = document.getElementById("volume");
const muteBtn = document.getElementById("muteBtn");
const searchInput = document.getElementById("searchInput");
const suggestionsBox = document.getElementById("suggestions");

// Canvas for wave animation
const canvas = document.getElementById("wave");
let ctx = null;
if (canvas) {
  ctx = canvas.getContext("2d");
}

// ==========================================
// 3. UTILITY FUNCTIONS
// ==========================================
function authFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: localStorage.getItem("token"),
      ...(options.headers || {})
    }
  });
}

function formatTime(sec) {
  if (!sec) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return m + ":" + s;
}

function highlight(text, value) {
  const regex = new RegExp(value, "gi");
  return text.replace(regex, match => `<span class="highlight">${match}</span>`);
}

// ==========================================
// 4. INITIALIZATION
// ==========================================
// Default volume setup
if (audio && volumeSlider) {
  audio.volume = volumeSlider.value;
}

if (token) {
  loadSongs();
  loadPlaylists();
}

// ==========================================
// 5. CORE PLAYER CONTROLS
// ==========================================
function playSong(index) {
  // Removed "let" to correctly update global state variables
  currentIndex = index;
  isPlaying = true;
  
  const song = songs[index];
  audio.src = song.audioUrl;
  audio.play();

  document.querySelector(".player").classList.add("playing");
  document.getElementById("title").innerText = song.title;
  document.getElementById("artist").innerText = song.artist;
  document.getElementById("cover").src = song.imageUrl;
  document.getElementById("playBtn").innerText = "⏸";

  current = index;
  currentSongId = song.id;

  highlightQueue();

  audio.onloadedmetadata = () => {
    document.getElementById("duration").innerText = formatTime(audio.duration);
  };

  const cover = document.getElementById("cover");
  cover.classList.remove("fade");
  void cover.offsetWidth; // trigger reflow
  cover.classList.add("fade");
  
  updatePlayIcons();
}

function toggle() {
  if (audio.paused) {
    audio.play();
    document.getElementById("playBtn").innerText = "⏸";
    isPlaying = true;
  } else {
    audio.pause();
    document.getElementById("playBtn").innerText = "▶";
    isPlaying = false;
  }
  updatePlayIcons();
}

function next() {
  if (queue.length > 0) {
    const nextSong = queue.shift();
    audio.src = nextSong.audioUrl;
    audio.play();

    document.getElementById("title").innerText = nextSong.title;
    document.getElementById("artist").innerText = nextSong.artist;
    document.getElementById("cover").src = nextSong.imageUrl;

    currentSongId = nextSong.id;
    renderQueue();
    return;
  }

  current++;
  if (current >= songs.length) current = 0;
  playSong(current);
}

function prev() {
  current--;
  if (current < 0) current = songs.length - 1;
  playSong(current);
}

function toggleMute() {
  if (audio.muted) {
    audio.muted = false;
    muteBtn.innerText = "🔊";
    volumeSlider.value = audio.volume || 1;
  } else {
    audio.muted = true;
    muteBtn.innerText = "🔇";
    volumeSlider.value = 0;
  }
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  const btn = document.getElementById("shuffleBtn");
  btn.classList.toggle("active-btn");
}

function toggleRepeat() {
  isRepeat = !isRepeat;
  const btn = document.getElementById("repeatBtn");
  btn.classList.toggle("active-btn");
}

function updatePlayIcons() {
  document.querySelectorAll(".play-btn").forEach((btn, i) => {
    if (i === currentIndex && isPlaying) {
      btn.innerHTML = "⏸";
    } else {
      btn.innerHTML = "▶";
    }
  });
}

// ==========================================
// 6. QUEUE MANAGEMENT
// ==========================================
function addToQueue(songId) {
  const song = allSongs.find(s => s.id === songId);
  if (!song) return;
  queue.push(song);
  renderQueue();
}

function toggleQueue() {
  const panel = document.getElementById("queuePanel");
  panel.classList.toggle("open");
  renderQueue();
}

function clearQueue() {
  queue = [];
  renderQueue();
}

function renderQueue() {
  const list = document.getElementById("queueList");
  if(!list) return;
  list.innerHTML = "";

  queue.forEach((song, index) => {
    const div = document.createElement("div");
    div.className = "queue-item";
    if (song.id === currentSongId) div.classList.add("playing");

    div.innerHTML = `
      <img src="${song.imageUrl}">
      <div style="flex:1">
        <div>${song.title}</div>
        <div style="font-size:12px;color:gray">${song.artist}</div>
      </div>
      <span onclick="event.stopPropagation(); removeFromQueue(${index})">❌</span>
    `;

    div.onclick = () => {
      songs = [song];
      playSong(0);
    };
    list.appendChild(div);
  });
}

function removeFromQueue(index) {
  queue.splice(index, 1);
  renderQueue();
}

function playNext() {
  const song = allSongs.find(s => s.id === selectedSongId);
  if (!song) return;
  queue.unshift(song);
  renderQueue();
}

async function saveQueueToPlaylist() {
  const name = prompt("Playlist name?");
  if (!name) return;

  const res = await authFetch("http://localhost:5000/playlist", {
    method: "POST",
    body: JSON.stringify({ name })
  });
  const pl = await res.json();
  
  for (const song of queue) {
    await authFetch("http://localhost:5000/playlist/add", {
      method: "POST",
      body: JSON.stringify({
        playlistId: pl.id,
        songId: song.id
      })
    });
  }
  alert("Queue saved to playlist");
}

function highlightQueue() {
    // Requires implementation based on your HTML structure
    renderQueue();
}

// ==========================================
// 7. FETCHING & RENDERING CONTENT
// ==========================================
async function loadSongs() {
  const container = document.getElementById("songs");
  container.innerHTML = "";
  
  // 1. show skeleton FIRST
  for (let i = 0; i < 8; i++) {
    const div = document.createElement("div");
    div.className = "skeleton skeleton-card";
    container.appendChild(div);
  }

  // 2. fetch songs
  const res = await authFetch("http://localhost:5000/songs");
  allSongs = await res.json();
  songs = allSongs;

  // 3. show real songs
  renderSongs(allSongs);
  // Fixed reference error ('data' -> 'allSongs')
  renderHorizontal(allSongs); 
}

function renderSongs(songList) {
  const container = document.getElementById("songs");
  if(!container) return;
  container.innerHTML = "";

  songList.forEach((song, index) => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-img">
        <img src="${song.imageUrl}">
        <div class="play-btn">▶</div>
      </div>
      <div class="card-title">${song.title}</div>
      <div class="card-artist">${song.artist}</div>
      <div class="card-actions">
        <button onclick="event.stopPropagation(); likeSong('${song.id}')">❤️</button>
        <button onclick="event.stopPropagation(); addToQueue('${song.id}')">＋</button>
        ${
          downloadedIds.includes(song.id)
            ? `<button class="downloaded">✔</button>`
            : `<button onclick="event.stopPropagation(); downloadSong('${song.id}')">⬇</button>`
        }
      </div>
    `;

    card.onclick = () => {
      songs = songList;
      playSong(index);
    };

    container.appendChild(card);
  });
}

function renderHorizontal(songList) {
  const container = document.getElementById("horizontalSongs");
  if(!container) return;
  container.innerHTML = "";

  songList.forEach((song, index) => {
    const card = document.createElement("div");
    card.className = "song-card";

    card.innerHTML = `
      <div class="card-img">
        <img src="${song.imageUrl}">
        <div class="play-btn">▶</div>
      </div>
      <div class="card-title">${song.title}</div>
      <div class="card-artist">${song.artist}</div>
    `;

    card.onclick = () => {
      songs = songList;
      playSong(index);
    };

    container.appendChild(card);
  });
}

// ==========================================
// 8. PLAYLIST MANAGEMENT
// ==========================================
async function createPlaylist() {
  const name = document.getElementById("playlistName").value;
  await authFetch("http://localhost:5000/playlist", {
    method: "POST",
    body: JSON.stringify({ name })
  });
  loadPlaylists();
}

async function loadPlaylists() {
  const res = await authFetch("http://localhost:5000/playlist");
  const data = await res.json();
  const container = document.getElementById("playlists");
  if(!container) return;
  container.innerHTML = "";

  data.forEach(pl => {
    const div = document.createElement("div");
    div.innerHTML = `
      <span style="cursor:pointer" onclick="openPlaylist({id: '${pl.id}', name: '${pl.name}'})">${pl.name}</span>
      <button onclick="deletePlaylist('${pl.id}')">🗑</button>
    `;
    container.appendChild(div);
  });
}

async function deletePlaylist(id) {
  await authFetch(`http://localhost:5000/playlist/${id}`, {
    method: "DELETE"
  });
  loadPlaylists();
}

function openPlaylist(pl) {
  currentPlaylistId = pl.id;
  document.getElementById("playlistView").classList.add("album-page");
  document.getElementById("homeView").style.display = "none";
  document.getElementById("playlistView").style.display = "block";
  document.getElementById("playlistTitle").innerText = pl.name;

  if (pl.songs && pl.songs[0]) {
    document.getElementById("playlistCover").src = pl.songs[0].song.imageUrl;
  }

  const list = document.getElementById("playlistSongs");
  list.innerHTML = "";
  if(pl.songs) songs = pl.songs.map(s => s.song);

  songs.forEach((song, index) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="col-num">${index + 1}</div>
      <div class="col-title">
        <img src="${song.imageUrl}">
        <div>
          <div class="song-title">${song.title}</div>
          <div class="song-artist">${song.artist}</div>
        </div>
      </div>
      <div class="col-album">Album</div>
      <div class="col-time">3:20</div>
      <div class="col-menu" onclick="openMenu(event,'${song.id}')">⋯</div>
    `;
    row.onclick = () => playSong(index);
    list.appendChild(row);
  });
}

async function addToPlaylist(songId) {
  const res = await authFetch("http://localhost:5000/playlist");
  const playlists = await res.json();

  let names = playlists.map(p => p.name).join("\n");
  const chosen = prompt("Add to which playlist?\n" + names);
  const playlist = playlists.find(p => p.name === chosen);

  if (!playlist) return alert("Playlist not found");

  await authFetch("http://localhost:5000/playlist/add", {
    method: "POST",
    body: JSON.stringify({
      playlistId: playlist.id,
      songId: songId
    })
  });
  alert("Added to playlist!");
}

async function removeSong() {
  if (!currentPlaylistId || !selectedSongId) return;

  await authFetch("http://localhost:5000/playlist/remove", {
    method: "POST",
    body: JSON.stringify({
      playlistId: currentPlaylistId,
      songId: selectedSongId
    })
  });

  document.getElementById("menu").style.display = "none";
  loadPlaylists();
  goHome();
}

function addSongToPlaylist() {
  addToPlaylist(selectedSongId);
  document.getElementById("menu").style.display = "none";
}

// ==========================================
// 9. LIKES & DOWNLOADS
// ==========================================
async function likeSong(songId) {
  await authFetch("http://localhost:5000/like", {
    method: "POST",
    body: JSON.stringify({ songId })
  });
  alert("Added to Liked Songs ❤️");
}

async function openLiked() {
  document.getElementById("homeView").style.display = "none";
  document.getElementById("playlistView").style.display = "block";
  document.getElementById("playlistTitle").innerText = "Liked Songs";

  const res = await authFetch("http://localhost:5000/liked");
  const data = await res.json();
  songs = data.map(s => s.song);

  const list = document.getElementById("playlistSongs");
  list.innerHTML = "";

  songs.forEach((song, index) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div>${index + 1}</div>
      <div class="col-title">
        <img src="${song.imageUrl}">
        <div>
          <div class="song-title">${song.title}</div>
          <div class="song-artist">${song.artist}</div>
        </div>
      </div>
      <div class="col-album">Liked</div>
      <div class="col-time">--:--</div>
      <div class="col-menu">❤️</div>
    `;
    row.onclick = () => playSong(index);
    list.appendChild(row);
  });
}

async function downloadSong(songId) {
  await authFetch("http://localhost:5000/download", {
    method: "POST",
    body: JSON.stringify({ songId })
  });
  downloadedIds.push(songId);
  renderSongs(allSongs);
  loadDownloadsPanel();
}

async function loadDownloadedIds() {
  const res = await authFetch("http://localhost:5000/downloads");
  const data = await res.json();
  downloadedIds = data.map(d => d.songId);
}

function openDownloads() {
  openFeature("Downloads", "<div id='downloadsList'>Loading...</div>");
  loadDownloadsPanel();
}

async function openDownload() {
  const res = await authFetch("http://localhost:5000/downloads");
  const data = await res.json();
  let html = "";
  data.forEach(d => {
    html += `
      <div class="row" onclick="playDownloaded('${d.song.audioUrl}')">
        <img src="${d.song.imageUrl}" width="50">
        ${d.song.title}
      </div>
    `;
  });
  openFeature("Downloads", html || "<p>No downloads yet</p>");
}

async function loadDownloadsPanel() {
  const list = document.getElementById("downloadsList");
  if(!list) return;
  list.innerHTML = "Loading...";

  const res = await authFetch("http://localhost:5000/downloads");
  const data = await res.json();
  list.innerHTML = "";

  if (data.length === 0) {
    list.innerHTML = "No downloads yet";
    return;
  }

  data.forEach((d, index) => {
    const song = d.song;
    const div = document.createElement("div");
    div.className = "queue-item";
    div.innerHTML = `
      <div class="card-img">
        <img src="${song.imageUrl}">
        <div class="play-btn">▶</div>
      </div>
      <div class="card-title">${song.title}</div>
      <div class="card-artist">${song.artist}</div>
    `;
    div.onclick = () => {
      songs = data.map(x => x.song);
      playSong(index);
    };
    list.appendChild(div);
  });
}

function playDownloaded(url) {
  audio.src = url;
  audio.play();
}

// ==========================================
// 10. SEARCH FUNCTIONALITY
// ==========================================
if(searchInput){
  searchInput.addEventListener("input", async () => {
    const value = searchInput.value.toLowerCase();
    if (!value) {
      showRecent();
      renderSongs(allSongs);
      return;
    }

    const songResults = allSongs.filter(s => s.title.toLowerCase().includes(value));
    const artistResults = allSongs.filter(s => s.artist.toLowerCase().includes(value));

    const res = await authFetch("http://localhost:5000/playlist");
    const playlists = await res.json();
    const playlistResults = playlists.filter(p => p.name.toLowerCase().includes(value));

    showSuggestions(value, songResults, artistResults, playlistResults);
  });
}

function showSuggestions(value, songsRes, artistRes, playlistRes) {
  suggestionsBox.innerHTML = "";

  songsRes.slice(0, 3).forEach(song => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.innerHTML = highlight(song.title + " - " + song.artist, value);
    div.onclick = () => {
      searchInput.value = song.title;
      saveRecent(song.title);
      suggestionsBox.innerHTML = "";
      const filtered = allSongs.filter(s => s.title === song.title);
      songs = filtered;
      renderSongs(filtered);
    };
    suggestionsBox.appendChild(div);
  });

  playlistRes.slice(0, 3).forEach(pl => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.innerHTML = "📁 " + highlight(pl.name, value);
    div.onclick = () => {
      searchInput.value = pl.name;
      saveRecent(pl.name);
      suggestionsBox.innerHTML = "";
      openPlaylist(pl);
    };
    suggestionsBox.appendChild(div);
  });
}

function saveRecent(term) {
  recentSearches.unshift(term);
  recentSearches = [...new Set(recentSearches)].slice(0, 5);
  localStorage.setItem("recent", JSON.stringify(recentSearches));
}

function showRecent() {
  suggestionsBox.innerHTML = "";
  recentSearches.forEach(r => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.innerText = "🕒 " + r;
    div.onclick = () => {
      searchInput.value = r;
      searchInput.dispatchEvent(new Event("input"));
    };
    suggestionsBox.appendChild(div);
  });
}

// ==========================================
// 11. UI MENUS & FEATURES
// ==========================================
function goHome() {
  document.getElementById("homeView").style.display = "block";
  document.getElementById("playlistView").style.display = "none";
}

function openMenu(e, id) {
  e.stopPropagation();
  selectedSongId = id;
  const menu = document.getElementById("menu");
  menu.style.display = "block";
  menu.style.left = e.pageX + "px";
  menu.style.top = e.pageY + "px";
}

function toggleFullPlayer() {
  const fp = document.getElementById("fullPlayer");
  fp.classList.toggle("show");
  if (fp.classList.contains("show")) {
    syncFullPlayer();
  }
}

function syncFullPlayer() {
  const cover = document.getElementById("cover").src;
  const title = document.getElementById("title").innerText;
  const artist = document.getElementById("artist").innerText;

  document.getElementById("fullCover").src = cover;
  document.getElementById("fullTitle").innerText = title;
  document.getElementById("fullArtist").innerText = artist;
  document.getElementById("fullBg").style.backgroundImage = `url(${cover})`;

  document.getElementById("fullRange").value = audio.currentTime;
  document.getElementById("fullRange").max = audio.duration;
}

function openFeature(title, html) {
  const panel = document.getElementById("featurePanel");
  document.getElementById("featureTitle").innerText = title;
  document.getElementById("featureContent").innerHTML = html;
  panel.classList.add("open");
}

function closeFeature() {
  document.getElementById("featurePanel").classList.remove("open");
}

function toggleProfileMenu() {
  const menu = document.getElementById("profileMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function openProfile() {
  openFeature("Your Profile", `
    <div style="text-align:center">
      <img id="profilePic" src="https://i.pravatar.cc/150" style="width:100px;border-radius:50%;margin-bottom:15px">
      <input id="profileName" placeholder="Your name" style="width:100%;padding:10px;margin-bottom:10px">
      <input type="file" id="profileImage" style="margin-bottom:10px">
      <button onclick="saveProfile()" style="padding:12px 20px;background:#1db954;border:none;border-radius:20px">Save</button>
    </div>
  `);
  loadProfile();
}

async function loadProfile() {
  const res = await authFetch("http://localhost:5000/me");
  const user = await res.json();
  document.getElementById("profileName").value = user.name || "";
  document.getElementById("profilePic").src = user.imageUrl || "https://i.imgur.com/6VBx3io.png";
}

async function saveProfile() {
  const name = document.getElementById("profileName").value;
  const file = document.getElementById("profileImage").files[0];
  const form = new FormData();
  form.append("name", name);
  if (file) form.append("image", file);

  await fetch("http://localhost:5000/me", {
    method: "POST",
    headers: { Authorization: localStorage.getItem("token") },
    body: form
  });
  alert("Profile saved!");
}

function openAccount() {
  openFeature("Account", `
    <h3>Email</h3>
    <p>User logged with Google</p>
    <button>Manage plan</button>
  `);
}

function openSettings() {
  openFeature("Settings", `
    <label><input type="checkbox"> Dark mode</label><br><br>
    <label><input type="checkbox"> Notifications</label>
  `);
}

function logout() {
  localStorage.removeItem("token");
  location.reload();
}

// Canvas Waveform Animation
function drawWave() {
  if (!ctx) return;
  ctx.clearRect(0, 0, 300, 40);
  for (let i = 0; i < 40; i++) {
    const h = Math.random() * 40;
    ctx.fillRect(i * 8, 40 - h, 4, h);
  }
  requestAnimationFrame(drawWave);
}

// ==========================================
// 12. EVENT LISTENERS
// ==========================================
if(volumeSlider){
  volumeSlider.addEventListener("input", (e) => {
    audio.volume = e.target.value;
    muteBtn.innerText = audio.volume == 0 ? "🔇" : "🔊";
  });
}

const progressEl = document.getElementById("progress");
if(progressEl){
  progressEl.addEventListener("input", (e) => {
    if (!audio.duration) return;
    audio.currentTime = (e.target.value / 100) * audio.duration;
  });
}

const fsProgressEl = document.getElementById("fsProgress");
if(fsProgressEl){
  fsProgressEl.addEventListener("input", (e) => {
    audio.currentTime = (e.target.value / 100) * audio.duration;
  });
}

const fsVolumeEl = document.getElementById("fsVolume");
if(fsVolumeEl){
  fsVolumeEl.addEventListener("input", (e) => {
    audio.volume = e.target.value;
  });
}

// Merged Time Update Listener
audio.addEventListener("timeupdate", () => {
  const progressVal = (audio.currentTime / audio.duration) * 100;
  
  if(progressEl) progressEl.value = progressVal;
  const currTimeEl = document.getElementById("currentTime");
  if(currTimeEl) currTimeEl.innerText = formatTime(audio.currentTime);
  const durEl = document.getElementById("duration");
  if(durEl && audio.duration) durEl.innerText = formatTime(audio.duration);

  // Full Screen Player Sync
  if(fsProgressEl) fsProgressEl.value = progressVal;
  const fsCurrEl = document.getElementById("fsCurrent");
  if(fsCurrEl) fsCurrEl.innerText = formatTime(audio.currentTime);
  const fsDurEl = document.getElementById("fsDuration");
  if(fsDurEl && audio.duration) fsDurEl.innerText = formatTime(audio.duration);
});

// Merged OnEnded Listener
audio.onended = () => {
  isPlaying = false;
  updatePlayIcons();

  if (isRepeat) {
    playSong(current);
    return;
  }
  if (isShuffle) {
    const rand = Math.floor(Math.random() * songs.length);
    playSong(rand);
    return;
  }
  if (queue.length > 0) {
    const nextSong = queue.shift();
    songs = [nextSong];
    playSong(0);
    renderQueue();
    return;
  }
  next();
};

audio.onplay = () => drawWave();
audio.onpause = () => { if(ctx) ctx.clearRect(0, 0, 300, 40); };

// Global Click Handlers
document.addEventListener("click", (e) => {
  if (suggestionsBox && !e.target.classList.contains("search")) {
    suggestionsBox.innerHTML = "";
  }
  const menu = document.getElementById("menu");
  if (menu) menu.style.display = "none";
  
  if (!e.target.closest(".profile")) {
    const profileMenu = document.getElementById("profileMenu");
    if (profileMenu) profileMenu.style.display = "none";
  }
});

/* ORPHANED CODE REMOVED (Was throwing ReferenceErrors at the global level):
div.querySelector(".play-btn").onclick = (e)=>{ ... }
div.onclick = ()=>{ ... }
*/
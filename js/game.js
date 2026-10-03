import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, getDoc, getDocs, updateDoc,
  query, where, serverTimestamp, arrayUnion, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { STATIONS, SALT, TOTAL_CODES, STORY_LINES } from "./codes.js";
import { Scene } from "./scene.js";
import * as sfx from "./audio.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const LS_KEY = "tefiti_team_id";
const $ = (s) => document.querySelector(s);

const state = { user: null, teamId: null, team: null, solved: [], busy: false, timer: null, saved: null };
let scene;

// ---------------- helpers ----------------
function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
}

function toast(msg, type = "info") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show " + type;
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = ""), 2800);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const teamRef = () => doc(db, "teams", state.teamId);
const saveErr = (e) => { console.error(e); toast("Progress not saved — check your connection.", "error"); };

// ---------------- auth ----------------
const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (u) => { if (u) { state.user = u; resolve(u); } });
});
signInAnonymously(auth).catch((err) => {
  console.error(err);
  const s = $("#conn-status");
  s.textContent = "Could not connect (" + (err.code || err.message) + "). Check the Firebase setup.";
  s.classList.add("bad");
});

// ---------------- startup ----------------
async function init() {
  scene = new Scene($("#scene-wrap"), TOTAL_CODES);
  buildPips();
  bindUI();

  await authReady;
  const s = $("#conn-status");
  s.textContent = "Connected — the ocean is ready.";
  s.classList.add("ok");
  $("#btn-begin").disabled = false;

  const savedId = localStorage.getItem(LS_KEY);
  if (savedId) {
    try {
      const snap = await getDoc(doc(db, "teams", savedId));
      if (snap.exists() && snap.data().uid === state.user.uid) {
        state.saved = { id: savedId, data: snap.data() };
        const b = $("#btn-continue");
        b.textContent = `Continue as “${snap.data().name}”`;
        b.hidden = false;
      } else {
        localStorage.removeItem(LS_KEY);
      }
    } catch (e) { console.warn(e); }
  }
}

function bindUI() {
  $("#btn-begin").addEventListener("click", () => {
    sfx.init(); sfx.click();
    show("screen-register");
    setTimeout(() => $("#team-name").focus(), 50);
  });
  $("#btn-continue").addEventListener("click", () => {
    sfx.init(); sfx.click();
    if (state.saved) startGame(state.saved.id, state.saved.data);
  });
  $("#btn-back").addEventListener("click", () => show("screen-welcome"));
  $("#form-register").addEventListener("submit", register);
  $("#btn-mute").addEventListener("click", () => {
    const m = sfx.toggleMute();
    $("#btn-mute").textContent = m ? "🔇" : "🔊";
  });
  $("#btn-close-win").addEventListener("click", () => ($("#modal-win").hidden = true));
}

// ---------------- registration ----------------
function formError(msg) {
  const e = $("#form-error");
  e.textContent = msg;
  e.hidden = !msg;
}

async function register(ev) {
  ev.preventDefault();
  sfx.init();
  formError("");
  const name = $("#team-name").value.trim().replace(/\s+/g, " ");
  const members = $("#team-members").value.trim().slice(0, 200);
  if (name.length < 2) return formError("Please enter a team name (at least 2 characters).");

  const btn = $("#btn-register");
  btn.disabled = true;
  btn.textContent = "Launching the canoe…";
  try {
    const nameKey = name.toLowerCase();
    const dup = await getDocs(query(collection(db, "teams"), where("nameKey", "==", nameKey)));
    if (!dup.empty) return formError("That team name is already taken — please choose another.");

    const now = Date.now();
    const data = {
      name, nameKey, members,
      uid: state.user.uid,
      progress: 0,
      solved: [],
      wrongAttempts: 0,
      finished: false,
      startedAtMs: now,
      lastActivityMs: now,
      finishedAtMs: null,
      durationMs: null,
      createdAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, "teams"), data);
    localStorage.setItem(LS_KEY, ref.id);
    sfx.ding();
    startGame(ref.id, data);
  } catch (err) {
    console.error(err);
    formError("Could not register: " + (err.code || err.message));
  } finally {
    btn.disabled = false;
    btn.textContent = "Set Sail";
  }
}

// ---------------- game ----------------
function startGame(id, data) {
  state.teamId = id;
  state.team = { ...data };
  state.solved = [...(data.solved || [])];

  $("#hud-team").textContent = data.name;
  buildStations();
  updateHud();
  updateStory();
  show("screen-game");
  scene.resize();
  scene.setStage(state.solved.length, { instant: true });
  startTimer();

  if (state.team.finished) setTimeout(showWin, 600);
}

function buildPips() {
  $("#pips").innerHTML = Array.from({ length: TOTAL_CODES }, () => '<span class="pip"></span>').join("");
}

function updateHud() {
  const n = state.solved.length;
  document.querySelectorAll("#pips .pip").forEach((p, i) => p.classList.toggle("on", i < n));
  $("#hud-count").textContent = `${n} / ${TOTAL_CODES}`;
}

function updateStory() {
  const el = $("#story-line");
  el.classList.remove("fade");
  void el.offsetWidth;
  el.textContent = STORY_LINES[Math.min(state.solved.length, STORY_LINES.length - 1)];
  el.classList.add("fade");
}

function startTimer() {
  clearInterval(state.timer);
  const tick = () => {
    const t = state.team;
    const ms = t.finished && t.durationMs ? t.durationMs : Date.now() - t.startedAtMs;
    $("#hud-timer").textContent = fmt(ms);
  };
  tick();
  if (!state.team.finished) state.timer = setInterval(tick, 1000);
}

function buildStations() {
  const box = $("#stations");
  box.innerHTML = "";
  STATIONS.forEach((st, si) => {
    const card = document.createElement("div");
    card.className = "station";
    card.innerHTML = `
      <div class="st-head">
        <span class="st-num">${si + 1}</span>
        <div class="st-names">
          <div class="st-label">Station ${si + 1}${st.codeIds.length > 1 ? " · " + st.codeIds.length + " codes" : ""}</div>
          <div class="st-title">${st.title}</div>
        </div>
        <span class="st-status"></span>
      </div>
      <div class="slots"></div>`;
    const slots = card.querySelector(".slots");
    const solvedHere = st.codeIds.filter((c) => state.solved.includes(c)).length;

    st.codeIds.forEach((_, k) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.innerHTML = `
        <input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="10"
               placeholder="${st.codeIds.length > 1 ? "Code " + (k + 1) : "Enter code"}"
               aria-label="Station ${si + 1} code ${k + 1}">
        <button type="button" class="btn small">Return</button>`;
      const input = slot.querySelector("input");
      const btn = slot.querySelector("button");
      if (k < solvedHere) lockSlot(slot);
      input.addEventListener("input", () => (input.value = input.value.replace(/[^0-9]/g, "")));
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") submitCode(st, card, slot, input); });
      btn.addEventListener("click", () => submitCode(st, card, slot, input));
      slots.appendChild(slot);
    });

    box.appendChild(card);
    refreshStation(st, card);
  });
}

function lockSlot(slot) {
  slot.classList.add("locked");
  const input = slot.querySelector("input");
  const btn = slot.querySelector("button");
  input.value = "";
  input.placeholder = "✓ Heart piece returned";
  input.disabled = true;
  btn.textContent = "✓";
  btn.disabled = true;
}

function refreshStation(st, card) {
  const n = st.codeIds.filter((c) => state.solved.includes(c)).length;
  const done = n === st.codeIds.length;
  card.classList.toggle("done", done);
  card.querySelector(".st-status").textContent = done ? "Restored" : `${n}/${st.codeIds.length}`;
}

function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
  clearTimeout(el._sh);
  el._sh = setTimeout(() => el.classList.remove("shake"), 500);
}

async function submitCode(st, card, slot, input) {
  if (state.busy || slot.classList.contains("locked") || state.team.finished) return;
  sfx.init();
  const raw = input.value.trim();
  if (!raw) { shake(slot); input.focus(); return; }

  state.busy = true;
  try {
    const codeId = st.codes[await sha256(`${SALT}|${raw}`)];

    // ---- wrong code ----
    if (!codeId) {
      shake(slot);
      sfx.wrong();
      scene.rage();
      toast("The lava roars! That code is not right.", "error");
      input.select();
      state.team.wrongAttempts = (state.team.wrongAttempts || 0) + 1;
      updateDoc(teamRef(), { wrongAttempts: increment(1), lastActivityMs: Date.now() }).catch(saveErr);
      return;
    }

    // ---- already used (e.g. same Station 1 code typed twice) ----
    if (state.solved.includes(codeId)) {
      input.value = "";
      toast("That piece is already in the heart — find the other code!", "info");
      return;
    }

    // ---- correct code ----
    state.solved.push(codeId);
    const progress = state.solved.length;
    lockSlot(slot);
    refreshStation(st, card);

    const now = Date.now();
    const update = { solved: arrayUnion(codeId), progress, lastActivityMs: now };
    const finished = progress >= TOTAL_CODES;
    if (finished) {
      update.finished = true;
      update.finishedAtMs = now;
      update.durationMs = now - state.team.startedAtMs;
      Object.assign(state.team, { finished: true, finishedAtMs: now, durationMs: update.durationMs });
    }
    state.team.progress = progress;
    updateDoc(teamRef(), update).catch(saveErr);

    updateHud();
    updateStory();
    if (finished) {
      clearInterval(state.timer);
      startTimer();
      sfx.victory();
      scene.setStage(progress);
      setTimeout(showWin, 4300);
    } else {
      sfx.correct();
      scene.setStage(progress);
      toast(`A piece of the heart glows! (${progress}/${TOTAL_CODES})`, "success");
    }
  } finally {
    state.busy = false;
  }
}

function showWin() {
  $("#win-team").textContent = state.team.name;
  $("#win-time").textContent = fmt(state.team.durationMs || 0);
  $("#win-wrong").textContent = state.team.wrongAttempts || 0;
  $("#modal-win").hidden = false;
}

init();

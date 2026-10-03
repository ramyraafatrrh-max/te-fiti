import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot,
  serverTimestamp, arrayUnion, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";
import { STATIONS, SALT, TOTAL_CODES, STORY_LINES } from "./codes.js";
import { Scene } from "./scene.js";
import * as sfx from "./audio.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (s) => document.querySelector(s);
const state = { teamId: null, team: null, solved: [], busy: false, timer: null, unsub: null, started: false };
let scene;

// ---------------- helpers ----------------
function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
}

function toast(msg, type = "info", ms = 2800) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show " + type;
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = ""), ms);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const cleanName = (s) => s.trim().replace(/\s+/g, " ");
const nameKey = (s) => cleanName(s).toLowerCase();

// Each team is a Firebase Auth account. The team name is turned into a private
// login e-mail, so the team only needs to remember its name + password.
async function teamEmail(name) {
  return "team-" + (await sha256("tefiti-team|" + nameKey(name))).slice(0, 40) + "@tefiti-teams.app";
}

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const teamRef = () => doc(db, "teams", state.teamId);

function formError(id, msg) {
  const e = $(id);
  e.textContent = msg || "";
  e.hidden = !msg;
}

function busyBtn(btn, on, text) {
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = text; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}

const isAdminUser = (u) => u && u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

// ---------------- startup ----------------
function init() {
  scene = new Scene($("#scene-wrap"), TOTAL_CODES);
  buildPips();
  bindUI();

  const status = $("#conn-status");
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("PASTE")) {
    status.textContent = "Firebase is not configured yet — add your config to js/firebase-config.js.";
    status.classList.add("bad");
    return;
  }

  let first = true;
  onAuthStateChanged(auth, async (user) => {
    if (!first) return;
    first = false;
    status.textContent = "Connected — the ocean is ready.";
    status.classList.add("ok");
    $("#btn-begin").disabled = false;
    $("#btn-login").disabled = false;

    // Already logged in on this device? Offer to continue.
    if (user && !isAdminUser(user)) {
      try {
        const snap = await getDoc(doc(db, "teams", user.uid));
        if (snap.exists()) {
          const b = $("#btn-continue");
          b.textContent = `Continue as “${snap.data().name}”`;
          b.hidden = false;
          b.onclick = () => { sfx.init(); sfx.click(); enterTeam(user.uid); };
        }
      } catch (e) { console.warn(e); }
    }
  });
}

function bindUI() {
  $("#btn-begin").addEventListener("click", () => {
    sfx.init(); sfx.click();
    show("screen-register");
    setTimeout(() => $("#reg-name").focus(), 50);
  });
  $("#btn-login").addEventListener("click", () => {
    sfx.init(); sfx.click();
    show("screen-login");
    setTimeout(() => $("#login-name").focus(), 50);
  });
  document.querySelectorAll(".js-back").forEach((b) => b.addEventListener("click", () => show("screen-welcome")));
  $("#form-register").addEventListener("submit", register);
  $("#form-login").addEventListener("submit", login);
  $("#btn-mute").addEventListener("click", () => {
    $("#btn-mute").textContent = sfx.toggleMute() ? "🔇" : "🔊";
  });
  $("#btn-logout").addEventListener("click", async () => {
    if (!confirm("Log out of this team? You can log in again with the team name and password.")) return;
    await leaveGame();
    toast("Logged out.", "info");
  });
  $("#btn-close-win").addEventListener("click", () => ($("#modal-win").hidden = true));
}

// ---------------- registration ----------------
async function register(ev) {
  ev.preventDefault();
  sfx.init();
  formError("#reg-error", "");
  const name = cleanName($("#reg-name").value);
  const members = $("#reg-members").value.trim().slice(0, 200);
  const pass = $("#reg-pass").value;
  const pass2 = $("#reg-pass2").value;

  if (name.length < 2) return formError("#reg-error", "Please enter a team name (at least 2 characters).");
  if (pass.length < 6) return formError("#reg-error", "The password must be at least 6 characters.");
  if (pass !== pass2) return formError("#reg-error", "The two passwords don't match.");

  const btn = $("#btn-register");
  busyBtn(btn, true, "Launching the canoe…");
  try {
    const email = await teamEmail(name);
    let user;
    try {
      user = (await createUserWithEmailAndPassword(auth, email, pass)).user;
    } catch (err) {
      if (err.code !== "auth/email-already-in-use") throw err;
      // Name was used before. If the same password is given and the team was
      // deleted by the moderator, allow registering it again.
      try {
        user = (await signInWithEmailAndPassword(auth, email, pass)).user;
      } catch {
        return formError("#reg-error", "That team name is already taken — please choose another.");
      }
      const existing = await getDoc(doc(db, "teams", user.uid));
      if (existing.exists()) {
        await signOut(auth);
        return formError("#reg-error", "This team is already registered — use “Log in” on the welcome screen.");
      }
    }

    const now = Date.now();
    await setDoc(doc(db, "teams", user.uid), {
      name, nameKey: nameKey(name), members,
      progress: 0, solved: [], wrongAttempts: 0, finished: false,
      startedAtMs: now, lastActivityMs: now, finishedAtMs: null, durationMs: null,
      resetCount: 0, createdAt: serverTimestamp()
    });
    $("#form-register").reset();
    sfx.ding();
    enterTeam(user.uid);
  } catch (err) {
    console.error(err);
    formError("#reg-error", friendlyError(err));
  } finally {
    busyBtn(btn, false);
  }
}

// ---------------- login ----------------
async function login(ev) {
  ev.preventDefault();
  sfx.init();
  formError("#login-error", "");
  const name = cleanName($("#login-name").value);
  const pass = $("#login-pass").value;
  if (!name || !pass) return formError("#login-error", "Enter the team name and password.");

  const btn = $("#btn-do-login");
  busyBtn(btn, true, "Checking…");
  try {
    const user = (await signInWithEmailAndPassword(auth, await teamEmail(name), pass)).user;
    const snap = await getDoc(doc(db, "teams", user.uid));
    if (!snap.exists()) {
      await signOut(auth);
      return formError("#login-error", "This team was removed by the moderator. Please register again.");
    }
    $("#form-login").reset();
    sfx.ding();
    enterTeam(user.uid);
  } catch (err) {
    console.error(err);
    formError("#login-error", friendlyError(err));
  } finally {
    busyBtn(btn, false);
  }
}

function friendlyError(err) {
  const c = err.code || "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(c))
    return "Wrong team name or password.";
  if (c === "auth/too-many-requests") return "Too many attempts. Please wait a minute and try again.";
  if (c === "auth/weak-password") return "The password must be at least 6 characters.";
  if (c === "auth/operation-not-allowed") return "Email/Password sign-in is not enabled in Firebase (Authentication → Sign-in method).";
  if (c === "auth/network-request-failed") return "No connection. Check the internet and try again.";
  if (c === "permission-denied") return "Permission denied — check that the Firestore rules were published.";
  return "Something went wrong: " + (c || err.message);
}

// ---------------- live team sync ----------------
function enterTeam(id) {
  if (state.unsub) state.unsub();
  state.teamId = id;
  state.started = false;
  state.unsub = onSnapshot(teamRef(), onTeamSnapshot, (err) => {
    console.error(err);
    if (err.code === "permission-denied") teamRemoved();
  });
}

function onTeamSnapshot(snap) {
  if (!snap.exists()) return teamRemoved();
  const data = snap.data();

  if (!state.started) {               // first load
    state.started = true;
    startGame(data);
    return;
  }

  const serverSolved = data.solved || [];
  const wasReset = (data.resetCount || 0) !== (state.team.resetCount || 0) || serverSolved.length < state.solved.length;

  if (wasReset) {                     // moderator pressed "Reset"
    $("#modal-win").hidden = true;
    startGame(data);
    sfx.wrong();
    toast("The moderator reset your voyage. Te Fiti is a lava demon again!", "error", 4500);
    return;
  }

  if (serverSolved.length > state.solved.length) {   // progress from another phone of the same team
    state.team = { ...state.team, ...data };
    state.solved = [...serverSolved];
    buildStations();
    updateHud();
    updateStory();
    scene.setStage(state.solved.length);
    if (state.team.finished) { startTimer(); setTimeout(showWin, 4300); }
    return;
  }

  state.team = { ...state.team, ...data, solved: state.solved };
}

async function teamRemoved() {
  await leaveGame();
  toast("Your team was removed by the moderator.", "error", 4500);
}

async function leaveGame() {
  if (state.unsub) { state.unsub(); state.unsub = null; }
  clearInterval(state.timer);
  state.teamId = null;
  state.started = false;
  $("#modal-win").hidden = true;
  $("#btn-continue").hidden = true;
  try { await signOut(auth); } catch (e) { console.warn(e); }
  show("screen-welcome");
}

// ---------------- game ----------------
function startGame(data) {
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

function saveErr(e) {
  console.error(e);
  if (e.code === "not-found" || e.code === "permission-denied") return teamRemoved();
  toast("Progress not saved — check your connection.", "error");
}

async function submitCode(st, card, slot, input) {
  if (state.busy || slot.classList.contains("locked") || state.team.finished) return;
  sfx.init();
  const raw = input.value.trim();
  if (!raw) { shake(slot); input.focus(); return; }

  state.busy = true;
  try {
    const codeId = st.codes[await sha256(`${SALT}|${raw}`)];

    if (!codeId) {
      shake(slot);
      sfx.wrong();
      scene.rage();
      toast("The lava roars! That code is not right.", "error");
      input.select();
      updateDoc(teamRef(), { wrongAttempts: increment(1), lastActivityMs: Date.now() }).catch(saveErr);
      return;
    }

    if (state.solved.includes(codeId)) {
      input.value = "";
      toast("That piece is already in the heart — find the other code!", "info");
      return;
    }

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
      startTimer();
      sfx.victory();
      scene.setStage(progress);
      setTimeout(() => { if (state.team.finished) showWin(); }, 4300);
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
  if (!state.teamId) return;
  $("#win-team").textContent = state.team.name;
  $("#win-time").textContent = fmt(state.team.durationMs || 0);
  $("#win-wrong").textContent = state.team.wrongAttempts || 0;
  $("#modal-win").hidden = false;
}

init();

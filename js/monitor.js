import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, MONITOR_PIN } from "./firebase-config.js";
import { STATIONS, TOTAL_CODES } from "./codes.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (s) => document.querySelector(s);
const SESSION_KEY = "tefiti_monitor_ok";

let teams = [];
let knownFinished = null; // Set of team ids already finished (null until first snapshot)

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
function ago(ms) {
  if (!ms) return "—";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  return Math.floor(s / 3600) + "h ago";
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show success";
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = ""), 5000);
}

function stateOf(t) {
  const p = t.progress || 0;
  if (t.finished || p >= TOTAL_CODES) return { cls: "healed", label: "🌺 Restored" };
  if (p >= 4) return { cls: "calm", label: "🌫️ Calming" };
  if (p >= 1) return { cls: "cooling", label: "🔥 Cooling" };
  return { cls: "raging", label: "🌋 Raging" };
}

function sortTeams(list) {
  return [...list].sort((a, b) => {
    if (a.finished && b.finished) return (a.durationMs || 0) - (b.durationMs || 0);
    if (a.finished) return -1;
    if (b.finished) return 1;
    if ((b.progress || 0) !== (a.progress || 0)) return (b.progress || 0) - (a.progress || 0);
    return (a.lastActivityMs || 0) - (b.lastActivityMs || 0); // reached that level first
  });
}

function timeCell(t) {
  return t.finished && t.durationMs ? fmt(t.durationMs) : fmt(Date.now() - (t.startedAtMs || Date.now()));
}

function render() {
  const sorted = sortTeams(teams);
  const finished = sorted.filter((t) => t.finished);

  $("#st-teams").textContent = teams.length;
  $("#st-done").textContent = finished.length;
  $("#st-active").textContent = teams.length - finished.length;
  $("#st-codes").textContent = teams.reduce((n, t) => n + (t.progress || 0), 0);
  $("#empty").hidden = teams.length > 0;

  const champ = $("#champion");
  if (finished.length) {
    champ.hidden = false;
    champ.innerHTML = `🏆 First to restore Te Fiti: <b>${esc(finished[0].name)}</b> in ${fmt(finished[0].durationMs || 0)}`;
  } else champ.hidden = true;

  let rank = 0;
  $("#rows").innerHTML = sorted.map((t) => {
    const st = stateOf(t);
    const solved = t.solved || [];
    const p = t.progress || 0;
    const medal = t.finished ? (++rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank) : "";
    const pips = Array.from({ length: TOTAL_CODES }, (_, i) => `<i class="${i < p ? "on" : ""}"></i>`).join("");
    const chips = STATIONS.map((s, i) => {
      const n = s.codeIds.filter((c) => solved.includes(c)).length;
      const cls = n === s.codeIds.length ? "done" : n > 0 ? "part" : "";
      const txt = s.codeIds.length > 1 ? `S${i + 1} ${n}/${s.codeIds.length}` : `S${i + 1}`;
      return `<em class="chip ${cls}">${txt}</em>`;
    }).join("");
    return `
      <div class="mon-row ${st.cls}">
        <span class="rank">${medal}</span>
        <span class="team"><b>${esc(t.name)}</b><small>${esc(t.members || "")}</small></span>
        <span><em class="badge ${st.cls}">${st.label}</em></span>
        <span class="meter"><span class="pipbar">${pips}</span><small>${p}/${TOTAL_CODES}</small></span>
        <span class="chips">${chips}</span>
        <span class="wrong">${t.wrongAttempts || 0}</span>
        <span class="time" data-id="${t.id}">${timeCell(t)}</span>
        <span class="ago" data-id="${t.id}">${ago(t.lastActivityMs)}</span>
      </div>`;
  }).join("");
}

// live clock without re-rendering everything
function tick() {
  const byId = Object.fromEntries(teams.map((t) => [t.id, t]));
  document.querySelectorAll(".time[data-id]").forEach((el) => { const t = byId[el.dataset.id]; if (t) el.textContent = timeCell(t); });
  document.querySelectorAll(".ago[data-id]").forEach((el) => { const t = byId[el.dataset.id]; if (t) el.textContent = ago(t.lastActivityMs); });
}

async function start() {
  $("#gate").classList.remove("active");
  $("#dash").classList.add("active");
  try {
    await signInAnonymously(auth);
  } catch (e) {
    $("#mon-status").textContent = "Could not connect: " + (e.code || e.message);
    return;
  }
  onSnapshot(collection(db, "teams"), (snap) => {
    teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const nowFinished = new Set(teams.filter((t) => t.finished).map((t) => t.id));
    if (knownFinished) {
      teams.filter((t) => t.finished && !knownFinished.has(t.id))
        .forEach((t) => toast(`🌺 ${t.name} restored the heart of Te Fiti!`));
    }
    knownFinished = nowFinished;
    $("#mon-status").textContent = "Live · updates automatically";
    render();
  }, (err) => {
    console.error(err);
    $("#mon-status").textContent = "Error reading teams: " + (err.code || err.message);
  });
  setInterval(tick, 1000);
}

$("#gate-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if ($("#gate-pin").value === MONITOR_PIN) {
    sessionStorage.setItem(SESSION_KEY, "1");
    start();
  } else {
    $("#gate-error").hidden = false;
  }
});

if (sessionStorage.getItem(SESSION_KEY) === "1") start();

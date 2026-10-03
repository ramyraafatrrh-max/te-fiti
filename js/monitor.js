import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, onSnapshot, updateDoc, deleteDoc, writeBatch, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";
import { STATIONS, TOTAL_CODES } from "./codes.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (s) => document.querySelector(s);

let teams = [];
let knownFinished = null;
let unsub = null;
let tickTimer = null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isAdmin = (u) => u && u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

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
function toast(msg, type = "success") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show " + type;
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = ""), 4000);
}

// ---------------- confirmation dialog ----------------
function confirmBox({ title, text, word = null, okText = "Confirm" }) {
  return new Promise((resolve) => {
    $("#cf-title").textContent = title;
    $("#cf-text").innerHTML = text;
    $("#cf-ok").textContent = okText;
    const wrap = $("#cf-type-wrap"), input = $("#cf-type"), ok = $("#cf-ok");
    wrap.hidden = !word;
    input.value = "";
    if (word) $("#cf-word").textContent = word;
    ok.disabled = !!word;
    input.oninput = () => (ok.disabled = input.value.trim().toUpperCase() !== word);
    const close = (v) => { $("#confirm").hidden = true; ok.onclick = null; $("#cf-cancel").onclick = null; resolve(v); };
    ok.onclick = () => close(true);
    $("#cf-cancel").onclick = () => close(false);
    $("#confirm").hidden = false;
    if (word) setTimeout(() => input.focus(), 50);
  });
}

// ---------------- reset / delete ----------------
const resetData = () => {
  const now = Date.now();
  return {
    progress: 0, solved: [], wrongAttempts: 0, finished: false,
    finishedAtMs: null, durationMs: null, startedAtMs: now, lastActivityMs: now,
    resetCount: increment(1)
  };
};

async function resetTeam(t) {
  const ok = await confirmBox({
    title: "Reset team?",
    text: `Reset <b>${esc(t.name)}</b> back to 0/${TOTAL_CODES}? Their codes, wrong attempts and timer will start again. The team keeps its name and password.`,
    okText: "Reset team"
  });
  if (!ok) return;
  try { await updateDoc(doc(db, "teams", t.id), resetData()); toast(`${t.name} was reset.`); }
  catch (e) { console.error(e); toast("Reset failed: " + (e.code || e.message), "error"); }
}

async function deleteTeam(t) {
  const ok = await confirmBox({
    title: "Delete team?",
    text: `Delete <b>${esc(t.name)}</b> and all its progress? The team will be logged out and must register again.`,
    okText: "Delete team"
  });
  if (!ok) return;
  try { await deleteDoc(doc(db, "teams", t.id)); toast(`${t.name} was deleted.`); }
  catch (e) { console.error(e); toast("Delete failed: " + (e.code || e.message), "error"); }
}

async function bulk(kind) {
  if (!teams.length) return toast("There are no teams.", "info");
  const del = kind === "delete";
  const ok = await confirmBox({
    title: del ? "Delete ALL teams?" : "Reset ALL teams?",
    text: del
      ? `This deletes all <b>${teams.length}</b> teams and their progress. This cannot be undone.`
      : `This resets all <b>${teams.length}</b> teams back to 0/${TOTAL_CODES} and restarts their timers.`,
    word: del ? "DELETE" : "RESET",
    okText: del ? "Delete all" : "Reset all"
  });
  if (!ok) return;
  try {
    for (let i = 0; i < teams.length; i += 400) {
      const batch = writeBatch(db);
      teams.slice(i, i + 400).forEach((t) => {
        const ref = doc(db, "teams", t.id);
        del ? batch.delete(ref) : batch.update(ref, resetData());
      });
      await batch.commit();
    }
    toast(del ? "All teams deleted." : "All teams reset.");
  } catch (e) {
    console.error(e);
    toast("Failed: " + (e.code || e.message), "error");
  }
}

// ---------------- rendering ----------------
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
    return (a.lastActivityMs || 0) - (b.lastActivityMs || 0);
  });
}

const timeCell = (t) => (t.finished && t.durationMs ? fmt(t.durationMs) : fmt(Date.now() - (t.startedAtMs || Date.now())));

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
        <span class="team"><b>${esc(t.name || "(unnamed)")}</b><small>${esc(t.members || "")}</small></span>
        <span><em class="badge ${st.cls}">${st.label}</em></span>
        <span class="meter"><span class="pipbar">${pips}</span><small>${p}/${TOTAL_CODES}</small></span>
        <span class="chips">${chips}</span>
        <span class="wrong">${t.wrongAttempts || 0}</span>
        <span class="time" data-id="${t.id}">${timeCell(t)}</span>
        <span class="ago" data-id="${t.id}">${ago(t.lastActivityMs)}</span>
        <span class="actions">
          <button class="act warn" data-act="reset" data-id="${t.id}" title="Reset progress">↺ Reset</button>
          <button class="act danger" data-act="delete" data-id="${t.id}" title="Delete team">🗑</button>
        </span>
      </div>`;
  }).join("");
}

function tick() {
  const byId = Object.fromEntries(teams.map((t) => [t.id, t]));
  document.querySelectorAll(".time[data-id]").forEach((el) => { const t = byId[el.dataset.id]; if (t) el.textContent = timeCell(t); });
  document.querySelectorAll(".ago[data-id]").forEach((el) => { const t = byId[el.dataset.id]; if (t) el.textContent = ago(t.lastActivityMs); });
}

// ---------------- dashboard on/off ----------------
function openDashboard() {
  $("#gate").classList.remove("active");
  $("#dash").classList.add("active");
  if (unsub) return;
  unsub = onSnapshot(collection(db, "teams"), (snap) => {
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
    $("#mon-status").textContent = "Error reading teams: " + (err.code || err.message) +
      (err.code === "permission-denied" ? " — check the moderator email in firestore.rules." : "");
  });
  tickTimer = setInterval(tick, 1000);
}

function closeDashboard() {
  if (unsub) { unsub(); unsub = null; }
  clearInterval(tickTimer);
  teams = []; knownFinished = null;
  $("#dash").classList.remove("active");
  $("#gate").classList.add("active");
}

// ---------------- events ----------------
$("#rows").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const t = teams.find((x) => x.id === b.dataset.id);
  if (!t) return;
  b.dataset.act === "reset" ? resetTeam(t) : deleteTeam(t);
});
$("#btn-reset-all").addEventListener("click", () => bulk("reset"));
$("#btn-delete-all").addEventListener("click", () => bulk("delete"));
$("#btn-signout").addEventListener("click", () => signOut(auth));

$("#gate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#gate-error");
  err.hidden = true;
  const email = $("#gate-email").value.trim().toLowerCase();
  if (email !== ADMIN_EMAIL.toLowerCase()) {
    err.textContent = "This is not the moderator account.";
    err.hidden = false;
    return;
  }
  const btn = $("#gate-btn");
  btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, $("#gate-pass").value);
    $("#gate-pass").value = "";
  } catch (ex) {
    const c = ex.code || "";
    err.textContent = c === "auth/too-many-requests" ? "Too many attempts — wait a minute."
      : c === "auth/operation-not-allowed" ? "Enable Email/Password in Firebase Authentication."
      : "Wrong email or password.";
    err.hidden = false;
  } finally {
    btn.disabled = false;
  }
});

onAuthStateChanged(auth, (user) => (isAdmin(user) ? openDashboard() : closeDashboard()));

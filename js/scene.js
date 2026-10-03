// Controls the Te Fiti / lava-demon illustration and the particle effects.

const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").substr(i, 2), 16));
const mix = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return "#" + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, "0")).join("");
};

const SHAKE_BY_STAGE = [3, 2, 2, 1, 1, 0];

const LEAVES = [
  [122, 150, -60], [112, 195, -70], [100, 240, -75], [86, 285, -80], [72, 325, -85],
  [278, 150, 60], [288, 195, 70], [300, 240, 75], [314, 285, 80], [328, 325, 85],
  [150, 88, -35], [200, 74, 0], [250, 88, 35], [132, 118, -50], [268, 118, 50]
];
const FLOWERS = [
  [134, 108, "#ff7eb6"], [266, 108, "#ffd166"], [200, 76, "#ffffff"], [118, 172, "#ffffff"],
  [282, 172, "#ff7eb6"], [104, 226, "#ffd166"], [296, 226, "#ffffff"], [92, 278, "#ff7eb6"],
  [308, 278, "#ffd166"], [164, 86, "#ff9ecf"], [236, 86, "#ff9ecf"],
  [60, 352, "#ff7eb6"], [340, 352, "#ffd166"], [110, 340, "#ffffff"], [290, 340, "#ff9ecf"]
];

export class Scene {
  constructor(wrap, total = 6) {
    this.wrap = wrap;
    this.total = total;
    this.svg = wrap.querySelector("svg");
    this.canvas = wrap.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.flash = wrap.querySelector(".flash");
    this.q = (id) => this.svg.querySelector("#" + id);
    this.mode = "embers";
    this.intensity = 1;
    this.particles = [];
    this.healed = false;
    this.timers = [];
    this.buildDecor();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.wrap);
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  buildDecor() {
    const NS = "http://www.w3.org/2000/svg";
    const leaves = this.q("leaves");
    LEAVES.forEach(([x, y, r], i) => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", "M0 0 Q10 -12 26 -4 Q12 8 0 0 Z");
      p.setAttribute("transform", `translate(${x} ${y}) rotate(${r})`);
      p.setAttribute("fill", i % 2 ? "#2fbf5b" : "#5ed67a");
      leaves.appendChild(p);
    });
    const flowers = this.q("flowers");
    FLOWERS.forEach(([x, y, c], i) => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "flower");
      g.style.transitionDelay = (0.6 + i * 0.12).toFixed(2) + "s";
      const s = i > 10 ? 0.8 : 1;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const pc = document.createElementNS(NS, "circle");
        pc.setAttribute("cx", x + Math.cos(a) * 5 * s);
        pc.setAttribute("cy", y + Math.sin(a) * 5 * s);
        pc.setAttribute("r", 4.5 * s);
        pc.setAttribute("fill", c);
        g.appendChild(pc);
      }
      const ctr = document.createElementNS(NS, "circle");
      ctr.setAttribute("cx", x); ctr.setAttribute("cy", y); ctr.setAttribute("r", 3 * s);
      ctr.setAttribute("fill", c === "#ffd166" ? "#ff8c42" : "#ffd166");
      g.appendChild(ctr);
      flowers.appendChild(g);
    });
  }

  resize() {
    const r = this.wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height;
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setFill(ids, color) { ids.forEach((id) => this.svg.querySelectorAll(id).forEach((el) => (el.style.fill = color))); }
  setOpacity(id, v) { const el = this.q(id); if (el) el.style.opacity = v; }
  setInstant(on) { this.svg.classList.toggle("no-anim", !!on); }

  // Stage 0 … total-1 = calming lava demon; stage === total = healed
  setStage(stage, { instant = false } = {}) {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (instant) this.setInstant(true);
    if (stage >= this.total) { this.heal(instant); return; }

    this.healed = false;
    this.svg.classList.remove("heart-burst");
    const p = stage / this.total;
    this.setFill([".skin"], mix("#2a1714", "#6e5d55", p));
    this.setFill([".hair"], mix("#170b09", "#4b3f3a", p));
    this.setFill(["#island"], mix("#2b1912", "#55463d", p));
    this.setOpacity("cracks", (1 - 0.85 * p).toFixed(2));
    this.setOpacity("flames", (1 - p).toFixed(2));
    this.setOpacity("smoke", (0.85 * (1 - p) + 0.08).toFixed(2));
    this.setOpacity("skyLava", (1 - p).toFixed(2));
    this.setOpacity("skyCalm", p.toFixed(2));
    this.setOpacity("skyHealed", 0);
    this.setOpacity("sun", 0);
    this.setOpacity("faceAngry", 1);
    this.setOpacity("faceCalm", 0);
    this.setOpacity("leaves", 0);

    this.q("browL").style.transform = `rotate(${-18 * p}deg)`;
    this.q("browR").style.transform = `rotate(${18 * p}deg)`;
    this.q("mouthAngry").style.transform = `scaleY(${(1 - 0.75 * p).toFixed(2)})`;
    this.setFill([".eye"], mix("#ffd23f", "#fff3d1", p));

    this.setHeart(stage);
    this.svg.classList.remove("healed");
    this.wrap.classList.remove("healed");
    this.svg.classList.remove("shake-0", "shake-1", "shake-2", "shake-3");
    this.svg.classList.add("shake-" + SHAKE_BY_STAGE[stage]);

    this.mode = "embers";
    this.intensity = 1 - p;

    if (!instant && stage > 0) this.pulse();
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => this.setInstant(false)));
  }

  setHeart(stage) {
    const spiral = this.q("heartSpiral");
    spiral.style.strokeDashoffset = (100 * (1 - Math.min(stage, this.total) / this.total)).toFixed(1);
    this.setOpacity("heartAura", (0.15 + 0.85 * (stage / this.total)).toFixed(2));
  }

  pulse() {
    const ring = this.q("pulseRing");
    ring.classList.remove("go");
    void ring.getBoundingClientRect();
    ring.classList.add("go");
  }

  rage() {
    this.svg.classList.add("rage");
    this.burst(40, "embers");
    clearTimeout(this._rageT);
    this._rageT = setTimeout(() => this.svg.classList.remove("rage"), 800);
  }

  heal(instant = false) {
    this.healed = true;
    const apply = () => {
      this.setFill([".skin"], "#58c777");
      this.setFill([".hair"], "#15603a");
      this.setFill(["#island"], "#2f8f46");
      this.setOpacity("cracks", 0);
      this.setOpacity("flames", 0);
      this.setOpacity("smoke", 0);
      this.setOpacity("skyLava", 0);
      this.setOpacity("skyCalm", 0);
      this.setOpacity("skyHealed", 1);
      this.setOpacity("sun", 1);
      this.setOpacity("faceAngry", 0);
      this.setOpacity("faceCalm", 1);
      this.setOpacity("leaves", 1);
      this.setHeart(this.total);
      this.svg.classList.remove("shake-1", "shake-2", "shake-3");
      this.svg.classList.add("shake-0", "healed");
      this.wrap.classList.add("healed");
      this.mode = "love";
      this.intensity = 1;
    };
    if (instant) {
      this.setInstant(true);
      apply();
      requestAnimationFrame(() => requestAnimationFrame(() => this.setInstant(false)));
      return;
    }
    this.setHeart(this.total);
    this.svg.classList.add("heart-burst");
    this.pulse();
    this.timers.push(setTimeout(() => {
      this.flash.classList.remove("go");
      void this.flash.offsetWidth;
      this.flash.classList.add("go");
    }, 700));
    this.timers.push(setTimeout(() => {
      apply();
      this.burst(90, "love");
      this.svg.classList.remove("heart-burst");
    }, 1100));
  }

  // ---------------- particles ----------------
  spawn(kind) {
    const w = this.w, h = this.h;
    if (kind === "embers") {
      return {
        kind, x: w * (0.15 + Math.random() * 0.7), y: h * (0.62 + Math.random() * 0.25),
        vx: (Math.random() - 0.5) * 20, vy: -(30 + Math.random() * 60),
        life: 0, max: 1.5 + Math.random() * 1.5, size: 1.5 + Math.random() * 2.5,
        color: Math.random() < 0.5 ? "255,120,30" : "255,200,60"
      };
    }
    const t = Math.random();
    const type = t < 0.4 ? "heart" : t < 0.75 ? "petal" : "spark";
    const colors = { heart: ["#ff5fa2", "#ff7eb6", "#ff9ecf"], petal: ["#ffffff", "#ffd166", "#ffc2e2"], spark: ["#b8ffcf", "#fff7b0"] };
    const c = colors[type];
    return {
      kind: type, x: w * (0.3 + Math.random() * 0.4), y: h * (0.55 + Math.random() * 0.15),
      vx: (Math.random() - 0.5) * 70, vy: -(25 + Math.random() * 45),
      life: 0, max: 3 + Math.random() * 3, size: type === "heart" ? 6 + Math.random() * 7 : 3 + Math.random() * 4,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 2,
      color: c[Math.floor(Math.random() * c.length)], sway: Math.random() * Math.PI * 2
    };
  }

  burst(n, mode) {
    for (let i = 0; i < n; i++) {
      const p = this.spawn(mode === "love" ? "love" : "embers");
      p.vy *= 1.8; p.vx *= 2;
      this.particles.push(p);
    }
  }

  drawHeart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
    ctx.fill();
  }

  loop(now) {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    const rate = this.mode === "love" ? 18 : 40 * this.intensity;
    this._acc = (this._acc || 0) + rate * dt;
    while (this._acc > 1) {
      this._acc -= 1;
      if (this.particles.length < 220) this.particles.push(this.spawn(this.mode === "love" ? "love" : "embers"));
    }

    this.particles = this.particles.filter((p) => (p.life += dt) < p.max);
    for (const p of this.particles) {
      const k = 1 - p.life / p.max;
      if (p.kind === "embers") {
        p.x += p.vx * dt + Math.sin(now / 300 + p.y) * 0.3;
        p.y += p.vy * dt;
        ctx.fillStyle = `rgba(${p.color},${(k * 0.9).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k + 0.4, 0, Math.PI * 2); ctx.fill();
      } else {
        p.sway += dt * 2;
        p.x += (p.vx * 0.6 + Math.sin(p.sway) * 18) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.globalAlpha = Math.min(1, k * 1.4);
        ctx.fillStyle = p.color;
        if (p.kind === "heart") this.drawHeart(ctx, p.x, p.y, p.size);
        else if (p.kind === "petal") {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.5 * k + 0.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    requestAnimationFrame((t) => this.loop(t));
  }
}

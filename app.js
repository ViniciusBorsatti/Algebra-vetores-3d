import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";

/* ------------------------------------------------------------------ */
/*  Convenções                                                          */
/*  Na aula: x pra frente, y pra direita, z pra cima.                   */
/*  No Three.js o eixo "pra cima" é o y, então mapeamos:                */
/*    math (x, y, z)  →  three (y, z, x)                                */
/* ------------------------------------------------------------------ */

const toThree = (v) => new THREE.Vector3(v.y, v.z, v.x);

const PALETTE = ["#e85d4a", "#0e9e8a", "#e0a200", "#7b5ce6", "#2f6fe4", "#d63e8c"];
const NAMES = ["u", "v", "w", "a", "b", "c", "d", "p", "q", "r"];
const INK = 0x1b2233;
const MUTED = 0x7d879a;
const GRID = 0xc9d1de;

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let axisTarget = 6.5;

/* ------------------------------------------------------------------ */
/*  Cena                                                                */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 400);
const HOME_DIR = new THREE.Vector3(0.62, 0.46, 0.82).normalize();
const homeDistance = () => axisTarget * 3.1;
const HOME = () => HOME_DIR.clone().multiplyScalar(homeDistance());
const HOME_TARGET = () => new THREE.Vector3(0, axisTarget * 0.22, 0);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.7;
controls.minDistance = 4;
controls.maxDistance = 80;
controls.autoRotateSpeed = 0.9;

scene.add(new THREE.HemisphereLight(0xffffff, 0xbfc7d6, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(6, 12, 8);
scene.add(sun);

/* ---------- grade e eixos ---------- */

const labels = new Set();

const world = new THREE.Group();
scene.add(world);

const grid = new THREE.GridHelper(40, 40, GRID, GRID);
grid.material.transparent = true;
grid.material.opacity = 0.55;
world.add(grid);

const gridFine = new THREE.GridHelper(40, 80, GRID, GRID);
gridFine.material.transparent = true;
gridFine.material.opacity = 0.18;
world.add(gridFine);

const axes = new THREE.Group();
world.add(axes);

function makeAxis(dirThree, label) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: INK });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 10), mat);
  shaft.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 14), mat);
  head.position.y = 1;
  const neg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 1, 8),
    new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.22 })
  );
  neg.position.y = -0.5;
  const inner = new THREE.Group();
  inner.add(shaft, head, neg);
  g.add(inner);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirThree.clone().normalize());
  const sprite = makeLabel(label, "#1b2233", { italic: true, size: 64 });
  sprite.center.set(0.5, 0.5);
  g.add(sprite);
  g.userData = { inner, head, shaft, neg, sprite, length: 0 };
  axes.add(g);
  return g;
}

const axisX = makeAxis(new THREE.Vector3(0, 0, 1), "x");
const axisY = makeAxis(new THREE.Vector3(1, 0, 0), "y");
const axisZ = makeAxis(new THREE.Vector3(0, 1, 0), "z");

function setAxisLength(axis, L) {
  const u = axis.userData;
  u.length = L;
  u.shaft.scale.y = L;
  u.shaft.position.y = L / 2;
  u.head.position.y = L + 0.15;
  u.neg.scale.y = L * 0.8;
  u.neg.position.y = -L * 0.4;
  u.sprite.position.y = L + 0.62;
}

/* ---------- rótulos (sprites) ---------- */

function scaleLabels() {
  const d = camera.position.distanceTo(controls.target);
  const h = THREE.MathUtils.clamp(d * 0.021, 0.3, 1.4);
  for (const sp of labels) {
    if (!sp.parent) { labels.delete(sp); continue; }
    sp.scale.set(sp.userData.aspect * h, h, 1);
  }
}

function makeLabel(text, color, { italic = false, size = 44, mono = "" } = {}) {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  const pad = 18;
  ctx.font = `${italic ? "italic " : ""}600 ${size}px "Instrument Sans", sans-serif`;
  const w1 = ctx.measureText(text).width;
  ctx.font = `500 ${size * 0.78}px "JetBrains Mono", monospace`;
  const w2 = mono ? ctx.measureText(mono).width + size * 0.4 : 0;
  c.width = Math.ceil(w1 + w2 + pad * 2);
  c.height = Math.ceil(size * 1.5);
  const ctx2 = c.getContext("2d");
  ctx2.textBaseline = "middle";
  ctx2.fillStyle = color;
  ctx2.font = `${italic ? "italic " : ""}600 ${size}px "Instrument Sans", sans-serif`;
  ctx2.fillText(text, pad, c.height / 2);
  if (mono) {
    ctx2.fillStyle = "#4a5468";
    ctx2.font = `500 ${size * 0.78}px "JetBrains Mono", monospace`;
    ctx2.fillText(mono, pad + w1 + size * 0.4, c.height / 2 + 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.userData.aspect = c.width / c.height;
  sp.userData.h = 0.42;
  sp.scale.set(sp.userData.aspect * 0.42, 0.42, 1);
  sp.renderOrder = 10;
  labels.add(sp);
  return sp;
}

/* ---------- seta de vetor ---------- */

class Arrow {
  constructor(color, { dashed = false, opacity = 1, radius = 0.05, labelAt = "tip" } = {}) {
    this.labelAt = labelAt;
    this.group = new THREE.Group();
    this.color = new THREE.Color(color);
    this.target = new THREE.Vector3();
    this.current = new THREE.Vector3();
    this.origin = new THREE.Vector3();
    this.originCurrent = new THREE.Vector3();
    this.radius = radius;
    this.visible = true;
    this.alpha = 0;
    this.alphaTarget = 1;
    this.dashed = dashed;

    this.mat = new THREE.MeshStandardMaterial({
      color: this.color, roughness: 0.55, metalness: 0.05,
      transparent: true, opacity,
    });
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 18), this.mat);
    this.head = new THREE.Mesh(new THREE.ConeGeometry(radius * 2.6, radius * 7, 22), this.mat);
    this.inner = new THREE.Group();
    this.inner.add(this.shaft, this.head);
    this.group.add(this.inner);

    this.dot = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.2, 14, 14),
      new THREE.MeshBasicMaterial({ color: this.color, transparent: true })
    );
    this.group.add(this.dot);

    this.drop = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: this.color, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.45 })
    );
    this.group.add(this.drop);

    this.label = null;
    this.baseOpacity = opacity;
  }

  setLabel(name, coords) {
    if (this.label) { this.group.remove(this.label); this.label.material.map.dispose(); this.label.material.dispose(); }
    this.label = makeLabel(name, `#${this.color.getHexString()}`, { italic: true, mono: coords });
    this.label.center.set(0, 0.5);
    this.group.add(this.label);
  }

  setColor(hex) {
    this.color.set(hex);
    this.mat.color.set(hex);
    this.dot.material.color.set(hex);
    this.drop.material.color.set(hex);
  }

  tick(dt) {
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 9);
    this.current.lerp(this.target, k);
    this.originCurrent.lerp(this.origin, k);
    this.alpha += (this.alphaTarget - this.alpha) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 8));

    const len = this.current.length();
    this.group.visible = this.alpha > 0.01;
    this.group.position.copy(this.originCurrent);

    const headLen = this.radius * 7;
    const bodyLen = Math.max(len - headLen, 0.0001);
    this.shaft.scale.y = bodyLen;
    this.shaft.position.y = bodyLen / 2;
    this.head.position.y = bodyLen + headLen / 2;
    this.head.visible = len > headLen * 0.6;

    if (len > 1e-4) {
      this.inner.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.current.clone().normalize());
    }
    this.inner.visible = len > 1e-3;

    const a = this.alpha * this.baseOpacity;
    this.mat.opacity = a;
    this.dot.material.opacity = a;
    this.drop.material.opacity = a * 0.45;
    if (this.label) this.label.material.opacity = this.alpha;

    this.dot.position.copy(this.current);
    if (this.label) {
      if (this.labelAt === "mid") {
        this.label.position.copy(this.current).multiplyScalar(0.55).add(new THREE.Vector3(0.12, 0.18, 0.12));
      } else {
        this.label.position.copy(this.current).add(new THREE.Vector3(0.18, 0.22, 0.18));
      }
    }

    const tip = this.current;
    const pos = this.drop.geometry.attributes.position;
    pos.setXYZ(0, tip.x, tip.y, tip.z);
    pos.setXYZ(1, tip.x, -this.originCurrent.y, tip.z);
    pos.needsUpdate = true;
    this.drop.computeLineDistances();
    this.drop.visible = Math.abs(tip.y + this.originCurrent.y) > 0.05;
  }

  dispose() {
    this.group.removeFromParent();
    this.shaft.geometry.dispose(); this.head.geometry.dispose(); this.mat.dispose();
    this.dot.geometry.dispose(); this.dot.material.dispose();
    this.drop.geometry.dispose(); this.drop.material.dispose();
    if (this.label) { this.label.material.map.dispose(); this.label.material.dispose(); }
  }
}

/* ------------------------------------------------------------------ */
/*  Estado                                                              */
/* ------------------------------------------------------------------ */

let nextId = 1;
const vectors = [];           // { id, name, color, x, y, z, arrow, el }
const ops = { a: null, b: null, sum: false, diff: false, cross: false, para: false };

const opArrows = {
  sum:   new Arrow("#1b2233", { opacity: 0.9, radius: 0.045, labelAt: "mid" }),
  diff:  new Arrow("#5b6478", { opacity: 0.9, radius: 0.045, labelAt: "mid" }),
  cross: new Arrow("#8a94a8", { opacity: 0.9, radius: 0.045, labelAt: "mid" }),
};
Object.values(opArrows).forEach((a) => { a.alphaTarget = 0; world.add(a.group); });

const paraMat = new THREE.LineDashedMaterial({ color: MUTED, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0 });
const paraGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
]);
const para = new THREE.LineSegments(paraGeo, paraMat);
world.add(para);
let paraAlpha = 0;

/* ------------------------------------------------------------------ */
/*  UI                                                                  */
/* ------------------------------------------------------------------ */

const listEl = document.getElementById("vector-list");
const tpl = document.getElementById("tpl-vector");
const selA = document.getElementById("sel-a");
const selB = document.getElementById("sel-b");

const fmt = (n) => {
  if (!Number.isFinite(n)) return "—";
  const r = Math.round(n * 100) / 100;
  return (Object.is(r, -0) ? 0 : r).toString().replace("-", "−");
};
const coordsText = (v) => `(${fmt(v.x)}, ${fmt(v.y)}, ${fmt(v.z)})`;

function pickColor() {
  const used = vectors.map((v) => v.color);
  return PALETTE.find((c) => !used.includes(c)) ?? PALETTE[vectors.length % PALETTE.length];
}
function pickName() {
  const used = vectors.map((v) => v.name);
  return NAMES.find((n) => !used.includes(n)) ?? `v${vectors.length + 1}`;
}

function addVector({ x = 1, y = 2, z = 1, name, color } = {}, { animate = true } = {}) {
  const v = {
    id: nextId++,
    name: name ?? pickName(),
    color: color ?? pickColor(),
    x, y, z,
  };
  v.arrow = new Arrow(v.color);
  v.arrow.alpha = 0;
  v.arrow.target.copy(toThree(v));
  if (!animate) v.arrow.current.copy(v.arrow.target);
  world.add(v.arrow.group);
  v.arrow.setLabel(v.name, coordsText(v));

  const el = tpl.content.firstElementChild.cloneNode(true);
  el.style.setProperty("--vc", v.color);
  el.dataset.id = v.id;
  el.querySelector(".vname").value = v.name;
  for (const axis of ["x", "y", "z"]) el.querySelector(`[data-axis="${axis}"]`).value = v[axis];
  el.querySelector(".mod").textContent = `|${v.name}| = ${fmt(Math.hypot(x, y, z))}`;
  if (animate) el.classList.add("enter");
  v.el = el;
  listEl.appendChild(el);
  vectors.push(v);

  el.querySelector(".vname").addEventListener("input", (e) => {
    v.name = e.target.value.trim() || v.name;
    refreshVector(v);
    refreshSelects();
  });
  el.querySelectorAll(".coord").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const n = parseFloat(e.target.value);
      v[e.target.dataset.axis] = Number.isFinite(n) ? n : 0;
      refreshVector(v);
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.target.blur();
    });
  });
  el.querySelector(".swatch").addEventListener("click", () => {
    const i = PALETTE.indexOf(v.color);
    v.color = PALETTE[(i + 1) % PALETTE.length];
    el.style.setProperty("--vc", v.color);
    v.arrow.setColor(v.color);
    refreshVector(v);
  });
  el.querySelector(".remove").addEventListener("click", () => removeVector(v));

  refreshSelects();
  updateOps();
  fitAxes();
  return v;
}

function refreshVector(v) {
  v.arrow.target.copy(toThree(v));
  v.arrow.setLabel(v.name, coordsText(v));
  v.el.querySelector(".mod").textContent = `|${v.name}| = ${fmt(Math.hypot(v.x, v.y, v.z))}`;
  updateOps();
  fitAxes();
}

function removeVector(v) {
  const i = vectors.indexOf(v);
  if (i < 0) return;
  vectors.splice(i, 1);
  v.arrow.alphaTarget = 0;
  setTimeout(() => v.arrow.dispose(), 600);
  v.el.classList.add("leave");
  setTimeout(() => v.el.remove(), 360);
  if (ops.a === v.id) ops.a = null;
  if (ops.b === v.id) ops.b = null;
  refreshSelects();
  updateOps();
  fitAxes();
}

function clearAll() {
  [...vectors].forEach(removeVector);
}

function refreshSelects() {
  for (const [sel, key] of [[selA, "a"], [selB, "b"]]) {
    sel.innerHTML = "";
    if (vectors.length === 0) {
      sel.appendChild(new Option("—", ""));
      sel.disabled = true;
      continue;
    }
    sel.disabled = false;
    for (const v of vectors) sel.appendChild(new Option(v.name, v.id));
    if (!vectors.some((v) => v.id === ops[key])) {
      ops[key] = key === "a" ? vectors[0].id : (vectors[1] ?? vectors[0]).id;
    }
    if (key === "b" && ops.b === ops.a && vectors.length > 1) {
      ops.b = vectors.find((v) => v.id !== ops.a).id;
    }
    sel.value = ops[key];
  }
}
selA.addEventListener("change", () => { ops.a = Number(selA.value); updateOps(); });
selB.addEventListener("change", () => { ops.b = Number(selB.value); updateOps(); });

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const op = chip.dataset.op;
    ops[op] = !ops[op];
    chip.setAttribute("aria-pressed", String(ops[op]));
    updateOps();
  });
});

const R = {
  modA: document.getElementById("r-mod-a"),
  modB: document.getElementById("r-mod-b"),
  dot: document.getElementById("r-dot"),
  angle: document.getElementById("r-angle"),
};
function setResult(el, text) {
  if (el.textContent === text) return;
  el.textContent = text;
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 500);
}

function updateOps() {
  const a = vectors.find((v) => v.id === ops.a);
  const b = vectors.find((v) => v.id === ops.b);

  if (!a || !b) {
    Object.values(R).forEach((el) => setResult(el, "—"));
    Object.values(opArrows).forEach((ar) => (ar.alphaTarget = 0));
    paraAlpha = 0;
    return;
  }

  const ma = Math.hypot(a.x, a.y, a.z);
  const mb = Math.hypot(b.x, b.y, b.z);
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  const cos = ma && mb ? Math.max(-1, Math.min(1, dot / (ma * mb))) : NaN;
  const ang = (Math.acos(cos) * 180) / Math.PI;

  setResult(R.modA, fmt(ma));
  setResult(R.modB, fmt(mb));
  setResult(R.dot, fmt(dot));
  setResult(R.angle, Number.isFinite(ang) ? `${fmt(ang)}°` : "—");

  const A = toThree(a), B = toThree(b);
  const same = a.id === b.id;

  // soma: sai da origem e vai até a + b
  const S = opArrows.sum;
  S.alphaTarget = ops.sum && !same ? 1 : 0;
  S.origin.set(0, 0, 0);
  S.target.copy(A).add(B);
  S.setLabel(`${a.name} + ${b.name}`, coordsText({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }));

  // subtração a − b: seta da ponta de b até a ponta de a
  const D = opArrows.diff;
  D.alphaTarget = ops.diff && !same ? 1 : 0;
  D.origin.copy(B);
  D.target.copy(A).sub(B);
  D.setLabel(`${a.name} − ${b.name}`, coordsText({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }));

  // produto vetorial
  const C = opArrows.cross;
  const cx = a.y * b.z - a.z * b.y;
  const cy = a.z * b.x - a.x * b.z;
  const cz = a.x * b.y - a.y * b.x;
  C.alphaTarget = ops.cross && !same && Math.hypot(cx, cy, cz) > 1e-6 ? 1 : 0;
  C.origin.set(0, 0, 0);
  C.target.copy(toThree({ x: cx, y: cy, z: cz }));
  C.setLabel(`${a.name} × ${b.name}`, coordsText({ x: cx, y: cy, z: cz }));

  // paralelogramo: tracejados paralelos
  paraAlpha = ops.para && !same ? 0.9 : 0;
  const P = paraGeo.attributes.position;
  const sum = A.clone().add(B);
  P.setXYZ(0, A.x, A.y, A.z); P.setXYZ(1, sum.x, sum.y, sum.z);
  P.setXYZ(2, B.x, B.y, B.z); P.setXYZ(3, sum.x, sum.y, sum.z);
  P.needsUpdate = true;
  para.computeLineDistances();

  fitAxes();
}

/* ---------- eixos acompanham o tamanho dos vetores ---------- */

function fitAxes() {
  let m = 3;
  for (const v of vectors) m = Math.max(m, Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
  const a = vectors.find((v) => v.id === ops.a), b = vectors.find((v) => v.id === ops.b);
  if (a && b && (ops.sum || ops.para)) {
    m = Math.max(m, Math.abs(a.x + b.x), Math.abs(a.y + b.y), Math.abs(a.z + b.z));
  }
  axisTarget = Math.ceil(m) + 1.5;
}
let axisLen = 0;

/* ---------- presets ---------- */

const PRESETS = {
  aula: [
    { name: "A", x: 2, y: -2, z: 3, color: "#2f6fe4" },
    { name: "B", x: 1, y: 1, z: 5, color: "#0e9e8a" },
    { name: "v", x: 1, y: 3, z: -4, color: "#e85d4a" },
  ],
  base: [
    { name: "i", x: 1, y: 0, z: 0, color: "#e85d4a" },
    { name: "j", x: 0, y: 1, z: 0, color: "#0e9e8a" },
    { name: "k", x: 0, y: 0, z: 1, color: "#2f6fe4" },
  ],
  plano: [
    { name: "u", x: 2, y: 5, z: 0, color: "#2f6fe4" },
    { name: "v", x: 3, y: 1, z: 0, color: "#e85d4a" },
  ],
};
document.querySelectorAll("[data-preset]").forEach((btn) => {
  btn.addEventListener("click", () => {
    clearAll();
    PRESETS[btn.dataset.preset].forEach((p, i) => setTimeout(() => addVector(p), i * 110));
  });
});

document.getElementById("btn-add").addEventListener("click", () => {
  const n = vectors.length;
  const seeds = [
    { x: 1, y: 3, z: 2 }, { x: 3, y: -1, z: 1 }, { x: -2, y: 2, z: 3 },
    { x: 2, y: 2, z: -1 }, { x: -1, y: -3, z: 2 }, { x: 3, y: 1, z: 3 },
  ];
  const v = addVector(seeds[n % seeds.length]);
  v.el.querySelector('[data-axis="x"]').focus();
  v.el.querySelector('[data-axis="x"]').select();
});
document.getElementById("btn-clear").addEventListener("click", clearAll);

/* ---------- ferramentas de câmera ---------- */

const btnSpin = document.getElementById("btn-spin");
btnSpin.addEventListener("click", () => {
  controls.autoRotate = !controls.autoRotate;
  btnSpin.setAttribute("aria-pressed", String(controls.autoRotate));
});
canvas.addEventListener("pointerdown", () => {
  if (controls.autoRotate) {
    controls.autoRotate = false;
    btnSpin.setAttribute("aria-pressed", "false");
  }
});

let camFlight = null;
document.getElementById("btn-reset").addEventListener("click", () => {
  camFlight = { from: camera.position.clone(), to: HOME(), t0: performance.now(), dur: 900,
    tFrom: controls.target.clone(), tTo: HOME_TARGET() };
});

const btnGrid = document.getElementById("btn-grid");
btnGrid.addEventListener("click", () => {
  const on = !grid.visible;
  grid.visible = gridFine.visible = on;
  btnGrid.setAttribute("aria-pressed", String(on));
});

/* ------------------------------------------------------------------ */
/*  Loop                                                                */
/* ------------------------------------------------------------------ */

const clock = new THREE.Clock();
const t0 = performance.now();
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = (performance.now() - t0) / 1000;

  // abertura: eixos crescem, câmera se aproxima
  const intro = reduceMotion ? 1 : easeOut(Math.min(elapsed / 1.4, 1));
  axisLen += (axisTarget - axisLen) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 6));
  const L = axisLen * intro;
  setAxisLength(axisX, L); setAxisLength(axisY, L); setAxisLength(axisZ, L);
  grid.material.opacity = 0.55 * intro;
  gridFine.material.opacity = 0.18 * intro;

  if (elapsed < 2.4 && !camFlight) {
    const k = reduceMotion ? 1 : easeOut(Math.min(elapsed / 2.4, 1));
    camera.position.copy(HOME()).multiplyScalar(1.7 - 0.7 * k);
    controls.target.copy(HOME_TARGET());
  }

  if (camFlight) {
    const k = easeOut(Math.min((performance.now() - camFlight.t0) / camFlight.dur, 1));
    camera.position.lerpVectors(camFlight.from, camFlight.to, k);
    controls.target.lerpVectors(camFlight.tFrom, camFlight.tTo, k);
    if (k >= 1) camFlight = null;
  }

  for (const v of vectors) v.arrow.tick(dt);
  for (const ar of Object.values(opArrows)) ar.tick(dt);
  paraMat.opacity += (paraAlpha - paraMat.opacity) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 8));
  para.visible = paraMat.opacity > 0.01;

  controls.update();
  scaleLabels();
  renderer.render(scene, camera);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});

/* ---------- começa com o exemplo da aula ---------- */

document.fonts.ready.then(() => {
  const start = reduceMotion ? 0 : 700;
  PRESETS.aula.forEach((p, i) => setTimeout(() => addVector(p), start + i * 160));
  setTimeout(() => {
    ops.sum = true;
    document.querySelector('[data-op="sum"]').setAttribute("aria-pressed", "true");
    updateOps();
  }, start + 900);
});

frame();

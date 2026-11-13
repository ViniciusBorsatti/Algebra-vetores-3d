import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";

/* ------------------------------------------------------------------ */
/*  Convenções                                                          */
/*  Na aula: x pra frente, y pra direita, z pra cima.                   */
/*  No Three.js o eixo "pra cima" é o y, então mapeamos:                */
/*    math (x, y, z)  →  three (y, z, x)                                */
/* ------------------------------------------------------------------ */

const toThree = (v) => new THREE.Vector3(v.y, v.z, v.x);

const PALETTE = ["#ff3b2f", "#00c389", "#ffb000", "#8a3ffc", "#1f7cff", "#ff2d8a", "#00b7ff"];
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
const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(stage.clientWidth || 1, stage.clientHeight || 1, false);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, (stage.clientWidth || 1) / (stage.clientHeight || 1), 0.1, 400);
const HOME_DIR = new THREE.Vector3(0.62, 0.46, 0.82).normalize();
// palco estreito (celular em pé): afasta a câmera pra cena caber na largura
const homeDistance = () => axisTarget * 3.1 * Math.max(1, 1.2 / camera.aspect);
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
  constructor(color, { dashed = false, opacity = 1, radius = 0.05, labelAt = "tip", drop = true } = {}) {
    this.labelAt = labelAt;
    this.showDrop = drop;
    this.delay = 0;        // segundos de espera antes de começar a crescer
    this.originRate = 9;   // velocidade com que a base da seta segue a origem
    this.labelKey = "";
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
      color: this.color, roughness: 0.45, metalness: 0.0,
      emissive: this.color, emissiveIntensity: 0.38,
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

    // esfera invisível, maior, só pra pegar o mouse
    this.hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 10, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.group.add(this.hit);
    this.hot = 0;          // 0..1 destaque de hover/arrasto
    this.hotTarget = 0;
    this.snapNow = false;  // quando arrastando, segue o alvo sem suavizar

    this.drop = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: this.color, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.45 })
    );
    this.group.add(this.drop);

    this.label = null;
    this.baseOpacity = opacity;
  }

  setLabel(name, coords) {
    const key = `${name}|${coords}|${this.color.getHexString()}`;
    if (key === this.labelKey) return;      // nada mudou: não recria a textura
    this.labelKey = key;
    if (this.label) { this.group.remove(this.label); this.label.material.map.dispose(); this.label.material.dispose(); }
    this.label = makeLabel(name, `#${this.color.getHexString()}`, { italic: true, mono: coords });
    this.label.center.set(0, 0.5);
    this.group.add(this.label);
  }

  /** recomeça do zero: a seta cresce de novo a partir da origem dela */
  grow(delay = 0) {
    this.current.set(0, 0, 0);
    this.originCurrent.copy(this.origin);
    this.delay = reduceMotion ? 0 : delay;
  }

  setColor(hex) {
    this.color.set(hex);
    this.mat.color.set(hex);
    this.mat.emissive.set(hex);
    this.dot.material.color.set(hex);
    this.drop.material.color.set(hex);
  }

  tick(dt) {
    const k = reduceMotion || this.snapNow ? 1 : 1 - Math.exp(-dt * 9);
    const waiting = this.delay > 0;
    if (waiting) this.delay -= dt;
    if (!waiting) this.current.lerp(this.target, k);
    this.hot += (this.hotTarget - this.hot) * (1 - Math.exp(-dt * 14));
    this.originCurrent.lerp(this.origin, reduceMotion || this.snapNow ? 1 : 1 - Math.exp(-dt * this.originRate));
    if (!waiting || this.alphaTarget === 0) {
      this.alpha += (this.alphaTarget - this.alpha) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 8));
    }

    const len = this.current.length();
    this.group.visible = this.alpha > 0.01;
    this.group.position.copy(this.originCurrent);

    const headLen = this.radius * 7;
    const bodyLen = Math.max(len - headLen, 0.0001);
    const thick = 1 + this.hot * 0.4;      // engrossa quando em destaque
    this.shaft.scale.set(thick, bodyLen, thick);
    this.head.scale.set(thick, 1, thick);
    this.mat.emissiveIntensity = 0.38 + this.hot * 0.45;
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
    this.dot.scale.setScalar(1 + this.hot * 1.1);
    this.hit.position.copy(this.current);
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
    this.drop.visible = this.showDrop && Math.abs(tip.y + this.originCurrent.y) > 0.05;
  }

  dispose() {
    this.group.removeFromParent();
    this.shaft.geometry.dispose(); this.head.geometry.dispose(); this.mat.dispose();
    this.dot.geometry.dispose(); this.dot.material.dispose();
    this.hit.geometry.dispose(); this.hit.material.dispose();
    this.drop.geometry.dispose(); this.drop.material.dispose();
    if (this.label) { this.label.material.map.dispose(); this.label.material.dispose(); }
  }
}

/* ------------------------------------------------------------------ */
/*  Estado                                                              */
/* ------------------------------------------------------------------ */

let nextId = 1;
const vectors = [];           // { id, name, color, x, y, z, arrow, el }
const ops = { a: null, b: null, sum: false, diff: false, cross: false, para: false, scale: false, proj: false, angle: false, k: 2 };

const opArrows = {
  sum:   new Arrow("#1b2233", { opacity: 0.9, radius: 0.045, labelAt: "mid" }),
  diff:  new Arrow("#6d28d9", { opacity: 0.9, radius: 0.045, labelAt: "mid" }),
  cross: new Arrow("#0891b2", { opacity: 0.9, radius: 0.045, labelAt: "mid" }),
  scale: new Arrow("#1b2233", { opacity: 0.55, radius: 0.05 }),
  proj:  new Arrow("#e08a00", { opacity: 0.95, radius: 0.05, labelAt: "mid" }),
};
Object.values(opArrows).forEach((a) => { a.alphaTarget = 0; world.add(a.group); });

// Soma "ponta a ponta": uma cópia translúcida de b viaja da origem até a ponta de a.
const ghost = new Arrow("#00c389", { opacity: 0.38, radius: 0.045, drop: false });
ghost.alphaTarget = 0;
ghost.originRate = 2.6;    // desliza devagar: dá tempo de ver b viajando
world.add(ghost.group);

// Arco do ângulo entre a e b: um setor preenchido que "abre" de a até b.
const ARC_N = 40;
const arcFillGeo = new THREE.BufferGeometry();
arcFillGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((ARC_N + 2) * 3), 3));
arcFillGeo.setIndex(Array.from({ length: ARC_N }, (_, i) => [0, i + 1, i + 2]).flat());
const arcFill = new THREE.Mesh(arcFillGeo, new THREE.MeshBasicMaterial({
  color: 0xffb000, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
}));
const arcLineGeo = new THREE.BufferGeometry();
arcLineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((ARC_N + 1) * 3), 3));
const arcLine = new THREE.Line(arcLineGeo, new THREE.LineBasicMaterial({ color: 0xc27a00, transparent: true, opacity: 0 }));
arcFill.frustumCulled = arcLine.frustumCulled = false;
world.add(arcFill, arcLine);
let arcAlpha = 0, arcSweep = 0, arcOn = false, arcLabel = null, arcLabelText = "";
let opA = null, opB = null;       // vetores escolhidos nas operações

// Pulso: um anel que se expande na ponta do vetor (ao criar ou soltar).
const pulses = [];
const ringGeo = new THREE.RingGeometry(0.84, 1, 56);
function pulse(pos, color) {
  if (reduceMotion) return;
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false,
  }));
  m.position.copy(pos);
  m.renderOrder = 9;
  world.add(m);
  pulses.push({ m, t: 0 });
}

// Números dos resultados "contam" até o valor novo.
const tweens = new Map();
function setNumber(el, value, suffix = "") {
  if (!Number.isFinite(value)) { el.textContent = "—"; el._cur = NaN; tweens.delete(el); el.classList.remove("flash"); return; }
  const from = el._cur;
  if (reduceMotion || !Number.isFinite(from)) { el.textContent = fmt(value) + suffix; el._cur = value; return; }
  if (Math.abs(from - value) < 0.005 && !tweens.has(el)) return;
  tweens.set(el, { from, to: value, t: 0, suffix });
  el.classList.add("flash");
}

const paraMat = new THREE.LineDashedMaterial({ color: MUTED, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0 });
const paraGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
]);
const para = new THREE.LineSegments(paraGeo, paraMat);
world.add(para);
let paraAlpha = 0;

// perpendicular da projeção: da ponta de a até a ponta da projeção
const perpMat = new THREE.LineDashedMaterial({ color: 0xe08a00, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0 });
const perp = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), perpMat);
world.add(perp);
let perpAlpha = 0;

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
  v.arrow.hit.userData.vec = v;
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

  // passar o mouse na linha destaca a seta na cena
  el.addEventListener("pointerenter", () => { if (!drag) v.arrow.hotTarget = 1; });
  el.addEventListener("pointerleave", () => { if (!drag && hover !== v) v.arrow.hotTarget = 0; });
  el.addEventListener("focusin", () => { v.arrow.hotTarget = 1; });
  el.addEventListener("focusout", () => { if (hover !== v) v.arrow.hotTarget = 0; });

  if (animate) setTimeout(() => { if (vectors.includes(v)) pulse(toThree(v), v.color); }, 420);

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

// Liga/desliga uma operação. Ao ligar, a seta nasce de novo pra mostrar de onde vem.
function setOp(op, on) {
  if (ops[op] === on) return;
  ops[op] = on;
  document.querySelector(`.chip[data-op="${op}"]`).setAttribute("aria-pressed", String(on));
  updateOps();
  if (!on) { if (op === "scale") stopK(); return; }
  if (op === "sum") {
    ghost.originCurrent.set(0, 0, 0);       // b sai da origem...
    ghost.current.copy(ghost.target);       // ...já inteiro, e desliza até a ponta de a
    opArrows.sum.grow(0.95);                // a soma só cresce depois que b chegou
  } else if (op === "angle") {
    arcSweep = 0;
  } else if (opArrows[op]) {
    opArrows[op].grow();
  }
}
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => { stopTour(); setOp(chip.dataset.op, !ops[chip.dataset.op]); });
});

const kRow = document.getElementById("k-row");
const kRange = document.getElementById("k-range");
const kVal = document.getElementById("k-val");
function setK(k) {
  ops.k = Math.round(k * 10) / 10;
  kRange.value = ops.k;
  kVal.textContent = fmt(ops.k);
  updateOps();
}
kRange.addEventListener("input", () => { stopK(); setK(parseFloat(kRange.value)); });

// play: k faz um ciclo completo (sobe até 3, desce até −3 e volta pra onde estava)
const btnKPlay = document.getElementById("btn-k-play");
let kAnim = null;
function startK() {
  kAnim = { t: 0, from: ops.k, phase: Math.asin(Math.max(-1, Math.min(1, ops.k / 3))) };
  btnKPlay.setAttribute("aria-pressed", "true");
}
function stopK() {
  if (!kAnim) return;
  kAnim = null;
  btnKPlay.setAttribute("aria-pressed", "false");
}
btnKPlay.addEventListener("click", () => (kAnim ? stopK() : startK()));

const btnExplain = document.getElementById("btn-explain");
const explainBox = document.getElementById("explain");
btnExplain.addEventListener("click", () => {
  const open = explainBox.classList.toggle("open");
  btnExplain.setAttribute("aria-expanded", String(open));
  btnExplain.querySelector("span").textContent = open ? "Esconder as contas" : "Ver as contas";
});
const E = {
  sum: document.getElementById("e-sum"),
  dot: document.getElementById("e-dot"),
  mod: document.getElementById("e-mod"),
  angle: document.getElementById("e-angle"),
  cross: document.getElementById("e-cross"),
  proj: document.getElementById("e-proj"),
};
const sg = (n) => (n < 0 ? `(${fmt(n)})` : fmt(n));

const R = {
  modA: document.getElementById("r-mod-a"),
  modB: document.getElementById("r-mod-b"),
  dot: document.getElementById("r-dot"),
  angle: document.getElementById("r-angle"),
};
const Lb = {
  modA: document.getElementById("l-mod-a"),
  modB: document.getElementById("l-mod-b"),
  dot: document.getElementById("l-dot"),
};

function updateOps() {
  const a = vectors.find((v) => v.id === ops.a);
  const b = vectors.find((v) => v.id === ops.b);

  opA = a ?? null; opB = b ?? null;
  kRow.hidden = !ops.scale;

  if (!a || !b) {
    Object.values(R).forEach((el) => setNumber(el, NaN));
    Object.values(opArrows).forEach((ar) => (ar.alphaTarget = 0));
    Object.values(E).forEach((el) => (el.textContent = "—"));
    ghost.alphaTarget = 0;
    paraAlpha = 0; perpAlpha = 0; arcOn = false;
    return;
  }
  Lb.modA.textContent = `|${a.name}|`;
  Lb.modB.textContent = `|${b.name}|`;
  Lb.dot.textContent = `${a.name} · ${b.name}`;

  const ma = Math.hypot(a.x, a.y, a.z);
  const mb = Math.hypot(b.x, b.y, b.z);
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  const cos = ma && mb ? Math.max(-1, Math.min(1, dot / (ma * mb))) : NaN;
  const ang = (Math.acos(cos) * 180) / Math.PI;

  setNumber(R.modA, ma);
  setNumber(R.modB, mb);
  setNumber(R.dot, dot);
  setNumber(R.angle, ang, "°");

  const A = toThree(a), B = toThree(b);
  const same = a.id === b.id;

  // soma: sai da origem e vai até a + b
  const S = opArrows.sum;
  S.alphaTarget = ops.sum && !same ? 1 : 0;
  S.origin.set(0, 0, 0);
  S.target.copy(A).add(B);
  S.setLabel(`${a.name} + ${b.name}`, coordsText({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }));

  // cópia de b encostada na ponta de a (regra ponta a ponta)
  ghost.alphaTarget = ops.sum && !same ? 1 : 0;
  ghost.setColor(b.color);
  ghost.origin.copy(A);
  ghost.target.copy(B);

  // arco do ângulo
  arcOn = ops.angle && !same && ma > 1e-9 && mb > 1e-9 && Number.isFinite(ang);
  const arcText = arcOn ? `θ = ${fmt(ang)}°` : "";
  if (arcText !== arcLabelText) {
    arcLabelText = arcText;
    if (arcLabel) { arcLabel.removeFromParent(); arcLabel.material.map.dispose(); arcLabel.material.dispose(); arcLabel = null; }
    if (arcText) {
      arcLabel = makeLabel(arcText, "#a86400", { size: 44 });
      arcLabel.center.set(0.5, 0.5);
      world.add(arcLabel);
    }
  }

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

  // escalar k·a: mesma direção de a, esticado por k
  const K = opArrows.scale;
  K.alphaTarget = ops.scale ? 1 : 0;
  K.setColor(a.color);
  K.origin.set(0, 0, 0);
  K.target.copy(A).multiplyScalar(ops.k);
  K.setLabel(`${fmt(ops.k)}·${a.name}`, coordsText({ x: ops.k * a.x, y: ops.k * a.y, z: ops.k * a.z }));

  // projeção de a sobre b: (a·b / |b|²) · b
  const Pj = opArrows.proj;
  const pf = mb > 1e-9 ? dot / (mb * mb) : 0;
  const projV = { x: pf * b.x, y: pf * b.y, z: pf * b.z };
  Pj.alphaTarget = ops.proj && !same && mb > 1e-9 ? 1 : 0;
  Pj.origin.set(0, 0, 0);
  Pj.target.copy(toThree(projV));
  Pj.setLabel(`proj`, coordsText(projV));
  perpAlpha = ops.proj && !same && mb > 1e-9 ? 0.9 : 0;
  const PP = perp.geometry.attributes.position;
  const PT = toThree(projV);
  PP.setXYZ(0, A.x, A.y, A.z); PP.setXYZ(1, PT.x, PT.y, PT.z);
  PP.needsUpdate = true;
  perp.computeLineDistances();

  // contas abertas
  E.sum.textContent = `(${fmt(a.x)}+${sg(b.x)}, ${fmt(a.y)}+${sg(b.y)}, ${fmt(a.z)}+${sg(b.z)}) = ${coordsText({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })}`;
  E.dot.textContent = `${sg(a.x)}·${sg(b.x)} + ${sg(a.y)}·${sg(b.y)} + ${sg(a.z)}·${sg(b.z)} = ${fmt(dot)}`;
  E.mod.textContent = `|${a.name}| = √(${sg(a.x)}² + ${sg(a.y)}² + ${sg(a.z)}²) = √${fmt(ma * ma)} = ${fmt(ma)}`;
  E.angle.textContent = Number.isFinite(ang)
    ? `cos θ = ${a.name}·${b.name} / (|${a.name}|·|${b.name}|) = ${fmt(dot)} / (${fmt(ma)}·${fmt(mb)}) = ${fmt(cos)} → θ = ${fmt(ang)}°`
    : "—";
  E.cross.textContent = `(${sg(a.y)}·${sg(b.z)} − ${sg(a.z)}·${sg(b.y)}, ${sg(a.z)}·${sg(b.x)} − ${sg(a.x)}·${sg(b.z)}, ${sg(a.x)}·${sg(b.y)} − ${sg(a.y)}·${sg(b.x)}) = ${coordsText({ x: cx, y: cy, z: cz })}`;
  E.proj.textContent = mb > 1e-9 ? `(${a.name}·${b.name} / |${b.name}|²)·${b.name} = (${fmt(dot)} / ${fmt(mb * mb)})·${b.name} = ${coordsText(projV)}` : "—";

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
  if (a && ops.scale) {
    m = Math.max(m, Math.abs(ops.k * a.x), Math.abs(ops.k * a.y), Math.abs(ops.k * a.z));
  }
  axisTarget = Math.ceil(m) + 1.5;
}
let axisLen = 0;

/* ---------- presets ---------- */

const PRESETS = {
  aula: [
    { name: "A", x: 2, y: -2, z: 3, color: "#1f7cff" },
    { name: "B", x: 1, y: 1, z: 5, color: "#00c389" },
    { name: "v", x: 1, y: 3, z: -4, color: "#ff3b2f" },
  ],
  base: [
    { name: "i", x: 1, y: 0, z: 0, color: "#ff3b2f" },
    { name: "j", x: 0, y: 1, z: 0, color: "#00c389" },
    { name: "k", x: 0, y: 0, z: 1, color: "#1f7cff" },
  ],
  plano: [
    { name: "u", x: 2, y: 5, z: 0, color: "#8a3ffc" },
    { name: "v", x: 3, y: 1, z: 0, color: "#ffb000" },
  ],
};
function loadPreset(name) {
  clearAll();
  PRESETS[name].forEach((p, i) => setTimeout(() => addVector(p), i * 130));
  setTimeout(flyHome, PRESETS[name].length * 130 + 60);   // reenquadra depois que os eixos se ajustam
}
document.querySelectorAll("[data-preset]").forEach((btn) => {
  btn.addEventListener("click", () => { stopTour(); loadPreset(btn.dataset.preset); });
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

/* ---------- arrastar a ponta do vetor ---------- */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const hitPlane = new THREE.Plane();
const hitPoint = new THREE.Vector3();
let hover = null;
let drag = null;   // { v, mode: "move" | "height", offset }

const snap = (n) => Math.round(n * 2) / 2;

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}

function pickVector(e) {
  setPointer(e);
  const hits = raycaster.intersectObjects(vectors.map((v) => v.arrow.hit), false);
  return hits.length ? hits[0].object.userData.vec : null;
}

function setHover(v) {
  if (hover === v) return;
  if (hover) { hover.arrow.hotTarget = 0; hover.el.classList.remove("hot"); }
  hover = v;
  if (hover) { hover.arrow.hotTarget = 1; hover.el.classList.add("hot"); }
  canvas.style.cursor = hover ? "grab" : "";
}

canvas.addEventListener("pointermove", (e) => {
  if (drag) {
    setPointer(e);
    if (!raycaster.ray.intersectPlane(hitPlane, hitPoint)) return;
    const v = drag.v;
    if (drag.mode === "height") {
      v.z = snap(hitPoint.y - drag.offset.y);
    } else {
      v.y = snap(hitPoint.x - drag.offset.x);   // three.x → math.y
      v.x = snap(hitPoint.z - drag.offset.z);   // three.z → math.x
    }
    for (const axis of ["x", "y", "z"]) v.el.querySelector(`[data-axis="${axis}"]`).value = v[axis];
    refreshVector(v);
    return;
  }
  if (e.pointerType === "mouse") setHover(pickVector(e));
});

canvas.addEventListener("pointerdown", (e) => {
  document.body.classList.add("touched");   // some a dica do rodapé
  stopTour();
  const v = pickVector(e);
  if (!v) return;
  e.preventDefault();
  const tip = toThree(v);
  const mode = e.shiftKey ? "height" : "move";
  if (mode === "height") {
    // plano vertical que contém a ponta e olha pra câmera
    const n = camera.getWorldDirection(new THREE.Vector3());
    n.y = 0; n.normalize();
    hitPlane.setFromNormalAndCoplanarPoint(n, tip);
  } else {
    // plano horizontal na altura da ponta
    hitPlane.set(new THREE.Vector3(0, 1, 0), -tip.y);
  }
  setPointer(e);
  raycaster.ray.intersectPlane(hitPlane, hitPoint);
  drag = { v, mode, offset: hitPoint.clone().sub(tip) };
  v.arrow.snapNow = true;
  v.arrow.hotTarget = 1;
  v.el.classList.add("dragging");
  controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = mode === "height" ? "ns-resize" : "grabbing";
});

function endDrag() {
  if (!drag) return;
  drag.v.arrow.snapNow = false;
  drag.v.arrow.hotTarget = hover === drag.v ? 1 : 0;
  pulse(toThree(drag.v), drag.v.color);
  drag.v.el.classList.remove("dragging");
  drag = null;
  controls.enabled = true;
  canvas.style.cursor = hover ? "grab" : "";
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
addEventListener("keydown", (e) => {
  if (e.key === "Shift" && drag && drag.mode === "move") {
    // troca pra altura no meio do arrasto
    const tip = toThree(drag.v);
    const n = camera.getWorldDirection(new THREE.Vector3()); n.y = 0; n.normalize();
    hitPlane.setFromNormalAndCoplanarPoint(n, tip);
    raycaster.ray.intersectPlane(hitPlane, hitPoint);
    drag.mode = "height"; drag.offset = hitPoint.clone().sub(tip);
    canvas.style.cursor = "ns-resize";
  }
});
addEventListener("keyup", (e) => {
  if (e.key === "Shift" && drag && drag.mode === "height") {
    const tip = toThree(drag.v);
    hitPlane.set(new THREE.Vector3(0, 1, 0), -tip.y);
    raycaster.ray.intersectPlane(hitPlane, hitPoint);
    drag.mode = "move"; drag.offset = hitPoint.clone().sub(tip);
    canvas.style.cursor = "grabbing";
  }
});

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
function flyHome(dur = 1000) {
  camFlight = { from: camera.position.clone(), to: HOME(), t0: performance.now(), dur,
    tFrom: controls.target.clone(), tTo: HOME_TARGET() };
}
document.getElementById("btn-reset").addEventListener("click", () => flyHome(900));

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

// Arco do ângulo: segue as setas como estão desenhadas agora (não o destino),
// então ele acompanha enquanto um vetor é arrastado ou animado.
const _ua = new THREE.Vector3(), _ub = new THREE.Vector3(), _p = new THREE.Vector3();
function tickArc(dt) {
  const f = reduceMotion ? 1 : 1 - Math.exp(-dt * 8);
  arcAlpha += ((arcOn ? 1 : 0) - arcAlpha) * f;
  if (arcOn) arcSweep += (1 - arcSweep) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 4.5));
  const show = arcAlpha > 0.01 && opA && opB;
  arcFill.visible = arcLine.visible = !!show;
  if (arcLabel) arcLabel.visible = !!show;
  if (!show) return;

  _ua.copy(opA.arrow.current); _ub.copy(opB.arrow.current);
  const la = _ua.length(), lb = _ub.length();
  if (la < 1e-4 || lb < 1e-4) { arcFill.visible = arcLine.visible = false; return; }
  _ua.divideScalar(la); _ub.divideScalar(lb);
  const theta = Math.acos(THREE.MathUtils.clamp(_ua.dot(_ub), -1, 1));
  const sin = Math.sin(theta);
  if (sin < 1e-3) { arcFill.visible = arcLine.visible = false; return; }
  const r = THREE.MathUtils.clamp(Math.min(la, lb) * 0.42, 0.7, 2.2);

  const fp = arcFillGeo.attributes.position, lp = arcLineGeo.attributes.position;
  fp.setXYZ(0, 0, 0, 0);
  for (let i = 0; i <= ARC_N; i++) {
    const t = (i / ARC_N) * arcSweep;
    // interpolação esférica entre as duas direções
    _p.copy(_ua).multiplyScalar(Math.sin((1 - t) * theta) / sin)
      .addScaledVector(_ub, Math.sin(t * theta) / sin).multiplyScalar(r);
    fp.setXYZ(i + 1, _p.x, _p.y, _p.z);
    lp.setXYZ(i, _p.x, _p.y, _p.z);
  }
  fp.needsUpdate = lp.needsUpdate = true;
  arcFill.material.opacity = 0.28 * arcAlpha;
  arcLine.material.opacity = 0.95 * arcAlpha;

  if (arcLabel) {
    const t = 0.5 * arcSweep;
    _p.copy(_ua).multiplyScalar(Math.sin((1 - t) * theta) / sin)
      .addScaledVector(_ub, Math.sin(t * theta) / sin).multiplyScalar(r + 0.8);
    arcLabel.position.copy(_p);
    arcLabel.material.opacity = arcAlpha * arcSweep;
  }
}

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

  // k animado: um ciclo de seno que começa e termina no valor atual
  if (kAnim) {
    kAnim.t += dt / 5.5;
    if (kAnim.t >= 1) { const back = kAnim.from; stopK(); setK(back); }
    else setK(3 * Math.sin(kAnim.phase + kAnim.t * Math.PI * 2));
  }

  for (const v of vectors) v.arrow.tick(dt);
  for (const ar of Object.values(opArrows)) ar.tick(dt);
  ghost.tick(dt);
  tickArc(dt);

  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    p.t += dt / 0.75;
    p.m.quaternion.copy(camera.quaternion);              // sempre de frente pra câmera
    p.m.scale.setScalar(0.12 + easeOut(Math.min(p.t, 1)) * 0.95);
    p.m.material.opacity = 0.9 * (1 - Math.min(p.t, 1));
    if (p.t >= 1) { p.m.removeFromParent(); p.m.material.dispose(); pulses.splice(i, 1); }
  }

  for (const [el, tw] of tweens) {
    tw.t = Math.min(1, tw.t + dt / 0.35);
    el._cur = tw.from + (tw.to - tw.from) * easeOut(tw.t);
    el.textContent = fmt(el._cur) + tw.suffix;
    if (tw.t >= 1) { el._cur = tw.to; tweens.delete(el); el.classList.remove("flash"); }
  }
  paraMat.opacity += (paraAlpha - paraMat.opacity) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 8));
  para.visible = paraMat.opacity > 0.01;
  perpMat.opacity += (perpAlpha - perpMat.opacity) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 8));
  perp.visible = perpMat.opacity > 0.01;

  controls.update();
  scaleLabels();
  renderer.render(scene, camera);
}

// O palco muda de tamanho quando a janela muda ou o painel abre/fecha.
// Redesenha na hora pra não piscar durante a transição.
new ResizeObserver(() => {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}).observe(stage);

/* ---------- painel recolhível ---------- */

document.getElementById("btn-collapse").addEventListener("click", () => document.body.classList.add("side-closed"));
document.getElementById("btn-open").addEventListener("click", () => document.body.classList.remove("side-closed"));

/* ---------- demonstração: o sistema se apresenta sozinho ---------- */

const captionEl = document.getElementById("caption");
const btnTour = document.getElementById("btn-tour");
const tourLabel = document.getElementById("tour-label");
let tour = null;      // { cancels: [] } enquanto roda

function say(text) {
  captionEl.classList.remove("show");
  void captionEl.offsetWidth;           // reinicia a animação de entrada
  captionEl.textContent = text;
  captionEl.classList.add("show");
}
function wait(ms, tok) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    tok.cancels.push(() => { clearTimeout(id); reject(new Error("tour cancelado")); });
  });
}
const ALL_OPS = ["sum", "diff", "para", "scale", "angle", "proj", "cross"];
const allOff = () => ALL_OPS.forEach((op) => setOp(op, false));

function stopTour() {
  if (!tour) return;
  const t = tour; tour = null;
  t.cancels.forEach((fn) => fn());
}

async function runTour() {
  const tok = { cancels: [] };
  tour = tok;
  document.body.classList.add("touring");
  btnTour.setAttribute("aria-pressed", "true");
  tourLabel.textContent = "Parar";
  try {
    allOff();
    loadPreset("aula");
    controls.autoRotate = true;
    btnSpin.setAttribute("aria-pressed", "true");
    say("Três vetores no espaço: A, B e v");
    await wait(3000, tok);

    say("Soma: B viaja até a ponta de A, e A + B fecha o caminho");
    setOp("sum", true);
    await wait(4200, tok);

    say("A soma é a diagonal do paralelogramo");
    setOp("para", true);
    await wait(3000, tok);
    setOp("sum", false); setOp("para", false);

    say("Subtração: A − B vai da ponta de B até a ponta de A");
    setOp("diff", true);
    await wait(3600, tok);
    setOp("diff", false);

    say("Escalar: k estica, encolhe e inverte o vetor");
    setOp("scale", true);
    startK();
    await wait(6000, tok);
    setOp("scale", false);

    say("Produto escalar: dá o ângulo entre os vetores e a projeção de um no outro");
    setOp("angle", true); setOp("proj", true);
    await wait(5000, tok);
    setOp("angle", false); setOp("proj", false);

    say("Produto vetorial: i × j = k, perpendicular aos dois");
    loadPreset("base");
    await wait(900, tok);
    setOp("cross", true);
    await wait(4200, tok);

    say("Agora é com você: digite, arraste e gire");
    setOp("cross", false);
    loadPreset("aula");
    await wait(700, tok);
    setOp("sum", true);
    await wait(2600, tok);
  } catch (err) {
    if (!String(err.message).includes("tour cancelado")) throw err;
  } finally {
    if (tour === tok) tour = null;
    stopK();
    controls.autoRotate = false;
    btnSpin.setAttribute("aria-pressed", "false");
    document.body.classList.remove("touring");
    btnTour.setAttribute("aria-pressed", "false");
    tourLabel.textContent = "Demonstração";
    captionEl.classList.remove("show");
  }
}
btnTour.addEventListener("click", () => (tour ? stopTour() : runTour()));

/* ---------- começa com o exemplo da aula ---------- */

document.fonts.ready.then(() => {
  const start = reduceMotion ? 0 : 700;
  PRESETS.aula.forEach((p, i) => setTimeout(() => addVector(p), start + i * 160));
  setTimeout(() => setOp("sum", true), start + 1000);
});

frame();

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const timeEl = document.querySelector("#time");
const levelEl = document.querySelector("#level");
const killsEl = document.querySelector("#kills");
const healthEl = document.querySelector("#health");
const modulesEl = document.querySelector("#modules");
const xpBar = document.querySelector("#xp-bar");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const startButton = document.querySelector("#start-button");
const upgradeLayer = document.querySelector("#upgrade-layer");
const upgradeGrid = document.querySelector("#upgrade-grid");

const W = canvas.width;
const H = canvas.height;
const keys = new Set();

const upgrades = [
  {
    id: "pulse",
    type: "Arma",
    name: "Pulse Rifle",
    text: "Dispara mais rapido contra o alvo mais proximo.",
    apply: (p) => {
      p.fireRate *= 0.84;
      p.damage += 2;
      p.modules.pulse += 1;
    },
  },
  {
    id: "orbit",
    type: "Drone",
    name: "Firewall Orbit",
    text: "Adiciona um drone orbital que corta inimigos perto do nucleo.",
    apply: (p) => {
      p.orbits += 1;
      p.modules.orbit += 1;
    },
  },
  {
    id: "chain",
    type: "Rede",
    name: "Chain Packet",
    text: "Os disparos passam a ricochetear entre intrusoes proximas.",
    apply: (p) => {
      p.chain += 1;
      p.modules.chain += 1;
    },
  },
  {
    id: "speed",
    type: "Mobilidade",
    name: "Quantum Routing",
    text: "Aumenta a velocidade e a capacidade de escapar de cercos.",
    apply: (p) => {
      p.speed += 34;
      p.modules.speed += 1;
    },
  },
  {
    id: "magnet",
    type: "Dados",
    name: "Data Magnet",
    text: "Recolhe pacotes de experiencia a maior distancia.",
    apply: (p) => {
      p.magnet += 36;
      p.modules.magnet += 1;
    },
  },
  {
    id: "repair",
    type: "Defesa",
    name: "Core Repair",
    text: "Reforca a integridade maxima e recupera vida agora.",
    apply: (p) => {
      p.maxHp += 18;
      p.hp = Math.min(p.maxHp, p.hp + 40);
      p.modules.repair += 1;
    },
  },
];

const state = {
  mode: "menu",
  paused: false,
  last: 0,
  time: 0,
  spawnTimer: 0,
  eliteTimer: 28,
  score: 0,
  kills: 0,
  level: 1,
  xp: 0,
  xpNeed: 24,
  pointer: null,
  player: null,
  enemies: [],
  bullets: [],
  gems: [],
  texts: [],
  particles: [],
  choices: [],
};

function newPlayer() {
  return {
    x: W / 2,
    y: H / 2,
    r: 17,
    hp: 100,
    maxHp: 100,
    speed: 245,
    damage: 14,
    fireRate: 0.52,
    fireCooldown: 0,
    invuln: 0,
    magnet: 92,
    orbits: 1,
    chain: 0,
    modules: {
      pulse: 1,
      orbit: 1,
      chain: 0,
      speed: 0,
      magnet: 0,
      repair: 0,
    },
  };
}

function startGame() {
  state.mode = "play";
  state.paused = false;
  state.last = performance.now();
  state.time = 0;
  state.spawnTimer = 0;
  state.eliteTimer = 26;
  state.score = 0;
  state.kills = 0;
  state.level = 1;
  state.xp = 0;
  state.xpNeed = 24;
  state.pointer = null;
  state.player = newPlayer();
  state.enemies = [];
  state.bullets = [];
  state.gems = [];
  state.texts = [];
  state.particles = [];
  state.choices = [];
  overlay.classList.add("is-hidden");
  upgradeLayer.classList.add("is-hidden");
  updateHud();
  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min(0.033, (now - state.last) / 1000);
  state.last = now;
  if (state.mode === "play" && !state.paused) update(dt);
  draw();
  if (state.mode !== "menu") requestAnimationFrame(loop);
}

function update(dt) {
  state.time += dt;
  state.score += dt * 3;
  state.eliteTimer -= dt;
  movePlayer(dt);
  spawnWave(dt);
  updateEnemies(dt);
  updateWeapons(dt);
  updateBullets(dt);
  updateGems(dt);
  updateEffects(dt);
  updateHud();

  if (state.player.hp <= 0) endGame();
}

function movePlayer(dt) {
  const p = state.player;
  let ax = 0;
  let ay = 0;
  if (keys.has("arrowleft") || keys.has("a")) ax -= 1;
  if (keys.has("arrowright") || keys.has("d")) ax += 1;
  if (keys.has("arrowup") || keys.has("w")) ay -= 1;
  if (keys.has("arrowdown") || keys.has("s")) ay += 1;
  if (state.pointer) {
    const dx = state.pointer.x - p.x;
    const dy = state.pointer.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) {
      ax += dx / d;
      ay += dy / d;
    }
  }
  const len = Math.hypot(ax, ay) || 1;
  p.x = clamp(p.x + (ax / len) * p.speed * dt, p.r, W - p.r);
  p.y = clamp(p.y + (ay / len) * p.speed * dt, p.r, H - p.r);
  p.invuln = Math.max(0, p.invuln - dt);
}

function spawnWave(dt) {
  const pressure = 1 + state.time / 55;
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    const count = Math.min(2 + Math.floor(state.time / 22), 10);
    for (let i = 0; i < count; i += 1) spawnEnemy("swarm", pressure);
    state.spawnTimer = Math.max(0.28, 1.35 - state.time / 190);
  }
  if (state.eliteTimer <= 0) {
    spawnEnemy("elite", pressure);
    state.eliteTimer = Math.max(16, 30 - state.time / 22);
  }
}

function spawnEnemy(kind, pressure) {
  const side = Math.floor(random(0, 4));
  const margin = 40;
  const pos = [
    { x: random(0, W), y: -margin },
    { x: W + margin, y: random(0, H) },
    { x: random(0, W), y: H + margin },
    { x: -margin, y: random(0, H) },
  ][side];
  const elite = kind === "elite";
  state.enemies.push({
    ...pos,
    r: elite ? 28 : random(12, 18),
    hp: elite ? 170 * pressure : 28 * pressure,
    maxHp: elite ? 170 * pressure : 28 * pressure,
    speed: elite ? 58 + pressure * 5 : random(72, 112) + pressure * 6,
    damage: elite ? 20 : 8,
    value: elite ? 12 : 3,
    elite,
    wobble: random(0, Math.PI * 2),
  });
}

function updateEnemies(dt) {
  const p = state.player;
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const e = state.enemies[i];
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const wobble = Math.sin(state.time * 3 + e.wobble) * (e.elite ? 0.12 : 0.22);
    e.x += (dx / d + (-dy / d) * wobble) * e.speed * dt;
    e.y += (dy / d + (dx / d) * wobble) * e.speed * dt;

    if (d < p.r + e.r && p.invuln <= 0) {
      p.hp -= e.damage;
      p.invuln = 0.55;
      addPulse(p.x, p.y, "#ff5d73", 26);
      addText(p.x, p.y - 22, `-${e.damage}`, "#ff8a99");
    }

    if (e.hp <= 0) {
      killEnemy(i);
    }
  }
}

function updateWeapons(dt) {
  const p = state.player;
  p.fireCooldown -= dt;
  if (p.fireCooldown <= 0) {
    const shots = 1 + Math.floor(p.modules.pulse / 3);
    for (let i = 0; i < shots; i += 1) fireAtNearest((i - (shots - 1) / 2) * 0.18);
    p.fireCooldown = p.fireRate;
  }

  for (let i = 0; i < p.orbits; i += 1) {
    const angle = state.time * (1.8 + p.orbits * 0.12) + (i / p.orbits) * Math.PI * 2;
    const ox = p.x + Math.cos(angle) * 72;
    const oy = p.y + Math.sin(angle) * 72;
    for (const e of state.enemies) {
      if (Math.hypot(e.x - ox, e.y - oy) < e.r + 15) {
        e.hp -= (18 + p.orbits * 2) * dt;
      }
    }
  }
}

function fireAtNearest(angleOffset) {
  const p = state.player;
  let target = null;
  let best = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < best) {
      best = d;
      target = e;
    }
  }
  const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) + angleOffset : -Math.PI / 2 + angleOffset;
  state.bullets.push({
    x: p.x,
    y: p.y,
    vx: Math.cos(angle) * 560,
    vy: Math.sin(angle) * 560,
    r: 5,
    damage: p.damage,
    life: 1.15,
    pierce: 1 + p.chain,
    hit: new Set(),
  });
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    for (const e of state.enemies) {
      if (b.hit.has(e)) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
        e.hp -= b.damage;
        b.hit.add(e);
        b.pierce -= 1;
        addSpark(b.x, b.y, "#55d7ff");
        if (b.pierce <= 0) break;
      }
    }

    if (b.life <= 0 || b.pierce <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) {
      state.bullets.splice(i, 1);
    }
  }
}

function updateGems(dt) {
  const p = state.player;
  for (let i = state.gems.length - 1; i >= 0; i -= 1) {
    const g = state.gems[i];
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < p.magnet) {
      const pull = (1 - d / p.magnet) * 520;
      g.x += (dx / d) * pull * dt;
      g.y += (dy / d) * pull * dt;
    }
    if (d < p.r + g.r + 4) {
      state.xp += g.value;
      state.score += g.value * 14;
      state.gems.splice(i, 1);
      addSpark(p.x, p.y, "#70f4b5");
      while (state.xp >= state.xpNeed) levelUp();
    }
  }
}

function updateEffects(dt) {
  for (let i = state.texts.length - 1; i >= 0; i -= 1) {
    const t = state.texts[i];
    t.y -= 28 * dt;
    t.life -= dt;
    if (t.life <= 0) state.texts.splice(i, 1);
  }
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.r += p.grow * dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function killEnemy(index) {
  const e = state.enemies[index];
  state.kills += 1;
  state.score += e.elite ? 250 : 45;
  state.gems.push({ x: e.x, y: e.y, r: e.elite ? 9 : 6, value: e.value });
  addPulse(e.x, e.y, e.elite ? "#a78bfa" : "#70f4b5", e.elite ? 42 : 24);
  if (e.elite) addText(e.x, e.y - 28, "ELITE DOWN", "#a78bfa");
  state.enemies.splice(index, 1);
}

function levelUp() {
  state.mode = "upgrade";
  state.xp -= state.xpNeed;
  state.level += 1;
  state.xpNeed = Math.floor(state.xpNeed * 1.22 + 10);
  state.choices = pickUpgrades();
  renderUpgradeChoices();
  upgradeLayer.classList.remove("is-hidden");
  updateHud();
}

function pickUpgrades() {
  const pool = [...upgrades];
  const result = [];
  while (result.length < 3 && pool.length) {
    const index = Math.floor(random(0, pool.length));
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

function renderUpgradeChoices() {
  upgradeGrid.innerHTML = "";
  for (const upgrade of state.choices) {
    const button = document.createElement("button");
    button.className = "upgrade-card";
    button.type = "button";
    button.innerHTML = `<span>${upgrade.type}</span><strong>${upgrade.name}</strong><p>${upgrade.text}</p>`;
    button.addEventListener("click", () => chooseUpgrade(upgrade));
    upgradeGrid.appendChild(button);
  }
}

function chooseUpgrade(upgrade) {
  upgrade.apply(state.player);
  addText(state.player.x, state.player.y - 34, upgrade.name, "#70f4b5");
  upgradeLayer.classList.add("is-hidden");
  state.mode = "play";
  state.last = performance.now();
  updateHud();
}

function endGame() {
  state.mode = "menu";
  overlayTitle.textContent = "Nucleo comprometido";
  overlayCopy.textContent = `Sobreviveste ${formatTime(state.time)}, eliminaste ${state.kills} intrusoes e chegaste ao nivel ${state.level}. A Nexus precisa de outra execucao.`;
  startButton.textContent = "Reiniciar defesa";
  overlay.classList.remove("is-hidden");
  upgradeLayer.classList.add("is-hidden");
}

function updateHud() {
  const p = state.player || newPlayer();
  timeEl.textContent = formatTime(state.time);
  levelEl.textContent = state.level;
  killsEl.textContent = state.kills.toLocaleString("pt-PT");
  healthEl.textContent = `${Math.max(0, Math.ceil((p.hp / p.maxHp) * 100))}%`;
  healthEl.style.color = p.hp / p.maxHp < 0.3 ? "#ff5d73" : p.hp / p.maxHp < 0.55 ? "#ffd166" : "#70f4b5";
  xpBar.style.transform = `scaleX(${clamp(state.xp / state.xpNeed, 0, 1)})`;
  modulesEl.textContent = moduleSummary(p);
}

function moduleSummary(p) {
  const names = [];
  if (p.modules.pulse) names.push(`Pulse Rifle ${roman(p.modules.pulse)}`);
  if (p.modules.orbit) names.push(`Orbit ${roman(p.modules.orbit)}`);
  if (p.modules.chain) names.push(`Chain ${roman(p.modules.chain)}`);
  if (p.modules.speed) names.push(`Routing ${roman(p.modules.speed)}`);
  if (p.modules.magnet) names.push(`Magnet ${roman(p.modules.magnet)}`);
  if (p.modules.repair) names.push(`Repair ${roman(p.modules.repair)}`);
  return names.join(" / ");
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawArena();
  for (const g of state.gems) drawGem(g);
  for (const b of state.bullets) drawBullet(b);
  for (const e of state.enemies) drawEnemy(e);
  drawOrbits();
  if (state.player) drawPlayer();
  for (const p of state.particles) drawParticle(p);
  for (const t of state.texts) drawText(t);
  if (state.paused) drawPause();
}

function drawArena() {
  ctx.fillStyle = "#070b10";
  ctx.fillRect(0, 0, W, H);
  const drift = (state.time * 24) % 64;
  ctx.strokeStyle = "rgba(85, 215, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let x = -64 + drift; x < W + 64; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - H * 0.18, H);
    ctx.stroke();
  }
  for (let y = -64; y < H + 64; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y + W * 0.08);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(112, 244, 181, 0.05)";
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 180 + Math.sin(state.time) * 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = p.invuln > 0 ? 0.55 + Math.sin(state.time * 24) * 0.25 : 1;
  ctx.shadowColor = "#55d7ff";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "#55d7ff";
  polygon(0, 0, p.r + 4, 6, state.time * 1.8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#071015";
  ctx.font = "950 18px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", 0, 1);
  ctx.restore();
}

function drawOrbits() {
  const p = state.player;
  if (!p) return;
  for (let i = 0; i < p.orbits; i += 1) {
    const angle = state.time * (1.8 + p.orbits * 0.12) + (i / p.orbits) * Math.PI * 2;
    const x = p.x + Math.cos(angle) * 72;
    const y = p.y + Math.sin(angle) * 72;
    ctx.shadowColor = "#a78bfa";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#a78bfa";
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.strokeStyle = e.elite ? "#a78bfa" : "#ff5d73";
  ctx.fillStyle = e.elite ? "rgba(167, 139, 250, 0.18)" : "rgba(255, 93, 115, 0.17)";
  ctx.lineWidth = e.elite ? 4 : 2.5;
  polygon(0, 0, e.r, e.elite ? 8 : 5, state.time * (e.elite ? -0.8 : 1.3) + e.wobble);
  ctx.fill();
  ctx.stroke();
  const hp = clamp(e.hp / e.maxHp, 0, 1);
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fillRect(-e.r, -e.r - 10, e.r * 2, 3);
  ctx.fillStyle = e.elite ? "#a78bfa" : "#ff5d73";
  ctx.fillRect(-e.r, -e.r - 10, e.r * 2 * hp, 3);
  ctx.restore();
}

function drawBullet(b) {
  ctx.shadowColor = "#55d7ff";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#dff8ff";
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawGem(g) {
  ctx.shadowColor = "#70f4b5";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#70f4b5";
  polygon(g.x, g.y, g.r, 4, Math.PI / 4);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawParticle(p) {
  ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawText(t) {
  ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
  ctx.fillStyle = t.color;
  ctx.font = "850 16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(t.text, t.x, t.y);
  ctx.globalAlpha = 1;
}

function drawPause() {
  ctx.fillStyle = "rgba(7, 11, 16, 0.62)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f5f8fb";
  ctx.font = "900 44px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Pausa", W / 2, H / 2);
}

function polygon(x, y, radius, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function addPulse(x, y, color, size) {
  state.particles.push({ x, y, vx: 0, vy: 0, r: size * 0.3, grow: size * 2.2, life: 0.38, maxLife: 0.38, color });
}

function addSpark(x, y, color) {
  for (let i = 0; i < 3; i += 1) {
    const a = random(0, Math.PI * 2);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * random(28, 70),
      vy: Math.sin(a) * random(28, 70),
      r: random(2, 5),
      grow: 5,
      life: 0.24,
      maxLife: 0.24,
      color,
    });
  }
}

function addText(x, y, text, color) {
  state.texts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

function setPointer(event) {
  const rect = canvas.getBoundingClientRect();
  state.pointer = {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H,
  };
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function roman(value) {
  return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][Math.min(value, 10)] || `${value}`;
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

startButton.addEventListener("click", startGame);

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  setPointer(event);
});
canvas.addEventListener("pointermove", setPointer);
canvas.addEventListener("pointerup", () => {
  state.pointer = null;
});
canvas.addEventListener("pointercancel", () => {
  state.pointer = null;
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) event.preventDefault();
  if (event.key === " ") {
    if (state.mode === "play") state.paused = !state.paused;
    return;
  }
  keys.add(key);
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

state.player = newPlayer();
updateHud();
draw();

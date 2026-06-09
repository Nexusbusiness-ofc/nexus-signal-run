const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const levelEl = document.querySelector("#level");
const energyEl = document.querySelector("#energy");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const startButton = document.querySelector("#start-button");

const state = {
  running: false,
  paused: false,
  score: 0,
  level: 1,
  energy: 100,
  time: 0,
  last: 0,
  pointer: null,
  keys: new Set(),
  player: { x: 480, y: 270, r: 16, vx: 0, vy: 0 },
  cores: [],
  hazards: [],
  pulses: [],
};

function reset() {
  state.running = true;
  state.paused = false;
  state.score = 0;
  state.level = 1;
  state.energy = 100;
  state.time = 0;
  state.last = performance.now();
  state.pointer = null;
  state.player = { x: canvas.width / 2, y: canvas.height / 2, r: 16, vx: 0, vy: 0 };
  state.cores = Array.from({ length: 5 }, spawnCore);
  state.hazards = Array.from({ length: 6 }, spawnHazard);
  state.pulses = [];
  overlay.classList.add("is-hidden");
  updateHud();
  requestAnimationFrame(loop);
}

function spawnCore() {
  return {
    x: random(40, canvas.width - 40),
    y: random(44, canvas.height - 44),
    r: random(8, 13),
    phase: random(0, Math.PI * 2),
  };
}

function spawnHazard() {
  const speed = random(58, 118) + state.level * 7;
  const angle = random(0, Math.PI * 2);
  return {
    x: random(40, canvas.width - 40),
    y: random(40, canvas.height - 40),
    r: random(12, 21),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

function loop(now) {
  if (!state.running) return;
  const dt = Math.min(0.033, (now - state.last) / 1000);
  state.last = now;
  if (!state.paused) update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  state.time += dt;
  state.level = 1 + Math.floor(state.score / 300);
  state.energy = Math.max(0, state.energy - dt * (3.8 + state.level * 0.35));

  movePlayer(dt);
  moveHazards(dt);
  collectCores();
  checkHazards(dt);
  updatePulses(dt);

  while (state.hazards.length < Math.min(7 + state.level, 15)) {
    state.hazards.push(spawnHazard());
  }

  if (state.energy <= 0) {
    endGame();
  }

  updateHud();
}

function movePlayer(dt) {
  let ax = 0;
  let ay = 0;
  if (state.keys.has("ArrowLeft") || state.keys.has("a")) ax -= 1;
  if (state.keys.has("ArrowRight") || state.keys.has("d")) ax += 1;
  if (state.keys.has("ArrowUp") || state.keys.has("w")) ay -= 1;
  if (state.keys.has("ArrowDown") || state.keys.has("s")) ay += 1;

  if (state.pointer) {
    const dx = state.pointer.x - state.player.x;
    const dy = state.pointer.y - state.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 8) {
      ax += dx / distance;
      ay += dy / distance;
    }
  }

  const len = Math.hypot(ax, ay) || 1;
  const accel = 520;
  state.player.vx += (ax / len) * accel * dt;
  state.player.vy += (ay / len) * accel * dt;
  state.player.vx *= 0.88;
  state.player.vy *= 0.88;
  state.player.x += state.player.vx * dt;
  state.player.y += state.player.vy * dt;
  state.player.x = clamp(state.player.x, state.player.r, canvas.width - state.player.r);
  state.player.y = clamp(state.player.y, state.player.r, canvas.height - state.player.r);
}

function moveHazards(dt) {
  for (const hazard of state.hazards) {
    hazard.x += hazard.vx * dt;
    hazard.y += hazard.vy * dt;

    if (hazard.x < hazard.r || hazard.x > canvas.width - hazard.r) {
      hazard.vx *= -1;
      hazard.x = clamp(hazard.x, hazard.r, canvas.width - hazard.r);
    }
    if (hazard.y < hazard.r || hazard.y > canvas.height - hazard.r) {
      hazard.vy *= -1;
      hazard.y = clamp(hazard.y, hazard.r, canvas.height - hazard.r);
    }
  }
}

function collectCores() {
  for (let i = state.cores.length - 1; i >= 0; i -= 1) {
    const core = state.cores[i];
    if (distance(state.player, core) < state.player.r + core.r + 4) {
      state.score += 60 + state.level * 10;
      state.energy = Math.min(100, state.energy + 16);
      state.pulses.push({ x: core.x, y: core.y, r: 8, a: 1, color: "#66f0b4" });
      state.cores.splice(i, 1, spawnCore());
    }
  }
}

function checkHazards(dt) {
  for (const hazard of state.hazards) {
    const hit = distance(state.player, hazard) < state.player.r + hazard.r;
    if (hit) {
      state.energy -= 38 * dt;
      state.player.vx -= hazard.vx * 0.012;
      state.player.vy -= hazard.vy * 0.012;
      state.pulses.push({ x: state.player.x, y: state.player.y, r: 18, a: 0.7, color: "#ff6b70" });
    }
  }
}

function updatePulses(dt) {
  state.score += dt * 8;
  for (let i = state.pulses.length - 1; i >= 0; i -= 1) {
    state.pulses[i].r += 80 * dt;
    state.pulses[i].a -= 1.8 * dt;
    if (state.pulses[i].a <= 0) state.pulses.splice(i, 1);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  for (const core of state.cores) drawCore(core);
  for (const hazard of state.hazards) drawHazard(hazard);
  for (const pulse of state.pulses) drawPulse(pulse);
  drawPlayer();

  if (state.paused) {
    ctx.fillStyle = "rgba(8, 17, 20, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f4fbf8";
    ctx.font = "800 38px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Pausa", canvas.width / 2, canvas.height / 2);
  }
}

function drawGrid() {
  ctx.fillStyle = "#081114";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(91, 215, 255, 0.09)";
  ctx.lineWidth = 1;
  const offset = (state.time * 28) % 48;
  for (let x = -48 + offset; x < canvas.width + 48; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + canvas.height * 0.25, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawCore(core) {
  const pulse = Math.sin(state.time * 5 + core.phase) * 2;
  ctx.shadowColor = "#66f0b4";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#66f0b4";
  ctx.beginPath();
  ctx.arc(core.x, core.y, core.r + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawHazard(hazard) {
  ctx.strokeStyle = "#ff6b70";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(hazard.x, hazard.y, hazard.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 107, 112, 0.22)";
  ctx.fill();
}

function drawPulse(pulse) {
  ctx.globalAlpha = pulse.a;
  ctx.strokeStyle = pulse.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(pulse.x, pulse.y, pulse.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.shadowColor = "#5bd7ff";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "#5bd7ff";
  ctx.beginPath();
  ctx.arc(0, 0, state.player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#081114";
  ctx.font = "900 17px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", 0, 1);
  ctx.restore();
}

function endGame() {
  state.running = false;
  overlayTitle.textContent = "Rede interrompida";
  overlayCopy.textContent = `Fizeste ${Math.floor(state.score)} pontos e chegaste ao nivel ${state.level}. Tenta outra rota para manter a Nexus online por mais tempo.`;
  startButton.textContent = "Jogar de novo";
  overlay.classList.remove("is-hidden");
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score).toLocaleString("pt-PT");
  levelEl.textContent = state.level;
  energyEl.textContent = `${Math.ceil(state.energy)}%`;
  energyEl.style.color = state.energy < 28 ? "#ff6b70" : state.energy < 55 ? "#f7c85a" : "#66f0b4";
}

function setPointer(event) {
  const rect = canvas.getBoundingClientRect();
  state.pointer = {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

startButton.addEventListener("click", reset);
canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  setPointer(event);
});
canvas.addEventListener("pointermove", setPointer);
canvas.addEventListener("pointerup", () => {
  state.pointer = null;
});
window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) {
    event.preventDefault();
  }
  if (event.key === " ") {
    if (state.running) state.paused = !state.paused;
    return;
  }
  state.keys.add(event.key.toLowerCase());
});
window.addEventListener("keyup", (event) => {
  state.keys.delete(event.key.toLowerCase());
});

draw();

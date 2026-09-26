// AshKai offline runner. Same genre as the browser's dino game (endless
// side-scrolling obstacle dodge), different character and world: you're a
// padlock outrunning "beacons" (jump) and "scanners" (duck) instead of
// cacti and pterodactyls. Pure canvas + vanilla JS, zero dependencies and
// zero network calls, so — unlike the dino game — it's available whether
// you're online or not, any time, not just when a page fails to load.
(() => {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("game-score");

  const FG = "#39ff6a";
  const DIM = "#1f3d28";

  const GROUND_OFFSET = 24; // px from canvas bottom to the ground line
  const GRAVITY = 0.0028; // px/ms^2
  const JUMP_VELOCITY = -0.62; // px/ms
  const BASE_SPEED = 0.27; // px/ms
  const STAND_H = 20;
  const DUCK_H = 10;
  const HI_KEY = "ashkai_game_hiscore";

  let cssWidth = 760;
  let cssHeight = 140;
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  function groundY() { return cssHeight - GROUND_OFFSET; }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssWidth = Math.max(260, Math.floor(rect.width));
    cssHeight = canvas.height || 140;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.height = cssHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);

  const state = {
    status: "ready", // ready | running | over
    score: 0,
    hi: Number(localStorage.getItem(HI_KEY) || 0),
    speed: BASE_SPEED,
    groundOffset: 0,
    nextSpawnIn: 700,
    downHeld: false,
    player: { x: 30, y: 0, w: 18, h: STAND_H, vy: 0, onGround: true },
    obstacles: [],
  };

  function resetGame() {
    state.status = "running";
    state.score = 0;
    state.speed = BASE_SPEED;
    state.obstacles = [];
    state.nextSpawnIn = 650;
    state.player.h = STAND_H;
    state.player.y = groundY() - STAND_H;
    state.player.vy = 0;
    state.player.onGround = true;
  }

  function spawnObstacle() {
    if (Math.random() < 0.3) {
      // Scanner: a low-flying eye that only a duck avoids.
      state.obstacles.push({
        type: "scanner",
        x: cssWidth + 10,
        w: 20,
        h: STAND_H - DUCK_H,
        y: groundY() - STAND_H,
      });
    } else {
      const count = Math.random() < 0.22 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const w = 10 + Math.random() * 6;
        const h = 18 + Math.random() * 16;
        state.obstacles.push({
          type: "beacon",
          x: cssWidth + 10 + i * (w + 12),
          w,
          h,
          y: groundY() - h,
        });
      }
    }
  }

  function jump() {
    if (state.player.onGround) {
      state.player.vy = JUMP_VELOCITY;
      state.player.onGround = false;
    }
  }

  function handleActivate() {
    if (state.status === "ready" || state.status === "over") resetGame();
    else jump();
  }

  // Guard against stealing keystrokes from the search box — only act on
  // game keys when no text input/textarea currently has focus.
  function typing() {
    const tag = document.activeElement && document.activeElement.tagName;
    return tag === "INPUT" || tag === "TEXTAREA";
  }

  window.addEventListener("keydown", (e) => {
    if (typing()) return;
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      handleActivate();
    } else if (e.code === "ArrowDown") {
      e.preventDefault();
      state.downHeld = true;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowDown") state.downHeld = false;
  });
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handleActivate();
  });

  function update(dt) {
    if (state.status !== "running") return;

    state.score += dt * 0.01;
    state.speed = BASE_SPEED + Math.min(0.24, state.score * 0.0009);

    const p = state.player;
    p.h = state.downHeld && p.onGround ? DUCK_H : STAND_H;
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    const gy = groundY() - p.h;
    if (p.y >= gy) {
      p.y = gy;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }

    state.groundOffset = (state.groundOffset + state.speed * dt) % 24;

    state.nextSpawnIn -= dt;
    if (state.nextSpawnIn <= 0) {
      spawnObstacle();
      state.nextSpawnIn = Math.max(320, 520 + Math.random() * 480 - state.score * 0.4);
    }
    state.obstacles.forEach((o) => { o.x -= state.speed * dt; });
    state.obstacles = state.obstacles.filter((o) => o.x + o.w > -10);

    for (const o of state.obstacles) {
      if (p.x < o.x + o.w && p.x + p.w > o.x && p.y < o.y + o.h && p.y + p.h > o.y) {
        state.status = "over";
        state.hi = Math.max(state.hi, Math.floor(state.score));
        localStorage.setItem(HI_KEY, String(state.hi));
        break;
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // ground
    ctx.strokeStyle = DIM;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY() + 0.5);
    ctx.lineTo(cssWidth, groundY() + 0.5);
    ctx.stroke();

    ctx.setLineDash([7, 9]);
    ctx.strokeStyle = FG;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(-state.groundOffset, groundY() + 5.5);
    ctx.lineTo(cssWidth, groundY() + 5.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // player — a small padlock: body + shackle (shackle hidden while ducking)
    const p = state.player;
    ctx.fillStyle = FG;
    const bodyH = p.h - (p.h === STAND_H ? 6 : 0);
    const bodyY = p.y + p.h - bodyH;
    ctx.fillRect(p.x, bodyY, p.w, bodyH);
    if (p.h === STAND_H) {
      ctx.strokeStyle = FG;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, bodyY, p.w / 2 - 2, Math.PI, 0);
      ctx.stroke();
    }

    // obstacles
    state.obstacles.forEach((o) => {
      if (o.type === "beacon") {
        ctx.fillStyle = FG;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.beginPath();
        ctx.arc(o.x + o.w / 2, o.y - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = FG;
        ctx.beginPath();
        ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(o.x + o.w / 2, o.y + o.h / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // status overlay
    ctx.fillStyle = FG;
    ctx.font = "12px 'JB Mono', 'Courier New', monospace";
    ctx.textAlign = "center";
    if (state.status === "ready") {
      ctx.fillText("PRESS SPACE OR TAP TO START", cssWidth / 2, cssHeight / 2 - 4);
    } else if (state.status === "over") {
      ctx.fillText(
        `TRACKED — SCORE ${Math.floor(state.score)} — PRESS SPACE TO RETRY`,
        cssWidth / 2,
        cssHeight / 2 - 4
      );
    }
    ctx.textAlign = "left";
  }

  function updateScoreLabel() {
    const pad = (n) => String(Math.max(0, Math.floor(n))).padStart(5, "0");
    scoreEl.textContent = `SCORE ${pad(state.score)}\u00a0\u00a0\u00a0HI ${pad(state.hi)}`;
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(40, now - last);
    last = now;
    update(dt);
    draw();
    updateScoreLabel();
    requestAnimationFrame(loop);
  }

  resize();
  state.player.y = groundY() - state.player.h;
  requestAnimationFrame(loop);
})();

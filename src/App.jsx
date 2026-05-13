import { useCallback, useEffect, useRef, useState } from "react";

const DEBUG = false;

const PALETTE = [
  { h: 190, s: 88, l: 68, name: "cyan" },
  { h: 260, s: 78, l: 72, name: "violet" },
  { h: 330, s: 80, l: 72, name: "rose" },
  { h: 155, s: 72, l: 64, name: "menthe" },
  { h: 38, s: 86, l: 70, name: "ambre" },
];

const MAX_DPR = 2;
const INITIAL_BUBBLES = 11;
const MAX_BUBBLES = 16;
const READY_THRESHOLD = 0.78;
const PERFECT_THRESHOLD = 0.92;

let audioContext = null;
let uid = 0;

function debugLog(...args) {
  if (DEBUG) console.debug("[BullesSereines]", ...args);
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getAudioContext() {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;

    if (!audioContext) audioContext = new AudioCtor();

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    return audioContext;
  } catch (error) {
    debugLog("Audio indisponible", error);
    return null;
  }
}

function createNoiseBuffer(ctx, duration = 0.12) {
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
  }

  return buffer;
}

function playTone({
  frequency,
  volume,
  duration,
  type = "sine",
  sweepTo = null,
  delay = 0,
  destination = null,
}) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    if (sweepTo && sweepTo > 0) {
      oscillator.frequency.exponentialRampToValueAtTime(sweepTo, now + duration * 0.72);
    }

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2600, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(destination || ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  } catch (error) {
    debugLog("Erreur son", error);
  }
}

function playSoftBreath(volume = 0.025) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    noise.buffer = createNoiseBuffer(ctx, 0.18);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(820, now);
    filter.Q.setValueAtTime(0.8, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.19);
  } catch (error) {
    debugLog("Erreur souffle", error);
  }
}

function playSatisfyingPop(colorIndex, quality, soundEnabled) {
  if (!soundEnabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const base = 235 + colorIndex * 42;
  const roundness = clamp(quality, 0, 1);

  // Couche 1 : ploc grave et rond.
  playTone({
    frequency: base + 55,
    volume: 0.065 + roundness * 0.035,
    duration: 0.28,
    type: "sine",
    sweepTo: Math.max(80, base * 0.48),
  });

  // Couche 2 : harmonique douce.
  playTone({
    frequency: base * 1.5,
    volume: 0.035 + roundness * 0.025,
    duration: 0.32,
    type: "sine",
    sweepTo: base * 1.2,
    delay: 0.018,
  });

  // Couche 3 : petit éclat cristallin si le timing est bon.
  if (roundness > 0.72) {
    playTone({
      frequency: base * 2.25,
      volume: 0.018 + roundness * 0.018,
      duration: 0.42,
      type: "triangle",
      sweepTo: base * 2.75,
      delay: 0.055,
    });
  }

  // Couche 4 : souffle court, filtré.
  playSoftBreath(0.012 + roundness * 0.014);
}

function playGentleNotReady(soundEnabled) {
  if (!soundEnabled) return;
  playSoftBreath(0.018);
}

function vibrate(ms = 8) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    // ignored
  }
}

class Bubble {
  constructor(width, height, options = {}) {
    this.id = ++uid;
    this.width = width;
    this.height = height;

    this.radius = options.radius ?? random(28, 58);
    this.x = options.x ?? random(this.radius + 16, Math.max(this.radius + 16, width - this.radius - 16));
    this.y = options.y ?? height + this.radius + random(20, 180);

    this.colorIndex = options.colorIndex ?? Math.floor(Math.random() * PALETTE.length);
    this.age = options.age ?? random(0, 280);
    this.phase = options.phase ?? random(0, Math.PI * 2);
    this.phaseSpeed = options.phaseSpeed ?? random(0.010, 0.017);
    this.driftPhase = random(0, Math.PI * 2);
    this.driftSpeed = random(0.008, 0.017);

    const speed = random(0.18, 0.42);
    const angle = -Math.PI / 2 + random(-0.42, 0.42);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.opacity = options.opacity ?? 0;
    this.scale = options.scale ?? 0.25;
    this.alive = true;
    this.responding = 0;
    this.patienceGlow = 0;
  }

  getBreath() {
    return (Math.sin(this.phase) + 1) / 2;
  }

  getReadiness() {
    const breath = this.getBreath();
    const ageFactor = clamp(this.age / 170, 0, 1);
    const readiness = clamp((breath - READY_THRESHOLD) / (1 - READY_THRESHOLD), 0, 1);
    return readiness * ageFactor;
  }

  update(pointer, calmIndex) {
    this.age += 1;
    this.phase += this.phaseSpeed * (0.86 + calmIndex * 0.18);
    this.driftPhase += this.driftSpeed;
    this.opacity = Math.min(1, this.opacity + 0.018);
    this.scale += (1 - this.scale) * 0.045;
    this.responding *= 0.84;

    const readiness = this.getReadiness();
    this.patienceGlow += (readiness - this.patienceGlow) * 0.08;

    const dx = this.x - pointer.x;
    const dy = this.y - pointer.y;
    const distance = Math.hypot(dx, dy);

    if (pointer.active && distance < 150 && distance > 1) {
      const force = ((150 - distance) / 150) * 0.006;
      this.vx += (dx / distance) * force;
      this.vy += (dy / distance) * force;
    }

    this.vx += Math.sin(this.driftPhase) * 0.006;
    this.vy -= 0.0015 + calmIndex * 0.0015;

    this.vx *= 0.988;
    this.vy *= 0.99;

    this.x += this.vx;
    this.y += this.vy;

    const margin = this.radius;

    if (this.x < margin) {
      this.x = margin;
      this.vx = Math.abs(this.vx) * 0.58;
    }

    if (this.x > this.width - margin) {
      this.x = this.width - margin;
      this.vx = -Math.abs(this.vx) * 0.58;
    }

    if (this.y < -margin - 80) {
      this.alive = false;
    }
  }

  nudgeAwayFrom(x, y) {
    const dx = this.x - x;
    const dy = this.y - y;
    const distance = Math.hypot(dx, dy) || 1;
    this.vx += (dx / distance) * 1.25;
    this.vy += (dy / distance) * 1.25;
    this.responding = 1;
  }

  draw(ctx, calmIndex) {
    const breath = this.getBreath();
    const readiness = this.getReadiness();
    const color = PALETTE[this.colorIndex];

    const breathingScale = 0.92 + breath * 0.12;
    const responseScale = 1 + this.responding * 0.06;
    const radius = this.radius * this.scale * breathingScale * responseScale;

    const alpha = this.opacity * (0.74 + calmIndex * 0.24);
    const glowStrength = this.patienceGlow;
    const haloSize = radius * (1.8 + glowStrength * 1.05);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);

    const halo = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, haloSize);
    halo.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${Math.min(color.l + 10, 94)}%, ${0.12 + glowStrength * 0.24})`);
    halo.addColorStop(1, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0)`);

    ctx.beginPath();
    ctx.arc(0, 0, haloSize, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();

    const body = ctx.createRadialGradient(-radius * 0.34, -radius * 0.36, 0, 0, 0, radius);
    body.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${Math.min(color.l + 24 + glowStrength * 8, 98)}%, ${0.78 + glowStrength * 0.12})`);
    body.addColorStop(0.46, `hsla(${color.h}, ${color.s}%, ${color.l}%, ${0.42 + glowStrength * 0.22})`);
    body.addColorStop(0.78, `hsla(${color.h - 12}, ${color.s}%, ${Math.max(color.l - 12, 20)}%, ${0.34 + glowStrength * 0.1})`);
    body.addColorStop(1, `hsla(${color.h - 24}, ${Math.min(color.s + 8, 100)}%, ${Math.max(color.l - 28, 12)}%, ${0.22 + glowStrength * 0.1})`);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${Math.min(color.l + 25, 96)}%, ${0.18 + glowStrength * 0.42})`;
    ctx.lineWidth = 1.4 + glowStrength * 1.2;
    ctx.stroke();

    const highlight = ctx.createRadialGradient(
      -radius * 0.34,
      -radius * 0.36,
      0,
      -radius * 0.28,
      -radius * 0.31,
      radius * 0.48
    );
    highlight.addColorStop(0, `rgba(255,255,255,${0.68 + glowStrength * 0.22})`);
    highlight.addColorStop(0.58, "rgba(255,255,255,0.18)");
    highlight.addColorStop(1, "rgba(255,255,255,0)");

    ctx.beginPath();
    ctx.arc(-radius * 0.28, -radius * 0.32, radius * 0.44, 0, Math.PI * 2);
    ctx.fillStyle = highlight;
    ctx.fill();

    if (readiness > 0.78) {
      ctx.save();
      ctx.rotate(this.phase * 0.15);
      ctx.globalAlpha = (readiness - 0.78) / 0.22;
      ctx.strokeStyle = `hsla(${color.h + 20}, 100%, 88%, 0.52)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.22, -0.55, 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.22, Math.PI - 0.55, Math.PI + 0.55);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  hits(x, y) {
    const radius = this.radius * this.scale * 1.22;
    return Math.hypot(x - this.x, y - this.y) <= radius;
  }
}

class Particle {
  constructor(x, y, colorIndex, options = {}) {
    this.x = x;
    this.y = y;
    this.colorIndex = colorIndex;
    this.ring = Boolean(options.ring);
    this.soft = Boolean(options.soft);

    const angle = random(0, Math.PI * 2);
    const speed = this.ring ? 0 : random(0.9, this.soft ? 2.2 : 4.4);

    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - (this.ring ? 0 : 0.45);
    this.radius = this.ring ? 0 : random(1.2, this.soft ? 3.2 : 4.8);
    this.targetRadius = this.ring ? random(34, this.soft ? 82 : 120) : 0;
    this.life = 1;
    this.decay = this.ring ? random(0.012, 0.024) : random(0.024, 0.044);
  }

  update() {
    if (!this.ring) {
      this.vx *= 0.94;
      this.vy = this.vy * 0.94 + 0.024;
    }

    this.x += this.vx;
    this.y += this.vy;

    if (this.ring) {
      this.radius += (this.targetRadius - this.radius) * 0.095;
    }

    this.life -= this.decay;
  }

  draw(ctx) {
    if (this.life <= 0) return;

    const color = PALETTE[this.colorIndex % PALETTE.length];

    ctx.save();
    ctx.globalAlpha = clamp(this.life * 0.88, 0, 1);

    if (this.ring) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0, this.radius), 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${Math.min(color.l + 20, 96)}%, ${this.life * 0.52})`;
      ctx.lineWidth = this.soft ? 1.1 : 1.7;
      ctx.stroke();
    } else {
      const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      gradient.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${Math.min(color.l + 24, 96)}%, 1)`);
      gradient.addColorStop(1, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0)`);

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    ctx.restore();
  }
}

function makeStars(width, height, count = 80) {
  return Array.from({ length: count }, () => ({
    x: random(0, width),
    y: random(0, height),
    radius: random(0.35, 1.35),
    phase: random(0, Math.PI * 2),
    speed: random(0.35, 1.25),
    alpha: random(0.04, 0.24),
  }));
}

function makeState(width, height) {
  const bubbles = [];

  for (let i = 0; i < INITIAL_BUBBLES; i += 1) {
    bubbles.push(
      new Bubble(width, height, {
        y: random(height * 0.18, height * 0.9),
        opacity: random(0.45, 0.9),
        scale: random(0.65, 0.95),
        age: random(80, 360),
      })
    );
  }

  return {
    width,
    height,
    bubbles,
    particles: [],
    stars: makeStars(width, height),
    pointer: {
      x: width / 2,
      y: height / 2,
      active: false,
    },
    calmIndex: 0.35,
    ambientTarget: 0.35,
    backgroundTime: 0,
    spawnTimer: 0,
    lastActionTime: 0,
    soundEnabled: true,
    paused: false,
  };
}

function resizeCanvas(canvas, state) {
  const dpr = clamp(window.devicePixelRatio || 1, 1, MAX_DPR);
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  state.width = width;
  state.height = height;
  state.stars = makeStars(width, height);

  for (const bubble of state.bubbles) {
    bubble.width = width;
    bubble.height = height;
    bubble.x = clamp(bubble.x, bubble.radius, width - bubble.radius);
    bubble.y = clamp(bubble.y, -bubble.radius, height + bubble.radius);
  }
}

function drawBackground(ctx, state) {
  const { width, height } = state;
  state.backgroundTime += 0.0022;
  state.calmIndex += (state.ambientTarget - state.calmIndex) * 0.012;

  const calm = clamp(state.calmIndex, 0, 1);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `hsl(${215 + calm * 10}, 70%, ${6 + calm * 3}%)`);
  gradient.addColorStop(0.52, `hsl(${214 + calm * 8}, 72%, ${10 + calm * 5}%)`);
  gradient.addColorStop(1, `hsl(${203 + calm * 10}, 70%, ${8 + calm * 7}%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const bands = [
    { y: height * 0.25, h: 190, phase: 0 },
    { y: height * 0.68, h: 275, phase: 2.1 },
  ];

  for (const band of bands) {
    const offsetX = Math.sin(state.backgroundTime + band.phase) * (50 + calm * 40);
    const radius = width * (0.54 + calm * 0.18);
    const aurora = ctx.createRadialGradient(width / 2 + offsetX, band.y, 0, width / 2 + offsetX, band.y, radius);
    aurora.addColorStop(0, `hsla(${band.h}, 80%, ${32 + calm * 16}%, ${0.045 + calm * 0.055})`);
    aurora.addColorStop(0.6, `hsla(${band.h + 45}, 70%, ${25 + calm * 12}%, ${0.022 + calm * 0.028})`);
    aurora.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = aurora;
    ctx.fillRect(0, 0, width, height);
  }

  for (const star of state.stars) {
    const flicker = star.alpha + Math.sin(state.backgroundTime * star.speed + star.phase) * 0.08;
    ctx.globalAlpha = clamp(flicker + calm * 0.08, 0.02, 0.45);
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function spawnBubble(state) {
  state.bubbles.push(new Bubble(state.width, state.height));
}

function popReadyBubble(bubble, state) {
  const readiness = bubble.getReadiness();
  const quality = clamp((readiness - READY_THRESHOLD) / (1 - READY_THRESHOLD), 0.45, 1);

  bubble.alive = false;

  const particleCount = Math.floor(18 + bubble.radius * 0.85);
  for (let i = 0; i < particleCount; i += 1) {
    state.particles.push(new Particle(bubble.x, bubble.y, bubble.colorIndex));
  }

  for (let i = 0; i < 4; i += 1) {
    state.particles.push(new Particle(bubble.x, bubble.y, bubble.colorIndex, { ring: true }));
  }

  state.ambientTarget = clamp(state.ambientTarget + 0.045 + quality * 0.035, 0.25, 1);
  playSatisfyingPop(bubble.colorIndex, quality, state.soundEnabled);
  vibrate(readiness > PERFECT_THRESHOLD ? 18 : 9);
  spawnBubble(state);
}

function respondNotReady(bubble, state, x, y) {
  bubble.nudgeAwayFrom(x, y);

  state.particles.push(new Particle(x, y, bubble.colorIndex, { ring: true, soft: true }));
  for (let i = 0; i < 7; i += 1) {
    state.particles.push(new Particle(x, y, bubble.colorIndex, { soft: true }));
  }

  // Ce n’est pas une punition : le monde ne se ferme pas, il ne s’apaise simplement pas davantage.
  state.ambientTarget = clamp(state.ambientTarget - 0.004, 0.25, 1);
  playGentleNotReady(state.soundEnabled);
  vibrate(5);
}

export default function App() {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const soundEnabledRef = useRef(true);
  const pausedRef = useRef(false);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [paused, setPaused] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [phrase, setPhrase] = useState("Observe une bulle. Attends qu’elle devienne lumineuse.");

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    if (stateRef.current) stateRef.current.soundEnabled = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    pausedRef.current = paused;
    if (stateRef.current) stateRef.current.paused = paused;
  }, [paused]);

  const resetGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = makeState(window.innerWidth, window.innerHeight);
    state.soundEnabled = soundEnabledRef.current;
    state.paused = pausedRef.current;
    stateRef.current = state;

    resizeCanvas(canvas, state);
    setShowGuide(true);
    setPhrase("Observe une bulle. Attends qu’elle devienne lumineuse.");
  }, []);

  const toggleSound = useCallback(() => {
    getAudioContext();
    setSoundEnabled((previous) => !previous);
  }, []);

  const togglePause = useCallback(() => {
    setPaused((previous) => !previous);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const state = makeState(window.innerWidth, window.innerHeight);
    state.soundEnabled = soundEnabledRef.current;
    state.paused = pausedRef.current;
    stateRef.current = state;

    resizeCanvas(canvas, state);

    const ctx = canvas.getContext("2d");
    let last = performance.now();

    function loop(now) {
      const dt = Math.min(now - last, 50);
      last = now;

      state.soundEnabled = soundEnabledRef.current;
      state.paused = pausedRef.current;

      drawBackground(ctx, state);

      if (!state.paused) {
        state.spawnTimer += dt;

        const livingCount = state.bubbles.filter((bubble) => bubble.alive).length;
        if (state.spawnTimer > 1900 && livingCount < MAX_BUBBLES) {
          state.spawnTimer = 0;
          spawnBubble(state);
        }

        state.bubbles = state.bubbles.filter((bubble) => bubble.alive);
        for (const bubble of state.bubbles) {
          bubble.update(state.pointer, state.calmIndex);
        }

        state.particles = state.particles.filter((particle) => particle.life > 0);
        for (const particle of state.particles) {
          particle.update();
        }

        // Retour lent vers un niveau calme neutre.
        state.ambientTarget += (0.42 - state.ambientTarget) * 0.0009;
      }

      [...state.bubbles]
        .sort((a, b) => b.radius - a.radius)
        .forEach((bubble) => bubble.draw(ctx, state.calmIndex));

      for (const particle of state.particles) {
        particle.draw(ctx);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    function toCanvasPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clamp(event.clientX - rect.left, 0, state.width),
        y: clamp(event.clientY - rect.top, 0, state.height),
      };
    }

    function handlePointerMove(event) {
      const point = toCanvasPoint(event);
      state.pointer.x = point.x;
      state.pointer.y = point.y;
      state.pointer.active = true;
    }

    function handlePointerDown(event) {
      getAudioContext();

      const point = toCanvasPoint(event);
      state.pointer.x = point.x;
      state.pointer.y = point.y;
      state.pointer.active = true;
      state.lastActionTime = performance.now();

      setShowGuide(false);

      const candidates = [...state.bubbles].sort((a, b) => a.radius - b.radius);
      for (const bubble of candidates) {
        if (!bubble.alive || bubble.opacity < 0.3 || !bubble.hits(point.x, point.y)) continue;

        if (bubble.getReadiness() >= READY_THRESHOLD) {
          popReadyBubble(bubble, state);
          setPhrase("Bien. Tu as attendu le moment lumineux.");
        } else {
          respondNotReady(bubble, state, point.x, point.y);
          setPhrase("La bulle continue à respirer.");
        }

        return;
      }

      state.particles.push(new Particle(point.x, point.y, 0, { ring: true, soft: true }));
      playGentleNotReady(state.soundEnabled);
    }

    function handlePointerLeave() {
      state.pointer.active = false;
    }

    function handleResize() {
      resizeCanvas(canvas, state);
    }

    canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("resize", handleResize);

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <main className="app-shell" aria-label="Bulles Sereines">
      <canvas ref={canvasRef} className="game-canvas" aria-label="Zone de jeu Bulles Sereines" />

      <section className="top-panel" aria-label="Titre et consigne">
        <div className="eyebrow">mode serein</div>
        <h1>Bulles Sereines</h1>
        <p>{phrase}</p>
      </section>

      <section className="actions" aria-label="Actions">
        <button type="button" onClick={toggleSound}>
          Son : {soundEnabled ? "on" : "off"}
        </button>
        <button type="button" onClick={togglePause}>
          {paused ? "Reprendre" : "Pause"}
        </button>
        <button type="button" onClick={resetGame}>
          Recommencer
        </button>
      </section>

      {showGuide && (
        <section className="guide" aria-label="Guide de démarrage">
          <div className="guide-card">
            <div className="guide-title">Observe</div>
            <div className="guide-text">
              Les bulles respirent. Quand l’une devient lumineuse, touche-la doucement.
            </div>
          </div>
        </section>
      )}

      <section className="bottom-hint" aria-label="Indication douce">
        <span>Pas de score</span>
        <span>Pas de chrono</span>
        <span>Juste attendre le bon moment</span>
      </section>
    </main>
  );
}

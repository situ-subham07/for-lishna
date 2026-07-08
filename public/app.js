/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   Lishna Love Story — Main Application Script               ║
 * ║   All cinematic, interactive, and audio systems             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   0. UTILITY HELPERS
═══════════════════════════════════════════════════════ */

/** Random float between min and max */
const rand     = (min, max) => Math.random() * (max - min) + min;
/** Random integer between min and max (inclusive) */
const randInt  = (min, max) => Math.floor(rand(min, max + 1));
/** Linear interpolation */
const lerp     = (a, b, t) => a + (b - a) * t;
/** Clamp value between min and max */
const clamp    = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Hex to RGB array */
const hexRGB   = h => [
  parseInt(h.slice(1,3),16),
  parseInt(h.slice(3,5),16),
  parseInt(h.slice(5,7),16)
];

/* ═══════════════════════════════════════════════════════
   1. AUDIO ENGINE (Web Audio API — no external files)
═══════════════════════════════════════════════════════ */

class AudioEngine {
  constructor() {
    this.ctx          = null;
    this.masterGain   = null;
    this.analyser     = null;
    this.oscillators  = [];
    this.muted        = false;
    this.volume       = 0.5;
    this.trackIndex   = 0;
    this.tracks       = [
      { name: '♪ Intro Piano',      fn: () => this._playIntro()     },
      { name: '♪ Warm Orchestral',  fn: () => this._playMidSection()},
      { name: '♪ Proposal Theme',   fn: () => this._playProposal()  },
      { name: '♪ Peaceful Ending',  fn: () => this._playEnding()    }
    ];

    // DOM refs
    this.muteBtn       = document.getElementById('mute-btn');
    this.volSlider     = document.getElementById('volume-slider');
    this.nowPlaying    = document.getElementById('now-playing');
    this.vizCanvas     = document.getElementById('visualizer-canvas');
    this.vizCtx        = this.vizCanvas.getContext('2d');

    this._bindUI();
  }

  /** Initialise AudioContext — must be triggered by user gesture */
  init() {
    if (this.ctx) return;
    this.ctx        = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.analyser   = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.masterGain.connect(this.analyser);

    this._playTrack(0);
    this._drawVisualizer();
  }

  /** Play a track by index, crossfading */
  _playTrack(idx) {
    this.trackIndex = idx % this.tracks.length;
    // Stop all current oscillators smoothly
    this.oscillators.forEach(o => {
      try {
        o.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
        setTimeout(() => { try { o.osc.stop(); } catch(_) {} }, 1800);
      } catch(_) {}
    });
    this.oscillators = [];

    const t = this.tracks[this.trackIndex];
    this.nowPlaying.textContent = t.name;
    t.fn();
  }

  /** Transition to next track */
  nextTrack() {
    if (!this.ctx) return;
    this._playTrack(this.trackIndex + 1);
  }

  // ── TRACK COMPOSERS ─────────────────────────────────────────

  /** Soft pentatonic piano arpeggios */
  _playIntro() {
    const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 493.88, 523.25, 587.33];
    let i = 0;
    const schedule = () => {
      if (!this.ctx || this.muted) return;
      const freq  = notes[i % notes.length];
      const { osc, gain } = this._makeOsc('sine', freq * 0.5, 0.06);
      this._arpNote(freq * 0.5, 0.06);
      this._arpNote(freq,       0.05);
      i++;
      this._timer = setTimeout(schedule, 600);
    };
    schedule();
  }

  _playMidSection() {
    const chords = [
      [261.63, 329.63, 392.00],
      [293.66, 369.99, 440.00],
      [246.94, 311.13, 369.99],
      [261.63, 349.23, 440.00]
    ];
    let i = 0;
    const schedule = () => {
      if (!this.ctx || this.muted) return;
      const chord = chords[i % chords.length];
      chord.forEach(f => this._arpNote(f, 0.04));
      i++;
      this._timer = setTimeout(schedule, 1200);
    };
    schedule();
  }

  _playProposal() {
    const melody = [392, 440, 493.88, 523.25, 493.88, 440, 392, 349.23, 392];
    let i = 0;
    const schedule = () => {
      if (!this.ctx || this.muted) return;
      this._arpNote(melody[i % melody.length], 0.07);
      this._arpNote(melody[i % melody.length] * 0.5, 0.03);  // bass
      i++;
      this._timer = setTimeout(schedule, 500);
    };
    schedule();
  }

  _playEnding() {
    const pads = [261.63, 329.63, 392.00, 523.25];
    pads.forEach((f, j) => {
      const { osc, gain } = this._makeOsc('sine', f, 0.025);
      osc.start(this.ctx.currentTime);
      // slow vibrato
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.3;
      lfoGain.gain.value  = 2;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      this.oscillators.push({ osc: lfo, gain: lfoGain });
    });
  }

  /** Create a short plucked note */
  _arpNote(freq, amp) {
    const { osc, gain } = this._makeOsc('sine', freq, amp);
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    osc.start(now);
    osc.stop(now + 2);
    this.oscillators.push({ osc, gain });
  }

  /** Create oscillator connected through gain to master */
  _makeOsc(type, freq, amp) {
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type      = type;
    osc.frequency.value = freq;
    gain.gain.value     = amp;
    osc.connect(gain);
    gain.connect(this.masterGain);
    return { osc, gain };
  }

  // ── VISUALIZER ───────────────────────────────────────────────
  _drawVisualizer() {
    const draw = () => {
      requestAnimationFrame(draw);
      if (!this.analyser) return;
      const buf = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(buf);
      const c   = this.vizCtx;
      const W   = this.vizCanvas.width  = 60;
      const H   = this.vizCanvas.height = 24;
      c.clearRect(0, 0, W, H);
      const barW = W / buf.length;
      buf.forEach((v, i) => {
        const h  = (v / 255) * H;
        const hue= 320 - i * 4;
        c.fillStyle = `hsl(${hue},90%,65%)`;
        c.fillRect(i * barW, H - h, barW - 1, h);
      });
    };
    draw();
  }

  // ── UI BINDING ───────────────────────────────────────────────
  _bindUI() {
    this.muteBtn.addEventListener('click', () => {
      this.muted = !this.muted;
      this.muteBtn.textContent = this.muted ? '🔇' : '🔊';
      if (this.masterGain) {
        this.masterGain.gain.setValueAtTime(
          this.muted ? 0 : this.volume,
          this.ctx.currentTime
        );
      }
    });

    this.volSlider.addEventListener('input', () => {
      this.volume = parseFloat(this.volSlider.value);
      if (this.masterGain && !this.muted) {
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      }
    });
  }
}

/* ═══════════════════════════════════════════════════════
   2. STAR CANVAS
═══════════════════════════════════════════════════════ */

class StarField {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.stars  = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this._populate();
    this._animate();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _populate() {
    this.stars = Array.from({ length: 220 }, () => ({
      x   : rand(0, this.canvas.width),
      y   : rand(0, this.canvas.height),
      r   : rand(0.4, 2),
      a   : rand(0.2, 1),
      da  : rand(0.003, 0.012) * (Math.random() > .5 ? 1 : -1),
      speed: rand(0.02, 0.08)
    }));
  }

  _animate() {
    const c = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    const draw = () => {
      c.clearRect(0, 0, W, H);
      this.stars.forEach(s => {
        s.a += s.da;
        if (s.a > 1 || s.a < 0.1) s.da *= -1;
        c.beginPath();
        c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        c.fillStyle = `rgba(255,245,230,${clamp(s.a, 0, 1)})`;
        c.fill();
      });
      requestAnimationFrame(draw);
    };
    draw();
  }
}

/* ═══════════════════════════════════════════════════════
   3. FIREFLIES
═══════════════════════════════════════════════════════ */

class Fireflies {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.flies  = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this._populate();
    this._animate();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _populate() {
    this.flies = Array.from({ length: 35 }, () => this._newFly());
  }

  _newFly(reset = false) {
    const W = this.canvas.width, H = this.canvas.height;
    return {
      x   : reset ? -10 : rand(0, W),
      y   : rand(H * 0.2, H * 0.95),
      vx  : rand(0.3, 1.2),
      vy  : rand(-0.4, 0.4),
      r   : rand(2, 4),
      a   : rand(0.4, 1),
      da  : rand(0.01, 0.04) * (Math.random() > .5 ? 1 : -1),
      life: rand(80, 220),
      age : 0
    };
  }

  _animate() {
    const c = this.ctx;
    const W = () => this.canvas.width;
    const H = () => this.canvas.height;

    const draw = () => {
      c.clearRect(0, 0, W(), H());
      this.flies.forEach((f, i) => {
        f.x   += f.vx;
        f.y   += f.vy + Math.sin(f.age * 0.04) * 0.4;
        f.age++;
        f.a   += f.da;
        if (f.a > 1 || f.a < 0.1) f.da *= -1;

        if (f.x > W() + 20 || f.age > f.life) {
          this.flies[i] = this._newFly(true);
          return;
        }

        const grd = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 4);
        grd.addColorStop(0, `rgba(200,255,120,${f.a})`);
        grd.addColorStop(1, 'rgba(200,255,120,0)');
        c.beginPath();
        c.arc(f.x, f.y, f.r * 4, 0, Math.PI * 2);
        c.fillStyle = grd;
        c.fill();

        c.beginPath();
        c.arc(f.x, f.y, f.r * 0.6, 0, Math.PI * 2);
        c.fillStyle = `rgba(230,255,180,${f.a})`;
        c.fill();
      });
      requestAnimationFrame(draw);
    };
    draw();
  }
}

/* ═══════════════════════════════════════════════════════
   4. SPARKLE BURST (on envelope open)
═══════════════════════════════════════════════════════ */

class SparkleBurst {
  constructor(canvasId) {
    this.canvas     = document.getElementById(canvasId);
    this.ctx        = this.canvas.getContext('2d');
    this.particles  = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this._animate();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(cx, cy, count = 60) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(2, 9);
      this.particles.push({
        x  : cx, y: cy,
        vx : Math.cos(angle) * speed,
        vy : Math.sin(angle) * speed - rand(1, 4),
        r  : rand(3, 8),
        a  : 1,
        color: `hsl(${randInt(300,360)},100%,${randInt(60,85)}%)`
      });
    }
  }

  _animate() {
    const c = this.ctx;
    const draw = () => {
      c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.particles = this.particles.filter(p => p.a > 0.02);
      this.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;  // gravity
        p.a  -= 0.018;
        c.globalAlpha = p.a;
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fillStyle = p.color;
        c.fill();
        // sparkle cross
        c.fillRect(p.x - p.r * .1, p.y - p.r * 1.5, p.r * .2, p.r * 3);
        c.fillRect(p.x - p.r * 1.5, p.y - p.r * .1, p.r * 3, p.r * .2);
      });
      c.globalAlpha = 1;
      requestAnimationFrame(draw);
    };
    draw();
  }
}

/* ═══════════════════════════════════════════════════════
   5. HEART CURSOR TRAIL
═══════════════════════════════════════════════════════ */

class HeartCursor {
  constructor() {
    this.canvas   = document.getElementById('heart-cursor-canvas');
    this.ctx      = this.canvas.getContext('2d');
    this.hearts   = [];
    this.mouse    = { x: -100, y: -100, vx: 0, vy: 0, px: -100, py: -100 };
    this.dragging = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    document.addEventListener('mousemove', e => {
      this.mouse.vx = e.clientX - this.mouse.x;
      this.mouse.vy = e.clientY - this.mouse.y;
      this.mouse.px = this.mouse.x;
      this.mouse.py = this.mouse.y;
      this.mouse.x  = e.clientX;
      this.mouse.y  = e.clientY;
      this._spawnTrail();
    });

    document.addEventListener('click', e => {
      this._burst(e.clientX, e.clientY, 10);
    });

    document.addEventListener('mousedown', () => { this.dragging = true; });
    document.addEventListener('mouseup',   () => { this.dragging = false; });

    // Touch support
    document.addEventListener('touchmove', e => {
      const t = e.touches[0];
      this._burst(t.clientX, t.clientY, 3);
    }, { passive: true });

    this._animate();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _spawnTrail() {
    const speed = Math.hypot(this.mouse.vx, this.mouse.vy);
    const count = this.dragging ? 3 : 1;
    for (let i = 0; i < count; i++) {
      this.hearts.push({
        x    : this.mouse.x + rand(-6, 6),
        y    : this.mouse.y + rand(-6, 6),
        vx   : rand(-0.8, 0.8) + (this.dragging ? this.mouse.vx * 0.1 : 0),
        vy   : rand(-2.5, -0.5),
        size : rand(8, 18),
        a    : 1,
        orbit: this.dragging,
        hue  : randInt(320, 360)
      });
    }
  }

  _burst(x, y, count) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(2, 6);
      this.hearts.push({
        x: x, y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 3,
        size: rand(10, 22),
        a: 1,
        orbit: false,
        hue: randInt(300, 360)
      });
    }
  }

  _drawHeart(ctx, x, y, size, alpha, hue) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(size / 20, size / 20);
    ctx.fillStyle = `hsl(${hue},100%,65%)`;
    ctx.shadowColor = `hsl(${hue},100%,70%)`;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-5, -5, -10, 0, 0, 7);
    ctx.bezierCurveTo(10, 0, 5, -5, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  _animate() {
    const c = this.ctx;
    const draw = () => {
      c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.hearts = this.hearts.filter(h => h.a > 0.02);
      this.hearts.forEach(h => {
        h.x  += h.vx;
        h.y  += h.vy;
        h.vy += 0.06;  // gentle gravity
        h.a  -= 0.018;
        this._drawHeart(c, h.x, h.y, h.size, h.a, h.hue);
      });
      requestAnimationFrame(draw);
    };
    draw();
  }
}

/* ═══════════════════════════════════════════════════════
   6. NIGHT SKY — CONSTELLATION ENGINE
═══════════════════════════════════════════════════════ */

class NightSky {
  constructor() {
    this.canvas = document.getElementById('night-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.phase         = 'idle';   // idle | connect | form-name | heart | full
    this.stars         = [];
    this.shootingStars = [];
    this.label         = document.getElementById('constellation-label');
    this.timer         = null;
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start() {
    this._populateStars();
    this._animate();
    // Schedule phases
    setTimeout(() => this._startConstellation(), 3000);
  }

  _populateStars() {
    const W = this.canvas.width, H = this.canvas.height;
    this.stars = Array.from({ length: 400 }, () => ({
      x : rand(0, W), y: rand(0, H),
      r : rand(0.5, 2.5),
      a : rand(0.3, 1),
      da: rand(0.004, 0.02) * (Math.random() > .5 ? 1 : -1),
      tx: 0, ty: 0,   // target position (constellation)
      moving: false,
      connectTo: null  // index to draw line
    }));
  }

  // LISHNA dot positions (normalized 0–1 coords, scaled at runtime)
  _getLetterPoints(word) {
    const letters = {
      'L': [[0,0],[0,1],[0.4,1]],
      'I': [[0.2,0],[0.2,1]],
      'S': [[0.4,0],[0,0],[0,0.5],[0.4,0.5],[0.4,1],[0,1]],
      'H': [[0,0],[0,1],[0,0.5],[0.4,0.5],[0.4,0],[0.4,1]],
      'N': [[0,1],[0,0],[0.4,1],[0.4,0]],
      'A': [[0,1],[0.2,0],[0.4,1],[0.1,0.5],[0.3,0.5]],
      '❤': [[0.05,0.3],[0.2,0],[0.35,0.3],[0.2,0.7]],
      'T': [[0,0],[0.4,0],[0.2,0],[0.2,1]],
      'U': [[0,0],[0,0.7],[0.2,1],[0.4,0.7],[0.4,0]],
    };
    const W = this.canvas.width, H = this.canvas.height;
    const CX = W / 2, CY = H / 2;
    const letterW = 50, spacing = 60;
    const chars   = word.split('');
    const totalW  = chars.length * spacing - (spacing - letterW);
    let   startX  = CX - totalW / 2;
    const points  = [];

    chars.forEach(ch => {
      const pts = letters[ch] || [[0.2,0.5]];
      pts.forEach(p => {
        points.push({
          x: startX + p[0] * letterW,
          y: CY - 60 + p[1] * 100
        });
      });
      startX += spacing;
    });
    return points;
  }

  _startConstellation() {
    this.label.textContent = 'The stars know this name...';
    this.phase = 'connect';

    const pts = this._getLetterPoints('LISHNA');

    // Move some stars to constellation positions
    pts.forEach((pt, i) => {
      if (i < this.stars.length) {
        this.stars[i].tx     = pt.x;
        this.stars[i].ty     = pt.y;
        this.stars[i].moving = true;
        this.stars[i].r      = 2.5;
      }
    });

    setTimeout(() => {
      this.label.textContent = 'L I S H N A';
      this.label.style.fontFamily = "'Sacramento', cursive";
      this.label.style.fontSize   = '3rem';
      this.label.style.color      = '#ffe0f0';
    }, 3500);

    setTimeout(() => {
      // Transform to heart
      this.label.textContent = '❤️';
      this.label.style.fontSize = '4rem';
      const hPts = this._getLetterPoints('❤');
      hPts.forEach((pt, i) => {
        if (i < this.stars.length) {
          this.stars[i].tx = pt.x;
          this.stars[i].ty = pt.y;
        }
      });
    }, 7000);

    setTimeout(() => {
      this.label.textContent = 'S I T U  ❤️  L I S H N A';
      this.label.style.fontSize = '2rem';
      // Full name
      const fPts = this._getLetterPoints('SITUHLISHNA');
      fPts.forEach((pt, i) => {
        if (i < this.stars.length) {
          this.stars[i].tx = pt.x;
          this.stars[i].ty = pt.y;
        }
      });
    }, 11000);
  }

  _spawnShootingStar() {
    const W = this.canvas.width, H = this.canvas.height;
    this.shootingStars.push({
      x  : rand(0, W * 0.7),
      y  : rand(0, H * 0.4),
      vx : rand(5, 12),
      vy : rand(2, 6),
      len: rand(80, 180),
      a  : 1
    });
  }

  _animate() {
    const c = this.ctx;
    const draw = () => {
      const W = this.canvas.width, H = this.canvas.height;
      c.fillStyle = 'rgba(3,11,26,0.25)';
      c.fillRect(0, 0, W, H);

      // Background stars
      this.stars.forEach(s => {
        s.a += s.da;
        if (s.a > 1 || s.a < 0.2) s.da *= -1;
        if (s.moving) {
          s.x = lerp(s.x, s.tx, 0.015);
          s.y = lerp(s.y, s.ty, 0.015);
        }
        c.beginPath();
        c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        c.fillStyle = `rgba(255,245,230,${s.a})`;
        c.shadowColor = '#fffde7';
        c.shadowBlur  = s.moving ? 8 : 2;
        c.fill();
        c.shadowBlur  = 0;
      });

      // Draw constellation lines
      if (this.phase !== 'idle') {
        c.strokeStyle = 'rgba(255,200,220,0.25)';
        c.lineWidth   = 0.8;
        const moving  = this.stars.filter(s => s.moving);
        for (let i = 0; i < moving.length - 1; i++) {
          c.beginPath();
          c.moveTo(moving[i].x, moving[i].y);
          c.lineTo(moving[i+1].x, moving[i+1].y);
          c.stroke();
        }
      }

      // Shooting stars
      if (Math.random() < 0.003) this._spawnShootingStar();
      this.shootingStars = this.shootingStars.filter(s => s.a > 0.01);
      this.shootingStars.forEach(s => {
        c.save();
        const grd = c.createLinearGradient(s.x, s.y, s.x - s.len, s.y - s.len * (s.vy/s.vx));
        grd.addColorStop(0, `rgba(255,255,255,${s.a})`);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        c.strokeStyle = grd;
        c.lineWidth   = 2;
        c.beginPath();
        c.moveTo(s.x, s.y);
        c.lineTo(s.x - s.len, s.y - s.len * (s.vy / s.vx));
        c.stroke();
        c.restore();
        s.x += s.vx;
        s.y += s.vy;
        s.a -= 0.02;
      });

      requestAnimationFrame(draw);
    };
    draw();
  }
}

/* ═══════════════════════════════════════════════════════
   7. MEMORY GARDEN
═══════════════════════════════════════════════════════ */

const SHAYARIS = [
  { text: "You are the quiet little miracle\nmy heart never stopped believing in.", emoji: '🌸' },
  { text: "Every time you smile,\nyou make the whole world feel a little softer.", emoji: '💗' },
  { text: "If love had a face,\nit would look a little like your smile.", emoji: '🌼' },
  { text: "Even the stars pause every night,\nas if they're waiting to see you shine.", emoji: '⭐' },
  { text: "You bring light into places\nI never knew were dark.", emoji: '🌙' },
  { text: "Some souls are written in poetry,\nyours was written in my heartbeat.", emoji: '💌' },
  { text: "Your memories bloom inside me\nlike flowers that never fade.", emoji: '🌺' },
  { text: "Your happiness feels like sunshine,\nand your tears make my heart ache.", emoji: '😊' },
  { text: "Love doesn't need perfect words,\none glance from you says enough.", emoji: '👁️' },
  { text: "Every wish I whisper to the stars\nsomehow ends with your name.", emoji: '🤲' },
  { text: "You are the title\nof every beautiful chapter in my heart.", emoji: '📜' },
  { text: "A little garden grows inside my soul,\nand every flower carries your name.", emoji: '🌷' },
  { text: "I could spend forever\njust listening to your voice.", emoji: '👂' },
  { text: "Every sunrise reminds me of hope,\nevery sunset reminds me of you.", emoji: '🌅' },
  { text: "Wherever you are,\nthat place quietly becomes my favorite.", emoji: '🌍' },
  { text: "My heart has become a melody,\nand every note belongs to you.", emoji: '🎶' },
  { text: "Getting lost in your laughter\nis my favorite destination.", emoji: '😄' },
  { text: "If I could ask the universe for one thing,\nit would simply be your happiness.", emoji: '🤝' },
  { text: "You are the most beautiful page\nin the story my heart keeps writing.", emoji: '📖' },
  { text: "I asked the moon for one favor—\nkeep your nights full of peace.", emoji: '🌕' },
  { text: "One glimpse of you\ncan brighten an ordinary day forever.", emoji: '✨' },
  { text: "Some feelings are too beautiful for words,\nbut they always find you.", emoji: '💝' },
  { text: "Your voice carries a kind of warmth\nthat makes every worry disappear.", emoji: '🍯' },
  { text: "Life quietly became colorful\nthe moment I learned your name.", emoji: '🎨' },
  { text: "Every road feels easier\nwhen my heart is walking toward you.", emoji: '🛤️' },
  { text: "Thinking about you\nhas become my favorite little habit.", emoji: '💭' },
  { text: "You taught me that love\ncan bloom even in complete silence.", emoji: '🤐' },
  { text: "Your joy becomes my joy,\nand your pain never feels yours alone.", emoji: '🫂' },
  { text: "Every flower reminds me\nthat beauty can exist as naturally as you.", emoji: '🌻' },
  { text: "You are the brightest corner\nof the universe I call home.", emoji: '💡' },
  { text: "This little garden blossoms\nbecause every breeze carries a piece of you.", emoji: '🌸' }
];
const FLOWER_EMOJIS = ['🌸','🌺','🌹','🌷','🌼','💐','🌻','🏵️'];
const SURPRISE_TYPES = ['shayari','heart','teddy','butterfly','sticker'];

class MemoryGarden {
  constructor() {
    this.container = document.getElementById('garden-container');
    this.modal     = document.getElementById('flower-card-modal');
    this.cardContent = document.getElementById('flower-card-content');
    this.closeBtn  = document.getElementById('close-flower-card');

    this.closeBtn.addEventListener('click', () => {
      this.modal.classList.add('hidden');
    });
    this.modal.addEventListener('click', e => {
      if (e.target === this.modal) this.modal.classList.add('hidden');
    });
  }

  render() {
    this.container.innerHTML = '';
    SHAYARIS.forEach((s, i) => {
      const div  = document.createElement('div');
      div.className = 'flower';
      div.innerHTML = `
        <div class="flower-emoji">${FLOWER_EMOJIS[i % FLOWER_EMOJIS.length]}</div>
        <div class="flower-stem"></div>
      `;
      div.addEventListener('click', () => this._openCard(s, i));
      this.container.appendChild(div);
    });
  }

  _openCard(shayari, index) {
    const type = SURPRISE_TYPES[index % SURPRISE_TYPES.length];
    let html = '';

    if (type === 'shayari' || type === 'heart' || index % 2 === 0) {
      html = `<p>${shayari.text.replace(/\n/g,'<br>')}</p>
              <div style="font-size:2rem;margin-top:12px">${shayari.emoji}</div>`;
    } else if (type === 'teddy') {
      html = `<div style="font-size:4rem">🧸</div>
              <p style="margin-top:12px;font-size:1rem">A teddy hug for you 🤗</p>
              <p style="margin-top:8px">${shayari.text.replace(/\n/g,'<br>')}</p>`;
    } else if (type === 'butterfly') {
      html = `<div style="font-size:3rem;animation:float-envelope 2s ease-in-out infinite">🦋</div>
              <p style="margin-top:12px">${shayari.text.replace(/\n/g,'<br>')}</p>`;
    } else if (type === 'sticker') {
      const stickers = ['💝','💖','💗','💓','💞','💕'];
      html = `<div style="font-size:3rem">${stickers[index%stickers.length]}</div>
              <p style="margin-top:12px">${shayari.text.replace(/\n/g,'<br>')}</p>`;
    }

    this.cardContent.innerHTML = html;
    this.modal.classList.remove('hidden');
  }
}

/* ═══════════════════════════════════════════════════════
   8. GARDEN BACKGROUND (particles + grass + butterflies)
═══════════════════════════════════════════════════════ */

class GardenBackground {
  constructor() {
    this.canvas      = document.getElementById('garden-bg-canvas');
    this.ctx         = this.canvas.getContext('2d');
    this.particles   = [];
    this.butterflies = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this._populateParticles();
    this._populateButterflies();
    this._animate();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _populateParticles() {
    this.particles = Array.from({ length: 60 }, () => ({
      x : rand(0, this.canvas.width),
      y : rand(0, this.canvas.height),
      vx: rand(-0.3, 0.3),
      vy: rand(-0.5, 0),
      r : rand(1.5, 4),
      a : rand(0.2, 0.7),
      hue: randInt(100, 160)
    }));
  }

  _populateButterflies() {
    this.butterflies = Array.from({ length: 8 }, () => this._newButterfly());
  }

  _newButterfly() {
    const W = this.canvas.width, H = this.canvas.height;
    return {
      x: rand(0, W), y: rand(H * 0.1, H * 0.8),
      vx: rand(0.5, 1.5) * (Math.random() > .5 ? 1 : -1),
      vy: rand(-0.3, 0.3),
      wingAngle: 0, wingDir: 1,
      hue: randInt(280, 360),
      size: rand(12, 22)
    };
  }

  _animate() {
    const c = this.ctx;
    const draw = () => {
      const W = this.canvas.width, H = this.canvas.height;
      c.clearRect(0, 0, W, H);

      // Grass blades
      const bladeCount = Math.floor(W / 8);
      for (let i = 0; i < bladeCount; i++) {
        const bx = i * 8;
        const bh = rand(20, 60);
        const sway = Math.sin(Date.now() * 0.001 + i * 0.3) * 6;
        const g = c.createLinearGradient(bx, H, bx + sway, H - bh);
        g.addColorStop(0, 'rgba(20,80,20,0.6)');
        g.addColorStop(1, 'rgba(60,160,60,0.3)');
        c.strokeStyle = g;
        c.lineWidth   = 2;
        c.beginPath();
        c.moveTo(bx, H);
        c.quadraticCurveTo(bx + sway, H - bh * 0.6, bx + sway, H - bh);
        c.stroke();
      }

      // Floating pollen particles
      this.particles.forEach(p => {
        p.x += p.vx + Math.sin(Date.now() * 0.001 + p.y) * 0.2;
        p.y += p.vy;
        if (p.y < -10) { p.y = H + 10; p.x = rand(0, W); }
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fillStyle = `hsla(${p.hue},70%,70%,${p.a})`;
        c.fill();
      });

      // Butterflies
      this.butterflies.forEach((b, i) => {
        b.x += b.vx;
        b.y += b.vy + Math.sin(Date.now() * 0.002 + i) * 0.5;
        b.wingAngle += 0.15 * b.wingDir;
        if (b.wingAngle > 0.8 || b.wingAngle < -0.2) b.wingDir *= -1;
        if (b.x > W + 50 || b.x < -50) {
          this.butterflies[i] = this._newButterfly();
          return;
        }

        const wing = Math.abs(Math.sin(Date.now() * 0.08)) * b.size;
        c.save();
        c.translate(b.x, b.y);
        c.fillStyle = `hsla(${b.hue},90%,70%,0.7)`;

        c.beginPath();
        c.ellipse(-wing * 0.6, 0, wing, b.size * 0.7, -0.3, 0, Math.PI * 2);
        c.fill();

        c.beginPath();
        c.ellipse(wing * 0.6, 0, wing, b.size * 0.7, 0.3, 0, Math.PI * 2);
        c.fill();

        // Body
        c.fillStyle = `hsla(${b.hue - 40},60%,30%,0.9)`;
        c.beginPath();
        c.ellipse(0, 0, 2, b.size * 0.5, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });

      requestAnimationFrame(draw);
    };
    draw();
  }
}

/* ═══════════════════════════════════════════════════════
   9. FINAL SECTION PARTICLES
═══════════════════════════════════════════════════════ */

class FinalParticles {
  constructor() {
    this.canvas = document.getElementById('final-particles-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this.pts    = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this._populate();
    this._animate();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _populate() {
    this.pts = Array.from({ length: 50 }, () => ({
      x : rand(0, this.canvas.width),
      y : rand(0, this.canvas.height),
      vx: rand(-0.2, 0.2),
      vy: rand(-0.4, 0),
      r : rand(2, 5),
      a : rand(0.1, 0.5),
      hue: randInt(300, 350)
    }));
  }

  _animate() {
    const c = this.ctx;
    const draw = () => {
      const W = this.canvas.width, H = this.canvas.height;
      c.clearRect(0, 0, W, H);
      this.pts.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = H + 10; p.x = rand(0, W); }
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fillStyle = `hsla(${p.hue},90%,70%,${p.a})`;
        c.fill();
      });
      requestAnimationFrame(draw);
    };
    draw();
  }
}

/* ═══════════════════════════════════════════════════════
   10. PAGE FLIP (Letter book)
═══════════════════════════════════════════════════════ */

class LetterBook {
  constructor() {
    this.pages      = Array.from(document.querySelectorAll('.letter-page'));
    this.current    = 0;
    this.total      = this.pages.length;
    this.prevBtn    = document.getElementById('prev-page');
    this.nextBtn    = document.getElementById('next-page');
    this.indicator  = document.getElementById('page-indicator');

    this.prevBtn.addEventListener('click', () => this.goTo(this.current - 1));
    this.nextBtn.addEventListener('click', () => this.goTo(this.current + 1));

    this._render();
    this._typeCurrentPage();
  }

    goTo(idx) {
    // If we are on the last page and click "Next/Finish"
    if (idx >= this.total) {
      showSection(2); // Move to Night Sky
      return;
    }
    
    idx = clamp(idx, 0, this.total - 1);
    this.pages[this.current].classList.remove('active-page');
    this.current = idx;
    this.pages[this.current].classList.add('active-page');
    this._render();
    this._typeCurrentPage();
  }

  _render() {
    this.prevBtn.disabled = this.current === 0;
    // Keep nextBtn enabled so "Finish" can be clicked
    this.nextBtn.disabled = false; 
    this.nextBtn.textContent = this.current === this.total - 1 ? 'Finish ✨' : 'Next →';
    this.indicator.textContent = `Page ${this.current + 1} of ${this.total}`;
  }

  _typeCurrentPage() {
    const page = this.pages[this.current];
    const elements = page.querySelectorAll('.typewriter');
    elements.forEach((el, i) => {
      const full = el.getAttribute('data-text') || el.textContent;
      el.textContent = '';
      el.classList.remove('done');
      let j = 0;
      const type = () => {
        if (j <= full.length) {
          el.textContent = full.slice(0, j);
          j++;
          setTimeout(type, 30);
        } else {
          el.classList.add('done');
        }
      };
      setTimeout(type, i * 600);
    });
  }
}

/* ═══════════════════════════════════════════════════════
   11. FINAL LETTER REVEAL
═══════════════════════════════════════════════════════ */

function revealFinalLetter() {
  const lines = document.querySelectorAll('.final-line, .final-signature');
  lines.forEach((line, i) => {
    setTimeout(() => {
      line.classList.add('revealed');
    }, i * 500 + 300);
  });
}

/* ═══════════════════════════════════════════════════════
   12. SECTION NAVIGATION
═══════════════════════════════════════════════════════ */

const SECTIONS  = ['intro-scene','letter-section','night-sky-section','garden-section','final-section'];
let currentSection = 0;

const audio   = new AudioEngine();
const nightSky = new NightSky();
const garden   = new MemoryGarden();

function showSection(index, scroll = true) {
  currentSection = clamp(index, 0, SECTIONS.length - 1);
  const id = SECTIONS[currentSection];
  const el = document.getElementById(id);

  if (currentSection > 0) {
    el.classList.add('visible');
    el.classList.remove('hidden-section');
  }

  if (scroll) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Update nav dots
  document.querySelectorAll('.nav-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentSection);
  });

  // Section-specific logic
  if (id === 'night-sky-section') {
    nightSky.start();
    audio.nextTrack();
  }
  if (id === 'garden-section') {
    audio.nextTrack();
  }
  if (id === 'final-section') {
    audio.nextTrack();
    setTimeout(revealFinalLetter, 800);
  }
  if (id === 'letter-section') {
    audio.nextTrack();
  }
}

// Nav dot clicks
document.querySelectorAll('.nav-dot').forEach((dot, i) => {
  dot.addEventListener('click', () => showSection(i));
});

/* ═══════════════════════════════════════════════════════
   13. ENVELOPE OPEN ANIMATION
═══════════════════════════════════════════════════════ */

const sparkle = new SparkleBurst('sparkle-canvas');

document.getElementById('open-letter-btn').addEventListener('click', () => {
  audio.init();

  const wrapper = document.getElementById('envelope-wrapper');
  wrapper.classList.add('opening');

  // Zoom in on envelope
  wrapper.style.transition = 'transform 2s cubic-bezier(0.4,0,0.2,1)';
  wrapper.style.transform  = 'scale(1.4)';

  // Burst sparkles
  const rect = wrapper.getBoundingClientRect();
  const cx   = rect.left + rect.width  / 2;
  const cy   = rect.top  + rect.height / 2;
  setTimeout(() => sparkle.burst(cx, cy, 80), 800);
  setTimeout(() => sparkle.burst(cx, cy, 60), 1400);

  // Hearts escape from envelope
  const burst = document.getElementById('heart-burst');
  for (let i = 0; i < 14; i++) {
    setTimeout(() => {
      const h = document.createElement('div');
      h.textContent = '💗';
      h.style.cssText = `
        position:absolute;
        left:${50 + rand(-30,30)}%;
        top :${40 + rand(-10,10)}%;
        font-size:${rand(14,28)}px;
        animation: heart-float-out ${rand(1,2.5)}s ease-out forwards;
        pointer-events:none;
      `;
      burst.appendChild(h);
      setTimeout(() => h.remove(), 3000);
    }, 800 + i * 100);
  }

  // Inject keyframe if not present
  if (!document.getElementById('hfo-style')) {
    const style = document.createElement('style');
    style.id = 'hfo-style';
    style.textContent = `
      @keyframes heart-float-out {
        0%   { transform: translateY(0) scale(0.5); opacity: 1; }
        100% { transform: translateY(-150px) scale(1.2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // Transition to letter section
  setTimeout(() => {
    document.getElementById('intro-scene').style.opacity = '0';
    document.getElementById('intro-scene').style.transition = 'opacity 1s';
    setTimeout(() => {
      document.getElementById('intro-scene').style.display = 'none';
      showSection(1, false);
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1000);
  }, 3200);
});

/* ═══════════════════════════════════════════════════════
   14. ENVELOPE 3D MOUSE PARALLAX
═══════════════════════════════════════════════════════ */

document.addEventListener('mousemove', e => {
  const el = document.getElementById('envelope-3d');
  if (!el) return;
  const cx  = window.innerWidth  / 2;
  const cy  = window.innerHeight / 2;
  const dx  = (e.clientX - cx) / cx;
  const dy  = (e.clientY - cy) / cy;
  el.style.transform = `rotateY(${dx * 20}deg) rotateX(${-dy * 12}deg)`;
});

/* ═══════════════════════════════════════════════════════
   15. SECTION NEXT BUTTONS
═══════════════════════════════════════════════════════ */

document.getElementById('sky-next-btn').addEventListener('click',    () => showSection(3));
document.getElementById('garden-next-btn').addEventListener('click', () => showSection(4));

/* ═══════════════════════════════════════════════════════
   16. RESPONSE FORM SUBMISSION
═══════════════════════════════════════════════════════ */

document.getElementById('send-btn').addEventListener('click', async () => {
  const message = document.getElementById('msg-input').value.trim();
  const feeling = document.getElementById('feeling-input').value.trim();
  const errDiv  = document.getElementById('response-error');
  const succDiv = document.getElementById('response-success');

  errDiv.classList.add('hidden');

  if (message.length < 3) {
    errDiv.textContent = '💗 Please write something from your inner heart before sending.';
    errDiv.classList.remove('hidden');
    return;
  }
  if (feeling.length < 2) {
    errDiv.textContent = '🌸 Please share how you honestly feel about me.';
    errDiv.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('send-btn');
  btn.disabled     = true;
  btn.textContent  = '💌 Sending...';

  try {
    const res  = await fetch('/api/submit', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ message, feeling })
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('response-buttons').style.display = 'none';
      document.getElementById('msg-input').style.display        = 'none';
      document.getElementById('feeling-input').style.display    = 'none';
      document.querySelectorAll('#response-card label').forEach(l => l.style.display = 'none');
      succDiv.classList.remove('hidden');
      document.getElementById('success-message').textContent = data.message;

      // Burst hearts on success
      const rect = succDiv.getBoundingClientRect();
      sparkle.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 60);
    } else {
      errDiv.textContent = data.error || 'Something went wrong. Please try again.';
      errDiv.classList.remove('hidden');
      btn.disabled    = false;
      btn.textContent = '🌸 Send My Answer';
    }
  } catch (err) {
    errDiv.textContent = '🌐 Network error. Please check your connection and try again.';
    errDiv.classList.remove('hidden');
    btn.disabled    = false;
    btn.textContent = '🌸 Send My Answer';
  }
});

document.getElementById('later-btn').addEventListener('click', () => {
  const card = document.getElementById('response-card');
  card.style.opacity    = '0.6';
  card.style.transform  = 'scale(0.97)';
  const msg = document.createElement('p');
  msg.textContent = '💌 That\'s okay. The letter will always be here, whenever you\'re ready.';
  msg.style.cssText = 'font-family:var(--font-hand);color:#e8aac8;font-size:1.1rem;text-align:center;margin-top:16px;';
  card.appendChild(msg);
});

/* ═══════════════════════════════════════════════════════
   17. BOOT — INIT ALL SYSTEMS
═══════════════════════════════════════════════════════ */

window.addEventListener('DOMContentLoaded', () => {
  // Canvases
  new StarField('star-canvas');
  new Fireflies('firefly-canvas');
  new HeartCursor();

  // Letter book
  const book = new LetterBook();

  // Garden
  garden.render();
  new GardenBackground();
  new FinalParticles();

  // Mascot visibility toggles
  const mascots = document.querySelectorAll('.mascot');
  mascots.forEach(m => {
    // Show mascot relevant to current section only
    m.style.display = 'none';
  });

  // Show section-appropriate mascot when section visible
  const sectionMascotMap = {
    'letter-section'     : 'mascot-letter',
    'night-sky-section'  : 'mascot-sky',
    'garden-section'     : 'mascot-garden',
    'final-section'      : 'mascot-final'
  };

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const mascotId = sectionMascotMap[entry.target.id];
      if (mascotId) {
        const mascot = document.getElementById(mascotId);
        if (mascot) mascot.style.display = entry.isIntersecting ? 'flex' : 'none';
      }
    });
  }, { threshold: 0.3 });

  Object.keys(sectionMascotMap).forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });

  console.log('%c💌 Lishna Love Story loaded. Made with love.', 'color:#ff6abf;font-size:1.2rem;font-weight:bold;');
});

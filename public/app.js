/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   Lishna Love Story — Complete App Script (Mobile Fixed)    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ═══════════════════════════════════════════════════════
   0. UTILITY HELPERS
═══════════════════════════════════════════════════════ */

const rand     = (min, max) => Math.random() * (max - min) + min;
const randInt  = (min, max) => Math.floor(rand(min, max + 1));
const lerp     = (a, b, t) => a + (b - a) * t;
const clamp    = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ═══════════════════════════════════════════════════════
   1. AUDIO ENGINE
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
      { name: '♪ Intro Piano',      fn: () => this._playIntro()      },
      { name: '♪ Warm Orchestral',  fn: () => this._playMidSection() },
      { name: '♪ Proposal Theme',   fn: () => this._playProposal()   },
      { name: '♪ Peaceful Ending',  fn: () => this._playEnding()     }
    ];

    this.muteBtn       = document.getElementById('mute-btn');
    this.volSlider     = document.getElementById('volume-slider');
    this.nowPlaying    = document.getElementById('now-playing');
    this.vizCanvas     = document.getElementById('visualizer-canvas');
    this.vizCtx        = this.vizCanvas.getContext('2d');
    this._bindUI();
  }

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

  _playTrack(idx) {
    this.trackIndex = idx % this.tracks.length;
    this.oscillators.forEach(o => {
      try {
        o.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
        setTimeout(() => { try { o.osc.stop(); } catch(_) {} }, 1800);
      } catch(_) {}
    });
    this.oscillators = [];
    var t = this.tracks[this.trackIndex];
    this.nowPlaying.textContent = t.name;
    t.fn();
  }

  nextTrack() {
    if (!this.ctx) return;
    this._playTrack(this.trackIndex + 1);
  }

  _playIntro() {
    var notes = [261.63, 293.66, 329.63, 392.00, 440.00, 493.88, 523.25, 587.33];
    var i = 0;
    var self = this;
    var schedule = function() {
      if (!self.ctx || self.muted) return;
      self._arpNote(notes[i % notes.length] * 0.5, 0.06);
      self._arpNote(notes[i % notes.length], 0.05);
      i++;
      self._timer = setTimeout(schedule, 600);
    };
    schedule();
  }

  _playMidSection() {
    var chords = [
      [261.63, 329.63, 392.00],
      [293.66, 369.99, 440.00],
      [246.94, 311.13, 369.99],
      [261.63, 349.23, 440.00]
    ];
    var i = 0;
    var self = this;
    var schedule = function() {
      if (!self.ctx || self.muted) return;
      chords[i % chords.length].forEach(function(f) { self._arpNote(f, 0.04); });
      i++;
      self._timer = setTimeout(schedule, 1200);
    };
    schedule();
  }

  _playProposal() {
    var melody = [392, 440, 493.88, 523.25, 493.88, 440, 392, 349.23, 392];
    var i = 0;
    var self = this;
    var schedule = function() {
      if (!self.ctx || self.muted) return;
      self._arpNote(melody[i % melody.length], 0.07);
      self._arpNote(melody[i % melody.length] * 0.5, 0.03);
      i++;
      self._timer = setTimeout(schedule, 500);
    };
    schedule();
  }

  _playEnding() {
    var self = this;
    var pads = [261.63, 329.63, 392.00, 523.25];
    pads.forEach(function(f) {
      var result = self._makeOsc('sine', f, 0.025);
      result.osc.start(self.ctx.currentTime);
      var lfo = self.ctx.createOscillator();
      var lfoGain = self.ctx.createGain();
      lfo.frequency.value = 0.3;
      lfoGain.gain.value  = 2;
      lfo.connect(lfoGain);
      lfoGain.connect(result.osc.frequency);
      lfo.start();
      self.oscillators.push({ osc: lfo, gain: lfoGain });
    });
  }

  _arpNote(freq, amp) {
    var result = this._makeOsc('sine', freq, amp);
    var now = this.ctx.currentTime;
    result.gain.gain.setValueAtTime(amp, now);
    result.gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    result.osc.start(now);
    result.osc.stop(now + 2);
    this.oscillators.push(result);
  }

  _makeOsc(type, freq, amp) {
    var osc  = this.ctx.createOscillator();
    var gain = this.ctx.createGain();
    osc.type            = type;
    osc.frequency.value = freq;
    gain.gain.value     = amp;
    osc.connect(gain);
    gain.connect(this.masterGain);
    return { osc: osc, gain: gain };
  }

  _drawVisualizer() {
    var self = this;
    var draw = function() {
      requestAnimationFrame(draw);
      if (!self.analyser) return;
      var buf = new Uint8Array(self.analyser.frequencyBinCount);
      self.analyser.getByteFrequencyData(buf);
      var c = self.vizCtx;
      var W = self.vizCanvas.width  = 60;
      var H = self.vizCanvas.height = 24;
      c.clearRect(0, 0, W, H);
      var barW = W / buf.length;
      buf.forEach(function(v, i) {
        var h   = (v / 255) * H;
        var hue = 320 - i * 4;
        c.fillStyle = 'hsl(' + hue + ',90%,65%)';
        c.fillRect(i * barW, H - h, barW - 1, h);
      });
    };
    draw();
  }

  _bindUI() {
    var self = this;
    this.muteBtn.addEventListener('click', function() {
      self.muted = !self.muted;
      self.muteBtn.textContent = self.muted ? '🔇' : '🔊';
      if (self.masterGain) {
        self.masterGain.gain.setValueAtTime(
          self.muted ? 0 : self.volume,
          self.ctx.currentTime
        );
      }
    });

    this.volSlider.addEventListener('input', function() {
      self.volume = parseFloat(self.volSlider.value);
      if (self.masterGain && !self.muted) {
        self.masterGain.gain.setValueAtTime(self.volume, self.ctx.currentTime);
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
    var self = this;
    window.addEventListener('resize', function() { self.resize(); });
    this._populate();
    this._animate();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _populate() {
    var self = this;
    this.stars = Array.from({ length: 220 }, function() {
      return {
        x : rand(0, self.canvas.width),
        y : rand(0, self.canvas.height),
        r : rand(0.4, 2),
        a : rand(0.2, 1),
        da: rand(0.003, 0.012) * (Math.random() > .5 ? 1 : -1),
        speed: rand(0.02, 0.08)
      };
    });
  }

  _animate() {
    var self = this;
    var draw = function() {
      var c = self.ctx;
      var W = self.canvas.width, H = self.canvas.height;
      c.clearRect(0, 0, W, H);
      self.stars.forEach(function(s) {
        s.a += s.da;
        if (s.a > 1 || s.a < 0.1) s.da *= -1;
        c.beginPath();
        c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,245,230,' + clamp(s.a, 0, 1) + ')';
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
    var self = this;
    window.addEventListener('resize', function() { self.resize(); });
    this._populate();
    this._animate();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _populate() {
    var self = this;
    this.flies = Array.from({ length: 35 }, function() { return self._newFly(); });
  }

  _newFly(reset) {
    var W = this.canvas.width, H = this.canvas.height;
    return {
      x : reset ? -10 : rand(0, W),
      y : rand(H * 0.2, H * 0.95),
      vx: rand(0.3, 1.2),
      vy: rand(-0.4, 0.4),
      r : rand(2, 4),
      a : rand(0.4, 1),
      da: rand(0.01, 0.04) * (Math.random() > .5 ? 1 : -1),
      life: rand(80, 220),
      age: 0
    };
  }

  _animate() {
    var self = this;
    var draw = function() {
      var c = self.ctx;
      c.clearRect(0, 0, self.canvas.width, self.canvas.height);
      self.flies.forEach(function(f, i) {
        f.x   += f.vx;
        f.y   += f.vy + Math.sin(f.age * 0.04) * 0.4;
        f.age++;
        f.a   += f.da;
        if (f.a > 1 || f.a < 0.1) f.da *= -1;
        if (f.x > self.canvas.width + 20 || f.age > f.life) {
          self.flies[i] = self._newFly(true);
          return;
        }
        var grd = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 4);
        grd.addColorStop(0, 'rgba(200,255,120,' + f.a + ')');
        grd.addColorStop(1, 'rgba(200,255,120,0)');
        c.beginPath();
        c.arc(f.x, f.y, f.r * 4, 0, Math.PI * 2);
        c.fillStyle = grd;
        c.fill();
        c.beginPath();
        c.arc(f.x, f.y, f.r * 0.6, 0, Math.PI * 2);
        c.fillStyle = 'rgba(230,255,180,' + f.a + ')';
        c.fill();
      });
      requestAnimationFrame(draw);
    };
    draw();
  }
}

/* ═══════════════════════════════════════════════════════
   4. SPARKLE BURST
═══════════════════════════════════════════════════════ */

class SparkleBurst {
  constructor(canvasId) {
    this.canvas    = document.getElementById(canvasId);
    this.ctx       = this.canvas.getContext('2d');
    this.particles = [];
    this.resize();
    var self = this;
    window.addEventListener('resize', function() { self.resize(); });
    this._animate();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(cx, cy, count) {
    count = count || 60;
    for (var i = 0; i < count; i++) {
      var angle = rand(0, Math.PI * 2);
      var speed = rand(2, 9);
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(1, 4),
        r : rand(3, 8),
        a : 1,
        color: 'hsl(' + randInt(300,360) + ',100%,' + randInt(60,85) + '%)'
      });
    }
  }

  _animate() {
    var self = this;
    var draw = function() {
      var c = self.ctx;
      c.clearRect(0, 0, self.canvas.width, self.canvas.height);
      self.particles = self.particles.filter(function(p) { return p.a > 0.02; });
      self.particles.forEach(function(p) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.a  -= 0.018;
        c.globalAlpha = p.a;
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fillStyle = p.color;
        c.fill();
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
    this.mouse    = { x: -100, y: -100, vx: 0, vy: 0 };
    this.dragging = false;
    this.resize();
    var self = this;
    window.addEventListener('resize', function() { self.resize(); });

    document.addEventListener('mousemove', function(e) {
      self.mouse.vx = e.clientX - self.mouse.x;
      self.mouse.vy = e.clientY - self.mouse.y;
      self.mouse.x  = e.clientX;
      self.mouse.y  = e.clientY;
      self._spawnTrail();
    });

    document.addEventListener('click', function(e) {
      self._burst(e.clientX, e.clientY, 10);
    });

    document.addEventListener('mousedown', function() { self.dragging = true; });
    document.addEventListener('mouseup', function()   { self.dragging = false; });

    document.addEventListener('touchmove', function(e) {
      var t = e.touches[0];
      self._burst(t.clientX, t.clientY, 3);
    }, { passive: true });

    this._animate();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _spawnTrail() {
    var count = this.dragging ? 3 : 1;
    for (var i = 0; i < count; i++) {
      this.hearts.push({
        x: this.mouse.x + rand(-6, 6),
        y: this.mouse.y + rand(-6, 6),
        vx: rand(-0.8, 0.8),
        vy: rand(-2.5, -0.5),
        size: rand(8, 18),
        a: 1,
        hue: randInt(320, 360)
      });
    }
  }

  _burst(x, y, count) {
    for (var i = 0; i < count; i++) {
      var a = rand(0, Math.PI * 2);
      var s = rand(2, 6);
      this.hearts.push({
        x: x, y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 3,
        size: rand(10, 22),
        a: 1,
        hue: randInt(300, 360)
      });
    }
  }

  _drawHeart(ctx, x, y, size, alpha, hue) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(size / 20, size / 20);
    ctx.fillStyle   = 'hsl(' + hue + ',100%,65%)';
    ctx.shadowColor = 'hsl(' + hue + ',100%,70%)';
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-5, -5, -10, 0, 0, 7);
    ctx.bezierCurveTo(10, 0, 5, -5, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  _animate() {
    var self = this;
    var draw = function() {
      var c = self.ctx;
      c.clearRect(0, 0, self.canvas.width, self.canvas.height);
      self.hearts = self.hearts.filter(function(h) { return h.a > 0.02; });
      self.hearts.forEach(function(h) {
        h.x  += h.vx;
        h.y  += h.vy;
        h.vy += 0.06;
        h.a  -= 0.018;
        self._drawHeart(c, h.x, h.y, h.size, h.a, h.hue);
      });
      requestAnimationFrame(draw);
    };
    draw();
  }
}

/* ═══════════════════════════════════════════════════════
   6. NIGHT SKY — CONSTELLATION (MOBILE FIXED)
═══════════════════════════════════════════════════════ */

class NightSky {
  constructor() {
    this.canvas = document.getElementById('night-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this.resize();
    var self = this;
    window.addEventListener('resize', function() { self.resize(); });
    this.phase         = 'idle';
    this.stars         = [];
    this.shootingStars = [];
    this.label         = document.getElementById('constellation-label');
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start() {
    this._populateStars();
    this._animate();
    var self = this;
    setTimeout(function() { self._startConstellation(); }, 3000);
  }

  _populateStars() {
    var W = this.canvas.width;
    var H = this.canvas.height;
    var isMobile = W < 768;
    var count = isMobile ? 180 : 400;

    this.stars = Array.from({ length: count }, function() {
      return {
        x : rand(0, W),
        y : rand(0, H),
        r : rand(0.4, isMobile ? 1.6 : 2.5),
        a : rand(0.3, 1),
        da: rand(0.004, 0.02) * (Math.random() > .5 ? 1 : -1),
        tx: 0, ty: 0,
        moving: false,
        connectTo: null
      };
    });
  }

  _getLetterPoints(word) {
    var letters = {
      'L': [[0,0],[0,1],[0.4,1]],
      'I': [[0.2,0],[0.2,1]],
      'S': [[0.4,0],[0,0],[0,0.5],[0.4,0.5],[0.4,1],[0,1]],
      'H': [[0,0],[0,1],[0,0.5],[0.4,0.5],[0.4,0],[0.4,1]],
      'N': [[0,1],[0,0],[0.4,1],[0.4,0]],
      'A': [[0,1],[0.2,0],[0.4,1],[0.1,0.5],[0.3,0.5]],
      '❤': [[0.05,0.3],[0.2,0],[0.35,0.3],[0.2,0.7]],
      'T': [[0,0],[0.4,0],[0.2,0],[0.2,1]],
      'U': [[0,0],[0,0.7],[0.2,1],[0.4,0.7],[0.4,0]]
    };

    var W = this.canvas.width;
    var H = this.canvas.height;
    var CX = W / 2;
    var CY = H / 2;

    var isMobile = W < 768;
    var letterW  = isMobile ? 22 : 50;
    var spacing  = isMobile ? 28 : 60;
    var scaleY   = isMobile ? 45 : 100;
    var offsetY  = isMobile ? -15 : -60;

    var chars  = word.split('');
    var totalW = chars.length * spacing - (spacing - letterW);
    var startX = CX - totalW / 2;
    var points = [];

    chars.forEach(function(ch) {
      var pts = letters[ch] || [[0.2,0.5]];
      pts.forEach(function(p) {
        points.push({
          x: startX + p[0] * letterW,
          y: CY + offsetY + p[1] * scaleY
        });
      });
      startX += spacing;
    });
    return points;
  }

  _startConstellation() {
    var self = this;
    var isMobile = this.canvas.width < 768;

    this.label.textContent = isMobile
      ? '✨ watch the stars ✨'
      : 'The stars know this name...';
    this.phase = 'connect';

    var pts = this._getLetterPoints('LISHNA');

    pts.forEach(function(pt, i) {
      if (i < self.stars.length) {
        self.stars[i].tx     = pt.x;
        self.stars[i].ty     = pt.y;
        self.stars[i].moving = true;
        self.stars[i].r      = isMobile ? 1.8 : 2.5;
      }
    });

    setTimeout(function() {
      self.label.innerHTML = isMobile
        ? '✨<br>L I S H N A<br>✨'
        : 'L I S H N A';
      self.label.style.fontFamily = "'Sacramento', cursive";
      self.label.style.fontSize   = isMobile ? '1.6rem' : '3rem';
      self.label.style.color      = '#ffe0f0';
    }, 3500);

    setTimeout(function() {
      self.label.innerHTML = isMobile
        ? '<span style="font-size:2.5rem">❤️</span>'
        : '❤️';
      self.label.style.fontSize = isMobile ? '2rem' : '4rem';
      var hPts = self._getLetterPoints('❤');
      hPts.forEach(function(pt, i) {
        if (i < self.stars.length) {
          self.stars[i].tx = pt.x;
          self.stars[i].ty = pt.y;
        }
      });
    }, 7000);

    setTimeout(function() {
      if (isMobile) {
        self.label.innerHTML = '💫<br>SITU ❤️ LISHNA<br>💫';
        self.label.style.fontSize = '1.2rem';
      } else {
        self.label.textContent = 'S I T U  ❤️  L I S H N A';
        self.label.style.fontSize = '2rem';
      }
      var fPts = self._getLetterPoints('SITUHLISHNA');
      fPts.forEach(function(pt, i) {
        if (i < self.stars.length) {
          self.stars[i].tx = pt.x;
          self.stars[i].ty = pt.y;
        }
      });
    }, 11000);
  }

  _spawnShootingStar() {
    var W = this.canvas.width, H = this.canvas.height;
    this.shootingStars.push({
      x: rand(0, W * 0.7),
      y: rand(0, H * 0.4),
      vx: rand(5, 12),
      vy: rand(2, 6),
      len: rand(80, 180),
      a: 1
    });
  }

  _animate() {
    var self = this;
    var draw = function() {
      var c = self.ctx;
      var W = self.canvas.width, H = self.canvas.height;
      c.fillStyle = 'rgba(3,11,26,0.25)';
      c.fillRect(0, 0, W, H);

      self.stars.forEach(function(s) {
        s.a += s.da;
        if (s.a > 1 || s.a < 0.2) s.da *= -1;
        if (s.moving) {
          s.x = lerp(s.x, s.tx, 0.015);
          s.y = lerp(s.y, s.ty, 0.015);
        }
        c.beginPath();
        c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,245,230,' + s.a + ')';
        c.shadowColor = '#fffde7';
        c.shadowBlur  = s.moving ? 8 : 2;
        c.fill();
        c.shadowBlur  = 0;
      });

      if (self.phase !== 'idle') {
        c.strokeStyle = 'rgba(255,200,220,0.25)';
        c.lineWidth   = 0.8;
        var moving = self.stars.filter(function(s) { return s.moving; });
        for (var i = 0; i < moving.length - 1; i++) {
          c.beginPath();
          c.moveTo(moving[i].x, moving[i].y);
          c.lineTo(moving[i+1].x, moving[i+1].y);
          c.stroke();
        }
      }

      if (Math.random() < 0.003) self._spawnShootingStar();
      self.shootingStars = self.shootingStars.filter(function(s) { return s.a > 0.01; });
      self.shootingStars.forEach(function(s) {
        c.save();
        var grd = c.createLinearGradient(s.x, s.y, s.x - s.len, s.y - s.len * (s.vy/s.vx));
        grd.addColorStop(0, 'rgba(255,255,255,' + s.a + ')');
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

var FLOWER_EMOJIS = ['🌸','🌺','🌹','🌷','🌼','💐','🌻','🏵️'];

class MemoryGarden {
  constructor() {
    this.container   = document.getElementById('garden-container');
    this.modal       = document.getElementById('flower-card-modal');
    this.cardContent = document.getElementById('flower-card-content');
    this.closeBtn    = document.getElementById('close-flower-card');

    var self = this;
    this.closeBtn.addEventListener('click', function() {
      self.modal.classList.add('hidden');
    });
    this.modal.addEventListener('click', function(e) {
      if (e.target === self.modal) self.modal.classList.add('hidden');
    });
  }

  render() {
    var self = this;
    this.container.innerHTML = '';
    SHAYARIS.forEach(function(s, i) {
      var div = document.createElement('div');
      div.className = 'flower';
      div.innerHTML = '<div class="flower-emoji">' + FLOWER_EMOJIS[i % FLOWER_EMOJIS.length] + '</div><div class="flower-stem"></div>';
      div.addEventListener('click', function() { self._openCard(s, i); });
      self.container.appendChild(div);
    });
  }

  _openCard(shayari) {
    var html = '<p>' + shayari.text.replace(/\n/g,'<br>') + '</p>' +
               '<div style="font-size:2rem;margin-top:12px">' + shayari.emoji + '</div>';
    this.cardContent.innerHTML = html;
    this.modal.classList.remove('hidden');
  }
}

/* ═══════════════════════════════════════════════════════
   8. GARDEN BACKGROUND
═══════════════════════════════════════════════════════ */

class GardenBackground {
  constructor() {
    this.canvas      = document.getElementById('garden-bg-canvas');
    this.ctx         = this.canvas.getContext('2d');
    this.particles   = [];
    this.butterflies = [];
    this.resize();
    var self = this;
    window.addEventListener('resize', function() { self.resize(); });
    this._populateParticles();
    this._populateButterflies();
    this._animate();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _populateParticles() {
    var self = this;
    this.particles = Array.from({ length: 60 }, function() {
      return {
        x : rand(0, self.canvas.width),
        y : rand(0, self.canvas.height),
        vx: rand(-0.3, 0.3),
        vy: rand(-0.5, 0),
        r : rand(1.5, 4),
        a : rand(0.2, 0.7),
        hue: randInt(100, 160)
      };
    });
  }

  _populateButterflies() {
    var self = this;
    this.butterflies = Array.from({ length: 8 }, function() { return self._newButterfly(); });
  }

  _newButterfly() {
    var W = this.canvas.width, H = this.canvas.height;
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
    var self = this;
    var draw = function() {
      var c = self.ctx;
      var W = self.canvas.width, H = self.canvas.height;
      c.clearRect(0, 0, W, H);

      var bladeCount = Math.floor(W / 8);
      for (var i = 0; i < bladeCount; i++) {
        var bx = i * 8;
        var bh = rand(20, 60);
        var sway = Math.sin(Date.now() * 0.001 + i * 0.3) * 6;
        var g = c.createLinearGradient(bx, H, bx + sway, H - bh);
        g.addColorStop(0, 'rgba(20,80,20,0.6)');
        g.addColorStop(1, 'rgba(60,160,60,0.3)');
        c.strokeStyle = g;
        c.lineWidth   = 2;
        c.beginPath();
        c.moveTo(bx, H);
        c.quadraticCurveTo(bx + sway, H - bh * 0.6, bx + sway, H - bh);
        c.stroke();
      }

      self.particles.forEach(function(p) {
        p.x += p.vx + Math.sin(Date.now() * 0.001 + p.y) * 0.2;
        p.y += p.vy;
        if (p.y < -10) { p.y = H + 10; p.x = rand(0, W); }
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fillStyle = 'hsla(' + p.hue + ',70%,70%,' + p.a + ')';
        c.fill();
      });

      self.butterflies.forEach(function(b, i) {
        b.x += b.vx;
        b.y += b.vy + Math.sin(Date.now() * 0.002 + i) * 0.5;
        b.wingAngle += 0.15 * b.wingDir;
        if (b.wingAngle > 0.8 || b.wingAngle < -0.2) b.wingDir *= -1;
        if (b.x > W + 50 || b.x < -50) {
          self.butterflies[i] = self._newButterfly();
          return;
        }
        var wing = Math.abs(Math.sin(Date.now() * 0.08)) * b.size;
        c.save();
        c.translate(b.x, b.y);
        c.fillStyle = 'hsla(' + b.hue + ',90%,70%,0.7)';
        c.beginPath();
        c.ellipse(-wing * 0.6, 0, wing, b.size * 0.7, -0.3, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.ellipse(wing * 0.6, 0, wing, b.size * 0.7, 0.3, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'hsla(' + (b.hue - 40) + ',60%,30%,0.9)';
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
   9. FINAL PARTICLES
═══════════════════════════════════════════════════════ */

class FinalParticles {
  constructor() {
    this.canvas = document.getElementById('final-particles-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this.pts    = [];
    this.resize();
    var self = this;
    window.addEventListener('resize', function() { self.resize(); });
    this._populate();
    this._animate();
  }

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _populate() {
    var self = this;
    this.pts = Array.from({ length: 50 }, function() {
      return {
        x : rand(0, self.canvas.width),
        y : rand(0, self.canvas.height),
        vx: rand(-0.2, 0.2),
        vy: rand(-0.4, 0),
        r : rand(2, 5),
        a : rand(0.1, 0.5),
        hue: randInt(300, 350)
      };
    });
  }

  _animate() {
    var self = this;
    var draw = function() {
      var c = self.ctx;
      var W = self.canvas.width, H = self.canvas.height;
      c.clearRect(0, 0, W, H);
      self.pts.forEach(function(p) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = H + 10; p.x = rand(0, W); }
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fillStyle = 'hsla(' + p.hue + ',90%,70%,' + p.a + ')';
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
    this.pages   = Array.from(document.querySelectorAll('.letter-page'));
    this.current = 0;
    this.total   = this.pages.length;
    this.prevBtn = document.getElementById('prev-page');
    this.nextBtn = document.getElementById('next-page');
    this.indicator = document.getElementById('page-indicator');

    var self = this;
    this.prevBtn.addEventListener('click', function() { self.goTo(self.current - 1); });
    this.nextBtn.addEventListener('click', function() { self.goTo(self.current + 1); });
    this._render();
    this._typeCurrentPage();
  }

  goTo(idx) {
    if (idx >= this.total) {
      showSection(2);
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
    this.prevBtn.disabled      = this.current === 0;
    this.nextBtn.disabled      = false;
    this.nextBtn.textContent   = this.current === this.total - 1 ? 'Finish ✨' : 'Next →';
    this.indicator.textContent = 'Page ' + (this.current + 1) + ' of ' + this.total;
  }

  _typeCurrentPage() {
    var page = this.pages[this.current];
    var elements = page.querySelectorAll('.typewriter');
    elements.forEach(function(el, i) {
      var full = el.getAttribute('data-text') || el.textContent;
      el.textContent = '';
      el.classList.remove('done');
      var j = 0;
      var type = function() {
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
  var lines = document.querySelectorAll('.final-line, .final-signature');
  lines.forEach(function(line, i) {
    setTimeout(function() {
      line.classList.add('revealed');
    }, i * 500 + 300);
  });
}

/* ═══════════════════════════════════════════════════════
   12. SECTION NAVIGATION
═══════════════════════════════════════════════════════ */

var SECTIONS       = ['intro-scene','letter-section','night-sky-section','garden-section','final-section'];
var currentSection = 0;

var audio    = new AudioEngine();
var nightSky = new NightSky();
var garden   = new MemoryGarden();

function showSection(index, scroll) {
  if (scroll === undefined) scroll = true;
  currentSection = clamp(index, 0, SECTIONS.length - 1);
  var id = SECTIONS[currentSection];
  var el = document.getElementById(id);

  SECTIONS.forEach(function(secId, i) {
    var sectionEl = document.getElementById(secId);
    if (i <= currentSection) {
      sectionEl.classList.add('visible');
      sectionEl.classList.remove('hidden-section');
      sectionEl.style.display = 'flex';
    }
  });

  if (scroll) {
    window.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
  }

  document.querySelectorAll('.nav-dot').forEach(function(dot, i) {
    dot.classList.toggle('active', i === currentSection);
  });

  if (id === 'night-sky-section') { nightSky.start(); audio.nextTrack(); }
  if (id === 'garden-section')    { audio.nextTrack(); }
  if (id === 'final-section')     { audio.nextTrack(); setTimeout(revealFinalLetter, 800); }
  if (id === 'letter-section')    { audio.nextTrack(); }
}

document.querySelectorAll('.nav-dot').forEach(function(dot, i) {
  dot.addEventListener('click', function() { showSection(i); });
});

/* ═══════════════════════════════════════════════════════
   13. ENVELOPE OPEN ANIMATION
═══════════════════════════════════════════════════════ */

var sparkle = new SparkleBurst('sparkle-canvas');

document.getElementById('open-letter-btn').addEventListener('click', function() {
  audio.init();

  var wrapper = document.getElementById('envelope-wrapper');
  wrapper.classList.add('opening');

  wrapper.style.transition = 'transform 2s cubic-bezier(0.4,0,0.2,1)';
  wrapper.style.transform  = 'scale(1.4)';

  var rect = wrapper.getBoundingClientRect();
  var cx   = rect.left + rect.width  / 2;
  var cy   = rect.top  + rect.height / 2;
  setTimeout(function() { sparkle.burst(cx, cy, 80); }, 800);
  setTimeout(function() { sparkle.burst(cx, cy, 60); }, 1400);

  var burst = document.getElementById('heart-burst');
  for (var i = 0; i < 14; i++) {
    (function(i) {
      setTimeout(function() {
        var h = document.createElement('div');
        h.textContent = '💗';
        h.style.cssText =
          'position:absolute;' +
          'left:' + (50 + rand(-30,30)) + '%;' +
          'top:' + (40 + rand(-10,10)) + '%;' +
          'font-size:' + rand(14,28) + 'px;' +
          'animation: heart-float-out ' + rand(1,2.5) + 's ease-out forwards;' +
          'pointer-events:none;';
        burst.appendChild(h);
        setTimeout(function() { h.remove(); }, 3000);
      }, 800 + i * 100);
    })(i);
  }

  if (!document.getElementById('hfo-style')) {
    var style = document.createElement('style');
    style.id = 'hfo-style';
    style.textContent =
      '@keyframes heart-float-out {' +
      '0% { transform: translateY(0) scale(0.5); opacity: 1; }' +
      '100% { transform: translateY(-150px) scale(1.2); opacity: 0; }' +
      '}';
    document.head.appendChild(style);
  }

  setTimeout(function() {
    document.getElementById('intro-scene').style.opacity    = '0';
    document.getElementById('intro-scene').style.transition = 'opacity 1s';
    setTimeout(function() {
      document.getElementById('intro-scene').style.display = 'none';
      showSection(1, false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 1000);
  }, 3200);
});

/* ═══════════════════════════════════════════════════════
   14. ENVELOPE 3D MOUSE PARALLAX
═══════════════════════════════════════════════════════ */

document.addEventListener('mousemove', function(e) {
  var el = document.getElementById('envelope-3d');
  if (!el) return;
  var cx = window.innerWidth  / 2;
  var cy = window.innerHeight / 2;
  var dx = (e.clientX - cx) / cx;
  var dy = (e.clientY - cy) / cy;
  el.style.transform = 'rotateY(' + (dx * 20) + 'deg) rotateX(' + (-dy * 12) + 'deg)';
});

/* ═══════════════════════════════════════════════════════
   15. SECTION NEXT BUTTONS
═══════════════════════════════════════════════════════ */

document.getElementById('sky-next-btn').addEventListener('click', function() { showSection(3); });
document.getElementById('garden-next-btn').addEventListener('click', function() { showSection(4); });

/* ═══════════════════════════════════════════════════════
   16. RESPONSE FORM SUBMISSION
═══════════════════════════════════════════════════════ */

document.getElementById('send-btn').addEventListener('click', async function() {
  var message = document.getElementById('msg-input').value.trim();
  var feeling = document.getElementById('feeling-input').value.trim();
  var errDiv  = document.getElementById('response-error');
  var succDiv = document.getElementById('response-success');

  errDiv.classList.add('hidden');

  if (message.length < 3) {
    errDiv.textContent = '💗 Please write something in your heart before sending.';
    errDiv.classList.remove('hidden');
    return;
  }
  if (feeling.length < 2) {
    errDiv.textContent = '🌸 Please share how you honestly feel.';
    errDiv.classList.remove('hidden');
    return;
  }

  var btn = document.getElementById('send-btn');
  btn.disabled    = true;
  btn.textContent = '💌 Sending...';

  try {
    var res = await fetch('/api/submit', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ message: message, feeling: feeling })
    });
    var data = await res.json();

    if (data.success) {
      document.getElementById('response-buttons').style.display = 'none';
      document.getElementById('msg-input').style.display        = 'none';
      document.getElementById('feeling-input').style.display    = 'none';
      document.querySelectorAll('#response-card label').forEach(function(l) { l.style.display = 'none'; });
      succDiv.classList.remove('hidden');
      document.getElementById('success-message').textContent = data.message;
      var rect = succDiv.getBoundingClientRect();
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

document.getElementById('later-btn').addEventListener('click', function() {
  var card = document.getElementById('response-card');
  card.style.opacity   = '0.6';
  card.style.transform = 'scale(0.97)';
  var msg = document.createElement('p');
  msg.textContent = '💌 That\'s okay. The letter will always be here, whenever you\'re ready.';
  msg.style.cssText = 'font-family:var(--font-hand);color:#e8aac8;font-size:1.1rem;text-align:center;margin-top:16px;';
  card.appendChild(msg);
});

/* ═══════════════════════════════════════════════════════
   17. BOOT — INIT ALL SYSTEMS
═══════════════════════════════════════════════════════ */

window.addEventListener('DOMContentLoaded', function() {
  new StarField('star-canvas');
  new Fireflies('firefly-canvas');
  new HeartCursor();

  var book = new LetterBook();

  garden.render();
  new GardenBackground();
  new FinalParticles();

  var mascots = document.querySelectorAll('.mascot');
  mascots.forEach(function(m) { m.style.display = 'none'; });

  var sectionMascotMap = {
    'letter-section'    : 'mascot-letter',
    'night-sky-section' : 'mascot-sky',
    'garden-section'    : 'mascot-garden',
    'final-section'     : 'mascot-final'
  };

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      var mascotId = sectionMascotMap[entry.target.id];
      if (mascotId) {
        var mascot = document.getElementById(mascotId);
        if (mascot) mascot.style.display = entry.isIntersecting ? 'flex' : 'none';
      }
    });
  }, { threshold: 0.3 });

  Object.keys(sectionMascotMap).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) observer.observe(el);
  });

  console.log('%c💌 Lishna Love Story loaded. Made with love.', 'color:#ff6abf;font-size:1.2rem;font-weight:bold;');
});

// 音效 + 背景音乐：全部用 WebAudio 现场合成，没有音频文件、没有版权问题。
(function (root) {
  let ctx = null, master = null, sfxBus = null, musicBus = null, rainNode = null;
  let muted = false;
  try { muted = localStorage.getItem('fishing.muted') === '1'; } catch (e) { /* ignore */ }

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
    return ctx;
  }

  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  // 一个音：频率 f（可滑到 f2），时长 dur，波形 type，音量 vol，延迟 at
  function tone(f, dur, { type = 'sine', vol = 0.3, at = 0, f2 = null, bus = sfxBus, attack = 0.005 } = {}) {
    if (!ensure()) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }

  function hiss(dur, { at = 0, vol = 0.3, freq = 1200, f2 = null, q = 0.8, type = 'bandpass' } = {}) {
    if (!ensure()) return;
    const t = ctx.currentTime + at;
    const s = ctx.createBufferSource(); s.buffer = noise();
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.05);
  }

  const SFX = {
    click() { tone(880, 0.06, { type: 'triangle', vol: 0.15 }); },
    charge() { tone(300, 0.05, { type: 'triangle', vol: 0.05 }); },
    cast() { hiss(0.35, { freq: 600, f2: 3000, vol: 0.25 }); },
    splash() { hiss(0.45, { freq: 900, f2: 300, vol: 0.35, type: 'lowpass', q: 0.5 }); tone(220, 0.15, { vol: 0.1, f2: 120 }); },
    bite() { tone(1200, 0.08, { type: 'square', vol: 0.12 }); tone(1500, 0.1, { type: 'square', vol: 0.12, at: 0.1 }); },
    reel() { tone(1800 + Math.random() * 300, 0.025, { type: 'square', vol: 0.04 }); },
    jerk() { hiss(0.15, { freq: 400, vol: 0.2 }); },
    snap() { hiss(0.2, { freq: 3000, vol: 0.4, q: 2 }); tone(700, 0.4, { type: 'sawtooth', vol: 0.12, f2: 90 }); },
    escape() { [523, 440, 349].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.15, at: i * 0.12 })); },
    catch() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.2, at: i * 0.08 })); },
    rare() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.4, { vol: 0.15, at: i * 0.07 })); },
    exotic() { [523, 784, 1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.6, { vol: 0.14, at: i * 0.09 })); hiss(1.2, { freq: 6000, vol: 0.05, q: 3 }); },
    monster() {
      tone(55, 1.6, { type: 'sawtooth', vol: 0.35, f2: 38, attack: 0.15 });
      tone(82, 1.2, { type: 'square', vol: 0.12, f2: 60, at: 0.1, attack: 0.2 });
      hiss(1.4, { freq: 200, vol: 0.35, type: 'lowpass', q: 1 });
    },
    fairy() {
      [1046, 1318, 1568, 2093, 1568, 2637].forEach((f, i) => { tone(f, 1.0, { vol: 0.12, at: i * 0.13 }); tone(f * 2, 0.6, { vol: 0.03, at: i * 0.13 }); });
    },
    achievement() { [659, 784, 988, 1318].forEach((f, i) => tone(f, 0.3, { type: 'square', vol: 0.08, at: i * 0.1 })); tone(1318, 0.8, { type: 'triangle', vol: 0.15, at: 0.4 }); },
  };

  // ---------- 雨声 ----------
  function setRain(on) {
    if (!ensure()) return;
    if (on && !rainNode) {
      const s = ctx.createBufferSource(); s.buffer = noise(); s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1400; fl.Q.value = 0.4;
      const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 1.5);
      s.connect(fl); fl.connect(g); g.connect(master); s.start();
      rainNode = { s, g };
    } else if (!on && rainNode) {
      const { s, g } = rainNode; rainNode = null;
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1); s.stop(ctx.currentTime + 1.1);
    }
  }

  // ---------- 背景音乐：按季节换调式和速度的生成式小曲 ----------
  const MUSIC = {
    spring: { root: 261.63, scale: [0, 2, 4, 7, 9], bpm: 96, wave: 'triangle' },     // C 大调五声，轻快
    summer: { root: 293.66, scale: [0, 2, 4, 7, 9], bpm: 112, wave: 'square' },      // D 大调五声，活泼
    autumn: { root: 220.00, scale: [0, 3, 5, 7, 10], bpm: 84, wave: 'triangle' },    // A 小调五声，温暖
    winter: { root: 329.63, scale: [0, 3, 5, 7, 10], bpm: 70, wave: 'sine' },        // E 小调五声，空灵
  };
  let music = null;
  function note(cfg, deg, oct) {
    const n = cfg.scale.length, i = ((deg % n) + n) % n, o = Math.floor(deg / n) + oct;
    return cfg.root * Math.pow(2, (cfg.scale[i] + 12 * o) / 12);
  }
  function startMusic(season) {
    if (!ensure()) return;
    stopMusic();
    const cfg = MUSIC[season] || MUSIC.spring;
    const beat = 60 / cfg.bpm / 2; // 八分音符
    let step = 0, deg = 2, next = ctx.currentTime + 0.1;
    const timer = setInterval(() => {
      while (next < ctx.currentTime + 0.3) {
        const at = next - ctx.currentTime;
        if (step % 8 === 0) { // 每小节一个低音
          const bassDeg = [0, 3, 4, 2][Math.floor(step / 8) % 4];
          tone(note(cfg, bassDeg, -1), beat * 7, { type: 'sine', vol: 0.35, at, bus: musicBus, attack: 0.02 });
        }
        if (Math.random() < (season === 'winter' ? 0.45 : 0.7)) { // 旋律：随机游走
          deg += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
          deg = Math.max(0, Math.min(9, deg));
          tone(note(cfg, deg, 0), beat * 1.6, { type: cfg.wave, vol: cfg.wave === 'square' ? 0.08 : 0.18, at, bus: musicBus, attack: 0.01 });
        }
        step++; next += beat;
      }
    }, 100);
    music = { timer };
  }
  function stopMusic() { if (music) { clearInterval(music.timer); music = null; } }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('fishing.muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
  }

  root.GameAudio = {
    unlock: ensure,
    play(name) { try { if (!muted && SFX[name]) SFX[name](); } catch (e) { /* 音频失败不影响游戏 */ } },
    setRain, startMusic, stopMusic, setMuted,
    isMuted: () => muted,
  };
})(window);

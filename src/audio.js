// 音效 + 背景音乐：全部用 WebAudio 现场合成，没有音频文件、没有版权问题。
(function (root) {
  let ctx = null, master = null, sfxBus = null, musicBus = null, rainNode = null;
  let muted = false;
  try { muted = localStorage.getItem('fishing.muted') === '1'; } catch (e) { /* ignore */ }

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended' && !document.hidden) ctx.resume(); return ctx; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
    return ctx;
  }

  // 切到别的分页 / 切到后台 / 锁屏：整个音频暂停（音乐、雨声、音效都停），回来再接着播
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
  root.addEventListener('pagehide', () => { if (ctx) ctx.suspend(); });

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
      // 以前是 1400Hz 带通、音量 0.09：沙沙声正好压在旋律的频段，盖过背景音乐
      // 现在去掉刺耳的高频、只留低沉的雨幕，音量降到约 1/3，再加一点慢慢起伏，听起来更像远处的雨
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; fl.Q.value = 0.3;
      const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.03, ctx.currentTime + 2);
      const lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = 0.13; depth.gain.value = 0.008;
      lfo.connect(depth); depth.connect(g.gain); lfo.start();
      s.connect(hp); hp.connect(fl); fl.connect(g); g.connect(master); s.start();
      rainNode = { s, g, lfo };
    } else if (!on && rainNode) {
      const { s, g, lfo } = rainNode; rainNode = null;
      g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1); s.stop(ctx.currentTime + 1.1); lfo.stop(ctx.currentTime + 1.1);
    }
  }

  // ---------- 背景音乐：四季各一首固定旋律的循环曲（8 小节 × 8 个八分音符）----------
  // 旋律写法：[MIDI 音高 或 null(休止), 时值(八分音符个数)]，每小节加起来 = 8。和弦：每小节 1–2 个 [根音 MIDI, 'M'|'m']。
  const SONGS = {
    spring: { // C 大调，柔和笛声 + 四分音符分解和弦，摇篮曲式级进
      bpm: 84, lead: 'softflute', comp: 'broken', perc: null, soft: true, lp: 1300, wet: 0.3,
      chords: [[[60, 'M']], [[57, 'm']], [[53, 'M']], [[55, 'M']], [[60, 'M']], [[57, 'm']], [[50, 'm'], [55, 'M']], [[60, 'M']]],
      melody: [[76, 3], [74, 1], [72, 2], [74, 2], [76, 4], [69, 2], [72, 2], [77, 3], [76, 1], [74, 2], [72, 2], [74, 6], [null, 2],
        [76, 3], [77, 1], [79, 2], [76, 2], [81, 3], [79, 1], [76, 2], [72, 2], [74, 2], [77, 2], [76, 2], [74, 2], [72, 6], [null, 2]],
    },
    summer: { // F 大调，木琴 + 反拍和弦 + 沙锤，带切分
      bpm: 112, lead: 'marimba', comp: 'offbeat', perc: 'shaker',
      chords: [[[53, 'M']], [[50, 'm']], [[58, 'M']], [[60, 'M']], [[53, 'M']], [[50, 'm']], [[58, 'M'], [60, 'M']], [[53, 'M']]],
      melody: [[69, 1], [72, 1], [77, 2], [81, 1], [79, 1], [77, 2], [74, 2], [77, 1], [81, 1], [null, 1], [81, 1], [79, 2], [77, 1], [79, 1], [82, 2], [81, 2], [79, 2],
        [76, 2], [79, 2], [84, 3], [null, 1], [81, 1], [81, 1], [84, 2], [81, 1], [79, 1], [77, 2], [77, 2], [81, 2], [86, 3], [84, 1], [82, 2], [81, 2], [79, 2], [76, 2], [77, 6], [null, 2]],
    },
    autumn: { // A 小调，温暖长音 + 稀疏琶音
      bpm: 72, lead: 'warm', comp: 'arp', perc: null, soft: true, lp: 1300, wet: 0.3,
      chords: [[[57, 'm']], [[53, 'M']], [[60, 'M']], [[55, 'M']], [[57, 'm']], [[50, 'm']], [[52, 'M']], [[57, 'm']]],
      melody: [[72, 2], [71, 2], [69, 4], [69, 2], [72, 2], [77, 4], [76, 3], [74, 1], [72, 2], [76, 2], [74, 6], [null, 2],
        [72, 2], [74, 2], [76, 4], [77, 3], [76, 1], [74, 4], [71, 2], [74, 2], [72, 2], [71, 2], [69, 6], [null, 2]],
    },
    winter: { // D 大调 I–IV–V，钟琴跳音 + 摇摆节奏 + 嘭恰低音 + 拍手 + 雪橇铃，热闹的冬天
      bpm: 132, swing: 0.22, lead: 'glock', comp: 'offbeat', perc: 'sleigh', bounceBass: true, soft: true, lp: 7000, wet: 0.12,
      chords: [[[62, 'M']], [[55, 'M']], [[57, 'M']], [[62, 'M']], [[62, 'M']], [[55, 'M']], [[57, 'M']], [[62, 'M']]],
      melody: [[81, 1], [81, 1], [78, 1], [81, 1], [86, 2], [81, 2], [83, 1], [83, 1], [79, 1], [83, 1], [86, 2], [83, 2],
        [85, 1], [86, 1], [88, 1], [85, 1], [81, 2], [88, 2], [90, 2], [88, 1], [86, 1], [81, 2], [null, 2],
        [86, 1], [88, 1], [90, 1], [86, 1], [81, 1], [78, 1], [81, 2], [79, 1], [83, 1], [86, 1], [91, 1], [90, 2], [88, 2],
        [88, 1], [90, 1], [88, 1], [85, 1], [81, 1], [83, 1], [85, 2], [86, 2], [81, 1], [78, 1], [86, 2], [null, 2]],
    },
    // —— 圣诞场：三首公有领域颂歌轮流播放（startMusic('xmas') 会按 PLAYLISTS.xmas 依次播）——
    xmas_jingle: { // 《Jingle Bells》副歌（1857），G 大调 16 小节：钟琴 + 嘭恰低音 + 雪橇铃
      bpm: 120, lead: 'glock', comp: 'offbeat', perc: 'sleigh', bounceBass: true, soft: true, lp: 7500, wet: 0.14, alwaysLead: true, times: 2,
      chords: [[[55, 'M']], [[55, 'M']], [[55, 'M']], [[55, 'M']], [[60, 'M']], [[55, 'M']], [[57, 'M']], [[62, 'M']],
        [[55, 'M']], [[55, 'M']], [[55, 'M']], [[55, 'M']], [[60, 'M']], [[55, 'M']], [[62, 'M']], [[55, 'M']]],
      melody: [[83, 2], [83, 2], [83, 4], [83, 2], [83, 2], [83, 4], [83, 2], [86, 2], [79, 3], [81, 1], [83, 8],
        [84, 2], [84, 2], [84, 3], [84, 1], [84, 2], [83, 2], [83, 2], [83, 1], [83, 1], [83, 2], [81, 2], [81, 2], [83, 2], [81, 4], [86, 4],
        [83, 2], [83, 2], [83, 4], [83, 2], [83, 2], [83, 4], [83, 2], [86, 2], [79, 3], [81, 1], [83, 8],
        [84, 2], [84, 2], [84, 3], [84, 1], [84, 2], [83, 2], [83, 2], [83, 1], [83, 1], [86, 2], [86, 2], [84, 2], [81, 2], [79, 8]],
    },
    xmas_deck: { // 《Deck the Halls》（威尔士传统曲），G 大调 16 小节：八音盒 + 合唱垫音 + 雪橇铃
      bpm: 112, lead: 'musicbox', comp: 'pad', perc: 'sleigh', soft: true, lp: 6500, wet: 0.24, alwaysLead: true, times: 2,
      chords: [[[55, 'M']], [[55, 'M']], [[60, 'M']], [[62, 'M'], [55, 'M']], [[55, 'M']], [[55, 'M']], [[60, 'M']], [[62, 'M'], [55, 'M']],
        [[62, 'M']], [[55, 'M']], [[57, 'M']], [[62, 'M']], [[55, 'M']], [[55, 'M']], [[60, 'M']], [[62, 'M'], [55, 'M']]],
      melody: [[86, 3], [84, 1], [83, 2], [81, 2], [79, 2], [81, 2], [83, 2], [79, 2], [81, 1], [83, 1], [84, 1], [81, 1], [83, 3], [81, 1], [79, 2], [78, 2], [79, 4],
        [86, 3], [84, 1], [83, 2], [81, 2], [79, 2], [81, 2], [83, 2], [79, 2], [81, 1], [83, 1], [84, 1], [81, 1], [83, 3], [81, 1], [79, 2], [78, 2], [79, 4],
        [81, 3], [83, 1], [84, 2], [81, 2], [83, 3], [84, 1], [86, 2], [81, 2], [83, 1], [85, 1], [86, 2], [88, 1], [90, 1], [91, 2], [90, 2], [88, 2], [86, 4],
        [86, 3], [84, 1], [83, 2], [81, 2], [79, 2], [81, 2], [83, 2], [79, 2], [81, 1], [83, 1], [84, 1], [81, 1], [83, 3], [81, 1], [79, 2], [78, 2], [79, 4]],
    },
    xmas_wish: { // 《We Wish You a Merry Christmas》（英国传统曲），G 大调 3/4 拍：钟声旋律 + 华尔兹伴奏
      bpm: 132, bar: 6, lead: 'bell', comp: 'waltz', perc: 'sleigh', soft: true, lp: 7000, wet: 0.2, alwaysLead: true, times: 3,
      chords: [[[62, 'M']], [[55, 'M']], [[60, 'M']], [[57, 'M']], [[62, 'M']], [[59, 'M']], [[52, 'm']], [[60, 'M'], [62, 'M']], [[55, 'M']]],
      melody: [[null, 4], [74, 2], [79, 2], [79, 1], [81, 1], [79, 1], [78, 1], [76, 2], [76, 2], [76, 2], [81, 2], [81, 1], [83, 1], [81, 1], [79, 1],
        [78, 2], [74, 2], [74, 2], [83, 2], [83, 1], [84, 1], [83, 1], [81, 1], [79, 2], [76, 2], [74, 1], [74, 1], [76, 2], [81, 2], [78, 2], [79, 4], [null, 2]],
    },
    // —— 感恩节场：三首公有领域的感恩节歌曲轮流播放 ——
    // 旋律照着公开乐谱逐音输入：Simple Gifts 取自 IMSLP 的 Brackett 谱（维基共享资源），
    // We Gather Together（KREMSER）、Now Thank We All Our God（Nun danket alle Gott）取自维基共享资源的 MIDI
    thanks_gifts: { // 《Simple Gifts》（震颤派民歌，1848），F 大调 4/4：柔和笛声 + 分解和弦
      bpm: 92, lead: 'softflute', comp: 'broken', perc: null, soft: true, lp: 2400, wet: 0.26, alwaysLead: true, times: 2,
      chords: [[[48, 'M']], [[53, 'M'], [58, 'M']], [[53, 'M'], [48, 'M']], [[55, 'm']], [[48, 'M']], [[53, 'M'], [50, 'm']], [[53, 'M'], [58, 'M']], [[55, 'm'], [48, 'M']], [[48, 'M'], [53, 'M']],
        [[53, 'M']], [[53, 'M'], [50, 'm']], [[50, 'm'], [53, 'M']], [[48, 'M']], [[53, 'M']], [[53, 'M'], [50, 'm']], [[55, 'm'], [48, 'M']], [[53, 'M']]],
      melody: [[null, 4], [72, 2], [72, 2],
        [77, 2], [77, 1], [79, 1], [81, 1], [77, 1], [81, 1], [82, 1], [84, 2], [84, 1], [82, 1], [81, 2], [79, 1], [77, 1],
        [79, 2], [79, 2], [79, 2], [77, 2], [79, 1], [81, 1], [79, 1], [76, 1], [72, 2], [72, 2],
        [77, 1], [76, 1], [77, 1], [79, 1], [81, 2], [79, 1], [79, 1], [81, 2], [82, 2], [84, 3], [84, 1],
        [79, 2], [79, 1], [81, 1], [79, 2], [77, 1], [77, 1], [79, 2], [77, 1], [76, 1], [77, 4],
        [84, 4], [81, 3], [79, 1], [81, 1], [82, 1], [81, 1], [79, 1], [77, 3], [79, 1],
        [81, 2], [81, 1], [82, 1], [84, 2], [81, 2], [79, 2], [79, 1], [81, 1], [79, 3], [72, 1],
        [77, 4], [77, 3], [79, 1], [81, 2], [81, 1], [82, 1], [84, 2], [84, 1], [84, 1],
        [79, 2], [79, 2], [81, 2], [81, 1], [79, 1], [77, 2], [77, 2], [77, 4]],
    },
    thanks_gather: { // 《We Gather Together》（荷兰民歌 1626，Kremser 1877 编），C 大调 3/4：暖音 + 华尔兹伴奏
      bpm: 100, bar: 6, lead: 'warm', comp: 'waltz', perc: null, soft: true, lp: 2600, wet: 0.24, alwaysLead: true, times: 2,
      chords: [[[48, 'M']], [[48, 'M']], [[45, 'm']], [[50, 'm'], [55, 'M']], [[48, 'M']], [[52, 'm'], [55, 'M']], [[48, 'M'], [55, 'M']], [[50, 'M']], [[55, 'M']],
        [[55, 'M']], [[48, 'M']], [[55, 'M']], [[45, 'm'], [53, 'M']], [[53, 'M'], [50, 'm']], [[48, 'M']], [[50, 'm'], [55, 'M']], [[48, 'M']]],
      melody: [[null, 4], [79, 2],
        [79, 3], [81, 1], [79, 2], [76, 3], [77, 1], [79, 2], [77, 3], [76, 1], [74, 2], [76, 2], [72, 2], [79, 2],
        [79, 3], [81, 1], [83, 2], [84, 3], [86, 1], [83, 2], [81, 3], [79, 1], [81, 2], [79, 4], [79, 2],
        [79, 3], [81, 1], [83, 2], [84, 4], [79, 2], [79, 3], [81, 1], [77, 1], [79, 1], [76, 2], [72, 2], [77, 2],
        [77, 3], [79, 1], [81, 1], [77, 1], [79, 3], [77, 1], [76, 2], [77, 2], [74, 4], [72, 6]],
    },
    thanks_thank: { // 《Now Thank We All Our God》（Nun danket alle Gott，1647），降 E 大调 4/4：柔和笛声 + 合唱垫音
      bpm: 84, lead: 'softflute', comp: 'pad', perc: null, soft: true, lp: 2200, wet: 0.3, alwaysLead: true, times: 1,
      chords: [[[51, 'M'], [56, 'M']], [[53, 'm'], [58, 'M']], [[51, 'M'], [58, 'M']], [[56, 'M'], [58, 'M']],
        [[51, 'M'], [56, 'M']], [[53, 'm'], [58, 'M']], [[51, 'M'], [58, 'M']], [[56, 'M'], [58, 'M']],
        [[58, 'M']], [[48, 'm'], [53, 'M']], [[58, 'M'], [51, 'M']], [[53, 'M'], [58, 'M']],
        [[51, 'M'], [53, 'm']], [[51, 'M'], [56, 'M']], [[51, 'M'], [58, 'M']], [[58, 'M'], [51, 'M']]],
      melody: [[82, 2], [82, 2], [82, 2], [84, 2], [84, 2], [82, 6], [79, 2], [80, 2], [79, 2], [77, 2], [79, 2], [77, 4], [75, 2],
        [82, 2], [82, 2], [82, 2], [84, 2], [84, 2], [82, 6], [79, 2], [80, 2], [79, 2], [77, 2], [79, 2], [77, 4], [75, 2],
        [77, 2], [77, 2], [77, 2], [79, 2], [79, 2], [77, 6], [77, 2], [79, 2], [82, 2], [82, 2], [81, 2], [82, 6],
        [82, 2], [84, 2], [82, 2], [80, 2], [79, 2], [80, 6], [79, 2], [77, 2], [79, 2], [77, 2], [77, 2], [75, 6]],
    },
  };
  const PLAYLISTS = { xmas: ['xmas_jingle', 'xmas_deck', 'xmas_wish'], thanks: ['thanks_gifts', 'thanks_gather', 'thanks_thank'] };
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  const triad = (root, q) => [root, root + (q === 'm' ? 3 : 4), root + 7];

  function instrument(kind, midi, dur, at, vol) {
    const f = mf(midi), o = { at, bus: mbus };
    if (kind === 'softflute') { tone(f, dur * 1.3, Object.assign({ type: 'sine', vol: vol * 0.85, attack: 0.16 }, o)); tone(f / 2, dur * 1.2, Object.assign({ type: 'sine', vol: vol * 0.12, attack: 0.2 }, o)); }
    else if (kind === 'warm') { tone(f, dur + 0.6, Object.assign({ type: 'sine', vol: vol * 0.85, attack: 0.1 }, o)); tone(f / 2, dur + 0.4, Object.assign({ type: 'sine', vol: vol * 0.15, attack: 0.14 }, o)); }
    else if (kind === 'glock') { tone(f, 0.9, Object.assign({ type: 'sine', vol: vol, attack: 0.003 }, o)); tone(f * 4, 0.25, Object.assign({ type: 'sine', vol: vol * 0.12, attack: 0.002 }, o)); tone(f * 2, 0.4, Object.assign({ type: 'triangle', vol: vol * 0.08, attack: 0.003 }, o)); }
    else if (kind === 'flute') { tone(f, dur, Object.assign({ type: 'triangle', vol: vol, attack: 0.04 }, o)); tone(f * 2, dur * 0.8, Object.assign({ type: 'sine', vol: vol * 0.15, attack: 0.05 }, o)); }
    else if (kind === 'marimba') { tone(f, Math.min(dur, 0.45), Object.assign({ type: 'sine', vol: vol, attack: 0.003 }, o)); tone(f * 4, 0.08, Object.assign({ type: 'sine', vol: vol * 0.25, attack: 0.002 }, o)); }
    else if (kind === 'pluck') { tone(f, Math.min(dur + 0.3, 1.1), Object.assign({ type: 'triangle', vol: vol, attack: 0.004 }, o)); tone(f * 2, 0.25, Object.assign({ type: 'sine', vol: vol * 0.2, attack: 0.003 }, o)); }
    else if (kind === 'bell') { // 教堂钟：非整数倍泛音，余音长
      tone(f, 2.4, Object.assign({ type: 'sine', vol: vol, attack: 0.002 }, o)); tone(f * 2.76, 1.2, Object.assign({ type: 'sine', vol: vol * 0.22, attack: 0.002 }, o));
      tone(f * 5.4, 0.5, Object.assign({ type: 'sine', vol: vol * 0.08, attack: 0.002 }, o)); tone(f / 2, 2.6, Object.assign({ type: 'sine', vol: vol * 0.18, attack: 0.004 }, o));
    }
    else if (kind === 'musicbox') { tone(f, 2.2, Object.assign({ type: 'sine', vol: vol, attack: 0.006 }, o)); tone(f * 2, 0.9, Object.assign({ type: 'sine', vol: vol * 0.07, attack: 0.006 }, o)); }
    else tone(f, dur, Object.assign({ type: 'sine', vol: vol, attack: 0.02 }, o));
  }

  // 把歌展开成「第几个八分音符 → 要播的音」
  function compile(song) {
    const bar = song.bar || 8, ev = Array.from({ length: song.chords.length * bar }, () => []); // 曲长 = 小节数 × 每小节八分音符数（4/4 = 8，3/4 = 6）
    let t = 0;
    song.melody.forEach(([m, len]) => { if (m != null) ev[t].push({ part: 'lead', m, len }); t += len; });
    song.chords.forEach((bar, b) => bar.forEach(([root, q], half) => {
      const span = (song.bar || 8) / bar.length, s0 = b * (song.bar || 8) + half * span, n = triad(root, q);
      ev[s0].push({ part: 'bass', m: root - 12, len: span });
      for (let k = 0; k < span; k++) ev[s0 + k].push({ part: 'comp', notes: n, k, span });
    }));
    return ev;
  }

  // 柔和处理：低通削高频 + 一点回声，给春 / 秋 / 冬用
  let softBus = null, softWet = null, mbus = null;
  function getSoftBus() {
    if (softBus) return softBus;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 0.5;
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.34;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    lp.connect(musicBus); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(musicBus);
    softBus = lp; softWet = wet; return softBus;
  }

  let music = null;
  function startMusic(season) {
    if (!ensure()) return;
    stopMusic();
    const list = PLAYLISTS[season] || [season]; // 歌单：每首播 times 遍后换下一首，中间敲一声钟
    let idx = 0, song, ev, eighth;
    const load = () => {
      song = SONGS[list[idx % list.length]] || SONGS.spring; ev = compile(song); eighth = 60 / song.bpm / 2;
      mbus = song.soft ? getSoftBus() : musicBus;
      if (song.soft) { softBus.frequency.setValueAtTime(song.lp || 2000, ctx.currentTime); softWet.gain.setValueAtTime(song.wet == null ? 0.22 : song.wet, ctx.currentTime); }
    };
    load();
    let step = 0, loop = 0, next = ctx.currentTime + 0.15;
    const timer = setInterval(() => {
      while (next < ctx.currentTime + 0.3) {
        const at = next - ctx.currentTime + (song.swing && step % 2 ? song.swing * eighth : 0), restLoop = !song.alwaysLead && loop % 3 === 2; // 每 3 遍有 1 遍只留伴奏；swing = 后半拍稍拖
        ev[step].forEach(e => {
          if (e.part === 'lead' && !restLoop) instrument(song.lead, e.m, e.len * eighth * 0.95, at, song.lead === 'musicbox' ? 0.22 : 0.2);
          else if (e.part === 'bass' && !song.bounceBass) tone(mf(e.m), Math.min(e.len * eighth, 1.6), { type: 'sine', vol: song.soft ? 0.16 : 0.3, at, bus: mbus, attack: song.soft ? 0.12 : 0.02 });
          else if (e.part === 'comp') {
            const [a, b, c] = e.notes;
            if (song.bounceBass && e.k % 2 === 0) tone(mf(((e.k / 2) % 2 === 0 ? a : c) - 12), eighth * 0.9, { type: 'triangle', vol: 0.24, at, bus: mbus, attack: 0.004 });
            if (song.comp === 'broken') { if (e.k % 2 === 0) { const seq = [a, c, b + 12, c]; tone(mf(seq[(e.k / 2) % 4] + 12), eighth * 3, { type: 'sine', vol: 0.035, at, bus: mbus, attack: 0.06 }); } }
            else if (song.comp === 'arp') { if (e.k % 2 === 0) { const seq = [a, c, a + 12, c]; instrument('warm', seq[(e.k / 2) % 4], eighth * 1.5, at, 0.035); } }
            else if (song.comp === 'offbeat') { if (e.k % 2 === 1) [a, b, c].forEach(m => tone(mf(m + 12), eighth * 0.6, { type: song.soft ? 'sine' : 'triangle', vol: song.soft ? 0.05 : 0.045, at, bus: mbus, attack: 0.005 })); }
            else if (song.comp === 'waltz') { if (e.k % 6 === 0) tone(mf(a - 12), eighth * 1.8, { type: 'triangle', vol: 0.22, at, bus: mbus, attack: 0.004 }); else if (e.k % 2 === 0) [a, b, c].forEach(m => tone(mf(m + 12), eighth * 0.8, { type: 'sine', vol: 0.045, at, bus: mbus, attack: 0.005 })); }
            else if (song.comp === 'pad' && e.k === 0) [a, b, c].forEach(m => tone(mf(m + 12), e.span * eighth * 1.1, { type: 'sine', vol: 0.045, at, bus: mbus, attack: 0.8 }));
          }
        });
        if (song.perc === 'shaker' || (song.perc === 'offbeat' && step % 2 === 1)) hissMusic(at, step % 2 ? 0.05 : 0.03);
        if (song.perc === 'sleigh') { hissMusic(at, step % 2 ? 0.045 : 0.07, 8500, 0.09); if (step % 4 === 2 && (song.bar || 8) === 8) clap(at); }
        step++; next += eighth;
        if (step === ev.length) {
          step = 0; loop++;
          if (list.length > 1 && loop >= (song.times || 1)) { // 换歌：先敲一声钟，留 1.5 秒
            idx++; loop = 0; instrument('bell', 79, 1, next - ctx.currentTime, 0.18); instrument('bell', 67, 1, next - ctx.currentTime + 0.02, 0.12);
            next += 1.5; load();
          }
        }
      }
    }, 100);
    music = { timer, name: () => list[idx % list.length] };
  }
  function clap(at) { // 轻拍手：带通噪声，两下叠成「啪」
    [0, 0.012].forEach(d => {
      const t = ctx.currentTime + at + d, s = ctx.createBufferSource(); s.buffer = noise();
      const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1600; fl.Q.value = 1.2;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      s.connect(fl); fl.connect(g); g.connect(mbus); s.start(t); s.stop(t + 0.13);
    });
  }
  function hissMusic(at, vol, hp, len) { // 轻沙锤 / 雪橇铃
    const t = ctx.currentTime + at, s = ctx.createBufferSource(); s.buffer = noise();
    const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = hp || 6000;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (len || 0.06));
    s.connect(fl); fl.connect(g); g.connect(mbus); s.start(t); s.stop(t + (len || 0.06) + 0.02);
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
    nowPlaying: () => (music ? music.name() : null),
  };
})(window);

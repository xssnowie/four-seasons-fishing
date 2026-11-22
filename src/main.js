// 四季钓场 · 主程序（Phaser 3）。手机优先：横屏 / 竖屏两套布局，转屏自动重排；画布按屏幕比例伸缩铺满。
// 素材缺失时自动生成占位图，放进 assets/ 对应文件名即自动替换。
(function () {
  const D = window.GameData, L = window.GameLogic, A = window.GameAudio;
  const FONT = '"ZCOOL KuaiLe","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'; // 站酷快乐体（assets/font，OFL 授权）
  const BODY = '"MaoKenTangYuan (beta)","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'; // 猫啃网糖圆体（assets/font/tangyuan，OFL）
  const INK = '#4a2f17';
    const HEX = n => '#' + n.toString(16).padStart(6, '0');
  const TOUCH = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const MIN_FONT = TOUCH ? 30 : 22; // 手机上画布缩得厉害，字不能太小

  // URL 调试参数：?season=winter&weather=rainy&force=deepabyss
  const Q = new URLSearchParams(location.search);

  // ---------------- 画布尺寸：短边固定 1080，长边跟随屏幕比例 ----------------
  function host() { const el = document.getElementById('game'); return { w: el.clientWidth || innerWidth, h: el.clientHeight || innerHeight }; }
  function computeSize() {
    const { w, h } = host();
    if (w >= h) return { W: Math.round(Phaser.Math.Clamp(1080 * w / h, 1600, 2400)), H: 1080 };
    return { W: 1080, H: Math.round(Phaser.Math.Clamp(1080 * h / w, 1920, 2400)) };
  }

  // ---------------- 布局：所有位置都从这里取 ----------------
  function layout(W, H) {
    const P = H > W;
    const hudH = P ? 232 : 112;
    const o = { W, H, P, hudH };
    if (P) {
      o.player = { x: 230, y: H - 190, size: 300 };
      o.rodTip = { x: 390, y: H - 560 };
      const s = Math.max(W / 1080, H / 1920), bx = f => f * 1080 * s, by = f => H - (1 - f) * 1920 * s; // 竖屏背景 1080×1920，cover + 左下对齐
      o.far = d => ({ x: Math.min(W - 90, bx(0.58 + 0.22 * d)), y: by(0.62 - 0.12 * d) });
      o.tension = { x: W - 108, top: Math.round(H * 0.27), h: Math.round(H * 0.36), w: 52 };
      o.progress = { cx: W / 2, y: hudH + 78, w: 760 };
      o.charge = { cx: W / 2, y: hudH + 80, w: 560 };
      o.hintY = H - 56; o.msgY = H * 0.36;
      o.toast = { x: W / 2, y: H - 250, from: W + 320 };
      o.waterTop = H * 0.32;
    } else {
      o.player = { x: 330, y: H - 175, size: 330 };
      o.rodTip = { x: 500, y: 560 };
      o.far = d => ({ x: 720 + d * (W - 920), y: 780 - d * 150 });
      o.tension = { x: W - 148, top: 260, h: 560, w: 56 };
      o.progress = { cx: W / 2, y: 960, w: 700 };
      o.charge = { cx: 330, y: 480, w: 360 };
      o.hintY = H - 60; o.msgY = 420;
      o.toast = { x: W - 310, y: H - 110, from: W + 320 };
      o.waterTop = 470;
    }
    o.oy = hudH + (H - hudH) / 2; // 弹层中心
    return o;
  }

  // 各姿势的拳头位置（512×512 素材里的像素）和鱼竿方向（以人物显示尺寸为单位）
  const POSE = {
    player_idle: { hand: [365, 288], rod: [0.36, -0.77] },
    player_cast: { hand: [394, 173], rod: [0.20, -0.83] },
    player_wait: { hand: [352, 307], rod: [0.55, -0.62] },
    player_reel: { hand: [353, 252], rod: [0.62, -0.50] },
    player_celebrate: { hand: [387, 128], rod: [0.25, -0.80] },
    player_male_idle: { hand: [346, 256], rod: [0.36, -0.77] },
    player_male_cast: { hand: [371, 160], rod: [0.20, -0.83] },
    player_male_wait: { hand: [348, 269], rod: [0.55, -0.62] },
    player_male_reel: { hand: [352, 198], rod: [0.62, -0.50] },
    player_male_celebrate: { hand: [358, 122], rod: [0.25, -0.80] },
    // 圣诞装（批次 10）导入时已放大到跟原角色同高、脚底对齐，拳头位置单独量
    player_xmas_female_idle: { hand: [390, 301], rod: [0.36, -0.77] },
    player_xmas_female_cast: { hand: [418, 224], rod: [0.20, -0.83] },
    player_xmas_female_wait: { hand: [366, 351], rod: [0.55, -0.62] },
    player_xmas_female_reel: { hand: [390, 263], rod: [0.62, -0.50] },
    player_xmas_female_celebrate: { hand: [392, 124], rod: [0.25, -0.80] },
    player_xmas_male_idle: { hand: [370, 279], rod: [0.36, -0.77] },
    player_xmas_male_cast: { hand: [392, 219], rod: [0.20, -0.83] },
    player_xmas_male_wait: { hand: [356, 331], rod: [0.55, -0.62] },
    player_xmas_male_reel: { hand: [362, 243], rod: [0.62, -0.50] },
    player_xmas_male_celebrate: { hand: [381, 131], rod: [0.25, -0.80] },
  };
  // 玩家选的角色（只存本机）：'female' | 'male'；没选过是 null
  const CHAR_KEY = 'fishing.char';
  // 角色存在存档里（登录后跟账号同步）；本机另记一份，没登录 / 账号还没选过时用
  const okChar = c => (c === 'male' || c === 'female' ? c : null);
  function localChar() { try { return okChar(localStorage.getItem(CHAR_KEY)); } catch (e) { return null; } }
  function getChar() { return okChar(window.Store.save.char) || localChar(); }
  function setChar(c) {
    try { localStorage.setItem(CHAR_KEY, c); } catch (e) { /* ignore */ }
    window.Store.save.char = c; window.Store.save.charAt = Date.now(); window.Store.commit();
  }
  // 登录的账号还没选过角色，就把这台设备上选的带进账号
  window.Store.onChange(S => { if (S.user && !okChar(S.save.char) && localChar()) setChar(localChar()); });
  // 节日限定场：12 月自动开放；?event=xmas 可以提前预览
  const xmasOn = () => Q.get('event') === 'xmas' || L.eventActive('xmas');
  let SKIN = null; // 当前场景的节日皮肤（在圣诞场 = 'xmas'）
  const pkey = pose => {
    const male = getChar() === 'male';
    if (SKIN) { const k = `player_${SKIN}_${male ? 'male' : 'female'}_${pose}`; if (game.textures.exists(k)) return k; } // 皮肤素材没到就穿原本的
    return (male ? 'player_male_' : 'player_') + pose;
  };
  const poseName = key => key.replace(/^player_(xmas_(female|male)_|male_)?/, '');
  // 节日皮肤和原本的姿势一样，拳头位置先沿用原角色（素材到了再细调）
  const poseOf = key => POSE[key] || POSE[key.replace(/^player_xmas_female_/, 'player_').replace(/^player_xmas_male_/, 'player_male_')] || POSE.player_idle;

  // 竖屏背景里人物脚踩的位置（背景图宽、高的比例），按每张图的码头 / 岸边量的
  const PLAYER_SPOT = {
    autumn_river: [0.24, 0.90], autumn_sea: [0.25, 0.88], spring_river: [0.25, 0.86], spring_sea: [0.18, 0.90],
    summer_river: [0.18, 0.82], summer_sea: [0.22, 0.88], winter_river: [0.22, 0.94], winter_sea: [0.30, 0.93],
    xmas: [0.45, 0.955], // 节日场不分季节，按场地取
  };
  // 横屏背景（1920×1080）大多在默认位置就有码头；冬天的河默认位置正好是背景里的木凳，挪到凳子右边的雪堆上
  const PLAYER_SPOT_L = { winter_river: [0.33, 0.93] };

  // 鱼竿素材（裁边后）：握把中心对准拳头，竿尖接鱼线；rod 1449×147，rod_bent 1438×144
  const ROD_IMG = {
    player_rod: { w: 1449, h: 147, grip: [118, 42.5], tip: [1447, 36.5] },
    player_rod_bent: { w: 1438, h: 144, grip: [118, 42.5], tip: [1436, 90] },
  };

  // 背景图（cover，左下对齐）坐标 → 画面坐标
  function bgMap(L0, tex) {
    const iw = tex.getSourceImage().width, ih = tex.getSourceImage().height;
    const s = Math.max(L0.W / iw, L0.H / ih);
    return { s, iw, ih, at: (fx, fy) => ({ x: fx * iw * s, y: L0.H - (1 - fy) * ih * s }) };
  }
  const ICE = { landscape: [0.716, 0.722], portrait: [0.733, 0.671] }; // 冰洞在背景图里的相对位置（素材指令里写的同一位置）

  // 多字的说明、列表、提示用圆体（猫啃网糖圆体），标题和按钮保持站酷快乐体
  function TB(scene, x, y, str, size, color, extra) { return T(scene, x, y, str, size, color, Object.assign({ fontFamily: BODY }, extra || {})); }
  function T(scene, x, y, str, size, color, extra) {
    return scene.add.text(x, y, str, Object.assign({ fontFamily: FONT, fontSize: Math.max(size, MIN_FONT) + 'px', color: color || INK }, extra || {}));
  }
  function lerpColor(a, b, t) {
    const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255, br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function fmtW(w) { return w >= 1000 ? (w / 1000).toFixed(2) + ' 吨' : w.toFixed(2) + ' kg'; }
  function mmss(ms) { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, p2 = n => String(n).padStart(2, '0'); return (h ? h + ':' + p2(m) : m) + ':' + p2(s % 60); }
  function sceneLabel(sc) {
    if (D.EVENTS[sc.water]) return `${D.WATER_CN[sc.water]} · ${sc.weather === 'rainy' ? '大雪' : '晴'}`; // 节日场不分季节
    return `${D.SEASON_CN[sc.season]} · ${D.WEATHER_CN[sc.weather]} · ${D.WATER_CN[sc.water]}`;
  }
  function condText(f) {
    if (f.event) return `${D.EVENTS[f.event].cn}限定场 · ${D.EVENTS[f.event].when}`;
    if (f.rarity === 'goddess') return '任何场景（极低概率）';
    if (f.rarity === 'fairy') return `${D.SEASON_CN[f.season]}季 · 天气水域不限（低概率）`;
    const p = [];
    if (f.season) p.push(D.SEASON_CN[f.season] + '季'); else p.push('四季');
    if (f.weather) p.push(D.WEATHER_CN[f.weather] + '天');
    p.push(D.WATER_CN[f.water]);
    return p.join(' · ');
  }
  function fit(img, w, h) { img.setScale(Math.min(w / img.width, h / img.height)); return img; }

  // ---------------- 素材清单 ----------------
  function manifest() {
    const m = [];
    // 场景背景不在这里：一张约 2MP，16 张全载手机会爆内存 → 用到时才加载（ensureBg）
    ['idle', 'cast', 'wait', 'reel', 'celebrate', 'float', 'rod', 'rod_bent'].forEach(k => m.push(['player_' + k, `assets/player/${k}.png`]));
    ['idle', 'cast', 'wait', 'reel', 'celebrate'].forEach(k => m.push(['player_male_' + k, `assets/player_male/${k}.png`]));
    D.FISH.forEach(f => m.push(['fish_' + f.id, `assets/fish/${D.RARITY[f.rarity].folder}/${f.file}.png`]));
    ['logo', 'title_bg', 'title_bg_portrait', 'btn_primary', 'btn_secondary', 'panel', 'topbar',
      'card_common', 'card_rare', 'card_exotic', 'card_monster', 'card_fairy', 'btn_sound_on', 'btn_sound_off'].forEach(k => m.push(['ui_' + k, `assets/ui/${k}.png`]));
    D.ACHIEVEMENTS.forEach(a => m.push(['badge_' + a.id, `assets/badge/${a.id}.png`]));
    return m;
  }

  // ---------------- 占位图 ----------------
  const PAL = {
    spring: { skyTop: 0xa9dcff, skyBot: 0xffe1ee, seaFar: 0x7fd3e0, seaNear: 0x2f9fb5, riverFar: 0x8fd6b0, riverNear: 0x3f9f86, land: 0x9bd67a, accent: 0xf6a5c0 },
    summer: { skyTop: 0x4fb0ff, skyBot: 0xd8f1ff, seaFar: 0x56b8f0, seaNear: 0x1569b8, riverFar: 0x6cc48a, riverNear: 0x2c8a5b, land: 0x63b84f, accent: 0x3e9e3a },
    autumn: { skyTop: 0xffa45c, skyBot: 0xffe2b5, seaFar: 0x6aa8bf, seaNear: 0x2f6680, riverFar: 0x9db17a, riverNear: 0x5a7a4a, land: 0xc9a25a, accent: 0xe0602a },
    winter: { skyTop: 0x9db8d2, skyBot: 0xeef4fa, seaFar: 0x6f97ab, seaNear: 0x274e63, riverFar: 0xe8f1f7, riverNear: 0xcfe2ee, land: 0xf4f8fb, accent: 0xffffff },
  };
  function gradientRect(g, x, y, w, h, c1, c2, bands) {
    bands = bands || 24;
    for (let i = 0; i < bands; i++) { g.fillStyle(lerpColor(c1, c2, i / (bands - 1)), 1); g.fillRect(x, y + (h * i) / bands, w, h / bands + 1); }
  }

  // w×h 的场景背景；竖屏时远景更高、岸边更窄
  function makeBg(scene, key, season, water, w, h) {
    const p = PAL[season], g = scene.make.graphics({ x: 0, y: 0, add: false });
    const portrait = h > w, k = Math.min(w, h) / 1080;
    const horizon = h * (portrait ? 0.30 : (water === 'sea' ? 0.40 : 0.435));
    const shoreW = w * (portrait ? 0.52 : 0.31), shoreY = h * (portrait ? 0.86 : 0.78);
    gradientRect(g, 0, 0, w, horizon, p.skyTop, p.skyBot);
    g.fillStyle(0xffffff, 0.75);
    [[0.16, 0.14], [0.47, 0.10], [0.78, 0.17]].forEach(([fx, fy]) => { const x = fx * w, y = fy * horizon * 2.4; g.fillCircle(x, y, 50 * k); g.fillCircle(x + 55 * k, y + 10 * k, 40 * k); g.fillCircle(x - 55 * k, y + 12 * k, 36 * k); });
    if (water === 'sea') {
      gradientRect(g, 0, horizon, w, h - horizon, p.seaFar, p.seaNear);
      g.lineStyle(3, 0xffffff, 0.25);
      for (let i = 0; i < 22; i++) { const y = horizon + 30 + i * (h - horizon) / 22, x = (i * 397) % (w - 150); g.lineBetween(x, y, x + 120 * k, y); }
      g.fillStyle(lerpColor(p.land, 0x334455, 0.35), 1); g.fillEllipse(w * 0.12, horizon + 5, 640 * k, 120 * k);
      if (season === 'winter') {
        g.fillStyle(0xffffff, 0.9); g.fillEllipse(w * 0.12, horizon - 10 * k, 520 * k, 70 * k);
        g.fillStyle(0xe6f2fa, 0.9); [[0.47, 0.57], [0.7, 0.52], [0.86, 0.65]].forEach(([fx, fy]) => g.fillEllipse(fx * w, fy * h, 140 * k, 30 * k));
      } else { g.fillStyle(p.accent, 1); for (let i = 0; i < 6; i++) g.fillCircle(w * 0.03 + i * 75 * k, horizon - (25 + (i % 2) * 15) * k, 34 * k); }
      g.fillStyle(0x8a5a2b, 1); g.fillRect(0, shoreY + 20 * k, shoreW, 40 * k);
      g.fillStyle(0xa8743f, 1); g.fillRect(0, shoreY, shoreW, 30 * k);
      g.fillStyle(0x6b4220, 1); [0.1, 0.42, 0.73, 0.96].forEach(f => g.fillRect(f * shoreW - 13 * k, shoreY + 30 * k, 26 * k, h));
      g.lineStyle(2, 0x6b4220, 1); for (let x = 0; x < shoreW; x += 60 * k) g.lineBetween(x, shoreY, x, shoreY + 30 * k);
      if (season === 'winter') { g.fillStyle(0xffffff, 1); g.fillRect(0, shoreY - 8 * k, shoreW, 12 * k); }
    } else {
      const bank = horizon + 50 * k;
      g.fillStyle(season === 'winter' ? 0xf4f8fb : p.land, 1); g.fillRect(0, horizon - 40 * k, w, 90 * k);
      for (let i = 0; i * 125 * k < w + 60; i++) {
        const x = 40 * k + i * 125 * k, r = (38 + (i % 3) * 10) * k;
        g.fillStyle(0x6b4a2b, 1); g.fillRect(x - 6 * k, horizon - 40 * k, 12 * k, 40 * k);
        g.fillStyle(season === 'winter' ? 0xdfe9f0 : (i % 2 ? p.accent : lerpColor(p.land, 0x1e5a2a, 0.4)), 1); g.fillCircle(x, horizon - 60 * k, r);
      }
      if (season === 'winter') {
        g.fillStyle(p.riverFar, 1); g.fillRect(0, bank, w, h - bank);
        g.lineStyle(3, 0xb5cfe0, 1);
        [[0.36, 0.58, 0.47, 0.65], [0.75, 0.5, 0.86, 0.6], [0.52, 0.8, 0.68, 0.76]].forEach(([a, b, c, d]) => g.lineBetween(a * w, b * h, c * w, d * h));
        const [fx, fy] = ICE[portrait ? 'portrait' : 'landscape'];
        g.fillStyle(0xffffff, 1); g.fillEllipse(fx * w, fy * h, 250 * k, 100 * k);
        g.fillStyle(0x1f4a5e, 1); g.fillEllipse(fx * w, fy * h + 4 * k, 210 * k, 76 * k);
      } else {
        gradientRect(g, 0, bank, w, h - bank, p.riverFar, p.riverNear);
        g.lineStyle(3, 0xffffff, 0.22);
        for (let i = 0; i < 18; i++) { const y = bank + 30 + i * (h - bank) / 18, x = (i * 331) % (w - 200) + 100; g.lineBetween(x, y, x + 100 * k, y); }
        const rnd = (i, a, b) => a + ((i * 2654435761) >>> 0) % 1000 / 1000 * (b - a);
        if (season === 'summer') for (let i = 0; i < 9; i++) { const x = rnd(i, shoreW, w), y = rnd(i + 50, bank + 80, h - 40); g.fillStyle(0x3f9f4f, 1); g.fillEllipse(x, y, 110 * k, 40 * k); if (i % 3 === 0) { g.fillStyle(0xff8fb0, 1); g.fillCircle(x, y - 15 * k, 16 * k); } }
        if (season === 'autumn') { g.fillStyle(0xe8742a, 1); for (let i = 0; i < 24; i++) g.fillEllipse(rnd(i, w * 0.3, w), rnd(i + 99, bank + 40, h), 22 * k, 12 * k); }
        if (season === 'spring') { g.fillStyle(0xffc2d6, 1); for (let i = 0; i < 30; i++) g.fillCircle(rnd(i, w * 0.3, w), rnd(i + 77, bank + 30, h), 6 * k); }
      }
      g.fillStyle(season === 'winter' ? 0xf6f9fc : lerpColor(p.land, 0x5a3d1f, 0.25), 1);
      g.fillPoints([{ x: 0, y: shoreY }, { x: shoreW * 0.7, y: shoreY + 10 * k }, { x: shoreW * 1.03, y: shoreY + 120 * k }, { x: shoreW * 1.13, y: h }, { x: 0, y: h }], true);
      g.fillStyle(0x7a5530, 1); g.fillRect(0, shoreY + 140 * k, shoreW, h);
    }
    g.generateTexture(key, w, h); g.destroy();
  }

  function makePlayer(scene, key, pose) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false }), s = 512;
    const bob = pose === 'celebrate' ? -30 : 0;
    g.fillStyle(0x3e8e41, 1); g.fillRoundedRect(190, 430 + bob, 60, 70, 14); g.fillRoundedRect(265, 430 + bob, 60, 70, 14);
    g.fillStyle(0xffcf3a, 1); g.fillRoundedRect(160, 270 + bob, 195, 190, 50);
    g.fillStyle(0xe0a800, 1); g.fillRect(250, 290 + bob, 8, 150);
    g.fillStyle(0xffe0c2, 1); g.fillCircle(256, 200 + bob, 95);
    g.fillStyle(0x3a2a1a, 1); g.fillCircle(222, 205 + bob, 10); g.fillCircle(292, 205 + bob, 10);
    g.fillStyle(0xff9aa8, 0.7); g.fillCircle(205, 235 + bob, 14); g.fillCircle(308, 235 + bob, 14);
    g.lineStyle(5, 0x3a2a1a, 1); g.beginPath(); g.arc(256, 238 + bob, 18, 0.2, Math.PI - 0.2); g.strokePath();
    g.fillStyle(0x4a7fb5, 1); g.fillEllipse(256, 125 + bob, 260, 50); g.fillRoundedRect(180, 70 + bob, 152, 70, 30);
    if (pose === 'reel') { g.fillStyle(0xffffff, 1); g.fillCircle(340, 150, 12); }
    g.generateTexture(key, s, s); g.destroy();
  }

  function makeFish(scene, key, f) {
    const r = f.rarity, big = r === 'monster' ? 1 : 0, s = 512, g = scene.make.graphics({ x: 0, y: 0, add: false });
    const hue = (hashStr(f.id) % 360) / 360;
    const base = Phaser.Display.Color.HSLToColor(hue, r === 'common' ? 0.45 : 0.7, r === 'monster' ? 0.4 : 0.6).color;
    const cx = 256, cy = 256, bw = big ? 380 : 300, bh = big ? 220 : 160;
    if (r === 'exotic' || r === 'monster') { g.fillStyle(D.RARITY[r].color, 0.25); g.fillCircle(cx, cy, 240); }
    g.fillStyle(lerpColor(base, 0x000000, 0.2), 1);
    g.fillTriangle(cx - bw / 2 + 20, cy, cx - bw / 2 - 90, cy - 90, cx - bw / 2 - 90, cy + 90);
    if (big) { g.fillStyle(0x553344, 1); for (let i = 0; i < 6; i++) g.fillTriangle(cx - 120 + i * 45, cy - bh / 2 + 10, cx - 100 + i * 45, cy - bh / 2 - 60, cx - 80 + i * 45, cy - bh / 2 + 10); }
    g.fillStyle(base, 1); g.fillEllipse(cx, cy, bw, bh);
    g.fillStyle(0xffffff, 0.35); g.fillEllipse(cx + 10, cy + bh * 0.18, bw * 0.7, bh * 0.35);
    g.lineStyle(6, 0x4a2f17, 1); g.strokeEllipse(cx, cy, bw, bh);
    g.fillStyle(0xffffff, 1); g.fillCircle(cx + bw / 2 - 60, cy - 20, big ? 30 : 24);
    g.fillStyle(0x222222, 1); g.fillCircle(cx + bw / 2 - 55, cy - 20, big ? 16 : 12);
    if (r === 'rare' || r === 'exotic') { g.fillStyle(0xfff3a0, 1); [[cx - 40, cy - 110], [cx + 90, cy + 100], [cx - 150, cy + 80]].forEach(([x, y]) => g.fillCircle(x, y, 12)); }
    g.generateTexture(key, s, s); g.destroy();
  }

  function makeFairy(scene, key, season) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false }), s = 512;
    const dress = { spring: 0xffb7d0, summer: 0xb9f0c8, autumn: 0xffc870, winter: 0xdcecff }[season];
    g.fillStyle(0xfff6c8, 0.35); g.fillCircle(256, 260, 240);
    g.lineStyle(10, 0xff9ad0, 0.8); g.beginPath(); g.arc(256, 250, 170, Math.PI * 0.9, Math.PI * 2.1); g.strokePath();
    g.fillStyle(dress, 1); g.fillTriangle(256, 210, 130, 470, 382, 470);
    g.fillStyle(0xffe6d0, 1); g.fillCircle(256, 170, 70);
    g.fillStyle(0x2b1d2e, 1); g.fillEllipse(256, 110, 150, 60); g.fillCircle(256, 70, 38);
    g.fillStyle(0xff6fa8, 1); g.fillCircle(290, 70, 14); g.fillCircle(222, 82, 10);
    g.fillStyle(0x2b1d2e, 1); g.fillCircle(232, 175, 7); g.fillCircle(280, 175, 7);
    g.fillStyle(0xff9aa8, 0.7); g.fillCircle(220, 198, 10); g.fillCircle(292, 198, 10);
    g.generateTexture(key, s, s); g.destroy();
  }

  function makeGoddess(scene, key) { // 大隐藏水之女神占位：水蓝光环、水波、贝壳头冠
    const g = scene.make.graphics({ x: 0, y: 0, add: false }), s = 512;
    g.fillStyle(0xbfeaff, 0.5); g.fillCircle(256, 240, 250);
    g.lineStyle(14, 0x4fc3f7, 0.9); g.strokeCircle(256, 120, 92);
    g.fillStyle(0x6fd3ff, 0.95); [[150, 470], [256, 485], [362, 470]].forEach(([x, y]) => g.fillEllipse(x, y, 190, 60));
    g.lineStyle(10, 0x9be7ff, 0.9); g.beginPath(); g.arc(256, 260, 200, Math.PI * 0.85, Math.PI * 2.15); g.strokePath();
    g.fillStyle(0xe6f7ff, 1); g.fillTriangle(256, 190, 110, 460, 402, 460);
    g.fillStyle(0x29a3d6, 1); g.fillRect(150, 300, 212, 14);
    g.fillStyle(0xffe6d0, 1); g.fillCircle(256, 150, 60);
    g.fillStyle(0x2b1d2e, 1); g.fillEllipse(256, 100, 140, 52); g.fillCircle(256, 60, 34);
    g.fillStyle(0xfff0f5, 1); g.fillCircle(256, 40, 14); g.fillCircle(222, 70, 9); g.fillCircle(290, 70, 9);
    g.fillStyle(0x2b1d2e, 1); g.fillCircle(236, 154, 6); g.fillCircle(276, 154, 6);
    g.generateTexture(key, s, s); g.destroy();
  }

  function makeSimple(scene, key, kind) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    if (kind === 'float') { g.fillStyle(0xffffff, 1); g.fillCircle(32, 40, 22); g.fillStyle(0xe8453c, 1); g.slice(32, 40, 22, Math.PI, 0, false); g.fillPath(); g.fillRect(29, 2, 6, 20); g.generateTexture(key, 64, 64); }
    else if (kind === 'flake') { g.fillStyle(0xffffff, 0.95); g.fillCircle(8, 8, 7); g.generateTexture(key, 16, 16); }
    else if (kind === 'drop') { g.lineStyle(3, 0xdfefff, 0.9); g.lineBetween(10, 0, 2, 30); g.generateTexture(key, 12, 30); }
    else if (kind === 'badge') { g.fillStyle(0xd9a740, 1); g.fillCircle(128, 128, 120); g.fillStyle(0xffe08a, 1); g.fillCircle(128, 128, 96); g.fillStyle(0xd9a740, 1); g.fillTriangle(128, 60, 80, 170, 176, 170); g.fillTriangle(128, 196, 80, 90, 176, 90); g.generateTexture(key, 256, 256); }
    g.destroy();
  }

  // ---------------- Boot：加载 + 补占位 ----------------
  class Boot extends Phaser.Scene {
    constructor() { super('Boot'); }
    preload() {
      const t = T(this, this.scale.width / 2, this.scale.height / 2, '加载中… 0%', 48, '#ffffff').setOrigin(0.5);
      this.load.on('progress', v => t.setText('加载中… ' + Math.round(v * 100) + '%'));
      this.failed = []; this.tries = 0;
      this.load.on('loaderror', f => this.failed.push([f.key, f.url])); // 网络不稳 / 正在发布时可能个别图下载失败
      manifest().forEach(([k, p]) => this.load.image(k, p));
    }
    create() {
      // 下载失败的图最多再试 2 次（间隔 0.8 秒），都失败才用占位图，免得一次网络抖动就变成「小鱼苗」
      if (this.failed.length && this.tries < 2) {
        const again = this.failed; this.failed = []; this.tries++;
        console.warn(`[fishing] ${again.length} 张图下载失败，第 ${this.tries} 次重试`);
        this.time.delayedCall(800, () => {
          again.forEach(([k, u]) => this.load.image(k, u.split('?')[0] + '?retry=' + this.tries + '-' + Date.now()));
          this.load.once('complete', () => this.create());
          this.load.start();
        });
        return;
      }
      const missing = new Set();
      manifest().forEach(([k]) => {
        if (this.textures.exists(k)) return;
        missing.add(k);
        if (k === 'player_float') makeSimple(this, k, 'float');
        else if (k.startsWith('player_')) makePlayer(this, k, k.replace(/^player_(male_)?/, ''));
        else if (k.startsWith('fish_')) {
          const f = D.FISH.find(x => 'fish_' + x.id === k);
          if (f.rarity === 'fairy') makeFairy(this, k, f.season); else if (f.rarity === 'goddess') makeGoddess(this, k); else makeFish(this, k, f);
        }
        else if (k.startsWith('badge_')) makeSimple(this, k, 'badge');
        // ui_* 缺图时由界面用图形绘制
      });
      makeSimple(this, 'drop', 'drop'); makeSimple(this, 'flake', 'flake');
      this.registry.set('missing', missing);
      console.log(`[fishing] 素材 ${manifest().length - missing.size}/${manifest().length} 张已就位，其余用占位图`);
      // 等游戏字体加载好再进标题页，否则第一屏会先用系统字体画（最多等 4 秒）
      const go = () => this.scene.start('Title');
      // 圆体按字拆成很多小文件，只下载游戏里出现的字：把源码和数据里的字都喂给 fonts.load，画布绘字前就备齐
      const bodyChars = () => Promise.all(['src/main.js', 'src/data.js'].map(u => fetch(u).then(r => r.text()).catch(() => '')))
        .then(ts => document.fonts.load('30px "MaoKenTangYuan (beta)"', [...new Set(ts.join('') + '0123456789kg./:·（）')].join('')));
      if (document.fonts && document.fonts.load) Promise.race([Promise.all([document.fonts.load('48px "ZCOOL KuaiLe"', '四季钓场'), bodyChars()]), new Promise(r => setTimeout(r, 5000))]).then(go, go);
      else go();
    }
  }

  // ---------------- 通用 UI ----------------
  function has(scene, key) { return !scene.registry.get('missing').has(key) && scene.textures.exists(key); }

  function panel(scene, x, y, w, h, key) {
    if (key && has(scene, key)) return scene.add.nineslice(x, y, key, null, w, h, 130, 130, 130, 130); // 素材四边做九宫格拉伸（角上的绳结/海星不拉变形）
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.25); g.fillRoundedRect(x - w / 2 + 8, y - h / 2 + 12, w, h, 36);
    g.fillStyle(0x9a6534, 1); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 36);
    g.fillStyle(0xfbf1dc, 1); g.fillRoundedRect(x - w / 2 + 16, y - h / 2 + 16, w - 32, h - 32, 26);
    return g;
  }

  function button(scene, x, y, w, h, label, onClick, opt) {
    opt = opt || {};
    const c = scene.add.container(x, y);
    const key = opt.secondary ? 'ui_btn_secondary' : 'ui_btn_primary';
    if (has(scene, key)) c.add(scene.add.nineslice(0, 0, key, null, w, h, 40, 40, 30, 30));
    else {
      const g = scene.add.graphics(), col = opt.secondary ? 0x6fb6e8 : 0xf39a3b, r = Math.min(h / 2.4, 40);
      g.fillStyle(0x000000, 0.25); g.fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, r);
      g.fillStyle(col, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.lineStyle(4, 0x6b4220, 1); g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
      c.add(g);
    }
    const t = T(scene, 0, -2, label, opt.size || Math.round(h * 0.42), '#ffffff', { stroke: '#6b4220', strokeThickness: 5 }).setOrigin(0.5);
    c.add(t); c.label = t;
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => { A.unlock(); A.play('click'); onClick && onClick(); });
    if (!TOUCH) { c.on('pointerover', () => c.setScale(1.05)); c.on('pointerout', () => c.setScale(1)); }
    return c;
  }

  function currentScene(water) {
    const s = L.sceneAt(Date.now());
    if (D.SEASONS.includes(Q.get('season'))) s.season = Q.get('season');
    if (['sunny', 'rainy'].includes(Q.get('weather'))) s.weather = Q.get('weather');
    s.water = water;
    return s;
  }

  // 按需加载一张背景：先试 assets/ 里的图，没有就画占位；同时释放其他背景，手机内存吃不消
  function bgPath(key) {
    const [kind, s, w] = key.split('_');
    if (s === 'event') return `assets/event/${w}/${kind === 'bgp' ? 'bg_portrait' : 'bg'}.png`; // 节日场：bg_event_xmas / bgp_event_xmas
    return kind === 'bgp' ? `assets/bg/portrait/${s}_${w}.png` : `assets/bg/${s}_${w}.png`;
  }
  // 节日场素材（可钓物 + 皮肤）进场才下载，不拖慢首次打开；缺图用占位
  function ensureEvent(scene, ev, cb) {
    const list = D.EVENT_FISH.filter(f => f.event === ev).map(f => ['fish_' + f.id, `assets/event/${ev}/fish/${f.file}.png`]);
    ['female', 'male'].forEach(g => ['idle', 'cast', 'wait', 'reel', 'celebrate'].forEach(k => list.push([`player_${ev}_${g}_${k}`, `assets/event/${ev}/player_${g}/${k}.png`])));
    const need = list.filter(([k]) => !scene.textures.exists(k) && !(scene.registry.get('eventTried') || {})[k]);
    const done = () => {
      const tried = scene.registry.get('eventTried') || {}; need.forEach(([k]) => { tried[k] = true; }); scene.registry.set('eventTried', tried);
      D.EVENT_FISH.filter(f => f.event === ev).forEach(f => { const k = 'fish_' + f.id; if (!scene.textures.exists(k)) { if (f.rarity === 'eventHidden') makeFairy(scene, k, 'winter'); else makeFish(scene, k, f); } });
      cb && cb();
    };
    if (!need.length) return done();
    need.forEach(([k, u]) => scene.load.image(k, u));
    scene.load.once('complete', done);
    scene.load.start();
  }
  function ensureBg(scene, key, cb) {
    const tm = scene.textures;
    const done = () => {
      if (!tm.exists(key)) { const [kind, s0, w0] = key.split('_'), ev = s0 === 'event', s = ev ? 'winter' : s0, w = ev ? 'sea' : w0; if (kind === 'bgp') makeBg(scene, key, s, w, 1080, 1920); else makeBg(scene, key, s, w, 1920, 1080); }
      tm.getTextureKeys().forEach(k => { if (/^bgp?_/.test(k) && k !== key) tm.remove(k); });
      cb();
    };
    if (tm.exists(key)) return done();
    scene.load.image(key, bgPath(key));
    scene.load.once('complete', done);
    scene.load.start();
  }

  function addBg(scene, Lx, key) {
    const img = scene.add.image(0, Lx.H, key).setOrigin(0, 1);
    const m = bgMap(Lx, img.texture); img.setScale(m.s);
    return img;
  }

  // ---------------- 标题页 ----------------
  class Title extends Phaser.Scene {
    constructor() { super('Title'); }
    create() {
      const Lx = layout(this.scale.width, this.scale.height), { W, H, P } = Lx;
      const sc = currentScene('sea');
      const own = P ? 'ui_title_bg_portrait' : 'ui_title_bg';
      const put = k => { const img = addBg(this, Lx, k).setDepth(-2); this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.25).setDepth(-1); return img; };
      if (has(this, own)) put(own); else ensureBg(this, `${P ? 'bgp' : 'bg'}_${sc.season}_sea`, () => put(`${P ? 'bgp' : 'bg'}_${sc.season}_sea`));
      const ty = P ? H * 0.28 : 330;
      if (has(this, 'ui_logo')) fit(this.add.image(W / 2, ty, 'ui_logo'), P ? 960 : 900, 450);
      T(this, W / 2, ty, '四季钓场', P ? 170 : 150, '#ffffff', { stroke: '#4a2f17', strokeThickness: 14 }).setOrigin(0.5);
      TB(this, W / 2, ty + (P ? 170 : 150), `本周：${D.SEASON_CN[sc.season]}季 · 此刻：${D.WEATHER_CN[sc.weather]}天`, 42, '#ffffff', { stroke: '#4a2f17', strokeThickness: 6 }).setOrigin(0.5);
      const start = () => { A.unlock(); this.scene.start('Game'); };
      const go = () => { if (this.picker) return; if (getChar()) start(); else this.pickChar(start); }; // 第一次开始先选角色
      button(this, W / 2, P ? H * 0.55 : 680, P ? 600 : 460, P ? 160 : 130, '开始钓鱼', go);
      const tip = TOUCH ? '按住屏幕蓄力 · 松手抛竿 · 浮标下沉时点一下 · 拉扯时让张力停在绿区' : '按住蓄力 · 松开抛竿 · 浮标下沉时点一下提竿 · 拉扯时让张力停在绿区';
      TB(this, W / 2, P ? H - 160 : H - 70, tip, 30, '#ffffff', { stroke: '#4a2f17', strokeThickness: 5, align: 'center', wordWrap: { width: W - 120, useAdvancedWrap: true } }).setOrigin(0.5);
      this.input.keyboard && this.input.keyboard.on('keydown-SPACE', go);
      if (getChar()) button(this, W - (P ? 130 : 140), P ? 90 : 70, P ? 220 : 220, P ? 90 : 80, '换角色', () => { if (!this.picker) this.pickChar(); }, { secondary: true, size: 32 });
      // 账号入口（没配置 Firebase 时不显示）
      if (window.Store.enabled) {
        const ab = button(this, W / 2, P ? H * 0.55 + 200 : 830, P ? 520 : 420, P ? 110 : 90, acctLabel(), () => window.AccountUI.open(), { secondary: true, size: P ? 38 : 34 });
        const off = window.Store.onChange(() => ab.scene && ab.label.setText(acctLabel()));
        this.events.once('shutdown', off);
      }
    }
  }
  // 选角色弹层（标题页用）：两张卡片，点一张就记下来；onDone 有传就接着开始游戏
  Title.prototype.pickChar = function (onDone) {
    const Lx = layout(this.scale.width, this.scale.height), { W, H, P } = Lx, cur = getChar();
    const o = this.picker = this.add.container(0, 0).setDepth(500);
    const close = () => { o.destroy(); this.picker = null; };
    o.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setInteractive().on('pointerdown', () => { if (!onDone) close(); }));
    const pw = P ? 960 : 1100, ph = P ? 900 : 760, cy = H / 2;
    o.add(panel(this, W / 2, cy, pw, ph, 'ui_panel'));
    o.add(T(this, W / 2, cy - ph / 2 + 110, '选择你的钓手', 56, INK).setOrigin(0.5));
    o.add(TB(this, W / 2, cy - ph / 2 + 175, '之后可以在标题页右上角「换角色」', 28, '#7a5a3a').setOrigin(0.5));
    [['female', '女生', -1], ['male', '男生', 1]].forEach(([c, label, side]) => {
      const cx = W / 2 + side * (P ? 220 : 250), cardY = cy + (P ? 60 : 50), cw = P ? 380 : 420, chh = P ? 520 : 440;
      const g = this.add.graphics();
      const draw = hl => { g.clear(); g.fillStyle(0xffffff, 1).fillRoundedRect(cx - cw / 2, cardY - chh / 2, cw, chh, 30); g.lineStyle(hl ? 10 : 6, hl ? 0xe8a93a : 0xd9c29a, 1).strokeRoundedRect(cx - cw / 2, cardY - chh / 2, cw, chh, 30); };
      draw(c === cur);
      const img = fit(this.add.image(cx, cardY - 30, (c === 'male' ? 'player_male_' : 'player_') + 'idle'), cw - 60, chh - 130);
      const name = T(this, cx, cardY + chh / 2 - 55, label, 46, INK).setOrigin(0.5);
      const hit = this.add.zone(cx, cardY, cw, chh).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => draw(true)); hit.on('pointerout', () => draw(c === getChar()));
      hit.on('pointerdown', () => { A.unlock(); A.play('click'); setChar(c); close(); if (onDone) onDone(); else this.scene.restart(); });
      o.add([g, img, name, hit]);
    });
    if (!onDone) o.add(button(this, W / 2 + pw / 2 - 80, cy - ph / 2 + 80, 80, 80, '✕', close, { secondary: true, size: 34 }));
  };
  function acctLabel() { const S = window.Store; return !S.ready ? '账号' : S.user ? `账号：${S.user.name}` : '登录 / 注册 · 存进度'; }

  // ---------------- 钓鱼主场景 ----------------
  class Game extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
      const Lx = this.Lx = layout(this.scale.width, this.scale.height);
      this.playerHome = null; // 转屏重排时布局变了，默认站位要重新取
      this.save = window.Store.save; // 同一个对象：登录 / 云端合并时原地更新
      this.water = (() => { try { return localStorage.getItem('fishing.water') || 'sea'; } catch (e) { return 'sea'; } })();
      if (D.EVENTS[this.water] && !xmasOn()) this.water = 'sea'; // 活动结束了，回到海边
      this.sc = currentScene(this.water);
      this.state = 'idle';
      this.overlay = null;
      this.toastQ = []; this.toasting = false;
      this.musicSeason = null;

      this.bg = this.add.image(0, Lx.H, '__DEFAULT').setOrigin(0, 1).setVisible(false);
      this.dim = this.add.rectangle(Lx.W / 2, Lx.H / 2, Lx.W, Lx.H, 0x1a2a3a, 0).setDepth(5);
      this.rain = this.add.particles(0, 0, 'drop', {
        x: { min: -100, max: Lx.W + 300 }, y: -40, lifespan: Lx.H / 1.5, speedY: { min: 1300, max: 1700 }, speedX: { min: -320, max: -240 },
        quantity: Math.ceil(Lx.W / 400), frequency: 16, alpha: { start: 0.7, end: 0.3 }, emitting: false,
      }).setDepth(6);
      this.snow = this.add.particles(0, 0, 'flake', { // 圣诞场一直下雪；雨天下得大一点
        x: { min: -100, max: Lx.W + 100 }, y: -20, lifespan: Lx.H / 0.11, speedY: { min: 70, max: 140 }, speedX: { min: -40, max: 30 },
        scale: { min: 0.35, max: 1.1 }, quantity: 1, frequency: 90, alpha: { start: 0.95, end: 0.6 }, emitting: false,
      }).setDepth(6);
      this.time.addEvent({ delay: 110, loop: true, callback: () => this.ripple() });

      this.lineG = this.add.graphics().setDepth(20);
      this.rodG = this.add.graphics().setDepth(22); // 鱼竿在人物前面，才像握在手里（没有鱼竿素材时用它画）
      this.rodImg = has(this, 'player_rod') ? this.add.image(0, 0, 'player_rod').setDepth(22) : null;
      this.player = this.add.image(Lx.player.x, Lx.player.y, pkey('idle')).setOrigin(0.5, 1).setDisplaySize(Lx.player.size, Lx.player.size).setDepth(21);
      this.float = this.add.image(Lx.rodTip.x, Lx.rodTip.y, 'player_float').setDisplaySize(56, 56).setDepth(19).setVisible(false);
      this.bang = T(this, 0, 0, '！', 96, '#ff3b30', { stroke: '#ffffff', strokeThickness: 10 }).setOrigin(0.5).setDepth(40).setVisible(false);
      this.barG = this.add.graphics().setDepth(30);
      this.barText = this.add.container(0, 0).setDepth(31);

      this.buildHud();
      this.hint = TB(this, Lx.W / 2, Lx.hintY, '', 36, '#ffffff', { stroke: '#2a1a0a', strokeThickness: 7, align: 'center', wordWrap: { width: Lx.W - 80, useAdvancedWrap: true } }).setOrigin(0.5).setDepth(50);
      this.msg = T(this, Lx.W / 2, Lx.msgY, '', Lx.P ? 60 : 72, '#ffffff', { stroke: '#2a1a0a', strokeThickness: 10, align: 'center', wordWrap: { width: Lx.W - 100, useAdvancedWrap: true } }).setOrigin(0.5).setDepth(60).setAlpha(0);
      this.setIdle();
      this.applyScene(true);

      this.input.addPointer(1);
      this.input.on('pointerdown', (p, over) => { if (this.overlay || (over && over.length)) return; this.press(); });
      this.input.on('pointerup', () => this.release());
      if (this.input.keyboard) {
        this.input.keyboard.on('keydown-SPACE', e => { if (!e.repeat && !this.overlay) this.press(); });
        this.input.keyboard.on('keyup-SPACE', () => this.release());
      }
      this.onBlur = () => this.release();
      this.game.events.on('blur', this.onBlur);
      this.events.once('shutdown', () => this.game.events.off('blur', this.onBlur));
      this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickClock() });
      this.tickClock();
      let uid = window.Store.user && window.Store.user.uid;
      const offStore = window.Store.onChange(S => { // 登录 / 退出后，开着的榜单刷新一下
        const want = pkey(poseName(this.player.texture.key)); // 账号同步下来的角色可能不一样
        if (this.player.texture.key !== want && has(this, want)) this.player.setTexture(want);
        const u = S.user && S.user.uid; if (u === uid) return; uid = u;
        if (this.overlay && this.overlayKind === 'rank') this.openRank();
      });
      this.events.once('shutdown', offStore);
    }

    bgKey() { return D.EVENTS[this.water] ? `${this.Lx.P ? 'bgp' : 'bg'}_event_${this.water}` : `${this.Lx.P ? 'bgp' : 'bg'}_${this.sc.season}_${this.water}`; }
    winterRiver() { return this.sc.season === 'winter' && this.water === 'river'; }
    iceHole() { // 按素材规定的比例算（1920×1080 / 1080×1920），不依赖背景是否已加载完
      const Lx = this.Lx, iw = Lx.P ? 1080 : 1920, ih = Lx.P ? 1920 : 1080, s = Math.max(Lx.W / iw, Lx.H / ih), [fx, fy] = ICE[Lx.P ? 'portrait' : 'landscape'];
      return { x: fx * iw * s, y: Lx.H - (1 - fy) * ih * s };
    }
    floatTarget(d) { return this.winterRiver() ? this.iceHole() : this.far(d); }
    // 浮标落点。圣诞场横屏的码头往右伸得更远，按圣诞背景（1920×1080，cover + 左下对齐）的水面重算，免得近投落在码头上
    far(d) {
      const Lx = this.Lx;
      if (!D.EVENTS[this.water] || Lx.P) return Lx.far(d);
      const s = Math.max(Lx.W / 1920, Lx.H / 1080);
      return { x: Math.min(Lx.W - 120, (0.56 + 0.30 * d) * 1920 * s), y: Lx.H - (1 - (0.74 - 0.16 * d)) * 1080 * s };
    }

    // ---------- HUD ----------
    buildHud() {
      const Lx = this.Lx, d = 100, W = Lx.W;
      // 顶栏素材：只横向拉伸中段（左舵轮、右救生圈保持原比例），整体按高度等比缩放
      const barH = Lx.P ? 140 : Lx.hudH, bs = barH / 240, orn = has(this, 'ui_topbar') ? 300 * bs : 0;
      if (has(this, 'ui_topbar')) this.add.nineslice(W / 2, barH / 2, 'ui_topbar', null, W / bs, 240, 300, 310).setScale(bs).setDepth(d);
      else { const g = this.add.graphics().setDepth(d); g.fillStyle(0x6b4220, 0.88); g.fillRect(0, 0, W, Lx.hudH); g.fillStyle(0x9a6534, 1); g.fillRect(0, Lx.hudH - 8, W, 8); }
      const tx = Math.max(32, orn - 10);
      this.sceneText = T(this, tx, Lx.P ? 18 : 10, '', Lx.P ? 46 : 42, '#fff6e0', { stroke: '#3a2410', strokeThickness: 6 }).setDepth(d + 1);
      this.clockText = TB(this, tx + 2, Lx.P ? 74 : 62, '', Lx.P ? 26 : 22, '#ffe9c4', { stroke: '#3a2410', strokeThickness: 4 }).setDepth(d + 1);
      const mk = (x, y, w, h, label, fn, sec) => button(this, x, y, w, h, label, fn, { secondary: sec, size: 30 }).setDepth(d + 1);
      if (Lx.P) {
        const ex = xmasOn(), y = 172, bw = ex ? 162 : 196, step = ex ? 174 : 209, x0 = 22 + bw / 2; // 圣诞场开放时多一个按钮，整排缩窄
        this.waterBtns = { sea: mk(x0, y, bw, 84, '海边', () => this.switchWater('sea'), true), river: mk(x0 + step, y, bw, 84, '河边', () => this.switchWater('river'), true) };
        let i = 2;
        if (ex) this.waterBtns.xmas = mk(x0 + step * i++, y, bw, 84, '圣诞', () => this.switchWater('xmas'), true);
        mk(x0 + step * i++, y, bw, 84, '图鉴', () => this.openBook());
        mk(x0 + step * i++, y, bw, 84, '成就', () => this.openAch());
        mk(x0 + step * i++, y, bw, 84, '榜单', () => this.openRank());
        this.muteBtn = this.soundButton(W - Math.max(70, orn + 40), 66, 96, mk);
      } else {
        const ex = xmasOn(), r = Math.max(0, orn - 40); // r：给右边救生圈让位
        const waters = [['sea', '海边'], ['river', '河边']].concat(ex ? [['xmas', '圣诞']] : []);
        const tools = [['图鉴', () => this.openBook()], ['成就', () => this.openAch()], ['成就榜', () => this.openRank()]];
        let wb = ex ? 150 : 170, ws = ex ? 165 : 190, wx = ex ? 720 : 760, tb = 170, tx = W - 660 - r, ts = 190;
        if (wx + ws * (waters.length - 1) + wb / 2 + 20 > tx - tb / 2) { // 窄横屏（如 4:3 平板）放不下：整排按钮在标题右边平均排开
          const left = 570, right = W - 150 - r, step = (right - left) / (waters.length + tools.length);
          wb = tb = Math.min(170, step + 20); // 底图两端各有约 30px 透明边，稍微叠一点看不出来；太窄底图会被压成细条
          ws = ts = step; wx = left + step / 2; tx = wx + step * waters.length;
        }
        this.waterBtns = {};
        waters.forEach(([id, label], i) => { this.waterBtns[id] = mk(wx + ws * i, 56, wb, 80, label, () => this.switchWater(id), true); });
        tools.forEach(([label, fn], i) => mk(tx + ts * i, 56, tb, 80, label, fn));
        this.muteBtn = this.soundButton(W - 90 - r, 56, 88, mk);
      }
      this.drawMute();
    }

    // 声音按钮：有素材就用整颗圆形木按钮图，没有就用普通按钮 + 画的喇叭
    soundButton(x, y, size, mk) {
      if (has(this, 'ui_btn_sound_on')) {
        const img = this.add.image(x, y, 'ui_btn_sound_on').setDisplaySize(size, size).setDepth(101).setInteractive({ useHandCursor: true });
        img.on('pointerdown', () => { A.unlock(); A.play('click'); this.toggleMute(); });
        if (!TOUCH) { img.on('pointerover', () => img.setDisplaySize(size * 1.06, size * 1.06)); img.on('pointerout', () => img.setDisplaySize(size, size)); }
        return img;
      }
      const b = mk(x, y, size + 4, size - 12, '', () => this.toggleMute(), true);
      this.muteIcon = this.add.graphics(); b.add(this.muteIcon);
      return b;
    }

    // 声音按钮画成喇叭图标（emoji 和游戏画风不搭）
    drawMute() {
      if (!this.muteIcon) { this.muteBtn.setTexture(A.isMuted() ? 'ui_btn_sound_off' : 'ui_btn_sound_on'); return; }
      const g = this.muteIcon, m = A.isMuted(); g.clear(); this.muteBtn.label.setText('');
      g.lineStyle(5, 0x6b4220, 1); g.fillStyle(0xffffff, 1);
      const body = [{ x: -24, y: -9 }, { x: -12, y: -9 }, { x: 2, y: -22 }, { x: 2, y: 22 }, { x: -12, y: 9 }, { x: -24, y: 9 }];
      g.fillPoints(body, true); g.strokePoints(body, true);
      if (m) { g.lineStyle(6, 0xffffff, 1); g.lineBetween(12, -10, 30, 10); g.lineBetween(30, -10, 12, 10); g.lineStyle(2, 0x6b4220, 1); }
      else { g.lineStyle(5, 0xffffff, 1); g.beginPath(); g.arc(4, 0, 13, -0.8, 0.8); g.strokePath(); g.beginPath(); g.arc(4, 0, 24, -0.8, 0.8); g.strokePath(); }
    }

    toggleMute() { A.setMuted(!A.isMuted()); this.drawMute(); }

    refreshHud() {
      this.sceneText.setText(sceneLabel(this.sc));
      Object.keys(this.waterBtns).forEach(w => this.waterBtns[w].setAlpha(w === this.water ? 1 : 0.55));
    }

    tickClock() {
      const s = currentScene(this.water);
      const sh = Math.ceil(s.nextSeasonIn / 3600000), sd = Math.floor(sh / 24); // 2 天一季，精确到小时
      this.clockText.setText(`下次变天 ${mmss(s.nextWeatherIn)} · 换季还有 ${sd ? sd + ' 天 ' : ''}${sh % 24 || !sd ? (sh % 24) + ' 小时' : ''}`.trim());
      if (s.season !== this.sc.season || s.weather !== this.sc.weather) { this.sc = s; this.applyScene(false); }
      if (D.EVENTS[this.water] && !xmasOn() && this.state === 'idle') { this.switchWater('sea'); this.flash('圣诞限定场已经结束，明年 12 月见～'); }
    }

    // 竖屏：人物站到当前背景的码头 / 岸上（横屏的背景都在同一位置有码头，不用换）
    placePlayer() {
      const Lx = this.Lx, key = D.EVENTS[this.water] ? this.water : `${this.sc.season}_${this.water}`, spot = (Lx.P ? PLAYER_SPOT : PLAYER_SPOT_L)[key];
      if (!this.playerHome) this.playerHome = { x: Lx.player.x, y: Lx.player.y }; // 布局给的默认位置
      if (!spot) { Lx.player.x = this.playerHome.x; Lx.player.y = this.playerHome.y; }
      else {
        const iw = Lx.P ? 1080 : 1920, ih = Lx.P ? 1920 : 1080, s = Math.max(Lx.W / iw, Lx.H / ih), half = Lx.player.size / 2;
        Lx.player.x = Phaser.Math.Clamp(spot[0] * iw * s, half - 40, Lx.W / 2);
        Lx.player.y = Math.min(Lx.H - 20, Lx.H - (1 - spot[1]) * ih * s);
      }
      this.player.setPosition(Lx.player.x, Lx.player.y);
    }

    applyScene(first) {
      this.sc.water = this.water;
      const ev = D.EVENTS[this.water] ? this.water : null;
      SKIN = ev; // 圣诞场自动换圣诞装，回到海边 / 河边换回来
      if (ev) ensureEvent(this, ev, () => { if (this.player.scene) this.player.setTexture(pkey(poseName(this.player.texture.key))); });
      if (this.player) this.player.setTexture(pkey(poseName(this.player.texture.key)));
      this.placePlayer();
      const key = this.bgKey();
      ensureBg(this, key, () => { if (!this.bg.scene || this.bgKey() !== key) return; this.bg.setTexture(key).setVisible(true); this.bg.setScale(bgMap(this.Lx, this.bg.texture).s); });
      const rainy = this.sc.weather === 'rainy';
      this.dim.setFillStyle(0x1a2a3a, rainy ? 0.28 : 0);
      if (rainy && !ev) this.rain.start(); else this.rain.stop();
      if (ev) { this.snow.setFrequency(rainy ? 30 : 90, rainy ? 2 : 1); this.snow.start(); } else this.snow.stop();
      A.setRain(rainy && !ev);
      const song = ev || this.sc.season; // 圣诞场放圣诞 BGM
      if (this.musicSeason !== song) { this.musicSeason = song; A.startMusic(song); }
      this.refreshHud();
      if (!first) this.flash(`天气变了：${sceneLabel(this.sc)}`);
    }

    switchWater(w) {
      if (this.state !== 'idle') { this.flash('先收竿再换地方'); return; }
      if (w === this.water) return;
      this.water = w;
      try { localStorage.setItem('fishing.water', w); } catch (e) { /* ignore */ }
      this.sc = currentScene(w);
      this.applyScene(true);
    }

    ripple() {
      if (this.sc.weather !== 'rainy' || D.EVENTS[this.water]) return;
      const Lx = this.Lx;
      let x, y;
      if (this.winterRiver()) { const h = this.iceHole(); x = h.x + Phaser.Math.Between(-80, 80); y = h.y + Phaser.Math.Between(-18, 18); }
      else { x = Phaser.Math.Between(Lx.P ? 120 : 650, Lx.W); y = Phaser.Math.Between(Lx.waterTop, Lx.P ? Lx.H * 0.8 : Lx.H); }
      const e = this.add.ellipse(x, y, 10, 4).setStrokeStyle(2, 0xffffff, 0.6).setDepth(7);
      this.tweens.add({ targets: e, scaleX: 5, scaleY: 5, alpha: 0, duration: 700, onComplete: () => e.destroy() });
    }

    flash(text, color) {
      this.msg.setText(text).setColor(color || '#ffffff').setAlpha(1).setScale(0.8);
      this.tweens.killTweensOf(this.msg);
      this.tweens.add({ targets: this.msg, scale: 1, duration: 200, ease: 'Back.Out' });
      this.tweens.add({ targets: this.msg, alpha: 0, delay: 1600, duration: 500 });
    }

    // ---------- 状态机 ----------
    setIdle() {
      this.state = 'idle';
      this.player.setTexture(pkey('idle'));
      this.float.setVisible(false); this.bang.setVisible(false);
      this.hint.setText(TOUCH ? '按住屏幕蓄力，松手抛竿' : '按住鼠标或空格蓄力，松开抛竿');
      this.barG.clear(); this.barText.removeAll(true); this.chargeLabel = false;
    }

    press() {
      A.unlock();
      if (this.state === 'idle') { this.state = 'charging'; this.charge = 0; this.chargeT = 0; this.player.setTexture(pkey('cast')); this.hint.setText('松手抛竿 —— 力度越大抛得越远，远处稀有鱼更多'); }
      else if (this.state === 'waiting') { this.time.removeEvent(this.biteTimer); this.flash('收得太早了，鱼还没咬钩'); this.endCast(); }
      else if (this.state === 'bite') { this.time.removeEvent(this.biteTimer); this.startReel(); }
      else if (this.state === 'reeling') this.holding = true;
    }

    release() {
      if (this.state === 'charging') this.cast();
      if (this.state === 'reeling') this.holding = false;
    }

    cast() {
      this.state = 'casting';
      this.barG.clear(); this.barText.removeAll(true); this.chargeLabel = false;
      const d = this.charge, tip = this.rodGeom().tip;
      this.hook = this.rollFish(d);
      const tgt = this.floatHome = this.floatTarget(d);
      this.player.setTexture(pkey('wait'));
      this.float.setVisible(true).setPosition(tip.x, tip.y);
      A.play('cast');
      this.tweens.addCounter({
        from: 0, to: 1, duration: 650, ease: 'Sine.Out',
        onUpdate: tw => { const t = tw.getValue(); this.float.setPosition(tip.x + (tgt.x - tip.x) * t, tip.y + (tgt.y - tip.y) * t - Math.sin(t * Math.PI) * 260); },
        onComplete: () => {
          A.play('splash'); this.splash(tgt.x, tgt.y);
          this.state = 'waiting';
          this.hint.setText('等鱼咬钩…（浮标下沉时马上点一下）');
          const wait = Phaser.Math.Between(1500, 5000) * (this.sc.weather === 'rainy' ? 0.7 : 1);
          this.biteTimer = this.time.delayedCall(wait, () => this.bite());
        },
      });
    }

    rollFish(d) {
      const force = Q.get('force') && D.FISH.concat(D.EVENT_FISH).find(f => f.id === Q.get('force'));
      if (force) { const [lo, hi] = D.RARITY[force.rarity].weight; return { fish: force, weight: Math.round((lo + (hi - lo) * Math.random()) * 100) / 100 }; }
      return L.pickFish(this.sc, d);
    }

    splash(x, y) {
      for (let i = 0; i < 10; i++) {
        const c = this.add.circle(x, y, Phaser.Math.Between(4, 9), 0xffffff, 0.9).setDepth(18);
        this.tweens.add({ targets: c, x: x + Phaser.Math.Between(-70, 70), y: y - Phaser.Math.Between(30, 110), alpha: 0, duration: 520, ease: 'Quad.Out', onComplete: () => c.destroy() });
      }
      const e = this.add.ellipse(x, y + 10, 30, 10).setStrokeStyle(3, 0xffffff, 0.8).setDepth(18);
      this.tweens.add({ targets: e, scaleX: 5, scaleY: 4, alpha: 0, duration: 700, onComplete: () => e.destroy() });
    }

    bite() {
      this.state = 'bite';
      A.play('bite');
      if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) { /* ignore */ }
      this.bang.setVisible(true).setPosition(this.float.x, this.float.y - 110).setScale(0.5);
      this.tweens.add({ targets: this.bang, scale: 1, duration: 150, ease: 'Back.Out' });
      this.hint.setText('咬钩了！快点一下提竿！');
      this.biteTimer = this.time.delayedCall(1000, () => { A.play('escape'); this.flash('鱼跑掉了…（咬钩后 1 秒内要提竿）'); this.endCast(); });
    }

    startReel() {
      this.state = 'reeling';
      this.bang.setVisible(false);
      this.player.setTexture(pkey('reel'));
      const R = D.RARITY[this.hook.fish.rarity];
      this.reel = { tension: 0.5, progress: 0, lo: 0.55 - R.safe / 2, hi: 0.55 + R.safe / 2, strength: R.strength, reelTime: R.reelTime, phase: Math.random() * 10, jerk: 1.2, grace: 0.6, tick: 0 };
      this.holding = true;
      this.hint.setText(TOUCH ? '按住收线、松手放线 —— 让张力停在绿色区域' : '按住收线、松开放线 —— 让张力停在绿色区域');
      if (this.hook.fish.rarity === 'monster') { this.cameras.main.shake(600, 0.006); A.play('monster'); this.flash('！！！有什么巨大的东西咬钩了', '#ff6b5e'); }
      this.buildBarLabels();
    }

    buildBarLabels() {
      const t = this.Lx.tension, p = this.Lx.progress, cx = t.x + t.w / 2;
      this.barText.removeAll(true);
      this.barText.add(T(this, cx, t.top - 28, '过紧', 26, '#ffffff', { stroke: '#7a1a12', strokeThickness: 5 }).setOrigin(0.5));
      this.barText.add(T(this, cx, t.top + t.h + 30, '过松', 26, '#ffffff', { stroke: '#123a7a', strokeThickness: 5 }).setOrigin(0.5));
      this.barText.add(T(this, cx, t.top - 70, '张力', 30, '#ffffff', { stroke: '#2a1a0a', strokeThickness: 6 }).setOrigin(0.5));
      this.barText.add(T(this, p.cx, p.y - 36, '收线进度', 28, '#ffffff', { stroke: '#2a1a0a', strokeThickness: 5 }).setOrigin(0.5));
    }

    endCast() {
      const tip = this.rodGeom().tip;
      this.tweens.add({ targets: this.float, x: tip.x, y: tip.y, duration: 300, onComplete: () => this.setIdle() });
      this.state = 'retrieving'; this.bang.setVisible(false); this.barG.clear(); this.barText.removeAll(true);
    }

    update(time, delta) {
      const dt = Math.min(delta, 50) / 1000;
      if (this.state === 'charging') { this.chargeT += dt; this.charge = 0.5 - 0.5 * Math.cos(this.chargeT * 2.4); this.drawCharge(); }
      if (this.state === 'waiting') this.float.y = this.floatHome.y + Math.sin(time / 300) * 4;
      if (this.state === 'bite') this.float.y = this.floatHome.y + 16 + Math.sin(time / 40) * 6;
      if (this.state === 'reeling') this.updateReel(dt, time);
      this.drawLine();
    }

    updateReel(dt, time) {
      const r = this.reel, tip = this.rodGeom().tip;
      r.phase += dt;
      r.tension += (this.holding ? 0.75 : -0.6) * dt;
      r.tension += r.strength * (0.35 * Math.sin(r.phase * 2.3) + 0.25 * Math.sin(r.phase * 5.1 + 1)) * dt;
      r.jerk -= dt;
      if (r.jerk <= 0) {
        const sign = Math.random() < 0.7 ? 1 : -1;
        r.tension += sign * (0.08 + 0.18 * r.strength * Math.random());
        r.jerk = 0.7 + Math.random() * 1.6 / (0.5 + r.strength);
        A.play('jerk');
        this.tweens.add({ targets: this.float, x: this.floatHome.x + Phaser.Math.Between(-60, 60), duration: 200, ease: 'Quad.Out' });
      }
      if (this.holding) { r.tick -= dt; if (r.tick <= 0) { A.play('reel'); r.tick = 0.08; } }
      const inZone = r.tension >= r.lo && r.tension <= r.hi;
      r.progress = Math.max(0, r.progress + (inZone ? dt / r.reelTime : -0.12 * dt));
      r.grace -= dt;
      // 收线时浮标往近处的水面拉（近投落点，所有背景里都确认是水），不往竿尖拉，否则会被拖到码头 / 岸上
      const end = this.winterRiver() ? this.floatHome : this.far(0);
      const tx = this.floatHome.x + (end.x - this.floatHome.x) * r.progress;
      const ty = this.floatHome.y + (end.y - this.floatHome.y) * r.progress;
      this.float.x += (tx - this.float.x) * Math.min(1, dt * 3);
      this.float.y = ty + 12 + Math.sin(time / 60) * 5 * r.strength;
      this.drawReelBars(inZone);
      if (r.tension >= 1) { A.play('snap'); this.cameras.main.shake(200, 0.004); this.flash('啪！线断了 —— 拉得太紧', '#ff6b5e'); this.endCast(); }
      else if (r.tension <= 0 && r.grace <= 0) { A.play('escape'); this.flash('鱼脱钩了 —— 线放得太松', '#9fd4ff'); this.endCast(); }
      else if (r.progress >= 1) this.landFish();
    }

    drawCharge() {
      const c = this.Lx.charge, g = this.barG; g.clear();
      const x = c.cx - c.w / 2, y = c.y, h = 36;
      g.fillStyle(0x2a1a0a, 0.8); g.fillRoundedRect(x - 6, y - 6, c.w + 12, h + 12, 14);
      g.fillStyle(lerpColor(0x7ed957, 0xff5a3c, this.charge), 1); g.fillRoundedRect(x, y, Math.max(12, c.w * this.charge), h, 10);
      if (!this.chargeLabel) { this.barText.add(T(this, c.cx, y - 34, '力度', 28, '#ffffff', { stroke: '#2a1a0a', strokeThickness: 5 }).setOrigin(0.5)); this.chargeLabel = true; }
    }

    drawReelBars(inZone) {
      const r = this.reel, g = this.barG, t = this.Lx.tension, p = this.Lx.progress; g.clear();
      const y = v => t.top + t.h * (1 - v);
      g.fillStyle(0x2a1a0a, 0.85); g.fillRoundedRect(t.x - 8, t.top - 8, t.w + 16, t.h + 16, 16);
      g.fillStyle(0xe8453c, 1); g.fillRect(t.x, t.top, t.w, y(r.hi) - t.top);
      g.fillStyle(0x5ad16b, 1); g.fillRect(t.x, y(r.hi), t.w, y(r.lo) - y(r.hi));
      g.fillStyle(0x3d8bfd, 1); g.fillRect(t.x, y(r.lo), t.w, t.top + t.h - y(r.lo));
      const ty = y(Phaser.Math.Clamp(r.tension, 0, 1));
      g.fillStyle(0xffffff, 1); g.fillRect(t.x - 18, ty - 5, t.w + 36, 10);
      g.lineStyle(3, 0x2a1a0a, 1); g.strokeRect(t.x - 18, ty - 5, t.w + 36, 10);
      const px = p.cx - p.w / 2, ph = 30;
      g.fillStyle(0x2a1a0a, 0.85); g.fillRoundedRect(px - 6, p.y - 6, p.w + 12, ph + 12, 14);
      g.fillStyle(inZone ? 0xffd23f : 0xb8a070, 1); g.fillRoundedRect(px, p.y, Math.max(10, p.w * r.progress), ph, 10);
    }

    // 鱼竿几何：手柄尾端（拳头后面一点）→ 拳头 → 竿尖；收线时按张力往下弯
    rodGeom() {
      const Lx = this.Lx, S = Lx.player.size, p = poseOf(this.player.texture.key);
      const hand = { x: Lx.player.x + (p.hand[0] / 512 - 0.5) * S, y: Lx.player.y - S + p.hand[1] / 512 * S };
      if (this.rodImg) { // 鱼竿素材：按姿势方向旋转，长度比原来的线长一点
        const key = this.state === 'reeling' && has(this, 'player_rod_bent') ? 'player_rod_bent' : 'player_rod', R = ROD_IMG[key];
        const ang = Math.atan2(p.rod[1], p.rod[0]), k = Math.hypot(p.rod[0], p.rod[1]) * S * 1.12 / (ROD_IMG.player_rod.tip[0] - R.grip[0]);
        const lx = (R.tip[0] - R.grip[0]) * k, ly = (R.tip[1] - R.grip[1]) * k, c = Math.cos(ang), sn = Math.sin(ang);
        return { hand, key, ang, k, R, tip: { x: hand.x + lx * c - ly * sn, y: hand.y + lx * sn + ly * c } };
      }
      const bend = this.state === 'reeling' ? 30 + this.reel.tension * 50 : 0;
      const end = { x: hand.x + p.rod[0] * S, y: hand.y + p.rod[1] * S };
      return { hand, butt: { x: hand.x - p.rod[0] * S * 0.16, y: hand.y - p.rod[1] * S * 0.16 }, end, tip: { x: end.x + bend, y: end.y + bend * 1.4 } };
    }

    drawLine() {
      const g = this.lineG, r = this.rodGeom(), tip = r.tip, rg = this.rodG; g.clear(); rg.clear();
      if (this.rodImg) {
        if (this.rodImg.texture.key !== r.key) this.rodImg.setTexture(r.key);
        this.rodImg.setOrigin(r.R.grip[0] / r.R.w, r.R.grip[1] / r.R.h).setPosition(r.hand.x, r.hand.y).setRotation(r.ang).setScale(r.k);
      } else {
      const ctrl = new Phaser.Math.Vector2((r.hand.x + r.end.x) / 2, (r.hand.y + r.end.y) / 2);
      const pts = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(r.butt.x, r.butt.y), ctrl, new Phaser.Math.Vector2(tip.x, tip.y)).getPoints(16);
      rg.lineStyle(12, 0x3a2410, 1); rg.strokePoints(pts);          // 描边
      rg.lineStyle(7, 0x9a6232, 1); rg.strokePoints(pts);           // 竿身
      rg.lineStyle(13, 0x2a1a0a, 1); rg.lineBetween(r.butt.x, r.butt.y, r.butt.x + (r.hand.x - r.butt.x) * 1.5, r.butt.y + (r.hand.y - r.butt.y) * 1.5); // 握把
      rg.fillStyle(0xd9a740, 1); rg.fillCircle(r.hand.x - (r.hand.x - r.butt.x) * 0.3, r.hand.y - (r.hand.y - r.butt.y) * 0.3, 7); // 绕线轮
      }
      if (!this.float.visible) return;
      const sag = this.state === 'reeling' ? 80 * (1 - this.reel.tension) : 120;
      const color = this.state === 'reeling' && this.reel.tension > this.reel.hi ? 0xff6b5e : 0xffffff;
      g.lineStyle(3, color, 0.9);
      g.strokePoints(new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(tip.x, tip.y), new Phaser.Math.Vector2((tip.x + this.float.x) / 2, Math.max(tip.y, this.float.y) + sag), new Phaser.Math.Vector2(this.float.x, this.float.y - 20)).getPoints(24));
    }

    // ---------- 上鱼 ----------
    landFish() {
      this.state = 'landing';
      this.barG.clear(); this.barText.removeAll(true);
      this.float.setVisible(false);
      this.player.setTexture(pkey('celebrate'));
      const { fish, weight } = this.hook;
      const res = L.recordCatch(this.save, fish, weight, this.sc, Date.now());
      window.Store.commit();
      const show = () => this.showResult(fish, weight, res);
      if (fish.rarity === 'fairy' || fish.rarity === 'goddess' || fish.rarity === 'eventHidden') return this.fairyRise(show, fish);
      if (fish.rarity === 'monster') { this.cameras.main.shake(1200, 0.014); A.play('monster'); if (navigator.vibrate) try { navigator.vibrate([200, 80, 300]); } catch (e) { /* ignore */ } this.time.delayedCall(900, show); return; }
      A.play(fish.rarity === 'common' ? 'catch' : fish.rarity === 'rare' ? 'rare' : 'exotic');
      show();
    }

    fairyRise(done, fish) {
      const big = fish.rarity === 'goddess';
      A.play('fairy'); if (big) this.time.delayedCall(700, () => A.play('exotic'));
      if (big) { this.cameras.main.flash(900, 170, 230, 255); this.dim.setFillStyle(0x001a33, 0.35); }
      const x = Phaser.Math.Clamp(this.floatHome.x, 300, this.Lx.W - 300), y = Math.max(this.floatHome.y, this.Lx.hudH + 640);
      const glow = this.add.circle(x, y, 40, big ? 0x7fd8ff : 0xfff3b0, 0.8).setDepth(45);
      this.tweens.add({ targets: glow, radius: big ? 380 : 260, alpha: 0.25, duration: 1400, ease: 'Sine.Out' });
      const sz = big ? 560 : 420;
      const f = this.add.image(x, y + 40, 'fish_' + fish.id).setDepth(46).setScale(0.1).setAlpha(0);
      this.tweens.add({ targets: f, y: y - (big ? 300 : 230), scale: Math.min(sz / f.width, sz / f.height), alpha: 1, duration: big ? 2200 : 1500, ease: 'Sine.Out' });
      for (let i = 0; i < (big ? 48 : 24); i++) {
        const s = this.add.star(x + Phaser.Math.Between(-200, 200), y + Phaser.Math.Between(-60, 40), 5, 6, 14, big ? 0xbff0ff : 0xfff6a8).setDepth(47).setAlpha(0);
        this.tweens.add({ targets: s, y: s.y - Phaser.Math.Between(150, 400), alpha: { from: 1, to: 0 }, angle: 180, duration: 1800, delay: i * 50 });
      }
      const line = big ? '凡人，你唤醒了水之女神。' : fish.rarity === 'eventHidden' ? '呵呵呵～圣诞快乐！这份礼物送给你。' : '凡人，你钓到本仙了～';
      const bubble = TB(this, x, y - (big ? 640 : 500), line, 46, big ? '#0b6e99' : '#c2185b', { backgroundColor: '#fffaf0', padding: { x: 24, y: 14 } }).setOrigin(0.5).setDepth(48).setAlpha(0);
      bubble.x = Phaser.Math.Clamp(bubble.x, bubble.width / 2 + 24, this.Lx.W - bubble.width / 2 - 24); // 台词长时别超出画面
      this.tweens.add({ targets: bubble, alpha: 1, delay: big ? 1900 : 1300, duration: 300 });
      this.time.delayedCall(big ? 4600 : 3300, () => { [glow, f, bubble].forEach(o => o.destroy()); if (big) this.dim.setFillStyle(0x1a2a3a, this.sc.weather === 'rainy' ? 0.28 : 0); done(); });
    }

    showResult(fish, weight, res) {
      const R = D.RARITY[fish.rarity], P = this.Lx.P, W = this.Lx.W;
      const titles = { common: '钓到了！', rare: '稀有鱼！', exotic: '奇珍异兽出现！', monster: '怪兽被你钓起来了！！', fairy: '小隐藏 · 四季小仙女', goddess: '大隐藏 · 水之女神', eventHidden: '圣诞限定隐藏！' };
      const pw = P ? 960 : 900, ph = P ? 1060 : 700;
      const o = this.openOverlay(pw, ph, 'ui_panel', () => this.setIdle());
      const top = this.Lx.oy - ph / 2, at = f => top + ph * f;
      o.add(T(this, W / 2, at(0.15), titles[fish.rarity], P ? 64 : 58, fish.rarity === 'common' ? '#2e8b3e' : HEX(R.color), { stroke: '#ffffff', strokeThickness: 8 }).setOrigin(0.5));
      const key = 'fish_' + fish.id;
      const img = fit(this.add.image(W / 2, at(P ? 0.40 : 0.42), key), P ? 560 : 330, P ? 440 : 300);
      o.add(img);
      this.tweens.add({ targets: img, y: img.y - 15, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.InOut' });
      o.add(T(this, W / 2, at(P ? 0.65 : 0.69), fish.name, P ? 64 : 56, INK).setOrigin(0.5));
      o.add(TB(this, W / 2, at(P ? 0.72 : 0.77), `${R.cn} · ${fmtW(weight)}`, P ? 40 : 34, HEX(R.color)).setOrigin(0.5));
      const tags = [];
      if (res.isNew) tags.push('首次钓到 · 图鉴已解锁');
      if (res.isRecord) tags.push('新纪录！');
      if (tags.length) o.add(T(this, W / 2, at(P ? 0.78 : 0.84), tags.join('  '), P ? 36 : 32, '#e07b00').setOrigin(0.5));
      o.add(button(this, W / 2, at(P ? 0.88 : 0.95) - (P ? 0 : 20), P ? 440 : 340, P ? 110 : 90, '继续钓鱼', () => this.closeOverlay()));
      res.newAch.forEach(a => this.toast(a));
    }

    toast(a) {
      this.toastQ.push(a);
      if (this.toasting) return;
      const tp = this.Lx.toast;
      const next = () => {
        const it = this.toastQ.shift();
        if (!it) { this.toasting = false; return; }
        this.toasting = true;
        A.play('achievement');
        const c = this.add.container(tp.from, tp.y).setDepth(2000);
        const g = this.add.graphics(); g.fillStyle(0x2a1a0a, 0.92); g.fillRoundedRect(-280, -64, 560, 128, 24); g.lineStyle(4, 0xffd23f, 1); g.strokeRoundedRect(-280, -64, 560, 128, 24);
        c.add(g);
        c.add(this.add.image(-210, 0, 'badge_' + it.id).setDisplaySize(90, 90));
        c.add(T(this, -150, -46, '成就解锁', 26, '#ffd23f'));
        c.add(T(this, -150, -6, `${it.name}  +${it.points}`, 36, '#ffffff'));
        this.tweens.add({ targets: c, x: tp.x, duration: 400, ease: 'Back.Out' });
        this.tweens.add({ targets: c, x: tp.from, delay: 2800, duration: 400, onComplete: () => { c.destroy(); next(); } });
      };
      next();
    }

    // ---------- 弹层 ----------
    openOverlay(w, h, key, onClose) {
      this.closeOverlay(true);
      const o = this.add.container(0, 0).setDepth(1000);
      o.add(this.add.rectangle(this.Lx.W / 2, this.Lx.H / 2, this.Lx.W, this.Lx.H, 0x000000, 0.55).setInteractive());
      o.add(panel(this, this.Lx.W / 2, this.Lx.oy, w, h, key));
      this.overlay = o; this.overlayClose = onClose;
      this.hint.setVisible(false);
      if (this.state === 'charging') this.setIdle();
      return o;
    }

    closeOverlay(silent) {
      if (!this.overlay) return;
      this.overlay.destroy(); this.overlay = null; this.overlayKind = null;
      this.hint.setVisible(true);
      const cb = this.overlayClose; this.overlayClose = null;
      if (!silent && cb) cb();
    }

    // 页面型弹层（图鉴/成就/榜单）：尽量占满顶栏以下区域
    sheet() {
      const Lx = this.Lx, w = Lx.P ? 1020 : Math.min(1700, Lx.W - 120), h = Lx.H - Lx.hudH - (Lx.P ? 50 : 40);
      const o = this.openOverlay(w, h, 'ui_panel');
      const m = has(this, 'ui_panel') ? 34 : 0; // 素材边框较厚，内容整体往里收
      const box = { o, w: w - 2 * m, h: h - 2 * m, left: Lx.W / 2 - w / 2 + m, top: Lx.oy - h / 2 + m, right: Lx.W / 2 + w / 2 - m, bottom: Lx.oy + h / 2 - m };
      o.add(button(this, box.right - 56, box.top + 56, 80, 80, '✕', () => this.closeOverlay(), { secondary: true, size: 34 }));
      return box;
    }

    busy() { if (this.state === 'idle' || this.overlay) return false; this.flash('先把这一竿钓完'); return true; }

    // 图鉴
    openBook(tab, page) {
      if (this.busy()) return;
      tab = tab || 'sea'; page = page || 0;
      const b = this.sheet(), o = b.o, P = this.Lx.P, W = this.Lx.W;
      // 节日限定页签：活动期间，或已经钓到过限定物才显示；不算进 99 种
      const showX = xmasOn() || D.EVENT_FISH.some(f => this.save.book[f.id]);
      if (tab === 'xmas' && !showX) tab = 'sea';
      const xList = D.EVENT_FISH.filter(f => f.event === 'xmas');
      if (tab === 'xmas') ensureEvent(this, 'xmas'); // 进圣诞页签时补下载限定图（第一次看可能是占位，重开就是正式图）
      const found = tab === 'xmas' ? xList.filter(f => this.save.book[f.id]).length : D.FISH.filter(f => this.save.book[f.id]).length;
      o.add(T(this, b.left + 50, b.top + 30, tab === 'xmas' ? `圣诞限定  ${found} / ${xList.length}` : `图鉴  ${found} / ${D.FISH.length}`, 48, INK));
      const TABS = [['sea', '普通·海', f => f.rarity === 'common' && f.water === 'sea'], ['river', '普通·河', f => f.rarity === 'common' && f.water === 'river'],
        ['rare', '稀有', f => f.rarity === 'rare'], ['exotic', '奇珍异兽', f => f.rarity === 'exotic'], ['monster', '怪兽·隐藏', f => f.rarity === 'monster' || f.rarity === 'fairy' || f.rarity === 'goddess']];
      if (showX) TABS.push(['xmas', '圣诞限定', f => f.event === 'xmas']);
      const tstep = Math.min(P ? 192 : 250, (b.w - 60) / TABS.length), tw = tstep - 10, ty = b.top + (P ? 128 : 112); // 页签按面板宽度平分，不会超出
      TABS.forEach(([id, label], i) => o.add(button(this, b.left + 30 + tw / 2 + i * tstep, ty, tw, 76, label, () => this.openBook(id), { secondary: id !== tab, size: P ? (showX ? 24 : 28) : 30 })));
      const list = (tab === 'xmas' ? xList : D.FISH).filter(TABS.find(t => t[0] === tab)[2]);
      const cw = 164, ch = 190, sx = 183, sy = 200;
      const cols = Math.max(1, Math.floor((b.w - 60) / sx));
      const gridTop = ty + (P ? 60 : 52), footer = P ? 210 : 90;
      const rows = Math.max(1, Math.floor((b.bottom - footer - gridTop) / sy));
      const per = cols * rows, pages = Math.ceil(list.length / per);
      page = Math.min(page, pages - 1);
      const gx = W / 2 - (cols * sx - (sx - cw)) / 2 + cw / 2;
      const shown = list.slice(page * per, page * per + per).length, usedRows = Math.max(1, Math.ceil(shown / cols));
      const hintY = Math.min(b.bottom - 70, gridTop + usedRows * sy + 30); // 提示紧跟在卡片下面，不贴着面板底
      const detail = TB(this, W / 2, hintY, '点一张卡片看详情', 30, '#7a5a3a').setOrigin(0.5);
      // 详情弹窗：在面板正中间弹出（原来写在最底部一行，很难注意到）
      const showDetail = (f, got) => {
        if (this.bookPop && this.bookPop.scene) this.bookPop.destroy();
        const R = D.RARITY[f.rarity], cy0 = b.top + b.h / 2, pw = Math.min(b.w - 60, P ? 920 : 1180), ph = P ? 640 : 440;
        const pop = this.bookPop = this.add.container(0, 0); o.add(pop);
        const shade = this.add.rectangle(W / 2, cy0, b.w, b.h, 0x3a2410, 0.35).setInteractive({ useHandCursor: true });
        shade.on('pointerdown', () => { A.play('click'); pop.destroy(); });
        const g = this.add.graphics();
        g.fillStyle(0xfffaf0, 1).fillRoundedRect(W / 2 - pw / 2, cy0 - ph / 2, pw, ph, 30);
        g.lineStyle(8, R.color, 1).strokeRoundedRect(W / 2 - pw / 2, cy0 - ph / 2, pw, ph, 30);
        pop.add([shade, g]);
        const lines = [`出现：${f.rarity === 'goddess' ? '传说中会在任何地方出现' : condText(f)}`];
        if (got) lines.push(`最大 ${fmtW(got.maxW)} · 钓到 ${got.count} 次`, f.desc); else lines.push('还没有钓到过');
        let img, tx, ty0, tw;
        if (P) { img = fit(this.add.image(W / 2, cy0 - ph / 2 + 150, 'fish_' + f.id), 300, 220); tx = W / 2 - pw / 2 + 50; ty0 = cy0 - ph / 2 + 290; tw = pw - 100; }
        else { img = fit(this.add.image(W / 2 - pw / 2 + 210, cy0, 'fish_' + f.id), 340, 300); tx = W / 2 - pw / 2 + 420; ty0 = cy0 - ph / 2 + 50; tw = pw - 470; }
        if (!got) img.setTintFill(0x3a3a4a);
        pop.add(img);
        pop.add(T(this, tx, ty0, got ? f.name : '???', 50, INK));
        pop.add(TB(this, tx, ty0 + 70, R.cn, 30, HEX(R.color)));
        pop.add(TB(this, tx, ty0 + 120, lines.join('\n'), 30, '#5a3a1a', { lineSpacing: 12, wordWrap: { width: tw, useAdvancedWrap: true } }));
        pop.add(TB(this, W / 2, cy0 + ph / 2 - 34, '点任意处关闭', 24, '#9a7a5a').setOrigin(0.5));
      };
      list.slice(page * per, page * per + per).forEach((f, i) => {
        const cx = gx + (i % cols) * sx, cy = gridTop + ch / 2 + Math.floor(i / cols) * sy;
        const got = this.save.book[f.id], R = D.RARITY[f.rarity];
        const ck = 'ui_card_' + (f.rarity === 'goddess' || f.rarity === 'eventHidden' ? 'fairy' : f.rarity);
        if (has(this, ck)) o.add(this.add.image(cx, cy, ck).setDisplaySize(cw, ch));
        else { const g = this.add.graphics(); g.fillStyle(0xffffff, 1); g.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 18); g.lineStyle(6, R.color, 1); g.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 18); o.add(g); }
        const img = fit(this.add.image(cx, cy + 3, 'fish_' + f.id), 132, 104); // 卡片窗口：素材 280 高里的 58–234 像素
        if (!got) img.setTintFill(0x3a3a4a);
        o.add(img);
        o.add(T(this, cx, cy + 75, got ? f.name : '???', 26, '#ffffff', { stroke: got ? '#4a2f17' : '#7a7a86', strokeThickness: 6 }).setOrigin(0.5));
        const hit = this.add.zone(cx, cy, cw, ch).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => { A.play('click'); showDetail(f, got); });
        o.add(hit);
      });
      o.add(detail);
      if (pages > 1) {
        const px = P ? W / 2 : b.right - 330, py = P ? b.bottom - 110 : b.top + 56; // 横屏放标题那一行（关闭键左边），不跟页签抢位置
        o.add(TB(this, px, py, `${page + 1} / ${pages}`, 30, INK).setOrigin(0.5));
        if (page > 0) o.add(button(this, px - 150, py, 130, 80, '‹', () => this.openBook(tab, page - 1), { size: 48 })); // 太窄时按钮底图会被压成一条线
        if (page < pages - 1) o.add(button(this, px + 150, py, 130, 80, '›', () => this.openBook(tab, page + 1), { size: 48 }));
      }
    }

    // 成就
    openAch() {
      if (this.busy()) return;
      const b = this.sheet(), o = b.o, P = this.Lx.P;
      const st = L.stats(this.save);
      const doneN = D.ACHIEVEMENTS.filter(a => this.save.ach[a.id]).length;
      o.add(T(this, b.left + 50, b.top + 30, `成就  ${doneN} / ${D.ACHIEVEMENTS.length}`, 48, INK));
      o.add(TB(this, b.left + 50, b.top + 95, `成就点数 ${st.points} / ${st.maxPoints}`, 32, '#7a5a3a'));
      const cols = P ? 1 : 2, startY = b.top + 230, step = Math.min(170, (b.bottom - 60 - startY) / Math.ceil(D.ACHIEVEMENTS.length / cols));
      const colW = (b.w - 100) / cols;
      D.ACHIEVEMENTS.forEach((a, i) => {
        const x = b.left + 110 + (i % cols) * colW, y = startY + Math.floor(i / cols) * step;
        const done = this.save.ach[a.id];
        const bs = Math.min(120, step - 10), badge = this.add.image(x, y, 'badge_' + a.id).setDisplaySize(bs, bs);
        if (!done) badge.setTint(0x777777).setAlpha(0.6);
        o.add(badge);
        o.add(T(this, x + 85, y - 54, a.name, 36, done ? INK : '#8a8a8a'));
        o.add(TB(this, x + 85, y - 8, a.cond, 26, '#7a5a3a'));
        o.add(TB(this, x + 85, y + 28, done ? `已达成 ${new Date(done).toLocaleDateString('zh-CN')}  +${a.points}` : `未达成 · ${a.points} 点`, 24, done ? '#2e8b3e' : '#9a9a9a'));
      });
    }

    // 成就榜（只存本机：显示自己的成绩）
    openRank() {
      if (this.busy()) return;
      const b = this.sheet(), o = b.o, P = this.Lx.P, SS = window.Store;
      this.overlayKind = 'rank';
      const st = L.stats(this.save);
      const byId = Object.fromEntries(D.FISH.concat(D.EVENT_FISH).map(f => [f.id, f]));
      o.add(T(this, b.left + 50, b.top + 30, '我的成就榜', 48, INK));
      const where = SS.user ? `${SS.user.name} · 进度已存到账号` : SS.enabled ? '游客：成绩只存在这台设备，登录后可存到云端' : '成绩只存在这台设备';
      o.add(TB(this, b.left + 50, b.top + 95, `累计钓到 ${this.save.total} 条 · 雨天 ${this.save.rainCatches} 条（${where}）`, 28, '#7a5a3a', { wordWrap: { width: b.w - 160, useAdvancedWrap: true } }));
      if (SS.enabled) o.add(button(this, b.right - 56 - 60 - (P ? 130 : 150), b.top + 56, P ? 260 : 300, 80, SS.user ? '账号' : '登录 / 注册', () => window.AccountUI.open(), { secondary: true, size: 30 }));
      const best = st.top[0];
      const cards = [['成就点数', `${st.points}`, `/ ${st.maxPoints}`], ['图鉴完成度', `${Math.round(st.found / st.totalFish * 100)}%`, `${st.found} / ${st.totalFish}`],
        ['最大一条', best ? fmtW(best.w) : '—', best ? byId[best.id].name : '还没钓到']];
      const cw = P ? 290 : 440, ch = 190, cgap = P ? 30 : 70, cy = b.top + 280;
      const cx0 = this.Lx.W / 2 - (cw * 3 + cgap * 2) / 2 + cw / 2;
      cards.forEach(([t, v, s], i) => {
        const cx = cx0 + i * (cw + cgap);
        const g = this.add.graphics(); g.fillStyle(0xffffff, 1); g.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 24); g.lineStyle(5, 0xd9a740, 1); g.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 24);
        o.add(g);
        o.add(TB(this, cx, cy - 58, t, 28, '#7a5a3a').setOrigin(0.5));
        o.add(TB(this, cx, cy + 4, v, P ? 50 : 60, INK).setOrigin(0.5));
        o.add(TB(this, cx, cy + 62, s, 26, '#9a7a5a').setOrigin(0.5));
      });
      // 榜单区域：放进可滑动的容器（手指拖动 / 鼠标滚轮），超出面板的部分用遮罩裁掉
      const top = cy + 120, bottom = b.bottom - (P ? 40 : 60), view = bottom - top; // 底部避开面板花边
      const box = this.add.container(0, 0); o.add(box);
      let contentH = 0;
      const listAt = (x, y, title, rows, empty, wdt) => {
        box.add(T(this, x, y, title, 36, INK));
        if (!rows.length) box.add(TB(this, x, y + 60, empty, 30, '#9a9a9a'));
        rows.forEach((c, i) => {
          const ry = y + 60 + i * 46;
          box.add(TB(this, x, ry, `${i + 1}. ${byId[c.id].name}`, 30, i < 3 ? '#c0731c' : INK));
          box.add(TB(this, x + wdt, ry, fmtW(c.w), 30, INK).setOrigin(1, 0));
        });
        contentH = Math.max(contentH, y - top + 60 + Math.max(1, rows.length) * 46 + 20);
      };
      if (P) {
        listAt(b.left + 70, top + 30, '最大的鱼 Top 10', st.top, '还没有记录，去钓一条吧', b.w - 140);
        listAt(b.left + 70, top + 30 + 80 + Math.max(1, st.top.length) * 46 + 40, '怪兽榜 Top 5', st.topMonsters, '还没有钓到怪兽', b.w - 140);
      } else {
        listAt(b.left + 80, top + 30, '最大的鱼 Top 10', st.top, '还没有记录，去钓一条吧', 620);
        listAt(this.Lx.W / 2 + 60, top + 30, '怪兽榜 Top 5', st.topMonsters, '还没有钓到怪兽', 620);
      }
      const maskG = this.make.graphics({ add: false }); maskG.fillStyle(0xffffff).fillRect(b.left, top, b.w, view);
      box.setMask(maskG.createGeometryMask());
      o.once('destroy', () => maskG.destroy());
      const maxScroll = Math.max(0, contentH - view);
      if (maxScroll > 0) {
        const bar = this.add.graphics(); o.add(bar);
        const setY = y => {
          box.y = Phaser.Math.Clamp(y, -maxScroll, 0);
          const h = Math.max(60, view * view / contentH), t = top + (view - h) * (-box.y / maxScroll);
          bar.clear(); bar.fillStyle(0x9a6534, 0.25).fillRoundedRect(b.right - 22, top, 10, view, 5); bar.fillStyle(0x9a6534, 0.8).fillRoundedRect(b.right - 22, t, 10, h, 5);
        };
        setY(0);
        const zone = this.add.zone(b.left + b.w / 2, top + view / 2, b.w, view).setInteractive(); o.add(zone);
        let startY = 0, startBox = 0;
        zone.on('pointerdown', p => { startY = p.y; startBox = box.y; });
        zone.on('pointermove', p => { if (p.isDown) setY(startBox + (p.y - startY)); });
        zone.on('wheel', (p, dx, dy) => setY(box.y - dy));
      }
    }
  }

  // ---------------- 启动 + 转屏重排 ----------------
  const size0 = computeSize();
  const game = window.__fishing = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', width: size0.W, height: size0.H, backgroundColor: '#0d1430',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    scene: [Boot, Title, Game],
  });

  let resizeTimer = null;
  function relayout() {
    const s = computeSize();
    if (s.W === game.scale.width && s.H === game.scale.height) { game.scale.refresh(); return; }
    game.scale.setGameSize(s.W, s.H);
    ['Title', 'Game'].forEach(k => { if (game.scene.isActive(k)) game.scene.getScene(k).scene.restart(); });
  }
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(relayout, 200); });
  window.addEventListener('orientationchange', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(relayout, 350); });
})();

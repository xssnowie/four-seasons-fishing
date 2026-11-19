// 纯逻辑（不碰画面）：场景轮换、抽鱼、存档、成就。浏览器挂 window.GameLogic，Node 里给模拟脚本 require。
(function (root) {
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.GameData;

  // ---------- 场景轮换（真实时间，所有人同一时刻同一场景）----------
  const WEEK = 7 * 24 * 3600 * 1000;
  const HOUR = 3600 * 1000;
  const EPOCH = Date.UTC(2026, 0, 4, 16, 0, 0); // 2026-01-05 周一 00:00（UTC+8）作为「春季第一周」起点
  const RAIN_CHANCE = 0.35;

  function hash32(n) { // 整数 → 0..1 的稳定伪随机
    n = (n ^ 0x9e3779b9) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35) >>> 0;
    n = (n ^ (n >>> 16)) >>> 0;
    return n / 4294967296;
  }

  function sceneAt(now) {
    const week = Math.floor((now - EPOCH) / WEEK);
    const season = D.SEASONS[((week % 4) + 4) % 4];
    const hour = Math.floor(now / HOUR);
    const weather = hash32(hour) < RAIN_CHANCE ? 'rainy' : 'sunny';
    return {
      season, weather,
      nextWeatherIn: (hour + 1) * HOUR - now,
      nextSeasonIn: EPOCH + (week + 1) * WEEK - now,
    };
  }

  // ---------- 抽鱼 ----------
  function eligible(rarity, scene) {
    return D.FISH.filter(f => f.rarity === rarity &&
      (f.water == null || f.water === scene.water) &&
      (f.season == null || f.season === scene.season) &&
      (f.weather == null || f.weather === scene.weather));
  }

  // 抛竿距离 d（0..1）影响稀有概率：d=0.5 时就是 data.js 里的配置值；越远普通鱼越少。
  function rarityWeights(scene, d) {
    const k = 0.7 + 0.6 * (d == null ? 0.5 : d); // 0.7 .. 1.3
    const w = {};
    let shifted = 0;
    D.RARITY_ORDER.forEach(r => {
      if (r === 'common') return;
      const base = D.RARITY[r].prob;
      const v = eligible(r, scene).length ? base * k : 0; // 当前场景没有这类鱼 → 这份概率还给普通鱼
      w[r] = v;
      shifted += v;
    });
    w.common = 100 - shifted;
    return w;
  }

  function pickFish(scene, d, rand) {
    rand = rand || Math.random;
    const w = rarityWeights(scene, d);
    let x = rand() * 100, rarity = 'common';
    for (const r of D.RARITY_ORDER) { if (x < w[r]) { rarity = r; break; } x -= w[r]; }
    const pool = eligible(rarity, scene);
    const fish = pool[Math.floor(rand() * pool.length)];
    const [lo, hi] = D.RARITY[rarity].weight;
    const weight = Math.round((lo + (hi - lo) * Math.pow(rand(), 1.8)) * 100) / 100; // 偏小，大鱼难得
    return { fish, weight };
  }

  // ---------- 存档（只存本机）----------
  const KEY = 'fishing.save.v1';
  function emptySave() {
    return { book: {}, ach: {}, total: 0, rainCatches: 0, seasons: {}, catches: [] };
  }
  function load(storage) {
    try { const s = JSON.parse(storage.getItem(KEY)); if (s && s.book) return Object.assign(emptySave(), s); } catch (e) { /* 无存档或被禁用 */ }
    return emptySave();
  }
  function persist(storage, save) {
    try { storage.setItem(KEY, JSON.stringify(save)); return true; } catch (e) { return false; }
  }

  // 记一条鱼；返回 { isNew, isRecord, newAch: [成就] }
  function recordCatch(save, fish, weight, scene, now) {
    const prev = save.book[fish.id];
    const isNew = !prev;
    const isRecord = !!prev && weight > prev.maxW;
    save.book[fish.id] = {
      count: (prev ? prev.count : 0) + 1,
      maxW: Math.max(prev ? prev.maxW : 0, weight),
      first: prev ? prev.first : now,
    };
    save.total += 1;
    if (scene.weather === 'rainy') save.rainCatches += 1;
    save.seasons[scene.season] = true;
    save.catches.push({ id: fish.id, w: weight, t: now });
    save.catches.sort((a, b) => b.w - a.w);
    save.catches = save.catches.slice(0, 200); // 只留最大的 200 条，给成就榜用
    const newAch = checkAchievements(save, now);
    return { isNew, isRecord, newAch };
  }

  function has(save, rarityOrFilter) {
    const list = D.FISH.filter(typeof rarityOrFilter === 'function' ? rarityOrFilter : f => f.rarity === rarityOrFilter);
    return list.every(f => save.book[f.id]);
  }

  const RULES = {
    first_catch: s => s.total >= 1,
    four_seasons: s => D.SEASONS.every(x => s.seasons[x]),
    rain_master: s => s.rainCatches >= 50,
    sea_river: s => has(s, f => f.rarity === 'common'),
    exotic_hunter: s => has(s, 'exotic'),
    monster_slayer: s => D.FISH.some(f => f.rarity === 'monster' && s.book[f.id]),
    fairy: s => !!s.book.fairy,
    full_book: s => D.FISH.every(f => s.book[f.id]),
  };

  function checkAchievements(save, now) {
    const got = [];
    D.ACHIEVEMENTS.forEach(a => {
      if (!save.ach[a.id] && RULES[a.id](save)) { save.ach[a.id] = now; got.push(a); }
    });
    return got;
  }

  function stats(save) {
    const points = D.ACHIEVEMENTS.reduce((n, a) => n + (save.ach[a.id] ? a.points : 0), 0);
    const maxPoints = D.ACHIEVEMENTS.reduce((n, a) => n + a.points, 0);
    const found = D.FISH.filter(f => save.book[f.id]).length;
    const byId = Object.fromEntries(D.FISH.map(f => [f.id, f]));
    const fishOnly = save.catches.filter(c => byId[c.id] && byId[c.id].rarity !== 'monster');
    const monsters = save.catches.filter(c => byId[c.id] && byId[c.id].rarity === 'monster');
    return { points, maxPoints, found, totalFish: D.FISH.length, top: fishOnly.slice(0, 10), topMonsters: monsters.slice(0, 5) };
  }

  const api = { sceneAt, eligible, rarityWeights, pickFish, emptySave, load, persist, recordCatch, checkAchievements, stats, KEY, RAIN_CHANCE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GameLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);

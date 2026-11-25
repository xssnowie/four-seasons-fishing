// 纯逻辑（不碰画面）：场景轮换、抽鱼、存档、成就。浏览器挂 window.GameLogic，Node 里给模拟脚本 require。
(function (root) {
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.GameData;

  // ---------- 场景轮换（真实时间，所有人同一时刻同一场景）----------
  const HOUR = 3600 * 1000;
  const EPOCH = Date.UTC(2026, 0, 2, 16, 0, 0); // 2026-01-03 00:00（UTC+8）作为起点：春季第一段、晴天开始（这样改成 2 天一季时，当天的夏季接着原来的时间表在 11/23 换秋，不会跳季）
  const SEASON_LEN = 2 * 24 * HOUR;             // 每 2 天换一季，春 → 夏 → 秋 → 冬 轮流
  const SUNNY_LEN = 4 * HOUR, RAINY_LEN = 2 * HOUR, WX_CYCLE = SUNNY_LEN + RAINY_LEN; // 晴 4 小时 → 雨 2 小时，固定轮流
  const RAIN_CHANCE = RAINY_LEN / WX_CYCLE;     // 雨天占比（1/3），给模拟脚本核对用

  // 校准过的「现在」：进游戏时向网站取一次标准时间，算出和手机时钟的差；调手机时间就换不了季节、天气
  // 取不到（离线）时差为 0，照旧用手机时间
  let clockOff = 0;
  const now = () => Date.now() + clockOff;
  const setClockOffset = ms => { clockOff = ms; };

  function sceneAt(now) {
    const k = Math.floor((now - EPOCH) / SEASON_LEN);
    const season = D.SEASONS[((k % 4) + 4) % 4];
    const t = (((now - EPOCH) % WX_CYCLE) + WX_CYCLE) % WX_CYCLE; // 在 6 小时周期里的位置
    const sunny = t < SUNNY_LEN;
    return {
      season, weather: sunny ? 'sunny' : 'rainy',
      nextWeatherIn: (sunny ? SUNNY_LEN : WX_CYCLE) - t,
      nextSeasonIn: EPOCH + (k + 1) * SEASON_LEN - now,
    };
  }

  // ---------- 抽鱼 ----------
  // 节日限定场：圣诞每年 12 月（UTC+8）；感恩节这类一次性活动按 from – to 时间段
  function eventActive(id, now) {
    const ev = D.EVENTS[id]; if (!ev || ev.off) return false; // off：素材还没到，先不开
    const t = now == null ? api.now() : now;
    if (ev.from != null) return t >= ev.from && t < ev.to;
    return new Date(t + 8 * HOUR).getUTCMonth() === ev.month;
  }

  // 某一类可钓物在当前场景的鱼池。限定场里 src='base' 是普通场的鱼（海、河都算，跟季节天气），'event' 是限定物
  function eligible(rarity, scene, src) {
    const ev = D.EVENTS[scene.water];
    if (ev && !src) return eligible(rarity, scene, 'event').concat(eligible(rarity, scene, 'base'));
    const pool = ev ? (src === 'event' ? D.EVENT_FISH.filter(f => f.event === scene.water) : D.FISH) : D.FISH;
    return pool.filter(f => f.rarity === rarity &&
      (ev || f.water == null || f.water === scene.water) &&
      (f.season == null || f.season === scene.season) &&
      (f.weather == null || f.weather === scene.weather));
  }

  // 出现率表：[类别, 来源, 概率%]。普通场按 RARITY.prob；限定场按 EVENTS[x].table
  function rateTable(scene) {
    const ev = D.EVENTS[scene.water];
    if (ev) return ev.table.map(([r, src, p]) => ({ r, src, p }));
    return D.RARITY_ORDER.filter(r => r !== 'eventHidden').map(r => ({ r, src: null, p: D.RARITY[r].prob }));
  }

  // 抛竿距离 d（0..1）影响稀有概率：d=0.5 时就是配置值；越远普通鱼越少。
  // 返回每一项的权重；当前场景没有这类鱼 → 这份概率还给普通鱼（限定场还给普通·限定）
  function rarityWeights(scene, d) {
    const k = 0.7 + 0.6 * (d == null ? 0.5 : d); // 0.7 .. 1.3
    const rows = rateTable(scene), commons = rows.filter(x => x.r === 'common');
    let shifted = 0;
    rows.forEach(x => {
      if (x.r === 'common') return;
      x.w = eligible(x.r, scene, x.src || undefined).length ? x.p * k : 0;
      shifted += x.w;
    });
    // 普通鱼分剩下的：按配置比例分（限定场 30 : 38.999），没鱼的那份给另一份
    const cp = commons.reduce((a, x) => a + x.p, 0), rest = 100 - shifted;
    commons.forEach(x => { x.w = rest * x.p / cp; });
    return rows;
  }

  function pickFish(scene, d, rand) {
    rand = rand || Math.random;
    const rows = rarityWeights(scene, d);
    let x = rand() * 100, row = rows.find(r => r.r === 'common');
    for (const r of rows) { if (x < r.w) { row = r; break; } x -= r.w; }
    const pool = eligible(row.r, scene, row.src || undefined);
    const fish = pool[Math.floor(rand() * pool.length)];
    const [lo, hi] = D.RARITY[row.r].weight;
    const weight = Math.round((lo + (hi - lo) * Math.pow(rand(), 1.8)) * 100) / 100; // 偏小，大鱼难得
    return { fish, weight };
  }

  // ---------- 存档（只存本机）----------
  const KEY = 'fishing.save.v1';
  function emptySave() {
    return { book: {}, ach: {}, total: 0, rainCatches: 0, seasons: {}, catches: [], char: null, charAt: 0 }; // char：选的角色，charAt：选的时间（合并时取较新的）
  }
  function load(storage, key) {
    try { const s = JSON.parse(storage.getItem(key || KEY)); if (s && s.book) return Object.assign(emptySave(), s); } catch (e) { /* 无存档或被禁用 */ }
    return emptySave();
  }
  function persist(storage, save, key) {
    try { storage.setItem(key || KEY, JSON.stringify(save)); return true; } catch (e) { return false; }
  }

  // 两份存档合并（本机 + 云端，或游客进度并入账号）：只增不减，谁的记录好就留谁的
  function merge(a, b) {
    a = Object.assign(emptySave(), a || {}); b = Object.assign(emptySave(), b || {});
    const out = emptySave();
    new Set([...Object.keys(a.book), ...Object.keys(b.book)]).forEach(id => {
      const x = a.book[id], y = b.book[id];
      out.book[id] = !x ? Object.assign({}, y) : !y ? Object.assign({}, x)
        : { count: Math.max(x.count, y.count), maxW: Math.max(x.maxW, y.maxW), first: Math.min(x.first, y.first) };
    });
    new Set([...Object.keys(a.ach), ...Object.keys(b.ach)]).forEach(id => {
      out.ach[id] = Math.min(a.ach[id] || Infinity, b.ach[id] || Infinity);
    });
    out.total = Math.max(a.total, b.total);
    out.rainCatches = Math.max(a.rainCatches, b.rainCatches);
    Object.assign(out.seasons, a.seasons, b.seasons);
    const seen = new Set();
    out.catches = [...a.catches, ...b.catches].filter(c => { const k = c.id + '|' + c.w + '|' + c.t; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((p, q) => q.w - p.w).slice(0, 200);
    const pick = (a.charAt || 0) >= (b.charAt || 0) ? a : b; out.char = pick.char || a.char || b.char || null; out.charAt = Math.max(a.charAt || 0, b.charAt || 0);
    checkAchievements(out, api.now()); // 合并后可能凑齐新成就（例如两边各有一半图鉴）
    return out;
  }
  const isEmpty = s => !s || !s.total;

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
    fairy: s => D.FISH.some(f => f.rarity === 'fairy' && s.book[f.id]),
    goddess: s => !!s.book.goddess,
    thanks_any: s => evFish('thanks').some(f => evGot(s, f)),
    thanks_all: s => evFish('thanks').every(f => evGot(s, f)),
    xmas_any: s => evFish('xmas').some(f => evGot(s, f)),
    xmas_all: s => evFish('xmas').filter(f => f.rarity !== 'eventHidden').every(f => evGot(s, f)),
    xmas_santa: s => evFish('xmas').filter(f => f.rarity === 'eventHidden').every(f => evGot(s, f)),
  };
  // 节日限定物：只算节日第一次开放之后钓到的（开放前预览钓到的不算图鉴排名、不算成就）
  const evFish = id => D.EVENT_FISH.filter(f => f.event === id);
  const evGot = (s, f) => !!s.book[f.id] && s.book[f.id].first >= D.EVENTS[f.event].first;
  // 节日成就 / 节日限定物在节日第一次开放后才出现
  const achVisible = (a, now) => !a.event || (now == null ? api.now() : now) >= D.EVENTS[a.event].first;
  const evOpened = (f, now) => (now == null ? api.now() : now) >= D.EVENTS[f.event].first;

  function checkAchievements(save, now) {
    const got = [];
    D.ACHIEVEMENTS.forEach(a => {
      if (!save.ach[a.id] && achVisible(a, now) && RULES[a.id](save)) { save.ach[a.id] = now; got.push(a); }
    });
    return got;
  }
  // 图鉴排名：普通 99 种 + 已开放过的节日限定物
  const bookFish = now => D.FISH.concat(D.EVENT_FISH.filter(f => evOpened(f, now)));
  const bookGot = save => D.FISH.filter(f => save.book[f.id]).concat(D.EVENT_FISH.filter(f => evGot(save, f)));

  function stats(save) {
    const points = D.ACHIEVEMENTS.reduce((n, a) => n + (save.ach[a.id] ? a.points : 0), 0);
    const maxPoints = D.ACHIEVEMENTS.filter(a => achVisible(a)).reduce((n, a) => n + a.points, 0);
    const found = D.FISH.filter(f => save.book[f.id]).length;
    const byId = Object.fromEntries(D.FISH.concat(D.EVENT_FISH).map(f => [f.id, f]));
    const fishOnly = save.catches.filter(c => byId[c.id] && byId[c.id].rarity !== 'monster');
    const monsters = save.catches.filter(c => byId[c.id] && byId[c.id].rarity === 'monster');
    return { points, maxPoints, found, totalFish: D.FISH.length, top: fishOnly.slice(0, 10), topMonsters: monsters.slice(0, 5) };
  }


  // 全服排行榜的一行（Firestore ranks/{uid}）。4 个榜：pts 成就点数 · book 图鉴 · fish 最大一条（不含怪兽）· mon 最大怪兽
  // 每个榜存 值 v、达成时间 T（秒）和排序键 K = v × 1e10 + (1e10 − T)：只按 K 一个字段排，同分时先达成的 K 更大、排前面
  const RANK_E = 1e10;
  const RANK_BOARDS = ['pts', 'book', 'fish', 'mon'];
  function rankEntry(save) {
    const sec = t => Math.max(1, Math.min(RANK_E - 1, Math.floor((t || 0) / 1000)));
    const byId = Object.fromEntries(D.FISH.concat(D.EVENT_FISH).map(f => [f.id, f]));
    const done = D.ACHIEVEMENTS.filter(a => save.ach[a.id]);
    const got = bookGot(save); // 含节日限定（只算开放后钓到的）
    const fish = save.catches.find(c => byId[c.id] && byId[c.id].rarity !== 'monster');
    const mon = save.catches.find(c => byId[c.id] && byId[c.id].rarity === 'monster');
    const e = {
      pts: done.reduce((n, a) => n + a.points, 0), ptsT: sec(Math.max(0, ...done.map(a => save.ach[a.id]))),
      book: got.length, bookT: sec(Math.max(0, ...got.map(f => save.book[f.id].first))),
      fish: fish ? Math.round(fish.w * 100) : 0, fishT: sec(fish && fish.t), fishId: fish ? fish.id : '',
      mon: mon ? Math.round(mon.w * 100) : 0, monT: sec(mon && mon.t), monId: mon ? mon.id : '',
    };
    RANK_BOARDS.forEach(b => { e[b + 'K'] = e[b] * RANK_E + (RANK_E - e[b + 'T']); });
    return e;
  }

  const api = { sceneAt, eventActive, eligible, rateTable, rarityWeights, pickFish, emptySave, load, persist, merge, isEmpty, recordCatch, checkAchievements, stats, rankEntry, RANK_BOARDS, KEY, RAIN_CHANCE, now, setClockOffset, achVisible, bookFish };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GameLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);

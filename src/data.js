// 游戏数据：鱼种、稀有度、成就。浏览器里挂到 window.GameData，Node 里 module.exports（给模拟脚本用）。
(function (root) {
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON_CN = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  const WEATHER_CN = { sunny: '晴', rainy: '雨' };
  const WATER_CN = { sea: '海', river: '河' };

  // 稀有度配置。prob = 基础概率（%），抛竿距离居中时的值；safe = 张力安全区宽度；
  // strength = 鱼的挣扎力度；reelTime = 安全区内需要收线的秒数；weight = 重量区间 kg
  const RARITY = {
    common:  { cn: '普通',     prob: 60,  safe: 0.40, strength: 0.25, reelTime: 3.0, weight: [0.2, 6],     color: 0x8fa3b8, folder: 'common' },
    rare:    { cn: '稀有',     prob: 30,  safe: 0.30, strength: 0.40, reelTime: 4.5, weight: [1, 18],      color: 0x3d8bfd, folder: 'rare' },
    exotic:  { cn: '奇珍异兽', prob: 7.5, safe: 0.22, strength: 0.60, reelTime: 6.0, weight: [10, 90],     color: 0xa04dff, folder: 'exotic' },
    monster: { cn: '怪兽',     prob: 1.9, safe: 0.15, strength: 0.85, reelTime: 9.0, weight: [500, 6000],  color: 0xe8453c, folder: 'monster' },
    fairy:   { cn: '小隐藏',   prob: 0.5, safe: 0.25, strength: 0.30, reelTime: 5.0, weight: [38, 46],     color: 0xff8fc8, folder: 'fairy' },
    goddess: { cn: '大隐藏',   prob: 0.1, safe: 0.20, strength: 0.45, reelTime: 6.0, weight: [48, 52],     color: 0x1fa8d8, folder: 'fairy' },
  };
  const RARITY_ORDER = ['common', 'rare', 'exotic', 'monster', 'fairy', 'goddess'];

  const FISH = [];
  function add(rarity, id, name, water, season, weather, desc, file) {
    FISH.push({ id, name, rarity, water, season: season || null, weather: weather || null, desc: desc || '', file: file || id });
  }

  // ---- 普通 · 海（20）----
  [['sea_seabass', '海鲈'], ['sea_clownfish', '小丑鱼'], ['sea_grouper', '石斑鱼'], ['sea_saury', '秋刀鱼'],
   ['sea_tuna', '金枪鱼'], ['sea_mackerel', '鲭鱼'], ['sea_sardine', '沙丁鱼'], ['sea_flounder', '比目鱼'],
   ['sea_croaker', '黄花鱼'], ['sea_hairtail', '带鱼'], ['sea_pomfret', '鲳鱼'], ['sea_bluetang', '蓝唐王鱼'],
   ['sea_pufferfish', '河豚'], ['sea_squid', '乌贼'], ['sea_octopus', '章鱼'], ['sea_crab', '螃蟹'],
   ['sea_starfish', '海星'], ['sea_lobster', '龙虾'], ['sea_seahorse', '海马'], ['sea_eel', '海鳗'],
  ].forEach(([id, n]) => add('common', id, n, 'sea', null, null, '海边一年四季都钓得到。'));

  // ---- 普通 · 河（20）----
  [['river_crucian', '鲫鱼'], ['river_carp', '鲤鱼'], ['river_grasscarp', '草鱼'], ['river_silvercarp', '鲢鱼'],
   ['river_bighead', '胖头鱼'], ['river_tilapia', '罗非鱼'], ['river_snakehead', '黑鱼'], ['river_catfish', '鲶鱼'],
   ['river_ricefieldeel', '黄鳝'], ['river_loach', '泥鳅'], ['river_bream', '鳊鱼'], ['river_topmouth', '翘嘴'],
   ['river_mandarinfish', '桂鱼'], ['river_yellowcatfish', '黄颡鱼'], ['river_minnow', '白条'], ['river_zacco', '马口鱼'],
   ['river_shrimp', '河虾'], ['river_crayfish', '小龙虾'], ['river_mussel', '河蚌'], ['river_turtle', '巴西龟'],
  ].forEach(([id, n]) => add('common', id, n, 'river', null, null, '河边一年四季都钓得到。'));

  // ---- 稀有（32）：季节 + 水域 ----
  const RARE = {
    spring: { sea: [['sakurasnapper', '樱花鲷'], ['sakurashrimp', '樱花虾'], ['flyingfish', '飞鱼'], ['anemonecrab', '海葵蟹']],
              river: [['peachmandarin', '桃花鳜'], ['sakurasalmon', '樱花鲑'], ['peachjelly', '桃花水母'], ['willowfish', '柳叶鱼']] },
    summer: { sea: [['glowshrimp', '萤光虾'], ['mantaray', '蝠鲼'], ['sailfish', '旗鱼'], ['seaturtle', '夏日海龟']],
              river: [['lotuskoi', '荷花锦鲤'], ['fireflyfish', '萤火鱼'], ['bettafish', '斗鱼'], ['rainbowtrout', '雨后彩虹鳟']] },
    autumn: { sea: [['mapleseabream', '红叶鲷'], ['autumnsalmon', '秋鲑'], ['kingcrab', '帝王蟹'], ['cod', '银鳕鱼']],
              river: [['osmanthuscarp', '金桂鲤'], ['maple_trout', '红叶鳟'], ['hairycrab', '大闸蟹'], ['icefish', '银鱼']] },
    winter: { sea: [['icefish', '冰鱼'], ['arcticcod', '北极鳕'], ['snowcrab', '雪蟹'], ['crystaljelly', '冰晶水母']],
              river: [['sturgeon', '冰河鲟'], ['snowtrout', '雪鳟'], ['icicle_fish', '冰凌白鱼'], ['snowloach', '雪花泥鳅']] },
  };
  SEASONS.forEach(s => ['sea', 'river'].forEach(w => RARE[s][w].forEach(([id, n]) =>
    add('rare', `${s}_${w}_${id}`, n, w, s, null, `只在${SEASON_CN[s]}季的${WATER_CN[w]}里出没。`))));

  // ---- 奇珍异兽（16）：季节 + 天气 + 水域，每个场景恰好 1 种 ----
  add('exotic', 'sea_sakuraseahorse', '樱花海马精', 'sea', 'spring', 'sunny', '樱花盛开的晴天，会在码头边跳舞。');
  add('exotic', 'sea_thundershark', '雷鸣鲨', 'sea', 'spring', 'rainy', '春雷响起时出现，浑身带电。');
  add('exotic', 'sea_coralphoenix', '珊瑚凤凰鱼', 'sea', 'summer', 'sunny', '尾羽由珊瑚长成，夏日阳光下闪闪发光。');
  add('exotic', 'sea_mermaid', '人鱼', 'sea', 'summer', 'rainy', '夏天的雨夜，传说她会来借一颗珍珠。');
  add('exotic', 'sea_moonjelly', '月光水母', 'sea', 'autumn', 'sunny', '像一轮满月浮在秋天的海面。');
  add('exotic', 'sea_xuanwu', '玄武神龟', 'sea', 'autumn', 'rainy', '背负蛇纹的神龟，秋雨里慢慢浮上来。');
  add('exotic', 'sea_icedragon', '冰晶海龙', 'sea', 'winter', 'sunny', '冰晶组成的身体，晴天里会折射出彩虹。');
  add('exotic', 'sea_kun', '鲲', 'sea', 'winter', 'rainy', '北冥有鱼，其名为鲲。冬雨中偶尔露出脊背。');
  add('exotic', 'river_goldenkoi', '黄金锦鲤', 'river', 'spring', 'sunny', '钓到它，据说一整年都会好运。');
  add('exotic', 'river_waterqilin', '水麒麟', 'river', 'spring', 'rainy', '春雨里踏水而来的瑞兽。');
  add('exotic', 'river_lotusfrog', '荷仙蛙', 'river', 'summer', 'sunny', '坐在荷叶上打盹的蛙仙。');
  add('exotic', 'river_arowana', '彩虹龙鱼', 'river', 'summer', 'rainy', '雨后彩虹出现时才肯咬钩。');
  add('exotic', 'river_lingzhiturtle', '灵芝龟', 'river', 'autumn', 'sunny', '壳上长着发光的灵芝，活了一千年。');
  add('exotic', 'river_hebocarp', '河伯鲤', 'river', 'autumn', 'rainy', '戴着小王冠的河神，脾气有点大。');
  add('exotic', 'river_craneFish', '仙鹤鱼', 'river', 'winter', 'sunny', '长着鹤翼的鱼，晴朗冬日会飞出冰洞。');
  add('exotic', 'river_snowfox', '雪狐鱼', 'river', 'winter', 'rainy', '有一条蓬松狐狸尾巴，冬雨里最活跃。');

  // ---- 怪兽（6，仅海）----
  add('monster', 'thunderwhale', '雷霆巨鲸', 'sea', 'spring', 'rainy', '被风暴云包裹的巨鲸，一甩尾就是一道雷。');
  add('monster', 'seaserpent', '巨型海蛇', 'sea', 'summer', 'rainy', '盘起来有一座岛那么大。');
  add('monster', 'lavabeast', '熔岩海兽', 'sea', 'summer', 'sunny', '火山岩背壳下流着岩浆，海水都被煮沸了。');
  add('monster', 'kraken', '海怪', 'sea', 'autumn', 'rainy', '无数触手的深海霸主，秋雨夜最危险。');
  add('monster', 'icetitan', '冰原巨兽', 'sea', 'winter', 'sunny', '冰川獠牙、霜甲加身的远古巨兽。');
  add('monster', 'deepabyss', '深海巨兆', 'sea', 'winter', 'rainy', '背负珊瑚礁的深海巨兽，灯笼一亮，海面就要变天。');

  // ---- 小隐藏 · 四季小仙女（4）：各在自己的季节出现，天气水域不限 ----
  add('fairy', 'fairy_spring', '春 · 小仙女', null, 'spring', null, '桃花开的时候，她会在水边折一枝花。', 'spring');
  add('fairy', 'fairy_summer', '夏 · 小仙女', null, 'summer', null, '戴着荷花冠，最爱在荷叶上打盹。', 'summer');
  add('fairy', 'fairy_autumn', '秋 · 小仙女', null, 'autumn', null, '发间别着桂花，走过的地方都是香的。', 'autumn');
  add('fairy', 'fairy_winter', '冬 · 小仙女', null, 'winter', null, '一身雪白，鬓边一支红梅。', 'winter');

  // ---- 大隐藏 · 水之女神（1）：任何场景都可能出现 ----
  add('goddess', 'goddess', '水之女神', null, null, null, '掌管江河湖海的女神，千年才回应一次钓竿。', 'goddess');

  // ---- 成就 ----
  const ACHIEVEMENTS = [
    { id: 'first_catch',    name: '初次上钩',        cond: '钓到第 1 条鱼',              points: 10 },
    { id: 'four_seasons',   name: '四季钓手',        cond: '4 个季节都钓到过鱼',          points: 30 },
    { id: 'rain_master',    name: '风雨无阻',        cond: '雨天累计钓到 50 条',          points: 30 },
    { id: 'sea_river',      name: '海河通吃',        cond: '海、河图鉴各集齐普通鱼',      points: 40 },
    { id: 'exotic_hunter',  name: '异兽猎人',        cond: '集齐全部奇珍异兽',            points: 100 },
    { id: 'monster_slayer', name: '屠龙勇士',        cond: '钓起任一怪兽',                points: 80 },
    { id: 'fairy',          name: '我钓到了小仙女',  cond: '钓起任一位四季小仙女',        points: 60 },
    { id: 'goddess',        name: '女神的眷顾',      cond: '钓起大隐藏水之女神',          points: 150 },
    { id: 'full_book',      name: '全图鉴',          cond: '图鉴 100%',                   points: 300 },
  ];

  const data = { SEASONS, SEASON_CN, WEATHER_CN, WATER_CN, RARITY, RARITY_ORDER, FISH, ACHIEVEMENTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.GameData = data;
})(typeof window !== 'undefined' ? window : globalThis);

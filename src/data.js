// 游戏数据：鱼种、稀有度、成就。浏览器里挂到 window.GameData，Node 里 module.exports（给模拟脚本用）。
(function (root) {
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON_CN = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  const WEATHER_CN = { sunny: '晴', rainy: '雨' };
  const WATER_CN = { sea: '海', river: '河' };

  // 稀有度配置。prob = 基础概率（%），抛竿距离居中时的值；safe = 张力安全区宽度；
  // strength = 鱼的挣扎力度；reelTime = 安全区内需要收线的秒数；weight = 重量区间 kg
  const RARITY = {
    common:  { cn: '普通',     prob: 63.989,  safe: 0.40, strength: 0.25, reelTime: 3.0, weight: [0.2, 6],     color: 0x8fa3b8, folder: 'common' },
    rare:    { cn: '稀有',     prob: 30,  safe: 0.30, strength: 0.40, reelTime: 4.5, weight: [1, 18],      color: 0x3d8bfd, folder: 'rare' },
    exotic:  { cn: '奇珍异兽', prob: 5, safe: 0.20, strength: 0.60, reelTime: 6.0, weight: [10, 90],     color: 0xa04dff, folder: 'exotic' },
    monster: { cn: '怪兽',     prob: 1, safe: 0.17, strength: 0.70, reelTime: 7.0, weight: [500, 6000],  color: 0xe8453c, folder: 'monster' },
    fairy:   { cn: '小隐藏',   prob: 0.01, safe: 0.20, strength: 0.55, reelTime: 5.0, weight: [38, 46],     color: 0xff8fc8, folder: 'fairy' },
    goddess: { cn: '大隐藏',   prob: 0.001, safe: 0.17, strength: 0.70, reelTime: 6.0, weight: [48, 52],     color: 0x1fa8d8, folder: 'fairy' },
  };
  const RARITY_ORDER = ['common', 'rare', 'exotic', 'monster', 'fairy', 'goddess'];

  const FISH = [];
  // 每种鱼自己的介绍（照着素材图写的）；没有的才用调用处传入的那句
  const DESC = {
    "sea_seabass": "银灰色的身体，背鳍像一排小尖刺，码头边最常见的老朋友。",
    "sea_clownfish": "橙白相间的条纹，最爱躲在海葵里，偶尔也会好奇地咬钩。",
    "sea_grouper": "一身棕色斑点，喜欢窝在礁石缝里，嘴巴大得能吞下小鱼。",
    "sea_saury": "细长得像一把银色小刀，成群在海面附近游。",
    "sea_tuna": "深蓝背脊、黄色小鳍，游起来像一枚鱼雷，力气很大。",
    "sea_mackerel": "背上有蓝黑色的波浪花纹，游得飞快。",
    "sea_sardine": "小小一条，总是一大群一起行动，闪成一片银光。",
    "sea_flounder": "身子扁扁的，两只眼睛长在同一边，平时贴着沙底装成石头。",
    "sea_croaker": "金黄色的身体，会发出咕咕的叫声。",
    "sea_hairtail": "像一条长长的银色缎带，牙齿可尖了，拿的时候要小心。",
    "sea_pomfret": "圆圆扁扁的银色身体，像一面会游泳的小镜子。",
    "sea_bluetang": "宝蓝色身体配上黄尾巴，是珊瑚礁里最亮眼的那一抹蓝。",
    "sea_pufferfish": "一紧张就鼓成满身尖刺的小气球，别看它可爱，可碰不得。",
    "sea_squid": "白白的身体、十条腿，遇到危险会喷出一团墨汁逃跑。",
    "sea_octopus": "八条腿上都是小吸盘，聪明得会自己拧开瓶盖。",
    "sea_crab": "举着两只大钳子横着走，脾气有点急。",
    "sea_starfish": "五只角的橙色星星，在礁石上慢慢地爬。",
    "sea_lobster": "长长的触须、一身红甲，是海里的大将军。",
    "sea_seahorse": "用卷卷的尾巴勾住海草休息，站着游泳的小马。",
    "sea_eel": "满身灰色斑点，喜欢从石洞里探出头，张嘴露出一排尖牙。",
    "river_crucian": "圆圆胖胖的河边常客，谁都钓过它。",
    "river_carp": "嘴边两根小胡须，金铜色的鳞片一片一片排得整整齐齐。",
    "river_grasscarp": "青绿色的长身体，最爱吃水边的嫩草。",
    "river_silvercarp": "一身银白，受惊时会跳出水面。",
    "river_bighead": "脑袋又大又圆，占了身体的三分之一，所以叫胖头鱼。",
    "river_tilapia": "身上有灰紫色的横纹，鳍边带一点粉红，很能适应各种水域。",
    "river_snakehead": "身上有蛇一样的花纹，凶猛得连青蛙都敢吃。",
    "river_catfish": "四根长长的胡须，白天躲在河底，晚上才出来觅食。",
    "river_ricefieldeel": "金黄色、滑溜溜的长身体，最爱在稻田的泥洞里钻来钻去。",
    "river_loach": "带着小胡须的小不点，滑得抓都抓不住。",
    "river_bream": "身体又高又扁，银光闪闪。",
    "river_topmouth": "嘴巴往上翘，专门在水面偷袭小虫子。",
    "river_mandarinfish": "身上带着黑色豹纹，背鳍有尖刺，是河里的小猎手。",
    "river_yellowcatfish": "被钓上来会发出嘎嘎的叫声，鳍上的刺要小心。",
    "river_minnow": "细细长长的小白鱼，成群在浅水里窜来窜去。",
    "river_zacco": "身上泛着淡淡的彩虹光，喜欢清澈的溪水。",
    "river_shrimp": "透明的小身体，两根长长的触须，一碰就往后弹。",
    "river_crayfish": "红通通的小钳子挥来挥去，夏天的宵夜明星。",
    "river_mussel": "壳一打开，里面藏着一颗圆圆的珍珠。",
    "river_turtle": "脸颊上两道红纹，趴在石头上晒太阳能晒一整天。",
    "spring_sea_sakurasnapper": "粉红色的身体上开着樱花，春天限定的海中花。",
    "spring_sea_sakurashrimp": "粉嫩透亮，身上还印着小樱花。",
    "spring_sea_flyingfish": "张开樱花纹的大胸鳍，能跃出海面滑翔好远。",
    "spring_sea_anemonecrab": "把一整朵粉色海葵顶在背上，走到哪里都像戴着花帽。",
    "spring_river_peachmandarin": "斑纹之间点缀着桃花，春水里最好看的鳜鱼。",
    "spring_river_sakurasalmon": "银色身体上一排樱花，春天才会逆流游回来。",
    "spring_river_peachjelly": "伞盖像一朵盛开的桃花，触须末端还挂着小花瓣。",
    "spring_river_willowfish": "细长得像一片柳叶，总在垂柳下的水里游。",
    "summer_sea_glowshrimp": "通体发着蓝光，夏夜的海里像一盏小灯。",
    "summer_sea_mantaray": "张开像翅膀一样的大鳍在海里飞，背上满是星点。",
    "summer_sea_sailfish": "背上竖着一面大帆，长嘴像一把剑，是海里的短跑冠军。",
    "summer_sea_seaturtle": "背壳上开满夏天的扶桑花，慢悠悠地游过浅海。",
    "summer_river_lotuskoi": "粉色的锦鲤，总爱躲在荷花和荷叶底下乘凉。",
    "summer_river_fireflyfish": "尾巴会像萤火虫一样一闪一闪地发光。",
    "summer_river_bettafish": "紫色的大尾鳍像裙摆一样飘，脾气却很倔强。",
    "summer_river_rainbowtrout": "雨停之后，身上会浮现一道彩虹。",
    "autumn_sea_mapleseabream": "红彤彤的鳞片上印着枫叶，秋天的海里最喜庆。",
    "autumn_sea_autumnsalmon": "身上的条纹像晚霞，背上还沾着一片枫叶。",
    "autumn_sea_kingcrab": "满身尖刺的大红甲壳，长腿一伸比人还宽。",
    "autumn_sea_cod": "银灰色的大个子，下巴上有一根小胡须。",
    "autumn_river_osmanthuscarp": "金黄色的身体上开满桂花，游过的地方都是香的。",
    "autumn_river_maple_trout": "斑点之间点缀着红枫叶，秋天限定的鳟鱼。",
    "autumn_river_hairycrab": "两只钳子上长着毛茸茸的绒毛，秋风一起就最肥美。",
    "autumn_river_icefish": "通体透明的小银鱼，几乎能看见骨头。",
    "winter_sea_icefish": "半透明的身体上有雪花纹，好像是冰做的。",
    "winter_sea_arcticcod": "背上还挂着一层薄雪，从北方的冰海游过来。",
    "winter_sea_snowcrab": "红色的壳上落了一层白雪，像撒了糖霜。",
    "winter_sea_crystaljelly": "头顶一朵雪花，触须末端挂着小冰晶，摸起来凉凉的。",
    "winter_river_sturgeon": "背上一排冰晶骨板，长长的吻部，是河里的老寿星。",
    "winter_river_snowtrout": "圆滚滚的浅蓝身体上印着一朵大雪花。",
    "winter_river_icicle_fish": "细长的银白身体闪着冰光，就像一根会游的冰凌。",
    "winter_river_snowloach": "身上缀满小雪花，冬天也在冰下钻来钻去。"
    };
  function add(rarity, id, name, water, season, weather, desc, file) {
    FISH.push({ id, name, rarity, water, season: season || null, weather: weather || null, desc: DESC[id] || desc || '', file: file || id });
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
  add('exotic', 'river_snowfox', '雪狐鱼', 'river', 'winter', 'rainy', '拖着好几条蓬松的狐狸尾巴，冬雨里最活跃。');

  // ---- 怪兽（6，仅海）----
  add('monster', 'thunderwhale', '雷霆巨鲸', 'sea', 'spring', 'rainy', '被风暴云包裹的巨鲸，一甩尾就是一道雷。');
  add('monster', 'seaserpent', '巨型海蛇', 'sea', 'summer', 'rainy', '盘起来有一座岛那么大。');
  add('monster', 'lavabeast', '熔岩海兽', 'sea', 'summer', 'sunny', '火山岩背壳下流着岩浆，海水都被煮沸了。');
  add('monster', 'kraken', '海怪', 'sea', 'autumn', 'rainy', '无数触手的深海霸主，秋雨夜最危险。');
  add('monster', 'icetitan', '冰原巨兽', 'sea', 'winter', 'sunny', '冰川獠牙、霜甲加身的远古巨兽。');
  add('monster', 'deepabyss', '深海巨兆', 'sea', 'winter', 'rainy', '背负珊瑚礁的深海巨兽，灯笼一亮，海面就要变天。');

  // ---- 小隐藏 · 四季小仙女（4）：各在自己的季节出现，天气水域不限 ----
  add('fairy', 'fairy_spring', '春 · 小仙女', null, 'spring', null, '粉发上戴着桃花花环，绿叶裙摆一摇，水面就漂满花瓣。', 'spring');
  add('fairy', 'fairy_summer', '夏 · 小仙女', null, 'summer', null, '顶着向日葵花冠，像个小太阳，走到哪里都暖洋洋的。', 'summer');
  add('fairy', 'fairy_autumn', '秋 · 小仙女', null, 'autumn', null, '枫叶编成的发冠，裙摆层层叠叠，一转身就落下满地红叶。', 'autumn');
  add('fairy', 'fairy_winter', '冬 · 小仙女', null, 'winter', null, '戴着雪花冠、披着毛绒披肩，轻轻呵一口气，水面就结出小冰花。', 'winter');

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

// 游戏数据：鱼种、稀有度、成就。浏览器里挂到 window.GameData，Node 里 module.exports（给模拟脚本用）。
(function (root) {
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON_CN = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  const WEATHER_CN = { sunny: '晴', rainy: '雨' };
  const WATER_CN = { sea: '海', river: '河', xmas: '圣诞场', thanks: '感恩节场' };

  // 稀有度配置。prob = 基础概率（%），抛竿距离居中时的值；safe = 张力安全区宽度；
  // strength = 鱼的挣扎力度；reelTime = 安全区内需要收线的秒数；weight = 重量区间 kg
  const RARITY = {
    common:  { cn: '普通',     prob: 63.989,  safe: 0.40, strength: 0.25, reelTime: 3.0, weight: [0.2, 6],     color: 0x8fa3b8, folder: 'common' },
    rare:    { cn: '稀有',     prob: 30,  safe: 0.30, strength: 0.40, reelTime: 4.5, weight: [1, 18],      color: 0x3d8bfd, folder: 'rare' },
    exotic:  { cn: '奇珍异兽', prob: 5, safe: 0.20, strength: 0.60, reelTime: 6.0, weight: [10, 90],     color: 0xa04dff, folder: 'exotic' },
    monster: { cn: '怪兽',     prob: 1, safe: 0.19, strength: 0.70, reelTime: 6.5, weight: [500, 6000],  color: 0xe8453c, folder: 'monster' },
    fairy:   { cn: '小隐藏',   prob: 0.01, safe: 0.18, strength: 0.55, reelTime: 5.0, weight: [38, 46],     color: 0xff8fc8, folder: 'fairy' },
    eventHidden: { cn: '限定隐藏', prob: 0.001, safe: 0.18, strength: 0.55, reelTime: 5.0, weight: [60, 75], color: 0xd94848, folder: 'event' },
    goddess: { cn: '大隐藏',   prob: 0.001, safe: 0.17, strength: 0.65, reelTime: 6.0, weight: [48, 52],     color: 0x1fa8d8, folder: 'fairy' },
  };
  const RARITY_ORDER = ['common', 'rare', 'exotic', 'monster', 'fairy', 'goddess', 'eventHidden'];

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
  // 等批次 14 素材到了再打开（同时把怪兽数改 7、总数改 100）
  // add('monster', 'shielddragon', '遮麟龙', 'sea', 'autumn', 'sunny', '全身披着盾形大鳞甲的海龙，一受惊就把鳞甲合拢，像一座会游泳的堡垒。');
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

  // ---- 节日限定场：独立一套可钓物，不算进上面 99 种图鉴和成就 ----
  // 圣诞场：每年 12 月（UTC+8）开放；普通 40 · 稀有 20 · 奇珍异兽 5 · 限定隐藏 1
  // table：限定场的出现率（%）。base = 普通场的可钓物（海 + 河，跟当前季节、天气），event = 限定可钓物；合计 100
  // 小隐藏、大隐藏不在限定场出现；抛得远近照样影响（d=0.5 时就是这里的值）
  // 开放时间：month = 每年这个月（0 起算）；或 from / to = 一次性的时间段（毫秒，UTC）
  // first：第一次开放的时间（之前预览钓到的不在图鉴显示）；skin：有节日装；snow：用飘雪代替下雨；music：BGM（默认用节日自己的歌单）
  // notice：开放后第一次进游戏弹的通知；bye：活动结束时的提示
  const EVENTS = {
    xmas: { id: 'xmas', cn: '圣诞', btn: '圣诞', month: 11, when: '每年 12 月', first: Date.UTC(2026, 10, 30, 16), skin: true, snow: true, rainy: '大雪', color: '#c8322f',
      notice: ['圣诞限定钓场开放啦！', n => `12 月 1 日 – 12 月 31 日限时开放\n${n} 种圣诞限定可钓物，还有神秘的限定隐藏等你来钓\n顶栏点「圣诞」就能进去`], bye: '圣诞限定场已经结束，明年 12 月见～',
      table: [
        ['common', 'base', 10], ['common', 'event', 53.999],
        ['rare', 'base', 10], ['rare', 'event', 20],
        ['exotic', 'base', 1], ['exotic', 'event', 4.5],
        ['monster', 'base', 0.5],
        ['eventHidden', 'event', 0.001],
      ] },
    // 感恩节：2026-11-26 00:00 – 11-28 24:00（UTC+8），只开 3 天；没有节日装、没有限定隐藏，BGM 用秋天的
    thanks: { off: true, id: 'thanks', cn: '感恩节', btn: '感恩节', from: Date.UTC(2026, 10, 25, 16), to: Date.UTC(2026, 10, 28, 16), when: '2026 年 11 月 26 – 28 日', first: Date.UTC(2026, 10, 25, 16), music: 'autumn', rainy: '雨', color: '#c0601a',
      notice: ['感恩节限定钓场开放啦！', n => `11 月 26 日 – 11 月 28 日，只开 3 天\n${n} 种感恩节限定可钓物等你来钓\n顶栏点「感恩节」就能进去`], bye: '感恩节限定场已经结束啦，谢谢来玩～',
      table: [
        ['common', 'base', 10], ['common', 'event', 54],
        ['rare', 'base', 10], ['rare', 'event', 20],
        ['exotic', 'base', 1], ['exotic', 'event', 4.5],
        ['monster', 'base', 0.5],
      ] },
  };
  // 圣诞限定可钓物介绍（对照批次 11（重新生成版）、12 的图写）
  const EVENT_DESC = {
    candycane: '红白斜条纹的小鱼，连鳍和尾巴都是条纹的，像一根会游泳的拐杖糖。',
    gingerbread: '一条烤得香喷喷的姜饼鱼，白色糖霜描着花边，肚子上排着红、绿两种糖豆纽扣。',
    bell: '圆滚滚的金色铃铛鱼，头顶系着大红蝴蝶结，肚子下面露出铃铛口，一游就叮当响。',
    snowflake: '淡蓝色的小鱼，身上印着一朵大雪花，鳍边像结了薄薄一层冰。',
    mistletoe: '青绿色鳞片的小鱼，头顶戴着槲寄生叶子、白果子和红蝴蝶结，据说在它底下遇见的人会成为好朋友。',
    pine: '全身长满松针，背上积着白雪，还挂着红果子和一颗小松果，像一截会游泳的圣诞树枝。',
    ornament: '红亮亮的圣诞彩球鱼，头顶有金色挂环，身上画着金色雪花，鳍边也镶着金。',
    stocking: '像一只红色的毛线圣诞袜，织着白色雪花花纹，袜口的白绒毛上插着冬青叶和红果子。',
    cocoa: '巧克力色的鱼，头顶淋着奶油、顶着一颗笑眯眯的棉花糖，身上还印着一个冒热气的小杯子。',
    snowman: '雪白的身体配三颗黑纽扣，戴着黑色小礼帽、围着红围巾，鼻子是一根胡萝卜。',
    holly: '青绿色的小鱼，背上插着两片大冬青叶和一串红果子，是圣诞花环上最常见的装饰。',
    ribbon: '红白相间的小鱼，身上缠着一条红缎带，背上打了个大蝴蝶结，像一份会游的礼物。',
    topstar: '一颗金黄色的星星，身上有白色卷纹，底下还连着插在树顶用的金座子，闪闪发光。',
    giftcrab: '背着一个红绿条纹礼盒的小螃蟹，盒子上系着大红蝴蝶结，挥着两只红钳子。',
    reindeershrimp: '红白条纹的小虾，长着一对驯鹿角，红鼻子圆圆的，脖子上还挂着一颗金铃铛。',
    cookieflounder: '扁扁的鱼形饼干，白色糖霜描出波浪边，上面撒满了彩色糖针。',
    frosting: '粉白色的小鱼，身上淋满糖霜、撒着彩色糖针，头顶堆着奶油，还放着一颗红樱桃。',
    lights: '淡蓝色的小鱼，全身缠着一串彩色灯泡，红黄绿蓝一闪一闪。',
    penguin: '黑背白肚的企鹅鱼，黄色小尖嘴，头上戴着一顶红色圣诞帽。',
    pudding: '深棕色的圣诞布丁鱼，身上点着葡萄干，头顶淋着白色酱汁，插着冬青叶和红果子。',
    marshmallow: '粉白相间的棉花糖鱼，身体一节一节软乎乎的，头上别着冬青叶和红果子。',
    knitsquid: '戴着红色毛线帽的小乌贼，帽子上织着雪花，顶着一个白绒球，脖子上系着红蝴蝶结。',
    scarfeel: '身体就是一条红绿条纹的毛线围巾，尾巴还带着流苏，在冷水里也暖呼呼的。',
    snowglobejelly: '伞盖是一颗水晶球，里面有一棵小圣诞树和飘落的雪花，系着红蝴蝶结和金铃铛。',
    candle: '奶油色的蜡烛鱼，头顶点着一小簇火苗，尾巴橘红得像火焰，身上系着冬青蝴蝶结。',
    pineconepuffer: '身体像一颗棕色的大松果，头顶积着白雪，还插着松针和红果子，受惊时会鼓起来。',
    mittencrab: '戴着红色毛线帽的小螃蟹，两只大钳子套着红手套，上面织着白雪花。',
    cranberry: '圆鼓鼓的红莓鱼，红得发亮，头顶长着两片绿叶，酸酸甜甜。',
    cinnamon: '身体卷成一圈一圈的肉桂卷，淋着白糖霜，头上插着两根肉桂棒和一个红蝴蝶结。',
    eggnog: '淡奶油色的小鱼，撒着点点肉豆蔻粉，头顶一团鲜奶油，插着肉桂棒和冬青叶，像一杯蛋酒。',
    wreath: '身体是一圈绿色的圣诞花环，缀着红果子，顶上挂着金铃铛和大红蝴蝶结。',
    sleigh: '红色的身体就是一架圣诞雪橇，镶着白绒边和金色花纹，肚子底下还有一对金色滑板。',
    frostminnow: '淡蓝色的小鱼，鳍和尾巴像冰晶一样尖尖的，身上印着一朵雪花，摸起来凉凉的。',
    chimney: '红砖砌成的身体，屋顶盖着白雪，背上有一根冒着白烟的小烟囱，肚子上还开着一扇亮灯的小窗。',
    giftclam: '粉色的珍珠贝壳张着嘴，里面藏着一个绿色小礼盒，壳顶系着红蝴蝶结和冬青。',
    tinsel: '银白色的小鱼，鳍和尾巴像一束束蓬松的金葱条，游起来亮晶晶的。',
    nutcracker: '红色的身体穿着蓝色军装、金色纽扣，头戴插着白羽毛的高帽，像一个胡桃夹子士兵。',
    candyshrimp: '红白条纹的小虾，连长长的触须都是条纹的，像一根扭扭糖。',
    snowball: '圆滚滚的身体像一颗刚捏好的雪球，表面毛茸茸的，还印着一朵雪花。',
    gingerbreadstar: '星星形状的姜饼鱼，白色糖霜描边，中间一颗黄色小星星，周围点着彩色糖珠。',
    aurora: '紫色的身体上流动着一条条绿色光带，像把极光披在身上，鳍边闪着星点。',
    starlight: '全身金灿灿的，鳍像一片片发光的羽毛，头上顶着一颗小星星。',
    crystalreindeer: '身体像一块块淡蓝色水晶拼成，头上长着一对晶莹的驯鹿角。',
    gingerhousecrab: '背着一整座姜饼屋的橘色螃蟹，屋顶盖着糖霜雪，门口还挂着小花环和拐杖糖。',
    goldbellkoi: '橙金色的锦鲤，身上系着红缎带，挂着三颗金色铃铛，游起来叮叮当当。',
    frostangel: '雪白半透明的天使鱼，长长的鳍像结了霜的羽翼，轻轻一摆就飘起来。',
    xmastree: '身体就是一棵挂满彩球和小灯的圣诞树，盖着白雪，头顶还有一颗金星。',
    polarbear: '毛茸茸的白色身体，长着北极熊的圆耳朵和小黑鼻子，脖子上围着红围巾。',
    snowowlray: '展开的鳐鱼翅膀上长满雪白的羽毛，前端是一张雪鸮的脸和金色眼睛。',
    cocoaturtle: '背着一大杯热可可的乌龟，杯子上印着雪花，里面漂着棉花糖。',
    musicboxjelly: '伞盖是一个金色的八音盒，上面转着一匹小木马，下面垂着彩虹色的触手。',
    candyseahorse: '红白条纹的海马，卷起的尾巴像拐杖糖，头上戴着冬青叶和红果子。',
    firework: '深紫色的身体上绽放着一朵朵金色烟火，鳍尖带着彩色火花。',
    lightseel: '紫色的鳗鱼缠着一串彩色灯泡，头上歪戴一顶圣诞帽。',
    cardinal: '火红的身体，脸上有一块黑斑，鳍像红雀的羽毛，胸前别着冬青果。',
    icelobster: '全身像冰雕出来的淡蓝色龙虾，背上刻着一朵雪花，大钳子晶莹剔透。',
    snowbream: '淡紫蓝色的身体上开满了大大小小的雪花图案，像一块会游泳的冰晶。',
    silverbellkoi: '银白色的锦鲤，红缎带上挂着三颗银铃铛，和金铃锦鲤是一对。',
    mistletoebream: '青绿色的鲂鱼，身上缠着槲寄生和白果子，还系着一个红蝴蝶结。',
    velvetbetta: '鲜红的斗鱼，大大的鳍像丝绒披风，边上镶着白毛，胸前挂着一颗金铃铛。',
    reindeerqilin: '长着驯鹿角的金色麒麟，披着红缎带、挂着金铃铛，踏着浪花在冰海上奔跑。',
    treeturtle: '背上长着一整棵圣诞树的老海龟，树上挂满彩球和金星，据说已经活了上千年。',
    aurorawhale: '深蓝色的巨鲸，身上闪烁着绿紫色的极光和星点，跃出水面时整片夜空都会亮起来。',
    candynarwhal: '红白条纹的独角鲸，长长的角像拐杖糖，脖子上围着红围巾，总是笑嘻嘻的。',
    snowowlfish: '雪白羽毛般的鳞片和鳍，长着雪鸮的圆脸和金色眼睛，在雪夜里悄悄游过。',
    santa: '背着礼物袋、拿着鱼竿的圣诞老爷爷，偶尔会从水里冒出来，把礼物送给耐心等待的钓手。',
  };
  const EVENT_FISH = [
    ['common', 'candycane', '拐杖糖鱼'],
    ['common', 'gingerbread', '姜饼鱼'],
    ['common', 'bell', '铃铛鱼'],
    ['common', 'snowflake', '雪花鱼'],
    ['common', 'mistletoe', '槲寄生鱼'],
    ['common', 'pine', '松针鱼'],
    ['common', 'ornament', '彩球鱼'],
    ['common', 'stocking', '圣诞袜鱼'],
    ['common', 'cocoa', '热可可鱼'],
    ['common', 'snowman', '雪人鱼'],
    ['common', 'holly', '冬青鱼'],
    ['common', 'ribbon', '缎带鱼'],
    ['common', 'topstar', '星星海星'],
    ['common', 'giftcrab', '礼盒蟹'],
    ['common', 'reindeershrimp', '驯鹿虾'],
    ['common', 'cookieflounder', '饼干比目鱼'],
    ['common', 'frosting', '糖霜鱼'],
    ['common', 'lights', '彩灯鱼'],
    ['common', 'penguin', '企鹅鱼'],
    ['common', 'pudding', '布丁鱼'],
    ['common', 'marshmallow', '棉花糖鱼'],
    ['common', 'knitsquid', '毛线乌贼'],
    ['common', 'scarfeel', '围巾鳗'],
    ['common', 'snowglobejelly', '雪花球水母'],
    ['common', 'candle', '蜡烛鱼'],
    ['common', 'pineconepuffer', '松果河豚'],
    ['common', 'mittencrab', '手套蟹'],
    ['common', 'cranberry', '红莓鱼'],
    ['common', 'cinnamon', '肉桂卷鱼'],
    ['common', 'eggnog', '蛋酒鱼'],
    ['common', 'wreath', '花环鱼'],
    ['common', 'sleigh', '雪橇鱼'],
    ['common', 'frostminnow', '霜花小鱼'],
    ['common', 'chimney', '烟囱鱼'],
    ['common', 'giftclam', '礼物蚌'],
    ['common', 'tinsel', '金葱鱼'],
    ['common', 'nutcracker', '胡桃夹鱼'],
    ['common', 'candyshrimp', '糖果虾'],
    ['common', 'snowball', '雪球鱼'],
    ['common', 'gingerbreadstar', '星星饼干鱼'],
    ['rare', 'aurora', '极光鱼'],
    ['rare', 'starlight', '星光鱼'],
    ['rare', 'crystalreindeer', '水晶驯鹿鱼'],
    ['rare', 'gingerhousecrab', '姜饼屋蟹'],
    ['rare', 'goldbellkoi', '金铃锦鲤'],
    ['rare', 'frostangel', '霜天使鱼'],
    ['rare', 'xmastree', '圣诞树鱼'],
    ['rare', 'polarbear', '北极熊鱼'],
    ['rare', 'snowowlray', '雪鸮鳐'],
    ['rare', 'cocoaturtle', '可可龟'],
    ['rare', 'musicboxjelly', '八音盒水母'],
    ['rare', 'candyseahorse', '拐杖糖海马'],
    ['rare', 'firework', '烟火鱼'],
    ['rare', 'lightseel', '彩灯鳗'],
    ['rare', 'cardinal', '红雀鱼'],
    ['rare', 'icelobster', '冰晶龙虾'],
    ['rare', 'snowbream', '雪晶鲷'],
    ['rare', 'silverbellkoi', '银铃锦鲤'],
    ['rare', 'mistletoebream', '槲寄生鲂'],
    ['rare', 'velvetbetta', '丝绒斗鱼'],
    ['exotic', 'reindeerqilin', '驯鹿麒麟'],
    ['exotic', 'treeturtle', '圣诞树精龟'],
    ['exotic', 'aurorawhale', '极光鲸'],
    ['exotic', 'candynarwhal', '拐杖糖独角鲸'],
    ['exotic', 'snowowlfish', '雪鸮鱼'],
    ['eventHidden', 'santa', '圣诞老爷爷'],
  ].map(([rarity, id, name]) => ({ id: 'xmas_' + id, name, rarity, water: 'xmas', season: null, weather: null, event: 'xmas', file: 'xmas_' + id, desc: EVENT_DESC[id] }));
  // 感恩节限定：普通 15 · 稀有 5 · 奇珍异兽 3（批次 15）
  EVENT_FISH.push(...[
    ['common', 'pumpkin', '南瓜鱼', '圆滚滚的橙色南瓜鱼，头顶的小藤蔓一游就卷一下。'],
    ['common', 'corn', '玉米鱼', '身体是一根金黄的玉米棒，绿色的玉米叶当鳍。'],
    ['common', 'cranberry', '蔓越莓鱼', '亮红色的小圆鱼，像一颗刚摘下的蔓越莓，酸酸甜甜。'],
    ['common', 'applepie', '苹果派鱼', '背上是格子花纹的酥皮，闻起来有肉桂苹果的香味。'],
    ['common', 'acorn', '橡果鱼', '戴着橡果帽的小胖鱼，松鼠最爱追着它跑。'],
    ['common', 'sweetpotato', '红薯鱼', '烤得软软的红薯鱼，裂口冒着热气，甜得流蜜。'],
    ['common', 'roll', '面包卷鱼', '金黄蓬松的面包卷鱼，表面刷了一层亮亮的黄油。'],
    ['common', 'gourd', '葫芦瓜鱼', '黄绿条纹的小葫芦瓜，摆在餐桌上当装饰正好。'],
    ['common', 'apple', '红苹果鱼', '红彤彤的苹果鱼，头顶一片小叶子当背鳍。'],
    ['common', 'chestnut', '栗子鱼', '刚烤好的栗子鱼，裂开的小口露出金黄的果肉。'],
    ['common', 'wheat', '麦穗鱼', '一束金色麦穗扎成的鱼，象征今年大丰收。'],
    ['common', 'mashed', '土豆泥鱼', '软绵绵的土豆泥鱼，头顶一块黄油正慢慢化开。'],
    ['common', 'pecanpie', '碧根果派鱼', '背上排满碧根果的焦糖派，亮晶晶的很黏牙。'],
    ['common', 'cider', '苹果酒鱼', '暖呼呼的苹果酒鱼，插着一根肉桂棒，冒着香气。'],
    ['common', 'honey', '蜂蜜罐鱼', '圆肚子的蜂蜜罐鱼，一游就滴下金黄的蜂蜜。'],
    ['rare', 'turkey', '火鸡鱼', '屁股上开着一大把彩色火鸡尾羽，走路……不，游起来一摇一摆。'],
    ['rare', 'cornucopia', '丰收号角鱼', '编织的丰收号角，里面装满水果蔬菜，永远倒不完。'],
    ['rare', 'pilgrimhat', '朝圣帽鱼', '戴着黑色高帽、金色帽扣的小绅士鱼，很讲礼貌。'],
    ['rare', 'roast', '烤火鸡大餐鱼', '一整只烤得金黄的火鸡大餐，配着香草和蔓越莓。'],
    ['rare', 'scarecrow', '稻草人鱼', '穿格子衬衫、戴草帽的稻草人鱼，其实一点都不吓人。'],
    ['exotic', 'goldenturkey', '金羽火鸡', '全身金羽的神火鸡，尾羽一展开，整片湖都被照亮。'],
    ['exotic', 'harvestmoon', '丰收月灵鱼', '背着一轮橙色丰收满月的灵鱼，只在感恩节的夜里出现。'],
    ['exotic', 'wheatdragon', '麦穗龙', '用金色麦穗编成的小龙，飞过的田地都会大丰收。'],
  ].map(([rarity, id, name, desc]) => ({ id: 'thanks_' + id, name, rarity, water: 'thanks', season: null, weather: null, event: 'thanks', file: 'thanks_' + id, desc })));

  const data = { SEASONS, SEASON_CN, WEATHER_CN, WATER_CN, RARITY, RARITY_ORDER, FISH, ACHIEVEMENTS, EVENTS, EVENT_FISH };
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.GameData = data;
})(typeof window !== 'undefined' ? window : globalThis);

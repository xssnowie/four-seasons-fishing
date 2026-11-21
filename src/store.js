// 存档 + 账号（window.Store）。没配置 Firebase 时就是纯本机存档，和以前一样。
// 账号：用户名 + 密码。Firebase 只认邮箱，所以把用户名换成一个内部邮箱（不会真的发邮件）。
// 云端：Firestore saves/{uid} = { save: 存档 JSON 字符串, name, updatedAt }，安全规则只允许本人读写。
(function () {
  const L = window.GameLogic;
  const GUEST = L.KEY;
  const DOMAIN = 'players.four-seasons-fishing.app';
  const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
  const ls = (() => {
    try { const s = window.localStorage; s.getItem('x'); return s; } catch (e) { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
  })();

  const S = {
    save: L.load(ls, GUEST),
    user: null,               // { uid, name }
    enabled: !!window.FIREBASE_CONFIG,
    ready: !window.FIREBASE_CONFIG, // 账号状态是否已确定（Firebase 恢复登录要一点时间）
    status: 'idle',           // idle | syncing | ok | offline
    NAME_RE,
  };
  const listeners = new Set();
  S.onChange = f => { listeners.add(f); return () => listeners.delete(f); };
  const emit = () => listeners.forEach(f => { try { f(S); } catch (e) { console.error(e); } });
  const key = () => (S.user ? GUEST + '.u.' + S.user.uid : GUEST);
  const replaceSave = next => { Object.keys(S.save).forEach(k => delete S.save[k]); Object.assign(S.save, next); }; // 原地换，场景拿着的引用继续有效

  // ---------- Firebase（按需加载，库在 vendor/firebase/，不依赖外网 CDN）----------
  let fb = null;
  const bootP = S.enabled ? boot().catch(e => { console.error('[store] Firebase 启动失败', e); S.ready = true; S.status = 'offline'; emit(); }) : Promise.resolve();
  async function boot() {
    const u = p => new URL(p, document.baseURI).href;
    const [app, auth, fs] = await Promise.all(['firebase-app', 'firebase-auth', 'firebase-firestore-lite'].map(n => import(u(`vendor/firebase/${n}.js`))));
    const a = app.initializeApp(window.FIREBASE_CONFIG);
    // initializeAuth 不带弹窗登录模块：只用账号密码，打包成 App（WebView）时也不会卡住
    const au = auth.initializeAuth(a, { persistence: [auth.indexedDBLocalPersistence, auth.browserLocalPersistence] });
    fb = { auth, fs, au, db: fs.getFirestore(a) };
    auth.onAuthStateChanged(au, user => { onUser(user).finally(() => { S.ready = true; emit(); }); });
  }
  const ref = () => fb.fs.doc(fb.db, 'saves', S.user.uid);
  const nameOf = user => user.displayName || (user.email || '').split('@')[0];

  async function onUser(user) {
    const prev = S.user && S.user.uid;
    if (!user) {
      S.user = null; S.status = 'idle';
      if (prev) replaceSave(L.load(ls, GUEST));
      return;
    }
    S.user = { uid: user.uid, name: nameOf(user) };
    let next = prev === user.uid ? S.save : L.load(ls, key()); // 先用这台设备上该账号的缓存
    const guest = L.load(ls, GUEST);
    if (!L.isEmpty(guest)) { next = L.merge(next, guest); ls.removeItem(GUEST); } // 游客进度并入账号（只并一次）
    replaceSave(next); L.persist(ls, S.save, key());
    emit();
    await pushNow();
  }

  // 上传前先读云端合并：同一账号在两台手机上玩，谁的进度都不会被覆盖
  let pushTimer = null, pushing = null;
  async function pushNow() {
    clearTimeout(pushTimer); pushTimer = null;
    if (!fb || !S.user) return;
    if (pushing) { await pushing; return pushNow(); }
    const uid = S.user.uid;
    S.status = 'syncing'; emit();
    pushing = (async () => {
      try {
        const snap = await fb.fs.getDoc(ref());
        if (!S.user || S.user.uid !== uid) return;
        if (snap.exists()) { try { replaceSave(L.merge(S.save, JSON.parse(snap.data().save))); } catch (e) { /* 云端数据坏了就以本机为准 */ } }
        L.persist(ls, S.save, key());
        await fb.fs.setDoc(ref(), { save: JSON.stringify(S.save), name: S.user.name, updatedAt: Date.now() });
        S.status = 'ok';
      } catch (e) {
        console.warn('[store] 同步失败，稍后再试', e && e.code);
        S.status = 'offline';
        pushTimer = setTimeout(pushNow, 30000);
      } finally { pushing = null; emit(); }
    })();
    await pushing;
  }

  // 每钓一条调用一次：先存本机，登录了就几秒后同步上云
  S.commit = () => {
    L.persist(ls, S.save, key());
    if (S.user) { clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, 3000); }
  };
  S.sync = pushNow;

  // ---------- 账号操作（出错时抛 Error，message 是给玩家看的中文）----------
  const ERR = {
    'auth/email-already-in-use': '这个用户名已经有人用了',
    'auth/invalid-credential': '用户名或密码不对',
    'auth/wrong-password': '密码不对',
    'auth/user-not-found': '没有这个用户名',
    'auth/invalid-email': '用户名格式不对',
    'auth/weak-password': '密码至少 6 位',
    'auth/too-many-requests': '尝试太多次了，过几分钟再试',
    'auth/network-request-failed': '网络连不上，检查一下网络',
    'auth/requires-recent-login': '请先重新输入密码',
  };
  const fail = e => { const err = new Error(ERR[e && e.code] || '出错了，请稍后再试'); err.code = e && e.code; console.warn('[store]', e); throw err; };
  const need = async () => { await bootP; if (!fb) throw new Error('账号服务暂时连不上'); };
  const email = name => name.toLowerCase() + '@' + DOMAIN;
  const checkName = name => { if (!NAME_RE.test(name || '')) throw new Error('用户名要 3–16 位，只能用英文字母、数字和下划线'); };
  const checkPw = pw => { if (!pw || pw.length < 6) throw new Error('密码至少 6 位'); };

  S.register = async (name, pw) => {
    checkName(name); checkPw(pw); await need();
    let cred;
    try { cred = await fb.auth.createUserWithEmailAndPassword(fb.au, email(name), pw); } catch (e) { fail(e); }
    try { await fb.auth.updateProfile(cred.user, { displayName: name }); } catch (e) { /* 显示名设不上就用小写用户名 */ }
    if (S.user && S.user.uid === cred.user.uid) { S.user.name = name; emit(); }
    await pushNow();
  };
  S.login = async (name, pw) => {
    checkName(name); if (!pw) throw new Error('请输入密码'); await need();
    try { await fb.auth.signInWithEmailAndPassword(fb.au, email(name), pw); } catch (e) { fail(e); }
  };
  S.logout = async () => {
    await need();
    try { await pushNow(); } catch (e) { /* 上传失败也照样退出，进度还在本机缓存里 */ }
    await fb.auth.signOut(fb.au);
  };
  // 删除账号（App Store 要求有）：云端存档 + 账号 + 本机缓存一起删
  S.deleteAccount = async pw => {
    await need();
    const user = fb.au.currentUser; if (!user) return;
    try {
      await fb.auth.reauthenticateWithCredential(user, fb.auth.EmailAuthProvider.credential(user.email, pw || ''));
      await fb.fs.deleteDoc(ref());
      const k = key();
      await fb.auth.deleteUser(user);
      ls.removeItem(k);
    } catch (e) { fail(e); }
  };

  window.Store = S;
})();

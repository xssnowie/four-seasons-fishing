// 账号弹窗（window.AccountUI.open()）：用 HTML 输入框而不是画布，手机键盘、输入法、粘贴密码都正常。
(function () {
  const S = window.Store;
  let el = null;
  const h = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'on') Object.entries(v).forEach(([e, f]) => n.addEventListener(e, f)); else if (k === 'class') n.className = v; else n.setAttribute(k, v); });
    kids.flat().forEach(c => n.append(c));
    return n;
  };
  const STATUS = { idle: '', syncing: '☁️ 正在同步…', ok: '☁️ 进度已存到云端', offline: '⚠️ 暂时连不上网络，进度先存在本机，连上后会自动同步' };

  function close() { if (el) { el.remove(); el = null; } }

  let openedAt = 0;
  function open(view) {
    close(); openedAt = Date.now(); // 手机上点开按钮的那一下会落到遮罩上，别马上关掉
    el = h('div', { id: 'acct', on: { keydown: e => e.stopPropagation(), keyup: e => e.stopPropagation(), click: e => { if (e.target === el && Date.now() - openedAt > 600) close(); } } });
    // Phaser 在 window 上也监听键盘、鼠标、触摸：弹窗里的操作不能漏给底下的游戏（否则打空格会抛竿、点按钮会点到画布上的按钮）
    ['mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove', 'pointerdown', 'pointerup'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
    document.body.append(el);
    render(view);
  }

  function render(view) {
    if (!el) return;
    el.innerHTML = '';
    const card = h('div', { class: 'card' }, h('button', { class: 'x', 'aria-label': '关闭', on: { click: close } }, '✕'));
    el.append(card);
    if (!S.enabled) {
      card.append(h('h2', {}, '账号'), h('p', {}, '账号功能还没开启，进度暂时只存在这台设备。'));
      return;
    }
    if (!S.ready) { card.append(h('h2', {}, '账号'), h('p', {}, '正在连接…')); setTimeout(() => render(view), 400); return; }
    if (S.user) return renderMe(card, view === 'delete');
    renderForm(card, view === 'register' ? 'register' : 'login');
  }

  function renderForm(card, mode) {
    const reg = mode === 'register';
    const tabs = h('div', { class: 'tabs' },
      h('button', { class: reg ? '' : 'on', on: { click: () => render('login') } }, '登录'),
      h('button', { class: reg ? 'on' : '', on: { click: () => render('register') } }, '注册'));
    const name = h('input', { type: 'text', placeholder: '用户名', autocomplete: 'username', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', maxlength: '16' });
    const pw = h('input', { type: 'password', placeholder: reg ? '密码（至少 6 位）' : '密码', autocomplete: reg ? 'new-password' : 'current-password' });
    const pw2 = reg ? h('input', { type: 'password', placeholder: '再输一次密码', autocomplete: 'new-password' }) : null;
    const err = h('div', { class: 'err' });
    const go = h('button', { class: 'go', type: 'submit' }, reg ? '注册并保存进度' : '登录');
    const form = h('form', { on: { submit: async e => {
      e.preventDefault(); err.textContent = '';
      if (reg && pw.value !== pw2.value) { err.textContent = '两次输入的密码不一样'; return; }
      go.disabled = true; go.textContent = '请稍候…';
      try { await (reg ? S.register(name.value.trim(), pw.value) : S.login(name.value.trim(), pw.value)); render(reg ? 'welcome' : ''); }
      catch (x) { err.textContent = x.message; go.disabled = false; go.textContent = reg ? '注册并保存进度' : '登录'; }
    } } }, name, pw, pw2 || '', err, go);
    card.append(h('h2', {}, reg ? '注册账号' : '登录账号'), tabs, form,
      h('p', { class: 'note' }, reg
        ? '用户名 3–16 位（英文字母、数字、下划线）。⚠️ 忘记密码没办法找回，请记好。这台设备上的游客进度会一起存进新账号。'
        : '登录后，这台设备上的游客进度会并入你的账号。'),
      h('button', { class: 'link', on: { click: close } }, '先不登录，继续当游客'));
    setTimeout(() => name.focus(), 50);
  }

  function renderMe(card, askDelete) {
    card.append(h('h2', {}, `👤 ${S.user.name}`));
    const st = h('p', { class: 'status' }, STATUS[S.status] || '');
    card.append(st);
    const off = S.onChange(() => { if (!el || !st.isConnected) return off(); if (!S.user) { off(); render(''); } else st.textContent = STATUS[S.status] || ''; });
    card.append(h('p', {}, `图鉴 ${Object.keys(S.save.book).length} 种 · 累计 ${S.save.total} 条。换手机时登录同一个账号就能接着玩。`));
    if (!askDelete) {
      card.append(
        h('button', { class: 'go', on: { click: close } }, '继续钓鱼'),
        h('button', { class: 'sec', on: { click: async e => { e.target.disabled = true; e.target.textContent = '正在退出…'; await S.logout().catch(() => {}); render(''); } } }, '退出登录'),
        h('button', { class: 'link danger', on: { click: () => render('delete') } }, '删除账号'));
      return;
    }
    const pw = h('input', { type: 'password', placeholder: '输入密码确认', autocomplete: 'current-password' });
    const err = h('div', { class: 'err' });
    const del = h('button', { class: 'go danger', type: 'submit' }, '永久删除账号');
    card.append(h('p', { class: 'warn' }, '删除后，这个账号和云端进度会永久清除，不能恢复。'),
      h('form', { on: { submit: async e => {
        e.preventDefault(); err.textContent = ''; del.disabled = true; del.textContent = '正在删除…';
        try { await S.deleteAccount(pw.value); render('deleted'); } catch (x) { err.textContent = x.message; del.disabled = false; del.textContent = '永久删除账号'; }
      } } }, pw, err, del),
      h('button', { class: 'link', on: { click: () => render('') } }, '取消'));
    setTimeout(() => pw.focus(), 50);
  }

  window.AccountUI = { open, close, isOpen: () => !!el };
})();

/* app.js - the main calculator screen. Settings live in config.js. */
(function () {
  'use strict';
  const E = window.CalcEngine;
  const $ = (id) => document.getElementById(id);

  /* ---------------- config (with safe defaults) ---------------- */
  const base = {
    name: 'You', appTitle: 'Calc', greeting: 'timeOfDay', photo: 'profile.jpg', photoCorner: 'left',
    theme: {}, features: { history: true, memory: true, scientific: true, livePreview: true, undoShake: true, haptics: true, sound: false },
    tools: ['convert', 'tip', 'percent', 'dates', 'programmer', 'mine'], formulas: []
  };
  const user = window.CALC_CONFIG || {};
  const C = Object.assign({}, base, user, {
    theme: Object.assign({}, base.theme, user.theme),
    features: Object.assign({}, base.features, user.features)
  });

  /* ---------------- storage ---------------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('calc.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { if (window.calcNoSave) return; try { localStorage.setItem('calc.' + k, JSON.stringify(v)); } catch (e) { /* storage full / blocked */ } },
    del(k) { try { localStorage.removeItem('calc.' + k); } catch (e) { /* ignore */ } }
  };

  /* ---------------- theme + title ---------------- */
  Object.entries(C.theme).forEach(([k, v]) => document.documentElement.style.setProperty('--' + k, v));
  document.title = C.appTitle;
  const tc = document.querySelector('meta[name=theme-color]');
  if (tc && C.theme.bg) tc.content = C.theme.bg;

  /* ---------------- state ---------------- */
  const settings = Object.assign(
    { sound: !!C.features.sound, haptics: !!C.features.haptics, shake: !!C.features.undoShake, angle: 'deg', group: true },
    store.get('settings', {})
  );
  const saved = store.get('state', {});
  const S = {
    expr: saved.expr || '', cur: 0, evaluated: false, result: null, fracMode: 'auto', error: null,
    ans: E.deserialize(saved.ans), mem: E.deserialize(saved.mem), memSet: !!saved.memSet,
    undo: [], history: store.get('history', [])
  };
  S.cur = Math.min(saved.cur == null ? S.expr.length : saved.cur, S.expr.length);
  const persist = () => store.set('state', { expr: S.expr, cur: S.cur, ans: E.serialize(S.ans), mem: E.serialize(S.mem), memSet: S.memSet });
  const opts = () => ({ angle: settings.angle, ans: S.ans });

  /* ---------------- icons ---------------- */
  const svg = (p) => '<svg viewBox="0 0 24 24">' + p + '</svg>';
  $('btnUndo').innerHTML = svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>');
  $('btnHistory').innerHTML = svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
  $('btnTools').innerHTML = svg('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>');
  $('btnSettings').innerHTML = svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>');
  if (!C.features.history) $('btnHistory').hidden = true;
  if (!C.tools.length) $('btnTools').hidden = true;

  /* ---------------- greeting + avatar ---------------- */
  function greetText() {
    if (C.greeting === 'none') return '';
    if (C.greeting === 'hello') return 'Hello, ' + C.name;
    const h = new Date().getHours();
    const w = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
    return w + ', ' + C.name;
  }
  function setGreeting() { $('greet').textContent = greetText(); }
  setGreeting();
  setInterval(setGreeting, 60000);
  if (C.photoCorner === 'right') $('top').classList.add('photo-right');
  $('avatarLetter').textContent = (C.name || '?').trim().charAt(0).toUpperCase();
  function setAvatar() {
    const img = $('avatarImg'), btn = $('avatarBtn');
    const custom = store.get('photoData', null);
    btn.classList.remove('has-img');
    img.onload = () => btn.classList.add('has-img');
    img.onerror = () => btn.classList.remove('has-img');
    img.src = custom || C.photo || '';
  }
  setAvatar();

  /* ---------------- feedback: haptics + click sound ---------------- */
  let actx = null;
  function feedback(strong) {
    if (settings.haptics && navigator.vibrate) navigator.vibrate(strong ? 16 : 8);
    if (settings.sound) {
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = strong ? 880 : 1300; o.type = 'sine';
        g.gain.setValueAtTime(0.06, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.05);
        o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.06);
      } catch (e) { /* no audio */ }
    }
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg, actionLabel, action) {
    const t = $('toast');
    t.innerHTML = '';
    const s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
    if (actionLabel) {
      const b = document.createElement('button'); b.textContent = actionLabel;
      b.onclick = () => { t.classList.remove('show'); action(); };
      t.appendChild(b);
    }
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), actionLabel ? 5000 : 2200);
  }

  /* ---------------- formatting helpers ---------------- */
  const group = (s) => (settings.group ? s.replace(/(\d+)(\.\d*)?(E-?\d+)?/g, (m, i, f, e) => i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f || '') + (e || '')) : s);
  const plainNumber = (s) => /^[\d.]*$/.test(s.trim());

  /* ---------------- the "live value" of what's typed ---------------- */
  function liveValue() {
    if (S.evaluated) return S.result;
    const s = S.expr;
    if (!s.trim()) return null;
    let r = E.tryEvaluate(s, opts());
    if (r.ok) return r.value;
    let t = s;
    for (let i = 0; i < 3; i++) {
      t = t.replace(/(?:[a-z]+\(|[+−×÷^(,.]| mod )\s*$/, '');
      if (!t) return null;
      r = E.tryEvaluate(t, opts());
      if (r.ok) return r.value;
    }
    return null;
  }

  /* ---------------- editing ---------------- */
  function snapshot() {
    const last = S.undo[S.undo.length - 1];
    if (last && last.expr === S.expr) return;
    S.undo.push({ expr: S.expr, cur: S.cur });
    if (S.undo.length > 200) S.undo.shift();
  }
  function beginEdit(keep) {
    S.error = null;
    if (S.evaluated) {
      S.evaluated = false;
      if (!keep) { snapshot(); S.expr = ''; S.cur = 0; }
      else S.cur = S.expr.length;
    }
  }
  function insertAt(str) {
    snapshot();
    S.expr = S.expr.slice(0, S.cur) + str + S.expr.slice(S.cur);
    S.cur += str.length;
    S.fracMode = 'auto';
    render();
  }
  function pressDigit(d) { beginEdit(false); insertAt(d); }
  function pressDot() {
    beginEdit(false);
    let i = S.cur;
    while (i > 0 && /[0-9.]/.test(S.expr[i - 1])) i--;
    const seg = S.expr.slice(i, S.cur);
    if (seg.includes('.')) return;
    insertAt(seg === '' ? '0.' : '.');
  }
  function pressOp(op) {
    if (S.evaluated) { S.evaluated = false; S.error = null; snapshot(); S.expr = 'Ans'; S.cur = 3; }
    else {
      S.error = null;
      const left = S.expr.slice(0, S.cur);
      if (!left && op !== '−') { snapshot(); S.expr = 'Ans' + S.expr; S.cur = 3; }
    }
    const before = S.expr[S.cur - 1];
    if (before === '(' && op !== '−') return;
    if (before && '+−×÷^'.includes(before)) {
      if (op === '−' && '×÷^'.includes(before)) { insertAt(op); return; }
      // replace the previous operator(s)
      let n = 1;
      while (S.cur - n - 1 >= 0 && '+−×÷^'.includes(S.expr[S.cur - n - 1]) && S.cur - n - 1 > 0) n++;
      snapshot();
      S.expr = S.expr.slice(0, S.cur - n) + S.expr.slice(S.cur);
      S.cur -= n;
    }
    insertAt(op);
  }
  function pressInsert(text) {
    const postfix = text === '%' || text === '!' || text[0] === '^' || text === ' mod ';
    if (postfix) {
      if (S.evaluated) { S.evaluated = false; S.error = null; snapshot(); S.expr = 'Ans'; S.cur = 3; }
      else if (!S.expr.slice(0, S.cur)) {
        if (text === '%' || text === '!') return;
        snapshot(); S.expr = 'Ans' + S.expr; S.cur = 3;
      } else S.error = null;
    } else beginEdit(false);
    insertAt(text);
  }
  function backspace() {
    if (S.evaluated) { S.evaluated = false; S.cur = S.expr.length; }
    S.error = null;
    if (S.cur === 0) return;
    const left = S.expr.slice(0, S.cur);
    const m = /(?:[A-Za-z]+\(|Ans| mod )$/.exec(left);
    const len = m ? m[0].length : 1;
    snapshot();
    S.expr = left.slice(0, -len) + S.expr.slice(S.cur);
    S.cur -= len;
    S.fracMode = 'auto';
    render();
  }
  function clearAll() {
    snapshot();
    S.expr = ''; S.cur = 0; S.evaluated = false; S.error = null; S.fracMode = 'auto';
    render();
  }
  function moveCursor(dir) {
    if (S.evaluated) { S.evaluated = false; S.cur = S.expr.length; }
    S.cur = Math.max(0, Math.min(S.expr.length, S.cur + dir));
    render();
  }
  function undo() {
    const s = S.undo.pop();
    if (!s) { toast('Nothing to undo'); return; }
    S.expr = s.expr; S.cur = s.cur; S.evaluated = false; S.error = null;
    render();
  }

  function equals() {
    if (S.evaluated || !S.expr.trim()) return;
    const r = E.tryEvaluate(S.expr, opts());
    if (!r.ok) {
      S.error = r.error; render();
      const d = $('display'); d.classList.remove('shake-err'); void d.offsetWidth; d.classList.add('shake-err');
      return;
    }
    const d = E.describe(r.value, 'auto');
    if (!plainNumber(S.expr) && C.features.history) {
      S.history.unshift({ id: Date.now() + Math.random(), expr: S.expr, res: d.main, ins: E.toInsertText(r.value), note: '', ts: Date.now() });
      if (S.history.length > 500) S.history.pop();
      store.set('history', S.history);
    }
    S.ans = r.value; S.result = r.value; S.evaluated = true; S.fracMode = 'auto'; S.error = null;
    render();
  }

  /* ---------------- rendering ---------------- */
  function render() {
    const wrap = $('exprWrap'), ex = $('expr');
    // expression with caret
    let html = '';
    const esc = (c) => (c === '<' ? '&lt;' : c === '&' ? '&amp;' : c === ' ' ? '&nbsp;' : c);
    for (let i = 0; i <= S.expr.length; i++) {
      if (i === S.cur && !S.evaluated) html += '<span class="caret"></span>';
      if (i < S.expr.length) html += '<span class="c" data-i="' + i + '">' + esc(S.expr[i]) + '</span>';
    }
    if (S.evaluated) html += '<span class="c">&nbsp;=</span>';
    ex.innerHTML = html || '<span class="caret"></span>';
    document.body.classList.toggle('evaluated', S.evaluated);

    const res = $('result'), alt = $('altLine');
    res.classList.remove('error');
    let value = null;
    if (S.error) { res.textContent = S.error; res.classList.add('error'); alt.textContent = ''; }
    else {
      if (S.evaluated) value = S.result;
      else if (C.features.livePreview && !plainNumber(S.expr)) value = liveValue();
      if (value === null || value === undefined) { res.textContent = ''; alt.textContent = ''; }
      else {
        const d = E.describe(value, S.fracMode);
        res.textContent = (S.evaluated ? '' : '= ') + group(d.main);
        alt.textContent = d.alt ? group(d.alt) : '';
        res.dataset.toggle = d.alt ? '1' : '';
      }
    }
    // keep caret in view
    const caret = ex.querySelector('.caret');
    if (S.evaluated) wrap.scrollLeft = wrap.scrollWidth;
    else if (caret) {
      const cl = caret.offsetLeft, w = wrap.clientWidth;
      if (cl < wrap.scrollLeft + 20) wrap.scrollLeft = Math.max(0, cl - 60);
      else if (cl > wrap.scrollLeft + w - 20) wrap.scrollLeft = cl - w + 60;
    }
    $('memFlag').classList.toggle('on', S.memSet);
    document.querySelectorAll('.u[data-mem]').forEach((b) => b.classList.toggle('mem-on', S.memSet && (b.dataset.mem === 'MR' || b.dataset.mem === 'MC')));
    const angleKey = document.querySelector('[data-angle]');
    if (angleKey) angleKey.textContent = settings.angle.toUpperCase();
    persist();
  }

  /* ---------------- keypad ---------------- */
  function bindKey(el, fn, repeat, strong) {
    let timer, iv;
    const stop = () => { el.classList.remove('pressed'); clearTimeout(timer); clearInterval(iv); };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      feedback(strong);
      fn();
      if (repeat) timer = setTimeout(() => { iv = setInterval(fn, 70); }, 420);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, stop));
  }
  function key(parent, label, cls, fn, opt) {
    opt = opt || {};
    const b = document.createElement('button');
    b.className = cls; b.textContent = label;
    if (opt.aria) b.setAttribute('aria-label', opt.aria);
    if (opt.data) Object.entries(opt.data).forEach(([k, v]) => b.setAttribute('data-' + k, v));
    bindKey(b, fn, opt.repeat, opt.strong);
    parent.appendChild(b);
    return b;
  }

  // memory helpers
  function memAdd(sign) {
    const v = liveValue();
    if (v === null || v === undefined) { toast('Nothing to add yet'); return; }
    S.mem = sign > 0 ? E.add(S.mem, v) : E.sub(S.mem, v);
    S.memSet = true;
    toast('Memory = ' + group(E.describe(S.mem, 'auto').main));
    render();
  }
  function memRecall() {
    if (!S.memSet) { toast('Memory is empty'); return; }
    beginEdit(false); insertAt(E.toInsertText(S.mem));
  }
  function memClear() { S.mem = E.zero(); S.memSet = false; toast('Memory cleared'); render(); }

  const util = $('utilRow');
  if (C.features.memory) {
    key(util, 'MC', 'u', memClear, { data: { mem: 'MC' } });
    key(util, 'MR', 'u', memRecall, { data: { mem: 'MR' } });
    key(util, 'M+', 'u', () => memAdd(1), { data: { mem: 'M+' } });
    key(util, 'M−', 'u', () => memAdd(-1), { data: { mem: 'M-' } });
  }
  key(util, '◀', 'u', () => moveCursor(-1), { repeat: true, aria: 'Move cursor left' });
  key(util, '▶', 'u', () => moveCursor(1), { repeat: true, aria: 'Move cursor right' });
  key(util, '(', 'u', () => pressInsert('('));
  key(util, ')', 'u', () => pressInsert(')'));

  const basic = $('basic');
  const B = (label, cls, fn, o) => key(basic, label, 'k ' + cls, fn, o);
  B('AC', 'fn', clearAll);
  B('⌫', 'fn', backspace, { repeat: true, aria: 'Backspace' });
  B('%', 'fn', () => pressInsert('%'));
  B('÷', 'op', () => pressOp('÷'));
  ['7', '8', '9'].forEach((d) => B(d, 'num', () => pressDigit(d)));
  B('×', 'op', () => pressOp('×'));
  ['4', '5', '6'].forEach((d) => B(d, 'num', () => pressDigit(d)));
  B('−', 'op', () => pressOp('−'));
  ['1', '2', '3'].forEach((d) => B(d, 'num', () => pressDigit(d)));
  B('+', 'op', () => pressOp('+'));
  B('Ans', 'fn', () => pressInsert('Ans'));
  B('0', 'num', () => pressDigit('0'));
  B('.', 'num', pressDot);
  B('=', 'eq', equals, { strong: true });

  const sci = $('sci');
  const SK = (label, text) => key(sci, label, 'k fn', () => pressInsert(text));
  if (C.features.scientific) {
    $('pads').classList.add('has-sci');
    SK('sin', 'sin('); SK('cos', 'cos('); SK('tan', 'tan(');
    key(sci, 'π', 'k fn', () => pressInsert('π')); key(sci, 'e', 'k fn', () => pressInsert('e'));
    SK('sin⁻¹', 'asin('); SK('cos⁻¹', 'acos('); SK('tan⁻¹', 'atan('); SK('x²', '^2'); SK('xʸ', '^');
    SK('ln', 'ln('); SK('log', 'log('); SK('√', '√('); SK('∛', 'cbrt('); SK('x!', '!');
    SK('eˣ', 'exp('); SK('10ˣ', '10^'); SK('|x|', 'abs('); SK('mod', ' mod ');
    key(sci, 'DEG', 'k fn', () => { settings.angle = settings.angle === 'deg' ? 'rad' : 'deg'; store.set('settings', settings); render(); }, { data: { angle: 1 } });
    SK('1/x', '^(−1)'); SK('EE', 'E'); SK('nCr', 'ncr('); SK('nPr', 'npr('); SK(',', ',');
  }

  /* ---------------- display interactions ---------------- */
  $('expr').addEventListener('click', (e) => {
    if (swiped) { swiped = false; return; }
    const t = e.target.closest('.c');
    if (S.evaluated) { S.evaluated = false; }
    if (t && t.dataset.i !== undefined) {
      const r = t.getBoundingClientRect();
      S.cur = +t.dataset.i + (e.clientX > r.left + r.width / 2 ? 1 : 0);
    } else S.cur = S.expr.length;
    render();
  });
  $('exprWrap').addEventListener('click', (e) => {
    if (e.target === $('exprWrap')) { if (S.evaluated) S.evaluated = false; S.cur = S.expr.length; render(); }
  });
  $('result').addEventListener('click', () => {
    if (!$('result').dataset.toggle) return;
    const v = S.evaluated ? S.result : liveValue();
    if (v === null || v === undefined) return;
    S.fracMode = E.describe(v, S.fracMode).mainIsFraction ? 'dec' : 'frac';
    render();
  });
  // swipe left on the expression = delete as you drag
  let swiped = false;
  (function () {
    const el = $('exprWrap');
    let x0 = null, y0 = 0, steps = 0;
    el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; steps = 0; swiped = false; }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (x0 === null) return;
      const dx = x0 - e.touches[0].clientX, dy = Math.abs(y0 - e.touches[0].clientY);
      if (dy > 40) return;
      const n = Math.floor(dx / 30);
      if (n > steps && dx > 40) { for (let i = steps; i < n; i++) backspace(); steps = n; swiped = true; feedback(); }
    }, { passive: true });
    el.addEventListener('touchend', () => { x0 = null; setTimeout(() => { swiped = false; }, 50); });
  })();

  function shownText() {
    const v = liveValue();
    if (v === null || v === undefined) return S.expr;
    return E.describe(v, S.fracMode).main;
  }
  function copyText(text) {
    const done = () => toast('Copied  ' + (text.length > 24 ? text.slice(0, 24) + '…' : text));
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Copy not allowed here'); }
    ta.remove();
  }
  $('btnCopy').onclick = () => { const t = shownText(); if (!t) { toast('Nothing to copy'); return; } copyText(t); };
  function handlePaste(text) {
    const t = String(text).trim().replace(/[$,\s]/g, '').replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−').replace(/[^0-9.+−×÷^()!%A-Za-zπ√]/g, '');
    if (!t) { toast('Nothing usable to paste'); return; }
    beginEdit(false); insertAt(t);
  }
  $('btnPaste').onclick = () => {
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(handlePaste, () => toast('Paste blocked - allow clipboard access'));
    else toast('Paste not supported here');
  };
  document.addEventListener('paste', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ''))) return;
    handlePaste((e.clipboardData || window.clipboardData).getData('text'));
  });

  /* ---------------- physical keyboard (handy on a computer) ---------------- */
  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.sheet')) return;
    const k = e.key;
    if (/^[0-9]$/.test(k)) pressDigit(k);
    else if (k === '.') pressDot();
    else if (k === '+') pressOp('+');
    else if (k === '-') pressOp('−');
    else if (k === '*' || k === 'x') pressOp('×');
    else if (k === '/') pressOp('÷');
    else if (k === '^') pressInsert('^');
    else if (k === '(' || k === ')' || k === '%' || k === '!') pressInsert(k);
    else if (k === 'Enter' || k === '=') equals();
    else if (k === 'Backspace') backspace();
    else if (k === 'Escape' || k === 'Delete') clearAll();
    else if (k === 'ArrowLeft') moveCursor(-1);
    else if (k === 'ArrowRight') moveCursor(1);
    else return;
    e.preventDefault();
  });

  /* ---------------- shake to clear / shake again to undo ---------------- */
  let lastClear = null;
  function onShake() {
    if (S.expr || S.evaluated) {
      lastClear = { expr: S.expr, cur: S.cur, t: Date.now() };
      clearAll();
      toast('Cleared', 'Undo', restoreClear);
      feedback(true);
    } else if (lastClear && Date.now() - lastClear.t < 10000) restoreClear();
  }
  function restoreClear() {
    if (!lastClear) return;
    S.expr = lastClear.expr; S.cur = lastClear.cur; S.evaluated = false; lastClear = null; render();
  }
  (function () {
    let lastMag = null, count = 0, first = 0, lastFire = 0;
    window.addEventListener('devicemotion', (e) => {
      if (!settings.shake) return;
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
      if (lastMag !== null && Math.abs(mag - lastMag) > 14) {
        const now = Date.now();
        if (now - first > 900) { first = now; count = 0; }
        count++;
        if (count >= 4 && now - lastFire > 1500) { lastFire = now; count = 0; onShake(); }
      }
      lastMag = mag;
    });
  })();

  /* ---------------- sheets ---------------- */
  const sheetRoot = $('sheetRoot');
  let sheetEl = null;
  function removeSheetDom() { if (sheetEl) { sheetEl.remove(); sheetEl = null; } }
  function closeSheet() { if (sheetEl) { if (history.state && history.state.sheet) history.back(); else removeSheetDom(); } }
  window.addEventListener('popstate', removeSheetDom);
  function openSheet(title, build) {
    const replacing = !!sheetEl;
    removeSheetDom();
    const el = document.createElement('div');
    el.className = 'sheet';
    el.innerHTML = '<div class="sheet-head"><h2></h2><span class="head-actions"></span><button class="x">Close</button></div><div class="sheet-body"></div>';
    el.querySelector('h2').textContent = title;
    el.querySelector('.x').onclick = closeSheet;
    sheetRoot.appendChild(el);
    sheetEl = el;
    if (!replacing) history.pushState({ sheet: 1 }, '');
    build(el.querySelector('.sheet-body'), el.querySelector('.head-actions'), el);
    return el;
  }
  const h = (tag, props, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n[k] = v; else n.setAttribute(k, v);
    });
    kids.forEach((c) => c && n.append(c));
    return n;
  };

  /* ----- history ----- */
  function openHistory() {
    openSheet('History', (body, actions) => {
      const draw = () => {
        body.innerHTML = '';
        if (!S.history.length) { body.append(h('div', { class: 'empty', text: 'Nothing here yet. Your finished calculations show up here.' })); return; }
        S.history.forEach((it) => {
          const item = h('div', { class: 'h-item' });
          item.append(h('div', { class: 'h-expr', text: it.expr + ' =', onclick: () => { S.expr = it.expr; S.cur = it.expr.length; S.evaluated = false; S.error = null; closeSheet(); render(); } }));
          item.append(h('div', { class: 'h-res', text: group(it.res), onclick: () => { closeSheet(); beginEdit(false); insertAt(it.ins); } }));
          if (it.note) item.append(h('div', { class: 'h-note', text: '✎ ' + it.note }));
          const tools = h('div', { class: 'h-tools' });
          tools.append(h('button', { text: it.note ? 'Edit note' : 'Add note', onclick: () => {
            const inp = h('input', { placeholder: 'What was this for?', value: it.note || '' });
            inp.value = it.note || '';
            const save = () => { it.note = inp.value.trim(); store.set('history', S.history); draw(); };
            inp.onkeydown = (e) => { if (e.key === 'Enter') save(); };
            inp.onblur = save;
            item.append(inp); inp.focus();
          } }));
          tools.append(h('button', { text: 'Copy', onclick: () => copyText(it.res) }));
          tools.append(h('button', { text: 'Delete', onclick: () => { S.history = S.history.filter((x) => x !== it); store.set('history', S.history); draw(); } }));
          item.append(tools);
          body.append(item);
        });
        body.append(h('div', { class: 'hint', text: 'Tap an answer to use it. Tap the calculation to bring it back and edit it.', style: 'text-align:center;margin-top:14px' }));
      };
      actions.append(h('button', { text: 'Clear all', onclick: () => { if (S.history.length && confirm('Delete all history?')) { S.history = []; store.set('history', S.history); draw(); } } }));
      draw();
    });
  }

  /* ----- tools ----- */
  function openTools(startId) {
    const api = {
      store, toast, copyText, E, C, h, group,
      sendToCalc(text) { closeSheet(); setTimeout(() => { beginEdit(false); insertAt(String(text)); }, 30); }
    };
    const list = window.CalcTools.list.filter((t) => C.tools.includes(t.id));
    openSheet('Tools', (body) => {
      body.style.padding = '0';
      const tabs = h('div', { class: 'tabs' });
      const area = h('div', { style: 'padding:14px;padding-bottom:40px' });
      const show = (t) => {
        store.set('lastTool', t.id);
        tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.id === t.id));
        area.innerHTML = '';
        t.render(area, api);
      };
      list.forEach((t) => tabs.append(h('button', { class: 'tab', 'data-id': t.id, text: t.title, onclick: () => show(t) })));
      body.append(tabs, area);
      body.style.display = 'flex'; body.style.flexDirection = 'column';
      area.style.overflowY = 'auto'; area.style.flex = '1';
      show(list.find((t) => t.id === (startId || store.get('lastTool'))) || list[0]);
    });
  }

  /* ----- settings ----- */
  function openSettings() {
    openSheet('Settings', (body) => {
      const sw = (label, sub, key, after) => {
        const inp = h('input', { type: 'checkbox' }); inp.checked = !!settings[key];
        inp.onchange = () => { settings[key] = inp.checked; store.set('settings', settings); if (after) after(); render(); };
        return h('div', { class: 'setrow' }, h('div', {}, h('div', { text: label }), sub ? h('small', { text: sub }) : null), h('label', { class: 'sw' }, inp, h('i')));
      };
      const card1 = h('div', { class: 'card' });
      card1.append(
        sw('Haptic buzz', 'Tiny vibration on every key', 'haptics', () => feedback()),
        sw('Click sounds', 'A soft tick when you press keys', 'sound', () => feedback()),
        sw('Shake to clear', 'Shake the phone to clear, shake again to undo', 'shake'),
        sw('Comma separators', '1,234,567 instead of 1234567', 'group')
      );
      const seg = h('div', { class: 'seg' });
      ['deg', 'rad'].forEach((a) => seg.append(h('button', { class: settings.angle === a ? 'on' : '', text: a.toUpperCase(), onclick: () => { settings.angle = a; store.set('settings', settings); seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent.toLowerCase() === a)); render(); } })));
      card1.append(h('div', { class: 'setrow' }, h('div', {}, h('div', { text: 'Angles' }), h('small', { text: 'For sin, cos, tan' })), seg));

      const card2 = h('div', { class: 'card' });
      const file = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
      file.onchange = () => {
        const f = file.files[0]; if (!f) return;
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = c.height = 256;
          const s = Math.min(img.width, img.height);
          c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
          store.set('photoData', c.toDataURL('image/jpeg', 0.85)); setAvatar(); toast('Photo updated');
        };
        img.src = URL.createObjectURL(f);
      };
      card2.append(
        h('div', { class: 'setrow' }, h('div', { text: 'Profile photo' }), h('div', { class: 'row', style: 'flex:none;gap:8px' },
          h('button', { class: 'btn ghost', text: 'Change', onclick: () => file.click() }),
          h('button', { class: 'btn ghost', text: 'Reset', onclick: () => { store.del('photoData'); setAvatar(); toast('Using the photo from config.js'); } }))),
        file
      );
      const card3 = h('div', { class: 'card' });
      card3.append(
        h('div', { class: 'setrow' }, h('div', {}, h('div', { text: 'Cloud save' }), h('small', { text: 'Sign in with Google to keep your data online' })), h('button', { class: 'btn ghost', text: 'Open', onclick: () => { if (window.Cloud) Cloud.open(); } })),
        h('div', { class: 'setrow' }, h('div', { text: 'Clear history' }), h('button', { class: 'btn ghost', text: 'Clear', onclick: () => { S.history = []; store.set('history', []); toast('History cleared'); } })),
        h('div', { class: 'setrow' }, h('div', { text: 'Reset everything', }), h('button', { class: 'btn danger', text: 'Reset', onclick: () => { if (confirm('Erase history, memory, settings, photo and saved formulas on this device?')) { try { Object.keys(localStorage).filter((k) => k.startsWith('calc.')).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ } (window.calcForget ? window.calcForget() : Promise.resolve()).then(() => location.reload()); } } }))
      );
      body.append(card1, card2, card3, h('div', { class: 'hint', text: 'To change the name, colors, or which features and tools are on, edit config.js (see README). Version 1.0' }));
    });
  }

  $('btnHistory').onclick = openHistory;
  $('btnTools').onclick = () => openTools();
  $('btnSettings').onclick = openSettings;
  $('avatarBtn').onclick = openSettings;
  $('btnUndo').onclick = undo;
  $('btnUndo').addEventListener('click', () => feedback());

  /* ---------------- go ---------------- */
  render();
  if (window.Cloud) Cloud.init({
    app: 'calculator',
    read: () => { try { const o = {}; Object.keys(localStorage).filter((k) => k.startsWith('calc.')).sort().forEach((k) => { o[k] = localStorage.getItem(k); }); return Object.keys(o).length ? JSON.stringify(o) : null; } catch (e) { return null; } },
    write: (s) => { window.calcNoSave = true; try { const o = JSON.parse(s); Object.keys(localStorage).filter((k) => k.startsWith('calc.')).forEach((k) => localStorage.removeItem(k)); Object.keys(o).forEach((k) => localStorage.setItem(k, o[k])); } catch (e) { /* ignore */ } },
    score: (s) => { try { const o = JSON.parse(s); let n = o['calc.photoData'] ? 1000 : 0; try { n += (JSON.parse(o['calc.history'] || '[]').length) * 10; } catch (e) { /* ignore */ } return n; } catch (e) { return 0; } },
    describe: (s) => { try { const o = JSON.parse(s); return (o['calc.photoData'] ? 'photo, ' : 'no photo, ') + JSON.parse(o['calc.history'] || '[]').length + ' history items'; } catch (e) { return 'empty'; } }
  });
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      const check = () => { try { reg.update(); } catch (e) { /* ignore */ } };
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); }); setInterval(check, 5 * 60 * 1000);
    }).catch(() => { /* offline support is optional */ });
  }
})();

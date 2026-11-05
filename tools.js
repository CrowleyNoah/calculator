/* tools.js - the Tools menu: converter, tip split, percent helpers,
   date calculator, programmer mode, and "Mine" (your own formulas). */
(function () {
  'use strict';
  const E = window.CalcEngine;
  const list = [];

  /* ---------- small helpers ---------- */
  const parse = (s) => { const n = Number(String(s).replace(/[$,\s%]/g, '')); return s === '' || s == null ? NaN : n; };
  const money = (x) => (isFinite(x) ? x.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—');
  const nice = (x) => (isFinite(x) ? E.fmtFloat(Number(x.toPrecision(12))) : '—');
  const pct = (x) => (isFinite(x) ? nice(Math.round(x * 1e8) / 1e8) + '%' : '—');

  function ui(api) {
    const h = api.h;
    return {
      h,
      field(label, input) { return h('div', { class: 'field' }, h('label', { text: label }), input); },
      input(value, oninput, mode) {
        const i = h('input', { type: 'text', inputmode: mode || 'decimal', autocomplete: 'off' });
        i.value = value == null ? '' : value;
        i.oninput = () => oninput(i.value);
        return i;
      },
      select(options, value, onchange) {
        const s = h('select');
        options.forEach(([v, label]) => { const o = h('option', { value: v, text: label }); s.append(o); });
        s.value = value;
        s.onchange = () => onchange(s.value);
        return s;
      },
      out(label, value, big) { return h('div', { class: 'out' + (big ? ' big' : '') }, h('span', { class: 'l', text: label }), h('span', { class: 'v', text: value })); },
      chips(items, current, onpick) {
        const wrap = h('div', { class: 'chips' });
        items.forEach(([v, label]) => {
          const b = h('button', { class: 'chip' + (String(v) === String(current) ? ' on' : ''), text: label });
          b.onclick = () => { wrap.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); b.classList.add('on'); onpick(v); };
          wrap.append(b);
        });
        return wrap;
      },
      sendBtn(getText) {
        return h('button', { class: 'btn ghost', text: 'Use in calculator', onclick: () => { const t = getText(); if (t) api.sendToCalc(t); } });
      }
    };
  }

  /* ================== UNIT CONVERTER ================== */
  const UNITS = {
    Length: { def: ['mi', 'km'], u: [['m', 'Meters', 1], ['km', 'Kilometers', 1000], ['cm', 'Centimeters', 0.01], ['mm', 'Millimeters', 0.001], ['mi', 'Miles', 1609.344], ['yd', 'Yards', 0.9144], ['ft', 'Feet', 0.3048], ['in', 'Inches', 0.0254], ['nmi', 'Nautical miles', 1852]] },
    Weight: { def: ['lb', 'kg'], u: [['kg', 'Kilograms', 1], ['g', 'Grams', 0.001], ['mg', 'Milligrams', 1e-6], ['lb', 'Pounds', 0.45359237], ['oz', 'Ounces', 0.028349523125], ['st', 'Stone', 6.35029318], ['t', 'Metric tons', 1000]] },
    Temperature: { def: ['F', 'C'], u: [['C', 'Celsius'], ['F', 'Fahrenheit'], ['K', 'Kelvin']] },
    Volume: { def: ['cup', 'mL'], u: [['L', 'Liters', 1], ['mL', 'Milliliters', 0.001], ['gal', 'Gallons (US)', 3.785411784], ['qt', 'Quarts', 0.946352946], ['pt', 'Pints', 0.473176473], ['cup', 'Cups', 0.2365882365], ['floz', 'Fluid ounces', 0.0295735295625], ['tbsp', 'Tablespoons', 0.01478676478125], ['tsp', 'Teaspoons', 0.00492892159375]] },
    Speed: { def: ['mph', 'km/h'], u: [['m/s', 'Meters / sec', 1], ['km/h', 'Kilometers / hour', 1 / 3.6], ['mph', 'Miles / hour', 0.44704], ['kn', 'Knots', 1852 / 3600]] }
  };
  function convertValue(cat, x, from, to) {
    if (cat === 'Temperature') {
      const c = from === 'C' ? x : from === 'F' ? ((x - 32) * 5) / 9 : x - 273.15;
      return to === 'C' ? c : to === 'F' ? (c * 9) / 5 + 32 : c + 273.15;
    }
    const f = (code) => UNITS[cat].u.find((u) => u[0] === code)[2];
    return (x * f(from)) / f(to);
  }
  list.push({
    id: 'convert', title: 'Convert',
    render(root, api) {
      const U = ui(api);
      const st = Object.assign({ cat: 'Length', val: '1', from: null, to: null }, api.store.get('conv', {}));
      const draw = () => {
        root.innerHTML = '';
        const cat = UNITS[st.cat];
        if (!cat.u.some((u) => u[0] === st.from)) st.from = cat.def[0];
        if (!cat.u.some((u) => u[0] === st.to)) st.to = cat.def[1];
        const opts = cat.u.map((u) => [u[0], u[1] + ' (' + u[0] + ')']);
        root.append(U.chips(Object.keys(UNITS).map((k) => [k, k]), st.cat, (k) => { st.cat = k; st.from = null; st.to = null; draw(); }));
        const card = U.h('div', { class: 'card' });
        card.append(U.field('Amount', U.input(st.val, (v) => { st.val = v; api.store.set('conv', st); update(); })));
        const fromSel = U.select(opts, st.from, (v) => { st.from = v; update(); });
        const toSel = U.select(opts, st.to, (v) => { st.to = v; update(); });
        const swap = U.h('button', { class: 'swap', text: '⇅', onclick: () => { [st.from, st.to] = [st.to, st.from]; fromSel.value = st.from; toSel.value = st.to; update(); } });
        card.append(U.h('div', { class: 'row' }, U.field('From', fromSel), swap, U.field('To', toSel)));
        const big = U.h('div', { class: 'out big' });
        card.append(big);
        root.append(card);
        const all = U.h('div', { class: 'card' });
        root.append(all, U.sendBtn(() => (isFinite(cur) ? nice(cur) : '')));
        let cur = NaN;
        function update() {
          api.store.set('conv', st);
          const x = parse(st.val);
          cur = isFinite(x) ? convertValue(st.cat, x, st.from, st.to) : NaN;
          big.innerHTML = '';
          big.append(U.h('span', { class: 'l', text: isFinite(x) ? api.group(nice(x)) + ' ' + st.from + ' =' : '' }), U.h('span', { class: 'v', text: isFinite(cur) ? api.group(nice(cur)) + ' ' + st.to : '—' }));
          all.innerHTML = '';
          cat.u.forEach((u) => {
            const v = isFinite(x) ? convertValue(st.cat, x, st.from, u[0]) : NaN;
            const row = U.out(u[1], isFinite(v) ? api.group(nice(v)) + ' ' + u[0] : '—');
            row.style.cursor = 'pointer';
            row.onclick = () => { st.to = u[0]; toSel.value = u[0]; update(); };
            all.append(row);
          });
        }
        update();
      };
      draw();
    }
  });

  /* ================== TIP + BILL SPLIT ================== */
  list.push({
    id: 'tip', title: 'Tip & split',
    render(root, api) {
      const U = ui(api);
      const st = Object.assign({ bill: '', tax: '', tip: '18', people: '1', pre: true, roundUp: false }, api.store.get('tip', {}));
      const card = U.h('div', { class: 'card' });
      const res = U.h('div', { class: 'card' });
      const update = () => {
        api.store.set('tip', st);
        const bill = parse(st.bill) || 0, taxP = parse(st.tax) || 0, tipP = parse(st.tip) || 0;
        const people = Math.max(1, Math.floor(parse(st.people) || 1));
        const tax = (bill * taxP) / 100;
        const tip = ((st.pre ? bill : bill + tax) * tipP) / 100;
        const total = bill + tax + tip;
        let per = total / people;
        if (st.roundUp) per = Math.ceil(per - 1e-9);
        res.innerHTML = '';
        res.append(U.out('Tax', money(tax)), U.out('Tip', money(tip)), U.out('Total', money(st.roundUp ? per * people : total)), U.out(people > 1 ? 'Each of ' + people : 'Per person', money(per), true));
        if (st.roundUp && people > 1) res.append(U.h('div', { class: 'hint', text: 'Rounded up to whole dollars each.' }));
        lastPer = per;
      };
      let lastPer = 0;
      card.append(
        U.field('Bill (before tax)', U.input(st.bill, (v) => { st.bill = v; update(); })),
        U.h('div', { class: 'row' },
          U.field('Tax %', U.input(st.tax, (v) => { st.tax = v; update(); })),
          U.field('People', U.input(st.people, (v) => { st.people = v; update(); }, 'numeric'))
        ),
        U.h('div', { class: 'lbl', text: 'Tip %' }),
        U.chips([['10', '10%'], ['15', '15%'], ['18', '18%'], ['20', '20%'], ['25', '25%']], st.tip, (v) => { st.tip = v; tipIn.value = v; update(); })
      );
      const tipIn = U.input(st.tip, (v) => { st.tip = v; update(); });
      card.append(U.field('Custom tip %', tipIn));
      const mkSwitch = (label, key) => {
        const inp = U.h('input', { type: 'checkbox' }); inp.checked = !!st[key];
        inp.onchange = () => { st[key] = inp.checked; update(); };
        return U.h('div', { class: 'setrow' }, U.h('div', { text: label }), U.h('label', { class: 'sw' }, inp, U.h('i')));
      };
      card.append(mkSwitch('Tip on the pre-tax amount', 'pre'), mkSwitch('Round each share up', 'roundUp'));
      root.append(card, res, U.sendBtn(() => (lastPer ? (Math.round(lastPer * 100) / 100).toString() : '')));
      update();
    }
  });

  /* ================== PERCENT HELPERS ================== */
  const PMODES = [
    { id: 'of', name: 'What is X% of Y?', a: 'X (%)', b: 'Y', calc: (a, b) => [['Answer', nice((a / 100) * b), true]] },
    { id: 'whatpct', name: 'X is what % of Y?', a: 'X', b: 'Y', calc: (a, b) => [['Answer', pct((a / b) * 100), true]] },
    { id: 'change', name: '% change from X to Y', a: 'From (X)', b: 'To (Y)', calc: (a, b) => [['Change', pct(((b - a) / a) * 100), true], ['Difference', nice(b - a)]] },
    { id: 'off', name: 'X% off Y (sale)', a: 'Discount (%)', b: 'Price', calc: (a, b) => [['You pay', money(b * (1 - a / 100)), true], ['You save', money((b * a) / 100)]] },
    { id: 'add', name: 'Add X% to Y (tax, markup)', a: 'Add (%)', b: 'Amount', calc: (a, b) => [['Total', money(b * (1 + a / 100)), true], ['Extra', money((b * a) / 100)]] },
    { id: 'remove', name: 'Y includes X% - find the original', a: 'Included (%)', b: 'Total', calc: (a, b) => [['Original', money(b / (1 + a / 100)), true], ['The X% part', money(b - b / (1 + a / 100))]] }
  ];
  list.push({
    id: 'percent', title: 'Percent',
    render(root, api) {
      const U = ui(api);
      const st = Object.assign({ mode: 'off', a: '', b: '' }, api.store.get('pct', {}));
      const draw = () => {
        root.innerHTML = '';
        const m = PMODES.find((x) => x.id === st.mode) || PMODES[0];
        const card = U.h('div', { class: 'card' });
        const res = U.h('div', { class: 'card' });
        let first = '';
        const update = () => {
          api.store.set('pct', st);
          const a = parse(st.a), b = parse(st.b);
          res.innerHTML = '';
          if (!isFinite(a) || !isFinite(b)) { res.append(U.h('div', { class: 'hint', text: 'Fill in both boxes.' })); first = ''; return; }
          const rows = m.calc(a, b);
          rows.forEach(([l, v, big]) => res.append(U.out(l, v, big)));
          first = rows[0][1].replace(/[$,%\s]/g, '');
        };
        card.append(
          U.field('What do you want to work out?', U.select(PMODES.map((x) => [x.id, x.name]), st.mode, (v) => { st.mode = v; draw(); })),
          U.h('div', { class: 'row' }, U.field(m.a, U.input(st.a, (v) => { st.a = v; update(); })), U.field(m.b, U.input(st.b, (v) => { st.b = v; update(); })))
        );
        root.append(card, res, U.sendBtn(() => first));
        update();
      };
      draw();
    }
  });

  /* ================== DATE CALCULATOR ================== */
  const DAY = 86400000;
  const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const longDate = (t) => new Date(t).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  list.push({
    id: 'dates', title: 'Dates',
    render(root, api) {
      const U = ui(api);
      let mode = 'between';
      const draw = () => {
        root.innerHTML = '';
        root.append(U.chips([['between', 'Days between'], ['add', 'Add / subtract days']], mode, (v) => { mode = v; draw(); }));
        const card = U.h('div', { class: 'card' }), res = U.h('div', { class: 'card' });
        let sendText = '';
        const dateInput = (val, on) => { const i = U.h('input', { type: 'date' }); i.value = val; i.oninput = () => on(i.value); return i; };
        if (mode === 'between') {
          let a = todayISO(), b = todayISO();
          const update = () => {
            res.innerHTML = '';
            if (!a || !b) return;
            let ta = toUTC(a), tb = toUTC(b), sign = 1;
            if (tb < ta) { [ta, tb] = [tb, ta]; sign = -1; }
            const days = Math.round((tb - ta) / DAY);
            const da = new Date(ta), db = new Date(tb);
            let y = db.getUTCFullYear() - da.getUTCFullYear(), m = db.getUTCMonth() - da.getUTCMonth(), d = db.getUTCDate() - da.getUTCDate();
            if (d < 0) { m--; d += new Date(Date.UTC(db.getUTCFullYear(), db.getUTCMonth(), 0)).getUTCDate(); }
            if (m < 0) { y--; m += 12; }
            res.append(U.out(sign < 0 ? 'Days (end is earlier)' : 'Days', String(days), true),
              U.out('Weeks', plural(Math.floor(days / 7), 'week') + (days % 7 ? ' ' + plural(days % 7, 'day') : '')),
              U.out('Calendar', [y && plural(y, 'year'), m && plural(m, 'month'), d && plural(d, 'day')].filter(Boolean).join(', ') || '0 days'));
            sendText = String(days);
          };
          const todayA = U.h('button', { class: 'btn ghost', text: 'Today', onclick: () => { a = todayISO(); ia.value = a; update(); } });
          const todayB = U.h('button', { class: 'btn ghost', text: 'Today', onclick: () => { b = todayISO(); ib.value = b; update(); } });
          const ia = dateInput(a, (v) => { a = v; update(); }), ib = dateInput(b, (v) => { b = v; update(); });
          card.append(U.field('From', ia), todayA, U.h('div', { style: 'height:10px' }), U.field('To', ib), todayB);
          update();
        } else {
          let start = todayISO(), n = '30', dir = 1;
          const update = () => {
            res.innerHTML = '';
            const k = parse(n);
            if (!start || !isFinite(k)) return;
            const t = toUTC(start) + dir * Math.round(k) * DAY;
            res.append(U.out(dir > 0 ? 'Date after' : 'Date before', longDate(t), true), U.out('As numbers', iso(t)));
            sendText = '';
          };
          const is = dateInput(start, (v) => { start = v; update(); });
          const seg = U.h('div', { class: 'seg' });
          [['Add', 1], ['Subtract', -1]].forEach(([l, v]) => seg.append(U.h('button', { class: v === dir ? 'on' : '', text: l, onclick: () => { dir = v; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.textContent === l)); update(); } })));
          card.append(U.field('Start date', is), U.h('button', { class: 'btn ghost', text: 'Today', onclick: () => { start = todayISO(); is.value = start; update(); } }), U.h('div', { style: 'height:12px' }), seg, U.h('div', { style: 'height:12px' }), U.field('Number of days', U.input(n, (v) => { n = v; update(); }, 'numeric')));
          update();
        }
        root.append(card, res, mode === 'between' ? U.sendBtn(() => sendText) : U.h('span'));
      };
      draw();
    }
  });

  /* ================== PROGRAMMER (HEX / BIN / DEC) ================== */
  list.push({
    id: 'programmer', title: 'Hex / Bin',
    render(root, api) {
      const U = ui(api);
      const st = { base: 10, cur: 0n, typing: false, acc: null, op: null, word: 0, err: '' };
      const wrap = (x) => (st.word ? BigInt.asIntN(st.word, x) : x);
      const apply = (a, op, b) => {
        switch (op) {
          case '+': return a + b; case '−': return a - b; case '×': return a * b;
          case '÷': if (b === 0n) { st.err = 'Cannot divide by zero'; return a; } return a / b;
          case 'AND': return a & b; case 'OR': return a | b; case 'XOR': return a ^ b;
          case '<<': return a << b; case '>>': return a >> b;
        }
        return b;
      };
      const strBase = (v, b) => {
        let neg = v < 0n;
        if (neg && st.word && b !== 10) { v = BigInt.asUintN(st.word, v); neg = false; }
        let s = (neg ? -v : v).toString(b).toUpperCase();
        if (b === 2 || b === 16) { const g = 4; s = s.padStart(Math.ceil(s.length / g) * g, '0').replace(new RegExp('(.{' + g + '})(?=.)', 'g'), '$1 '); }
        return (neg ? '-' : '') + s;
      };
      const disp = U.h('div', { class: 'pdisp' });
      const pend = U.h('div', { class: 'hint', style: 'text-align:right;min-height:18px' });
      const rows = U.h('div', { class: 'card bases' });
      const grid = U.h('div', { class: 'pgrid' });
      const digitBtns = [];
      function refresh() {
        disp.textContent = strBase(st.cur, st.base).replace(/ /g, ' ');
        pend.textContent = st.err || (st.op ? strBase(st.acc, st.base) + ' ' + st.op : '');
        st.err = '';
        rows.innerHTML = '';
        [['HEX', 16], ['DEC', 10], ['OCT', 8], ['BIN', 2]].forEach(([l, b]) => {
          const r = U.out(l, strBase(st.cur, b));
          r.style.cursor = 'pointer';
          if (b === st.base) r.querySelector('.l').style.color = 'var(--accent)';
          r.onclick = () => { st.base = b; st.typing = false; refresh(); };
          rows.append(r);
        });
        digitBtns.forEach(([btn, d]) => { btn.disabled = d >= st.base; });
      }
      const digit = (d) => {
        if (d >= st.base) return;
        if (st.typing && st.cur >= 0n) st.cur = wrap(st.cur * BigInt(st.base) + BigInt(d)); else st.cur = BigInt(d);
        st.typing = true; refresh();
      };
      const op = (o) => {
        if (st.op && st.typing) st.acc = wrap(apply(st.acc, st.op, st.cur)); else if (!st.op || st.acc === null) st.acc = st.cur;
        st.op = o; st.typing = false; st.cur = st.acc; refresh();
      };
      const act = {
        '=': () => { if (st.op) { st.cur = wrap(apply(st.acc, st.op, st.cur)); st.acc = null; st.op = null; st.typing = false; refresh(); } },
        C: () => { st.cur = 0n; st.acc = null; st.op = null; st.typing = false; refresh(); },
        '⌫': () => { st.cur = st.cur / BigInt(st.base); refresh(); },
        NOT: () => { st.cur = wrap(~st.cur); st.typing = false; refresh(); }
      };
      const layout = [
        ['A', 'B', 'C', '⌫', 'C', 'NOT'], ['D', 'E', 'F', '÷', 'AND', '<<'], ['7', '8', '9', '×', 'OR', '>>'],
        ['4', '5', '6', '−', 'XOR', '±'], ['1', '2', '3', '+', '0', '=']
      ];
      layout.flat().forEach((k) => {
        const isDigit = /^[0-9A-F]$/.test(k) && !(k === 'C' && false);
        const btn = U.h('button', { text: k });
        // the "C" in column 1 is hex digit C, the one in column 5 of row 1 is Clear
        btn.className = isDigit ? 'd' : '';
        grid.append(btn);
      });
      // wire up buttons by position (row 0 col 4 = Clear)
      [...grid.children].forEach((btn, idx) => {
        const k = layout.flat()[idx];
        if (idx === 4) { btn.className = ''; btn.textContent = 'C'; btn.onclick = act.C; return; }
        if (/^[0-9A-F]$/.test(k)) { const d = parseInt(k, 16); digitBtns.push([btn, d]); btn.onclick = () => digit(d); }
        else if (k === '=') { btn.onclick = act['=']; btn.style.background = 'var(--keyEq)'; btn.style.color = 'var(--keyEqText)'; }
        else if (k === '⌫') btn.onclick = act['⌫'];
        else if (k === 'NOT') btn.onclick = act.NOT;
        else if (k === '±') btn.onclick = () => { st.cur = wrap(-st.cur); st.typing = false; refresh(); };
        else btn.onclick = () => op(k);
      });
      const wordSeg = U.chips([[0, 'No limit'], [8, '8-bit'], [16, '16-bit'], [32, '32-bit'], [64, '64-bit']], 0, (v) => { st.word = Number(v); st.cur = wrap(st.cur); refresh(); });
      root.append(U.h('div', { class: 'hint', text: 'Type in the base you pick (tap a row). All four update live.' }), pend, disp, rows, grid, U.h('div', { style: 'height:12px' }), U.h('div', { class: 'lbl', text: 'Word size' }), wordSeg,
        U.h('button', { class: 'btn ghost', text: 'Use decimal value in calculator', onclick: () => api.sendToCalc(st.cur.toString()) }));
      refresh();
    }
  });

  /* ================== MINE: your own repeated math ================== */
  const RESERVED = new Set(['e', 'pi', 'ans', 'mod'].concat(E.FUNC_NAMES));
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'f' + Date.now();
  list.push({
    id: 'mine', title: 'Mine',
    render(root, api) {
      const U = ui(api);
      const h = U.h;
      let selected = api.store.get('mineSel', null);
      const custom = () => api.store.get('formulas', []);
      const all = () => (api.C.formulas || []).map((f) => Object.assign({ builtin: true }, f)).concat(custom());

      function fmtOut(o, r) {
        if (!r.ok) return '—';
        const x = E.num(r.value);
        if (!isFinite(x)) return '—';
        if (o.format === 'money') return money(x);
        if (o.format === 'percent') return pct(x);
        return api.group(E.describe(r.value, 'dec').main);
      }

      function show() {
        root.innerHTML = '';
        const fs = all();
        if (!fs.length) { editor(null); return; }
        const f = fs.find((x) => x.id === selected) || fs[0];
        selected = f.id; api.store.set('mineSel', selected);
        root.append(U.chips(fs.map((x) => [x.id, x.name]), f.id, (v) => { selected = v; show(); }));
        const vals = Object.assign({}, ...f.fields.map((fl) => ({ [fl.key]: fl.default || '' })), api.store.get('mine.' + f.id, {}));
        const card = h('div', { class: 'card' }), res = h('div', { class: 'card' });
        let lastFirst = '';
        const update = () => {
          api.store.set('mine.' + f.id, vals);
          res.innerHTML = '';
          lastFirst = '';
          f.outputs.forEach((o, i) => {
            const r = E.tryEvaluate(o.expr, { vars: Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, String(v).replace(/[$,\s]/g, '')])) });
            const text = fmtOut(o, r);
            res.append(U.out(o.label, text, o.big || i === 0 && f.outputs.length === 1));
            if (!lastFirst && o.big && r.ok) lastFirst = text.replace(/[$,%\s]/g, '');
          });
        };
        f.fields.forEach((fl) => card.append(U.field(fl.label, U.input(vals[fl.key], (v) => { vals[fl.key] = v; update(); }))));
        root.append(card, res);
        const actions = h('div', { class: 'row' });
        actions.append(h('button', { class: 'btn ghost', text: 'Clear inputs', onclick: () => { api.store.del('mine.' + f.id); show(); } }));
        if (lastFirst || true) actions.append(U.sendBtn(() => lastFirst));
        root.append(actions, h('div', { style: 'height:14px' }));
        const row2 = h('div', { class: 'row' });
        row2.append(h('button', { class: 'btn ghost', text: '+ New formula', onclick: () => editor(null) }));
        if (!f.builtin) row2.append(h('button', { class: 'btn ghost', text: 'Edit', onclick: () => editor(f) }));
        root.append(row2);
        if (f.builtin) root.append(h('div', { class: 'hint', style: 'margin-top:10px', text: 'This one comes from config.js. Change it there, or make your own with "+ New formula".' }));
        update();
      }

      function editor(f) {
        root.innerHTML = '';
        const card = h('div', { class: 'card' });
        const name = h('input', { placeholder: 'e.g. Weekly earnings' }); name.value = f ? f.name : '';
        const fields = h('textarea', { placeholder: 'earned | Total earned ($) | 0\nmiles | Miles driven | 0' });
        fields.value = f ? f.fields.map((x) => [x.key, x.label, x.default || ''].join(' | ')).join('\n') : '';
        const outs = h('textarea', { placeholder: 'Profit | earned - miles * 0.2 | money\nPer mile | earned / miles | money' });
        outs.value = f ? f.outputs.map((o) => [o.label, o.expr, o.format || 'number'].join(' | ')).join('\n') : '';
        const msg = h('div', { class: 'hint', style: 'color:var(--danger);min-height:18px' });
        card.append(
          U.field('Name', name),
          U.field('Inputs - one per line:  key | Label | starting value', fields),
          U.field('Results - one per line:  Label | math using the keys | money, number or percent', outs),
          h('div', { class: 'hint', text: 'Keys are short names without spaces (earned, miles, gas). In the math you can use + - * / ^ ( ) and functions like sqrt(). Mark the main result by putting a * at the end of its line.' }),
          msg
        );
        const save = () => {
          const nm = name.value.trim();
          if (!nm) { msg.textContent = 'Give it a name.'; return; }
          const fl = []; const seen = new Set();
          for (const line of fields.value.split('\n').map((l) => l.trim()).filter(Boolean)) {
            const [key, label, def] = line.split('|').map((s) => s.trim());
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key || '')) { msg.textContent = 'Bad key: "' + key + '". Use letters, numbers, underscore.'; return; }
            if (RESERVED.has(key.toLowerCase())) { msg.textContent = '"' + key + '" is reserved by the calculator. Pick another key.'; return; }
            if (seen.has(key)) { msg.textContent = 'Duplicate key: ' + key; return; }
            seen.add(key); fl.push({ key, label: label || key, default: def || '' });
          }
          if (!fl.length) { msg.textContent = 'Add at least one input.'; return; }
          const ol = [];
          for (let line of outs.value.split('\n').map((l) => l.trim()).filter(Boolean)) {
            let big = false;
            if (line.endsWith('*')) { big = true; line = line.slice(0, -1).trim(); }
            const [label, expr, format] = line.split('|').map((s) => s.trim());
            if (!label || !expr) { msg.textContent = 'Each result needs  Label | math'; return; }
            const probe = E.tryEvaluate(expr, { vars: Object.fromEntries(fl.map((x) => [x.key, '1'])) });
            if (!probe.ok && !/divide|Invalid|Undefined/.test(probe.error)) { msg.textContent = 'Problem in "' + label + '": ' + probe.error; return; }
            ol.push({ label, expr, format: ['money', 'percent', 'number'].includes(format) ? format : 'number', big });
          }
          if (!ol.length) { msg.textContent = 'Add at least one result.'; return; }
          if (!ol.some((o) => o.big)) ol[0].big = true;
          const list2 = custom().filter((x) => !f || x.id !== f.id);
          const item = { id: f ? f.id : slug(nm) + '-' + Date.now().toString(36), name: nm, fields: fl, outputs: ol };
          list2.push(item);
          api.store.set('formulas', list2);
          selected = item.id; show();
        };
        const row = h('div', { class: 'row' });
        row.append(h('button', { class: 'btn', text: 'Save', onclick: save }), h('button', { class: 'btn ghost', text: 'Cancel', onclick: show }));
        if (f && !f.builtin) row.append(h('button', { class: 'btn danger', text: 'Delete', onclick: () => { if (confirm('Delete "' + f.name + '"?')) { api.store.set('formulas', custom().filter((x) => x.id !== f.id)); api.store.del('mine.' + f.id); selected = null; show(); } } }));
        root.append(card, row);
      }
      show();
    }
  });

  window.CalcTools = { list };
})();

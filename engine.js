/* ------------------------------------------------------------------
   engine.js  -  exact-math expression engine (no dependencies)
   - Whole numbers / decimals / fractions are kept EXACT (BigInt rationals)
   - Anything irrational (sin, ln, π, non-perfect roots...) falls back to floats
   - Correct order of operations, parentheses, implicit multiplication,
     percent rules (200 + 10% = 220), factorial, mod, functions, Ans, variables
   Works in the browser (window.CalcEngine) and in Node (require).
------------------------------------------------------------------- */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CalcEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class CalcError extends Error {}
  const err = (m) => new CalcError(m);

  /* ---------- rationals ---------- */
  const babs = (x) => (x < 0n ? -x : x);
  function gcd(a, b) {
    a = babs(a); b = babs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a;
  }
  class Frac {
    constructor(n, d) {
      if (d === undefined) d = 1n;
      if (d === 0n) throw err('Cannot divide by zero');
      if (d < 0n) { n = -n; d = -d; }
      const g = gcd(n, d);
      if (g > 1n) { n /= g; d /= g; }
      this.n = n; this.d = d;
    }
  }
  const isF = (v) => v instanceof Frac;
  const bitLen = (x) => babs(x).toString(2).length;

  function fracToNumber(f) {
    const nn = Number(f.n), dd = Number(f.d);
    if (isFinite(nn) && isFinite(dd)) return nn / dd;
    const shift = BigInt(Math.max(bitLen(f.n), bitLen(f.d)) - 900);
    const n = f.n >> shift, d = f.d >> shift;
    if (d === 0n) return n > 0n ? Infinity : -Infinity;
    return Number(n) / Number(d);
  }
  const num = (v) => (isF(v) ? fracToNumber(v) : v);

  function chk(x) {
    if (typeof x === 'number') {
      if (Number.isNaN(x)) throw err('Invalid input');
      if (!isFinite(x)) throw err('Overflow');
    }
    return x;
  }
  const clean = (x) => (Math.abs(x) < 1e-14 ? 0 : Number(x.toPrecision(14)));

  /* ---------- arithmetic ---------- */
  const add = (a, b) => (isF(a) && isF(b) ? new Frac(a.n * b.d + b.n * a.d, a.d * b.d) : chk(num(a) + num(b)));
  const sub = (a, b) => (isF(a) && isF(b) ? new Frac(a.n * b.d - b.n * a.d, a.d * b.d) : chk(num(a) - num(b)));
  const mul = (a, b) => (isF(a) && isF(b) ? new Frac(a.n * b.n, a.d * b.d) : chk(num(a) * num(b)));
  function div(a, b) {
    if (isF(b) ? b.n === 0n : b === 0) throw err('Cannot divide by zero');
    return isF(a) && isF(b) ? new Frac(a.n * b.d, a.d * b.n) : chk(num(a) / num(b));
  }
  const neg = (a) => (isF(a) ? new Frac(-a.n, a.d) : -a);

  function floorFrac(f) {
    let q = f.n / f.d;
    if (f.n < 0n && q * f.d !== f.n) q -= 1n;
    return q;
  }
  function mod(a, b) {
    if (isF(b) ? b.n === 0n : b === 0) throw err('Cannot divide by zero');
    if (isF(a) && isF(b)) return sub(a, mul(b, new Frac(floorFrac(div(a, b)))));
    const x = num(a), y = num(b);
    return chk(x - y * Math.floor(x / y));
  }

  function iroot(n, q) {
    if (n < 2n) return n;
    const guess = Math.pow(Number(n), 1 / q);
    if (!isFinite(guess) || guess > 2 ** 53) return null;
    const r0 = Math.round(guess);
    for (const r of [r0 - 1, r0, r0 + 1]) {
      if (r >= 0 && BigInt(r) ** BigInt(q) === n) return BigInt(r);
    }
    return null;
  }
  function exactRoot(f, q) {
    let n = f.n, negative = false;
    if (n < 0n) { if (q % 2 === 0) return null; negative = true; n = -n; }
    const rn = iroot(n, q), rd = iroot(f.d, q);
    if (rn === null || rd === null) return null;
    return new Frac(negative ? -rn : rn, rd);
  }

  function pow(a, b) {
    if (isF(a) && isF(b)) {
      if (b.d === 1n) {
        const e = b.n, ae = babs(e);
        if (a.n === 0n) {
          if (e < 0n) throw err('Cannot divide by zero');
          return new Frac(1n - (e === 0n ? 0n : 1n), 1n);
        }
        if (ae <= 5000n && (bitLen(a.n) + bitLen(a.d)) * Number(ae) < 40000) {
          return e >= 0n ? new Frac(a.n ** ae, a.d ** ae) : new Frac(a.d ** ae, a.n ** ae);
        }
      } else if (b.d <= 64n) {
        const r = exactRoot(a, Number(b.d));
        if (r) return pow(r, new Frac(b.n));
      }
    }
    return chk(Math.pow(num(a), num(b)));
  }

  function sqrt(v) {
    if (isF(v)) {
      if (v.n < 0n) throw err('Invalid input');
      const r = exactRoot(v, 2);
      if (r) return r;
    } else if (v < 0) throw err('Invalid input');
    return chk(Math.sqrt(num(v)));
  }
  function cbrt(v) {
    if (isF(v)) { const r = exactRoot(v, 3); if (r) return r; }
    return chk(Math.cbrt(num(v)));
  }

  function asInt(v, max) {
    if (!isF(v) || v.d !== 1n || v.n < 0n || v.n > BigInt(max)) throw err('Invalid input');
    return Number(v.n);
  }
  function factorial(v) {
    const n = asInt(v, 1000);
    let r = 1n;
    for (let i = 2n; i <= BigInt(n); i++) r *= i;
    return new Frac(r);
  }
  function ncr(n, r) {
    const N = asInt(n, 1000), R = asInt(r, 1000);
    if (R > N) throw err('Invalid input');
    let res = 1n;
    for (let i = 1; i <= Math.min(R, N - R); i++) res = (res * BigInt(N - i + 1)) / BigInt(i);
    return new Frac(res);
  }
  function npr(n, r) {
    const N = asInt(n, 1000), R = asInt(r, 1000);
    if (R > N) throw err('Invalid input');
    let res = 1n;
    for (let i = 0; i < R; i++) res *= BigInt(N - i);
    return new Frac(res);
  }

  /* ---------- functions ---------- */
  function makeFunctions(angle) {
    const deg = angle !== 'rad';
    const toRad = (x) => (deg ? (x * Math.PI) / 180 : x);
    const fromRad = (x) => (deg ? (x * 180) / Math.PI : x);
    const f1 = (fn) => (a) => chk(clean(fn(num(a[0]))));
    return {
      sin: f1((x) => Math.sin(toRad(x))),
      cos: f1((x) => Math.cos(toRad(x))),
      tan: (a) => {
        const x = num(a[0]);
        if (deg && Math.abs((((x % 180) + 180) % 180) - 90) < 1e-9) throw err('Undefined');
        if (!deg && Math.abs(Math.cos(x)) < 1e-15) throw err('Undefined');
        return chk(clean(Math.tan(toRad(x))));
      },
      asin: f1((x) => fromRad(Math.asin(x))),
      acos: f1((x) => fromRad(Math.acos(x))),
      atan: f1((x) => fromRad(Math.atan(x))),
      sinh: f1(Math.sinh), cosh: f1(Math.cosh), tanh: f1(Math.tanh),
      ln: (a) => { if (num(a[0]) <= 0) throw err('Invalid input'); return chk(clean(Math.log(num(a[0])))); },
      log: (a) => { if (num(a[0]) <= 0) throw err('Invalid input'); return chk(clean(Math.log10(num(a[0])))); },
      log2: (a) => { if (num(a[0]) <= 0) throw err('Invalid input'); return chk(clean(Math.log2(num(a[0])))); },
      exp: f1(Math.exp),
      sqrt: (a) => sqrt(a[0]),
      cbrt: (a) => cbrt(a[0]),
      abs: (a) => (isF(a[0]) ? new Frac(babs(a[0].n), a[0].d) : Math.abs(a[0])),
      floor: (a) => (isF(a[0]) ? new Frac(floorFrac(a[0])) : Math.floor(a[0])),
      ceil: (a) => (isF(a[0]) ? new Frac(-floorFrac(neg(a[0]))) : Math.ceil(a[0])),
      round: (a) => (isF(a[0]) ? new Frac(floorFrac(add(a[0], new Frac(1n, 2n)))) : Math.round(a[0])),
      fact: (a) => factorial(a[0]),
      ncr: (a) => ncr(a[0], a[1]),
      npr: (a) => npr(a[0], a[1]),
      min: (a) => a.reduce((m, v) => (num(v) < num(m) ? v : m)),
      max: (a) => a.reduce((m, v) => (num(v) > num(m) ? v : m)),
    };
  }
  const ALIASES = { '√': 'sqrt', '∛': 'cbrt', arcsin: 'asin', arccos: 'acos', arctan: 'atan', 'sin⁻¹': 'asin', 'cos⁻¹': 'acos', 'tan⁻¹': 'atan', lg: 'log' };
  const FUNC_NAMES = Object.keys(makeFunctions('deg')).concat(Object.keys(ALIASES));

  /* ---------- tokenizer ---------- */
  function parseNumber(mant, exp) {
    let [ip, fp = ''] = mant.split('.');
    let n = BigInt((ip || '0') + fp);
    let d = 10n ** BigInt(fp.length);
    if (exp) {
      const e = parseInt(exp, 10);
      if (Math.abs(e) > 1000) throw err('Overflow');
      if (e >= 0) n *= 10n ** BigInt(e); else d *= 10n ** BigInt(-e);
    }
    return new Frac(n, d);
  }
  function tokenize(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        const m = /^(\d*\.?\d*)(?:E([+\-−]?\d+))?/.exec(s.slice(i));
        if (!m[1] || m[1] === '.') throw err('Syntax error');
        out.push({ t: 'num', v: parseNumber(m[1], m[2] ? m[2].replace('−', '-') : null) });
        i += m[0].length;
        continue;
      }
      if ('+-−–'.includes(c)) { out.push({ t: 'op', v: c === '+' ? '+' : '-' }); i++; continue; }
      if ('*×·'.includes(c)) { out.push({ t: 'op', v: '*' }); i++; continue; }
      if ('/÷'.includes(c)) { out.push({ t: 'op', v: '/' }); i++; continue; }
      if (c === '^') { out.push({ t: 'op', v: '^' }); i++; continue; }
      if ('()!%,'.includes(c)) { out.push({ t: c }); i++; continue; }
      if (c === '√' || c === '∛') { out.push({ t: 'id', v: c }); i++; continue; }
      if (c === 'π') { out.push({ t: 'id', v: 'pi' }); i++; continue; }
      const m = /^[A-Za-z_][A-Za-z0-9_]*(?:[⁻¹]+)?/.exec(s.slice(i));
      if (m) {
        let word = m[0];
        const low = word.toLowerCase();
        if (low === 'mod') out.push({ t: 'op', v: 'mod' });
        else out.push({ t: 'id', v: word });
        i += word.length;
        continue;
      }
      throw err('Syntax error');
    }
    return out;
  }

  /* ---------- parser / evaluator ---------- */
  function evaluate(str, opts) {
    opts = opts || {};
    const toks = tokenize(String(str));
    if (!toks.length) throw err('Empty');
    const funcs = makeFunctions(opts.angle);
    const vars = opts.vars || {};
    let p = 0;
    const peek = () => toks[p];
    const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
    const isT = (t) => peek() && peek().t === t;

    function toVal(x) {
      if (isF(x) || typeof x === 'number') return x;
      if (typeof x === 'string' && x.trim() !== '') return evaluate(x, { angle: opts.angle });
      return new Frac(0n);
    }

    function startsPrimary() {
      const t = peek();
      if (!t) return false;
      return t.t === 'num' || t.t === '(' || t.t === 'id';
    }

    function parseExpr() {
      let lhs = parseTerm();
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        const op = toks[p++].v;
        const rhs = parseTerm();
        // percent rule: a + b%  ->  a + a*b/100
        const r = rhs.pct ? mul(lhs.v, rhs.v) : rhs.v;
        lhs = { v: op === '+' ? add(lhs.v, r) : sub(lhs.v, r), pct: false };
      }
      return lhs;
    }
    function parseTerm() {
      let lhs = parseUnary();
      for (;;) {
        const t = peek();
        if (!t) break;
        if (t.t === 'op' && (t.v === '*' || t.v === '/' || t.v === 'mod')) {
          p++;
          const rhs = parseUnary();
          lhs = { v: t.v === '*' ? mul(lhs.v, rhs.v) : t.v === '/' ? div(lhs.v, rhs.v) : mod(lhs.v, rhs.v), pct: false };
        } else if (startsPrimary()) {
          const rhs = parseUnary(true);
          lhs = { v: mul(lhs.v, rhs.v), pct: false };
        } else break;
      }
      return lhs;
    }
    function parseUnary(noSign) {
      if (!noSign && peek() && peek().t === 'op' && (peek().v === '-' || peek().v === '+')) {
        const s = toks[p++].v;
        const r = parseUnary();
        return { v: s === '-' ? neg(r.v) : r.v, pct: r.pct };
      }
      return parsePower();
    }
    function parsePower() {
      const base = parsePostfix();
      if (isOp('^')) {
        p++;
        const ex = parseUnary();
        return { v: pow(base.v, ex.v), pct: false };
      }
      return base;
    }
    function parsePostfix() {
      let r = parsePrimary();
      for (;;) {
        if (isT('!')) { p++; r = { v: factorial(r.v), pct: false }; }
        else if (isT('%')) { p++; r = { v: div(r.v, new Frac(100n)), pct: true }; }
        else break;
      }
      return r;
    }
    function parseArgs() {
      // after '(' has been consumed
      const args = [];
      if (isT(')')) { p++; return args; }
      for (;;) {
        args.push(parseExpr().v);
        if (isT(',')) { p++; continue; }
        if (isT(')')) { p++; break; }
        if (!peek()) break; // auto-close at end of input
        throw err('Syntax error');
      }
      return args;
    }
    function parsePrimary() {
      const t = toks[p++];
      if (!t) throw err('Syntax error');
      if (t.t === 'num') return { v: t.v, pct: false };
      if (t.t === '(') {
        const r = parseExpr();
        if (isT(')')) p++;
        else if (peek()) throw err('Syntax error');
        return { v: r.v, pct: false };
      }
      if (t.t === 'id') {
        const raw = t.v;
        const low = raw.toLowerCase();
        if (low === 'pi') return { v: Math.PI, pct: false };
        if (raw === 'e') return { v: Math.E, pct: false };
        if (low === 'ans') return { v: toVal(opts.ans), pct: false };
        const fname = ALIASES[raw] || ALIASES[low] || low;
        if (funcs[fname]) {
          let args;
          if (isT('(')) { p++; args = parseArgs(); }
          else args = [parsePower().v];
          if (!args.length) throw err('Syntax error');
          return { v: funcs[fname](args), pct: false };
        }
        if (Object.prototype.hasOwnProperty.call(vars, raw)) return { v: toVal(vars[raw]), pct: false };
        if (Object.prototype.hasOwnProperty.call(vars, low)) return { v: toVal(vars[low]), pct: false };
        throw err('Unknown: ' + raw);
      }
      throw err('Syntax error');
    }

    const r = parseExpr();
    if (p < toks.length) throw err('Syntax error');
    return chk(r.v);
  }

  function tryEvaluate(str, opts) {
    try { return { ok: true, value: evaluate(str, opts) }; }
    catch (e) {
      if (e instanceof CalcError) return { ok: false, error: e.message };
      if (e instanceof RangeError) return { ok: false, error: 'Too large' };
      throw e;
    }
  }

  /* ---------- formatting ---------- */
  function fmtFloat(x) {
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e15 || a < 1e-6) {
      let [m, e] = x.toExponential(11).split('e');
      if (m.includes('.')) m = m.replace(/0+$/, '').replace(/\.$/, '');
      return m + 'E' + (e[0] === '+' ? e.slice(1) : e);
    }
    return Number(x.toPrecision(12)).toString();
  }
  function fmtBigInt(n) {
    const s = babs(n).toString();
    const sign = n < 0n ? '-' : '';
    if (s.length <= 30) return sign + s;
    let digits = BigInt(s.slice(0, 13));
    let exp = s.length - 1;
    digits = (digits + 5n) / 10n;
    if (digits.toString().length > 12) { digits /= 10n; exp += 1; }
    let m = digits.toString();
    m = (m[0] + '.' + m.slice(1)).replace(/0+$/, '').replace(/\.$/, '');
    return sign + m + 'E' + exp;
  }
  function fracDecimal(f, sig) {
    sig = sig || 12;
    const negative = f.n < 0n;
    const n = babs(f.n), d = f.d;
    const fl = fracToNumber(f);
    const a = Math.abs(fl);
    if (a >= 1e15 || a < 1e-6) return fmtFloat(fl);
    const ip = n / d;
    let z = 0;
    if (ip === 0n) while (n * 10n ** BigInt(z + 1) < d) z++;
    const k = ip === 0n ? sig + z : Math.max(0, sig - ip.toString().length);
    const scaled = (n * 10n ** BigInt(k) * 2n + d) / (2n * d);
    let s = scaled.toString().padStart(k + 1, '0');
    let out = k > 0 ? s.slice(0, s.length - k) + '.' + s.slice(s.length - k) : s;
    if (out.includes('.')) out = out.replace(/0+$/, '').replace(/\.$/, '');
    return (negative && out !== '0' ? '-' : '') + out;
  }
  function isTerminating(f) {
    let d = f.d;
    while (d % 2n === 0n) d /= 2n;
    while (d % 5n === 0n) d /= 5n;
    return d === 1n;
  }
  const fracString = (f) => f.n.toString() + '/' + f.d.toString();

  /* describe(value, mode) -> { main, alt, isFraction }
     mode: 'auto' | 'frac' | 'dec'  (what the user prefers to see) */
  function describe(v, mode) {
    mode = mode || 'auto';
    if (!isF(v)) return { main: fmtFloat(v), alt: null, exact: false, mainIsFraction: false };
    if (v.d === 1n) return { main: fmtBigInt(v.n), alt: null, exact: true, mainIsFraction: false };
    const dec = fracDecimal(v);
    const fr = fracString(v);
    const frOk = fr.length <= 22;
    let showFrac;
    if (mode === 'frac') showFrac = frOk;
    else if (mode === 'dec') showFrac = false;
    else showFrac = frOk && !isTerminating(v);
    const approx = !isTerminating(v);
    return showFrac
      ? { main: fr, alt: (approx ? '≈ ' : '') + dec, exact: true, mainIsFraction: true }
      : { main: dec, alt: frOk ? fr : null, exact: true, mainIsFraction: false };
  }

  /* text that can be safely typed back into the expression */
  function toInsertText(v) {
    if (isF(v)) {
      if (v.d === 1n) return v.n < 0n ? '(' + v.n + ')' : v.n.toString();
      return '(' + v.n.toString().replace('-', '−') + '÷' + v.d + ')';
    }
    let s = String(Number(v.toPrecision(15))).replace('e+', 'E').replace('e', 'E');
    return v < 0 ? '(' + s.replace('-', '−') + ')' : s;
  }

  /* storage helpers */
  function serialize(v) {
    if (isF(v)) return { t: 'f', n: v.n.toString(), d: v.d.toString() };
    return { t: 'n', v: v };
  }
  function deserialize(o) {
    if (!o) return new Frac(0n);
    if (o.t === 'f') return new Frac(BigInt(o.n), BigInt(o.d));
    return Number(o.v);
  }

  return {
    Frac, CalcError, evaluate, tryEvaluate, describe, toInsertText, serialize, deserialize,
    fmtFloat, fracDecimal, num, add, sub, mul, div, isF, FUNC_NAMES,
    zero: () => new Frac(0n),
    fromNumber: (x) => (Number.isInteger(x) ? new Frac(BigInt(x)) : x),
  };
});

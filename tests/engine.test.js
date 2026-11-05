// Run with:  node tests/engine.test.js
const E = require('../engine.js');
let pass = 0, fail = 0;

function show(expr, opts, mode) {
  const r = E.tryEvaluate(expr, opts);
  if (!r.ok) return 'ERR:' + r.error;
  return E.describe(r.value, mode).main;
}
function eq(expr, want, opts, mode) {
  const got = show(expr, opts, mode);
  if (got === want) pass++;
  else { fail++; console.log(`FAIL  ${expr}  =>  ${got}   (wanted ${want})`); }
}

// basics + order of operations
eq('2+3×4', '14');
eq('(2+3)×4', '20');
eq('10−4−3', '3');
eq('2^3^2', '512');
eq('−2^2', '-4');
eq('2^−1', '0.5');
eq('8÷2(2+2)', '16');
eq('2(3)', '6');
eq('(2)(3)', '6');
eq('5!', '120');
eq('10 mod 3', '1');
eq('−7 mod 3', '2');
// exact decimals
eq('0.1+0.2', '0.3');
eq('1÷3', '1/3');
eq('1÷8', '0.125');
eq('2÷3+1÷3', '1');
eq('1÷3', '0.333333333333', {}, 'dec');
eq('7÷3', '7/3');
eq('0.5×4', '2');
eq('1÷0', 'ERR:Cannot divide by zero');
eq('0÷0', 'ERR:Cannot divide by zero');
// percent
eq('200+10%', '220');
eq('200−10%', '180');
eq('200×10%', '20');
eq('50%', '0.5');
eq('85×20%', '17');
eq('85−20%', '68');
eq('100+10%+10%', '121');
// auto-close
eq('(2+3', '5');
eq('2×(3+(4', '14');
eq(')', 'ERR:Syntax error');
eq('2+', 'ERR:Syntax error');
// roots and powers stay exact when possible
eq('√16', '4');
eq('√(1÷4)', '0.5');
eq('√(1÷4)', '1/2', {}, 'frac');
eq('√2', '1.41421356237');
eq('∛27', '3');
eq('8^(1÷3)', '2');
eq('2^10', '1024');
eq('2^0.5', '1.41421356237');
eq('10^−2', '0.01');
// scientific
eq('sin(30)', '0.5');
eq('cos(60)', '0.5');
eq('sin(90)', '1');
eq('cos(90)', '0');
eq('tan(45)', '1');
eq('tan(90)', 'ERR:Undefined');
eq('asin(0.5)', '30');
eq('sin(π)', '0', { angle: 'rad' });
eq('sin(π÷2)', '1', { angle: 'rad' });
eq('ln(e)', '1');
eq('log(1000)', '3');
eq('log(0)', 'ERR:Invalid input');
eq('2π', '6.28318530718');
eq('exp(0)', '1');
eq('abs(−5)', '5');
eq('ncr(5,2)', '10');
eq('npr(5,2)', '20');
eq('max(1,5,3)', '5');
eq('100!', '9.33262154439E157');
eq('25!', '15511210043330985984000000');
eq('1E3+1', '1001');
eq('1.5E−3', '0.0015');
eq('floor(−1.5)', '-2');
eq('round(2.5)', '3');
// Ans and vars
eq('Ans×2', '14', { ans: new E.Frac(7n) });
eq('Ans+1', '1');
eq('miles÷mpg', '4', { vars: { miles: '100', mpg: '25' } });
eq('foo+1', 'ERR:Unknown: foo');
// huge things shouldn't hang
eq('9^9^9', 'ERR:Overflow');
// formatting round-trips
const v = E.evaluate('1÷3');
eq(E.toInsertText(v), '1/3');
eq(E.toInsertText(E.evaluate('−5')), '-5');
const ser = E.deserialize(JSON.parse(JSON.stringify(E.serialize(v))));
eq(E.toInsertText(ser), '1/3');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

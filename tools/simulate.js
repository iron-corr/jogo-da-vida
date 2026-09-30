// Roda macro + mercado por muitos anos (sem UI) para checar o balanceamento.
// uso: node tools/simulate.js [--years 200] [--seeds 20]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? +argv[i + 1] : def;
};
const YEARS = arg('years', 200), SEEDS = arg('seeds', 20);

const JS = path.join(__dirname, '..', 'js');
const FILES = ['i18n.js', 'rng.js', 'format.js', 'calendar.js', 'data/assets.js', 'events.js', 'tax.js', 'portfolio.js', 'realty.js', 'agro.js', 'angel.js', 'automation.js', 'business.js', 'fund.js', 'social.js', 'politics.js', 'legacy.js', 'life.js', 'choices.js', 'macro.js', 'market.js', 'state.js'];
const ctx = vm.createContext({ console });
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx, { filename: f });
const G = ctx.G;

const ids = Object.keys(G.ASSETS);
const acc = Object.fromEntries(ids.map(id => [id, { cagr: 0, total: 0, vol: 0, mdd: 0, worst: 0 }]));
const regimeDays = {}, spells = {};
let inflSum = 0, selicSum = 0;

for (let s = 1; s <= SEEDS; s++) {
  const S = G.newState(s * 7919);
  const st = Object.fromEntries(ids.map(id => [id, { prev: 100, sum: 0, sq: 0, peak: 100, mdd: 0 }]));
  let cur = S.macro.regime, len = 0, selic = 0;
  const days = YEARS * 360;
  for (let d = 0; d < days; d++) {
    S.day++;
    G.macro.step(S);
    G.events.daily(S);
    G.market.step(S);
    const c = G.cal.of(S.day);
    if (c.dom === 1) {
      G.macro.monthly(S, c);
      G.events.monthly(S, c);
    }
    for (const id of ids) {
      const p = S.market.prices[id], x = st[id], r = Math.log(p / x.prev);
      x.sum += r;
      x.sq += r * r;
      x.prev = p;
      x.peak = Math.max(x.peak, p);
      x.mdd = Math.max(x.mdd, 1 - p / x.peak);
    }
    const reg = S.macro.regime;
    regimeDays[reg] = (regimeDays[reg] || 0) + 1;
    if (reg !== cur) {
      (spells[cur] = spells[cur] || []).push(len);
      cur = reg;
      len = 0;
    }
    len++;
    selic += S.macro.selic;
  }
  for (const id of ids) {
    const x = st[id], mean = x.sum / days;
    acc[id].cagr += (Math.exp(x.sum / YEARS) - 1) / SEEDS;
    acc[id].total += (Math.exp(x.sum / YEARS) * (1 + (G.ASSETS[id].dy || 0)) - 1) / SEEDS;
    acc[id].vol += Math.sqrt((x.sq / days - mean * mean) * 360) / SEEDS;
    acc[id].mdd += x.mdd / SEEDS;
    acc[id].worst = Math.max(acc[id].worst, x.mdd);
  }
  inflSum += Math.pow(S.macro.priceIndex, 1 / YEARS) - 1;
  selicSum += selic / days;
}

const pct = v => (v * 100).toFixed(2).padStart(7) + '%';
console.log(`\n${SEEDS} seeds × ${YEARS} anos\n`);
console.log('ativo         CAGR preço  c/ divid.     vol   DD médio  pior DD');
for (const id of ids) console.log(`${id.padEnd(14)} ${pct(acc[id].cagr)} ${pct(acc[id].total)} ${pct(acc[id].vol)} ${pct(acc[id].mdd)} ${pct(acc[id].worst)}`);
console.log(`\ninflação média ${pct(inflSum / SEEDS)} · Selic média ${pct(selicSum / SEEDS)}`);
const total = Object.values(regimeDays).reduce((a, b) => a + b, 0);
console.log('\nregime        % do tempo   duração média (dias)');
for (const r in G.macro.REGIMES) {
  const sp = spells[r] || [];
  const avg = sp.length ? sp.reduce((a, b) => a + b, 0) / sp.length : 0;
  console.log(`${r.padEnd(13)} ${pct((regimeDays[r] || 0) / total)}   ${avg.toFixed(0).padStart(6)}`);
}

// Compara os robôs quant numa carteira 60/40 (Ibovespa / Tesouro Selic), com IR e rebalanceamento mensal.
// Objetivo de balanceamento: nenhum robô deve dominar os outros em retorno E risco.
// uso: node tools/strategies.js [--years 40] [--seeds 20]
const fs = require('fs'), path = require('path'), vm = require('vm');
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? +argv[i + 1] : def;
};
const YEARS = arg('years', 40), SEEDS = arg('seeds', 20);

const ctx = vm.createContext({ console });
for (const f of ['i18n', 'rng', 'format', 'calendar', 'data/assets', 'events', 'tax', 'portfolio', 'realty', 'agro', 'angel', 'automation', 'business', 'fund', 'social', 'politics', 'legacy', 'life', 'choices', 'work', 'macro', 'market', 'state'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx);
const G = ctx.G;
const pct = v => (v * 100).toFixed(2).padStart(7) + '%';

console.log(`\n${SEEDS} seeds × ${YEARS} anos, carteira 60/40, R$ 100 mil iniciais\n`);
console.log('robô           CAGR   DD médio  pior DD');
for (const robot of Object.keys(G.auto.ROBOTS)) {
  let cagr = 0, dd = 0, worst = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const S = G.newState(s * 104729);
    S.research = { edu_fin: 1, rv1: 1, aporte_auto: 1, rebalanceamento: 1, quant: 1, macro1: 1, pmi: 1 };
    Object.assign(S.auto, { rebal: true, robot, targets: { ibov: 60, tesouro_selic: 40 } });
    S.cash = 100000;
    const t = G.auto.targets(S);
    for (const id in t) G.portfolio.buy(S, id, 100000 * t[id]);
    let peak = 0, mdd = 0;
    for (let d = 0; d < YEARS * 360; d++) {
      S.day++;
      G.macro.step(S); G.events.daily(S); G.market.step(S);
      const c = G.cal.of(S.day);
      if (c.dom === 1) {
        G.tax.monthly(S, c);
        G.portfolio.payDividends(S, c);
        G.macro.monthly(S, c); G.events.monthly(S, c);
        G.auto.monthly(S, c);
        S.auto.on = true; S.auto.reserve = 0; // reinveste dividendos e sobras
      }
      const v = S.cash + G.portfolio.invested(S);
      peak = Math.max(peak, v);
      mdd = Math.max(mdd, 1 - v / peak);
    }
    cagr += (Math.pow((S.cash + G.portfolio.invested(S)) / 100000, 1 / YEARS) - 1) / SEEDS;
    dd += mdd / SEEDS;
    worst = Math.max(worst, mdd);
  }
  console.log(`${G.auto.ROBOTS[robot].n.padEnd(12)} ${pct(cagr)} ${pct(dd)} ${pct(worst)}`);
}

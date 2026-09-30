// Retorno anual de uma terra por 20 anos em cada uso (valorização + renda, depois de custos e IR).
// uso: node tools/agro-sim.js [--years 20] [--seeds 8]
const fs = require('fs'), path = require('path'), vm = require('vm');
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? +argv[i + 1] : def;
};
const YEARS = arg('years', 20), SEEDS = arg('seeds', 8);
const noop = () => {};
const ctx = vm.createContext({
  console, performance: { now: () => 0 }, setInterval: noop,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  window: { addEventListener: noop }, document: { addEventListener: noop },
});
const JS = path.join(__dirname, '..', 'js');
for (const f of ['i18n', 'rng', 'format', 'calendar', 'data/assets', 'data/research', 'macro', 'market', 'events', 'tax', 'portfolio',
  'realty', 'agro', 'angel', 'automation', 'business', 'fund', 'social', 'politics', 'families', 'nation', 'legacy', 'dynasty', 'life', 'choices', 'work', 'research', 'state'])
  vm.runInContext(fs.readFileSync(path.join(JS, f + '.js'), 'utf8'), ctx);
const G = ctx.G;

function run(landId, crop, seed, opts = {}) {
  const S = G.newState(seed);
  Object.assign(S.research, { agro: true, gestao_pessoas: true }, opts.research || {});
  const price = G.agro.price(S, G.agro.land(landId));
  S.cash = price * 1.03;
  G.agro.buy(S, landId);
  G.agro.setCrop(S, 0, crop);
  if (crop !== 'arrendar') G.agro.hire(S, 0);
  if (opts.insured) G.agro.toggleInsurance(S, 0);
  const start = S.cash + G.agro.equity(S) + price * 0.03; // conta o ITBI como parte do investimento
  let bank = S.cash; // a renda é reinvestida à Selic, como um jogador faria
  S.cash = 0;
  for (let d = 0; d < YEARS * 360; d++) {
    S.day++;
    G.macro.step(S); G.events.daily(S); G.market.step(S); G.agro.daily(S);
    const c = G.cal.of(S.day);
    if (c.dom === 1) {
      G.agro.monthly(S, c); G.macro.monthly(S, c); G.events.monthly(S, c); S.biz.neglect = 0;
      bank = bank * Math.pow(1 + S.macro.selic, 1 / 12) + S.cash;
      S.cash = 0;
    }
  }
  const end = bank + G.agro.equity(S) * 0.94; // vender custa 6% de corretagem
  return Math.pow(end / start, 1 / YEARS) - 1;
}

const pct = v => (v * 100).toFixed(2).padStart(7) + '%';
console.log(`\n${SEEDS} seeds × ${YEARS} anos, retorno anual líquido (com gerente quando cultiva)\n`);
const cases = [
  ['mato_grosso', 'arrendar', {}], ['mato_grosso', 'gado', {}], ['mato_grosso', 'soja', {}],
  ['mato_grosso', 'soja', { research: { safrinha: true, agro_tec: true } }], ['parana', 'soja', { insured: true }], ['sitio', 'cafe', {}],
];
for (const [landId, crop, opts] of cases) {
  const r = [];
  for (let s = 1; s <= SEEDS; s++) r.push(run(landId, crop, s * 911, opts));
  r.sort((a, b) => a - b);
  const label = `${landId} / ${crop}${opts.research ? ' + safrinha + precisão' : ''}${opts.insured ? ' + seguro' : ''}`;
  console.log(`${label.padEnd(45)} média ${pct(r.reduce((a, b) => a + b, 0) / r.length)}  pior ${pct(r[0])}  melhor ${pct(r[r.length - 1])}`);
}

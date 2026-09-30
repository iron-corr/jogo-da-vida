// Compara duas formas de fazer política partindo de R$ 50 mi, por 30 anos:
// "limpa" (doação oficial, filantropia, mídia) vs "agressiva" (caixa 2, lobby em tudo, conflito de interesse).
// Objetivo de balanceamento: a agressiva rende mais na média, mas com cauda de ruína (escândalos).
// uso: node tools/politics-sim.js [--years 30] [--seeds 20]
const fs = require('fs'), path = require('path'), vm = require('vm');
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? +argv[i + 1] : def;
};
const YEARS = arg('years', 30), SEEDS = arg('seeds', 20);
const noop = () => {};
const ctx = vm.createContext({
  console, performance: { now: () => 0 }, setInterval: noop,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  window: { addEventListener: noop }, document: { addEventListener: noop },
});
const JS = path.join(__dirname, '..', 'js');
const FILES = ['i18n', 'rng', 'format', 'calendar', 'data/assets', 'data/research', 'macro', 'market', 'events', 'tax', 'portfolio',
  'realty', 'agro', 'angel', 'automation', 'business', 'fund', 'social', 'politics', 'families', 'nation', 'legacy', 'dynasty', 'goals', 'life', 'choices', 'work', 'research', 'state'];
for (const f of FILES)
  vm.runInContext(fs.readFileSync(path.join(JS, f + '.js'), 'utf8'), ctx);
vm.runInContext('G.ui={init(){},render(){},reset(){}}', ctx);
vm.runInContext(fs.readFileSync(path.join(JS, 'main.js'), 'utf8'), ctx);
const G = ctx.G;

const PRIORITY = ['subsidio', 'reforma_trab', 'fim_div_tax', 'credito_imob', 'isencao_acoes', 'marco_cripto'];

function play(style, seed) {
  const S = G.newState(seed);
  for (const r of G.RESEARCH) S.research[r.id] = true;
  Object.assign(S.job, { employed: false, retired: true });
  S.lifestyle = 3;
  S.social.prestige = 400; // Elite
  S.cash = 5e7;
  // Um jogador rico típico: uma fábrica com gerente, um galpão alugado e o resto na carteira.
  G.business.open(S, 'fabrica');
  G.business.hire(S, 'fabrica');
  S.market.prices.imob = 100;
  G.realty.buy(S, 'galpao', false);
  Object.assign(S.auto, { on: true, rebal: true, reserve: 24, targets: { ibov: 40, commodities: 20, tesouro_selic: 40 } });
  let scandals = 0;
  const scandal = G.politics.scandal;
  G.politics.scandal = s => { scandals++; scandal(s); };
  const leader = () => {
    const w = G.politics.weights(S);
    return Object.keys(w).sort((a, b) => w[b] - w[a])[0];
  };
  for (let d = 0; d < YEARS * 360; d++) {
    G.tick(S);
    const c = G.cal.of(S.day);
    if (c.dom !== 2) continue;
    const nw = G.portfolio.netWorth(S);
    if (G.cal.isElectionYear(c.year) && c.month === 8) {
      G.politics.donate(S, leader(), G.politics.legalLimit(S), false);
      if (style === 'agressiva') G.politics.donate(S, leader(), 0.02 * nw, true);
    }
    if (style === 'limpa') {
      if (c.month === 1) G.social.donate(S, 0.005 * nw);
    } else {
      // Junta influência para o projeto mais valioso que ainda falta, em vez de gastar nos baratos.
      const want = PRIORITY.find(id => !S.pol.bills.some(x => x.id === id)
        && !(S.pol.passed[id] && !(S.pol.passed[id].until && S.day >= S.pol.passed[id].until)));
      if (want) G.politics.startLobby(S, want, 'commodities');
    }
  }
  G.politics.scandal = scandal;
  return { nw: G.portfolio.netWorth(S) / S.macro.priceIndex, scandals, passed: Object.keys(S.pol.passed).length, image: S.pol.image };
}

const q = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.floor(p * (arr.length - 1))];
const mi = v => (v / 1e6).toFixed(0).padStart(6) + ' mi';
console.log(`\n${SEEDS} seeds × ${YEARS} anos, começando com R$ 50 mi (valores em R$ de 2026)\n`);
console.log('estilo        média     p10      p50      p90   escândalos  leis aprovadas  imagem final');
for (const style of ['limpa', 'agressiva']) {
  const runs = [];
  for (let s = 1; s <= SEEDS; s++) runs.push(play(style, s * 7717));
  const nws = runs.map(r => r.nw), avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(`${style.padEnd(10)} ${mi(avg(nws))} ${mi(q(nws, 0.1))} ${mi(q(nws, 0.5))} ${mi(q(nws, 0.9))}   ${avg(runs.map(r => r.scandals)).toFixed(1).padStart(8)}   ${avg(runs.map(r => r.passed)).toFixed(1).padStart(12)}   ${avg(runs.map(r => r.image)).toFixed(0).padStart(10)}`);
}

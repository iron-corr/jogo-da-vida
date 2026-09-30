(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const money = v => G.fmt.money(v);
  // Ativo de risco = ações, FIIs e alternativos, exceto ouro (que protege).
  const isRisk = id => G.ASSETS[id].kind === 'equity' && id !== 'ouro';

  function ibovAboveMA(S) {
    const h = S.market.hist.ibov, n = Math.min(200, h.length);
    let sum = 0;
    for (let i = h.length - n; i < h.length; i++) sum += h[i];
    return h[h.length - 1] > sum / n;
  }

  // Cada robô devolve um multiplicador para a fatia de risco da carteira.
  const ROBOTS = {
    nenhum: { n: tr('Nenhum', 'None'), d: tr('Segue a alocação-alvo à risca.', 'Follows the target allocation to the letter.'), m: () => 1 },
    valor: { n: tr('Valor', 'Value'), d: tr('Mais bolsa quando o P/L está baixo, menos quando está alto.', 'More stocks when the P/E is low, fewer when it is high.'), m: S => clamp(9 / G.market.pe(S), 0.5, 1.5) },
    ciclo: { n: tr('Ciclo', 'Cycle'), d: tr('Mais bolsa com PMI acima de 52, menos abaixo de 49.', 'More stocks with the PMI above 52, fewer below 49.'), m: S => (S.macro.shown.pmi > 52 ? 1.3 : S.macro.shown.pmi < 49 ? 0.6 : 1) },
    tendencia: { n: tr('Tendência', 'Trend'), d: tr('Mais exposto quando o Ibovespa está acima da média de 200 dias.', 'More exposed when the Ibovespa is above its 200-day average.'), m: S => (ibovAboveMA(S) ? 1.2 : 0.7) },
    contrarian: { n: tr('Contrarian', 'Contrarian'), d: tr('Compra no medo extremo, reduz na ganância extrema.', 'Buys in extreme fear, trims in extreme greed.'), m: S => (S.market.fg < 25 ? 1.4 : S.market.fg > 75 ? 0.7 : 1) },
  };

  const A = G.auto = {
    ROBOTS,
    isRisk,
    init: () => ({ on: false, reserve: 6, targets: {}, rebal: false, band: 0.05, robot: 'nenhum' }),

    // Alvos normalizados (somam 1), já com a inclinação do robô. null se não houver alvo.
    targets(S) {
      const t = {};
      let total = 0;
      for (const id in S.auto.targets) {
        const w = +S.auto.targets[id];
        if (w > 0 && G.portfolio.unlocked(S, id)) {
          t[id] = w;
          total += w;
        }
      }
      if (!total) return null;
      for (const id in t) t[id] /= total;
      const m = S.research.quant ? ROBOTS[S.auto.robot].m(S) : 1;
      if (m === 1) return t;
      let risk = 0;
      for (const id in t) if (isRisk(id)) risk += t[id];
      if (risk <= 0) return t;
      const newRisk = Math.min(1, risk * m), safe = 1 - risk;
      for (const id in t) if (isRisk(id)) t[id] *= newRisk / risk;
      if (safe > 0) {
        for (const id in t) if (!isRisk(id)) t[id] *= (1 - newRisk) / safe;
      } else if (newRisk < 1) {
        const park = G.portfolio.unlocked(S, 'tesouro_selic') ? 'tesouro_selic' : 'poupanca';
        t[park] = (t[park] || 0) + (1 - newRisk);
      }
      return t;
    },

    // Vende o que passou da banda e usa o dinheiro para comprar o que ficou para trás.
    rebalance(S, t) {
      const P = G.portfolio, ids = Object.keys(t);
      const total = ids.reduce((s, id) => s + P.value(S, id), 0);
      if (total < 1000) return 0;
      const band = S.auto.band * total;
      let budget = 0;
      for (const id of ids) {
        const diff = t[id] * total - P.value(S, id);
        if (diff < -band) budget += P.sell(S, id, -diff);
      }
      const moved = budget;
      for (const id of ids) {
        const diff = t[id] * total - P.value(S, id);
        if (diff > band && budget > 0) budget -= P.buy(S, id, Math.min(diff, budget));
      }
      if (moved > total * 0.01) G.news(tr(`Rebalanceamento: ${money(moved)} realocados para voltar aos alvos.`, `Rebalancing: ${money(moved)} reallocated to get back to target.`), 'info');
      return moved;
    },

    monthly(S, c) {
      if (!S.research.aporte_auto) return;
      const t = A.targets(S);
      if (!t) return;
      const rebalNow = S.research.rebalanceamento && S.auto.rebal && (S.research.quant || c.month % 3 === 1);
      if (rebalNow) A.rebalance(S, t);
      if (S.auto.on) {
        const surplus = S.cash - S.auto.reserve * G.work.outflow(S);
        if (surplus >= 100) for (const id in t) G.portfolio.buy(S, id, surplus * t[id]);
      }
    },
  };
})();

(function () {
  const G = globalThis.G = globalThis.G || {};

  // Cada posição é uma lista de lotes { u: cotas, c: custo, d: dia da compra }.
  // Lotes permitem carência por aplicação (CDB) e, no M3, IR por lote.
  const lots = (S, id) => S.port[id] || (S.port[id] = []);
  const isLocked = (S, id, l) => S.day - l.d < (G.ASSETS[id].lockDays || 0);

  const P = G.portfolio = {
    unlocked(S, id) {
      if (G.ASSETS[id].hidden) return false;
      const r = G.ASSETS[id].req;
      return !r || !!S.research[r];
    },
    value: (S, id) => (S.port[id] || []).reduce((s, l) => s + l.u, 0) * S.market.prices[id],
    cost: (S, id) => (S.port[id] || []).reduce((s, l) => s + l.c, 0),
    locked(S, id) {
      let units = 0, until = Infinity;
      for (const l of S.port[id] || []) {
        if (!isLocked(S, id, l)) continue;
        units += l.u;
        until = Math.min(until, l.d + G.ASSETS[id].lockDays);
      }
      return { value: units * S.market.prices[id], inDays: until - S.day };
    },
    invested(S) {
      let t = 0;
      for (const id in S.port) t += P.value(S, id);
      return t;
    },
    // Caixa + carteira + imóveis (líquidos de financiamento) + terras + startups pelo custo + empresas (menos dívidas) + gestora.
    netWorth: S => S.cash + P.invested(S) + G.realty.equity(S) + G.agro.equity(S) + G.angel.book(S) + G.business.value(S) - G.business.debt(S) + G.fund.value(S) + G.life.equity(S),
    monthlyYield(S) {
      let t = 0;
      for (const id in S.port) t += P.value(S, id) * (Math.pow(1 + G.market.annualYield(S, id), 1 / 12) - 1);
      return t;
    },
    buy(S, id, amount) {
      amount = Math.min(amount, S.cash);
      if (!(amount >= 0.01) || !P.unlocked(S, id)) return 0;
      lots(S, id).push({ u: amount / S.market.prices[id], c: amount, d: S.day });
      S.cash -= amount;
      return amount;
    },
    // Vende do lote mais antigo para o mais novo, pulando os que estão em carência.
    // Devolve o valor líquido (depois do IR retido na fonte).
    sell(S, id, amount) {
      const price = S.market.prices[id], L = lots(S, id);
      let want = amount / price, net = 0;
      for (const l of L) {
        if (want <= 1e-12) break;
        if (isLocked(S, id, l)) continue;
        const take = Math.min(l.u, want);
        const basis = l.c * (take / l.u), proceeds = take * price;
        net += proceeds - G.tax.onSale(S, id, proceeds, proceeds - basis, S.day - l.d);
        l.c -= basis;
        l.u -= take;
        want -= take;
      }
      S.port[id] = L.filter(l => l.u > 1e-9);
      S.cash += net;
      return net;
    },

    // Dividendos trimestrais (jan/abr/jul/out) e aluguéis de FII mensais.
    payDividends(S, c) {
      let total = 0;
      for (const id in S.port) {
        const a = G.ASSETS[id];
        if (a.kind !== 'equity' || !a.dy || (a.divFreq === 4 && c.month % 3 !== 1)) continue;
        const gross = (P.value(S, id) * a.dy) / a.divFreq;
        if (gross < 0.01) continue;
        const amount = gross - G.tax.onDividend(S, id, gross);
        S.cash += amount;
        S.stats.dividends += amount;
        total += amount;
        if (S.settings.reinvest && S.research.dividendos) P.buy(S, id, amount);
      }
      if (total >= 0.01) {
        G.news(`Dividendos e aluguéis: ${G.fmt.money(total)}${S.settings.reinvest && S.research.dividendos ? ' (reinvestidos)' : ''}.`, 'good');
      }
    },
  };
})();

(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  // Gestora: o fundo replica a sua estratégia (alocação-alvo com robô, ou a carteira atual).
  // Receita = 2% a.a. sobre o patrimônio + 20% do que passar do CDI (com marca d'água).
  // Captação segue o desempenho dos últimos 12 meses contra o CDI.
  const ADM = 0.02, PERF = 0.2, TAX = 0.34;
  const money = v => G.fmt.money(v);

  function weights(S) {
    const t = G.auto.targets(S);
    if (t) return t;
    const P = G.portfolio, total = P.invested(S), w = {};
    if (total <= 0) return { tesouro_selic: 1 };
    for (const id in S.port) w[id] = P.value(S, id) / total;
    return w;
  }

  const F = G.fund = {
    QUARANTINE: 1800, // 5 anos de não concorrência depois de vender
    canOpen: S => !!S.research.gestora && !S.fund && S.day >= (S.fundBlockedUntil || 0),
    open(S) {
      if (!F.canOpen(S)) return;
      const seed = Math.max(5e6, S.reputation * 100000);
      S.fund = { aum: seed, nav: 1, hwm: 1, rets: [], snap: { ...S.market.prices }, lastProfit: 0, lastFlow: 0, profits: [] };
      G.news(tr(`Gestora aberta! Amigos, família e ex-colegas confiaram ${money(seed)} a você.`,
        `Asset manager open! Friends, family and former colleagues trusted you with ${money(seed)}.`), 'good');
    },
    ret12(S) {
      const r = S.fund.rets.slice(-12);
      return r.reduce((a, x) => a * (1 + x.fund), 1) - 1;
    },
    cdi12(S) {
      const r = S.fund.rets.slice(-12);
      return r.reduce((a, x) => a * (1 + x.cdi), 1) - 1;
    },
    // Gestoras valem ~3% do patrimônio sob gestão; preço cheio só com 2 anos de histórico,
    // metade se os últimos 12 meses deram prejuízo.
    value(S) {
      const f = S.fund;
      if (!f) return 0;
      const profits = f.profits || [], months = f.rets.length;
      const profitable = profits.reduce((a, b) => a + b, 0) >= 0;
      return f.aum * 0.03 * Math.min(1, months / 24) * (profitable ? 1 : 0.5);
    },
    saleValue: S => F.value(S) * G.business.CYCLE[S.macro.regime],
    sell(S) {
      if (!S.fund) return;
      const gross = F.saleValue(S), net = gross - G.tax.flat(S, gross);
      S.cash += net;
      S.fund = null;
      S.fundBlockedUntil = S.day + F.QUARANTINE;
      G.news(tr(`Você vendeu a gestora por ${money(gross)} (${money(net)} depois do IR). Contrato de não concorrência: 5 anos sem abrir outra.`,
        `You sold the asset manager for ${money(gross)} (${money(net)} after tax). Non-compete: 5 years before you can open another.`), 'good');
    },

    monthly(S) {
      const f = S.fund;
      if (!f) return;
      const w = weights(S), px = S.market.prices;
      let r = 0;
      // Preço + dividendos do mês (as ações pagam à parte na carteira pessoal; no fundo, entram na cota).
      for (const id in w) {
        const a = G.ASSETS[id];
        r += w[id] * (px[id] / (f.snap[id] || px[id]) - 1 + (a.kind === 'equity' ? (a.dy || 0) / 12 : 0));
      }
      f.snap = { ...px };
      const cdi = Math.pow(1 + S.macro.selic - 0.001, 1 / 12) - 1;

      const before = f.aum;
      const adm = (before * (1 + r) * ADM) / 12;
      const perf = f.nav * (1 + r) > f.hwm && r > cdi ? PERF * (r - cdi) * before : 0;
      f.aum = before * (1 + r) - adm - perf;
      f.nav *= f.aum / before;
      if (perf > 0) f.hwm = Math.max(f.hwm, f.nav);
      f.rets.push({ fund: f.aum / before - 1, cdi });
      if (f.rets.length > 60) f.rets.shift();

      const costs = 25000 * S.macro.priceIndex + (f.aum * 0.002) / 12;
      const profit = adm + perf - costs;
      const net = profit > 0 ? profit * (1 - TAX) : profit;
      S.cash += net;
      f.lastProfit = net;
      (f.profits || (f.profits = [])).push(net);
      if (f.profits.length > 12) f.profits.shift();
      S.stats.fundIncome = (S.stats.fundIncome || 0) + net;
      S.reputation += 1;

      // Captação: bate o CDI em 12 meses e o dinheiro vem; perde e ele vai embora.
      const excess = f.rets.length >= 6 ? F.ret12(S) - F.cdi12(S) : 0;
      let flow = 0.01 + 0.4 * excess + (S.research.compliance ? 0.005 : 0) + Math.min(0.01, S.reputation / 20000) + 0.002 * G.social.tierIdx(S) + S.pol.image / 5000;
      if (S.macro.regime === 'recessao') flow -= 0.01;
      flow = Math.max(-0.12, Math.min(0.06, flow)) / (1 + f.aum / 5e9);
      f.lastFlow = f.aum * flow;
      f.aum += f.lastFlow;
      if (flow < -0.05) G.news(tr(`Resgates em massa na sua gestora: ${money(-f.lastFlow)} saíram este mês.`,
        `Mass redemptions at your asset manager: ${money(-f.lastFlow)} left this month.`), 'bad');
    },
  };
})();

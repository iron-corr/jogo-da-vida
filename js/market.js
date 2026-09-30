(function () {
  const G = globalThis.G = globalThis.G || {};

  const HIST = 720;
  const SQ = Math.sqrt(360);
  const daily = annual => Math.pow(1 + annual, 1 / 360) - 1;

  // Fator de mercado das ações: drift (log, a.a.) e volatilidade por regime.
  const MKT = {
    expansao: { mu: 0.13, vol: 0.16 },
    pico: { mu: 0.02, vol: 0.22 },
    recessao: { mu: -0.15, vol: 0.28 },
    recuperacao: { mu: 0.25, vol: 0.24 },
  };
  // Âncora de valuation: a bolsa oscila em torno de uma tendência de lucros (8% a.a.)
  // e é puxada de volta a ela. gap > 0 = cara, gap < 0 = barata. P/L justo = 9.
  const TREND = 0.08, REVERSION = 0.35, FAIR_PE = 9;
  // A parte específica de cada setor (ruído próprio + eventos do setor) é um desvio que
  // volta devagar para zero (meia-vida ~1 ano), em vez de vagar sem limite.
  const IDIO_DECAY = 1 / 720;

  // Ciclo cripto de 4 anos, ancorado no halving de abr/2028 (dia 810).
  // Cada fase tem um drift (log, a.a.); a amplitude encolhe a cada ciclo (mercado amadurece).
  const HALVING0 = 810, CYCLE = 1440;
  const CRYPTO_PHASES = [
    [0.12, 0.4, 'pós-halving'],
    [0.4, 1.6, 'euforia'],
    [0.5, -2.5, 'estouro da bolha'],
    [0.75, -0.4, 'inverno cripto'],
    [1, 0.2, 'acumulação'],
  ];
  const CRYPTO_MEAN = 0.195;
  function cryptoPhase(day) {
    const t = (((day - HALVING0) % CYCLE) + CYCLE) % CYCLE / CYCLE;
    return CRYPTO_PHASES.find(([end]) => t < end);
  }
  function cryptoMu(day) {
    const n = Math.max(0, Math.floor((day - HALVING0) / CYCLE) + 1);
    const amp = Math.max(0.35, Math.pow(0.85, n));
    return 0.08 + 0.12 * amp + amp * (cryptoPhase(day)[1] - CRYPTO_MEAN);
  }

  // Taxas de mercado do dia: prefixado (expectativa de Selic + prêmio) e juro real do IPCA+.
  // Os ruídos são AR(1) para não virarem só barulho diário.
  function marketYields(S) {
    const m = S.macro, k = S.market, t = G.macro.target(S);
    k.preNoise = 0.985 * k.preNoise + G.rng.normal() * 0.0005;
    k.realNoise = 0.985 * k.realNoise + G.rng.normal() * 0.0004;
    return {
      pre: 0.5 * m.selic + 0.5 * t.selic + 0.3 * (m.infl - t.infl) + 0.008 + k.preNoise,
      real: Math.max(0.02, 0.055 + 0.4 * (m.selic - 0.1) + k.realNoise),
    };
  }

  // Renda corrente anual: juros na renda fixa, dividendos/aluguéis nas ações e FIIs.
  function annualYield(S, id) {
    const a = G.ASSETS[id], m = S.macro, k = S.market;
    switch (a.kind) {
      case 'poupanca': return m.selic > 0.085 ? 0.0617 : 0.7 * m.selic;
      case 'selic': return m.selic + a.spread;
      case 'cdi': return (m.selic - 0.001) * a.mult;
      case 'pre': return k.pre;
      case 'ipca': return (1 + m.infl) * (1 + k.real) - 1;
      case 'equity': return a.dy;
    }
    return 0;
  }

  function initAsset(k, id) {
    k.prices[id] = 100;
    k.hist[id] = [100];
  }

  G.market = {
    MKT,
    cryptoPhase: day => cryptoPhase(day)[2],
    nextHalving: day => HALVING0 + Math.ceil((day - HALVING0 + 1) / CYCLE) * CYCLE,
    pe: S => FAIR_PE * Math.exp(Math.log(S.market.prices.ibov) - S.market.trend),
    annualYield,
    initAsset,
    init(S) {
      const m = S.macro, t = G.macro.target(S);
      S.market = {
        prices: {}, hist: {}, pre: 0.5 * m.selic + 0.5 * t.selic + 0.008, real: 0.055, preNoise: 0, realNoise: 0,
        effects: [], lastSelic: m.selic, fg: 50, trend: Math.log(100), idio: {},
      };
      for (const id in G.ASSETS) initAsset(S.market, id);
    },
    // Choque temporário (evento): soma `total` de retorno ao longo de `days`, começando após `delay`.
    // id é um ativo ou 'mkt' (fator de mercado, escalado pelo beta de cada ação).
    addEffect(S, id, total, days, delay = 0) {
      S.market.effects.push({ id, perDay: Math.log(1 + total) / days, days, start: S.day + delay });
    },
    step(S) {
      const k = S.market, m = S.macro, y = marketYields(S);
      const c = G.cal.of(S.day), season = G.cal.season(S.day).id;
      const nervous = G.cal.isElectionYear(c.year) && c.month >= 8 && c.month <= 10;
      const reg = MKT[m.regime], vol = reg.vol * (nervous ? 1.3 : 1);
      const zm = G.rng.normal();
      k.trend += TREND / 360;
      const gap = Math.log(k.prices.ibov) - k.trend;
      const dSelic = m.selic - k.lastSelic;
      k.lastSelic = m.selic;
      const fx = {};
      for (const e of k.effects) if (e.start <= S.day) fx[e.id] = (fx[e.id] || 0) + e.perDay;

      for (const id in G.ASSETS) {
        const a = G.ASSETS[id];
        if (!k.prices[id]) initAsset(k, id);
        if (a.kind === 'equity') {
          const mu = a.beta * (reg.mu - REVERSION * gap) + (a.drift || 0) + (a.crypto ? a.crypto * cryptoMu(S.day) : 0)
            + ((a.alpha || {})[m.regime] || 0) + ((a.season || {})[season] || 0) + G.politics.alpha(S, id);
          const prev = k.idio[id] || 0;
          const decay = a.idioDecay !== undefined ? a.idioDecay : IDIO_DECAY;
          const idio = prev * (1 - decay) + (a.sigma * G.rng.normal()) / SQ + (fx[id] || 0);
          k.idio[id] = idio;
          const lr = mu / 360 + a.beta * ((vol * zm) / SQ + (fx.mkt || 0)) + (idio - prev) - (a.selicD || 0) * dSelic;
          k.prices[id] *= Math.exp(lr);
        } else if (a.kind === 'imob') {
          // Índice imobiliário: inflação + ganho real, ciclo lento de 8 anos, sensível à Selic.
          const cyc = 0.04 * Math.sin((2 * Math.PI * S.day) / (8 * 360)) + ((a.alpha || {})[m.regime] || 0) + G.politics.alpha(S, id);
          const lr = (m.infl + 0.015 + cyc) / 360 - a.selicD * dSelic + (a.sigma * G.rng.normal()) / SQ;
          k.prices[id] *= Math.exp(lr);
        } else {
          let r = daily(annualYield(S, id));
          // Marcação a mercado: preço cai quando a taxa sobe, na proporção da duration.
          if (a.kind === 'pre') r -= a.duration * (y.pre - k.pre);
          if (a.kind === 'ipca') r -= a.duration * (y.real - k.real);
          k.prices[id] *= 1 + r;
        }
        const h = k.hist[id];
        h.push(Number(k.prices[id].toPrecision(6)));
        if (h.length > HIST) h.shift();
      }
      k.pre = y.pre;
      k.real = y.real;
      k.effects = k.effects.filter(e => e.start > S.day || --e.days > 0);

      // Medo e ganância: segue o retorno de 30 dias da bolsa, suavizado.
      const h = k.hist.ibov, r30 = h[h.length - 1] / h[Math.max(0, h.length - 31)] - 1;
      const raw = 50 + 300 * r30 + G.rng.normal() * 4;
      k.fg = Math.max(0, Math.min(100, 0.9 * k.fg + 0.1 * raw));
    },
  };
})();

(function () {
  const G = globalThis.G = globalThis.G || {};

  // Agronegócio: terras que se valorizam (índice G.ASSETS.terra) e podem ser arrendadas ou cultivadas.
  // Rendimentos anuais em fração do valor da terra (V). O clima do ano e o preço das commodities mexem na safra.
  const LANDS = [
    { id: 'sitio', n: 'Sítio no Sul de Minas (50 ha)', base: 1.5e6, region: 'centro', crops: ['arrendar', 'cafe', 'gado'], energy: 2 },
    { id: 'goias', n: 'Fazenda em Goiás (2.000 ha)', base: 20e6, region: 'centro', crops: ['arrendar', 'gado', 'soja'], energy: 6 },
    { id: 'mato_grosso', n: 'Fazenda no Mato Grosso (1.000 ha)', base: 25e6, region: 'centro', crops: ['arrendar', 'soja', 'gado'], energy: 6 },
    { id: 'parana', n: 'Fazenda no Paraná (500 ha)', base: 30e6, region: 'sul', crops: ['arrendar', 'soja'], energy: 6 },
  ];

  const CROPS = {
    arrendar: { n: 'Arrendar', d: 'Um produtor paga ~4% do valor da terra por ano. Sem risco e sem trabalho.' },
    gado: { n: 'Gado de corte', d: 'Renda mensal de ~7% ao ano. Seca reduz, boi gordo segue as commodities.' },
    soja: { n: 'Soja', d: 'Planta em outubro, colhe em fevereiro: ~10% ao ano, mas clima e preço mandam.' },
    cafe: { n: 'Café', d: 'Colhe em julho, com um ano bom e um ruim (bienalidade). Geada pode arrasar a safra.' },
  };

  // Clima do ano: probabilidades de [excelente, normal, seca, quebra] por região.
  const CLIMATES = {
    normal: { n: 'normal', centro: [0.15, 0.6, 0.18, 0.07], sul: [0.15, 0.6, 0.18, 0.07] },
    el_nino: { n: 'El Niño', centro: [0.08, 0.5, 0.28, 0.14], sul: [0.3, 0.55, 0.1, 0.05] },
    la_nina: { n: 'La Niña', centro: [0.25, 0.55, 0.14, 0.06], sul: [0.06, 0.45, 0.32, 0.17] },
  };
  const WEATHER = [['excelente', 1.25], ['normal', 1], ['seca', 0.6], ['quebra de safra', 0.3]];

  const ITBI = 0.03, BROKER = 0.06, MANAGER_FEE = 0.12, TAX = 0.15, INSURANCE = 0.04;
  const money = v => G.fmt.money(v);
  const land = id => LANDS.find(l => l.id === id);

  const A = G.agro = {
    LANDS, CROPS, CLIMATES, MANAGER_FEE,
    init: () => ({ lands: [], climate: 'normal', income: 0 }),
    land,
    price: (S, l) => l.base * S.market.prices.terra / 100,
    value: (S, h) => h.paid * (S.market.prices.terra / h.ix),
    equity: S => S.agro.lands.reduce((s, h) => s + A.value(S, h), 0),
    prod: S => (S.research.agro_tec ? 1.15 : 1),
    subsidy: S => G.politics.sectorMult(S, 'commodities'), // terras contam como setor de commodities
    // Preço das commodities agora contra a média de 1 ano (superciclos aparecem aqui).
    commodityFactor(S) {
      const h = S.market.hist.commodities, n = Math.min(360, h.length);
      let avg = 0;
      for (let i = h.length - n; i < h.length; i++) avg += h[i];
      return Math.max(0.6, Math.min(1.6, h[h.length - 1] / (avg / n)));
    },
    operated: h => h.crop !== 'arrendar' && !h.selling,
    drain: S => S.agro.lands.reduce((s, h) => s + (A.operated(h) && !h.mgr ? land(h.id).energy : 0), 0),
    // Renda mensal esperada (para o painel): arrendamento e gado; safras entram quando colhidas.
    monthlyExpected(S) {
      let t = 0;
      for (const h of S.agro.lands) {
        if (h.selling) continue;
        const v = A.value(S, h);
        if (h.crop === 'arrendar') t += (v * 0.04) / 12 * (1 - TAX);
        if (h.crop === 'gado') t += (v * 0.07) / 12 * A.prod(S) * (1 - TAX) * (h.mgr ? 1 - MANAGER_FEE : 1);
      }
      return t * A.subsidy(S);
    },

    // Custos mensais que saem mesmo sem colheita (o cafezal é custeado o ano todo).
    monthlyCost(S) {
      let t = 0;
      for (const h of S.agro.lands) {
        if (h.selling || h.crop !== 'cafe') continue;
        const v = A.value(S, h);
        t += ((v * 0.13) + (h.insured ? INSURANCE * v * 0.24 * A.prod(S) : 0)) / 12;
      }
      return t;
    },

    buy(S, id) {
      const l = land(id);
      if (!l || !S.research.agro) return;
      const p = A.price(S, l);
      if (S.cash < p * (1 + ITBI)) return;
      S.cash -= p * (1 + ITBI);
      G.social.spent(S, p * ITBI);
      S.agro.lands.push({ id, paid: p, cost: p * (1 + ITBI), ix: S.market.prices.terra, crop: 'arrendar', mgr: false, insured: false,
        planted: null, frost: 0, selling: 0, last: '' });
      G.news(`Você comprou: ${l.n}. Por enquanto a terra está arrendada.`, 'good');
    },
    setCrop(S, i, crop) {
      const h = S.agro.lands[i];
      if (!h || !land(h.id).crops.includes(crop) || h.crop === crop) return;
      h.crop = crop;
      h.planted = null; // troca de cultura perde o que estava plantado
      h.last = crop === 'arrendar' ? 'arrendada' : 'aguardando a época de plantio';
    },
    hire(S, i) {
      const h = S.agro.lands[i];
      if (h && S.research.gestao_pessoas) h.mgr = true;
    },
    toggleInsurance(S, i) {
      const h = S.agro.lands[i];
      if (h) h.insured = !h.insured;
    },
    sell(S, i) {
      const h = S.agro.lands[i];
      if (!h || h.selling) return;
      h.selling = Math.round(G.rng.int(60, 240) * (S.macro.regime === 'recessao' ? 1.5 : 1));
      G.news(`${land(h.id).n} à venda. Terra demora para achar comprador.`, 'info');
    },

    daily(S) {
      for (let i = S.agro.lands.length - 1; i >= 0; i--) {
        const h = S.agro.lands[i];
        if (!h.selling || --h.selling > 0) continue;
        const gross = A.value(S, h) * (1 - BROKER);
        const net = gross - G.tax.flat(S, gross - h.cost);
        S.cash += net;
        S.agro.lands.splice(i, 1);
        G.news(`${land(h.id).n} vendida por ${money(net)} líquidos.`, 'good');
      }
    },

    // Sorteia o resultado da safra conforme o clima do ano e a região.
    weather(S, region) {
      const probs = CLIMATES[S.agro.climate][region];
      let r = G.rng.next(), i = 0;
      while (i < probs.length - 1 && (r -= probs[i]) > 0) i++;
      return WEATHER[i];
    },
    // Lucro de uma colheita: receita − custo, seguro, gerente, largado e imposto.
    harvest(S, h, revenue, cost, expected) {
      const neglect = h.mgr ? 0 : Math.min(1, S.biz.neglect / 30);
      revenue *= (1 - 0.4 * neglect) * A.subsidy(S);
      let payout = 0;
      if (h.insured && revenue < expected) payout = 0.7 * (expected - revenue);
      let profit = revenue + payout - cost;
      if (h.mgr && profit > 0) profit *= 1 - MANAGER_FEE;
      const net = profit - G.tax.flat(S, profit, TAX);
      S.cash += net + cost; // o custo já tinha saído do caixa no plantio
      S.agro.income += net;
      return net;
    },

    monthly(S, c) {
      const ag = S.agro, cf = A.commodityFactor(S);
      if (c.month === 1) {
        ag.climate = G.rng.pick({ normal: 0.6, el_nino: 0.2, la_nina: 0.2 });
        if (ag.lands.length) G.news(`Previsão do clima para o ano: ${CLIMATES[ag.climate].n}.`, ag.climate === 'normal' ? 'info' : 'hint');
      }
      for (const h of ag.lands) {
        if (h.selling) continue;
        const l = land(h.id), v = A.value(S, h), p = A.prod(S);
        if (h.crop === 'arrendar') {
          const rent = (v * 0.04) / 12 * A.subsidy(S);
          S.cash += rent - G.tax.flat(S, rent, TAX);
          ag.income += rent * (1 - TAX);
        } else if (h.crop === 'gado') {
          const [wName, wf] = A.weather(S, l.region);
          const gross = (v * 0.07) / 12 * p * (0.7 + 0.3 * cf) * (wf < 1 ? 0.85 : 1);
          A.harvest(S, h, gross, 0, gross);
          h.last = `gado: ${money(gross)} no mês${wf < 1 ? ` (pasto afetado: ${wName})` : ''}`;
        } else if (h.crop === 'soja') {
          if (c.month === 10) { // plantio
            const expected = v * 0.2 * p, cost = 0.5 * expected + (h.insured ? INSURANCE * expected : 0);
            S.cash -= cost;
            h.planted = { crop: 'soja', cost, expected, harvest: 2 };
            h.last = `soja plantada: ${money(cost)} em insumos${h.insured ? ' e seguro' : ''}`;
          }
          if (c.month === 2 && S.research.safrinha && h.planted === null) { // milho safrinha depois da soja
            const expected = v * 0.07 * p, cost = 0.5 * expected;
            S.cash -= cost;
            h.planted = { crop: 'milho', cost, expected, harvest: 7 };
          }
          if (h.planted && c.month === h.planted.harvest) {
            const [wName, wf] = A.weather(S, l.region), pl = h.planted;
            const net = A.harvest(S, h, pl.expected * cf * wf, pl.cost, pl.expected);
            h.planted = null;
            h.last = `colheita de ${pl.crop} (${wName}): ${net >= 0 ? 'lucro' : 'prejuízo'} de ${money(Math.abs(net))}`;
            G.news(`${l.n}: ${h.last}.`, net >= 0 ? 'good' : 'bad');
            if (wf > 1) G.legacy.flag(S, 'safra');
            if (pl.crop === 'soja' && S.research.safrinha) { // planta o milho logo em seguida
              const expected = v * 0.07 * p, cost = 0.5 * expected;
              S.cash -= cost;
              h.planted = { crop: 'milho', cost, expected, harvest: 7 };
            }
          }
        } else if (h.crop === 'cafe') {
          // Custo do cafezal sai todo mês; na colheita, harvest() apura o ano inteiro.
          S.cash -= ((v * 0.13) + (h.insured ? INSURANCE * v * 0.24 * p : 0)) / 12;
          if (c.month >= 6 && c.month <= 8 && G.rng.chance(ag.climate === 'la_nina' ? 0.05 : 0.02)) {
            h.frost = 2;
            G.news(`Geada no ${l.n}! A safra de café deste ano e a do próximo ficam comprometidas.`, 'bad');
          }
          if (c.month === 7) {
            const even = G.cal.of(S.day).year % 2 === 0;
            const expected = v * 0.24 * p * (even ? 1.25 : 0.75);
            const [wName, wf] = A.weather(S, l.region);
            const frost = h.frost === 2 ? 0.3 : h.frost === 1 ? 0.6 : 1;
            h.frost = Math.max(0, h.frost - 1);
            const net = A.harvest(S, h, expected * cf * wf * frost, v * 0.13, expected);
            h.last = `colheita de café, ano ${even ? 'de alta' : 'de baixa'} (${frost < 1 ? 'geada' : wName}): ${money(net)}`;
            G.news(`${l.n}: ${h.last}.`, net >= 0 ? 'good' : 'bad');
            if (wf > 1 && frost === 1) G.legacy.flag(S, 'safra');
          }
        }
      }
    },
  };
})();

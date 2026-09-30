(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  // Empresas: geradores de lucro mensal (os "prédios" do Kittens). cost e profit em R$ de 2026.
  // beta = quanto o lucro sofre com o ciclo; energy = energia/dia que cada unidade sem gerente consome.
  G.BUSINESSES = [
    { id: 'foodtruck', n: tr('Food truck', 'Food truck'), cost: 60000, profit: 1500, beta: 1, energy: 3, season: { verao: 1.3, inverno: 0.8 }, sector: 'varejo' },
    { id: 'padaria', n: tr('Padaria', 'Bakery'), cost: 150000, profit: 3200, beta: 0.4, energy: 3, sector: 'varejo' },
    { id: 'cafeteria', n: tr('Franquia de cafeteria', 'Coffee shop franchise'), cost: 300000, profit: 6500, beta: 0.8, energy: 4, season: { inverno: 1.2, verao: 0.9 }, sector: 'varejo' },
    { id: 'pousada', n: tr('Pousada no litoral', 'Seaside inn'), cost: 800000, profit: 17000, beta: 1.1, energy: 5, season: { verao: 1.7, outono: 0.8, inverno: 0.55, primavera: 0.95 } },
    { id: 'academia', n: tr('Academia', 'Gym'), cost: 1200000, profit: 24000, beta: 1, energy: 6, season: { verao: 1.25, inverno: 0.8 } },
    { id: 'posto', n: tr('Posto de gasolina', 'Gas station'), cost: 2500000, profit: 46000, beta: 0.6, energy: 6, sector: 'utilities' },
    { id: 'clinica', n: tr('Clínica médica', 'Medical clinic'), cost: 3000000, profit: 55000, beta: 0.3, energy: 8 },
    { id: 'escola', n: tr('Escola particular', 'Private school'), cost: 6000000, profit: 105000, beta: 0.2, energy: 8, season: { verao: 0.8 } },
    { id: 'construtora', n: tr('Construtora', 'Construction company'), cost: 12000000, profit: 250000, beta: 2.2, energy: 10 },
    { id: 'fabrica', n: tr('Fábrica de autopeças', 'Auto parts factory'), cost: 20000000, profit: 330000, beta: 1.8, energy: 12, sector: 'commodities' },
    { id: 'transportadora', n: tr('Transportadora', 'Trucking company'), cost: 35000000, profit: 600000, beta: 1.3, energy: 12, sector: 'commodities' },
    { id: 'supermercado', n: tr('Rede de supermercados', 'Supermarket chain'), cost: 80000000, profit: 1200000, beta: 0.5, energy: 15, season: { primavera: 1.15 }, sector: 'varejo' },
    // Fim de jogo: exigem posição social alta. A bolsa é única.
    { id: 'banco', n: tr('Banco digital', 'Digital bank'), cost: 1.5e9, profit: 25e6, beta: 0.8, energy: 40, tier: 4, sector: 'bancos' },
    { id: 'bolsa', n: tr('A bolsa de valores', 'The stock exchange'), cost: 50e9, profit: 600e6, beta: 0.5, energy: 60, tier: 5, unique: true },
  ];

  const REGIME = { expansao: 1.1, pico: 1.2, recessao: 0.6, recuperacao: 0.9 };
  // Venda: 90% do preço de reposição (o que custaria abrir a mesma unidade hoje), ajustado pelo ciclo.
  const CYCLE = { expansao: 1, pico: 1.15, recessao: 0.75, recuperacao: 0.9 };
  const HAIRCUT = 0.9;
  const MANAGER_FEE = 0.15;
  const TAX = 0.15; // lucro presumido, simplificado
  // Crédito empresarial: 70% financiado em 10 anos, pós-fixado (Selic + spread, a parcela acompanha a Selic).
  // BNDES cobra menos, mas só empresta a quem tem influência.
  const LOAN_SHARE = 0.7, LOAN_MONTHS = 120, BANK_SPREAD = 0.05, BNDES_SPREAD = 0.02, BNDES_INFLUENCE = 50;
  const money = v => G.fmt.money(v);
  const biz = id => G.BUSINESSES.find(b => b.id === id);

  const B = G.business = {
    MANAGER_FEE,
    CYCLE,
    biz,
    init: () => ({ n: {}, mgr: {}, cost: {}, neglect: 0, loans: [] }),
    LOAN_SHARE, BNDES_INFLUENCE,
    bndes: S => S.pol.influence >= BNDES_INFLUENCE,
    spread: S => (B.bndes(S) ? BNDES_SPREAD : BANK_SPREAD),
    loanRate: S => S.macro.selic + B.spread(S),
    quote(S, b) {
      const p = B.price(S, b), loan = p * LOAN_SHARE;
      return { down: p - loan, loan, pmt: G.realty.payment(loan, B.loanRate(S), LOAN_MONTHS) };
    },
    loans: S => S.biz.loans || (S.biz.loans = []),
    debt: S => B.loans(S).reduce((s, l) => s + l.bal, 0),
    // Parcela do mês de cada empréstimo: Selic de hoje sobre o saldo, nos meses que faltam.
    loanPayment: (S, l) => G.realty.payment(l.bal, S.macro.selic + l.spread, l.left),
    monthlyPayments: S => B.loans(S).reduce((s, l) => s + B.loanPayment(S, l), 0),
    count: (S, id) => S.biz.n[id] || 0,
    allowed: (S, b) => (b.tier || 0) <= G.social.tierIdx(S) && !(b.unique && B.count(S, b.id) > 0),
    managers: (S, id) => S.biz.mgr[id] || 0,
    growth: S => (S.research.escala ? 1.08 : 1.12),
    price: (S, b) => b.cost * S.macro.priceIndex * Math.pow(B.growth(S), B.count(S, b.id)),
    unitProfit(S, b) {
      const season = (b.season || {})[G.cal.season(S.day).id] || 1;
      return b.profit * S.macro.priceIndex * (1 + b.beta * (REGIME[S.macro.regime] - 1)) * season * G.politics.sectorMult(S, b.sector);
    },
    // Lucro mensal esperado, já descontando gerentes e imposto.
    monthlyProfit(S) {
      let t = 0;
      for (const b of G.BUSINESSES) {
        const n = B.count(S, b.id), m = B.managers(S, b.id);
        t += B.unitProfit(S, b) * (n - m * MANAGER_FEE);
      }
      return t * (1 - TAX) * G.politics.bizMult(S);
    },
    drain: S => G.BUSINESSES.reduce((s, b) => s + (B.count(S, b.id) - B.managers(S, b.id)) * b.energy, 0),
    // Valor de mercado de todas as unidades (soma dos preços de reposição, com o mesmo desconto da venda).
    value(S) {
      const g = B.growth(S), k = CYCLE[S.macro.regime] * HAIRCUT;
      let t = 0;
      for (const b of G.BUSINESSES) t += b.cost * S.macro.priceIndex * ((Math.pow(g, B.count(S, b.id)) - 1) / (g - 1)) * k;
      return t;
    },
    // Quanto rende vender a unidade mais recente.
    saleValue: (S, b) => b.cost * S.macro.priceIndex * Math.pow(B.growth(S), Math.max(0, B.count(S, b.id) - 1)) * CYCLE[S.macro.regime] * HAIRCUT,

    open(S, id, financed = false) {
      const b = biz(id);
      if (!b || !S.research.empreendedorismo || !B.allowed(S, b)) return;
      const p = B.price(S, b), q = B.quote(S, b);
      if (S.cash < (financed ? q.down : p)) return;
      S.cash -= financed ? q.down : p;
      G.social.spent(S, p * (1 - CYCLE[S.macro.regime] * HAIRCUT)); // deságio imediato no patrimônio
      if (financed) {
        B.loans(S).push({ id, bal: q.loan, spread: B.spread(S), left: LOAN_MONTHS });
        G.news(tr(`${B.bndes(S) ? 'O BNDES' : 'O banco'} financiou ${money(q.loan)} da sua nova unidade de ${b.n.toLowerCase()} ` +
          `(Selic + ${G.fmt.pct(B.spread(S), 0)}, parcela inicial de ${money(q.pmt)}/mês).`,
          `${B.bndes(S) ? 'The BNDES development bank' : 'The bank'} financed ${money(q.loan)} of your new ${b.n.toLowerCase()} unit ` +
          `(Selic + ${G.fmt.pct(B.spread(S), 0)}, initial payment of ${money(q.pmt)}/month).`), 'info');
      }
      S.biz.n[id] = B.count(S, id) + 1;
      S.biz.cost[id] = (S.biz.cost[id] || 0) + p;
      if (id === 'bolsa') {
        G.news(tr('Você comprou a bolsa de valores. Cada negócio fechado no país passa pelo seu balcão. ' +
          'Não existe mais "o mercado" contra quem apostar: o mercado é você.',
          'You bought the stock exchange. Every trade in the country goes through your counter. ' +
          'There is no longer a "market" to bet against: you are the market.'), 'story');
      } else G.news(tr(`Você abriu: ${b.n.toLowerCase()} (${S.biz.n[id]}ª unidade).`, `You opened: ${b.n.toLowerCase()} (unit #${S.biz.n[id]}).`), 'good');
    },
    hire(S, id) {
      if (!S.research.gestao_pessoas || B.managers(S, id) >= B.count(S, id)) return;
      S.biz.mgr[id] = B.managers(S, id) + 1;
    },
    sell(S, id) {
      const b = biz(id), n = B.count(S, id);
      if (!b || !n) return;
      const basis = S.biz.cost[id] / n, gross = B.saleValue(S, b);
      const net = gross - G.tax.flat(S, gross - basis);
      S.cash += net;
      S.biz.n[id] = n - 1;
      S.biz.mgr[id] = Math.min(B.managers(S, id), n - 1);
      S.biz.cost[id] -= basis;
      // Quita o empréstimo mais recente desse tipo de empresa com o dinheiro da venda.
      const L = B.loans(S), li = L.map(l => l.id).lastIndexOf(id);
      let paid = 0;
      if (li >= 0) {
        paid = L[li].bal;
        S.cash -= paid;
        L.splice(li, 1);
      }
      G.news(tr(`Você vendeu uma unidade de ${b.n.toLowerCase()} por ${money(gross)} (líquido ${money(net)}`,
        `You sold a ${b.n.toLowerCase()} unit for ${money(gross)} (net ${money(net)}`) +
        (paid ? tr(`; ${money(paid)} foram para quitar o financiamento dela`, `; ${money(paid)} went to pay off its loan`) : '') + ').', 'info');
    },

    // Empresas sem gerente comem energia primeiro; sem energia, ficam largadas.
    daily(S) {
      const d = B.drain(S) + G.agro.drain(S);
      if (!d) return;
      if (G.life.away(S)) S.biz.neglect++; // de férias, ninguém cuida do que não tem gerente
      else if (S.energy >= d) S.energy -= d;
      else {
        S.energy = 0;
        S.biz.neglect++;
      }
    },
    monthly(S) {
      // Parcelas dos financiamentos (pós-fixados: sobem e descem com a Selic).
      const L = B.loans(S);
      for (let i = L.length - 1; i >= 0; i--) {
        const l = L[i], pmt = B.loanPayment(S, l), r = Math.pow(1 + S.macro.selic + l.spread, 1 / 12) - 1;
        S.cash -= pmt;
        l.bal = Math.max(0, l.bal * (1 + r) - pmt);
        if (--l.left <= 0 || l.bal < 1) {
          L.splice(i, 1);
          G.legacy.flag(S, 'quitado');
          G.news(tr(`Financiamento de ${biz(l.id).n.toLowerCase()} quitado.`, `Loan for the ${biz(l.id).n.toLowerCase()} paid off.`), 'good');
        }
      }
      const gross = B.monthlyProfit(S);
      if (gross === 0 && !S.biz.neglect) return;
      const neglect = Math.min(1, S.biz.neglect / 30);
      const net = gross * (1 - 0.5 * neglect);
      S.cash += net;
      S.stats.bizIncome = (S.stats.bizIncome || 0) + net;
      if (neglect > 0.3) G.news(tr(`Suas empresas ficaram largadas ${S.biz.neglect} dias por falta de energia: lucro ${G.fmt.pct(0.5 * neglect, 0)} menor.`,
        `Your businesses were neglected for ${S.biz.neglect} days for lack of energy: profit ${G.fmt.pct(0.5 * neglect, 0)} lower.`), 'bad');
      S.biz.neglect = 0;
      if (S.macro.regime !== 'recessao') return;
      for (const b of G.BUSINESSES) {
        if (b.beta < 1 || !B.count(S, b.id) || !G.rng.chance(0.01 * B.count(S, b.id))) continue;
        const n = B.count(S, b.id);
        S.biz.cost[b.id] -= S.biz.cost[b.id] / n;
        S.biz.n[b.id] = n - 1;
        S.biz.mgr[b.id] = Math.min(B.managers(S, b.id), n - 1);
        G.news(tr(`A recessão fechou uma unidade de ${b.n.toLowerCase()}.`, `The recession closed one ${b.n.toLowerCase()} unit.`), 'bad');
      }
    },
  };
})();

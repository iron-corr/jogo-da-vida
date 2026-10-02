(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  // Imóveis físicos. O preço segue o índice imobiliário (G.ASSETS.imob) a partir do valor base.
  // yield = aluguel bruto anual; vacate = chance mensal de o inquilino sair.
  // people = quantas pessoas moram nele (só os residenciais servem de casa própria).
  G.PROPERTIES = [
    { id: 'kitnet', n: tr('Kitnet no centro', 'Downtown studio'), base: 180000, yield: 0.06, vacate: 0.04, people: 2 },
    { id: 'apto', n: tr('Apartamento de 2 quartos', '2-bedroom apartment'), base: 450000, yield: 0.045, vacate: 0.025, people: 4 },
    { id: 'casa', n: tr('Casa em condomínio', 'House in a gated community'), base: 1800000, yield: 0.04, vacate: 0.03, people: 6 },
    { id: 'cobertura', n: tr('Cobertura', 'Penthouse'), base: 4000000, yield: 0.035, vacate: 0.04, people: 10 },
    { id: 'sala', n: tr('Sala comercial', 'Office suite'), base: 700000, yield: 0.065, vacate: 0.05 },
    { id: 'galpao', n: tr('Galpão logístico', 'Logistics warehouse'), base: 3000000, yield: 0.08, vacate: 0.03 },
    { id: 'predio', n: tr('Prédio corporativo', 'Office building'), base: 25000000, yield: 0.07, vacate: 0.04 },
  ];

  const ITBI = 0.03;        // imposto de transmissão + cartório, na compra
  const BROKER = 0.06;      // corretagem, na venda
  const DOWN = 0.2;         // entrada no financiamento
  const MONTHS = 360;
  const ADMIN = 0.08;       // taxa da imobiliária sobre o aluguel
  const VACANT_COST = 0.001; // condomínio + IPTU por mês com o imóvel vago (fração do valor)

  const money = v => G.fmt.money(v);
  const prop = id => G.PROPERTIES.find(p => p.id === id);
  const index = S => S.market.prices.imob / 100;

  const R = G.realty = {
    ITBI, BROKER, DOWN, VACANT_COST,
    prop,
    price: (S, p) => p.base * index(S),
    loanRate: S => S.macro.selic + G.politics.loanSpread(S),
    // Parcela fixa (tabela Price).
    payment(balance, annualRate, months) {
      const r = Math.pow(1 + annualRate, 1 / 12) - 1;
      return (balance * r) / (1 - Math.pow(1 + r, -months));
    },
    // Meses para zerar o saldo pagando a parcela pmt (inverso da tabela Price).
    termFor(balance, annualRate, pmt) {
      const r = Math.pow(1 + annualRate, 1 / 12) - 1;
      if (pmt <= balance * r) return Infinity;
      return Math.max(1, Math.ceil(-Math.log(1 - (r * balance) / pmt) / Math.log(1 + r)));
    },
    // Amortização antecipada: abate o saldo e reduz a parcela (mode 'pmt', mesmo prazo) ou o prazo (mode 'term', mesma parcela).
    // Sem valor (ou valor acima do saldo), quita tudo o que o caixa cobrir.
    prepay(S, i, amount, mode = 'pmt') {
      const h = S.realty[i], l = h && h.loan;
      if (!l || h.selling) return 0;
      const amt = Math.min(amount > 0 ? amount : l.bal, l.bal, Math.max(0, S.cash));
      if (amt <= 0) return 0;
      S.cash -= amt;
      l.bal -= amt;
      const p = prop(h.pid);
      if (l.bal < 1) {
        h.loan = null;
        G.legacy.flag(S, 'quitado');
        G.news(tr(`Você quitou antecipadamente o financiamento: ${p.n.toLowerCase()} agora é 100% seu (${money(amt)}).`,
          `You paid off the mortgage early: the ${p.n.toLowerCase()} is now 100% yours (${money(amt)}).`), 'good');
        return amt;
      }
      if (mode === 'term') {
        l.left = Math.min(l.left, R.termFor(l.bal, l.rate, l.pmt));
        l.pmt = R.payment(l.bal, l.rate, l.left);
        G.news(tr(`Amortização de ${money(amt)} (${p.n.toLowerCase()}): faltam ${l.left} meses, parcela de ${money(l.pmt)}.`,
          `Prepayment of ${money(amt)} (${p.n.toLowerCase()}): ${l.left} months left, payment of ${money(l.pmt)}.`), 'good');
      } else {
        l.pmt = R.payment(l.bal, l.rate, l.left);
        G.news(tr(`Amortização de ${money(amt)} (${p.n.toLowerCase()}): parcela cai para ${money(l.pmt)}.`,
          `Prepayment of ${money(amt)} (${p.n.toLowerCase()}): payment drops to ${money(l.pmt)}.`), 'good');
      }
      return amt;
    },
    quote(S, p, financed) {
      const price = R.price(S, p);
      if (!financed) return { upfront: price * (1 + ITBI), loan: 0, pmt: 0 };
      const loan = price * (1 - DOWN);
      return { upfront: price * (DOWN + ITBI), loan, pmt: R.payment(loan, R.loanRate(S), MONTHS) };
    },
    value: (S, h) => h.paid * (S.market.prices.imob / h.ix),
    rent: (S, h) => (R.value(S, h) * prop(h.pid).yield) / 12,
    equity(S) {
      return S.realty.reduce((s, h) => s + R.value(S, h) - (h.loan ? h.loan.bal : 0), 0);
    },
    // Fluxo mensal esperado: aluguel líquido dos imóveis ocupados, parcelas e condomínio + IPTU
    // (pagos pelo dono no imóvel vago e na casa onde mora; no alugado, quem paga é o inquilino).
    monthlyNet(S) {
      let rent = 0, pmt = 0, upkeep = 0;
      for (const h of S.realty) {
        if (h.occupied && !h.selling && !h.home) rent += R.rent(S, h) * (1 - ADMIN) * 0.85;
        if (h.home || !h.occupied) upkeep += R.value(S, h) * VACANT_COST;
        if (h.loan) pmt += h.loan.pmt;
      }
      return { rent, pmt, upkeep };
    },

    buy(S, pid, financed) {
      const p = prop(pid);
      if (!p || !S.research.imoveis || (financed && !S.research.financiamento)) return;
      const q = R.quote(S, p, financed);
      if (S.cash < q.upfront) return;
      const price = R.price(S, p);
      S.cash -= q.upfront;
      G.social.spent(S, price * ITBI);
      S.realty.push({
        pid, paid: price, cost: price * (1 + ITBI), ix: S.market.prices.imob, day: S.day,
        occupied: false, selling: 0,
        loan: financed ? { bal: q.loan, rate: R.loanRate(S), pmt: q.pmt, left: MONTHS } : null,
      });
      G.news(tr(`Você comprou: ${p.n.toLowerCase()} por ${money(price)}${financed ? `, financiado (parcela de ${money(q.pmt)}/mês)` : ''}. Agora é achar inquilino.`,
        `You bought: ${p.n.toLowerCase()} for ${money(price)}${financed ? `, financed (payment of ${money(q.pmt)}/month)` : ''}. Now to find a tenant.`), 'good');
    },
    // Anuncia a venda; o dinheiro só entra quando aparecer comprador.
    sell(S, i) {
      const h = S.realty[i];
      if (!h || h.selling) return;
      h.selling = Math.round(G.rng.int(30, 180) * (S.macro.regime === 'recessao' ? 1.5 : 1));
      if (h.home) {
        h.home = false;
        G.news(tr('Vendendo a casa onde mora: você volta a pagar aluguel.', 'Selling the home you live in: you go back to paying rent.'), 'info');
      }
      G.news(tr(`${prop(h.pid).n} anunciado para venda. Pode levar meses para aparecer comprador.`,
        `${prop(h.pid).n} listed for sale. It may take months for a buyer to show up.`), 'info');
    },
    daily(S) {
      for (let i = S.realty.length - 1; i >= 0; i--) {
        const h = S.realty[i];
        if (!h.selling || --h.selling > 0) continue;
        const gross = R.value(S, h) * (1 - BROKER);
        const tax = G.tax.flat(S, gross - h.cost);
        const net = gross - tax - (h.loan ? h.loan.bal : 0);
        S.cash += net;
        S.realty.splice(i, 1);
        G.news(tr(`${prop(h.pid).n} vendido. Depois de corretagem, IR${h.loan ? ' e quitação do financiamento' : ''}, sobraram ${money(net)}.`,
          `${prop(h.pid).n} sold. After the realtor fee, income tax${h.loan ? ' and paying off the mortgage' : ''}, ${money(net)} was left.`), net >= 0 ? 'good' : 'bad');
      }
    },
    monthly(S) {
      const recession = S.macro.regime === 'recessao';
      for (const h of S.realty) {
        const p = prop(h.pid);
        if (h.home) {
          S.cash -= R.value(S, h) * VACANT_COST; // morando nele: condomínio e IPTU, sem aluguel
        } else if (h.occupied) {
          const rent = R.rent(S, h) * (1 - ADMIN);
          S.cash += rent - G.tax.flat(S, rent);
          S.stats.rent = (S.stats.rent || 0) + rent;
          if (G.rng.chance(p.vacate * (recession ? 2 : 1))) {
            h.occupied = false;
            G.news(tr(`O inquilino do seu imóvel (${p.n.toLowerCase()}) saiu. Ele fica vago até alugar de novo.`,
              `The tenant of your property (${p.n.toLowerCase()}) moved out. It stays vacant until rented again.`), 'bad');
          }
        } else {
          S.cash -= R.value(S, h) * VACANT_COST;
          if (!h.selling && G.rng.chance(recession ? 0.2 : 0.4)) h.occupied = true;
        }
        if (h.loan) {
          const l = h.loan, r = Math.pow(1 + l.rate, 1 / 12) - 1;
          S.cash -= l.pmt;
          l.bal = Math.max(0, l.bal * (1 + r) - l.pmt);
          if (--l.left <= 0 || l.bal < 1) {
            h.loan = null;
            G.legacy.flag(S, 'quitado');
            G.news(tr(`Financiamento quitado: ${p.n.toLowerCase()} agora é 100% seu.`, `Mortgage paid off: the ${p.n.toLowerCase()} is now 100% yours.`), 'good');
          }
        }
      }
    },
  };
})();

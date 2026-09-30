(function () {
  const G = globalThis.G = globalThis.G || {};

  // IR simplificado:
  // - renda fixa: tabela regressiva, retida na venda de cada lote
  // - ações: 15% sobre o lucro do mês, isento se as vendas do mês não passarem de R$ 20 mil (60 mil com lobby)
  // - ETF: 15%, sem isenção (prejuízo compensa junto com ações)
  // - FII: 20% sobre ganho de capital (aluguéis isentos)
  // - cripto: 15% sobre o lucro do mês, isento se as vendas não passarem de R$ 35 mil
  // - dividendos: 10% retido quando um pagamento passa de R$ 50 mil no mês (regras políticas em politics.dividendTax)
  // - imóveis, startups e aluguel de imóvel físico: 15% retido na hora (ver flat)
  const RF_TABLE = [[180, 0.225], [360, 0.2], [720, 0.175], [Infinity, 0.15]];
  const CRYPTO_EXEMPT = 35000;

  const T = G.tax = {
    exemptSales: S => G.politics.exemptSales(S),
    CRYPTO_EXEMPT,
    init: () => ({ acaoSales: 0, acaoGain: 0, rvGain: 0, fiiGain: 0, carryRv: 0, carryFii: 0, criptoSales: 0, criptoGain: 0, paid: 0 }),
    rfRate: age => RF_TABLE.find(([d]) => age <= d)[1],

    // Imposto de 15% retido na hora sobre um ganho; devolve o valor.
    flat(S, gain, rate = 0.15) {
      if (gain <= 0) return 0;
      const x = gain * rate * G.legacy.taxMult(S);
      S.tax.paid += x;
      return x;
    },

    // Registra a venda; devolve o imposto retido na fonte (só renda fixa).
    onSale(S, id, proceeds, gain, age) {
      const t = S.tax;
      switch (G.ASSETS[id].tax) {
        case 'rf':
          return T.flat(S, gain, T.rfRate(age));
        case 'acao':
          t.acaoSales += proceeds;
          t.acaoGain += gain;
          return 0;
        case 'etf':
          t.rvGain += gain;
          return 0;
        case 'fii':
          t.fiiGain += gain;
          return 0;
        case 'cripto':
          t.criptoSales += proceeds;
          t.criptoGain += gain;
          return 0;
      }
      return 0;
    },
    // 10% acima de R$ 50 mil/mês; 15% em tudo sob governo redistributivo; zero com o lobby aprovado.
    onDividend(S, id, amount) {
      const rate = G.politics.dividendTax(S, id, amount);
      return rate ? T.flat(S, amount, rate) : 0;
    },

    // Imposto estimado do mês corrente (para a UI).
    pending(S) {
      const t = S.tax;
      const acao = t.acaoGain;
      let rv = t.rvGain + (t.acaoSales > T.exemptSales(S) || acao < 0 ? acao : 0);
      rv = Math.max(0, rv - t.carryRv);
      const fii = Math.max(0, t.fiiGain - t.carryFii);
      const cripto = t.criptoSales > CRYPTO_EXEMPT ? Math.max(0, t.criptoGain) : 0;
      return rv * 0.15 + fii * 0.2 + cripto * 0.15;
    },

    // DARF: apura o mês que acabou.
    monthly(S, c) {
      const t = S.tax, acao = t.acaoGain;
      const exempt = t.acaoSales > 0 && t.acaoSales <= T.exemptSales(S) && acao > 0;
      let rv = t.rvGain + (exempt ? 0 : acao);
      let due = 0;
      if (rv < 0) t.carryRv -= rv;
      else {
        const use = Math.min(rv, t.carryRv);
        t.carryRv -= use;
        due += (rv - use) * 0.15;
      }
      if (t.fiiGain < 0) t.carryFii -= t.fiiGain;
      else {
        const use = Math.min(t.fiiGain, t.carryFii);
        t.carryFii -= use;
        due += (t.fiiGain - use) * 0.2;
      }
      if (t.criptoSales > CRYPTO_EXEMPT && t.criptoGain > 0) due += t.criptoGain * 0.15;
      const prev = G.fmt.MESES[(c.month + 10) % 12];
      if (exempt) G.news(`Vendas de ações em ${prev} abaixo de ${G.fmt.money(T.exemptSales(S))}: lucro de ${G.fmt.money(acao)} isento de IR.`, 'good');
      due *= G.legacy.taxMult(S);
      if (due > 0) {
        S.cash -= due;
        t.paid += due;
        G.news(`DARF de ${prev}: ${G.fmt.money(due)} de IR sobre renda variável.`, 'bad');
      }
      t.acaoSales = 0;
      t.acaoGain = 0;
      t.rvGain = 0;
      t.fiiGain = 0;
      t.criptoSales = 0;
      t.criptoGain = 0;
    },
  };
})();

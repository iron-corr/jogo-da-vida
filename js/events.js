(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  const SECTORS = ['bancos', 'commodities', 'varejo', 'utilities', 'tech'];
  const FGC_LIMIT = 250000;
  const money = v => G.fmt.money(v);
  const effect = (...args) => G.market.addEffect(...args);

  function bankFailure(S) {
    const v = G.portfolio.value(S, 'cdb');
    if (v <= 0) {
      G.news(tr('Banco médio sofre intervenção do Banco Central. Correntistas acionam o FGC.',
        'A mid-sized bank is taken over by the Central Bank. Depositors turn to the FGC deposit guarantee.'), 'macro');
      return;
    }
    const back = Math.min(v, FGC_LIMIT);
    S.port.cdb = [];
    S.cash += back;
    G.alert(S, tr(`O banco do seu CDB quebrou. O FGC devolveu ${money(back)}`, `The bank behind your CD failed. The FGC guarantee returned ${money(back)}`) +
      (v > FGC_LIMIT ? tr(`; você perdeu ${money(v - FGC_LIMIT)} acima do limite de R$ 250 mil.`, `; you lost ${money(v - FGC_LIMIT)} above the R$ 250k limit.`) : '.'), 'bad');
  }

  // Corretora de cripto quebra (estilo FTX): quem não tem autocustódia perde tudo que estava lá.
  function exchangeCollapse(S) {
    const P = G.portfolio, v = P.value(S, 'bitcoin') + P.value(S, 'altcoins');
    effect(S, 'bitcoin', -0.2, 5);
    effect(S, 'altcoins', -0.35, 5);
    if (G.politics.cryptoSafe(S)) return; // corretoras reguladas pelo marco legal
    if (v <= 0 || S.research.autocustodia) {
      G.news(tr('Uma grande corretora de cripto quebra e congela os saques dos clientes.', 'A major crypto exchange collapses and freezes customer withdrawals.') +
        (v > 0 ? tr(' Suas moedas estão na sua própria carteira: nada perdido.', ' Your coins are in your own wallet: nothing lost.') : ''), 'macro');
      return;
    }
    S.port.bitcoin = [];
    S.port.altcoins = [];
    G.alert(S, tr(`A corretora onde estavam suas criptos quebrou. Você perdeu ${money(v)}. Autocustódia teria evitado isso.`,
      `The exchange holding your crypto collapsed. You lost ${money(v)}. Self-custody would have prevented it.`), 'bad');
  }

  G.events = {
    SECTORS,
    // Chamado pelo macro quando o regime muda.
    onRegime(S, from, to) {
      if (to === 'recessao' && G.rng.chance(0.5)) {
        effect(S, 'mkt', -G.rng.range(0.15, 0.3), G.rng.int(4, 10));
        G.news(tr('CRASH: a bolsa derrete e o circuit breaker é acionado na B3.', 'CRASH: the market melts down and the B3 circuit breaker is triggered.'), 'bad');
      }
    },
    daily(S) {
      if (S.macro.regime === 'pico' && G.rng.chance(0.002)) {
        effect(S, 'mkt', -G.rng.range(0.06, 0.12), 5);
        G.news(tr('Correção: a bolsa cai forte depois de meses de euforia.', 'Correction: the market drops hard after months of euphoria.'), 'bad');
      }
    },
    monthly(S) {
      const m = S.macro;
      for (const id of SECTORS) {
        if (G.rng.chance(0.002)) {
          effect(S, id, -G.rng.range(0.2, 0.4), 3);
          G.news(tr(`Escândalo contábil numa gigante de ${G.ASSETS[id].short}: o setor desaba.`, `Accounting scandal at a ${G.ASSETS[id].short} giant: the sector collapses.`), 'bad');
        }
      }
      if (G.rng.chance(0.008)) {
        const up = G.rng.range(0.3, 0.6);
        effect(S, 'commodities', up, 60);
        effect(S, 'commodities', (1 + up * 0.4) / (1 + up) - 1, 120, 60); // devolve 60% da alta
        G.news(tr('Superciclo de commodities: a China volta a comprar tudo.', 'Commodity supercycle: China is buying everything again.'), 'good');
      }
      if (G.rng.chance(0.0015)) {
        effect(S, 'mkt', -0.3, 8);
        if (m.regime === 'expansao' || m.regime === 'pico') {
          m.regime = 'recessao';
          m.daysLeft = G.rng.int(270, 450);
          m.next = 'recuperacao';
        }
        G.news(tr('Cisne negro: uma pandemia global paralisa a economia.', 'Black swan: a global pandemic paralyzes the economy.'), 'bad');
      }
      if (G.rng.chance(m.regime === 'recessao' ? 0.005 : 0.001)) bankFailure(S);
      if (G.rng.chance(0.003)) exchangeCollapse(S);
      if (G.rng.chance(0.015)) {
        effect(S, 'altcoins', -G.rng.range(0.4, 0.7), 3);
        G.news(tr('Rug pull: uma altcoin famosa some com o dinheiro dos investidores.', 'Rug pull: a famous altcoin vanishes with investors\' money.'), 'bad');
      }
    },
  };
})();

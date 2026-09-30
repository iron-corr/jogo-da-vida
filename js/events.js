(function () {
  const G = globalThis.G = globalThis.G || {};

  const SECTORS = ['bancos', 'commodities', 'varejo', 'utilities', 'tech'];
  const FGC_LIMIT = 250000;
  const money = v => G.fmt.money(v);
  const effect = (...args) => G.market.addEffect(...args);

  function bankFailure(S) {
    const v = G.portfolio.value(S, 'cdb');
    if (v <= 0) {
      G.news('Banco médio sofre intervenção do Banco Central. Correntistas acionam o FGC.', 'macro');
      return;
    }
    const back = Math.min(v, FGC_LIMIT);
    S.port.cdb = [];
    S.cash += back;
    G.alert(S, `O banco do seu CDB quebrou. O FGC devolveu ${money(back)}` +
      (v > FGC_LIMIT ? `; você perdeu ${money(v - FGC_LIMIT)} acima do limite de R$ 250 mil.` : '.'), 'bad');
  }

  // Corretora de cripto quebra (estilo FTX): quem não tem autocustódia perde tudo que estava lá.
  function exchangeCollapse(S) {
    const P = G.portfolio, v = P.value(S, 'bitcoin') + P.value(S, 'altcoins');
    effect(S, 'bitcoin', -0.2, 5);
    effect(S, 'altcoins', -0.35, 5);
    if (G.politics.cryptoSafe(S)) return; // corretoras reguladas pelo marco legal
    if (v <= 0 || S.research.autocustodia) {
      G.news('Uma grande corretora de cripto quebra e congela os saques dos clientes.' +
        (v > 0 ? ' Suas moedas estão na sua própria carteira: nada perdido.' : ''), 'macro');
      return;
    }
    S.port.bitcoin = [];
    S.port.altcoins = [];
    G.alert(S, `A corretora onde estavam suas criptos quebrou. Você perdeu ${money(v)}. Autocustódia teria evitado isso.`, 'bad');
  }

  G.events = {
    SECTORS,
    // Chamado pelo macro quando o regime muda.
    onRegime(S, from, to) {
      if (to === 'recessao' && G.rng.chance(0.5)) {
        effect(S, 'mkt', -G.rng.range(0.15, 0.3), G.rng.int(4, 10));
        G.news('CRASH: a bolsa derrete e o circuit breaker é acionado na B3.', 'bad');
      }
    },
    daily(S) {
      if (S.macro.regime === 'pico' && G.rng.chance(0.002)) {
        effect(S, 'mkt', -G.rng.range(0.06, 0.12), 5);
        G.news('Correção: a bolsa cai forte depois de meses de euforia.', 'bad');
      }
    },
    monthly(S) {
      const m = S.macro;
      for (const id of SECTORS) {
        if (G.rng.chance(0.002)) {
          effect(S, id, -G.rng.range(0.2, 0.4), 3);
          G.news(`Escândalo contábil numa gigante de ${G.ASSETS[id].short}: o setor desaba.`, 'bad');
        }
      }
      if (G.rng.chance(0.008)) {
        const up = G.rng.range(0.3, 0.6);
        effect(S, 'commodities', up, 60);
        effect(S, 'commodities', (1 + up * 0.4) / (1 + up) - 1, 120, 60); // devolve 60% da alta
        G.news('Superciclo de commodities: a China volta a comprar tudo.', 'good');
      }
      if (G.rng.chance(0.0015)) {
        effect(S, 'mkt', -0.3, 8);
        if (m.regime === 'expansao' || m.regime === 'pico') {
          m.regime = 'recessao';
          m.daysLeft = G.rng.int(270, 450);
          m.next = 'recuperacao';
        }
        G.news('Cisne negro: uma pandemia global paralisa a economia.', 'bad');
      }
      if (G.rng.chance(m.regime === 'recessao' ? 0.005 : 0.001)) bankFailure(S);
      if (G.rng.chance(0.003)) exchangeCollapse(S);
      if (G.rng.chance(0.015)) {
        effect(S, 'altcoins', -G.rng.range(0.4, 0.7), 3);
        G.news('Rug pull: uma altcoin famosa some com o dinheiro dos investidores.', 'bad');
      }
    },
  };
})();

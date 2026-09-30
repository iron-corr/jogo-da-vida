(function () {
  const G = globalThis.G = globalThis.G || {};

  // Cadeia de Markov de regimes. Cada regime puxa Selic e inflação para um alvo;
  // a duração é sorteada ao entrar nele.
  const REGIMES = {
    expansao: {
      n: 'Expansão', selic: 0.105, infl: 0.045, dur: [720, 1800], next: { pico: 0.8, recessao: 0.2 }, layoff: 0.004,
      head: ['PIB cresce acima do esperado', 'Desemprego cai ao menor nível em anos', 'Crédito farto e confiança em alta'],
    },
    pico: {
      n: 'Pico', selic: 0.1375, infl: 0.075, dur: [180, 540], next: { recessao: 1 }, layoff: 0.005,
      head: ['Inflação estoura o teto da meta', '"Dessa vez é diferente", dizem analistas', 'Fila de IPOs na B3'],
    },
    recessao: {
      n: 'Recessão', selic: 0.085, infl: 0.05, dur: [270, 630], next: { recuperacao: 1 }, layoff: 0.03,
      head: ['PIB recua pelo segundo trimestre seguido', 'Onda de demissões atinge vários setores', 'Inadimplência dispara'],
    },
    recuperacao: {
      n: 'Recuperação', selic: 0.07, infl: 0.035, dur: [360, 900], next: { expansao: 1 }, layoff: 0.01,
      head: ['Economia dá sinais de melhora', 'Confiança do consumidor volta a subir', 'Indústria retoma contratações'],
    },
  };

  // Plataformas de governo (partidos fictícios), definidas nas eleições; ver politics.js.
  // weight = chance base de vencer; alpha = retorno extra (a.a.) por setor durante o mandato.
  const POLICIES = {
    moderado: { n: 'Moderado', selic: 0, infl: 0, weight: 0.45, alpha: {},
      d: 'Continuidade. Sem grandes mudanças.' },
    austero: { n: 'Austero', selic: -0.01, infl: -0.005, weight: 0.2, alpha: { bancos: 0.03, utilities: 0.02, varejo: -0.03 },
      d: 'Corte de gastos: juros e inflação menores, bancos e energia ganham, varejo sofre.' },
    expansionista: { n: 'Expansionista', selic: 0.015, infl: 0.015, weight: 0.25, alpha: { varejo: 0.05, commodities: 0.02, bancos: -0.02, imob: 0.02 },
      d: 'Gasto público e crédito farto: consumo e imóveis sobem, mas juros e inflação também.' },
    redistributivo: { n: 'Redistributivo', selic: 0.01, infl: 0.01, weight: 0.1, alpha: { bancos: -0.05, tech: -0.03, varejo: 0.03 },
      d: 'Imposto de 1% ao ano sobre fortunas acima de R$ 10 mi, 15% sobre todos os dividendos e revogação de isenções. Cresce quando os ricos têm má imagem.' },
  };

  // Indicadores: PMI antecipa a próxima fase, desemprego anda atrasado.
  const PMI = { expansao: 54, pico: 52, recessao: 44, recuperacao: 50.5 };
  const UNEMP = { expansao: 0.07, pico: 0.065, recessao: 0.11, recuperacao: 0.1 };
  const LEAD_DAYS = 120;
  const HINT_DAYS = 60;
  const HINTS = {
    expansao: 'a retomada vai virar crescimento de verdade',
    pico: 'a economia está superaquecendo, e isso não dura',
    recessao: 'as empresas estão cortando investimentos; vem recessão aí',
    recuperacao: 'o pior já passou; a economia vai voltar a respirar',
  };

  const COPOM_EVERY = 45;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function target(S) {
    const r = REGIMES[S.macro.regime], p = POLICIES[S.macro.policy];
    const bc = (S.pol && S.pol.bcBias) || 0; // diretor do BC: juros mais baixos agora, inflação depois
    return { selic: r.selic + p.selic + bc, infl: r.infl + p.infl - bc * 0.8 };
  }

  function copom(S) {
    const m = S.macro, t = target(S);
    const gap = t.selic - m.selic + (m.infl - t.infl) * 0.5;
    let move = 0;
    if (Math.abs(gap) >= 0.00125) move = Math.sign(gap) * Math.min(0.0075, Math.round(Math.abs(gap) / 0.0025) * 0.0025);
    const old = m.selic;
    m.selic = Math.max(0.02, Math.round((m.selic + move) / 0.0025) * 0.0025);
    m.nextCopom = S.day + COPOM_EVERY;
    m.selicHist.push(m.selic);
    if (m.selicHist.length > 120) m.selicHist.shift();
    const verb = m.selic > old + 1e-9 ? 'eleva' : m.selic < old - 1e-9 ? 'corta' : 'mantém';
    G.news(`Copom ${verb} a Selic ${verb === 'mantém' ? 'em' : 'para'} ${G.fmt.pct(m.selic)}.`, 'macro');
  }

  // Leitura (ruidosa) do regime. Sem pesquisa, o jogador não vê o ciclo.
  function perceive(S) {
    const acc = S.research.curva ? 0.85 : S.research.macro2 ? 0.6 : 0;
    if (!acc) return;
    const ids = Object.keys(REGIMES);
    S.macro.perceived = G.rng.chance(acc) ? S.macro.regime : G.rng.item(ids);
  }

  function indicators(S) {
    const m = S.macro;
    const w = m.daysLeft < LEAD_DAYS ? 1 - m.daysLeft / LEAD_DAYS : 0;
    m.pmi += (PMI[m.regime] * (1 - w) + PMI[m.next] * w - m.pmi) * 0.03;
    m.pmiNoise = 0.97 * m.pmiNoise + G.rng.normal() * 0.3;
    m.unemp += (UNEMP[m.regime] - m.unemp) * 0.004;
    m.focusNoise = 0.98 * m.focusNoise + G.rng.normal() * 0.0007;
  }

  // Divulgação mensal (é o que o jogador vê).
  function publish(S) {
    const m = S.macro, t = target(S);
    m.shown = {
      pmi: m.pmi + m.pmiNoise,
      unemp: m.unemp + G.rng.normal() * 0.002,
      focus: Math.round((t.selic + m.focusNoise) / 0.0025) * 0.0025,
    };
    m.pmiHist.push(m.shown.pmi);
    if (m.pmiHist.length > 60) m.pmiHist.shift();
  }

  G.macro = {
    REGIMES,
    PMI, UNEMP,
    initIndicators(S) {
      const m = S.macro;
      Object.assign(m, { next: G.rng.pick(REGIMES[m.regime].next), pmi: PMI[m.regime], pmiNoise: 0,
        unemp: UNEMP[m.regime], focusNoise: 0, pmiHist: [] });
      publish(S);
    },
    POLICIES,
    target,
    init(S) {
      S.macro = {
        regime: 'expansao', daysLeft: G.rng.int(400, 1200), selic: 0.105, infl: 0.045, priceIndex: 1,
        policy: 'moderado', nextCopom: COPOM_EVERY, selicHist: [0.105], perceived: null,
      };
      G.macro.initIndicators(S);
    },
    step(S) {
      const m = S.macro;
      if (--m.daysLeft <= 0) {
        const from = m.regime;
        m.regime = m.next;
        m.next = G.rng.pick(REGIMES[m.regime].next);
        const r = REGIMES[m.regime];
        m.daysLeft = G.rng.int(r.dur[0], r.dur[1]);
        G.news(`Manchete: "${G.rng.item(r.head)}"`, 'macro');
        G.events.onRegime(S, from, m.regime);
      }
      if (m.daysLeft === HINT_DAYS && S.research.networking) {
        const guess = G.rng.chance(0.7) ? m.next : G.rng.item(Object.keys(REGIMES).filter(k => k !== m.regime));
        G.news(`Seus contatos no mercado comentam: ${HINTS[guess]}.`, 'hint');
      }
      indicators(S);
      const t = target(S);
      m.infl = clamp(m.infl + (t.infl - m.infl) * 0.004 + G.rng.normal() * 0.0006, -0.02, 0.4);
      m.priceIndex *= Math.pow(1 + m.infl, 1 / 360);
      if (S.day >= m.nextCopom) copom(S);
    },
    monthly(S, c) {
      const m = S.macro;
      perceive(S);
      publish(S);
      // Manchetes soltas são um sinal fraco: 70% vêm do regime real.
      if (G.rng.chance(0.15)) {
        const r = G.rng.chance(0.7) ? REGIMES[m.regime] : REGIMES[G.rng.item(Object.keys(REGIMES))];
        G.news(`Manchete: "${G.rng.item(r.head)}"`, 'macro');
      }
      if (G.cal.isElectionYear(c.year)) {
        if (c.month === 8) G.news('Começa a campanha eleitoral. O mercado fica nervoso a cada pesquisa.', 'politica');
        if (c.month === 11) G.politics.runElection(S);
      }
    },
  };
})();

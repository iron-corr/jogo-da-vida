(function () {
  const G = globalThis.G = globalThis.G || {};

  // Legado: idade, sucessão, Pontos de Legado (PL), melhorias permanentes e conquistas.
  // O mundo (data, macro, mercado) continua entre gerações; o jogador recomeça como estagiário.
  const START_AGE = 22, HEIR_AGE = 60;
  const money = v => G.fmt.money(v);

  // Melhorias: custo em PL por nível.
  const UPGRADES = [
    { id: 'velocidade', n: 'Tempo é dinheiro', costs: [5, 30], d: l => `Libera a velocidade ${l >= 1 ? '5×' : '3×'} no topo da tela.`, now: true },
    { id: 'educacao', n: 'Educação de berço', costs: [5, 15, 40, 100], d: () => 'O herdeiro já nasce com mais pesquisas feitas.' },
    { id: 'heranca', n: 'Planejamento sucessório', costs: [10, 25, 60, 150, 400], d: () => 'O herdeiro recebe uma fatia maior do patrimônio (depois de 8% de ITCMD).' },
    { id: 'sobrenome', n: 'Sobrenome', costs: [8, 25, 70], d: () => 'O herdeiro herda parte do seu prestígio.' },
    { id: 'memoria', n: 'Memória de mercado', costs: [20, 60], d: () => 'O herdeiro já começa lendo o ciclo (PMI, leitura de ciclo, psicologia de mercado).' },
    { id: 'rede', n: 'Rede de contatos', costs: [15, 45], d: () => 'O herdeiro começa com +20 de reputação por nível e startups mais confiáveis.' },
    { id: 'family_office', n: 'Family office', costs: [30, 90, 250], d: () => 'Todo o IR pago cai 10% por nível. Vale já.', now: true },
    { id: 'longevidade', n: 'Medicina de ponta', costs: [10, 20, 40, 80, 160], d: () => '+3 anos de expectativa de vida por nível. Vale já.', now: true },
  ];
  const EDUCATION = [
    ['edu_fin', 'rotina', 'produtividade'],
    ['orcamento', 'macro1', 'rv1'],
    ['rf_avancada', 'aporte_auto', 'planilha', 'reserva'],
    ['cpa20', 'setores', 'negociacao'],
  ];
  const MEMORY = [['macro2', 'pmi'], ['sentimento', 'fundamentalista']];
  const HERITAGE = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  const SURNAME = [0, 0.2, 0.35, 0.5];

  const nw = S => G.portfolio.netWorth(S);
  const real = S => nw(S) / S.macro.priceIndex;
  const flag = (S, id) => !!(S.flags && S.flags[id]);

  // Conquistas: cada uma vale +3 PL, uma única vez na dinastia.
  const ACHIEVEMENTS = [
    { id: 'primeiro_invest', n: 'Primeiro passo', d: 'Investir pela primeira vez.', ok: S => G.portfolio.invested(S) > 0 },
    { id: 'colchao', n: 'Colchão', d: 'Ter 6 meses de gastos em reserva.', ok: S => G.work.reserveMonths(S) >= 6 },
    { id: 'milhao', n: 'Primeiro milhão', d: 'Patrimônio de R$ 1 milhão (em reais de 2026).', ok: S => real(S) >= 1e6 },
    { id: 'dez_mi', n: 'Dez milhões', d: 'Patrimônio de R$ 10 milhões (em reais de 2026).', ok: S => real(S) >= 1e7 },
    { id: 'cem_mi', n: 'Cem milhões', d: 'Patrimônio de R$ 100 milhões (em reais de 2026).', ok: S => real(S) >= 1e8 },
    { id: 'bilhao', n: 'Bilionário', d: 'Patrimônio de R$ 1 bilhão (em reais de 2026).', ok: S => real(S) >= 1e9 },
    { id: 'ceo', n: 'Topo da carreira', d: 'Chegar a CEO.', ok: S => S.job.level === G.work.CAREER.length - 1 },
    { id: 'fire', n: 'Livre', d: 'Pedir demissão para viver de renda.', ok: S => flag(S, 'fire') },
    { id: 'terra', n: 'Pé no chão', d: 'Comprar sua primeira terra.', ok: S => S.agro.lands.length > 0 },
    { id: 'safra', n: 'Safra recorde', d: 'Colher uma safra excelente.', ok: S => flag(S, 'safra') },
    { id: 'teto', n: 'Dono do teto', d: 'Ter um imóvel.', ok: S => S.realty.length > 0 },
    { id: 'quitado', n: 'Sem dívidas', d: 'Quitar um financiamento.', ok: S => flag(S, 'quitado') },
    { id: 'hodl', n: 'HODL', d: 'Ter Bitcoin valendo 5× o que pagou.', ok: S => { const c = G.portfolio.cost(S, 'bitcoin'); return c > 1000 && G.portfolio.value(S, 'bitcoin') >= 5 * c; } },
    { id: 'diamante', n: 'Mãos de diamante', d: 'Segurar firme num pânico do mercado.', ok: S => flag(S, 'diamante') },
    { id: 'fundo', n: 'Comprei na alta, vendi na baixa', d: 'Vender tudo num pânico.', ok: S => flag(S, 'fundo') },
    { id: 'unicornio', n: 'Caçador de unicórnios', d: 'Ter uma startup que vira unicórnio.', ok: S => flag(S, 'unicornio') },
    { id: 'empresario', n: 'Empresário', d: 'Ter 10 unidades de empresas.', ok: S => G.BUSINESSES.reduce((s, b) => s + G.business.count(S, b.id), 0) >= 10 },
    { id: 'asset', n: 'Asset manager', d: 'Ter R$ 1 bilhão sob gestão.', ok: S => !!S.fund && S.fund.aum >= 1e9 },
    { id: 'disciplina', n: 'Disciplinado', d: 'Ter 4 bons hábitos formados ao mesmo tempo.', ok: S => Object.keys(S.social.habits).filter(id => G.social.HABITS[id].good && G.social.has(S, id)).length >= 4 },
    { id: 'familia', n: 'Família', d: 'Casar e ter filhos.', ok: S => S.social.family.married && S.social.family.kids > 0 },
    { id: 'elite', n: 'Elite', d: 'Chegar à posição social Elite.', ok: S => G.social.tierIdx(S) >= 4 },
    { id: 'lenda', n: 'Lenda', d: 'Chegar à posição social Lenda.', ok: S => G.social.tierIdx(S) >= 5 },
    { id: 'lobby', n: 'Amigo do rei', d: 'Aprovar um projeto de lei.', ok: S => Object.keys(S.pol.passed).length > 0 },
    { id: 'escandalo', n: 'Sobrevivente', d: 'Passar por um escândalo.', ok: S => flag(S, 'escandalo') },
    { id: 'bc', n: 'Guardião da moeda', d: 'Ser diretor do Banco Central.', ok: S => !!S.pol.office && S.pol.office.id === 'bc' },
    { id: 'dinastia', n: 'Dinastia', d: 'Chegar à terceira geração.', ok: S => S.legacy.generation >= 3 },
    { id: 'mercado', n: 'Você é o mercado', d: 'Comprar a bolsa de valores.', ok: S => G.business.count(S, 'bolsa') > 0 },
    { id: 'vida_plena', n: 'Vida plena', d: 'Manter bem-estar médio de 75 por pelo menos 10 anos.', ok: S => S.life.wellN >= 120 && G.life.avgWell(S) >= 75 },
    { id: 'mundo', n: 'Cidadão do mundo', d: 'Visitar todos os destinos de férias.', ok: S => G.life.DESTINATIONS.every(d => S.life.bucket[d.id]) },
    { id: 'sabatico', n: 'Respirar', d: 'Tirar um ano sabático.', ok: S => S.job.lastSabbatical !== undefined && S.job.lastSabbatical !== null },
  ];

  const LG = G.legacy = {
    UPGRADES, ACHIEVEMENTS, HEIR_AGE,
    init: () => ({ lp: 0, up: {}, generation: 1, history: [], ach: {} }),
    level: (S, id) => S.legacy.up[id] || 0,
    age: S => START_AGE + (S.day - S.birthDay) / 360,
    rollLifespan: S => START_AGE + G.rng.int(56, 70),
    lifespan: S => S.lifespan + 3 * LG.level(S, 'longevidade'),
    health(S) {
      const left = LG.lifespan(S) - LG.age(S);
      return left > 15 ? 'ótima' : left > 8 ? 'boa' : left > 3 ? 'frágil' : 'por um fio';
    },
    taxMult: S => (S.legacy ? Math.pow(0.9, LG.level(S, 'family_office')) : 1),
    maxSpeed: S => [2, 3, 5][LG.level(S, 'velocidade')],
    flag(S, id) { (S.flags || (S.flags = {}))[id] = true; },

    upgradeCost(S, u) { return u.costs[LG.level(S, u.id)]; },
    buyUpgrade(S, id) {
      const u = UPGRADES.find(x => x.id === id), cost = u && LG.upgradeCost(S, u);
      if (!u || cost === undefined || S.legacy.lp < cost) return;
      S.legacy.lp -= cost;
      S.legacy.up[id] = LG.level(S, id) + 1;
      G.news(`Legado: ${u.n} (nível ${S.legacy.up[id]}).`, 'unlock');
    },

    // PL da geração: raiz do patrimônio real (R$ 1 mi → 3, 100 mi → 31, 1 bi → 100) + prestígio + bem-estar da vida.
    // Sem filhos, a fortuna vai para uma fundação e metade do legado se perde.
    points(S) {
      const base = Math.floor(Math.sqrt(Math.max(0, real(S)) / 1e5)) + Math.floor(S.social.prestige / 20) + G.life.wellPoints(S);
      return S.social.family.kids > 0 ? base : Math.floor(base / 2);
    },
    heirShare: S => HERITAGE[LG.level(S, 'heranca')],

    checkAchievements(S) {
      for (const a of ACHIEVEMENTS) {
        if (S.legacy.ach[a.id] !== undefined || !a.ok(S)) continue;
        S.legacy.ach[a.id] = S.day;
        S.legacy.lp += 3;
        S.tabs.legado = true;
        G.news(`Conquista: ${a.n}! +3 pontos de legado.`, 'unlock');
      }
    },

    // Passa o bastão: o herdeiro recomeça no mesmo mundo, com o que o legado permitir.
    succeed(S, reason) {
      const L = S.legacy, gained = LG.points(S), heirs = S.social.family.kids > 0;
      const inheritance = heirs ? Math.max(0, nw(S)) * LG.heirShare(S) * 0.92 : 0;
      L.lp += gained;
      L.history.push({
        gen: L.generation, from: G.cal.of(S.birthDay).year, to: G.cal.of(S.day).year, age: Math.floor(LG.age(S)),
        nw: real(S), lp: gained, reason,
      });
      const next = G.newState(S.rng);
      Object.assign(next, { day: S.day, macro: S.macro, market: S.market, rng: S.rng, birthDay: S.day, speed: S.speed });
      // O herdeiro mantém a estratégia e as preferências (alvos, robô, piloto, dicas...).
      next.auto = S.auto;
      next.routine = S.routine;
      next.settings = S.settings;
      next.legacy = L;
      L.generation++;
      next.lifespan = next.baseLifespan = LG.rollLifespan(next);
      next.job.wageIndex = S.macro.priceIndex;
      next.cash = 300 * S.macro.priceIndex + inheritance;
      next.social.prestige = S.social.prestige * SURNAME[LG.level(S, 'sobrenome')];
      next.pol.image = S.pol.image * 0.3;
      next.reputation = 20 * LG.level(S, 'rede');
      for (const list of EDUCATION.slice(0, LG.level(S, 'educacao'))) for (const id of list) next.research[id] = true;
      for (const list of MEMORY.slice(0, LG.level(S, 'memoria'))) for (const id of list) next.research[id] = true;
      next.tabs.legado = true;
      next.log = S.log.slice(0, 20);
      G.S = next;
      const why = reason === 'morte' ? `Você morreu aos ${Math.floor(LG.age(S))} anos.` : `Você se aposentou aos ${Math.floor(LG.age(S))} anos e passou o bastão.`;
      G.news(`${why} ${heirs ? `Seu herdeiro assume com ${money(inheritance)} de herança.` : 'Sem herdeiros, a fortuna foi para uma fundação.'} +${gained} pontos de legado. Começa a geração ${L.generation}.`, 'story');
      const got = ACHIEVEMENTS.filter(a => L.ach[a.id] !== undefined && L.ach[a.id] >= S.birthDay).map(a => a.n);
      G.popup(next, `Fim da ${L.generation - 1}ª geração`, [
        why,
        ['Anos', `${G.cal.of(S.birthDay).year}–${G.cal.of(S.day).year}`],
        ['Patrimônio final (R$ de 2026)', money(real(S))],
        ['Maior patrimônio', money(S.stats.peakNW || 0)],
        ['Pontos de legado ganhos', `+${gained}`],
        ['Herança', heirs ? money(inheritance) : 'nenhuma (sem filhos)'],
        ['Conquistas desta vida', got.length ? got.join(', ') : 'nenhuma'],
        `Começa a geração ${L.generation}: seu herdeiro tem 22 anos e começa como estagiário, no mesmo mundo.`,
      ]);
      if (G.ui && G.ui.reset) G.ui.reset();
      return next;
    },

    monthly(S, c) {
      LG.checkAchievements(S);
      if (c.month === 1) {
        if (S.social.stress > 70) S.lifespan -= 0.5;
        if (G.social.has(S, 'exercicio') && S.lifespan < S.baseLifespan + 5) S.lifespan += 0.2;
      }
      const left = LG.lifespan(S) - LG.age(S);
      if (left <= (S.life && S.life.health === 'premium' ? 6 : 3) && !flag(S, 'aviso')) { // premium: check-up antecipa o aviso
        LG.flag(S, 'aviso');
        G.alert(S, 'O médico foi direto: está na hora de pensar na sucessão.', 'bad');
      }
      if (left <= 0) LG.succeed(S, 'morte');
    },
  };
})();

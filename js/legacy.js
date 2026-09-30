(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  // Legado: idade, sucessão, Pontos de Legado (PL), melhorias permanentes e conquistas.
  // O mundo (data, macro, mercado) continua entre gerações; o jogador recomeça como estagiário.
  const START_AGE = 22, HEIR_AGE = 60;
  // Aposentar-se passa o bastão em vida: o herdeiro recebe metade da parte dele agora (doação, com ITCMD) e a outra
  // metade fica com a geração aposentada, rendendo 3% reais ao ano e pagando o custo de vida dela (60% do último);
  // quando ela morre, o que sobrou vira herança (de novo com ITCMD). Morrer em atividade passa tudo de uma vez.
  const ADVANCE = 0.5, ITCMD = 0.08, ELDER_REAL = 0.03, ELDER_COST = 0.6;
  const money = v => G.fmt.money(v);

  // Melhorias: custo em PL por nível.
  const UPGRADES = [
    { id: 'velocidade', n: tr('Tempo é dinheiro', 'Time is money'), costs: [5, 30],
      d: l => tr(`Libera a velocidade ${l >= 1 ? '5×' : '3×'} no topo da tela.`, `Unlocks ${l >= 1 ? '5×' : '3×'} speed at the top of the screen.`), now: true },
    { id: 'educacao', n: tr('Educação de berço', 'Born educated'), costs: [5, 15, 40, 100],
      d: () => tr('O herdeiro já nasce com mais pesquisas feitas.', 'The heir starts with more research already done.') },
    { id: 'heranca', n: tr('Planejamento sucessório', 'Estate planning'), costs: [10, 25, 60, 150, 400],
      d: () => tr('O herdeiro recebe uma fatia maior do patrimônio (depois de 8% de ITCMD).', 'The heir receives a larger share of the estate (after 8% inheritance tax).') },
    { id: 'sobrenome', n: tr('Sobrenome', 'Family name'), costs: [8, 25, 70], d: () => tr('O herdeiro herda parte do seu prestígio.', 'The heir inherits part of your prestige.') },
    { id: 'memoria', n: tr('Memória de mercado', 'Market memory'), costs: [20, 60],
      d: () => tr('O herdeiro já começa lendo o ciclo (PMI, leitura de ciclo, psicologia de mercado).', 'The heir starts out reading the cycle (PMI, cycle reading, market psychology).') },
    { id: 'rede', n: tr('Rede de contatos', 'Network'), costs: [15, 45],
      d: () => tr('O herdeiro começa com +20 de reputação por nível e startups mais confiáveis.', 'The heir starts with +20 reputation per level and more reliable startups.') },
    { id: 'family_office', n: 'Family office', costs: [30, 90, 250], d: () => tr('Todo o IR pago cai 10% por nível. Vale já.', 'All income tax paid drops 10% per level. Applies now.'), now: true },
    { id: 'longevidade', n: tr('Medicina de ponta', 'Cutting-edge medicine'), costs: [10, 20, 40, 80, 160],
      d: () => tr('+3 anos de expectativa de vida por nível. Vale já.', '+3 years of life expectancy per level. Applies now.'), now: true },
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
  const f1 = days => G.fmt.num(days / 360, 0);
  const real = S => nw(S) / S.macro.priceIndex;
  const flag = (S, id) => !!(S.flags && S.flags[id]);

  // Conquistas: cada uma vale +3 PL, uma única vez na dinastia.
  const ACHIEVEMENTS = [
    { id: 'primeiro_invest', n: tr('Primeiro passo', 'First step'), d: tr('Investir pela primeira vez.', 'Invest for the first time.'), ok: S => G.portfolio.invested(S) > 0 },
    { id: 'colchao', n: tr('Colchão', 'Cushion'), d: tr('Ter 6 meses de gastos em reserva.', 'Have 6 months of expenses in reserve.'), ok: S => G.work.reserveMonths(S) >= 6 },
    { id: 'milhao', n: tr('Primeiro milhão', 'First million'), d: tr('Patrimônio de R$ 1 milhão (em reais de 2026).', 'Net worth of R$ 1 million (in 2026 reais).'), ok: S => real(S) >= 1e6 },
    { id: 'dez_mi', n: tr('Dez milhões', 'Ten million'), d: tr('Patrimônio de R$ 10 milhões (em reais de 2026).', 'Net worth of R$ 10 million (in 2026 reais).'), ok: S => real(S) >= 1e7 },
    { id: 'cem_mi', n: tr('Cem milhões', 'A hundred million'), d: tr('Patrimônio de R$ 100 milhões (em reais de 2026).', 'Net worth of R$ 100 million (in 2026 reais).'), ok: S => real(S) >= 1e8 },
    { id: 'bilhao', n: tr('Bilionário', 'Billionaire'), d: tr('Patrimônio de R$ 1 bilhão (em reais de 2026).', 'Net worth of R$ 1 billion (in 2026 reais).'), ok: S => real(S) >= 1e9 },
    { id: 'ceo', n: tr('Topo da carreira', 'Top of the ladder'), d: tr('Chegar a CEO.', 'Become CEO.'), ok: S => S.job.level === G.work.CAREER.length - 1 },
    { id: 'fire', n: tr('Livre', 'Free'), d: tr('Pedir demissão para viver de renda.', 'Quit your job to live off your income.'), ok: S => flag(S, 'fire') },
    { id: 'terra', n: tr('Pé no chão', 'Down to earth'), d: tr('Comprar sua primeira terra.', 'Buy your first land.'), ok: S => S.agro.lands.length > 0 },
    { id: 'safra', n: tr('Safra recorde', 'Record harvest'), d: tr('Colher uma safra excelente.', 'Bring in an excellent harvest.'), ok: S => flag(S, 'safra') },
    { id: 'teto', n: tr('Dono do teto', 'A roof of your own'), d: tr('Ter um imóvel.', 'Own a property.'), ok: S => S.realty.length > 0 },
    { id: 'quitado', n: tr('Sem dívidas', 'Debt-free'), d: tr('Quitar um financiamento.', 'Pay off a loan.'), ok: S => flag(S, 'quitado') },
    { id: 'hodl', n: tr('HODL', 'HODL'), d: tr('Ter Bitcoin valendo 5× o que pagou.', 'Hold Bitcoin worth 5× what you paid.'), ok: S => { const c = G.portfolio.cost(S, 'bitcoin'); return c > 1000 && G.portfolio.value(S, 'bitcoin') >= 5 * c; } },
    { id: 'diamante', n: tr('Mãos de diamante', 'Diamond hands'), d: tr('Segurar firme num pânico do mercado.', 'Hold firm through a market panic.'), ok: S => flag(S, 'diamante') },
    { id: 'fundo', n: tr('Comprei na alta, vendi na baixa', 'Bought high, sold low'), d: tr('Vender tudo num pânico.', 'Sell everything in a panic.'), ok: S => flag(S, 'fundo') },
    { id: 'unicornio', n: tr('Caçador de unicórnios', 'Unicorn hunter'), d: tr('Ter uma startup que vira unicórnio.', 'Back a startup that becomes a unicorn.'), ok: S => flag(S, 'unicornio') },
    { id: 'empresario', n: tr('Empresário', 'Business owner'), d: tr('Ter 10 unidades de empresas.', 'Own 10 business units.'), ok: S => G.BUSINESSES.reduce((s, b) => s + G.business.count(S, b.id), 0) >= 10 },
    { id: 'asset', n: tr('Asset manager', 'Asset manager'), d: tr('Ter R$ 1 bilhão sob gestão.', 'Have R$ 1 billion under management.'), ok: S => !!S.fund && S.fund.aum >= 1e9 },
    { id: 'disciplina', n: tr('Disciplinado', 'Disciplined'), d: tr('Ter 4 bons hábitos formados ao mesmo tempo.', 'Have 4 good habits formed at the same time.'), ok: S => Object.keys(S.social.habits).filter(id => G.social.HABITS[id].good && G.social.has(S, id)).length >= 4 },
    { id: 'familia', n: tr('Família', 'Family'), d: tr('Casar e ter filhos.', 'Get married and have children.'), ok: S => S.social.family.married && S.social.family.kids > 0 },
    { id: 'elite', n: tr('Elite', 'Elite'), d: tr('Chegar à posição social Elite.', 'Reach the Elite social status.'), ok: S => G.social.tierIdx(S) >= 4 },
    { id: 'lenda', n: tr('Lenda', 'Legend'), d: tr('Chegar à posição social Lenda.', 'Reach the Legend social status.'), ok: S => G.social.tierIdx(S) >= 5 },
    { id: 'lobby', n: tr('Amigo do rei', 'Friend of the king'), d: tr('Aprovar um projeto de lei.', 'Get a bill passed.'), ok: S => Object.keys(S.pol.passed).length > 0 },
    { id: 'escandalo', n: tr('Sobrevivente', 'Survivor'), d: tr('Passar por um escândalo.', 'Survive a scandal.'), ok: S => flag(S, 'escandalo') },
    { id: 'bc', n: tr('Guardião da moeda', 'Guardian of the currency'), d: tr('Ser diretor do Banco Central.', 'Be a Central Bank director.'), ok: S => !!S.pol.office && S.pol.office.id === 'bc' },
    { id: 'dinastia', n: tr('Dinastia', 'Dynasty'), d: tr('Chegar à terceira geração.', 'Reach the third generation.'), ok: S => S.legacy.generation >= 3 },
    { id: 'mercado', n: tr('Você é o mercado', 'You are the market'), d: tr('Comprar a bolsa de valores.', 'Buy the stock exchange.'), ok: S => G.business.count(S, 'bolsa') > 0 },
    { id: 'vida_plena', n: tr('Vida plena', 'A full life'), d: tr('Manter bem-estar médio de 75 por pelo menos 10 anos.', 'Keep an average well-being of 75 for at least 10 years.'), ok: S => S.life.wellN >= 120 && G.life.avgWell(S) >= 75 },
    { id: 'mundo', n: tr('Cidadão do mundo', 'Citizen of the world'), d: tr('Visitar todos os destinos de férias.', 'Visit every vacation destination.'), ok: S => G.life.DESTINATIONS.every(d => S.life.bucket[d.id]) },
    { id: 'top10', n: tr('Na lista', 'On the list'), d: tr('Entrar no ranking das dez famílias mais ricas do país.', 'Break into the ranking of the country\'s ten richest families.'),
      ok: S => !!S.fam && G.families.myRank(S) <= 10 },
    { id: 'mais_rico', n: tr('Número um', 'Number one'), d: tr('Ser a família mais rica do país.', 'Be the richest family in the country.'), ok: S => !!S.fam && G.families.myRank(S) === 1 },
    { id: 'presidente', n: tr('Presidente', 'President'), d: tr('Ser eleito Presidente da República.', 'Be elected President of the Republic.'), ok: S => flag(S, 'presidente') },
    { id: 'superpotencia', n: tr('Superpotência', 'Superpower'), d: tr('Transformar o Brasil numa superpotência mundial.', 'Turn Brazil into a world superpower.'), ok: S => flag(S, 'superpotencia') },
    { id: 'sabatico', n: tr('Respirar', 'Breathe'), d: tr('Tirar um ano sabático.', 'Take a sabbatical year.'), ok: S => S.job.lastSabbatical !== undefined && S.job.lastSabbatical !== null },
  ];

  const LG = G.legacy = {
    UPGRADES, ACHIEVEMENTS, HEIR_AGE, ADVANCE,
    init: () => ({ lp: 0, up: {}, generation: 1, history: [], ach: {}, elders: [] }),
    level: (S, id) => S.legacy.up[id] || 0,
    age: S => START_AGE + (S.day - S.birthDay) / 360,
    rollLifespan: S => START_AGE + G.rng.int(56, 70),
    lifespan: S => S.lifespan + 3 * LG.level(S, 'longevidade'),
    health(S) {
      const left = LG.lifespan(S) - LG.age(S);
      return left > 15 ? tr('ótima', 'excellent') : left > 8 ? tr('boa', 'good') : left > 3 ? tr('frágil', 'frail') : tr('por um fio', 'hanging by a thread');
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
      G.news(tr(`Legado: ${u.n} (nível ${S.legacy.up[id]}).`, `Legacy: ${u.n} (level ${S.legacy.up[id]}).`), 'unlock');
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
        G.news(tr(`Conquista: ${a.n}! +3 pontos de legado.`, `Achievement: ${a.n}! +3 legacy points.`), 'unlock');
      }
    },

    // Passa o bastão: o herdeiro recomeça no mesmo mundo, com o que o legado permitir.
    // Quanto o herdeiro recebe agora e quanto fica com a geração que se aposenta.
    handover(S, reason) {
      if (S.social.family.kids <= 0) return { now: 0, kept: 0 };
      const part = Math.max(0, nw(S)) * LG.heirShare(S);
      return reason === 'morte' ? { now: part * (1 - ITCMD), kept: 0 } : { now: part * ADVANCE * (1 - ITCMD), kept: part * (1 - ADVANCE) };
    },
    elders: S => S.legacy.elders || (S.legacy.elders = []),
    succeed(S, reason) {
      const L = S.legacy, gained = LG.points(S), heirs = S.social.family.kids > 0;
      const hand = LG.handover(S, reason), inheritance = hand.now;
      if (hand.kept > 0) {
        LG.elders(S).push({
          gen: L.generation, age: LG.age(S), since: S.day, estate: hand.kept,
          dies: S.day + Math.max(30, Math.round((LG.lifespan(S) - LG.age(S)) * 360)),
          cost: (G.work.cost(S) / S.macro.priceIndex) * ELDER_COST,
        });
      }
      L.lp += gained;
      L.history.push({
        gen: L.generation, from: G.cal.of(S.birthDay).year, to: G.cal.of(S.day).year, age: Math.floor(LG.age(S)),
        nw: real(S), lp: gained, reason,
      });
      if (S.nation && S.nation.president) {
        G.nation.leave(S, reason === 'morte' ? tr('O presidente morreu; o vice assume.', 'The president died; the vice president takes over.')
          : tr('Você renunciou à Presidência para passar o bastão.', 'You resigned the Presidency to pass the torch.'));
      }
      if (S.nation) S.nation.campaign = null;
      const next = G.newState(S.rng);
      // O mundo continua: data, economia, mercado, famílias rivais e o país.
      Object.assign(next, { day: S.day, macro: S.macro, market: S.market, rng: S.rng, birthDay: S.day, speed: S.speed, fam: S.fam, nation: S.nation });
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
      const age = Math.floor(LG.age(S));
      const why = reason === 'morte' ? tr(`Você morreu aos ${age} anos.`, `You died at age ${age}.`)
        : tr(`Você se aposentou aos ${age} anos e passou o bastão.`, `You retired at age ${age} and passed the torch.`);
      const gift = hand.kept > 0;
      G.news(tr(`${why} ${heirs ? `Seu herdeiro assume com ${money(inheritance)} ${gift ? 'de doação em vida' : 'de herança'}.` : 'Sem herdeiros, a fortuna foi para uma fundação.'} +${gained} pontos de legado. Começa a geração ${L.generation}.`,
        `${why} ${heirs ? `Your heir takes over with ${money(inheritance)} ${gift ? 'as a lifetime gift' : 'in inheritance'}.` : 'With no heirs, the fortune went to a foundation.'} +${gained} legacy points. Generation ${L.generation} begins.`), 'story');
      const got = ACHIEVEMENTS.filter(a => L.ach[a.id] !== undefined && L.ach[a.id] >= S.birthDay).map(a => a.n);
      G.popup(next, tr(`Fim da ${L.generation - 1}ª geração`, `End of generation ${L.generation - 1}`), [
        why,
        [tr('Anos', 'Years'), `${G.cal.of(S.birthDay).year}–${G.cal.of(S.day).year}`],
        [tr('Patrimônio final (R$ de 2026)', 'Final net worth (2026 R$)'), money(real(S))],
        [tr('Maior patrimônio', 'Peak net worth'), money(S.stats.peakNW || 0)],
        [tr('Pontos de legado ganhos', 'Legacy points earned'), `+${gained}`],
        gift ? [tr('Doação em vida (agora)', 'Lifetime gift (now)'), money(inheritance)]
          : [tr('Herança', 'Inheritance'), heirs ? money(inheritance) : tr('nenhuma (sem filhos)', 'none (no children)')],
        ...(gift ? [[tr('Fica com a geração aposentada', 'Kept by the retired generation'), money(hand.kept)],
          tr('A geração aposentada vive disso até morrer; o que sobrar vira herança, menos 8% de ITCMD.',
            'The retired generation lives on it until death; whatever is left becomes an inheritance, minus 8% inheritance tax.')] : []),
        [tr('Conquistas desta vida', 'Achievements this life'), got.length ? got.join(', ') : tr('nenhuma', 'none')],
        tr(`Começa a geração ${L.generation}: seu herdeiro tem 22 anos e começa como estagiário, no mesmo mundo.`,
          `Generation ${L.generation} begins: your heir is 22 and starts as an intern, in the same world.`),
      ]);
      if (G.ui && G.ui.reset) G.ui.reset();
      return next;
    },

    // Gerações aposentadas: o patrimônio rende e paga o custo de vida; na morte, vira herança.
    eldersMonthly(S) {
      const list = LG.elders(S), pi = S.macro.priceIndex;
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        e.estate = Math.max(0, e.estate * Math.pow((1 + S.macro.infl) * (1 + ELDER_REAL), 1 / 12) - e.cost * pi);
        if (S.day < e.dies) continue;
        list.splice(i, 1);
        const age = Math.floor(e.age + (S.day - e.since) / 360), amount = e.estate * (1 - ITCMD);
        S.cash += amount;
        const h = S.legacy.history.find(x => x.gen === e.gen);
        if (h) h.died = age;
        G.news(tr(`A ${e.gen}ª geração morreu aos ${age} anos. Herança: ${money(amount)}, já descontados 8% de ITCMD.`,
          `Generation ${e.gen} died at age ${age}. Inheritance: ${money(amount)}, after 8% inheritance tax.`), 'story');
        G.popup(S, tr(`Morre a ${e.gen}ª geração`, `Generation ${e.gen} passes away`), [
          tr(`Depois de ${f1(S.day - e.since)} anos aposentada, a ${e.gen}ª geração morreu aos ${age} anos.`,
            `After ${f1(S.day - e.since)} years in retirement, generation ${e.gen} died at age ${age}.`),
          [tr('Herança recebida', 'Inheritance received'), money(amount)],
          [tr('ITCMD (8%)', 'Inheritance tax (8%)'), money(e.estate * ITCMD)],
        ]);
      }
    },

    monthly(S, c) {
      LG.checkAchievements(S);
      LG.eldersMonthly(S);
      if (c.month === 1) {
        if (S.social.stress > 70) S.lifespan -= 0.5;
        if (G.social.has(S, 'exercicio') && S.lifespan < S.baseLifespan + 5) S.lifespan += 0.2;
      }
      const left = LG.lifespan(S) - LG.age(S);
      if (left <= (S.life && S.life.health === 'premium' ? 6 : 3) && !flag(S, 'aviso')) { // premium: check-up antecipa o aviso
        LG.flag(S, 'aviso');
        G.alert(S, tr('O médico foi direto: está na hora de pensar na sucessão.', 'The doctor was blunt: it\'s time to think about succession.'), 'bad');
      }
      if (left <= 0) LG.succeed(S, 'morte');
    },
  };
})();

(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  // O país: PIB, dívida, índices de desenvolvimento, aprovação, governabilidade e poder no mundo.
  // Sem você na presidência, o governo eleito (IA) conduz o país pela plataforma dele. Se você vencer a eleição
  // presidencial (difícil), a aba Brasil libera o orçamento, a política fiscal, as reformas e a diplomacia.
  // O objetivo final: transformar o Brasil numa superpotência (poder ≥ 80 e top 3 do mundo).

  // Áreas do orçamento (em % do gasto discricionário). base = índice inicial; rate = velocidade de resposta.
  const AREAS = [
    { id: 'edu', n: tr('Educação', 'Education'), share: 18, base: 45, rate: 0.012 },
    { id: 'saude', n: tr('Saúde', 'Health'), share: 22, base: 50, rate: 0.03 },
    { id: 'infra', n: tr('Infraestrutura', 'Infrastructure'), share: 12, base: 40, rate: 0.025 },
    { id: 'seg', n: tr('Segurança', 'Public safety'), share: 10, base: 35, rate: 0.03 },
    { id: 'tech', n: tr('Ciência e tecnologia', 'Science and technology'), share: 5, base: 35, rate: 0.015 },
    { id: 'def', n: tr('Defesa', 'Defense'), share: 8, base: 40, rate: 0.02 },
    { id: 'social', n: tr('Assistência social', 'Social programs'), share: 20, base: 50, rate: 0.04 },
    { id: 'amb', n: tr('Meio ambiente', 'Environment'), share: 5, base: 55, rate: 0.02 },
  ];
  // Índices sem verba própria: instituições (reformas, corrupção) e diplomacia (cúpulas, acordos).
  const EXTRA = [
    { id: 'inst', n: tr('Instituições', 'Institutions'), base: 40 },
    { id: 'dipl', n: tr('Diplomacia', 'Diplomacy'), base: 50 },
  ];

  // Reformas: gov = governabilidade exigida e gasta; months = tramitação; efeitos permanentes ao aprovar.
  const REFORMS = [
    { id: 'previdencia', n: tr('Reforma da Previdência', 'Pension reform'), gov: 0.15, months: 8, primary: -0.01, approval: -0.08,
      d: tr('Déficit primário −1% do PIB para sempre. Impopular.', 'Primary deficit −1% of GDP for good. Unpopular.') },
    { id: 'tributaria', n: tr('Reforma tributária', 'Tax reform'), gov: 0.2, months: 10, growth: 0.004, idx: { inst: 5 },
      d: tr('Crescimento +0,4% ao ano e instituições +5.', 'Growth +0.4% a year and institutions +5.') },
    { id: 'administrativa', n: tr('Reforma administrativa', 'Civil service reform'), gov: 0.2, months: 8, primary: -0.005, approval: -0.05, idx: { inst: 8 },
      d: tr('Déficit −0,5% do PIB e instituições +8. Servidores protestam.', 'Deficit −0.5% of GDP and institutions +8. Civil servants protest.') },
    { id: 'abertura', n: tr('Abertura comercial', 'Trade opening'), gov: 0.15, months: 6, growth: 0.003, approval: -0.03, idx: { tech: 5, dipl: 5 },
      d: tr('Crescimento +0,3% ao ano, tecnologia e diplomacia +5. A indústria reclama.', 'Growth +0.3% a year, technology and diplomacy +5. Industry complains.') },
    { id: 'concessoes', n: tr('Concessões e saneamento', 'Concessions and sanitation'), gov: 0.1, months: 6, growth: 0.002, target: { infra: 10, saude: 3 },
      d: tr('Infraestrutura +10 no longo prazo, saúde +3, crescimento +0,2%.', 'Infrastructure +10 over time, health +3, growth +0.2%.') },
    { id: 'bc_autonomo', n: tr('Autonomia plena do Banco Central', 'Full Central Bank independence'), gov: 0.1, months: 4, infl: -0.005, idx: { inst: 4 },
      d: tr('Inflação −0,5 ponto e instituições +4. Você não pode mais pressionar o BC.', 'Inflation −0.5 point and institutions +4. You can no longer pressure the Central Bank.') },
    { id: 'anticorrupcao', n: tr('Pacote anticorrupção', 'Anti-corruption package'), gov: 0.25, months: 10, approval: 0.05, idx: { inst: 12 },
      d: tr('Instituições +12 e aprovação +5. O Congresso resiste.', 'Institutions +12 and approval +5. Congress resists.') },
    { id: 'educacao_integral', n: tr('Escola em tempo integral', 'Full-day schooling'), gov: 0.15, months: 8, primary: 0.004, target: { edu: 12 },
      d: tr('Educação +12 no longo prazo; custa 0,4% do PIB por ano.', 'Education +12 over time; costs 0.4% of GDP a year.') },
    { id: 'espacial', n: tr('Programa espacial e nuclear', 'Space and nuclear program'), gov: 0.15, months: 12, primary: 0.003, target: { tech: 8, def: 10 },
      d: tr('Tecnologia +8 e defesa +10 no longo prazo; custa 0,3% do PIB por ano.', 'Technology +8 and defense +10 over time; costs 0.3% of GDP a year.') },
    { id: 'mercosul_ue', n: tr('Acordo Mercosul–União Europeia', 'Mercosur–EU agreement'), gov: 0.1, months: 6, growth: 0.003, idx: { dipl: 10 },
      d: tr('Crescimento +0,3% ao ano e diplomacia +10.', 'Growth +0.3% a year and diplomacy +10.') },
  ];

  // Poder das outras nações (0 a 100) e quanto cada uma ganha por ano.
  const WORLD = [
    { id: 'eua', n: tr('Estados Unidos', 'United States'), p: 88, g: 0.05 },
    { id: 'china', n: 'China', p: 82, g: 0.2 },
    { id: 'alemanha', n: tr('Alemanha', 'Germany'), p: 64, g: 0 },
    { id: 'japao', n: tr('Japão', 'Japan'), p: 60, g: -0.05 },
    { id: 'reino_unido', n: tr('Reino Unido', 'United Kingdom'), p: 60, g: 0 },
    { id: 'franca', n: tr('França', 'France'), p: 59, g: 0 },
    { id: 'india', n: tr('Índia', 'India'), p: 55, g: 0.35 },
    { id: 'russia', n: tr('Rússia', 'Russia'), p: 52, g: -0.05 },
    { id: 'coreia', n: tr('Coreia do Sul', 'South Korea'), p: 51, g: 0.05 },
    { id: 'canada', n: tr('Canadá', 'Canada'), p: 49, g: 0.02 },
    { id: 'italia', n: tr('Itália', 'Italy'), p: 47, g: -0.03 },
    { id: 'australia', n: tr('Austrália', 'Australia'), p: 46, g: 0.03 },
    { id: 'arabia', n: tr('Arábia Saudita', 'Saudi Arabia'), p: 45, g: 0.05 },
  ];
  const SUPERPOWER = 80;

  // Plataforma do governo (IA ou sua): postura fiscal e peso da área social.
  const AI_STANCE = { austero: -1, moderado: 0, expansionista: 1, redistributivo: 1 };
  const REGIME_G = { expansao: 0.01, pico: 0.005, recessao: -0.03, recuperacao: 0.01 };
  const GDP0 = 12e12, POP = 213e6;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const money = v => G.fmt.money(v);
  const pi = S => S.macro.priceIndex;

  // Requisitos da candidatura presidencial (bem difícil de propósito).
  const REQ = { age: 35, tier: 4, inf: 400, image: 20 };
  const OFFICIAL_LIMIT = 150e6; // teto oficial de gasto de campanha (R$ de 2026); acima disso, caixa 2

  const defaultBudget = () => Object.fromEntries(AREAS.map(a => [a.id, a.share]));

  const N = G.nation = {
    AREAS, EXTRA, REFORMS, WORLD, SUPERPOWER, REQ, OFFICIAL_LIMIT,
    init() {
      const idx = {};
      for (const a of AREAS.concat(EXTRA)) idx[a.id] = a.base;
      return {
        gdpReal: GDP0, debt: 0.78, growth: 0.02, approval: 0.45, gov: 0.5, idx, bonus: {}, reforms: {}, pending: null,
        world: Object.fromEntries(WORLD.map(w => [w.id, w.p])), crisis: 0, lowMonths: 0, gdpHist: [], apprHist: [],
        president: null, campaign: null, budget: defaultBudget(), stance: 0, emendas: 1, bcPressure: false, dipCd: 0, unSeat: false, superpower: false,
      };
    },
    isPresident: S => !!(S.nation && S.nation.president),
    PAY: 46000, // salário do presidente (R$ de 2026)
    pay: S => (N.isPresident(S) ? N.PAY * pi(S) : 0),
    blind: S => N.isPresident(S),

    // ---------- números do país ----------
    reformSum(S, key) {
      let t = 0;
      for (const r of REFORMS) if (S.nation.reforms[r.id] && r[key]) t += r[key];
      return t;
    },
    budget: S => (N.isPresident(S) ? S.nation.budget : defaultBudget()),
    // Postura fiscal (−2 austeridade forte a +2 gasto forte). O governo da IA segue a plataforma e aperta com dívida alta.
    stance(S) {
      if (N.isPresident(S)) return S.nation.stance;
      return clamp((AI_STANCE[S.macro.policy] || 0) - Math.max(0, S.nation.debt - 0.8) * 8, -2, 2);
    },
    primary: S => 0.003 + 0.01 * N.stance(S) + N.reformSum(S, 'primary') + 0.002 * (N.isPresident(S) ? S.nation.emendas : 1) + 0.01 * S.nation.crisis,
    // Crescimento real anual: base + ciclo + índices + postura fiscal + reformas − dívida, inflação e crise.
    growthRate(S) {
      const n = S.nation, i = n.idx;
      return clamp(0.02 + REGIME_G[S.macro.regime]
        + 0.0003 * (i.infra - 40) + 0.0003 * (i.edu - 45) + 0.0003 * (i.tech - 35) + 0.0002 * (i.inst - 40) + 0.0001 * (i.seg - 35) + 0.0001 * (i.dipl - 50)
        + 0.004 * N.stance(S) + N.reformSum(S, 'growth')
        - Math.min(0.03, Math.max(0, n.debt - 1) * 0.03) - Math.max(0, S.macro.infl - 0.06) * 0.3 - 0.02 * n.crisis
        - 0.02 * Math.log(n.gdpReal / GDP0), -0.08, 0.12); // países mais ricos crescem mais devagar (convergência)
    },
    // Efeitos do país na economia do jogo: juros e inflação (ver macro.target), desemprego e bolsa.
    macroAdj(S) {
      const n = S.nation;
      if (!n) return { selic: 0, infl: 0 };
      const risk = Math.min(0.04, Math.max(0, n.debt - 1) * 0.1 + 0.03 * n.crisis);
      const press = N.isPresident(S) && n.bcPressure && !n.reforms.bc_autonomo ? 0.01 : 0;
      return { selic: risk - press, infl: 0.004 * N.stance(S) + Math.min(0.02, Math.max(0, n.debt - 1.1) * 0.02) + N.reformSum(S, 'infl') + press * 0.8 };
    },
    unempShift: S => (S.nation ? clamp((S.nation.growth - 0.02) * 0.6, -0.03, 0.03) : 0),
    DOMESTIC: ['ibov', 'bancos', 'commodities', 'varejo', 'utilities', 'tech', 'fii', 'imob', 'terra'],
    alpha: (S, id) => (S.nation && N.DOMESTIC.includes(id) ? clamp((S.nation.growth - 0.02) * 0.5, -0.03, 0.03) : 0),

    // Poder nacional (0 a 100): tamanho da economia, renda por habitante, índices e estabilidade.
    power(S) {
      const n = S.nation, i = n.idx;
      const size = clamp(100 * Math.log(n.gdpReal / 1e12) / Math.log(150), 0, 100);
      const perCap = clamp(100 * (n.gdpReal / POP) / 450000, 0, 100);
      const stab = 100 * (0.5 * n.approval + 0.5 * (1 - Math.min(1, n.debt / 1.5)));
      return 0.25 * size + 0.15 * perCap + 0.1 * i.edu + 0.12 * i.tech + 0.1 * i.def + 0.1 * i.dipl + 0.08 * i.inst + 0.05 * i.infra + 0.05 * stab
        + (n.unSeat ? 3 : 0);
    },
    worldRanking(S) {
      const rows = WORLD.map(w => ({ id: w.id, n: w.n, p: S.nation.world[w.id] }));
      rows.push({ id: 'brasil', n: tr('Brasil', 'Brazil'), p: N.power(S), you: true });
      return rows.sort((a, b) => b.p - a.p);
    },
    rank: S => N.worldRanking(S).findIndex(r => r.you) + 1,

    // ---------- candidatura ----------
    // Lista de requisitos: [{ ok, t }]
    requirements(S) {
      const pol = S.pol, lastScandal = pol.lastScandal ?? -1e9;
      return [
        { ok: G.legacy.age(S) >= REQ.age, t: tr(`ter ${REQ.age} anos ou mais`, `be ${REQ.age} or older`) },
        { ok: G.social.tierIdx(S) >= REQ.tier, t: tr(`posição social ${G.social.TIERS[REQ.tier][1]}`, `${G.social.TIERS[REQ.tier][1]} social status`) },
        { ok: pol.influence >= REQ.inf, t: tr(`${REQ.inf} de influência`, `${REQ.inf} influence`) },
        { ok: pol.image >= REQ.image, t: tr(`imagem pública de +${REQ.image} ou mais`, `public image of +${REQ.image} or more`) },
        { ok: !!S.research.presidencia, t: tr('pesquisa Carreira política', 'Political career research') },
        { ok: !!(S.flags && S.flags.cargo), t: tr('já ter ocupado um cargo público', 'have held a public office') },
        { ok: S.day - lastScandal >= 1440, t: tr('nenhum escândalo nos últimos 4 anos', 'no scandal in the last 4 years') },
      ];
    },
    // Janela: janeiro a julho do ano eleitoral (o registro das candidaturas é em agosto).
    window(S) {
      const c = G.cal.of(S.day);
      return G.cal.isElectionYear(c.year) && c.month <= 7;
    },
    reelection: S => N.isPresident(S) && S.nation.president.term === 1,
    canRun(S) {
      if (S.nation.campaign || !N.window(S)) return false;
      if (N.reelection(S)) return true;
      return !N.isPresident(S) && N.requirements(S).every(r => r.ok);
    },
    minBudget: S => 20e6 * pi(S),
    launch(S, platform, budget) {
      if (!N.canRun(S) || !G.macro.POLICIES[platform]) return;
      budget = Math.min(budget, S.cash);
      if (budget < N.minBudget(S) || S.pol.influence < 100) return;
      const re = N.reelection(S);
      if (re) platform = S.nation.president.platform;
      S.cash -= budget;
      G.social.spent(S, budget);
      S.pol.influence -= 100;
      const dirty = Math.max(0, budget - OFFICIAL_LIMIT * pi(S));
      if (dirty > 0) S.pol.dirty += dirty / (20e6 * pi(S));
      S.nation.campaign = { platform, budget, dirty, events: 0, re };
      G.alert(S, re
        ? tr(`Você lançou sua campanha à reeleição, com ${money(budget)}.`, `You launched your reelection campaign, with ${money(budget)}.`)
        : tr(`Você é candidato à Presidência da República pela plataforma ${G.macro.POLICIES[platform].n.toLowerCase()}, com ${money(budget)} de campanha${dirty > 0 ? ` (${money(dirty)} por fora)` : ''}.`,
          `You are running for President on the ${G.macro.POLICIES[platform].n} platform, with a ${money(budget)} campaign${dirty > 0 ? ` (${money(dirty)} off the books)` : ''}.`), 'politica');
    },
    // Força da candidatura (0 a 1) e a intenção de voto esperada.
    strength(S) {
      const c = S.nation.campaign, pol = S.pol, n = S.nation;
      if (!c) return 0;
      if (c.re) return clamp(n.approval, 0, 1); // reeleição: decide a aprovação do governo
      const img = (pol.image + 100) / 200;
      const inf = Math.min(1, Math.log10(1 + pol.influence) / 3);
      const tier = G.social.tierIdx(S) >= 5 ? 1 : 0.6;
      const cash = clamp(Math.log10(c.budget / (10e6 * pi(S))) / Math.log10(50), 0, 1);
      const media = pol.media.tv ? 1 : pol.media.portal ? 0.6 : pol.media.blog ? 0.2 : 0;
      const fams = S.fam ? clamp((G.families.allies(S).length - 0.5 * G.families.rivals(S).length) / 3, 0, 1) : 0;
      const incumbent = S.macro.policy === c.platform;
      const bad = S.macro.regime === 'recessao' || S.macro.regime === 'pico';
      const econ = incumbent ? (bad ? 0.2 : 0.8) : (bad ? 0.8 : 0.3);
      return 0.22 * img + 0.18 * inf + 0.14 * tier + 0.16 * cash + 0.1 * media + 0.1 * fams + 0.1 * econ;
    },
    expectedVote(S) {
      const c = S.nation.campaign;
      if (!c) return 0;
      if (c.re) return 0.1 + 0.8 * N.strength(S) + (c.bonus || 0);
      let v = 0.05 + 0.55 * N.strength(S) + (c.bonus || 0);
      if (S.fam) for (const f of G.families.rivals(S)) v -= f.media ? 0.03 : 0.02;
      return v;
    },
    // Chamado pela eleição (novembro do ano eleitoral). Devolve a plataforma vencedora se você concorreu.
    election(S) {
      const n = S.nation, c = n.campaign;
      if (!c) {
        if (N.isPresident(S)) N.leave(S, tr('Seu mandato terminou.', 'Your term is over.'));
        return null;
      }
      const vote = clamp(N.expectedVote(S) + G.rng.normal() * 0.06, 0.02, 0.9), strength = N.strength(S);
      n.campaign = null;
      if (vote > 0.5) {
        if (c.re) {
          n.president.term = 2;
          n.president.until = N.termEnd(S);
          G.alert(S, tr(`Reeleito com ${G.fmt.pct(vote, 1)} dos votos válidos no segundo turno! Mais quatro anos.`,
            `Reelected with ${G.fmt.pct(vote, 1)} of the valid votes in the runoff! Four more years.`), 'good');
        } else N.inaugurate(S, c.platform, vote);
        return c.platform;
      }
      G.alert(S, tr(`Derrota: você teve ${G.fmt.pct(vote, 1)} dos votos válidos no segundo turno.`, `Defeat: you got ${G.fmt.pct(vote, 1)} of the valid votes in the runoff.`), 'bad');
      G.popup(S, tr('Resultado da eleição presidencial', 'Presidential election result'), [
        [tr('Seus votos', 'Your votes'), G.fmt.pct(vote, 1)],
        [tr('Força da candidatura', 'Campaign strength'), G.fmt.pct(strength, 0)],
        c.re ? tr('Com aprovação baixa, a reeleição escapou.', 'With low approval, reelection slipped away.')
          : tr('Chegar à Presidência exige imagem, influência, dinheiro, mídia, famílias aliadas e o momento certo da economia.',
            'Reaching the Presidency takes image, influence, money, media, allied families and the right moment in the economy.'),
      ]);
      S.pol.influence *= 0.6;
      if (c.re) N.leave(S, tr('Você entregou a faixa ao sucessor.', 'You handed the sash to your successor.'));
      return null;
    },
    termEnd: S => (G.cal.of(S.day).year + 1 - G.cal.START_YEAR) * 360 + 4 * 360, // 1º de janeiro, 4 anos depois da posse
    inaugurate(S, platform, vote) {
      const n = S.nation;
      n.president = { since: S.day, until: N.termEnd(S), term: 1, platform };
      n.approval = Math.max(n.approval, 0.55);
      n.gov = Math.max(n.gov, 0.5);
      n.budget = defaultBudget();
      n.stance = AI_STANCE[platform] || 0;
      n.emendas = 1;
      if (S.pol.office) G.politics.leaveOffice(S);
      if (S.job.employed) G.work.loseJob(S);
      S.job.retired = true;
      G.legacy.flag(S, 'presidente');
      S.tabs.brasil = true;
      G.alert(S, tr(`VOCÊ É O NOVO PRESIDENTE DO BRASIL, eleito com ${G.fmt.pct(vote, 1)} dos votos válidos. Nova aba: Brasil.`,
        `YOU ARE THE NEW PRESIDENT OF BRAZIL, elected with ${G.fmt.pct(vote, 1)} of the valid votes. New tab: Brazil.`), 'story');
      G.popup(S, tr('Presidente da República', 'President of the Republic'), [
        tr('Você venceu a eleição mais difícil do país. A partir de agora, você conduz a nação.', 'You won the hardest election in the country. From now on, you lead the nation.'),
        [tr('Votos no segundo turno', 'Runoff votes'), G.fmt.pct(vote, 1)],
        [tr('Mandato', 'Term'), `${G.cal.of(S.day).year + 1}–${G.cal.of(S.day).year + 4}`],
        tr('Na aba Brasil: orçamento, política fiscal, reformas e diplomacia. Aprovação baixa e Congresso contra por meses seguidos terminam em impeachment. Seu patrimônio vai para um blind trust.',
          'In the Brazil tab: budget, fiscal policy, reforms and diplomacy. Low approval and a hostile Congress for months on end end in impeachment. Your assets go into a blind trust.'),
        tr(`Meta: poder nacional ${SUPERPOWER} e top 3 do mundo para o Brasil virar superpotência.`, `Goal: national power ${SUPERPOWER} and a world top 3 for Brazil to become a superpower.`),
      ]);
    },
    leave(S, why) {
      const n = S.nation;
      if (!n.president) return;
      n.president = null;
      n.pending = null;
      G.news(`${why} ${tr('O governo volta às mãos da plataforma eleita.', 'The government returns to the elected platform.')}`, 'politica');
    },

    // ---------- ações do presidente ----------
    setBudget(S, id, v) {
      if (!N.isPresident(S) || !(id in S.nation.budget)) return;
      S.nation.budget[id] = clamp(+v || 0, 0, 100);
    },
    shares(S) {
      const b = N.budget(S), total = Object.values(b).reduce((a, x) => a + x, 0) || 1;
      return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, (100 * v) / total]));
    },
    setStance(S, v) { if (N.isPresident(S)) S.nation.stance = clamp(Math.round(+v), -2, 2); },
    setEmendas(S, v) { if (N.isPresident(S)) S.nation.emendas = clamp(Math.round(+v), 0, 3); },
    setBC(S, on) { if (N.isPresident(S) && !S.nation.reforms.bc_autonomo) S.nation.bcPressure = !!on; },
    canReform: (S, r) => N.isPresident(S) && !S.nation.pending && !S.nation.reforms[r.id] && S.nation.gov >= r.gov,
    proposeReform(S, id) {
      const r = REFORMS.find(x => x.id === id);
      if (!r || !N.canReform(S, r)) return;
      S.nation.gov -= r.gov;
      S.nation.pending = { id, left: r.months };
      G.news(tr(`O governo enviou ao Congresso: ${r.n}.`, `The government sent to Congress: ${r.n}.`), 'politica');
    },
    canDiplomacy: S => N.isPresident(S) && S.day >= S.nation.dipCd,
    summit(S) {
      if (!N.canDiplomacy(S)) return;
      const n = S.nation;
      n.dipCd = S.day + 90;
      n.idx.dipl = Math.min(100, n.idx.dipl + 3);
      n.approval = Math.min(0.95, n.approval + 0.01);
      G.news(tr('Viagem de Estado: acordos assinados e fotos com líderes mundiais. Diplomacia +3.', 'State visit: agreements signed and photos with world leaders. Diplomacy +3.'), 'politica');
    },
    canUN: S => N.isPresident(S) && !S.nation.unSeat && S.nation.idx.dipl >= 80 && N.rank(S) <= 6,
    unSeat(S) {
      if (!N.canUN(S)) return;
      S.nation.unSeat = true;
      S.nation.idx.dipl = Math.min(100, S.nation.idx.dipl + 5);
      G.alert(S, tr('O Brasil conquista um assento permanente no Conselho de Segurança da ONU.', 'Brazil wins a permanent seat on the UN Security Council.'), 'good');
    },

    // ---------- mês ----------
    monthly(S, c) {
      const n = S.nation, m = S.macro, pres = N.isPresident(S);
      // Mundo
      for (const w of WORLD) n.world[w.id] = clamp(n.world[w.id] + w.g / 12 + G.rng.normal() * 0.05, 20, 100);
      // Índices: cada área persegue um alvo que depende da verba, da renda do país e das reformas.
      const sh = N.shares(S), rich = clamp((n.gdpReal / GDP0 - 1) * 10, -10, 10);
      for (const a of AREAS) {
        const target = clamp(a.base + (sh[a.id] - a.share) * 2.5 + rich + 3 * N.stance(S) + (n.bonus[a.id] || 0), 5, 100);
        n.idx[a.id] += (target - n.idx[a.id]) * a.rate;
      }
      // Instituições e diplomacia voltam devagar ao patamar que as reformas firmaram; emendas corroem as instituições.
      const instT = 40 + (n.bonus.inst || 0) - 5 * (pres ? n.emendas : 1), diplT = 50 + (n.bonus.dipl || 0) + (n.unSeat ? 10 : 0);
      n.idx.inst = clamp(n.idx.inst + (instT - n.idx.inst) * 0.01, 5, 100);
      n.idx.dipl = clamp(n.idx.dipl + (diplT - n.idx.dipl) * 0.005, 5, 100);
      if (pres) S.pol.dirty += 0.05 * n.emendas;

      // Economia
      n.growth = N.growthRate(S);
      n.gdpReal *= Math.pow(1 + n.growth, 1 / 12);
      // Dívida: custo médio de 70% da Selic (parte é prefixada ou atrelada à inflação) contra o crescimento nominal.
      const gNom = (1 + n.growth) * (1 + m.infl) - 1;
      n.debt = clamp(n.debt * (1 + (0.7 * m.selic - gNom) / 12) + N.primary(S) / 12, 0.1, 3);
      n.crisis *= 0.9;
      if (n.debt > 1.5 && G.rng.chance(0.05)) { // calote: a dívida é reestruturada com perdas para os credores
        n.debt *= 0.6;
        n.crisis = 1;
        n.bonus.inst = (n.bonus.inst || 0) - 10;
        n.approval -= 0.2;
        G.market.addEffect(S, 'mkt', -0.3, 10);
        G.alert(S, tr('CALOTE: o Brasil reestrutura a dívida pública. Credores perdem 40%, a bolsa desaba e as instituições saem abaladas.',
          'DEFAULT: Brazil restructures its public debt. Creditors lose 40%, the market crashes and institutions are shaken.'), 'bad');
      }
      if (n.debt > 1.2 && G.rng.chance(0.03)) {
        n.crisis = 1;
        G.market.addEffect(S, 'mkt', -0.2, 10);
        n.approval -= 0.15;
        G.alert(S, tr(`Crise da dívida: com a dívida pública em ${G.fmt.pct(n.debt, 0)} do PIB, o mercado entra em pânico. Juros e dólar disparam.`,
          `Debt crisis: with public debt at ${G.fmt.pct(n.debt, 0)} of GDP, markets panic. Rates and the dollar soar.`), 'bad');
      }

      // Aprovação e governabilidade
      const honey = pres && S.day - n.president.since < 180 ? 0.15 : 0;
      const fams = S.fam && pres ? 0.01 * G.families.allies(S).length - 0.02 * G.families.rivals(S).length : 0;
      const target = 0.4 + (n.growth - 0.02) * 5 - (m.shown.unemp - 0.08) * 3 - Math.max(0, m.infl - 0.045) * 4
        + (n.idx.saude - 50) * 0.003 + (n.idx.seg - 35) * 0.003 + (sh.social - 20) * 0.006 + honey + fams + (pres && S.pol.media.tv ? 0.03 : 0);
      n.approval = clamp(n.approval + (target - n.approval) * 0.15, 0.05, 0.95);
      const govT = 0.25 + 0.45 * n.approval + 0.1 * (pres ? n.emendas : 1) + (pres && S.fam ? 0.03 * G.families.allies(S).length : 0);
      n.gov = clamp(n.gov + (govT - n.gov) * 0.2, 0.05, 0.95);
      n.gdpHist.push(n.growth);
      n.apprHist.push(n.approval);
      if (n.gdpHist.length > 120) n.gdpHist.shift();
      if (n.apprHist.length > 120) n.apprHist.shift();

      // Governos da IA aprovam uma reforma de vez em quando.
      if (!pres && !n.pending && G.rng.chance(0.005)) {
        const left = REFORMS.filter(r => !n.reforms[r.id]);
        if (left.length) n.pending = { id: G.rng.item(left).id, left: 8 };
      }

      // Reforma em tramitação
      if (n.pending && --n.pending.left <= 0) {
        const r = REFORMS.find(x => x.id === n.pending.id);
        n.pending = null;
        if (G.rng.chance(clamp(n.gov + 0.3 + n.idx.inst / 400, 0.1, 0.95))) {
          n.reforms[r.id] = true;
          n.approval = clamp(n.approval + (r.approval || 0), 0.05, 0.95);
          for (const k in r.idx || {}) {
            n.idx[k] = clamp(n.idx[k] + r.idx[k], 5, 100);
            n.bonus[k] = (n.bonus[k] || 0) + r.idx[k];
          }
          for (const k in r.target || {}) n.bonus[k] = (n.bonus[k] || 0) + r.target[k];
          if (r.id === 'bc_autonomo') n.bcPressure = false;
          G.alert(S, tr(`O Congresso aprovou: ${r.n}.`, `Congress passed: ${r.n}.`), 'good');
        } else {
          n.gov = Math.max(0.05, n.gov - 0.05);
          G.alert(S, tr(`O Congresso derrubou: ${r.n}. Sua base saiu enfraquecida.`, `Congress voted down: ${r.n}. Your coalition came out weaker.`), 'bad');
        }
      }

      if (pres) {
        // Salário, influência e prestígio do cargo
        S.cash += N.pay(S);
        S.pol.influence += 15;
        G.social.gain(S, 1, 2);
        // Impeachment: aprovação e Congresso no chão por 6 meses seguidos
        n.lowMonths = n.approval < 0.2 && n.gov < 0.3 ? n.lowMonths + 1 : 0;
        if (n.lowMonths >= 6 && G.rng.chance(0.15)) {
          G.politics.addImage(S, -40);
          G.legacy.flag(S, 'escandalo');
          S.pol.lastScandal = S.day;
          N.leave(S, tr('IMPEACHMENT: o Congresso afastou você da Presidência.', 'IMPEACHMENT: Congress removed you from the Presidency.'));
          G.alert(S, tr('Você sofreu impeachment.', 'You were impeached.'), 'bad');
        } else if (S.day >= n.president.until && !n.campaign) {
          N.leave(S, tr('Seu mandato terminou.', 'Your term is over.'));
        }
      } else n.lowMonths = 0;

      // Campanha: eventos de agosto a outubro
      const camp = n.campaign;
      if (camp && c.month >= 8 && c.month <= 10 && G.rng.chance(0.5)) {
        const good = G.rng.chance(0.5), x = G.rng.range(0.01, 0.04);
        camp.bonus = (camp.bonus || 0) + (good ? x : -x);
        G.news(good
          ? tr(`Campanha: você foi bem no debate e subiu ${G.fmt.pct(x, 0)} nas pesquisas.`, `Campaign: you did well in the debate and rose ${G.fmt.pct(x, 0)} in the polls.`)
          : tr(`Campanha: uma gafe viralizou e você caiu ${G.fmt.pct(x, 0)} nas pesquisas.`, `Campaign: a gaffe went viral and you fell ${G.fmt.pct(x, 0)} in the polls.`), 'politica');
      }

      // Superpotência
      if (!n.superpower && N.power(S) >= SUPERPOWER && N.rank(S) <= 3) {
        n.superpower = true;
        G.legacy.flag(S, 'superpotencia');
        G.popup(S, tr('O Brasil é uma superpotência', 'Brazil is a superpower'), [
          tr(`Com poder nacional de ${G.fmt.num(N.power(S), 0)} e o ${N.rank(S)}º lugar no mundo, o Brasil passa a ser tratado como superpotência.`,
            `With national power of ${G.fmt.num(N.power(S), 0)} and number ${N.rank(S)} in the world, Brazil is now treated as a superpower.`),
        ]);
      }
    },
  };
})();

(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  // Próximos passos: um objetivo por eixo (carreira, patrimônio, família, poder, famílias, conquista) e avisos nas abas.
  // Lógica pura (sem tela), para dar para testar em node. Cada objetivo: { axis, text, tab }.
  const AXES = {
    carreira: tr('Carreira', 'Career'), patrimonio: tr('Patrimônio', 'Net worth'), familia: tr('Família', 'Family'),
    poder: tr('Poder', 'Power'), familias: tr('Famílias', 'Families'), conquista: tr('Conquista', 'Achievement'),
  };
  const WEALTH = [1e6, 1e7, 1e8, 1e9, 1e10, 1e11];
  const f = () => G.fmt;

  // Pesquisas que faltam para chegar a uma pesquisa (a própria e os pré-requisitos), das mais básicas às mais avançadas.
  function missingChain(S, id, out = []) {
    const r = G.research.byId(id);
    if (!r || S.research[id] || out.includes(id)) return out;
    for (const q of r.req || []) missingChain(S, q, out);
    out.push(id);
    return out;
  }

  function career(S) {
    const W = G.work, nx = W.nextLevel(S);
    if (!S.job.employed && !S.job.retired) {
      const block = W.searchBlock(S);
      return { text: block === 'cedo' ? tr(`procurar emprego a partir de ${f().date(W.hireFrom(S))}`, `look for a job from ${f().date(W.hireFrom(S))}`)
        : tr('procurar emprego', 'look for a job'), tab: 'trabalho' };
    }
    if (nx && S.job.employed) {
      if (W.canPromote(S)) return { text: tr(`promoção a ${nx.t} disponível!`, `promotion to ${nx.t} available!`), tab: 'trabalho' };
      const k = Math.max(0, nx.k - S.knowledge), r = Math.max(0, nx.rep - S.reputation);
      const lack = [k && f().num(k, 0) + tr(' de conhecimento', ' knowledge'), r && f().num(r, 0) + tr(' de reputação', ' reputation')].filter(Boolean).join(tr(' e ', ' and '));
      return { text: tr(`${nx.t}: faltam ${lack}`, `${nx.t}: ${lack} short`), tab: 'trabalho' };
    }
    if (S.research.fire && S.job.employed) {
      return { text: tr(`FIRE: ${f().pct(Math.max(0, G.portfolio.netWorth(S)) / W.fireNumber(S), 0)} do número`,
        `FIRE: ${f().pct(Math.max(0, G.portfolio.netWorth(S)) / W.fireNumber(S), 0)} of the number`), tab: 'trabalho' };
    }
    return null;
  }

  function wealth(S) {
    const real = G.portfolio.netWorth(S) / S.macro.priceIndex, next = WEALTH.find(x => real < x);
    if (!next) return null;
    return { text: tr(`${f().money(next)} em reais de 2026: ${f().pct(Math.max(0, real) / next, 0)}`, `${f().money(next)} in 2026 reais: ${f().pct(Math.max(0, real) / next, 0)}`),
      tab: S.tabs.investimentos ? 'investimentos' : 'trabalho' };
  }

  function family(S) {
    if (!S.tabs.vida) return null;
    const fam = S.social.family, D = G.dynasty;
    if (!fam.married) return { text: tr('casar (Vida → Família)', 'get married (Life → Family)'), tab: 'vida' };
    if (!fam.kids) {
      const st = G.social.kidState(S);
      return { text: st === 'pregnant' ? tr(`bebê a caminho: nasce em ${f().monthYear(fam.pregnant.due)}`, `baby on the way: due ${f().monthYear(fam.pregnant.due)}`)
        : st === 'trying' ? tr('tentando engravidar', 'trying for a baby') : tr('ter o primeiro filho (Vida → Família)', 'have your first child (Life → Family)'), tab: 'vida' };
    }
    const unfocused = D.children(S).find(c => D.age(S, c) < D.ADULT && !c.focus);
    if (unfocused) return { text: tr(`escolher o foco da educação de ${unfocused.name}`, `choose ${unfocused.name}'s education focus`), tab: 'dinastia' };
    if (!fam.heir) return { text: tr('escolher o herdeiro (aba Dinastia)', 'choose your heir (Dynasty tab)'), tab: 'dinastia' };
    const age = G.legacy.age(S);
    if (age < G.legacy.HEIR_AGE) return { text: tr(`passar o bastão a partir dos ${G.legacy.HEIR_AGE} anos (faltam ${Math.ceil(G.legacy.HEIR_AGE - age)})`,
      `pass the torch from age ${G.legacy.HEIR_AGE} (${Math.ceil(G.legacy.HEIR_AGE - age)} years to go)`), tab: 'dinastia' };
    return { text: tr('você já pode passar o bastão (aba Legado)', 'you can now pass the torch (Legacy tab)'), tab: 'legado' };
  }

  // O caminho até a Presidência e, depois, até a superpotência.
  function power(S) {
    const N = G.nation, n = S.nation, SO = G.social;
    if (!S.tabs.vida) return null;
    if (N.isPresident(S)) {
      return { text: tr(`superpotência: poder ${f().num(N.power(S), 0)} de ${N.SUPERPOWER}, ${N.rank(S)}º no mundo (precisa do top 3)`,
        `superpower: power ${f().num(N.power(S), 0)} of ${N.SUPERPOWER}, #${N.rank(S)} in the world (needs top 3)`), tab: 'brasil' };
    }
    if (n.campaign) return { text: tr(`campanha em curso: ~${f().pct(N.expectedVote(S), 0)} dos votos (eleição em novembro)`,
      `campaign under way: ~${f().pct(N.expectedVote(S), 0)} of the vote (election in November)`), tab: 'poder' };
    if (SO.tierIdx(S) < 2) return { text: tr(`chegar a ${SO.TIERS[2][1]} para abrir a aba Poder (${f().num(SO.score(S), 0)} de ${SO.TIERS[2][0]} pontos)`,
      `reach ${SO.TIERS[2][1]} to open the Power tab (${f().num(SO.score(S), 0)} of ${SO.TIERS[2][0]} points)`), tab: 'vida' };
    if (!(S.flags && S.flags.cargo)) {
      const o = G.politics.OFFICES[0];
      return { text: SO.tierIdx(S) < o.tier ? tr(`chegar a ${SO.TIERS[o.tier][1]} e ter ${o.inf} de influência para ocupar um cargo público`,
        `reach ${SO.TIERS[o.tier][1]} and ${o.inf} influence to hold a public office`)
        : S.pol.influence < o.inf ? tr(`juntar ${o.inf} de influência para um cargo público (${f().num(S.pol.influence, 0)} agora)`,
          `gather ${o.inf} influence for a public office (${f().num(S.pol.influence, 0)} now)`)
          : tr(`ocupar um cargo público: ${o.n}`, `hold a public office: ${o.n}`), tab: 'poder' };
    }
    const chain = missingChain(S, 'presidencia');
    if (chain.length) {
      const next = G.research.byId(chain.find(id => G.research.visible(S, G.research.byId(id))) || chain[0]);
      return { text: tr(`pesquisar ${next.n} (${chain.length} pesquisa(s) até Carreira política)`, `research ${next.n} (${chain.length} step(s) to Political career)`), tab: 'conhecimento' };
    }
    const miss = N.requirements(S).filter(r => !r.ok);
    if (miss.length) return { text: tr(`para a Presidência falta: ${miss.map(r => r.t).join('; ')}`, `for the Presidency you still need: ${miss.map(r => r.t).join('; ')}`), tab: 'poder' };
    if (!N.window(S)) return { text: tr(`candidatura de janeiro a julho de ${G.cal.nextElection(S.day)}`, `candidacy from January to July of ${G.cal.nextElection(S.day)}`), tab: 'poder' };
    return { text: tr('lançar a candidatura à Presidência (aba Poder)!', 'launch your presidential candidacy (Power tab)!'), tab: 'poder' };
  }

  function families(S) {
    if (!S.fam || !S.fam.noticed) return null;
    const FM = G.families, rank = FM.ranking(S), me = FM.myRank(S);
    if (me === 1) return { text: tr('sua família é a mais rica do país', 'your family is the richest in the country'), tab: 'familias' };
    const above = rank[me - 2], mine = rank[me - 1];
    return { text: tr(`${me}º no ranking: faltam ${f().money(above.w - mine.w)} para passar a família ${above.n}`,
      `#${me} in the ranking: ${f().money(above.w - mine.w)} to overtake the ${above.n} family`), tab: 'familias' };
  }

  function achievement(S) {
    const a = G.legacy.ACHIEVEMENTS.find(x => S.legacy.ach[x.id] === undefined);
    return a ? { text: `${a.n}: ${a.d.charAt(0).toLowerCase() + a.d.slice(1)}`, tab: 'legado' } : null;
  }

  const GO = G.goals = {
    AXES,
    missingChain,
    list(S) {
      const out = [];
      const add = (axis, g) => { if (g) out.push({ axis, text: g.text, tab: g.tab }); };
      add('carreira', career(S));
      add('patrimonio', wealth(S));
      add('familia', family(S));
      add('poder', power(S));
      add('familias', families(S));
      add('conquista', achievement(S));
      return out;
    },

    // Avisos nas abas: só coisas que dá para fazer agora. { aba: [motivos] }
    badges(S) {
      const b = {}, W = G.work, N = G.nation, D = G.dynasty;
      const add = (tab, why) => { if (S.tabs[tab]) (b[tab] || (b[tab] = [])).push(why); };
      if (W.canPromote(S)) add('trabalho', tr('dá para pedir promoção', 'you can ask for a promotion'));
      if (!S.job.employed && !S.job.retired && !W.searchBlock(S)) add('trabalho', tr('dá para procurar emprego', 'you can look for a job'));
      if (G.RESEARCH.some(r => G.research.visible(S, r) && G.research.affordable(S, r))) add('conhecimento', tr('há pesquisa ao seu alcance', 'there is research you can afford'));
      if (N.canRun(S)) add('poder', tr('candidatura à Presidência aberta', 'presidential candidacy open'));
      if (G.politics.OFFICES.some(o => G.politics.canTakeOffice(S, o))) add('poder', tr('há cargo público disponível', 'a public office is available'));
      if (N.isPresident(S)) {
        if (N.REFORMS.some(r => N.canReform(S, r))) add('brasil', tr('dá para enviar uma reforma', 'you can send a reform'));
        if (N.canDiplomacy(S)) add('brasil', tr('viagem de Estado disponível', 'state visit available'));
      }
      const kids = D.children(S);
      if (kids.some(c => c.bond < 30)) add('dinastia', tr('um filho anda distante de você', 'a child is drifting away from you'));
      if (kids.length && !S.social.family.heir && G.legacy.age(S) >= 50) add('dinastia', tr('escolha o herdeiro', 'choose your heir'));
      if (S.fam) {
        if (S.fam.priceWar && S.day < S.fam.priceWar.until) add('familias', tr('guerra de preços contra você', 'a price war against you'));
        if (G.families.FAMILIES.some(fm => G.families.canAlly(S, fm))) add('familias', tr('uma família aceita aliança', 'a family would accept an alliance'));
      }
      if (G.legacy.UPGRADES.some(u => { const c = G.legacy.upgradeCost(S, u); return c !== undefined && S.legacy.lp >= c; })) {
        add('legado', tr('melhoria permanente ao seu alcance', 'a permanent upgrade you can afford'));
      }
      if (S.social.family.kids && G.legacy.age(S) >= G.legacy.HEIR_AGE) add('legado', tr('dá para passar o bastão', 'you can pass the torch'));
      const c = G.cal.of(S.day);
      if (c.month >= 7 && S.life.vacYear !== c.year && !G.life.away(S)) add('lazer', tr('você ainda não tirou férias este ano', 'you haven\'t taken a vacation this year'));
      return b;
    },
  };
})();

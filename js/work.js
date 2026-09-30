(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  // sal em R$ de 2026; corrigido pelo dissídio (wageIndex). k = conhecimento gasto, rep = reputação exigida.
  const CAREER = [
    { t: tr('Estagiário', 'Intern'), sal: 1800, k: 0, rep: 0 },
    { t: tr('Assistente', 'Assistant'), sal: 2800, k: 15, rep: 3 },
    { t: tr('Analista Júnior', 'Junior Analyst'), sal: 4200, k: 40, rep: 8 },
    { t: tr('Analista Pleno', 'Analyst'), sal: 6500, k: 90, rep: 18 },
    { t: tr('Analista Sênior', 'Senior Analyst'), sal: 9800, k: 180, rep: 30 },
    { t: tr('Coordenador', 'Coordinator'), sal: 15000, k: 350, rep: 48 },
    { t: tr('Gerente', 'Manager'), sal: 24000, k: 650, rep: 70 },
    { t: tr('Diretor', 'Director'), sal: 42000, k: 1200, rep: 100 },
    { t: tr('Vice-presidente', 'Vice President'), sal: 75000, k: 2200, rep: 140 },
    { t: tr('CEO', 'CEO'), sal: 130000, k: 4000, rep: 200 },
  ];

  const LIFESTYLE = [
    // people = quantas pessoas cabem (você, cônjuge e filhos).
    { n: tr('Quarto dividido', 'Shared room'), cost: 1200, emax: 100, regen: 25, people: 1 },
    { n: tr('Kitnet', 'Studio apartment'), cost: 2200, emax: 120, regen: 30, people: 2 },
    { n: tr('Apartamento 1 quarto', '1-bedroom apartment'), cost: 3800, emax: 140, regen: 36, people: 3 },
    { n: tr('Apartamento 2 quartos + carro', '2-bedroom apartment + car'), cost: 7000, emax: 170, regen: 44, people: 4 },
    { n: tr('Casa em condomínio', 'House in a gated community'), cost: 14000, emax: 210, regen: 54, people: 6 },
    { n: tr('Cobertura', 'Penthouse'), cost: 30000, emax: 260, regen: 66, people: 10 },
  ];

  // Ordem de venda automática quando o caixa fica negativo: liquidez primeiro, risco por último.
  const SETTLE_ORDER = ['poupanca', 'tesouro_selic', 'cdb', 'prefixado', 'ipca', 'fii', 'ibov', 'sp500', 'ouro',
    'utilities', 'bancos', 'commodities', 'varejo', 'tech', 'bitcoin', 'altcoins'];
  const OT_COST = 20, STUDY_COST = 15, SEARCH_COST = 20, BURNOUT_DAYS = 5;
  // Recolocação: processos seletivos levam no mínimo um mês; depois, uma rodada de currículos por dia,
  // com um quarto da chance antiga (em média, de algumas semanas a alguns meses a mais).
  const MIN_JOBLESS = 30;
  const money = v => G.fmt.money(v);

  const W = G.work = {
    CAREER, LIFESTYLE, OT_COST, STUDY_COST, SEARCH_COST, MIN_JOBLESS,
    // Trilha da carreira: corporativo (padrão), startup (salário menor + participação) ou academia (professor).
    TRACKS: { corporativo: { n: tr('Corporativo', 'Corporate'), sal: 1 }, startup: { n: 'Startup', sal: 0.6 }, academia: { n: tr('Professor universitário', 'University professor'), sal: 0.5 } },
    trackMult: S => W.TRACKS[S.job.track || 'corporativo'].sal,
    salaryMult: S => (S.research.negociacao ? 1.1 : 1) * (S.research.mba ? 1.1 : 1) * (S.research.cfa ? 1.15 : 1)
      * (S.job.bonus || 1) * W.trackMult(S) * G.life.salaryMult(S),
    salary: S => CAREER[S.job.level].sal * S.job.wageIndex * W.salaryMult(S),
    // costMult não inclui a casa própria: rentCost é o custo de vida pagando aluguel; cost já desconta a moradia
    // quando você mora num imóvel seu grande o bastante (ver life.homeMult).
    costMult: S => (S.research.orcamento ? 0.95 : 1) * (S.research.minimalismo ? 0.9 : 1) * G.social.costMult(S) * G.life.costMult(S),
    rentCost: S => LIFESTYLE[S.lifestyle].cost * S.macro.priceIndex * W.costMult(S),
    cost: S => W.rentCost(S) * G.life.homeMult(S),
    emax: S => LIFESTYLE[S.lifestyle].emax + (S.research.saude ? 15 : 0) + G.social.emaxAdd(S) - G.life.ageDrain(S),
    regen: S => (LIFESTYLE[S.lifestyle].regen + G.social.regenAdd(S)) * G.social.regenMult(S),
    otGain: S => W.salary(S) / 100,
    studyGain: S => (S.research.produtividade ? 1.5 : 1),
    studyCost: S => (S.research.foco ? 10 : STUDY_COST),
    knowledgeRate: S => (S.research.leitura ? 0.25 : 0) + (S.research.cfa ? 0.5 : 0) + G.social.knowledgeAdd(S)
      + (S.job.employed && S.job.track === 'academia' ? 0.5 : 0),
    repGain: S => 1 + (S.research.cpa20 ? 0.5 : 0) + (S.research.mba ? 0.5 : 0),
    // Meses de gastos cobertos pelo que dá para sacar hoje.
    reserveMonths(S) {
      const P = G.portfolio;
      return (S.cash + P.value(S, 'poupanca') + P.value(S, 'tesouro_selic')) / W.outflow(S);
    },
    canAct: (S, cost) => S.burnout <= 0 && S.energy >= cost && !G.life.away(S),
    nextLevel: S => CAREER[S.job.level + 1],
    canPromote(S) {
      const n = W.nextLevel(S);
      return !!n && S.job.employed && S.knowledge >= n.k && S.reputation >= n.rep;
    },
    moveCost: (S, i) => (i > S.lifestyle ? 2 * LIFESTYLE[i].cost * S.macro.priceIndex : 0),
    // Quantas pessoas cabem onde você mora: a casa própria (se for residencial) ou o padrão de vida alugado.
    capacity(S) {
      const h = G.life.home(S), p = h && G.realty.prop(h.pid);
      return p && p.people ? p.people : LIFESTYLE[S.lifestyle].people;
    },
    // Pessoas a mais do que cabem (0 = cabe todo mundo). Aperto dá stress e derruba o bem-estar.
    crowded: S => Math.max(0, G.social.familySize(S) - W.capacity(S)),
    fits: (S, i) => LIFESTYLE[i].people >= G.social.familySize(S),
    // Avisa quando a família cresce e deixa de caber (chamado no casamento e no nascimento).
    checkRoom(S) {
      if (!W.crowded(S)) return;
      G.news(tr(`A casa ficou apertada: ${G.social.familySize(S)} pessoas onde cabem ${W.capacity(S)}. Hora de mudar (Trabalho → Estilo de vida).`,
        `Home is getting cramped: ${G.social.familySize(S)} people where ${W.capacity(S)} fit. Time to move (Work → Lifestyle).`), 'bad');
    },

    // Gastar energia com o tanque baixo arrisca burnout.
    spend(S, cost) {
      S.energy -= cost;
      if (S.energy < W.emax(S) * 0.25 && G.rng.chance((S.research.saude ? 0.04 : 0.08) * G.social.burnoutMult(S))) {
        S.burnout = BURNOUT_DAYS;
        G.news(tr(`Burnout. Você vai precisar de ${BURNOUT_DAYS} dias de descanso.`, `Burnout. You'll need ${BURNOUT_DAYS} days of rest.`), 'bad');
      }
    },
    overtime(S) {
      if (!S.job.employed || S.job.sabbatical || !W.canAct(S, OT_COST)) return;
      W.spend(S, OT_COST);
      const g = W.otGain(S);
      S.cash += g;
      S.stats.workIncome += g;
    },
    study(S) {
      if (!W.canAct(S, W.studyCost(S))) return;
      W.spend(S, W.studyCost(S));
      S.knowledge += W.studyGain(S);
    },
    // Primeiro dia em que uma contratação é possível, contado de quando o emprego acabou.
    hireFrom: S => (S.job.lostAt || 0) + MIN_JOBLESS,
    // '' se dá para procurar emprego hoje; senão o motivo ('cedo' ou 'hoje').
    searchBlock: S => (S.day < W.hireFrom(S) ? 'cedo' : S.job.searchDay === S.day ? 'hoje' : ''),
    loseJob(S) {
      Object.assign(S.job, { employed: false, jobless: 0, lostAt: S.day });
    },
    search(S) {
      if (S.job.employed || W.searchBlock(S) || !W.canAct(S, SEARCH_COST)) return;
      W.spend(S, SEARCH_COST);
      S.job.searchDay = S.day;
      let p = Math.min(0.5, 0.1 + 0.005 * S.reputation);
      if (S.macro.regime === 'recessao') p /= 2;
      if (S.research.reserva && W.reserveMonths(S) >= 3) p *= 1.5;
      p += 0.03 * G.social.tierIdx(S);
      if (G.rng.chance(p / 4)) {
        Object.assign(S.job, { employed: true, jobless: 0, retired: false, since: S.day, bonus: 1, track: 'corporativo' });
        G.news(tr(`Contratado de novo como ${CAREER[S.job.level].t}.`, `Hired again as ${CAREER[S.job.level].t}.`), 'good');
      }
    },
    // Renda que entra sem trabalhar: juros, dividendos, aluguéis, empresas e gestora.
    passiveIncome(S) {
      const re = G.realty.monthlyNet(S);
      return G.portfolio.monthlyYield(S) + re.rent - re.pmt - re.upkeep + G.business.monthlyProfit(S) - G.business.monthlyPayments(S) + G.agro.monthlyExpected(S) + (S.fund ? S.fund.lastProfit : 0);
    },
    fireNumber: S => 25 * 12 * W.cost(S),
    canRetire: S => !!S.research.fire && S.job.employed && W.passiveIncome(S) >= W.cost(S),
    retire(S) {
      if (!W.canRetire(S)) return;
      W.loseJob(S);
      S.job.retired = true;
      G.legacy.flag(S, 'fire');
      G.news(tr('Você pediu demissão para viver de renda. Seu tempo agora é seu.', 'You quit to live off your income. Your time is now your own.'), 'story');
    },
    promote(S) {
      if (!W.canPromote(S)) return;
      const n = W.nextLevel(S);
      S.knowledge -= n.k;
      S.job.level++;
      G.social.gain(S, 1, 2 * S.job.level);
      G.news(tr(`Promovido a ${n.t}! Novo salário: ${money(W.salary(S))}.`, `Promoted to ${n.t}! New salary: ${money(W.salary(S))}.`), 'good');
    },
    // Ano sabático: 12 meses sem salário, mantendo o cargo. Só com 5 anos na mesma empresa, uma vez a cada 7 anos.
    canSabbatical: S => S.job.employed && !S.job.sabbatical && S.day - (S.job.since || 0) >= 1800
      && S.day - (S.job.lastSabbatical ?? -1e9) >= 2520,
    sabbatical(S) {
      if (!W.canSabbatical(S)) return;
      S.job.sabbatical = S.day + 360;
      S.job.lastSabbatical = S.day;
      S.knowledge += 30;
      S.social.stress = 0;
      G.news(tr('Ano sabático: um ano inteiro para estudar, viajar e respirar. O cargo te espera.',
        'Sabbatical: a whole year to study, travel and breathe. Your job will be waiting.'), 'story');
    },

    setLifestyle(S, i) {
      if (i === S.lifestyle || !LIFESTYLE[i]) return;
      if (i < S.lifestyle && !W.fits(S, i)) return; // não dá para reduzir para onde a família não cabe
      const c = W.moveCost(S, i);
      if (S.cash < c) return;
      S.cash -= c;
      G.social.spent(S, c);
      S.lifestyle = i;
      S.energy = Math.min(S.energy, W.emax(S));
      G.news(tr(`Mudança: agora você mora em ${LIFESTYLE[i].n.toLowerCase()}.`, `Moving day: you now live in a ${LIFESTYLE[i].n.toLowerCase()}.`), 'story');
    },

    ROUTINES: {
      off: tr('Desligado', 'Off'),
      estudar: tr('Estudar', 'Study'),
      hora_extra: tr('Hora extra', 'Overtime'),
      misto: tr('Metade estudo, metade hora extra', 'Half study, half overtime'),
    },
    // Piloto automático: gasta a energia do dia mantendo 25% de reserva (abaixo disso há risco de burnout).
    // Desempregado (sem ter se aposentado), procura emprego antes de qualquer outra coisa.
    autopilot(S) {
      const mode = S.routine;
      if (!S.research.rotina || !mode || mode === 'off' || S.burnout > 0 || G.life.away(S)) return;
      const floor = W.emax(S) * 0.25;
      for (let turn = 0; turn < 50; turn++) {
        const jobless = !S.job.employed && !S.job.retired && !W.searchBlock(S);
        const study = !jobless && (!S.job.employed || mode === 'estudar' || (mode === 'misto' && turn % 2 === 0) || S.job.retired || !!S.job.sabbatical);
        const act = jobless ? 'search' : study ? 'study' : 'overtime';
        const cost = study ? W.studyCost(S) : act === 'overtime' ? OT_COST : SEARCH_COST;
        if (S.energy - cost < floor) break;
        W[act](S);
        if (act === 'search' && S.job.employed) break;
      }
    },
    // Energia livre por dia depois das empresas, para estimar o que o piloto faz.
    freeEnergy(S) {
      const habits = Object.keys(S.social.habits).reduce((s, id) => s + G.social.habitCost(S, id), 0);
      return Math.max(0, Math.min(W.regen(S), W.emax(S) * 0.75) - G.business.drain(S) - G.agro.drain(S) - habits - G.life.hobbyDrain(S));
    },

    daily(S) {
      if (S.burnout > 0) S.burnout--;
      S.energy = Math.min(W.emax(S), S.energy + W.regen(S));
      S.knowledge += W.knowledgeRate(S);
    },

    monthly(S, c) {
      const j = S.job, m = S.macro;
      if (c.month === 1) {
        const adj = m.priceIndex / j.wageIndex - 1;
        j.wageIndex = m.priceIndex;
        G.news(tr(`Dissídio: salários reajustados em ${G.fmt.pct(adj)} pela inflação.`, `Annual wage adjustment: salaries raised ${G.fmt.pct(adj)} for inflation.`), 'info');
      }

      if (j.sabbatical && S.day >= j.sabbatical) {
        j.sabbatical = null;
        G.news(tr('Fim do ano sabático. De volta ao trabalho, com outra cabeça.', 'Sabbatical over. Back to work with a fresh mind.'), 'info');
      }
      if (j.employed && j.sabbatical) {
        // sem salário, sem reputação e sem risco de demissão
      } else if (j.employed) {
        const sal = W.salary(S);
        S.cash += sal;
        S.stats.workIncome += sal;
        S.reputation += W.repGain(S);
        if (c.month === 12) {
          S.cash += sal;
          G.news(tr(`13º salário: ${money(sal)}.`, `13th-month salary: ${money(sal)}.`), 'good');
        }
        if (c.month === 2) {
          if (m.regime === 'expansao' || m.regime === 'pico') {
            S.cash += sal;
            G.news(tr(`A empresa bateu a meta. PLR de ${money(sal)}.`, `The company hit its target. Profit-sharing bonus of ${money(sal)}.`), 'good');
          } else G.news(tr('Ano fraco: sem PLR desta vez.', 'Weak year: no profit-sharing bonus this time.'), 'info');
        }
      } else if (!j.retired && ++j.jobless <= 4) {
        const b = 1500 * m.priceIndex;
        S.cash += b;
        G.news(tr(`Seguro-desemprego: ${money(b)} (parcela ${j.jobless} de 4).`, `Unemployment insurance: ${money(b)} (payment ${j.jobless} of 4).`), 'info');
      }

      const cost = W.cost(S);
      S.cash -= cost;
      if (c.month === 1) {
        const x = cost * 0.5;
        S.cash -= x;
        G.news(tr(`Janeiro: IPTU, IPVA e material escolar levaram ${money(x)}.`, `January: property tax, vehicle tax and school supplies took ${money(x)}.`), 'bad');
      }
      if (G.rng.chance(0.003)) {
        const x = cost * G.rng.range(1, 4) * G.life.medMult(S);
        S.cash -= x;
        G.news(tr(`Imprevisto médico: ${money(x)}${S.life.health !== 'nenhum' ? ' (o plano de saúde cobriu o resto)' : ''}.`,
          `Medical emergency: ${money(x)}${S.life.health !== 'nenhum' ? ' (health insurance covered the rest)' : ''}.`), 'bad');
      }

      if (j.employed && !j.sabbatical && G.rng.chance(G.macro.REGIMES[m.regime].layoff * (j.track === 'academia' ? 0.2 : j.track === 'startup' ? 2 : 1))) {
        W.loseJob(S);
        G.alert(S, tr('Você foi demitido. Uma reserva de emergência faria diferença agora.', 'You were laid off. An emergency fund would make a difference now.'), 'bad');
      }
    },

    // Tudo que sai do caixa todo mês: custo de vida, financiamentos, clubes, escola e política.
    outflow(S) {
      const PL = G.politics;
      const re = G.realty.monthlyNet(S);
      return W.cost(S) + re.pmt + re.upkeep + G.business.monthlyPayments(S) + G.social.clubFees(S) + G.social.schoolCost(S)
        + PL.mediaUpkeep(S) + PL.thinkTankCost(S) + PL.entityFees(S) + G.social.partilhaPayment(S) + G.agro.monthlyCost(S) + G.life.monthlyCost(S);
    },

    // Fecha o mês depois de todas as cobranças: resgata a reserva líquida, depois vende o resto da carteira
    // (do mais seguro para o mais arriscado) e, só se ainda faltar, cheque especial.
    settle(S) {
      const sold = [];
      for (const id of SETTLE_ORDER) {
        let got = 0;
        // Renda fixa: pede 25% a mais para cobrir o IR retido (máx. 22,5%). O IR da bolsa só vem no DARF.
        // Repete se o ativo acabar no meio.
        const extra = G.ASSETS[id].tax === 'rf' ? 1.25 : 1.01;
        for (let i = 0; i < 3 && S.cash < 0; i++) {
          const x = G.portfolio.sell(S, id, -S.cash * extra);
          if (x <= 0) break;
          got += x;
        }
        if (got > 0) sold.push({ id, got });
      }
      if (sold.length) {
        const risky = sold.some(x => SETTLE_ORDER.indexOf(x.id) > 2);
        G.news(tr(`Saldo negativo coberto com venda automática: ${sold.map(x => `${money(x.got)} de ${G.ASSETS[x.id].n}`).join(', ')}.`,
          `Negative balance covered by an automatic sale: ${sold.map(x => `${money(x.got)} of ${G.ASSETS[x.id].n}`).join(', ')}.`), risky ? 'bad' : 'info');
      }
      // Cheque especial (8% a.m.) até 6 meses de gastos; acima disso o banco renegocia a 2% a.m.
      if (S.cash < 0) {
        const debt = -S.cash, limit = 6 * W.outflow(S);
        const juros = Math.min(debt, limit) * 0.08 + Math.max(0, debt - limit) * 0.02;
        S.cash -= juros;
        G.news(debt > limit
          ? tr(`Dívida renegociada: ${money(debt)} devendo, ${money(juros)} de juros este mês.`, `Renegotiated debt: ${money(debt)} owed, ${money(juros)} of interest this month.`)
          : tr(`Cheque especial: ${money(juros)} de juros este mês.`, `Overdraft: ${money(juros)} of interest this month.`), 'bad');
      }
    },
  };
})();

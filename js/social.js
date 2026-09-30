(function () {
  const G = globalThis.G = globalThis.G || {};

  const money = v => G.fmt.money(v);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pi = S => S.macro.priceIndex;

  // Posição social = prestígio (durável) + metade da visibilidade (volátil), em faixas.
  const TIERS = [[0, 'Anônimo'], [20, 'Conhecido no bairro'], [60, 'Respeitado no setor'], [150, 'Figura pública'], [400, 'Elite'], [1000, 'Lenda']];

  // Hábitos. cost = energia/dia enquanto se forma; keep = energia/dia depois de formado.
  // Maus hábitos chegam como tentação e já entram formados; largar custa QUIT_COST/dia por QUIT_DAYS.
  const HABITS = {
    acordar_cedo: { n: 'Acordar cedo', good: true, cost: 3, keep: 1, d: '+4 de energia por dia.' },
    sono: { n: 'Dormir 8 horas', good: true, cost: 2, keep: 0, d: '+15% de regeneração de energia.' },
    exercicio: { n: 'Exercício', good: true, cost: 5, keep: 2, d: '+20 de energia máxima, metade do risco de burnout, −4 de stress por mês.' },
    leitura: { n: 'Leitura diária', good: true, cost: 4, keep: 1, d: '+0,4 de conhecimento por dia.' },
    meditacao: { n: 'Meditação', good: true, cost: 3, keep: 1, d: '−10 de stress por mês; pânico fica mais raro.' },
    registrar: { n: 'Registrar gastos', good: true, cost: 2, keep: 0.5, d: 'Custo de vida −5%.' },
    pagar_primeiro: { n: 'Pagar-se primeiro', good: true, cost: 1, keep: 0, d: 'No dia do salário, 20% dele vai direto para os investimentos.' },
    networking: { n: 'Networking semanal', good: true, cost: 5, keep: 2, d: '+0,5 de prestígio, +1 de visibilidade e +0,5 de reputação por mês.' },
    delivery: { n: 'Delivery todo dia', good: false, d: '+5 de energia por dia, mas custo de vida +15%.',
      offer: 'Um app te oferece frete grátis para sempre. Pedir delivery todo dia?' },
    bets: { n: 'Bets esportivas', good: false, d: 'Pequenas vitórias, perda média garantida, stress.',
      offer: 'Um influenciador te manda um bônus numa casa de apostas. Começar a apostar?' },
    day_trade: { n: 'Day trade', good: false, d: 'Corretagem e emoção comem o resultado; stress alto.',
      offer: 'Um curso promete "viver de day trade em 30 dias". Começar a operar?' },
    ostentacao: { n: 'Ostentar nas redes', good: false, d: '+3 de visibilidade por mês, −1% do caixa; risco de fama de novo-rico.',
      offer: 'Seus amigos postam viagens e carros o tempo todo. Começar a ostentar também?' },
  };
  const QUIT_DAYS = 60, QUIT_COST = 4;

  // Atividades sociais. cost em R$ de 2026; tier = posição mínima; req = pesquisa.
  const ACTIVITIES = [
    { id: 'happy', n: 'Happy hour com colegas', energy: 15, cost: 150, vis: 1, prest: 0.3, rep: 0.5 },
    { id: 'evento', n: 'Evento do setor', energy: 30, cost: 1500, vis: 2, prest: 1, rep: 1, tier: 1 },
    { id: 'conferencia', n: 'Conferência anual (só no outono)', energy: 60, cost: 15000, vis: 8, prest: 4, know: 20, tier: 1, season: 'outono', cooldown: 300 },
    { id: 'mentoria', n: 'Mentorar juniores', energy: 25, cost: 0, prest: 1.5, know: 1, tier: 2 },
    { id: 'artigo', n: 'Escrever um artigo', energy: 20, cost: 0, vis: 2, prest: 0.5, req: 'comunicacao' },
    { id: 'palestra', n: 'Dar uma palestra paga', energy: 40, cost: 0, vis: 3, prest: 2, fee: true, tier: 3, req: 'oratoria' },
    { id: 'livro', n: 'Escrever um livro', energy: 150, cost: 0, vis: 10, prest: 20, tier: 2, req: 'comunicacao', cooldown: 720 },
  ];

  const LUXURY = [
    { id: 'relogio', n: 'Relógio suíço', cost: 80000, vis: 5 },
    { id: 'festa', n: 'Festa de aniversário badalada', cost: 100000, vis: 10 },
    { id: 'carro', n: 'Carro importado', cost: 400000, vis: 15 },
    { id: 'lancha', n: 'Lancha', cost: 2500000, vis: 35, tier: 3 },
  ];

  // Clubes: mensalidade (R$ de 2026), joia de entrada = 6 mensalidades.
  const CLUBS = [
    { id: 'academia', n: 'Academia premium', fee: 500, tier: 0, stress: -2, regen: 3, d: '−2 de stress por mês, +3 de energia por dia.' },
    { id: 'rotary', n: 'Rotary Club', fee: 800, tier: 1, prest: 0.4, d: '+0,4 de prestígio por mês.' },
    { id: 'tenis', n: 'Clube de tênis', fee: 2000, tier: 1, vis: 0.5, prest: 0.2, rep: 0.3, d: '+0,5 de visibilidade, +0,2 de prestígio e +0,3 de reputação por mês.' },
    { id: 'golfe', n: 'Clube de golfe', fee: 6000, tier: 2, prest: 0.5, rep: 1, d: 'Negócios fecham no campo: +1 de reputação por mês e rodadas de startup mais confiáveis.' },
    { id: 'iate', n: 'Iate clube', fee: 40000, tier: 4, vis: 2, prest: 0.8, d: '+2 de visibilidade e +0,8 de prestígio por mês.' },
  ];

  const has = (S, id) => {
    const h = S.social.habits[id];
    return !!h && h.state === 'formed';
  };
  const active = (S, id) => !!S.social.habits[id] && S.social.habits[id].state !== 'forming';

  const SO = G.social = {
    TIERS, HABITS, ACTIVITIES, LUXURY, CLUBS, QUIT_DAYS,
    init: () => ({
      prestige: 0, visibility: 0, stress: 10, habits: {}, clubs: {}, cooldowns: {},
      family: { married: false, spouseIncome: 0, kids: 0, school: false, partilha: null }, donated: 0, pending: null, lastNW: 0, spent: 0,
    }),
    has,
    score: S => S.social.prestige + 0.5 * S.social.visibility,
    tierIdx(S) {
      const sc = SO.score(S);
      let i = 0;
      while (i + 1 < TIERS.length && sc >= TIERS[i + 1][0]) i++;
      return i;
    },
    tierName: S => TIERS[SO.tierIdx(S)][1],
    nextTier: S => TIERS[SO.tierIdx(S) + 1],
    nouveauRiche: S => S.social.visibility > 2 * S.social.prestige + 20,
    formDays: S => (S.research.disciplina ? 45 : 66),
    slots: S => 2 + (SO.tierIdx(S) >= 2 ? 1 : 0) + (SO.tierIdx(S) >= 4 ? 1 : 0) + (S.research.disciplina ? 1 : 0),
    used: S => Object.keys(S.social.habits).length,

    // Efeitos consultados pelo work.js
    regenAdd: S => (has(S, 'acordar_cedo') ? 4 : 0) + (active(S, 'delivery') ? 5 : 0) + (S.social.clubs.academia ? 3 : 0),
    regenMult: S => (has(S, 'sono') ? 1.15 : 1),
    emaxAdd: S => (has(S, 'exercicio') ? 20 : 0),
    knowledgeAdd: S => (has(S, 'leitura') ? 0.4 : 0),
    burnoutMult: S => (has(S, 'exercicio') ? 0.5 : 1) * (1 + S.social.stress / 50),
    costMult(S) {
      const f = S.social.family;
      return (has(S, 'registrar') ? 0.95 : 1) * (active(S, 'delivery') ? 1.15 : 1) * (f.married ? 1.4 : 1) * (1 + 0.25 * f.kids);
    },
    schoolCost: S => (S.social.family.school ? S.social.family.kids * 4000 * pi(S) : 0),
    clubFees: S => CLUBS.reduce((s, c) => s + (S.social.clubs[c.id] ? c.fee * pi(S) : 0), 0),
    gain(S, vis, prest) {
      S.social.visibility += vis * (S.research.oratoria ? 1.3 : 1);
      S.social.prestige += prest;
    },
    // Registra um gasto voluntário do mês (não conta como perda no cálculo do stress).
    spent(S, x) { if (x > 0) S.social.spent = (S.social.spent || 0) + x; },
    addStress(S, x) {
      if (x > 0 && S.research.inteligencia_emocional) x *= 0.7;
      S.social.stress = clamp(S.social.stress + x, 0, 100);
    },

    // ---------- hábitos ----------
    startHabit(S, id) {
      const h = HABITS[id];
      if (!h || !h.good || S.social.habits[id] || SO.used(S) >= SO.slots(S)) return;
      S.social.habits[id] = { state: 'forming', days: 0, missed: 0 };
    },
    dropHabit(S, id) {
      const h = S.social.habits[id];
      if (!h) return;
      if (HABITS[id].good) delete S.social.habits[id];
      else if (h.state !== 'quitting') Object.assign(h, { state: 'quitting', days: 0 });
    },
    habitCost(S, id) {
      const h = S.social.habits[id], d = HABITS[id];
      if (h.state === 'quitting') return QUIT_COST;
      if (!d.good) return 0;
      return h.state === 'forming' ? d.cost : d.keep;
    },
    daily(S) {
      for (const id of Object.keys(S.social.habits)) {
        const h = S.social.habits[id], c = SO.habitCost(S, id);
        const paid = S.energy >= c;
        if (paid) S.energy -= c;
        if (h.state === 'forming') {
          if (paid) h.days++;
          else if (++h.missed > 10) {
            delete S.social.habits[id];
            G.news(`Faltou energia e você abandonou o hábito "${HABITS[id].n}".`, 'bad');
            continue;
          }
          if (h.days >= SO.formDays(S)) {
            h.state = 'formed';
            G.news(`Hábito formado: ${HABITS[id].n}. Agora ele quase não custa esforço.`, 'good');
          }
        } else if (h.state === 'quitting' && paid && ++h.days >= QUIT_DAYS) {
          delete S.social.habits[id];
          G.news(`Você largou de vez: ${HABITS[id].n}.`, 'good');
        }
      }
    },

    // ---------- decisões pendentes (tentação, pânico) ----------
    // opt: índice da opção (pânico e tentação: 1 = sim, 0 = não); null = prazo vencido.
    decide(S, opt) {
      const p = S.social.pending;
      if (!p) return;
      S.social.pending = null;
      if (p.type === 'choice') return G.choices.resolve(S, p, opt);
      const yes = opt === 1 || opt === true;
      if (p.type === 'tempt') {
        if (yes && SO.used(S) < SO.slots(S)) {
          S.social.habits[p.id] = { state: 'formed', days: 0, missed: 0 };
          G.news(`Novo hábito: ${HABITS[p.id].n}.`, 'bad');
        } else G.news(`Você resistiu à tentação: ${HABITS[p.id].n.toLowerCase()}.`, 'good');
      } else if (p.type === 'panic') {
        G.legacy.flag(S, yes ? 'fundo' : 'diamante');
        if (yes) {
          let sold = 0;
          for (const id in S.port) if (G.auto.isRisk(id)) sold += G.portfolio.sell(S, id, Infinity);
          S.social.stress = Math.max(0, S.social.stress - 25);
          G.news(`Você vendeu tudo no pânico: ${money(sold)} em ações e cripto viraram caixa, bem perto do fundo.`, 'bad');
        } else {
          SO.addStress(S, 5);
          G.news('Você segurou firme no meio do pânico.', 'good');
        }
      }
    },

    // ---------- atividades ----------
    canDo(S, a) {
      if ((a.tier || 0) > SO.tierIdx(S) || (a.req && !S.research[a.req])) return false;
      if (a.season && G.cal.season(S.day).id !== a.season) return false;
      if (a.cooldown && S.day < (S.social.cooldowns[a.id] || 0)) return false;
      return S.energy >= a.energy && S.cash >= a.cost * pi(S) && S.burnout <= 0;
    },
    fee: S => 5000 * Math.pow(1 + SO.tierIdx(S), 2) * pi(S),
    doActivity(S, id) {
      const a = ACTIVITIES.find(x => x.id === id);
      if (!a || !SO.canDo(S, a)) return;
      S.energy -= a.energy;
      S.cash -= a.cost * pi(S);
      SO.spent(S, a.cost * pi(S));
      SO.gain(S, a.vis || 0, a.prest || 0);
      S.reputation += a.rep || 0;
      S.knowledge += a.know || 0;
      if (a.cooldown) S.social.cooldowns[a.id] = S.day + a.cooldown;
      if (a.fee) {
        const fee = SO.fee(S);
        S.cash += fee;
        G.news(`Palestra dada. Cachê de ${money(fee)}.`, 'good');
      }
      if (a.id === 'livro') G.news('Seu livro saiu! Resenhas nos jornais e convites para entrevistas.', 'good');
    },
    buyLuxury(S, id) {
      const l = LUXURY.find(x => x.id === id);
      if (!l || (l.tier || 0) > SO.tierIdx(S) || S.cash < l.cost * pi(S)) return;
      S.cash -= l.cost * pi(S);
      SO.spent(S, l.cost * pi(S));
      SO.gain(S, l.vis, 0);
      G.politics.addImage(S, -1);
      if (l.stress) SO.addStress(S, l.stress);
      G.news(`Comprado: ${l.n.toLowerCase()}. Todo mundo reparou.`, 'info');
    },
    joinClub(S, id) {
      const c = CLUBS.find(x => x.id === id);
      if (!c || !S.research.etiqueta || S.social.clubs[id] || c.tier > SO.tierIdx(S) || S.cash < 6 * c.fee * pi(S)) return;
      S.cash -= 6 * c.fee * pi(S);
      SO.spent(S, 6 * c.fee * pi(S));
      S.social.clubs[id] = true;
      G.news(`Você entrou no ${c.n}.`, 'good');
    },
    leaveClub(S, id) {
      delete S.social.clubs[id];
    },
    donate(S, amount) {
      amount = Math.min(amount, S.cash);
      if (!(amount >= 100)) return;
      S.cash -= amount;
      SO.spent(S, amount);
      S.social.donated += amount;
      const p = 0.5 * Math.sqrt(amount / (1000 * pi(S)));
      SO.gain(S, 0, p);
      G.politics.addImage(S, p * (S.research.filantropia_estrategica ? 2 : 1));
      G.news(`Doação de ${money(amount)}: +${G.fmt.num(p, 1)} de prestígio e imagem pública.`, 'good');
    },

    // ---------- família ----------
    marry(S, big) {
      const f = S.social.family, cost = (big ? 800000 : 60000) * pi(S);
      if (f.married || S.cash < cost) return;
      S.cash -= cost;
      SO.spent(S, cost);
      f.married = true;
      f.spouseIncome = G.rng.chance(0.3) ? 0 : 3000 * G.rng.range(0.5, 3);
      SO.gain(S, big ? 20 : 2, 1);
      SO.addStress(S, -10);
      G.news(`Você se casou${big ? ' numa festa que saiu em todas as colunas sociais' : ''}!` +
        (f.spouseIncome ? ` A renda do casal cresce ${money(f.spouseIncome * pi(S))}/mês.` : ''), 'good');
    },
    haveKid(S) {
      const f = S.social.family, cost = 20000 * pi(S);
      if (!f.married || S.cash < cost) return;
      S.cash -= cost;
      SO.spent(S, cost);
      f.kids++;
      G.news(`Nasceu seu ${f.kids}º filho! O custo de vida sobe, mas agora existe um herdeiro.`, 'good');
    },

    divorce(S) {
      const f = S.social.family, P = G.portfolio;
      let now = 0.4 * Math.max(0, S.cash);
      for (const id of Object.keys(S.port)) now += P.sell(S, id, 0.4 * P.value(S, id));
      const other = G.realty.equity(S) + G.agro.equity(S) + G.business.value(S) - G.business.debt(S) + G.angel.book(S) + G.fund.value(S) + G.life.equity(S);
      const later = 0.4 * Math.max(0, other);
      S.cash -= now;
      if (later > 0) f.partilha = { bal: later + (f.partilha ? f.partilha.bal : 0), left: 24 };
      Object.assign(f, { married: false, spouseIncome: 0 });
      SO.addStress(S, 25);
      G.alert(S, `Divórcio. A partilha levou ${money(now)} na hora` +
        (later > 0 ? ` e mais ${money(later)} pelos outros bens, em 24 parcelas.` : '.'), 'bad');
    },
    partilhaPayment: S => (S.social.family.partilha ? S.social.family.partilha.bal / S.social.family.partilha.left : 0),

    // ---------- mês ----------
    monthly(S) {
      const so = S.social, f = so.family, P = G.portfolio, t = SO.tierIdx(S);

      // Renda do cônjuge, pagar-se primeiro, clubes e escola
      if (f.married && f.spouseIncome) S.cash += f.spouseIncome * pi(S);
      if (has(S, 'pagar_primeiro') && S.job.employed) {
        const amt = 0.2 * G.work.salary(S), tg = G.auto.targets(S);
        if (tg) for (const id in tg) P.buy(S, id, amt * tg[id]);
        else P.buy(S, P.unlocked(S, 'tesouro_selic') ? 'tesouro_selic' : 'poupanca', amt);
      }
      S.cash -= SO.clubFees(S) + SO.schoolCost(S);
      for (const c of CLUBS) {
        if (!so.clubs[c.id]) continue;
        SO.gain(S, c.vis || 0, c.prest || 0);
        S.reputation += c.rep || 0;
        if (c.stress) SO.addStress(S, c.stress);
      }
      if (f.school) SO.gain(S, 0, 0.2 * f.kids);

      // Prestígio passivo: carreira, empresas, gestora
      if (S.job.employed) SO.gain(S, 0, 0.1 * S.job.level);
      if (S.job.employed && S.job.track === 'academia') {
        SO.gain(S, 0, 0.3);
        SO.addStress(S, -3);
      }
      SO.gain(S, 0, 0.2 * G.BUSINESSES.filter(b => G.business.count(S, b.id) > 0).length);
      if (S.fund) SO.gain(S, 0, Math.min(5, S.fund.aum / 1e8));
      if (has(S, 'networking')) {
        SO.gain(S, 1, 0.5);
        S.reputation += 0.5;
      }
      S.reputation += 0.2 * t;

      // Maus hábitos
      if (active(S, 'bets')) {
        const stake = 300 * pi(S) + 0.01 * Math.max(0, S.cash), r = G.rng.next();
        const back = r < 0.7 ? 0 : r < 0.95 ? stake * 1.5 : stake * 5;
        S.cash += back - stake;
        SO.addStress(S, 3);
        if (back > stake * 2) G.news(`Green na bet! Ganhou ${money(back - stake)}... e já quer apostar de novo.`, 'bad');
      }
      if (active(S, 'day_trade')) {
        const risk = Object.keys(S.port).filter(G.auto.isRisk).reduce((s, id) => s + P.value(S, id), 0);
        S.cash -= 0.006 * risk + 200 * pi(S);
        SO.addStress(S, 6);
      }
      if (active(S, 'ostentacao')) {
        SO.gain(S, 3, 0);
        S.cash -= 0.01 * Math.max(0, S.cash);
      }

      // Stress
      // Gastos por escolha (luxo, festa, ITBI, cursos...) não assustam: só a queda "sofrida" pesa.
      const nw = P.netWorth(S);
      const felt = nw + (so.spent || 0);
      if (so.lastNW > 0 && felt < so.lastNW) SO.addStress(S, ((so.lastNW - felt) / so.lastNW) * 150);
      so.lastNW = nw;
      so.spent = 0;
      if (S.cash < 0) SO.addStress(S, 10);
      if (!S.job.employed && !S.job.retired) SO.addStress(S, 8);
      if (G.business.drain(S) + G.agro.drain(S) > G.work.regen(S)) SO.addStress(S, 5);
      SO.addStress(S, -4 - (has(S, 'exercicio') ? 4 : 0) - (has(S, 'meditacao') ? 10 : 0) - (f.married ? 3 : 0));
      if (so.stress > 70) {
        for (const id of Object.keys(so.habits)) {
          if (HABITS[id].good && so.habits[id].state === 'formed' && G.rng.chance(0.1)) {
            delete so.habits[id];
            G.news(`Com o stress lá em cima, você largou o hábito "${HABITS[id].n}".`, 'bad');
          }
        }
      }

      // Decaimento
      so.prestige *= 0.998;
      so.visibility *= 0.9;

      // Novo-rico: fama de ostentação atrai crítica e golpistas
      if (SO.nouveauRiche(S) && G.rng.chance(0.08)) {
        if (G.rng.chance(0.5)) {
          const x = 0.02 * Math.max(0, S.cash);
          S.cash -= x;
          G.news(`Um golpista se aproveitou da sua fama de rico: ${money(x)} perdidos.`, 'bad');
        } else {
          so.prestige = Math.max(0, so.prestige - 3);
          so.visibility *= 0.8;
          G.politics.addImage(S, -5);
          G.news('Uma coluna social te chama de "novo-rico". Seu prestígio sofre.', 'bad');
        }
      }

      // Partilha do divórcio em parcelas (a parte dos bens que não dá para vender na hora)
      if (f.partilha) {
        const pmt = f.partilha.bal / f.partilha.left;
        S.cash -= pmt;
        f.partilha.bal -= pmt;
        if (--f.partilha.left <= 0) f.partilha = null;
      }

      // Divórcio: 40% de tudo. Caixa e carteira saem na hora (vendendo 40% de cada posição);
      // imóveis, terras, empresas e startups viram 24 parcelas.
      if (f.married && G.rng.chance(0.001 + (so.stress / 100) * 0.004)) SO.divorce(S);

      // Decisões: pendência vencida recusa sozinha; depois, chance de pânico ou tentação
      if (so.pending && S.day >= so.pending.until) SO.decide(S, null);
      if (!so.pending) {
        const h = S.market.hist.ibov, r60 = h[h.length - 1] / h[Math.max(0, h.length - 61)] - 1;
        const risk = Object.keys(S.port).some(id => G.auto.isRisk(id) && P.value(S, id) > 1000);
        let pPanic = 0.5 * (has(S, 'meditacao') ? 0.5 : 1) * (S.research.inteligencia_emocional ? 0.5 : 1) * (S.research.sentimento ? 0.7 : 1);
        if (risk && r60 < -0.15 && so.stress > 40 && G.rng.chance(pPanic)) {
          so.pending = { type: 'panic', until: S.day + 30 };
          G.alert(S, `PÂNICO: a bolsa caiu ${G.fmt.pct(-r60, 0)} em dois meses. Vender tudo antes que piore?`, 'bad');
        } else if (G.rng.chance(0.04)) {
          const options = Object.keys(HABITS).filter(id => !HABITS[id].good && !so.habits[id]);
          if (options.length) {
            const id = G.rng.item(options);
            so.pending = { type: 'tempt', id, until: S.day + 30 };
            G.alert(S, `Tentação: ${HABITS[id].offer}`, 'hint');
          }
        }
      }
    },
  };
})();

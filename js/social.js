(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  const money = v => G.fmt.money(v);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pi = S => S.macro.priceIndex;

  // Posição social = prestígio (durável) + metade da visibilidade (volátil), em faixas.
  const TIERS = [[0, tr('Anônimo', 'Nobody')], [20, tr('Conhecido no bairro', 'Known in the neighborhood')], [60, tr('Respeitado no setor', 'Respected in the industry')],
    [150, tr('Figura pública', 'Public figure')], [400, tr('Elite', 'Elite')], [1000, tr('Lenda', 'Legend')]];

  // Hábitos. cost = energia/dia enquanto se forma; keep = energia/dia depois de formado.
  // Maus hábitos chegam como tentação e já entram formados; largar custa QUIT_COST/dia por QUIT_DAYS.
  const HABITS = {
    acordar_cedo: { n: tr('Acordar cedo', 'Wake up early'), good: true, cost: 3, keep: 1, d: tr('+4 de energia por dia.', '+4 energy per day.') },
    sono: { n: tr('Dormir 8 horas', 'Sleep 8 hours'), good: true, cost: 2, keep: 0, d: tr('+15% de regeneração de energia.', '+15% energy regeneration.') },
    exercicio: { n: tr('Exercício', 'Exercise'), good: true, cost: 5, keep: 2,
      d: tr('+20 de energia máxima, metade do risco de burnout, −4 de stress por mês.', '+20 max energy, half the burnout risk, −4 stress per month.') },
    leitura: { n: tr('Leitura diária', 'Daily reading'), good: true, cost: 4, keep: 1, d: tr('+0,4 de conhecimento por dia.', '+0.4 knowledge per day.') },
    meditacao: { n: tr('Meditação', 'Meditation'), good: true, cost: 3, keep: 1, d: tr('−10 de stress por mês; pânico fica mais raro.', '−10 stress per month; panic becomes rarer.') },
    registrar: { n: tr('Registrar gastos', 'Track spending'), good: true, cost: 2, keep: 0.5, d: tr('Custo de vida −5%.', 'Cost of living −5%.') },
    pagar_primeiro: { n: tr('Pagar-se primeiro', 'Pay yourself first'), good: true, cost: 1, keep: 0,
      d: tr('No dia do salário, 20% dele vai direto para os investimentos.', 'On payday, 20% of your salary goes straight into investments.') },
    networking: { n: tr('Networking semanal', 'Weekly networking'), good: true, cost: 5, keep: 2,
      d: tr('+0,5 de prestígio, +1 de visibilidade e +0,5 de reputação por mês.', '+0.5 prestige, +1 visibility and +0.5 reputation per month.') },
    delivery: { n: tr('Delivery todo dia', 'Takeout every day'), good: false, d: tr('+5 de energia por dia, mas custo de vida +15%.', '+5 energy per day, but cost of living +15%.'),
      offer: tr('Um app te oferece frete grátis para sempre. Pedir delivery todo dia?', 'An app offers you free delivery forever. Order takeout every day?') },
    bets: { n: tr('Bets esportivas', 'Sports betting'), good: false, d: tr('Pequenas vitórias, perda média garantida, stress.', 'Small wins, a guaranteed average loss, stress.'),
      offer: tr('Um influenciador te manda um bônus numa casa de apostas. Começar a apostar?', 'An influencer sends you a sportsbook bonus. Start betting?') },
    day_trade: { n: 'Day trade', good: false, d: tr('Corretagem e emoção comem o resultado; stress alto.', 'Fees and emotion eat the returns; high stress.'),
      offer: tr('Um curso promete "viver de day trade em 30 dias". Começar a operar?', 'A course promises "live off day trading in 30 days". Start trading?') },
    ostentacao: { n: tr('Ostentar nas redes', 'Showing off online'), good: false,
      d: tr('+3 de visibilidade por mês, −1% do caixa; risco de fama de novo-rico.', '+3 visibility per month, −1% of cash; risk of a nouveau-riche reputation.'),
      offer: tr('Seus amigos postam viagens e carros o tempo todo. Começar a ostentar também?', 'Your friends post trips and cars all the time. Start showing off too?') },
  };
  const QUIT_DAYS = 60, QUIT_COST = 4;
  // Filhos: ao decidir ter um filho o casal passa a tentar (chance mensal de engravidar); a gravidez dura 9 meses
  // e, depois do parto, há um ano de recuperação antes de tentar de novo. Nunca dois ao mesmo tempo.
  const KID_COST = 20000, CONCEIVE = 0.3, PREGNANCY = 270, RECOVERY = 360;

  // Atividades sociais. cost em R$ de 2026; tier = posição mínima; req = pesquisa.
  const ACTIVITIES = [
    { id: 'happy', n: tr('Happy hour com colegas', 'Happy hour with coworkers'), energy: 15, cost: 150, vis: 1, prest: 0.3, rep: 0.5 },
    { id: 'evento', n: tr('Evento do setor', 'Industry event'), energy: 30, cost: 1500, vis: 2, prest: 1, rep: 1, tier: 1 },
    { id: 'conferencia', n: tr('Conferência anual (só no outono)', 'Annual conference (autumn only)'), energy: 60, cost: 15000, vis: 8, prest: 4, know: 20, tier: 1, season: 'outono', cooldown: 300 },
    { id: 'mentoria', n: tr('Mentorar juniores', 'Mentor juniors'), energy: 25, cost: 0, prest: 1.5, know: 1, tier: 2 },
    { id: 'artigo', n: tr('Escrever um artigo', 'Write an article'), energy: 20, cost: 0, vis: 2, prest: 0.5, req: 'comunicacao' },
    { id: 'palestra', n: tr('Dar uma palestra paga (1 a cada 5 dias)', 'Give a paid talk (once every 5 days)'), energy: 40, cost: 0, vis: 3, prest: 2, fee: true, tier: 3,
      req: 'oratoria', cooldown: 5 },
    { id: 'livro', n: tr('Escrever um livro', 'Write a book'), energy: 150, cost: 0, vis: 10, prest: 20, tier: 2, req: 'comunicacao', cooldown: 720 },
  ];

  const LUXURY = [
    { id: 'relogio', n: tr('Relógio suíço', 'Swiss watch'), cost: 80000, vis: 5 },
    { id: 'festa', n: tr('Festa de aniversário badalada', 'Lavish birthday party'), cost: 100000, vis: 10 },
    { id: 'carro', n: tr('Carro importado', 'Imported car'), cost: 400000, vis: 15 },
    { id: 'lancha', n: tr('Lancha', 'Speedboat'), cost: 2500000, vis: 35, tier: 3 },
  ];

  // Clubes: mensalidade (R$ de 2026), joia de entrada = 6 mensalidades.
  const CLUBS = [
    { id: 'academia', n: tr('Academia premium', 'Premium gym'), fee: 500, tier: 0, stress: -2, regen: 3,
      d: tr('−2 de stress por mês, +3 de energia por dia.', '−2 stress per month, +3 energy per day.') },
    { id: 'rotary', n: 'Rotary Club', fee: 800, tier: 1, prest: 0.4, d: tr('+0,4 de prestígio por mês.', '+0.4 prestige per month.') },
    { id: 'tenis', n: tr('Clube de tênis', 'Tennis club'), fee: 2000, tier: 1, vis: 0.5, prest: 0.2, rep: 0.3,
      d: tr('+0,5 de visibilidade, +0,2 de prestígio e +0,3 de reputação por mês.', '+0.5 visibility, +0.2 prestige and +0.3 reputation per month.') },
    { id: 'golfe', n: tr('Clube de golfe', 'Golf club'), fee: 6000, tier: 2, prest: 0.5, rep: 1,
      d: tr('Negócios fecham no campo: +1 de reputação por mês e rodadas de startup mais confiáveis.', 'Deals close on the course: +1 reputation per month and more reliable startup rounds.') },
    { id: 'iate', n: tr('Iate clube', 'Yacht club'), fee: 40000, tier: 4, vis: 2, prest: 0.8, d: tr('+2 de visibilidade e +0,8 de prestígio por mês.', '+2 visibility and +0.8 prestige per month.') },
  ];

  const has = (S, id) => {
    const h = S.social.habits[id];
    return !!h && h.state === 'formed';
  };
  const active = (S, id) => !!S.social.habits[id] && S.social.habits[id].state !== 'forming';

  const SO = G.social = {
    TIERS, HABITS, ACTIVITIES, LUXURY, CLUBS, QUIT_DAYS, KID_COST,
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
            G.news(tr(`Faltou energia e você abandonou o hábito "${HABITS[id].n}".`, `You ran out of energy and dropped the habit "${HABITS[id].n}".`), 'bad');
            continue;
          }
          if (h.days >= SO.formDays(S)) {
            h.state = 'formed';
            G.news(tr(`Hábito formado: ${HABITS[id].n}. Agora ele quase não custa esforço.`, `Habit formed: ${HABITS[id].n}. Now it takes almost no effort.`), 'good');
          }
        } else if (h.state === 'quitting' && paid && ++h.days >= QUIT_DAYS) {
          delete S.social.habits[id];
          G.news(tr(`Você largou de vez: ${HABITS[id].n}.`, `You quit for good: ${HABITS[id].n}.`), 'good');
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
          G.news(tr(`Novo hábito: ${HABITS[p.id].n}.`, `New habit: ${HABITS[p.id].n}.`), 'bad');
        } else G.news(tr(`Você resistiu à tentação: ${HABITS[p.id].n.toLowerCase()}.`, `You resisted temptation: ${HABITS[p.id].n.toLowerCase()}.`), 'good');
      } else if (p.type === 'panic') {
        G.legacy.flag(S, yes ? 'fundo' : 'diamante');
        if (yes) {
          let sold = 0;
          for (const id in S.port) if (G.auto.isRisk(id)) sold += G.portfolio.sell(S, id, Infinity);
          S.social.stress = Math.max(0, S.social.stress - 25);
          G.news(tr(`Você vendeu tudo no pânico: ${money(sold)} em ações e cripto viraram caixa, bem perto do fundo.`,
            `You sold everything in the panic: ${money(sold)} in stocks and crypto turned into cash, right near the bottom.`), 'bad');
        } else {
          SO.addStress(S, 5);
          G.news(tr('Você segurou firme no meio do pânico.', 'You held firm in the middle of the panic.'), 'good');
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
        G.news(tr(`Palestra dada. Cachê de ${money(fee)}.`, `Talk given. Speaker fee of ${money(fee)}.`), 'good');
      }
      if (a.id === 'livro') G.news(tr('Seu livro saiu! Resenhas nos jornais e convites para entrevistas.', 'Your book is out! Reviews in the papers and interview invitations.'), 'good');
    },
    buyLuxury(S, id) {
      const l = LUXURY.find(x => x.id === id);
      if (!l || (l.tier || 0) > SO.tierIdx(S) || S.cash < l.cost * pi(S)) return;
      S.cash -= l.cost * pi(S);
      SO.spent(S, l.cost * pi(S));
      SO.gain(S, l.vis, 0);
      G.politics.addImage(S, -1);
      if (l.stress) SO.addStress(S, l.stress);
      G.news(tr(`Comprado: ${l.n.toLowerCase()}. Todo mundo reparou.`, `Bought: ${l.n.toLowerCase()}. Everyone noticed.`), 'info');
    },
    joinClub(S, id) {
      const c = CLUBS.find(x => x.id === id);
      if (!c || !S.research.etiqueta || S.social.clubs[id] || c.tier > SO.tierIdx(S) || S.cash < 6 * c.fee * pi(S)) return;
      S.cash -= 6 * c.fee * pi(S);
      SO.spent(S, 6 * c.fee * pi(S));
      S.social.clubs[id] = true;
      G.news(tr(`Você entrou no ${c.n}.`, `You joined the ${c.n}.`), 'good');
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
      G.news(tr(`Doação de ${money(amount)}: +${G.fmt.num(p, 1)} de prestígio e imagem pública.`, `Donation of ${money(amount)}: +${G.fmt.num(p, 1)} prestige and public image.`), 'good');
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
      G.news(tr(`Você se casou${big ? ' numa festa que saiu em todas as colunas sociais' : ''}!`, `You got married${big ? ' at a party that made every society column' : ''}!`) +
        (f.spouseIncome ? tr(` A renda do casal cresce ${money(f.spouseIncome * pi(S))}/mês.`, ` Household income grows by ${money(f.spouseIncome * pi(S))}/month.`) : ''), 'good');
      G.work.checkRoom(S);
    },
    // 'trying' (tentando engravidar), 'pregnant', 'recovering' (depois do parto) ou 'ready'.
    familySize: S => 1 + (S.social.family.married ? 1 : 0) + S.social.family.kids,
    kidState(S) {
      const f = S.social.family;
      return f.pregnant ? 'pregnant' : f.trying ? 'trying' : S.day < (f.nextKid || 0) ? 'recovering' : 'ready';
    },
    // Decidir ter um filho: paga pré-natal, parto e enxoval e começa a tentar.
    haveKid(S) {
      const f = S.social.family, cost = KID_COST * pi(S);
      if (!f.married || SO.kidState(S) !== 'ready' || S.cash < cost) return;
      S.cash -= cost;
      SO.spent(S, cost);
      f.trying = true;
      G.news(tr('Vocês decidiram aumentar a família. Agora é esperar a gravidez chegar.',
        'You decided to grow the family. Now you wait for the pregnancy to come.'), 'story');
    },
    kidMonthly(S) {
      const f = S.social.family;
      if (f.pregnant) {
        if (S.day < f.pregnant.due) return;
        f.pregnant = null;
        f.kids++;
        f.nextKid = S.day + RECOVERY;
        G.news(tr(`Nasceu seu ${f.kids}º filho! O custo de vida sobe, mas agora existe um herdeiro.`,
          `Your child #${f.kids} is born! The cost of living goes up, but now there is an heir.`), 'good');
        G.work.checkRoom(S);
      } else if (f.trying && G.rng.chance(CONCEIVE)) {
        f.trying = false;
        f.pregnant = { due: S.day + PREGNANCY };
        G.news(tr(`Gravidez confirmada! O bebê nasce em 9 meses (${G.fmt.monthYear(f.pregnant.due)}).`,
          `Pregnancy confirmed! The baby is due in 9 months (${G.fmt.monthYear(f.pregnant.due)}).`), 'good');
      }
    },

    divorce(S) {
      const f = S.social.family, P = G.portfolio;
      let now = 0.4 * Math.max(0, S.cash);
      for (const id of Object.keys(S.port)) now += P.sell(S, id, 0.4 * P.value(S, id));
      const other = G.realty.equity(S) + G.agro.equity(S) + G.business.value(S) - G.business.debt(S) + G.angel.book(S) + G.fund.value(S) + G.life.equity(S);
      const later = 0.4 * Math.max(0, other);
      S.cash -= now;
      if (later > 0) f.partilha = { bal: later + (f.partilha ? f.partilha.bal : 0), left: 24 };
      Object.assign(f, { married: false, spouseIncome: 0, trying: false });
      SO.addStress(S, 25);
      G.alert(S, tr(`Divórcio. A partilha levou ${money(now)} na hora`, `Divorce. The settlement took ${money(now)} right away`) +
        (later > 0 ? tr(` e mais ${money(later)} pelos outros bens, em 24 parcelas.`, ` plus ${money(later)} for the other assets, in 24 installments.`) : '.'), 'bad');
    },
    partilhaPayment: S => (S.social.family.partilha ? S.social.family.partilha.bal / S.social.family.partilha.left : 0),

    // ---------- mês ----------
    monthly(S) {
      const so = S.social, f = so.family, P = G.portfolio, t = SO.tierIdx(S);

      SO.kidMonthly(S);

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
        if (back > stake * 2) G.news(tr(`Green na bet! Ganhou ${money(back - stake)}... e já quer apostar de novo.`, `Big win on a bet! You won ${money(back - stake)}... and already want to bet again.`), 'bad');
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
      SO.addStress(S, 3 * G.work.crowded(S)); // casa apertada para a família
      SO.addStress(S, -4 - (has(S, 'exercicio') ? 4 : 0) - (has(S, 'meditacao') ? 10 : 0) - (f.married ? 3 : 0));
      if (so.stress > 70) {
        for (const id of Object.keys(so.habits)) {
          if (HABITS[id].good && so.habits[id].state === 'formed' && G.rng.chance(0.1)) {
            delete so.habits[id];
            G.news(tr(`Com o stress lá em cima, você largou o hábito "${HABITS[id].n}".`, `With stress through the roof, you dropped the habit "${HABITS[id].n}".`), 'bad');
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
          G.news(tr(`Um golpista se aproveitou da sua fama de rico: ${money(x)} perdidos.`, `A con artist took advantage of your rich reputation: ${money(x)} lost.`), 'bad');
        } else {
          so.prestige = Math.max(0, so.prestige - 3);
          so.visibility *= 0.8;
          G.politics.addImage(S, -5);
          G.news(tr('Uma coluna social te chama de "novo-rico". Seu prestígio sofre.', 'A society column calls you "nouveau riche". Your prestige suffers.'), 'bad');
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
          G.alert(S, tr(`PÂNICO: a bolsa caiu ${G.fmt.pct(-r60, 0)} em dois meses. Vender tudo antes que piore?`,
            `PANIC: the market fell ${G.fmt.pct(-r60, 0)} in two months. Sell everything before it gets worse?`), 'bad');
        } else if (G.rng.chance(0.04)) {
          const options = Object.keys(HABITS).filter(id => !HABITS[id].good && !so.habits[id]);
          if (options.length) {
            const id = G.rng.item(options);
            so.pending = { type: 'tempt', id, until: S.day + 30 };
            G.alert(S, `${tr('Tentação', 'Temptation')}: ${HABITS[id].offer}`, 'hint');
          }
        }
      }
    },
  };
})();

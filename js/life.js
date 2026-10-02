(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  // Vida fora do trabalho: hobbies, coleções, férias, cidade, casa própria, segunda casa, saúde, pet,
  // bem-estar (que também vira legado) e a retrospectiva de cada ano. Valores em R$ de 2026.
  const money = v => G.fmt.money(v);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pi = S => S.macro.priceIndex;

  // energy = energia/dia; cost = R$/mês; stress e well por mês (well = pontos no índice de bem-estar).
  const HOBBIES = {
    corrida: { n: tr('Corrida de rua', 'Road running'), energy: 3, cost: 150, stress: -3, well: 5,
      d: tr('−3 de stress por mês, vida um pouco mais longa e metade da perda de energia com a idade.', '−3 stress per month, a slightly longer life and half the energy loss with age.') },
    musica: { n: tr('Tocar um instrumento', 'Play an instrument'), energy: 2, cost: 300, stress: -4, well: 5, d: tr('−4 de stress por mês.', '−4 stress per month.') },
    fotografia: { n: tr('Fotografia', 'Photography'), energy: 2, cost: 400, stress: -2, well: 4, vis: 0.3,
      d: tr('−2 de stress e +0,3 de visibilidade por mês.', '−2 stress and +0.3 visibility per month.') },
    pesca: { n: tr('Pesca', 'Fishing'), energy: 2, cost: 500, stress: -4, well: 5,
      d: tr('−4 de stress por mês. O melhor lugar para pensar em nada.', '−4 stress per month. The best place to think about nothing.') },
    vinho: { n: tr('Confraria de vinhos', 'Wine club'), energy: 1, cost: 1500, stress: -2, well: 4, prest: 0.3,
      d: tr('−2 de stress e +0,3 de prestígio por mês.', '−2 stress and +0.3 prestige per month.') },
    culinaria: { n: tr('Cozinhar', 'Cooking'), energy: 2, cost: 300, stress: -3, well: 5, costMult: 0.97,
      d: tr('−3 de stress por mês e custo de vida −3% (menos delivery).', '−3 stress per month and cost of living −3% (less takeout).') },
  };

  // Coleções: o valor segue um índice oculto (ver assets.js). Lotes com preço, visibilidade e prestígio.
  const COLLECTIONS = {
    arte: { n: tr('Arte', 'Art'), asset: 'arte',
      lots: tr(['Gravura de um artista promissor', 'Tela de um modernista', 'Obra de um mestre'], ['Print by a promising artist', 'Canvas by a modernist', 'Work by an old master']) },
    vinhos: { n: tr('Vinhos raros', 'Rare wines'), asset: 'vinhos',
      lots: tr(['Caixas de grandes safras', 'Adega de colecionador', 'Garrafas históricas'], ['Cases of great vintages', 'A collector\'s cellar', 'Historic bottles']) },
    classicos: { n: tr('Carros clássicos', 'Classic cars'), asset: 'classicos',
      lots: tr(['Fusca 1968 restaurado', 'Mercedes dos anos 60', 'Ferrari clássica'], ['Restored 1968 VW Beetle', '1960s Mercedes', 'Classic Ferrari']) },
  };
  const LOTS = [{ cost: 50000, vis: 1, prest: 0.3 }, { cost: 500000, vis: 4, prest: 2 }, { cost: 5e6, vis: 15, prest: 8 }];
  const AUCTION_FEE = 0.1;

  const DESTINATIONS = [
    { id: 'praia', n: tr('Praia no Nordeste', 'Beach in northeastern Brazil'), cost: 6000, days: 10, stress: -15, vis: 0 },
    { id: 'mochilao', n: tr('Mochilão pela América do Sul', 'Backpacking across South America'), cost: 12000, days: 20, stress: -20, vis: 0.5 },
    { id: 'europa', n: tr('Europa', 'Europe'), cost: 40000, days: 15, stress: -25, vis: 2 },
    { id: 'japao', n: tr('Japão', 'Japan'), cost: 60000, days: 15, stress: -25, vis: 2 },
    { id: 'safari', n: tr('Safári na África', 'African safari'), cost: 90000, days: 12, stress: -30, vis: 3 },
    { id: 'antartida', n: tr('Expedição à Antártida', 'Antarctic expedition'), cost: 180000, days: 15, stress: -35, vis: 5 },
  ];

  const CITIES = {
    bh: { n: 'Belo Horizonte', cost: 1, sal: 1, rep: 0, stress: 0, well: 0, d: tr('Onde tudo começou.', 'Where it all began.') },
    sp: { n: 'São Paulo', cost: 1.35, sal: 1.25, rep: 0.3, stress: 2, well: -2,
      d: tr('Salário +25% e +0,3 de reputação por mês, mas custo +35% e mais stress.', 'Salary +25% and +0.3 reputation per month, but costs +35% and more stress.') },
    interior: { n: tr('Interior', 'Countryside town'), cost: 0.75, sal: 0.85, rep: 0, stress: -2, well: 2,
      d: tr('Custo −25%, salário −15%, vida mais calma.', 'Costs −25%, salary −15%, a calmer life.') },
    litoral: { n: tr('Litoral', 'Coast'), cost: 1, sal: 0.9, rep: 0, stress: -3, well: 4,
      d: tr('Salário −10%, mas mar todo dia: menos stress e mais bem-estar.', 'Salary −10%, but the sea every day: less stress and more well-being.') },
  };
  const HOME_SHARE = 0.4; // parte do custo de vida que é moradia
  // O imóvel precisa valer 80× o custo de vida mensal pagando aluguel (padrão, família, cidade e hábitos incluídos):
  // assim o aluguel que se deixa de pagar (40% do custo) equivale a 0,5% ao mês do valor do imóvel, ~6% ao ano,
  // em linha com o aluguel dos imóveis residenciais do jogo (kitnet 6%, apartamento 4,5%).
  const HOME_MIN = 80;

  const SECOND = [
    { id: 'praia', n: tr('Casa de praia', 'Beach house'), base: 900000 },
    { id: 'sitio', n: tr('Sítio de fim de semana', 'Weekend country house'), base: 1500000 },
  ];

  const PLANS = {
    nenhum: { n: tr('Sem plano', 'No plan'), cost: 0, med: 1 },
    basico: { n: tr('Plano básico', 'Basic plan'), cost: 600, med: 0.3 },
    premium: { n: tr('Plano premium', 'Premium plan'), cost: 2500, med: 0.05 },
  };

  const PET_NAMES = tr(['Paçoca', 'Biscoito', 'Luna', 'Thor', 'Mel', 'Pipoca', 'Bolinha', 'Nina', 'Fred', 'Amora'],
    ['Peanut', 'Cookie', 'Luna', 'Thor', 'Honey', 'Popcorn', 'Buddy', 'Nina', 'Fred', 'Berry']);
  const PET_COST = 400, PET_ADOPT = 2000;

  const L = G.life = {
    HOBBIES, COLLECTIONS, LOTS, DESTINATIONS, CITIES, SECOND, PLANS, HOME_MIN, HOME_SHARE,
    init: () => ({
      hobbies: {}, collections: [], second: [], away: 0, vacYear: null, lastDest: null, bucket: {},
      city: 'bh', health: 'nenhum', healthBonus: false, pet: null,
      well: 50, wellSum: 0, wellN: 0, yearWellSum: 0, yearWellN: 0, retro: null, cvm: null, cd: {},
    }),

    // Nome do último destino de férias (saves antigos guardam o nome em vez do id).
    destName: v => (DESTINATIONS.find(d => d.id === v) || { n: v }).n,

    // ---------- efeitos consultados por outros módulos ----------
    city: S => CITIES[S.life.city] || CITIES.bh,
    salaryMult: S => L.city(S).sal,
    costMult(S) {
      let m = L.city(S).cost;
      if (S.life.hobbies.culinaria) m *= HOBBIES.culinaria.costMult;
      return m;
    },
    homeMult: S => (L.homeOk(S) ? 1 - HOME_SHARE : 1),
    medMult: S => PLANS[S.life.health].med,
    // Perda de energia máxima com a idade: 1 por ano depois dos 45, até 30. Exercício ou corrida cortam pela metade.
    ageDrain(S) {
      const lost = clamp(G.legacy.age(S) - 45, 0, 30);
      return Math.floor(lost * (G.social.has(S, 'exercicio') || S.life.hobbies.corrida ? 0.5 : 1));
    },
    away: S => S.life.away > 0,
    monthlyCost(S) {
      const lf = S.life;
      let t = PLANS[lf.health].cost * pi(S) + (lf.pet ? PET_COST * pi(S) : 0);
      for (const id in lf.hobbies) t += HOBBIES[id].cost * pi(S);
      for (const h of lf.second) if (!h.selling) t += L.value(S, h) * 0.001;
      return t;
    },
    hobbyDrain: S => Object.keys(S.life.hobbies).reduce((s, id) => s + HOBBIES[id].energy, 0) + (S.life.pet ? 1 : 0),

    // ---------- patrimônio: coleções e segundas casas ----------
    value: (S, h) => h.paid * (S.market.prices[h.asset] / h.ix),
    equity(S) {
      if (!S.life) return 0;
      let t = 0;
      for (const h of S.life.collections) t += L.value(S, h);
      for (const h of S.life.second) t += L.value(S, h);
      return t;
    },

    // ---------- casa própria ----------
    home: S => S.realty.find(h => h.home),
    homeMin: S => HOME_MIN * G.work.rentCost(S),
    // Um imóvel serve de casa se for residencial, couber a família e valer o bastante para o padrão de vida.
    // Devolve '' se serve, ou o motivo: 'comercial', 'familia' ou 'valor'.
    homeProblem(S, h) {
      const p = G.realty.prop(h.pid);
      if (!p.people) return 'comercial';
      if (p.people < G.social.familySize(S)) return 'familia';
      return G.realty.value(S, h) < L.homeMin(S) ? 'valor' : '';
    },
    homeOk(S) {
      const h = L.home(S);
      return !!h && !L.homeProblem(S, h);
    },
    moveIn(S, i) {
      const h = S.realty[i];
      if (!h || h.selling || h.occupied || h.home) return;
      if (L.homeProblem(S, h)) return;
      for (const x of S.realty) x.home = false;
      h.home = true;
      G.social.addStress(S, -5);
      G.news(tr(`Você se mudou para o seu próprio imóvel (${G.realty.prop(h.pid).n.toLowerCase()}). Chega de aluguel.`,
        `You moved into your own property (${G.realty.prop(h.pid).n.toLowerCase()}). No more rent.`), 'good');
    },
    moveOut(S) {
      const h = L.home(S);
      if (h) h.home = false;
    },
    // Mudar de cidade custa como subir de padrão: 2 meses do custo novo.
    cityCost: (S, id) => 2 * G.work.LIFESTYLE[S.lifestyle].cost * pi(S) * CITIES[id].cost,
    moveCity(S, id) {
      if (!CITIES[id] || id === S.life.city) return;
      const c = L.cityCost(S, id);
      if (S.cash < c) return;
      S.cash -= c;
      G.social.spent(S, c);
      S.life.city = id;
      G.news(tr(`Mudança de cidade: agora você mora em ${CITIES[id].n}.${S.job.employed ? ' A empresa aceitou a transferência.' : ''}`,
        `New city: you now live in ${CITIES[id].n}.${S.job.employed ? ' Your company approved the transfer.' : ''}`), 'story');
    },

    // ---------- hobbies ----------
    hobbySlots: S => 2 + (G.social.tierIdx(S) >= 4 ? 1 : 0),
    startHobby(S, id) {
      if (!HOBBIES[id] || S.life.hobbies[id] || Object.keys(S.life.hobbies).length >= L.hobbySlots(S)) return;
      S.life.hobbies[id] = { missed: 0, since: S.day };
      G.news(tr(`Novo hobby: ${HOBBIES[id].n.toLowerCase()}.`, `New hobby: ${HOBBIES[id].n.toLowerCase()}.`), 'good');
    },
    stopHobby(S, id) { delete S.life.hobbies[id]; },

    // ---------- coleções ----------
    lotCost: (S, i) => LOTS[i].cost * pi(S),
    buyLot(S, kind, i) {
      const c = COLLECTIONS[kind], lot = LOTS[i];
      if (!c || !lot || S.cash < L.lotCost(S, i)) return;
      const cost = L.lotCost(S, i);
      S.cash -= cost;
      S.life.collections.push({ kind, lot: i, asset: c.asset, paid: cost, cost, ix: S.market.prices[c.asset], selling: 0 });
      G.social.gain(S, lot.vis, lot.prest);
      G.news(tr(`Nova peça na coleção: ${c.lots[i].toLowerCase()}.`, `New piece in the collection: ${c.lots[i]}.`), 'good');
    },
    sellLot(S, i) {
      const h = S.life.collections[i];
      if (!h || h.selling) return;
      h.selling = G.rng.int(30, 120);
      G.news(tr(`${COLLECTIONS[h.kind].lots[h.lot]} vai a leilão. A casa de leilões cobra 10%.`,
        `${COLLECTIONS[h.kind].lots[h.lot]} goes to auction. The auction house charges 10%.`), 'info');
    },

    // ---------- férias ----------
    canVacation(S, d) {
      const year = G.cal.of(S.day).year;
      return S.life.vacYear !== year && !L.away(S) && S.cash >= L.vacationCost(S, d);
    },
    vacationCost: (S, d) => (d.id === 'praia' && S.life.second.some(h => h.id === 'praia' && !h.selling) ? 0 : d.cost * pi(S)),
    vacation(S, id) {
      const d = DESTINATIONS.find(x => x.id === id);
      if (!d || !L.canVacation(S, d)) return;
      const cost = L.vacationCost(S, d);
      S.cash -= cost;
      G.social.spent(S, cost);
      Object.assign(S.life, { away: d.days, vacYear: G.cal.of(S.day).year, lastDest: d.id });
      S.life.bucket[id] = true;
      G.social.addStress(S, d.stress);
      G.social.gain(S, d.vis, 0);
      G.news(tr(`Férias: ${d.n}${cost ? '' : ' (na sua casa de praia)'}. ${d.days} dias longe de tudo.`,
        `Vacation: ${d.n}${cost ? '' : ' (at your beach house)'}. ${d.days} days away from it all.`), 'good');
    },

    // ---------- segunda casa ----------
    secondPrice: (S, s) => s.base * S.market.prices.imob / 100,
    buySecond(S, id) {
      const s = SECOND.find(x => x.id === id);
      if (!s || S.life.second.some(h => h.id === id)) return;
      const p = L.secondPrice(S, s), total = p * (1 + G.realty.ITBI);
      if (S.cash < total) return;
      S.cash -= total;
      G.social.spent(S, p * G.realty.ITBI);
      S.life.second.push({ id, asset: 'imob', paid: p, cost: total, ix: S.market.prices.imob, selling: 0 });
      G.news(tr(`Você comprou: ${s.n.toLowerCase()}. Os fins de semana nunca mais foram os mesmos.`,
        `You bought: ${s.n.toLowerCase()}. Weekends were never the same again.`), 'good');
    },
    sellSecond(S, i) {
      const h = S.life.second[i];
      if (!h || h.selling) return;
      h.selling = G.rng.int(30, 180);
      G.news(tr(`${SECOND.find(x => x.id === h.id).n} anunciada para venda.`, `${SECOND.find(x => x.id === h.id).n} listed for sale.`), 'info');
    },

    // ---------- saúde e pet ----------
    setPlan(S, id) {
      if (!PLANS[id]) return;
      S.life.health = id;
      if (id === 'premium' && !S.life.healthBonus) {
        S.life.healthBonus = true;
        S.lifespan += 2; // check-ups e medicina preventiva
      }
    },
    adopt(S) {
      if (S.life.pet || S.cash < PET_ADOPT * pi(S)) return;
      S.cash -= PET_ADOPT * pi(S);
      const name = G.rng.item(PET_NAMES);
      S.life.pet = { name, born: S.day, dies: S.day + G.rng.int(10, 15) * 360 };
      G.news(tr(`Você adotou um cachorro: ${name}. A casa ficou mais barulhenta e mais feliz.`, `You adopted a dog: ${name}. The house got louder and happier.`), 'good');
    },

    // ---------- bem-estar ----------
    wellbeing(S) {
      const so = S.social, f = so.family, lf = S.life;
      const goodHabits = Object.keys(so.habits).filter(id => G.social.HABITS[id].good && G.social.has(S, id)).length;
      let w = 50 - so.stress / 2 + (f.married ? 8 : 0) + Math.min(12, 4 * f.kids) + 2 * goodHabits
        + (lf.vacYear === G.cal.of(S.day).year ? 8 : 0) + (lf.pet ? 4 : 0) + (lf.second.length ? 4 : 0)
        + (lf.health !== 'nenhum' ? 3 : 0) + (lf.collections.length ? 2 : 0) + L.city(S).well;
      for (const id in lf.hobbies) w += HOBBIES[id].well * (lf.hobbies[id].lastRate ?? 1);
      if (!S.job.employed && !S.job.retired) w -= 10;
      if (S.cash < 0) w -= 10;
      w -= 5 * G.work.crowded(S);
      return clamp(w, 0, 100);
    },
    avgWell: S => (S.life && S.life.wellN ? S.life.wellSum / S.life.wellN : 0),
    // Pontos de legado por uma vida boa: média 70 por 60 anos ≈ 22 pontos.
    wellPoints(S) {
      const years = (S.day - S.birthDay) / 360;
      return Math.floor(Math.max(0, L.avgWell(S) - 40) / 2 * years / 40);
    },

    // ---------- dia e mês ----------
    daily(S) {
      const lf = S.life;
      if (lf.away > 0) {
        lf.away--;
        S.energy = G.work.emax(S);
        if (!lf.away) G.news(tr('De volta das férias, com a cabeça no lugar.', 'Back from vacation, with a clear head.'), 'info');
      }
      for (const id in lf.hobbies) {
        const e = HOBBIES[id].energy;
        if (S.energy >= e) S.energy -= e;
        else lf.hobbies[id].missed++;
      }
      if (lf.pet && S.energy >= 1) S.energy -= 1;
      for (const list of [lf.collections, lf.second]) {
        for (let i = list.length - 1; i >= 0; i--) {
          const h = list[i];
          if (!h.selling || --h.selling > 0) continue;
          const coll = list === lf.collections;
          const gross = L.value(S, h) * (1 - (coll ? AUCTION_FEE : G.realty.BROKER));
          const net = gross - G.tax.flat(S, gross - h.cost);
          S.cash += net;
          list.splice(i, 1);
          const n = coll ? COLLECTIONS[h.kind].lots[h.lot] : SECOND.find(x => x.id === h.id).n;
          G.news(tr(`${n} vendido(a) por ${money(net)} líquidos.`, `${n} sold for ${money(net)} net.`), net >= h.cost ? 'good' : 'bad');
        }
      }
    },

    monthly(S, c) {
      const lf = S.life, so = S.social, city = L.city(S);
      S.cash -= L.monthlyCost(S);
      S.reputation += city.rep;
      G.social.addStress(S, city.stress);
      // Hobbies: o efeito é proporcional aos dias em que houve energia para eles.
      for (const id in lf.hobbies) {
        const h = HOBBIES[id], x = lf.hobbies[id], rate = Math.max(0, 1 - x.missed / 30);
        x.lastRate = rate;
        x.missed = 0;
        G.social.addStress(S, h.stress * rate);
        G.social.gain(S, (h.vis || 0) * rate, (h.prest || 0) * rate);
      }
      if (lf.second.length) G.social.addStress(S, -3);
      if (lf.pet) {
        G.social.addStress(S, -3);
        if (S.day >= lf.pet.dies) {
          G.social.addStress(S, 15);
          G.alert(S, tr(`${lf.pet.name} morreu, depois de ${Math.round((S.day - lf.pet.born) / 360)} anos ao seu lado. A casa ficou em silêncio.`,
            `${lf.pet.name} died, after ${Math.round((S.day - lf.pet.born) / 360)} years by your side. The house went quiet.`), 'bad');
          lf.pet = null;
        }
      }
      if (c.month === 1) {
        if (lf.hobbies.corrida && S.lifespan < S.baseLifespan + 8) S.lifespan += 0.1;
        // Um ano inteiro sem férias cobra seu preço.
        if (S.day - S.birthDay > 360 && lf.vacYear !== c.year - 1) {
          G.social.addStress(S, 10);
          G.news(tr('Um ano inteiro sem férias. O cansaço acumulou.', 'A whole year without a vacation. The fatigue piled up.'), 'bad');
        }
        L.retrospective(S, c);
      }
      lf.well = L.wellbeing(S);
      lf.wellSum += lf.well;
      lf.wellN++;
      lf.yearWellSum += lf.well;
      lf.yearWellN++;
    },

    // ---------- retrospectiva ----------
    snapshot(S) {
      const st = S.stats;
      return {
        day: S.day, nw: G.portfolio.netWorth(S), real: G.portfolio.netWorth(S) / pi(S),
        work: st.workIncome || 0, div: st.dividends || 0, rent: st.rent || 0, biz: st.bizIncome || 0,
        fund: st.fundIncome || 0, tax: S.tax.paid,
      };
    },
    retrospective(S, c) {
      const lf = S.life, now = L.snapshot(S), was = lf.retro;
      lf.retro = now;
      const well = lf.yearWellN ? lf.yearWellSum / lf.yearWellN : lf.well;
      lf.yearWellSum = 0;
      lf.yearWellN = 0;
      if (!was || S.settings.retro === false) return;
      const year = c.year - 1, d = k => now[k] - was[k];
      const pick = kind => S.log.find(e => e.d >= was.day && e.k === kind);
      const marks = [pick('unlock'), pick('good'), pick('bad')].filter(Boolean).map(e => `${G.fmt.date(e.d)} · ${G.i18n.show(e.t, e.t2, e.l)}`);
      const growth = was.real > 0 ? now.real / was.real - 1 : 0;
      const verdict = well >= 70 ? tr('Um ano bom de viver.', 'A good year to be alive.') : well >= 50 ? tr('Um ano razoável.', 'A decent year.')
        : well >= 35 ? tr('Um ano pesado.', 'A heavy year.') : tr('Um ano difícil, daqueles que a gente quer esquecer.', 'A hard year, the kind you want to forget.');
      G.popup(S, tr(`Retrospectiva de ${year}`, `${year} in review`), [
        verdict,
        [tr('Patrimônio', 'Net worth'), `${money(was.nw)} → ${money(now.nw)} (${G.fmt.signedPct(growth, 1)} ${tr('real', 'real')})`],
        [tr('Salários', 'Salaries'), money(d('work'))],
        [tr('Dividendos e aluguéis', 'Dividends and rents'), money(d('div') + d('rent'))],
        [tr('Empresas e gestora', 'Businesses and asset manager'), money(d('biz') + d('fund'))],
        [tr('IR pago', 'Income tax paid'), money(d('tax'))],
        [tr('Bem-estar médio', 'Average well-being'), G.fmt.num(well, 0)],
        [tr('Férias', 'Vacation'), lf.vacYear === year && lf.lastDest ? L.destName(lf.lastDest) : tr('não tirou', 'none taken')],
        ...marks,
      ]);
    },
  };
})();

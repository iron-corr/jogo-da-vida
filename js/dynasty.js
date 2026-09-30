(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  // Dinastia: sobrenome da família, o líder atual (você), cônjuge, filhos, anciãos (gerações aposentadas) e parentes.
  // Cada filho nasce com aptidões (potencial, 0 a 100) em cinco áreas e um sonho de carreira. A educação que você
  // escolhe desenvolve as habilidades; forçar uma área longe do sonho desgasta a relação. O herdeiro escolhido
  // assume com as habilidades que tem; os outros filhos seguem carreira e ajudam a família.
  const NAMES = ['Ana', 'Arthur', 'Beatriz', 'Bernardo', 'Carla', 'Caio', 'Daniela', 'Davi', 'Eduarda', 'Enzo', 'Fernanda', 'Felipe',
    'Gabriela', 'Gabriel', 'Helena', 'Heitor', 'Isabela', 'Igor', 'Júlia', 'João', 'Laura', 'Lucas', 'Luísa', 'Mateus', 'Mariana',
    'Miguel', 'Natália', 'Nicolas', 'Olívia', 'Otávio', 'Paula', 'Pedro', 'Rafaela', 'Rafael', 'Sofia', 'Samuel', 'Valentina', 'Theo',
    'Yasmin', 'Vinícius'];
  const SURNAMES = ['Silva', 'Souza', 'Oliveira', 'Pereira', 'Costa', 'Carvalho', 'Ribeiro', 'Martins', 'Barbosa', 'Cardoso', 'Moreira', 'Freitas'];
  const AREAS = [
    { id: 'fin', n: tr('Finanças', 'Finance'), career: tr('investidor(a)', 'investor') },
    { id: 'neg', n: tr('Negócios', 'Business'), career: tr('empresário(a)', 'entrepreneur') },
    { id: 'pol', n: tr('Política', 'Politics'), career: tr('político(a)', 'politician') },
    { id: 'cie', n: tr('Ciência', 'Science'), career: tr('cientista', 'scientist') },
    { id: 'art', n: tr('Artes', 'Arts'), career: tr('artista', 'artist') },
  ];
  const ADULT = 22, FOCUS_COST = 3000, TIME_ENERGY = 20, TIME_CD = 30;
  const money = v => G.fmt.money(v);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pi = S => S.macro.priceIndex;
  const area = id => AREAS.find(a => a.id === id);

  const D = G.dynasty = {
    NAMES, SURNAMES, AREAS, ADULT, FOCUS_COST, TIME_ENERGY,
    area,
    name: () => G.rng.item(NAMES),
    surname: S => (S.legacy && S.legacy.surname) || 'Silva',
    fullName: (S, first) => `${first} ${D.surname(S)}`,
    familyName: S => tr(`Família ${D.surname(S)}`, `The ${D.surname(S)} family`),

    // ---------- filhos ----------
    newChild(S) {
      const apt = {};
      for (const a of AREAS) apt[a.id] = G.rng.int(20, 70);
      const gift = G.rng.item(AREAS).id;
      apt[gift] = Math.min(100, apt[gift] + 30);
      const skill = Object.fromEntries(AREAS.map(a => [a.id, 0]));
      // Nome diferente do líder, do cônjuge e dos irmãos.
      const taken = new Set([S.me && S.me.name, S.social.family.spouse, ...D.children(S).map(c => c.name)]);
      let name = D.name();
      for (let i = 0; i < 10 && taken.has(name); i++) name = D.name();
      return { id: `${S.day}-${G.rng.int(0, 1e6)}`, name, born: S.day, apt, skill, focus: null, dream: D.best(apt), bond: 60, cd: 0 };
    },
    best: obj => AREAS.reduce((b, a) => (obj[a.id] > obj[b] ? a.id : b), AREAS[0].id),
    // Mantém a lista de filhos do tamanho de family.kids (saves antigos e testes só guardam o número).
    children(S) {
      const f = S.social.family, list = f.children || (f.children = []);
      for (let i = list.length; i < f.kids; i++) {
        // Filhos de saves antigos: aptidões fixas, idades espaçadas de 2 anos e a educação básica que já teriam.
        const apt = Object.fromEntries(AREAS.map((a, j) => [a.id, 30 + ((i * 17 + j * 23) % 50)]));
        const age = 2 * i, grown = 1 - Math.exp(-0.048 * Math.min(age, ADULT));
        const taken = new Set([S.me && S.me.name, f.spouse, ...list.map(c => c.name)]);
        let n = (i * 7 + 3) % NAMES.length;
        while (taken.has(NAMES[n])) n = (n + 1) % NAMES.length;
        list.unshift({ id: `old-${i}`, name: NAMES[n], born: S.day - age * 360, apt,
          skill: Object.fromEntries(AREAS.map(a => [a.id, apt[a.id] * grown])), focus: null, dream: D.best(apt), bond: 60, cd: 0 });
      }
      return list;
    },
    age: (S, c) => (S.day - c.born) / 360,
    atHome: S => D.children(S).filter(c => D.age(S, c) < ADULT).length,
    underSchool: S => D.children(S).filter(c => D.age(S, c) < 18).length,
    byId: (S, id) => D.children(S).find(c => c.id === id),
    setFocus(S, id, a) {
      const c = D.byId(S, id);
      if (c && D.age(S, c) < ADULT) c.focus = area(a) ? a : null;
    },
    canSpendTime: (S, c) => !!c && S.day >= (c.cd || 0) && S.energy >= TIME_ENERGY && S.burnout <= 0,
    spendTime(S, id) {
      const c = D.byId(S, id);
      if (!D.canSpendTime(S, c)) return;
      S.energy -= TIME_ENERGY;
      c.bond = clamp(c.bond + 6, 0, 100);
      c.cd = S.day + TIME_CD;
      G.social.addStress(S, -2);
    },
    setHeir(S, id) { if (D.byId(S, id)) S.social.family.heir = id; },
    // Herdeiro: o escolhido; se ninguém foi escolhido, quem tem mais habilidade (a relação pesa).
    heir(S) {
      const list = D.children(S);
      if (!list.length) return null;
      const chosen = list.find(c => c.id === S.social.family.heir);
      if (chosen) return chosen;
      const score = c => AREAS.reduce((s, a) => s + c.skill[a.id], 0) * (c.bond < 30 ? 0.6 : 1) + D.age(S, c);
      return list.reduce((b, c) => (score(c) > score(b) ? c : b), list[0]);
    },
    focusCost: S => D.children(S).filter(c => c.focus && D.age(S, c) < ADULT).length * FOCUS_COST * pi(S),

    // O que o herdeiro traz ao assumir: conhecimento, reputação, influência, prestígio, cargo inicial e pesquisas.
    heirBonus(c) {
      const k = c.bond < 30 ? 0.6 : 1, s = a => c.skill[a] * k;
      const research = [];
      if (s('fin') >= 40) research.push('edu_fin', 'orcamento');
      if (s('fin') >= 70) research.push('rv1');
      if (s('neg') >= 60) research.push('produtividade', 'negociacao');
      if (s('pol') >= 50) research.push('etiqueta');
      if (s('pol') >= 70) research.push('comunicacao');
      if (s('cie') >= 50) research.push('produtividade', 'leitura');
      if (s('art') >= 60) research.push('etiqueta');
      return {
        knowledge: s('fin') * 2 + s('cie') * 5, reputation: s('neg') / 4, influence: s('pol') * 1.5, image: s('pol') / 10,
        prestige: s('art') / 4, visibility: s('art') / 10, level: Math.min(4, Math.floor(Math.max(s('fin'), s('neg')) / 25)), research,
      };
    },
    applyHeir(next, c) {
      const b = D.heirBonus(c);
      next.knowledge += b.knowledge;
      next.reputation += b.reputation;
      next.pol.influence += b.influence;
      next.pol.image += b.image;
      next.social.prestige += b.prestige;
      next.social.visibility += b.visibility;
      next.job.level = Math.max(next.job.level, b.level);
      for (const id of b.research) next.research[id] = true;
    },
    // Adultos da família (filhos crescidos que não lideram e parentes) seguem a carreira dos sonhos e ajudam.
    careerHelp(S, dream, skill) {
      const s = skill / 100;
      if (dream === 'pol') S.pol.influence += s;
      else if (dream === 'neg') { S.reputation += 0.5 * s; S.social.prestige += 0.1 * s; }
      else if (dream === 'fin') S.knowledge += 2 * s;
      else if (dream === 'cie') { S.knowledge += 3 * s; S.social.prestige += 0.1 * s; }
      else if (dream === 'art') G.social.gain(S, 0.5 * s, 0.2 * s);
    },
    relatives: S => S.legacy.relatives || (S.legacy.relatives = []),

    // ---------- mês ----------
    monthly(S) {
      const f = S.social.family;
      let cost = 0;
      for (const c of D.children(S)) {
        const age = D.age(S, c);
        if (age < ADULT) {
          // Educação: cada habilidade cresce em direção à aptidão; o foco (aulas, cursos, intercâmbio) acelera.
          for (const a of AREAS) {
            let rate = 0.004 + (c.focus === a.id ? 0.012 : 0);
            if (f.school && age < 18) rate *= 1.5;
            c.skill[a.id] += (c.apt[a.id] - c.skill[a.id]) * rate;
          }
          if (c.focus) cost += FOCUS_COST * pi(S);
          c.bond = clamp(c.bond + (!c.focus ? 0.1 : c.focus === c.dream ? 0.3 : -0.6), 0, 100);
          if (c.focus && c.focus !== c.dream && c.bond >= 60 && G.rng.chance(0.02)) {
            c.dream = c.focus;
            G.news(tr(`${c.name} passou a sonhar com a carreira de ${area(c.dream).career}. Sua influência pesou.`,
              `${c.name} now dreams of a career as a ${area(c.dream).career}. Your influence paid off.`), 'good');
          }
          if (age + 1 / 12 >= ADULT) {
            c.focus = null;
            G.news(tr(`${c.name} fez ${ADULT} anos, saiu de casa e segue a carreira de ${area(c.dream).career}.`,
              `${c.name} turned ${ADULT}, moved out and is pursuing a career as a ${area(c.dream).career}.`), 'story');
          }
        } else D.careerHelp(S, c.dream, c.skill[c.dream]);
      }
      S.cash -= cost;
      const rel = D.relatives(S);
      for (let i = rel.length - 1; i >= 0; i--) {
        const r = rel[i];
        if ((S.day - r.born) / 360 < ADULT) r.skill += ((r.apt || r.skill) - r.skill) * 0.004; // ainda estudando
        else D.careerHelp(S, r.dream, r.skill);
        if ((S.day - r.born) / 360 >= r.dies) {
          rel.splice(i, 1);
          G.news(tr(`Morreu ${r.name}, da ${r.gen}ª geração, aos ${Math.floor(r.dies)} anos.`, `${r.name}, of generation ${r.gen}, died at age ${Math.floor(r.dies)}.`), 'story');
        }
      }
    },

    // Na sucessão: os irmãos do novo líder viram parentes da dinastia e seguem ajudando.
    passOn(S, heir) {
      const rel = D.relatives(S);
      for (const c of D.children(S)) {
        if (c === heir) continue;
        rel.push({ name: c.name, born: c.born, dream: c.dream, skill: c.skill[c.dream], apt: c.apt[c.dream], gen: S.legacy.generation + 1, dies: G.rng.int(75, 92) });
      }
    },
  };
})();

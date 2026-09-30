(function () {
  const G = globalThis.G = globalThis.G || {};

  // Cartas de escolha: momentos da carreira e dilemas éticos que pedem uma decisão.
  // make(S) devolve os dados da carta (valores fixados quando ela aparece); cada opção tem apply(S, d).
  // def = opção escolhida se o prazo vencer; cd = dias até a mesma carta poder voltar.
  const money = v => G.fmt.money(v);
  const P = () => G.portfolio;
  const employed = S => S.job.employed && !S.job.sabbatical;
  const track = S => S.job.track || 'corporativo';

  const CHOICES = [
    // ---------- carreira ----------
    {
      id: 'headhunter', title: 'Proposta de headhunter', cd: 720, weight: 3,
      when: S => employed(S) && S.reputation >= 18,
      make: S => ({ sal: G.work.salary(S) / G.work.trackMult(S) * 1.2 }), // de volta ao corporativo, +20%
      text: (S, d) => `Uma headhunter liga: uma concorrente quer você no mesmo cargo, ganhando ${money(d.sal)}/mês. ` +
        'Empresa nova, reputação a reconstruir.',
      options: [
        { label: 'Aceitar', apply(S) {
          S.job.bonus = (S.job.bonus || 1) * 1.2;
          S.job.track = 'corporativo';
          S.job.since = S.day;
          S.reputation *= 0.75;
          G.news(`Você trocou de empresa. Novo salário: ${money(G.work.salary(S))}.`, 'good');
        } },
        { label: 'Recusar', apply(S) { S.reputation += 2; G.news('Você recusou a proposta. Seu chefe ficou sabendo e gostou.', 'info'); } },
      ],
      def: 1,
    },
    {
      id: 'startup', title: 'Convite de uma startup', cd: 1440, weight: 2,
      when: S => employed(S) && S.job.level >= 2 && track(S) === 'corporativo',
      make: S => ({ name: G.angel.newName(), equity: 24 * G.work.salary(S) * 0.4 }),
      text: (S, d) => `A ${d.name} quer você como sócio executivo: salário 40% menor, mas uma fatia da empresa ` +
        `(hoje avaliada em ${money(d.equity)}). A maioria das startups quebra; algumas mudam a vida de quem estava lá.`,
      options: [
        { label: 'Entrar na startup', apply(S, d) {
          const f = G.angel.fate();
          S.job.track = 'startup';
          S.job.since = S.day;
          S.angel.tickets.push({ name: d.name, amount: d.equity, day: S.day, exitDay: S.day + f.exit, mult: f.mult });
          G.news(`Você entrou na ${d.name}. Salário menor, adrenalina maior.`, 'story');
        } },
        { label: 'Ficar onde está', apply() { G.news('Você preferiu a estabilidade.', 'info'); } },
      ],
      def: 1,
    },
    {
      id: 'professor', title: 'Convite para dar aulas', cd: 1440, weight: 1,
      when: S => employed(S) && S.job.level >= 3 && track(S) !== 'academia',
      make: () => ({}),
      text: () => 'Uma universidade oferece uma vaga de professor em tempo integral: salário pela metade, mas vida mais calma, ' +
        'estudo todo dia e o respeito de ser "professor".',
      options: [
        { label: 'Virar professor', apply(S) {
          S.job.track = 'academia';
          S.job.since = S.day;
          G.news('Você trocou o escritório pela sala de aula.', 'story');
        } },
        { label: 'Recusar', apply() {} },
      ],
      def: 1,
    },

    // ---------- dilemas éticos ----------
    {
      id: 'sonegar', title: 'Proposta do sócio', cd: 1080, weight: 2,
      when: S => G.business.monthlyProfit(S) > 0,
      make: S => ({ x: Math.max(10000 * S.macro.priceIndex, 0.3 * 12 * G.business.monthlyProfit(S) / 0.85 * 0.15) }),
      text: (S, d) => `Seu sócio propõe "otimizar" a contabilidade das empresas: ${money(d.x)} a menos de imposto este ano. ` +
        'Ninguém precisa saber.',
      options: [
        { label: 'Sonegar', hint: '+ caixa, + sujeira', apply(S, d) {
          S.cash += d.x;
          S.pol.dirty += 1;
          G.news(`Você embolsou ${money(d.x)} que deveria ir para a Receita.`, 'bad');
        } },
        { label: 'Recusar', hint: '+3 de imagem', apply(S) { G.politics.addImage(S, 3); G.news('Você recusou a sonegação. O sócio resmungou.', 'good'); } },
      ],
      def: 1,
    },
    {
      id: 'credito', title: 'Levaram o seu crédito', cd: 720, weight: 2,
      when: S => employed(S),
      make: () => ({}),
      text: () => 'Um colega apresentou o seu projeto como se fosse dele, na frente da diretoria.',
      options: [
        { label: 'Confrontar', hint: '+3 de reputação, +8 de stress', apply(S) {
          S.reputation += 3;
          G.social.addStress(S, 8);
          G.news('Você expôs a situação. Foi desconfortável, mas todos sabem quem fez o trabalho.', 'good');
        } },
        { label: 'Deixar passar', hint: '−3 de reputação', apply(S) { S.reputation = Math.max(0, S.reputation - 3); } },
      ],
      def: 1,
    },
    {
      id: 'propina', title: 'Um envelope na mesa', cd: 1080, weight: 1,
      when: S => employed(S) && S.job.level >= 5,
      make: S => ({ x: 6 * G.work.salary(S) }),
      text: (S, d) => `Um fornecedor oferece ${money(d.x)} para você aprovar o contrato dele sem olhar muito.`,
      options: [
        { label: 'Aceitar', hint: '+ caixa, + sujeira', apply(S, d) {
          S.cash += d.x;
          S.pol.dirty += 1;
          G.news(`Você aceitou ${money(d.x)} por fora.`, 'bad');
        } },
        { label: 'Recusar e denunciar', hint: '+5 de imagem', apply(S) { G.politics.addImage(S, 5); S.reputation += 2; G.news('Você recusou a propina e avisou o compliance.', 'good'); } },
      ],
      def: 1,
    },
    {
      id: 'insider', title: 'Uma dica quente', cd: 1080, weight: 1,
      when: S => !!S.research.setores && S.cash > 20000 && !G.politics.blind(S),
      make: S => ({ sector: G.rng.item(G.events.SECTORS), x: 0.1 * S.cash }),
      text: (S, d) => `Um amigo de uma empresa de ${G.ASSETS[d.sector].short} conta, em off, que vem aí um anúncio que vai fazer as ações dispararem. ` +
        `Dá para comprar ${money(d.x)} antes de todo mundo.`,
      options: [
        { label: 'Comprar antes do anúncio', hint: 'ganho provável, + sujeira, risco de multa da CVM', apply(S, d) {
          P().buy(S, d.sector, d.x);
          G.market.addEffect(S, d.sector, 0.15, 5, 2);
          S.pol.dirty += 0.7;
          S.life.cvm = { sector: d.sector, day: S.day + G.rng.int(90, 540) };
          G.news(`Você comprou ${money(d.x)} em ${G.ASSETS[d.sector].short} antes do anúncio.`, 'bad');
        } },
        { label: 'Ignorar a dica', hint: '+1 de imagem', apply(S) { G.politics.addImage(S, 1); } },
      ],
      def: 1,
    },
    {
      id: 'tragedia', title: 'Tragédia no interior', cd: 1440, weight: 1,
      when: S => S.cash > 12 * G.work.cost(S),
      make: S => ({ x: Math.max(5000 * S.macro.priceIndex, 0.01 * G.portfolio.netWorth(S)) }),
      text: (S, d) => `Uma enchente destruiu uma cidade inteira. Campanhas de doação se espalham. Doar ${money(d.x)}?`,
      options: [
        { label: 'Doar', hint: 'prestígio e imagem', apply(S, d) { G.social.donate(S, d.x); G.politics.addImage(S, 2); } },
        { label: 'Não doar', apply() {} },
      ],
      def: 1,
    },
  ];

  const byId = id => CHOICES.find(c => c.id === id);

  const C = G.choices = {
    CHOICES, byId,
    ROLL: 0.06,
    // Sorteia uma carta elegível (fora do tempo de espera) e a coloca como decisão pendente.
    offer(S, id) {
      const c = byId(id);
      S.social.pending = { type: 'choice', id, until: S.day + 30, data: c.make(S) };
      G.alert(S, `${c.title}: ${c.text(S, S.social.pending.data)}`, 'hint');
    },
    roll(S) {
      if (S.social.pending || !G.rng.chance(C.ROLL)) return;
      const cd = S.life.cd, ok = CHOICES.filter(c => S.day >= (cd[c.id] || 0) && c.when(S));
      if (!ok.length) return;
      const w = {};
      for (const c of ok) w[c.id] = c.weight;
      C.offer(S, G.rng.pick(w));
    },
    // i = índice da opção; null = prazo vencido (opção padrão).
    resolve(S, p, i) {
      const c = byId(p.id);
      if (!c) return;
      const o = c.options[i === null || i === undefined || !c.options[i] ? c.def : i];
      S.life.cd[c.id] = S.day + c.cd;
      o.apply(S, p.data);
    },
    // Consequência atrasada da dica privilegiada: a CVM investiga (35% de chance de multa).
    monthly(S) {
      const cvm = S.life.cvm;
      if (cvm && S.day >= cvm.day) {
        S.life.cvm = null;
        if (G.rng.chance(0.35)) {
          const fine = Math.max(20000 * S.macro.priceIndex, 0.25 * G.portfolio.value(S, cvm.sector));
          S.cash -= fine;
          G.politics.addImage(S, -10);
          G.legacy.flag(S, 'escandalo');
          G.alert(S, `A CVM rastreou suas compras em ${G.ASSETS[cvm.sector].short} antes do anúncio. Multa de ${money(fine)} e seu nome nos jornais.`, 'bad');
        }
      }
      C.roll(S);
    },
  };
})();

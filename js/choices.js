(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

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
      id: 'headhunter', title: tr('Proposta de headhunter', 'Headhunter offer'), cd: 720, weight: 3,
      when: S => employed(S) && S.reputation >= 18,
      make: S => ({ sal: G.work.salary(S) / G.work.trackMult(S) * 1.2 }), // de volta ao corporativo, +20%
      text: (S, d) => tr(`Uma headhunter liga: uma concorrente quer você no mesmo cargo, ganhando ${money(d.sal)}/mês. ` +
        'Empresa nova, reputação a reconstruir.',
        `A headhunter calls: a competitor wants you in the same role, earning ${money(d.sal)}/month. ` +
        'New company, reputation to rebuild.'),
      options: [
        { label: tr('Aceitar', 'Accept'), apply(S) {
          S.job.bonus = (S.job.bonus || 1) * 1.2;
          S.job.track = 'corporativo';
          S.job.since = S.day;
          S.reputation *= 0.75;
          G.news(tr(`Você trocou de empresa. Novo salário: ${money(G.work.salary(S))}.`, `You switched companies. New salary: ${money(G.work.salary(S))}.`), 'good');
        } },
        { label: tr('Recusar', 'Decline'), apply(S) {
          S.reputation += 2;
          G.news(tr('Você recusou a proposta. Seu chefe ficou sabendo e gostou.', 'You turned down the offer. Your boss heard about it and liked it.'), 'info');
        } },
      ],
      def: 1,
    },
    {
      id: 'startup', title: tr('Convite de uma startup', 'A startup invitation'), cd: 1440, weight: 2,
      when: S => employed(S) && S.job.level >= 2 && track(S) === 'corporativo',
      make: S => ({ name: G.angel.newName(), equity: 24 * G.work.salary(S) * 0.4 }),
      text: (S, d) => tr(`A ${d.name} quer você como sócio executivo: salário 40% menor, mas uma fatia da empresa ` +
        `(hoje avaliada em ${money(d.equity)}). A maioria das startups quebra; algumas mudam a vida de quem estava lá.`,
        `${d.name} wants you as an executive partner: 40% lower salary, but a slice of the company ` +
        `(valued at ${money(d.equity)} today). Most startups fail; a few change the lives of those who were there.`),
      options: [
        { label: tr('Entrar na startup', 'Join the startup'), apply(S, d) {
          const f = G.angel.fate();
          S.job.track = 'startup';
          S.job.since = S.day;
          S.angel.tickets.push({ name: d.name, amount: d.equity, day: S.day, exitDay: S.day + f.exit, mult: f.mult });
          G.news(tr(`Você entrou na ${d.name}. Salário menor, adrenalina maior.`, `You joined ${d.name}. Lower salary, more adrenaline.`), 'story');
        } },
        { label: tr('Ficar onde está', 'Stay where you are'), apply() { G.news(tr('Você preferiu a estabilidade.', 'You chose stability.'), 'info'); } },
      ],
      def: 1,
    },
    {
      id: 'professor', title: tr('Convite para dar aulas', 'An invitation to teach'), cd: 1440, weight: 1,
      when: S => employed(S) && S.job.level >= 3 && track(S) !== 'academia',
      make: () => ({}),
      text: () => tr('Uma universidade oferece uma vaga de professor em tempo integral: salário pela metade, mas vida mais calma, ' +
        'estudo todo dia e o respeito de ser "professor".',
        'A university offers you a full-time teaching position: half the salary, but a calmer life, ' +
        'study every day and the respect of being called "professor".'),
      options: [
        { label: tr('Virar professor', 'Become a professor'), apply(S) {
          S.job.track = 'academia';
          S.job.since = S.day;
          G.news(tr('Você trocou o escritório pela sala de aula.', 'You traded the office for the classroom.'), 'story');
        } },
        { label: tr('Recusar', 'Decline'), apply() {} },
      ],
      def: 1,
    },

    // ---------- dilemas éticos ----------
    {
      id: 'sonegar', title: tr('Proposta do sócio', 'Your partner\'s proposal'), cd: 1080, weight: 2,
      when: S => G.business.monthlyProfit(S) > 0,
      make: S => ({ x: Math.max(10000 * S.macro.priceIndex, 0.3 * 12 * G.business.monthlyProfit(S) / 0.85 * 0.15) }),
      text: (S, d) => tr(`Seu sócio propõe "otimizar" a contabilidade das empresas: ${money(d.x)} a menos de imposto este ano. ` +
        'Ninguém precisa saber.',
        `Your partner suggests "optimizing" the businesses' books: ${money(d.x)} less in taxes this year. ` +
        'Nobody needs to know.'),
      options: [
        { label: tr('Sonegar', 'Evade taxes'), hint: tr('+ caixa, + sujeira', '+ cash, + dirt'), apply(S, d) {
          S.cash += d.x;
          S.pol.dirty += 1;
          G.news(tr(`Você embolsou ${money(d.x)} que deveria ir para a Receita.`, `You pocketed ${money(d.x)} that should have gone to the tax authority.`), 'bad');
        } },
        { label: tr('Recusar', 'Refuse'), hint: tr('+3 de imagem', '+3 image'), apply(S) {
          G.politics.addImage(S, 3);
          G.news(tr('Você recusou a sonegação. O sócio resmungou.', 'You refused to evade taxes. Your partner grumbled.'), 'good');
        } },
      ],
      def: 1,
    },
    {
      id: 'credito', title: tr('Levaram o seu crédito', 'Someone took your credit'), cd: 720, weight: 2,
      when: S => employed(S),
      make: () => ({}),
      text: () => tr('Um colega apresentou o seu projeto como se fosse dele, na frente da diretoria.', 'A coworker presented your project as their own, in front of the board.'),
      options: [
        { label: tr('Confrontar', 'Confront'), hint: tr('+3 de reputação, +8 de stress', '+3 reputation, +8 stress'), apply(S) {
          S.reputation += 3;
          G.social.addStress(S, 8);
          G.news(tr('Você expôs a situação. Foi desconfortável, mas todos sabem quem fez o trabalho.', 'You called it out. It was awkward, but everyone knows who did the work.'), 'good');
        } },
        { label: tr('Deixar passar', 'Let it go'), hint: tr('−3 de reputação', '−3 reputation'), apply(S) { S.reputation = Math.max(0, S.reputation - 3); } },
      ],
      def: 1,
    },
    {
      id: 'propina', title: tr('Um envelope na mesa', 'An envelope on the desk'), cd: 1080, weight: 1,
      when: S => employed(S) && S.job.level >= 5,
      make: S => ({ x: 6 * G.work.salary(S) }),
      text: (S, d) => tr(`Um fornecedor oferece ${money(d.x)} para você aprovar o contrato dele sem olhar muito.`,
        `A supplier offers you ${money(d.x)} to approve their contract without looking too closely.`),
      options: [
        { label: tr('Aceitar', 'Accept'), hint: tr('+ caixa, + sujeira', '+ cash, + dirt'), apply(S, d) {
          S.cash += d.x;
          S.pol.dirty += 1;
          G.news(tr(`Você aceitou ${money(d.x)} por fora.`, `You took ${money(d.x)} under the table.`), 'bad');
        } },
        { label: tr('Recusar e denunciar', 'Refuse and report it'), hint: tr('+5 de imagem', '+5 image'), apply(S) {
          G.politics.addImage(S, 5);
          S.reputation += 2;
          G.news(tr('Você recusou a propina e avisou o compliance.', 'You refused the bribe and alerted compliance.'), 'good');
        } },
      ],
      def: 1,
    },
    {
      id: 'insider', title: tr('Uma dica quente', 'A hot tip'), cd: 1080, weight: 1,
      when: S => !!S.research.setores && S.cash > 20000 && !G.politics.blind(S),
      make: S => ({ sector: G.rng.item(G.events.SECTORS), x: 0.1 * S.cash }),
      text: (S, d) => tr(`Um amigo de uma empresa de ${G.ASSETS[d.sector].short} conta, em off, que vem aí um anúncio que vai fazer as ações dispararem. ` +
        `Dá para comprar ${money(d.x)} antes de todo mundo.`,
        `A friend at a ${G.ASSETS[d.sector].short} company tells you, off the record, that an announcement is coming that will send the shares soaring. ` +
        `You could buy ${money(d.x)} before everyone else.`),
      options: [
        { label: tr('Comprar antes do anúncio', 'Buy before the announcement'), hint: tr('ganho provável, + sujeira, risco de multa da CVM', 'likely gain, + dirt, risk of a securities regulator (CVM) fine'), apply(S, d) {
          P().buy(S, d.sector, d.x);
          G.market.addEffect(S, d.sector, 0.15, 5, 2);
          S.pol.dirty += 0.7;
          S.life.cvm = { sector: d.sector, day: S.day + G.rng.int(90, 540) };
          G.news(tr(`Você comprou ${money(d.x)} em ${G.ASSETS[d.sector].short} antes do anúncio.`, `You bought ${money(d.x)} of ${G.ASSETS[d.sector].short} before the announcement.`), 'bad');
        } },
        { label: tr('Ignorar a dica', 'Ignore the tip'), hint: tr('+1 de imagem', '+1 image'), apply(S) { G.politics.addImage(S, 1); } },
      ],
      def: 1,
    },
    {
      id: 'tragedia', title: tr('Tragédia no interior', 'Tragedy in the countryside'), cd: 1440, weight: 1,
      when: S => S.cash > 12 * G.work.cost(S),
      make: S => ({ x: Math.max(5000 * S.macro.priceIndex, 0.01 * G.portfolio.netWorth(S)) }),
      text: (S, d) => tr(`Uma enchente destruiu uma cidade inteira. Campanhas de doação se espalham. Doar ${money(d.x)}?`,
        `A flood destroyed an entire town. Donation drives are spreading. Donate ${money(d.x)}?`),
      options: [
        { label: tr('Doar', 'Donate'), hint: tr('prestígio e imagem', 'prestige and image'), apply(S, d) { G.social.donate(S, d.x); G.politics.addImage(S, 2); } },
        { label: tr('Não doar', 'Don\'t donate'), apply() {} },
      ],
      def: 1,
    },
  ];

  // ---------- presidência ----------
  const pres = S => G.nation.isPresident(S);
  const nat = S => S.nation;
  const adj = (S, k, v) => { const n = nat(S); n[k] = Math.max(0.05, Math.min(0.95, n[k] + v)); };
  CHOICES.push(
    {
      id: 'greve', title: tr('Greve dos caminhoneiros', 'Truckers\' strike'), cd: 720, weight: 3, when: pres,
      make: () => ({}),
      text: () => tr('Caminhoneiros param as estradas contra o preço do diesel. Faltam combustível e comida nas cidades.',
        'Truckers block the highways over diesel prices. Cities are running short of fuel and food.'),
      options: [
        { label: tr('Subsidiar o diesel', 'Subsidize diesel'), hint: tr('aprovação +, dívida +0,3% do PIB', 'approval +, debt +0.3% of GDP'), apply(S) {
          nat(S).debt += 0.003; adj(S, 'approval', 0.04);
          G.news(tr('O governo subsidiou o diesel e a greve acabou.', 'The government subsidized diesel and the strike ended.'), 'politica');
        } },
        { label: tr('Não ceder', 'Hold firm'), hint: tr('aprovação −, crescimento sofre', 'approval −, growth suffers'), apply(S) {
          adj(S, 'approval', -0.06); G.market.addEffect(S, 'mkt', -0.04, 10);
          G.news(tr('Duas semanas de estradas paradas. A greve acabou, mas a economia sentiu.', 'Two weeks of blocked roads. The strike ended, but the economy felt it.'), 'politica');
        } },
      ],
      def: 0,
    },
    {
      id: 'favor_familia', title: tr('Um pedido de uma família poderosa', 'A request from a powerful family'), cd: 540, weight: 3, when: S => pres(S) && !!S.fam,
      make: S => ({ fam: G.rng.item(G.families.FAMILIES).id }),
      text: (S, d) => tr(`A família ${G.families.byId(d.fam).n} pede uma mudança de regra que favorece o setor dela. Em troca, promete apoio no Congresso.`,
        `The ${G.families.byId(d.fam).n} family asks for a rule change that favors their sector. In return, they promise support in Congress.`),
      options: [
        { label: tr('Atender', 'Grant it'), hint: tr('governabilidade +, instituições −, + sujeira', 'governability +, institutions −, + dirt'), apply(S, d) {
          adj(S, 'gov', 0.08); nat(S).idx.inst = Math.max(5, nat(S).idx.inst - 3); S.pol.dirty += 1;
          const x = G.families.st(S, d.fam); x.att = Math.min(100, x.att + 20);
          G.news(tr('Você atendeu ao pedido. A família ficou grata; a imprensa, desconfiada.', 'You granted the request. The family is grateful; the press, suspicious.'), 'politica');
        } },
        { label: tr('Recusar', 'Refuse'), hint: tr('instituições +, a família se ressente', 'institutions +, the family resents it'), apply(S, d) {
          nat(S).idx.inst = Math.min(100, nat(S).idx.inst + 2);
          const x = G.families.st(S, d.fam); x.att = Math.max(-100, x.att - 20);
          G.news(tr('Você recusou. A família não esqueceu.', 'You refused. The family did not forget.'), 'politica');
        } },
      ],
      def: 1,
    },
    {
      id: 'desastre', title: tr('Desastre natural', 'Natural disaster'), cd: 720, weight: 2, when: pres,
      make: () => ({}),
      text: () => tr('Enchentes deixam milhares de desabrigados no Sul. O país espera uma resposta do governo.',
        'Floods leave thousands homeless in the South. The country awaits the government\'s response.'),
      options: [
        { label: tr('Verba emergencial', 'Emergency funds'), hint: tr('aprovação +, dívida +0,2% do PIB', 'approval +, debt +0.2% of GDP'), apply(S) {
          nat(S).debt += 0.002; adj(S, 'approval', 0.05);
          G.news(tr('Verba liberada e reconstrução começando. A população aprovou.', 'Funds released and rebuilding under way. The public approved.'), 'politica');
        } },
        { label: tr('Deixar com estados e municípios', 'Leave it to states and cities'), hint: tr('aprovação −', 'approval −'), apply(S) {
          adj(S, 'approval', -0.08);
          G.news(tr('A resposta lenta virou símbolo de descaso do governo.', 'The slow response became a symbol of government neglect.'), 'politica');
        } },
      ],
      def: 0,
    },
    {
      id: 'ministro', title: tr('Ministro sob suspeita', 'Minister under suspicion'), cd: 720, weight: 2, when: pres,
      make: () => ({}),
      text: () => tr('Um jornal revela que um dos seus ministros recebeu dinheiro de uma empreiteira.',
        'A newspaper reveals that one of your ministers took money from a construction firm.'),
      options: [
        { label: tr('Demitir o ministro', 'Fire the minister'), hint: tr('governabilidade −, instituições +', 'governability −, institutions +'), apply(S) {
          adj(S, 'gov', -0.05); nat(S).idx.inst = Math.min(100, nat(S).idx.inst + 2);
          G.news(tr('Ministro demitido. O partido dele deixou a base do governo.', 'Minister fired. The minister\'s party left the governing coalition.'), 'politica');
        } },
        { label: tr('Proteger o ministro', 'Protect the minister'), hint: tr('aprovação −, + sujeira', 'approval −, + dirt'), apply(S) {
          adj(S, 'approval', -0.06); S.pol.dirty += 0.5;
          G.news(tr('Você bancou o ministro. O caso continua nas manchetes.', 'You stood by the minister. The case stays in the headlines.'), 'politica');
        } },
      ],
      def: 1,
    },
    {
      id: 'vizinho', title: tr('Crise na fronteira', 'Border crisis'), cd: 1080, weight: 1, when: pres,
      make: () => ({}),
      text: () => tr('Um país vizinho mobiliza tropas perto da fronteira depois de uma disputa comercial.',
        'A neighboring country moves troops near the border after a trade dispute.'),
      options: [
        { label: tr('Diplomacia', 'Diplomacy'), hint: tr('diplomacia +', 'diplomacy +'), apply(S) {
          nat(S).idx.dipl = Math.min(100, nat(S).idx.dipl + 4);
          G.news(tr('Uma cúpula regional esfriou a crise. O Brasil saiu como mediador.', 'A regional summit cooled the crisis. Brazil came out as the mediator.'), 'politica');
        } },
        { label: tr('Mostrar força', 'Show strength'), hint: tr('defesa +, diplomacia −, aprovação +', 'defense +, diplomacy −, approval +'), apply(S) {
          const i = nat(S).idx; i.def = Math.min(100, i.def + 3); i.dipl = Math.max(5, i.dipl - 4); adj(S, 'approval', 0.02);
          G.news(tr('Tropas na fronteira. O vizinho recuou, mas os parceiros internacionais estranharam.', 'Troops at the border. The neighbor backed down, but international partners were uneasy.'), 'politica');
        } },
      ],
      def: 0,
    },
  );

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
          G.alert(S, tr(`A CVM rastreou suas compras em ${G.ASSETS[cvm.sector].short} antes do anúncio. Multa de ${money(fine)} e seu nome nos jornais.`,
            `The securities regulator (CVM) traced your ${G.ASSETS[cvm.sector].short} purchases before the announcement. A ${money(fine)} fine and your name in the papers.`), 'bad');
        }
      }
      C.roll(S);
    },
  };
})();

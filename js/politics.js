(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  // Poder e política. Partidos, veículos e operações são fictícios.
  // Influência (decai 2% ao mês) compra acesso; imagem pública (−100 a +100) é o contrapeso.
  // "Sujeira" (caixa 2, lobby exposto, conflito de interesse) alimenta o risco de escândalo.
  const money = v => G.fmt.money(v);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pi = S => S.macro.priceIndex;

  // Projetos de lei. inf = influência gasta; months = tramitação; chance = aprovação base.
  const BILLS = [
    { id: 'isencao_acoes', n: tr('Isenção de IR em ações até R$ 60 mil/mês', 'Stock income-tax exemption up to R$ 60k/month'), inf: 30, months: 6, chance: 0.6,
      d: tr('A isenção mensal nas vendas de ações sobe de R$ 20 mil para R$ 60 mil.', 'The monthly exemption on stock sales rises from R$ 20k to R$ 60k.') },
    { id: 'marco_cripto', n: tr('Marco legal das criptos', 'Crypto legal framework'), inf: 40, months: 6, chance: 0.6,
      d: tr('Corretoras reguladas deixam de quebrar e o Bitcoin sobe 10% na aprovação.', 'Regulated exchanges stop collapsing and Bitcoin rises 10% on passage.') },
    { id: 'credito_imob', n: tr('Crédito imobiliário subsidiado', 'Subsidized mortgage credit'), inf: 40, months: 6, chance: 0.6,
      d: tr('Financiamento cai de Selic + 3,5% para Selic + 1,5%, e imóveis valorizam 4% a.a. a mais.',
        'Mortgages drop from Selic + 3.5% to Selic + 1.5%, and property appreciates an extra 4% p.a.') },
    { id: 'subsidio', n: tr('Subsídio setorial', 'Sector subsidy'), inf: 50, months: 6, chance: 0.55, sector: true,
      d: tr('Por 4 anos (renovável), as ações do setor rendem +8% a.a. e suas empresas e terras do setor lucram +15%. Com posição grande nele, é conflito de interesse.',
        'For 4 years (renewable), the sector\'s stocks return +8% p.a. and your businesses and land in the sector earn +15%. With a large position in it, it\'s a conflict of interest.') },
    { id: 'fim_div_tax', n: tr('Fim do IR sobre dividendos altos', 'End of the tax on large dividends'), inf: 60, months: 8, chance: 0.5,
      d: tr('Acaba a retenção de 10% sobre dividendos acima de R$ 50 mil por mês.', 'Ends the 10% withholding on dividends above R$ 50k per month.') },
    { id: 'reforma_trab', n: tr('Reforma trabalhista', 'Labor reform'), inf: 80, months: 10, chance: 0.4,
      d: tr('Lucro das suas empresas +20%. Impopular: imagem −10 quando aprovada.', 'Your businesses\' profit +20%. Unpopular: image −10 when passed.') },
  ];
  const REPEALED_BY_LEFT = ['isencao_acoes', 'fim_div_tax', 'reforma_trab'];

  const MEDIA = [
    { id: 'blog', n: tr('Blog de economia', 'Economics blog'), cost: 2e6, inf: 1, img: 0.5 },
    { id: 'portal', n: tr('Portal de notícias', 'News website'), cost: 30e6, inf: 4, img: 1.5 },
    { id: 'tv', n: tr('Canal de TV', 'TV channel'), cost: 400e6, inf: 15, img: 4 },
  ];

  const ENTITIES = [
    { id: 'associacao', n: tr('Associação comercial', 'Chamber of commerce'), fee: 2000, tier: 1, inf: 0.5, d: tr('+0,5 de influência por mês.', '+0.5 influence per month.') },
    { id: 'federacao', n: tr('Federação das indústrias', 'Federation of industries'), fee: 20000, tier: 2, inf: 2, needsBiz: true,
      d: tr('+2 de influência por mês. Precisa ter fábrica ou supermercado.', '+2 influence per month. Requires owning a factory or supermarket.') },
  ];

  // Cargos: mandato em dias; blind = patrimônio vai para um blind trust (sem operar à mão).
  const OFFICES = [
    { id: 'conselho', n: tr('Conselho de estatal', 'State-owned company board'), inf: 100, tier: 3, days: 720, pay: 30000, infMonth: 3, blind: false,
      d: tr('Jeton de R$ 30 mil/mês e +3 de influência por mês, por 2 anos.', 'Board fee of R$ 30k/month and +3 influence per month, for 2 years.') },
    { id: 'secretaria', n: tr('Secretário da Fazenda', 'Finance Secretary'), inf: 250, tier: 3, days: 1440, pay: 35000, infMonth: 8, blind: true, access: true,
      d: tr('Exige ter apoiado o governo eleito. Mandato de 4 anos, +8 de influência por mês e +15% de chance de aprovar seus projetos de lei. Você deixa o emprego e o patrimônio vai para um blind trust.',
        'Requires having backed the elected government. 4-year term, +8 influence per month and +15% chance of passing your bills. You leave your job and your assets go into a blind trust.') },
    { id: 'bc', n: tr('Diretor do Banco Central', 'Central Bank director'), inf: 600, tier: 4, days: 1440, pay: 40000, infMonth: 10, blind: true, req: 'economia_politica',
      d: tr('Você escolhe o viés da política monetária por 4 anos. Blind trust obrigatório.', 'You set the monetary policy bias for 4 years. Blind trust required.') },
  ];

  const SCANDALS = tr([
    'A Polícia Federal deflagra a Operação Mão Grande e seu nome aparece na lista.',
    'Uma CPI convoca você para depor sobre doações de campanha.',
    'Um ex-sócio faz delação premiada e cita seu nome.',
    'Um jornal publica planilhas de pagamentos a políticos com as suas iniciais.',
  ], [
    'The Federal Police launch Operation Grabbing Hand and your name is on the list.',
    'A congressional inquiry summons you to testify about campaign donations.',
    'A former partner signs a plea deal and names you.',
    'A newspaper publishes spreadsheets of payments to politicians with your initials.',
  ]);

  const PL = G.politics = {
    BILLS, MEDIA, ENTITIES, OFFICES,
    init: () => ({
      influence: 0, image: 0, dirty: 0, backed: {}, access: false, bills: [], passed: {}, media: {},
      thinkTank: null, entities: {}, office: null, bcBias: 0, poll: null,
    }),
    bill: id => BILLS.find(b => b.id === id),
    office: id => OFFICES.find(o => o.id === id),
    blind: S => !!(S.pol.office && PL.office(S.pol.office.id).blind),
    addImage(S, x) { S.pol.image = clamp(S.pol.image + x, -100, 100); },

    // ---------- efeitos consultados por outros módulos ----------
    alpha(S, id) {
      if (!S.pol) return 0;
      let a = (G.macro.POLICIES[S.macro.policy].alpha || {})[id] || 0;
      const sub = S.pol.passed.subsidio;
      if (sub && sub.sector === id && S.day < sub.until) a += 0.08;
      if (id === 'imob' && S.pol.passed.credito_imob) a += 0.04;
      return a;
    },
    exemptSales: S => (S.pol && S.pol.passed.isencao_acoes ? 60000 : 20000),
    dividendTax(S, id, amount) {
      if (G.ASSETS[id].tax !== 'acao') return 0;
      if (S.macro.policy === 'redistributivo') return 0.15;
      if (S.pol && S.pol.passed.fim_div_tax) return 0;
      return amount > 50000 ? 0.1 : 0;
    },
    loanSpread: S => (S.pol && S.pol.passed.credito_imob ? 0.015 : 0.035),
    bizMult: S => (S.pol.passed.reforma_trab ? 1.2 : 1) * (S.pol.image < -50 ? 0.8 : 1),
    // Subsídio setorial também vale para empresas e terras do setor (+15% de lucro).
    sectorMult(S, sector) {
      const sub = S.pol && S.pol.passed.subsidio;
      return sub && sector && sub.sector === sector && S.day < sub.until ? 1.15 : 1;
    },
    cryptoSafe: S => !!(S.pol && S.pol.passed.marco_cripto),

    // ---------- eleições ----------
    legalLimit(S) {
      const income = (S.job.employed ? G.work.salary(S) : 0) + Math.max(0, G.work.passiveIncome(S));
      return Math.max(0, 0.1 * 12 * income - PL.donatedLegal(S));
    },
    donatedLegal: S => Object.values(S.pol.backed).reduce((s, b) => s + b.legal, 0),
    weights(S) {
      const w = {};
      for (const [k, p] of Object.entries(G.macro.POLICIES)) {
        const b = S.pol.backed[k];
        const money = b ? b.legal + b.dirty : 0;
        w[k] = p.weight + 0.15 * Math.log10(1 + money / (100000 * pi(S)));
      }
      w.redistributivo += Math.max(0, -S.pol.image) / 200;
      if (S.pol.thinkTank) w[S.pol.thinkTank.side] += Math.min(0.25, 0.05 * S.pol.thinkTank.years);
      const total = Object.values(w).reduce((a, b) => a + b, 0);
      for (const k in w) w[k] /= total;
      return w;
    },
    donate(S, side, amount, dirty) {
      amount = Math.min(amount, S.cash);
      if (!dirty) amount = Math.min(amount, PL.legalLimit(S));
      if (!(amount >= 100) || !G.macro.POLICIES[side]) return;
      S.cash -= amount;
      G.social.spent(S, amount);
      const b = S.pol.backed[side] || (S.pol.backed[side] = { legal: 0, dirty: 0 });
      b[dirty ? 'dirty' : 'legal'] += amount;
      if (dirty) S.pol.dirty += amount / (1e6 * pi(S));
      G.news(tr(`${dirty ? 'Caixa 2' : 'Doação oficial'} de ${money(amount)} para a campanha ${G.macro.POLICIES[side].n.toLowerCase()}.`,
        `${dirty ? 'Off-the-books donation' : 'Official donation'} of ${money(amount)} to the ${G.macro.POLICIES[side].n} campaign.`), dirty ? 'bad' : 'politica');
    },
    // Pesquisa eleitoral: a chance real com ruído (menor com Ciência política).
    publishPoll(S) {
      const w = PL.weights(S), sd = S.research.ciencia_politica ? 0.03 : 0.08, poll = {};
      let total = 0;
      for (const k in w) total += (poll[k] = Math.max(0.01, w[k] + G.rng.normal() * sd));
      for (const k in poll) poll[k] /= total;
      S.pol.poll = poll;
    },
    runElection(S) {
      const m = S.macro, pol = S.pol, winner = G.rng.pick(PL.weights(S));
      m.policy = winner;
      G.news(tr(`Resultado das eleições: vence a plataforma ${G.macro.POLICIES[winner].n.toLowerCase()}.`, `Election result: the ${G.macro.POLICIES[winner].n} platform wins.`), 'politica');
      const bw = pol.backed[winner];
      pol.access = !!bw;
      if (bw) {
        const gain = 10 + 20 * Math.log10(1 + (bw.legal + bw.dirty) / (100000 * pi(S)));
        pol.influence += gain;
        G.news(tr(`Você apoiou quem ganhou: +${G.fmt.num(gain, 0)} de influência e portas abertas no novo governo.`,
          `You backed the winner: +${G.fmt.num(gain, 0)} influence and open doors in the new government.`), 'good');
      }
      for (const k in pol.backed) {
        if (k === winner) continue;
        pol.influence = Math.max(0, pol.influence - 5);
        G.news(tr(`Você apoiou a plataforma ${G.macro.POLICIES[k].n.toLowerCase()}, que perdeu. O novo governo lembra disso.`,
          `You backed the ${G.macro.POLICIES[k].n} platform, which lost. The new government remembers.`), 'bad');
      }
      if (winner === 'redistributivo') {
        const gone = REPEALED_BY_LEFT.filter(id => pol.passed[id]);
        gone.forEach(id => delete pol.passed[id]);
        if (gone.length) G.news(tr(`O novo governo revogou: ${gone.map(id => PL.bill(id).n.toLowerCase()).join('; ')}.`,
          `The new government repealed: ${gone.map(id => PL.bill(id).n.toLowerCase()).join('; ')}.`), 'bad');
      }
      pol.backed = {};
      pol.poll = null;
    },

    // ---------- lobby ----------
    lobbyCost: (S, b) => b.inf * (S.pol.access ? 0.7 : 1) * (S.research.relacoes_institucionais ? 0.8 : 1),
    startLobby(S, id, sector) {
      const b = PL.bill(id), pol = S.pol;
      const expired = b && b.sector && pol.passed[id] && S.day >= pol.passed[id].until;
      if (!b || !S.research.relacoes_institucionais || (pol.passed[id] && !expired) || pol.bills.some(x => x.id === id)) return;
      if (b.sector && !G.events.SECTORS.includes(sector)) return;
      const cost = PL.lobbyCost(S, b);
      if (pol.influence < cost) return;
      pol.influence -= cost;
      pol.bills.push({ id, sector: sector || null, left: b.months });
      G.news(tr(`Seu lobby pelo projeto "${b.n}" começou a circular em Brasília.`, `Your lobbying for the bill "${b.n}" is making the rounds in Brasília.`), 'politica');
    },
    // Posição grande no setor subsidiado = conflito de interesse.
    conflict(S, x) {
      if (!x.sector) return false;
      const total = G.portfolio.invested(S);
      return total > 0 && G.portfolio.value(S, x.sector) / total > 0.1;
    },

    // ---------- mídia, think tank, entidades, cargos ----------
    buyMedia(S, id) {
      const m = MEDIA.find(x => x.id === id);
      if (!m || !S.research.midia || S.pol.media[id] || S.cash < m.cost * pi(S)) return;
      S.cash -= m.cost * pi(S);
      G.social.spent(S, m.cost * pi(S));
      S.pol.media[id] = true;
      G.news(tr(`Você comprou um ${m.n.toLowerCase()}. Agora tem voz no debate público.`, `You bought a ${m.n.toLowerCase()}. Now you have a voice in public debate.`), 'politica');
    },
    mediaUpkeep: S => MEDIA.reduce((s, m) => s + (S.pol.media[m.id] ? m.cost * 0.003 * pi(S) : 0), 0),
    hasBigMedia: S => !!(S.pol.media.portal || S.pol.media.tv),
    startThinkTank(S, side) {
      if (!S.research.filantropia_estrategica || S.pol.thinkTank || !G.macro.POLICIES[side]) return;
      S.pol.thinkTank = { side, years: 0, months: 0 };
      G.news(tr(`Você fundou um think tank alinhado à plataforma ${G.macro.POLICIES[side].n.toLowerCase()}.`, `You founded a think tank aligned with the ${G.macro.POLICIES[side].n} platform.`), 'politica');
    },
    stopThinkTank(S) { S.pol.thinkTank = null; },
    entityFees: S => ENTITIES.reduce((s, e) => s + (S.pol.entities[e.id] ? e.fee * pi(S) : 0), 0),
    thinkTankCost: S => (S.pol.thinkTank ? 250000 * pi(S) : 0),
    joinEntity(S, id) {
      const e = ENTITIES.find(x => x.id === id);
      if (!e || S.pol.entities[id] || G.social.tierIdx(S) < e.tier) return;
      if (e.needsBiz && !(G.business.count(S, 'fabrica') || G.business.count(S, 'supermercado'))) return;
      S.pol.entities[id] = true;
    },
    leaveEntity(S, id) { delete S.pol.entities[id]; },
    canTakeOffice(S, o) {
      return !S.pol.office && S.pol.influence >= o.inf && G.social.tierIdx(S) >= o.tier
        && (!o.access || S.pol.access) && (!o.req || S.research[o.req]);
    },
    takeOffice(S, id, bias) {
      const o = PL.office(id);
      if (!o || !PL.canTakeOffice(S, o)) return;
      S.pol.office = { id, until: S.day + o.days };
      if (o.blind && S.job.employed) {
        S.job.employed = false;
        S.job.retired = true;
      }
      if (id === 'bc') S.pol.bcBias = bias === 'dovish' ? -0.03 : bias === 'hawkish' ? 0.03 : 0;
      G.news(tr(`Você assumiu: ${o.n}.${o.blind ? ' Seu patrimônio foi para um blind trust: a estratégia automática segue, mas você não opera à mão.' : ''}`,
        `You took office: ${o.n}.${o.blind ? ' Your assets went into a blind trust: the automatic strategy keeps running, but you can\'t trade by hand.' : ''}`), 'politica');
    },
    leaveOffice(S) {
      if (!S.pol.office) return;
      G.news(tr(`Fim do mandato: ${PL.office(S.pol.office.id).n}.`, `End of term: ${PL.office(S.pol.office.id).n}.`), 'politica');
      S.pol.office = null;
      S.pol.bcBias = 0;
    },

    // ---------- escândalo ----------
    scandalChance: S => Math.min(0.5, S.pol.dirty * 0.03 * (S.research.compliance ? 0.5 : 1) * (S.pol.image < 0 ? 1.5 : 1)),
    scandal(S) {
      const pol = S.pol, soft = PL.hasBigMedia(S) ? 0.5 : 1;
      const liquid = Math.max(0, S.cash) + G.portfolio.invested(S);
      const fine = liquid * Math.min(0.3, 0.03 + 0.04 * pol.dirty) * (PL.hasBigMedia(S) ? 0.7 : 1);
      S.cash -= fine;
      PL.addImage(S, -30 * soft);
      pol.influence *= 0.5;
      pol.dirty *= 0.5;
      if (S.fund) S.fund.aum *= 0.8;
      if (pol.office) PL.leaveOffice(S);
      G.social.addStress(S, 30);
      G.legacy.flag(S, 'escandalo');
      const story = G.rng.item(SCANDALS);
      G.alert(S, tr(`ESCÂNDALO: ${story} Multa e acordo de ${money(fine)}, imagem destruída${soft < 1 ? ' (sua mídia amenizou o estrago)' : ''}.`,
        `SCANDAL: ${story} Fines and a settlement of ${money(fine)}, image destroyed${soft < 1 ? ' (your media softened the damage)' : ''}.`), 'bad');
    },

    // ---------- mês ----------
    monthly(S, c) {
      const pol = S.pol, t = G.social.tierIdx(S);

      // Campanha: pesquisas de agosto a outubro do ano eleitoral
      if (G.cal.isElectionYear(c.year) && c.month >= 8 && c.month <= 10) PL.publishPoll(S);

      // Lobby em tramitação
      for (let i = pol.bills.length - 1; i >= 0; i--) {
        const x = pol.bills[i], b = PL.bill(x.id), conflict = PL.conflict(S, x);
        if (G.rng.chance(conflict ? 0.03 : 0.01)) {
          PL.addImage(S, -10);
          pol.dirty += conflict ? 2 : 0.5;
          G.news(tr(`Vazou: um jornal revela seu lobby pelo projeto "${b.n}"${conflict ? ', e que você tem muito dinheiro no setor beneficiado' : ''}.`,
            `Leaked: a newspaper reveals your lobbying for the bill "${b.n}"${conflict ? ', and that you have a lot of money in the sector that benefits' : ''}.`), 'bad');
        }
        if (--x.left > 0) continue;
        pol.bills.splice(i, 1);
        const insider = pol.office && pol.office.id === 'secretaria' ? 0.15 : 0; // Secretário da Fazenda ajuda a aprovar
        const chance = clamp(b.chance + (pol.access ? 0.15 : 0) + insider + pol.image / 400, 0.05, 0.95);
        if (!G.rng.chance(chance)) {
          G.news(tr(`O projeto "${b.n}" foi derrubado no plenário.`, `The bill "${b.n}" was voted down on the floor.`), 'bad');
          continue;
        }
        pol.passed[x.id] = x.sector ? { sector: x.sector, until: S.day + 1440 } : true;
        if (x.id === 'marco_cripto') G.market.addEffect(S, 'bitcoin', 0.1, 3);
        if (x.id === 'reforma_trab') PL.addImage(S, -10);
        G.news(tr(`Aprovado: ${b.n}${x.sector ? ` (${G.ASSETS[x.sector].short})` : ''}.`, `Passed: ${b.n}${x.sector ? ` (${G.ASSETS[x.sector].short})` : ''}.`), 'good');
      }

      // Mídia, think tank, entidades e cargo
      for (const m of MEDIA) {
        if (!pol.media[m.id]) continue;
        pol.influence += m.inf;
        PL.addImage(S, m.img);
      }
      S.cash -= PL.mediaUpkeep(S) + PL.thinkTankCost(S);
      if (pol.thinkTank) {
        pol.influence += 2;
        if (++pol.thinkTank.months % 12 === 0) pol.thinkTank.years++;
      }
      for (const e of ENTITIES) {
        if (!pol.entities[e.id]) continue;
        S.cash -= e.fee * pi(S);
        pol.influence += e.inf;
      }
      if (pol.office) {
        const o = PL.office(pol.office.id);
        S.cash += o.pay * pi(S);
        pol.influence += o.infMonth;
        if (S.day >= pol.office.until) PL.leaveOffice(S);
      }

      // Posição social vira um pouco de influência; tudo decai
      pol.influence = pol.influence * 0.98 + 0.3 * t;
      pol.image *= 0.97;
      pol.dirty *= 0.97;

      // Imposto sobre fortunas (governo redistributivo), cobrado em janeiro
      if (S.macro.policy === 'redistributivo' && c.month === 1) {
        const nw = G.portfolio.netWorth(S), floor = 1e7 * pi(S);
        if (nw > floor) {
          const x = 0.01 * (nw - floor);
          S.cash -= x;
          S.tax.paid += x;
          G.news(tr(`Imposto sobre grandes fortunas: ${money(x)}.`, `Wealth tax: ${money(x)}.`), 'bad');
        }
      }

      if (G.rng.chance(PL.scandalChance(S))) PL.scandal(S);
    },
  };
})();

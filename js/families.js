(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  // Famílias mais ricas do país (fictícias). Cada uma vive de um setor (o patrimônio segue o preço desse ativo),
  // tem uma plataforma política e uma relação com a sua dinastia (att, de −100 a +100). Rivais sabotam; aliadas ajudam.
  // w0 = patrimônio inicial em R$ de 2026.
  const FAMILIES = [
    { id: 'albuquerque', n: 'Albuquerque Prado', sector: 'bancos', side: 'austero', w0: 180e9,
      d: tr('Banqueiros há quatro gerações.', 'Bankers for four generations.') },
    { id: 'vasconcellos', n: 'Vasconcellos', sector: 'commodities', side: 'moderado', w0: 120e9,
      d: tr('Mineração e exportação de minério.', 'Mining and ore exports.') },
    { id: 'teixeira', n: 'Teixeira Lins', sector: 'varejo', side: 'expansionista', w0: 85e9,
      d: tr('A maior rede de lojas do país.', 'The country\'s largest store chain.') },
    { id: 'rezende', n: 'Rezende Farias', sector: 'terra', side: 'moderado', w0: 60e9,
      d: tr('Soja e gado no Centro-Oeste.', 'Soy and cattle in the Center-West.') },
    { id: 'kaufmann', n: 'Kaufmann', sector: 'tech', side: 'austero', w0: 42e9,
      d: tr('Fundadores de um gigante de tecnologia.', 'Founders of a tech giant.') },
    { id: 'nogueira', n: 'Nogueira Sampaio', sector: 'utilities', side: 'moderado', w0: 30e9,
      d: tr('Hidrelétricas e distribuição de energia.', 'Hydropower and power distribution.') },
    { id: 'duarte', n: 'Duarte', sector: 'imob', side: 'redistributivo', w0: 21e9,
      d: tr('Empreiteira de obras públicas.', 'Public works contractor.') },
    { id: 'monteiro', n: 'Monteiro Bragança', sector: 'ibov', side: 'expansionista', w0: 15e9, media: true,
      d: tr('Holding com jornais, TV e participações. Um ataque dela na mídia pesa o dobro.', 'Holding with newspapers, TV and stakes. Its media attacks hit twice as hard.') },
    { id: 'lacerda', n: 'Lacerda Mendes', sector: 'bancos', side: 'moderado', w0: 10e9,
      d: tr('Banco de investimento e gestora.', 'Investment bank and asset manager.') },
    { id: 'almeida', n: 'Almeida Rocha', sector: 'varejo', side: 'redistributivo', w0: 7e9,
      d: tr('Supermercados no Nordeste.', 'Supermarkets in the Northeast.') },
  ];
  // Plataformas que brigam entre si (apoiar uma irrita as famílias da outra).
  const ENEMY = { austero: ['redistributivo', 'expansionista'], redistributivo: ['austero'], expansionista: ['austero'], moderado: [] };
  const SECTOR_NAME = { terra: tr('agronegócio', 'agribusiness'), imob: tr('construção', 'construction'), ibov: tr('mídia e participações', 'media and holdings') };

  const CD = 90, MAX_ALLIES = 3;
  const money = v => G.fmt.money(v);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pi = S => S.macro.priceIndex;
  const byId = id => FAMILIES.find(f => f.id === id);
  // Líder de cada família: envelhece, morre e é substituído; a competência pesa no crescimento da fortuna.
  const newLeader = (f, young) => ({ name: `${G.dynasty.name()} ${f.n.split(' ')[0]}`, age: young ? G.rng.int(35, 55) : G.rng.int(50, 78),
    skill: G.rng.int(20, 95), dies: G.rng.int(78, 95) });

  const F = G.families = {
    FAMILIES, MAX_ALLIES,
    byId,
    sectorName: f => SECTOR_NAME[f.sector] || G.ASSETS[f.sector].short,
    init(S) {
      const list = {};
      for (const f of FAMILIES) {
        list[f.id] = { w: f.w0 * (S.macro ? S.macro.priceIndex : 1), px: S.market ? S.market.prices[f.sector] : 100, px12: [], att: 0, ally: false, cd: 0,
          watch: 0, dossie: false, hot: 0, leader: newLeader(f, false) };
      }
      return { list, priceWar: null, noticed: false };
    },
    st: (S, id) => S.fam.list[id],
    relation(S, id) {
      const x = F.st(S, id);
      if (x.ally) return 'aliada';
      return x.att >= 20 ? 'amistosa' : x.att > -20 ? 'neutra' : x.att > -50 ? 'hostil' : 'rival';
    },
    RELATION_NAME: { aliada: tr('aliada', 'ally'), amistosa: tr('amistosa', 'friendly'), neutra: tr('neutra', 'neutral'), hostil: tr('hostil', 'hostile'), rival: tr('rival', 'rival') },
    allies: S => FAMILIES.filter(f => S.fam.list[f.id].ally),
    rivals: S => FAMILIES.filter(f => F.relation(S, f.id) === 'rival'),

    // Ranking com a sua família no meio. Devolve [{ id, n, w, you }] do mais rico ao menos rico.
    ranking(S) {
      const rows = FAMILIES.map(f => ({ id: f.id, n: f.n, w: S.fam.list[f.id].w }));
      rows.push({ id: 'voce', n: G.dynasty.familyName(S), w: Math.max(0, G.portfolio.netWorth(S)), you: true });
      return rows.sort((a, b) => b.w - a.w);
    },
    myRank: S => F.ranking(S).findIndex(r => r.you) + 1,

    // Exposição da sua dinastia no setor de uma família: carteira + empresas do setor. Concorrência gera rivalidade.
    overlap(S, f) {
      let x = S.port[f.sector] ? G.portfolio.value(S, f.sector) : 0;
      for (const b of G.BUSINESSES) if (b.sector === f.sector) x += G.business.count(S, b.id) * b.cost * pi(S);
      if (f.sector === 'terra') x += G.agro.equity(S);
      if (f.sector === 'imob') x += G.realty.equity(S);
      return x;
    },
    // Guerra de preços de uma família rival: lucro das suas empresas do setor −20%.
    bizMult: (S, sector) => (S.fam && S.fam.priceWar && S.fam.priceWar.sector === sector && S.day < S.fam.priceWar.until ? 0.8 : 1),

    // Grupos de poder: cada família empurra a própria plataforma nas eleições, na raiz do patrimônio.
    electionWeights(S, w) {
      if (!S.fam) return;
      for (const f of FAMILIES) w[f.side] += 0.015 * Math.sqrt(S.fam.list[f.id].w / (50e9 * pi(S)));
    },
    // Depois da eleição: quem apoiou a plataforma da família ganha simpatia; quem apoiou a inimiga, antipatia.
    afterElection(S, backed) {
      for (const f of FAMILIES) {
        const x = F.st(S, f.id);
        for (const side of backed) {
          if (side === f.side) x.att = clamp(x.att + 10, -100, 100);
          else if (ENEMY[f.side].includes(side)) x.att = clamp(x.att - 6, -100, 100);
        }
      }
    },

    // ---------- ações do jogador ----------
    tierReq: f => (f.w0 >= 60e9 ? 4 : 3),
    approachCost: S => 500000 * pi(S),
    investigateCost: S => 2e6 * pi(S),
    canAct: (S, f) => S.day >= F.st(S, f.id).cd && G.social.tierIdx(S) >= F.tierReq(f),
    approach(S, id) {
      const f = byId(id), x = f && F.st(S, id), cost = F.approachCost(S);
      if (!f || !F.canAct(S, f) || S.cash < cost) return;
      S.cash -= cost;
      G.social.spent(S, cost);
      const club = S.social.clubs.golfe || S.social.clubs.iate ? 5 : 0;
      x.att = clamp(x.att + 10 + club, -100, 100);
      x.cd = S.day + CD;
      G.news(tr(`Jantar com a família ${f.n}: a conversa rendeu (relação ${Math.round(x.att)}).`,
        `Dinner with the ${f.n} family: the conversation went well (relationship ${Math.round(x.att)}).`), 'info');
    },
    canAlly: (S, f) => !F.st(S, f.id).ally && F.st(S, f.id).att >= 40 && F.allies(S).length < MAX_ALLIES && S.pol.influence >= 30 && F.canAct(S, f),
    ally(S, id) {
      const f = byId(id), x = f && F.st(S, id);
      if (!f || !F.canAlly(S, f)) return;
      S.pol.influence -= 30;
      x.ally = true;
      x.att = clamp(x.att + 10, -100, 100);
      x.cd = S.day + CD;
      for (const g of FAMILIES) if (ENEMY[g.side].includes(f.side)) F.st(S, g.id).att = clamp(F.st(S, g.id).att - 5, -100, 100);
      G.news(tr(`Aliança selada com a família ${f.n}. As famílias do outro lado da política não gostaram.`,
        `Alliance sealed with the ${f.n} family. Families on the other side of politics didn't like it.`), 'politica');
    },
    breakAlly(S, id) {
      const f = byId(id), x = f && F.st(S, id);
      if (!f || !x.ally) return;
      x.ally = false;
      x.att = clamp(x.att - 30, -100, 100);
      G.news(tr(`Você rompeu a aliança com a família ${f.n}.`, `You broke off the alliance with the ${f.n} family.`), 'bad');
    },
    investigate(S, id) {
      const f = byId(id), x = f && F.st(S, id), cost = F.investigateCost(S);
      if (!f || S.day < x.cd || S.cash < cost) return;
      S.cash -= cost;
      x.cd = S.day + CD;
      x.watch = S.day + 360;
      const found = G.rng.chance(0.5);
      if (found) x.dossie = true;
      G.news(found
        ? tr(`Os investigadores montaram um dossiê sobre a família ${f.n}. Por um ano, você fica sabendo antes do que ela tramar.`,
          `Your investigators put together a dossier on the ${f.n} family. For a year, you'll know in advance what they're plotting.`)
        : tr(`Os investigadores não acharam nada contra a família ${f.n}, mas vão vigiá-la por um ano.`,
          `Your investigators found nothing on the ${f.n} family, but will watch them for a year.`), 'info');
    },
    canAttack: (S, f) => (F.st(S, f.id).dossie || G.politics.hasBigMedia(S)) && S.pol.influence >= 20 && S.day >= F.st(S, f.id).cd,
    attack(S, id) {
      const f = byId(id), x = f && F.st(S, id);
      if (!f || !F.canAttack(S, f)) return;
      S.pol.influence -= 20;
      const dossie = x.dossie, hit = dossie ? G.rng.range(0.1, 0.25) : G.rng.range(0.05, 0.12);
      x.w *= 1 - hit;
      x.att = clamp(x.att - 60, -100, 100); // vira guerra: a família passa a ser rival
      x.ally = false;
      x.dossie = false;
      x.hot = S.day + 360; // retaliação provável no próximo ano
      x.cd = S.day + CD;
      if (dossie) G.politics.addImage(S, 3);
      else {
        G.politics.addImage(S, -5);
        S.pol.dirty += 0.5;
      }
      G.alert(S, dossie
        ? tr(`Seu dossiê contra a família ${f.n} virou manchete: o patrimônio dela caiu ${G.fmt.pct(hit, 0)}. Espere o troco.`,
          `Your dossier on the ${f.n} family made headlines: their fortune fell ${G.fmt.pct(hit, 0)}. Expect payback.`)
        : tr(`Sua mídia bateu forte na família ${f.n}: o patrimônio dela caiu ${G.fmt.pct(hit, 0)}, mas a campanha suja respingou em você. Espere o troco.`,
          `Your media hit the ${f.n} family hard: their fortune fell ${G.fmt.pct(hit, 0)}, but the smear splashed back on you. Expect payback.`), 'politica');
    },

    // ---------- ações das famílias ----------
    sabotage(S, f) {
      const x = F.st(S, f.id);
      if (x.watch > S.day && G.rng.chance(0.5)) {
        G.news(tr(`Seus investigadores avisaram a tempo: a família ${f.n} tentou te prejudicar e não conseguiu.`,
          `Your investigators warned you in time: the ${f.n} family tried to hurt you and failed.`), 'good');
        return;
      }
      const opts = ['smear', 'denounce'];
      if (G.BUSINESSES.some(b => b.sector === f.sector && G.business.count(S, b.id))) opts.push('pricewar');
      if (S.pol.bills.length || S.pol.influence > 20) opts.push('lobby');
      if (G.BUSINESSES.some(b => G.business.managers(S, b.id))) opts.push('poach');
      const kind = G.rng.item(opts), media = f.media ? 2 : 1;
      if (kind === 'pricewar') {
        S.fam.priceWar = { sector: f.sector, until: S.day + 180, by: f.id };
        G.alert(S, tr(`Guerra de preços: a família ${f.n} derrubou os preços em ${F.sectorName(f)}. Suas empresas do setor lucram 20% menos por 6 meses.`,
          `Price war: the ${f.n} family slashed prices in ${F.sectorName(f)}. Your businesses in the sector earn 20% less for 6 months.`), 'bad');
      } else if (kind === 'smear') {
        G.politics.addImage(S, -8 * media);
        S.social.prestige = Math.max(0, S.social.prestige - 3 * media);
        G.alert(S, tr(`Campanha de difamação: veículos ligados à família ${f.n} atacam a sua reputação.`,
          `Smear campaign: outlets tied to the ${f.n} family attack your reputation.`), 'bad');
      } else if (kind === 'lobby') {
        const bill = S.pol.bills[0];
        if (bill) bill.left += 4;
        else S.pol.influence *= 0.85;
        G.alert(S, tr(`A família ${f.n} fez lobby contra você em Brasília${bill ? ': seu projeto atrasou 4 meses' : ': você perdeu influência'}.`,
          `The ${f.n} family lobbied against you in Brasília${bill ? ': your bill is delayed 4 months' : ': you lost influence'}.`), 'bad');
      } else if (kind === 'poach') {
        const b = G.rng.item(G.BUSINESSES.filter(y => G.business.managers(S, y.id)));
        S.biz.mgr[b.id]--;
        G.alert(S, tr(`A família ${f.n} roubou um gerente da sua unidade de ${b.n.toLowerCase()}. Ela volta a consumir sua energia.`,
          `The ${f.n} family poached a manager from your ${b.n.toLowerCase()} unit. It drains your energy again.`), 'bad');
      } else {
        S.pol.dirty += 1;
        G.alert(S, tr(`A família ${f.n} levou denúncias contra você às autoridades. O risco de escândalo subiu.`,
          `The ${f.n} family took complaints against you to the authorities. Your scandal risk went up.`), 'bad');
      }
    },
    favor(S, f) {
      if (G.rng.chance(0.5)) {
        S.pol.influence += 8;
        G.news(tr(`A família ${f.n}, sua aliada, abriu portas em Brasília: +8 de influência.`,
          `The ${f.n} family, your ally, opened doors in Brasília: +8 influence.`), 'good');
      } else {
        G.social.gain(S, 2, 2);
        G.news(tr(`A família ${f.n}, sua aliada, te levou a um evento fechado da elite: +2 de prestígio.`,
          `The ${f.n} family, your ally, took you to a private elite event: +2 prestige.`), 'good');
      }
    },

    // ---------- mês ----------
    monthly(S) {
      const fam = S.fam, px = S.market.prices, gov = S.macro.policy;
      if (!fam.noticed && (G.social.tierIdx(S) >= 3 || G.portfolio.netWorth(S) / pi(S) >= 1e8)) fam.noticed = true;
      for (const f of FAMILIES) {
        const x = fam.list[f.id];
        // Patrimônio: 60% do retorno do setor + reinvestimento (~5% a.a.) + ruído + governo amigo.
        const r = px[f.sector] / (x.px || px[f.sector]) - 1;
        x.px = px[f.sector];
        const ld = x.leader || (x.leader = newLeader(f, false));
        ld.age += 1 / 12;
        if (ld.age >= ld.dies) {
          const old = ld.name;
          x.leader = newLeader(f, true);
          if (fam.noticed) G.news(tr(`Morreu ${old}, líder da família ${f.n}. ${x.leader.name}, de ${Math.floor(x.leader.age)} anos, assume o comando.`,
            `${old}, head of the ${f.n} family, has died. ${x.leader.name}, age ${Math.floor(x.leader.age)}, takes the helm.`), 'info');
        }
        let g = 0.6 * r + 0.004 + G.rng.normal() * 0.012 + (gov === f.side ? 0.002 : 0) + (x.leader.skill - 55) / 45 * 0.002;
        if (G.rng.chance(0.003)) {
          g -= 0.2;
          G.news(tr(`Escândalo derruba o patrimônio da família ${f.n}.`, `A scandal knocks down the ${f.n} family fortune.`), 'info');
        } else if (G.rng.chance(0.002)) {
          g -= 0.15;
          G.news(tr(`Briga de herdeiros divide a fortuna da família ${f.n}.`, `An heirs' feud splits the ${f.n} family fortune.`), 'info');
        } else if (G.rng.chance(0.003)) {
          g += 0.2;
          G.news(tr(`A família ${f.n} fecha o negócio do ano e fica ainda mais rica.`, `The ${f.n} family closes the deal of the year and gets even richer.`), 'info');
        }
        // Nenhuma fortuna cresce para sempre acima da economia: acima de 1,5% do PIB, o crescimento é freado.
        const share = S.nation ? x.w / (S.nation.gdpReal * pi(S)) : 0;
        if (share > 0.015) g -= 0.02 * (share / 0.015 - 1);
        x.w = Math.max(1e8, x.w * (1 + clamp(g, -0.4, 0.3)));
        if (!fam.noticed) continue;

        // Relação com a sua dinastia
        const over = F.overlap(S, f);
        if (over > 0.002 * x.w) x.att -= 1.5; // concorrência no setor
        if (S.pol.thinkTank) {
          if (S.pol.thinkTank.side === f.side) x.att += 1;
          else if (ENEMY[f.side].includes(S.pol.thinkTank.side)) x.att -= 1;
        }
        if (x.ally && S.pol.image < -40) x.att -= 2;
        x.att = clamp(x.att * 0.98, -100, 100);
        if (x.ally && x.att < 20) {
          x.ally = false;
          G.news(tr(`A família ${f.n} desfez a aliança com você.`, `The ${f.n} family ended its alliance with you.`), 'bad');
        }

        // Rivais sabotam; aliadas ajudam.
        if (x.att <= -30) {
          const p = (0.03 + 0.05 * (-x.att - 30) / 70) * (S.day < x.hot ? 3 : 1);
          if (G.rng.chance(p)) F.sabotage(S, f);
        } else if (x.ally && G.rng.chance(0.04)) F.favor(S, f);
      }
      if (fam.priceWar && S.day >= fam.priceWar.until) fam.priceWar = null;
    },
  };
})();

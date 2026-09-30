(function () {
  const G = globalThis.G;
  const tr = G.L;
  const f = G.fmt;
  const $ = id => document.getElementById(id);

  const TABS = [
    ['trabalho', tr('Trabalho', 'Work')],
    ['investimentos', tr('Investimentos', 'Investments')],
    ['conhecimento', tr('Conhecimento', 'Knowledge')],
    ['mercado', tr('Mercado', 'Market')],
    ['vida', tr('Vida', 'Life')],
    ['lazer', tr('Lazer', 'Leisure')],
    ['poder', tr('Poder', 'Power')],
    ['negocios', tr('Negócios', 'Business')],
    ['imoveis', tr('Imóveis', 'Real estate')],
    ['terras', tr('Terras', 'Land')],
    ['startups', 'Startups'],
    ['dinastia', tr('Dinastia', 'Dynasty')],
    ['familias', tr('Famílias', 'Families')],
    ['brasil', tr('Brasil', 'Brazil')],
    ['legado', tr('Legado', 'Legacy')],
  ];

  const FRACS = [0.1, 0.25, 0.5];
  let active = 'trabalho';
  const ALL = tr('Todos', 'All');
  let invFilter = ALL;
  let keys = {};
  let colors = {};

  const set = (id, text) => {
    const el = $(id);
    if (el && el.textContent !== text) el.textContent = text;
  };
  const dis = (id, off) => {
    const el = $(id);
    if (el) el.disabled = !!off;
  };
  // Motivo de um botão desabilitado, no tooltip (vazio quando está liberado).
  const why = (id, reason) => {
    const el = $(id);
    if (el && (el.title || '') !== (reason || '')) el.title = reason || '';
  };
  const need = (S, { cash = 0, energy = 0 } = {}) => {
    if (energy && S.burnout > 0) return tr(`em burnout por mais ${S.burnout} dia(s)`, `burned out for ${S.burnout} more day(s)`);
    if (energy && S.energy < energy) return tr(`falta energia: ${Math.floor(S.energy)}/${energy}`, `not enough energy: ${Math.floor(S.energy)}/${energy}`);
    if (cash && S.cash < cash) return tr(`faltam ${f.money(cash - S.cash)}`, `${f.money(cash - S.cash)} short`);
    return '';
  };
  const show = (id, on) => {
    const el = $(id);
    if (el) el.hidden = !on;
  };
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // Aceita "1.500,50", "400.000", "1500.5", "R$ 2 mil" não (só números). Em inglês, "1,500.50".
  function parseMoney(s) {
    s = String(s).replace(/[^\d,.]/g, '');
    if (G.EN) s = s.replace(/,/g, '');
    else if (s.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // "400.000" = 400 mil
    return parseFloat(s) || 0;
  }

  // neutral: linha na cor de destaque em vez de verde/vermelho (ex.: Selic subir não é "ganho").
  // ma: desenha também a média móvel desse número de pontos.
  function spark(id, data, { neutral = false, ma = 0 } = {}) {
    const cv = $(id);
    if (!cv || data.length < 2) return;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    let lo = Infinity, hi = -Infinity;
    for (const v of data) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (hi - lo < 1e-9) {
      hi += 1;
      lo -= 1;
    }
    ctx.strokeStyle = neutral ? colors.accent : data[data.length - 1] >= data[0] ? colors.up : colors.down;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * w, y = h - 2 - ((v - lo) / (hi - lo)) * (h - 4);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    if (ma && data.length > ma) {
      ctx.strokeStyle = colors.muted;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      let sum = 0;
      data.forEach((v, i) => {
        sum += v - (i >= ma ? data[i - ma] : 0);
        if (i < ma - 1) return;
        const x = (i / (data.length - 1)) * w, y = h - 2 - ((sum / ma - lo) / (hi - lo)) * (h - 4);
        i === ma - 1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }


  // Seção de automação: alocação-alvo, aporte automático, rebalanceamento e robô.
  function autoSection(S, ids) {
    const A = S.auto;
    let h = `<section class="card"><h3>${tr('Estratégia automática', 'Automatic strategy')}</h3>
      <p><label class="check"><input type="checkbox" data-act="auto-on" id="au-on"> ${tr('Aporte automático: todo mês, investir o que passar de', 'Automatic investing: every month, invest anything above')}
      <input class="num" data-set="reserve" value="${A.reserve}" inputmode="numeric"> ${tr('meses de gastos em caixa', 'months of expenses in cash')}</label></p>`;
    if (S.research.rebalanceamento) {
      h += `<p><label class="check"><input type="checkbox" data-act="auto-rebal" id="au-rebal"> ${tr(`Rebalancear ${S.research.quant ? 'todo mês' : 'a cada trimestre'}
        quando um ativo sair mais de ${f.pct(A.band, 0)} do alvo`, `Rebalance ${S.research.quant ? 'every month' : 'every quarter'}
        when an asset drifts more than ${f.pct(A.band, 0)} from target`)}</label></p>`;
    }
    if (S.research.quant) {
      h += `<p>${tr('Robô', 'Bot')}: <select data-set="robot">${Object.entries(G.auto.ROBOTS).map(([k, r]) =>
        `<option value="${k}"${k === A.robot ? ' selected' : ''}>${r.n}</option>`).join('')}</select>
        <span class="muted" id="au-robot-d"></span></p>`;
    }
    h += `<table class="tbl alloc"><tr><td><b>${tr('Ativo', 'Asset')}</b></td><td><b>${tr('Alvo', 'Target')}</b></td><td><b>${tr('Efetivo', 'Effective')}</b></td><td><b>${tr('Atual', 'Current')}</b></td></tr>`;
    for (const id of ids) {
      h += `<tr><td>${G.ASSETS[id].n}</td><td><input class="num" data-alloc="${id}" value="${A.targets[id] || ''}" inputmode="numeric" placeholder="0"> %</td>
        <td id="au-e-${id}"></td><td id="au-c-${id}"></td></tr>`;
    }
    h += '</table><p class="muted" id="au-sum"></p></section>';
    return h;
  }

  function updateAuto(S, ids) {
    const A = S.auto, t = G.auto.targets(S) || {}, P = G.portfolio;
    const on = $('au-on');
    if (on) on.checked = !!A.on;
    const rb = $('au-rebal');
    if (rb) rb.checked = !!A.rebal;
    set('au-robot-d', G.auto.ROBOTS[A.robot].d);
    const total = ids.reduce((s, id) => s + P.value(S, id), 0);
    let sum = 0;
    for (const id of ids) {
      sum += +A.targets[id] || 0;
      set(`au-e-${id}`, t[id] ? f.pct(t[id], 0) : '');
      set(`au-c-${id}`, total > 0 && P.value(S, id) > 0 ? f.pct(P.value(S, id) / total, 0) : '');
    }
    set('au-sum', sum ? tr(`Os alvos somam ${sum}%; são normalizados para 100%. "Efetivo" já inclui a inclinação do robô.`,
      `Targets add up to ${sum}%; they are normalized to 100%. "Effective" already includes the bot's tilt.`)
      : tr('Preencha os alvos (em %) para ligar a estratégia.', 'Fill in the targets (in %) to turn the strategy on.'));
  }


  // Por que um imóvel não serve de casa própria (vazio se serve).
  function homeWhy(S, h) {
    const p = G.realty.prop(h.pid), n = G.social.familySize(S);
    switch (G.life.homeProblem(S, h)) {
      case 'comercial': return tr('imóvel comercial: não dá para morar', 'commercial property: you can\'t live there');
      case 'familia': return tr(`cabem ${p.people} pessoas e sua família tem ${n}`, `it fits ${p.people} people and your family has ${n}`);
      case 'valor': return tr(`pequeno para o seu padrão de vida: precisa valer ${f.money(G.life.homeMin(S))}`, `too small for your lifestyle: must be worth ${f.money(G.life.homeMin(S))}`);
    }
    return '';
  }

  // Presidência da República (aba Poder): requisitos, candidatura, campanha e reeleição.
  function presidencySection(S, opts) {
    const N = G.nation, n = S.nation, P = G.macro.POLICIES;
    let h = `<section class="card"><h3>${tr('Presidência da República', 'Presidency of the Republic')}</h3>`;
    if (N.isPresident(S)) {
      h += `<p class="good">${tr(`Você é o presidente (${n.president.term}º mandato, até ${f.monthYear(n.president.until)}). O governo fica na aba Brasil.`,
        `You are the president (term ${n.president.term}, until ${f.monthYear(n.president.until)}). The government is in the Brazil tab.`)}</p>`;
    }
    if (n.campaign) {
      h += `<p>${tr(`Em campanha pela plataforma <b>${P[n.campaign.platform].n}</b>, com ${f.money(n.campaign.budget)}.`,
        `Campaigning on the <b>${P[n.campaign.platform].n}</b> platform, with ${f.money(n.campaign.budget)}.`)} <span id="pr-vote"></span></p>
        <p class="muted">${tr('A eleição é em novembro: precisa de mais de 50% dos votos válidos no segundo turno. Debates e gafes de agosto a outubro mexem nas pesquisas.',
          'The election is in November: you need more than 50% of the valid votes in the runoff. Debates and gaffes from August to October move the polls.')}</p>`;
    } else if (!N.isPresident(S) || N.reelection(S)) {
      if (!N.isPresident(S)) {
        h += `<p class="muted">${tr('A eleição mais difícil do país. Requisitos para ser candidato:', 'The hardest election in the country. Requirements to run:')}</p><ul>` +
          N.requirements(S).map((r, i) => `<li id="pr-q-${i}">${r.t}</li>`).join('') + '</ul>';
      } else h += `<p>${tr('Você pode concorrer à reeleição. O resultado depende quase só da aprovação do governo.', 'You can run for reelection. The result depends almost entirely on your government\'s approval.')}</p>`;
      h += `<p class="muted">${tr(`Candidaturas de janeiro a julho de ano eleitoral (próxima eleição: ${G.cal.nextElection(S.day)}). Custa 100 de influência e a verba de campanha;
        acima de ${f.money(N.OFFICIAL_LIMIT * S.macro.priceIndex)} é caixa 2. Contam imagem, influência, posição social, dinheiro, mídia própria, famílias aliadas (e rivais) e a economia.`,
        `Candidacies from January to July of an election year (next election: ${G.cal.nextElection(S.day)}). It costs 100 influence plus the campaign budget;
        anything above ${f.money(N.OFFICIAL_LIMIT * S.macro.priceIndex)} is off the books. Image, influence, social status, money, your own media, allied (and rival) families and the economy all count.`)}</p>
        <p>${N.reelection(S) ? '' : `${tr('Plataforma', 'Platform')} <select id="pr-side">${opts('moderado')}</select> `}
        ${tr('Verba de campanha', 'Campaign budget')} <input id="pr-budget" inputmode="decimal" placeholder="${tr('valor em R$', 'amount in R$')}">
        <button data-act="run" id="b-run">${N.reelection(S) ? tr('Concorrer à reeleição', 'Run for reelection') : tr('Lançar candidatura', 'Launch candidacy')}</button></p>`;
    }
    return h + '</section>';
  }
  function updatePresidency(S) {
    const N = G.nation, n = S.nation;
    if (n.campaign) {
      const v = N.expectedVote(S);
      set('pr-vote', tr(`Pesquisa: ~${f.pct(v, 0)} dos votos válidos (margem de 6 pontos).`, `Poll: ~${f.pct(v, 0)} of the valid votes (6-point margin).`));
      return;
    }
    N.requirements(S).forEach((r, i) => {
      const el = $(`pr-q-${i}`);
      if (el) { set(`pr-q-${i}`, `${r.ok ? '✓' : '✗'} ${r.t}`); el.className = r.ok ? 'good' : 'bad'; }
    });
    const req = N.reelection(S) || N.requirements(S).every(r => r.ok);
    dis('b-run', !N.canRun(S) || S.pol.influence < 100 || S.cash < N.minBudget(S));
    why('b-run', !N.window(S) ? tr(`candidaturas só de janeiro a julho de ${G.cal.nextElection(S.day)}`, `candidacies only from January to July of ${G.cal.nextElection(S.day)}`)
      : !req ? tr('faltam requisitos', 'requirements not met')
      : S.pol.influence < 100 ? tr('precisa de 100 de influência', 'needs 100 influence')
      : need(S, { cash: N.minBudget(S) }) || tr(`verba mínima de ${f.money(N.minBudget(S))}`, `minimum budget of ${f.money(N.minBudget(S))}`));
  }

  // Explicações do painel lateral (aparecem ao passar o mouse).
  const TIPS = {
    cash: tr('Dinheiro parado na conta. Perde para a inflação; o que passar da reserva pode ir para investimentos.',
      'Money sitting in your account. It loses to inflation; anything above your reserve can go into investments.'),
    nw: tr('Tudo o que você tem: caixa, investimentos, imóveis (menos dívidas), startups, empresas e gestora.',
      'Everything you own: cash, investments, real estate (minus debt), startups, businesses and asset manager.'),
    reserve: tr('Quantos meses de gastos o caixa, a poupança e o Tesouro Selic cobrem. Protege contra demissão.',
      'How many months of expenses your cash, savings and Selic Treasury cover. Protects against a layoff.'),
    en: tr('Gasta em estudar, hora extra, hábitos e empresas sem gerente. Volta todo dia. Abaixo de 25% há risco de burnout.',
      'Spent on studying, overtime, habits and businesses without a manager. Refills every day. Below 25% there is a burnout risk.'),
    age: tr('Aos 60 dá para passar o bastão ao herdeiro. A expectativa de vida é oculta; o stress a reduz, exercício a aumenta.',
      'At 60 you can pass the torch to your heir. Life expectancy is hidden; stress lowers it, exercise raises it.'),
    k: tr('Moeda das pesquisas e das promoções. Vem de estudar, ler e investir.', 'The currency of research and promotions. Comes from studying, reading and investing.'),
    rep: tr('Cresce com os meses de trabalho. Exigida nas promoções; ajuda a achar emprego e captar na gestora.',
      'Grows with months of work. Required for promotions; helps you find a job and raise money for the asset manager.'),
    status: tr('Posição social: prestígio + metade da visibilidade. Abre clubes, cargos, palestras e o fim de jogo.',
      'Social status: prestige + half of visibility. Opens clubs, offices, talks and the endgame.'),
    stress: tr('Sobe com quedas do patrimônio, dívidas e desemprego. Acima de 70 quebra hábitos e aumenta o burnout.',
      'Rises with net worth drops, debt and unemployment. Above 70 it breaks habits and increases burnout.'),
    well: tr('Bem-estar (0 a 100): família, saúde, hobbies, férias, cidade e pouco stress. A média da vida vira pontos de legado.',
      'Well-being (0 to 100): family, health, hobbies, vacations, city and low stress. The lifetime average turns into legacy points.'),
    inf: tr('Capital político. Vem de doações a quem vence, mídia, entidades e cargos. Paga o lobby. Cai 2% ao mês.',
      'Political capital. Comes from donations to winners, media, associations and offices. Pays for lobbying. Falls 2% per month.'),
    img: tr('Imagem pública (−100 a +100). Filantropia sobe; ostentação, lobby exposto e escândalos derrubam.',
      'Public image (−100 to +100). Philanthropy raises it; showing off, exposed lobbying and scandals sink it.'),
    sal: tr('Salário do cargo atual, reajustado pela inflação todo janeiro.', 'Salary of your current position, adjusted for inflation every January.'),
    yield: tr('Juros, dividendos e aluguéis de FIIs esperados por mês (sem contar a variação de preço).',
      'Interest, dividends and REIT rents expected per month (not counting price changes).'),
    rent: tr('Aluguel líquido dos imóveis alugados, menos condomínio e IPTU dos vagos e da casa onde você mora.',
      'Net rent from rented properties, minus building fees and property tax on vacant ones and on the home you live in.'),
    agro: tr('Arrendamentos e gado por mês. As safras de soja e café entram de uma vez na colheita.',
      'Land leases and cattle per month. Soy and coffee crops come in all at once at harvest.'),
    loan: tr('Parcelas dos financiamentos de imóveis (taxa fixa) e de empresas (acompanham a Selic).',
      'Payments on property mortgages (fixed rate) and business loans (follow the Selic).'),
    biz: tr('Lucro das empresas, já descontando gerentes e imposto.', 'Business profit, net of managers and taxes.'),
    fund: tr('Lucro da gestora no último mês.', 'Asset manager profit last month.'),
    social: tr('Renda do cônjuge menos clubes e escola.', 'Spouse income minus clubs and school.'),
    pol: tr('Mídia e think tank, menos o que o cargo público paga.', 'Media and think tank, minus what public office pays.'),
    cost: tr('Custo de vida do mês: moradia, família e hábitos. Sobe com a inflação.', 'Monthly cost of living: housing, family and habits. Rises with inflation.'),
    net: tr('Quanto sobra (ou falta) por mês com tudo somado.', 'How much is left over (or missing) each month, all told.'),
    selic: tr('Taxa básica de juros, decidida pelo Copom a cada 45 dias.', 'Brazil\'s base interest rate, set by the Copom every 45 days.'),
    infl: tr('Inflação anual corrente.', 'Current annual inflation.'),
  };

  // Histórico mensal do patrimônio + o valor de agora, para o gráfico terminar no número exibido.
  const nwSeries = S => S.stats.nwHist.concat([G.portfolio.netWorth(S)]);

  // Gráfico ampliado: séries disponíveis e desenho com eixos.
  let zoom = null;
  function series(S, key) {
    if (key.startsWith('asset:')) {
      const id = key.slice(6), a = G.ASSETS[id];
      return { title: a.n, data: S.market.hist[id].map(v => v * (a.unit || 1)), step: 1, money: true };
    }
    if (key === 'selic') return { title: 'Selic', data: S.macro.selicHist, step: 45, pct: true, neutral: true };
    if (key === 'pmi') return { title: tr('PMI da indústria', 'Manufacturing PMI'), data: S.macro.pmiHist, step: 30, neutral: true };
    if (key === 'nw') return { title: tr('Seu patrimônio', 'Your net worth'), data: nwSeries(S), step: 30, money: true };
    return null;
  }
  function bigChart(cv, s) {
    const data = s.data;
    if (!cv || data.length < 2) return;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    let lo = Math.min(...data), hi = Math.max(...data);
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const L = 90, R = 10, T = 10, B = 24, fmtV = v => (s.money ? f.money(v) : s.pct ? f.pct(v) : f.num(v, 1));
    const x = i => L + (i / (data.length - 1)) * (w - L - R), y = v => T + (1 - (v - lo) / (hi - lo)) * (h - T - B);
    ctx.font = '11px Verdana, Tahoma, sans-serif';
    ctx.fillStyle = colors.muted;
    ctx.strokeStyle = colors.muted;
    ctx.globalAlpha = 0.3;
    for (const v of [lo, (lo + hi) / 2, hi]) { ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(w - R, y(v)); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const v of [lo, (lo + hi) / 2, hi]) ctx.fillText(fmtV(v), 2, y(v) + 4);
    const days = (data.length - 1) * s.step;
    ctx.fillText(days >= 360 ? tr(`há ${f.num(days / 360, 1)} anos`, `${f.num(days / 360, 1)} years ago`) : tr(`há ${days} dias`, `${days} days ago`), L, h - 6);
    const hoje = tr('hoje', 'today');
    ctx.fillText(hoje, w - R - ctx.measureText(hoje).width, h - 6);
    ctx.strokeStyle = s.neutral ? colors.accent : data[data.length - 1] >= data[0] ? colors.up : colors.down;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    data.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
    ctx.stroke();
  }
  let popupKey = null;
  function renderPopup() {
    const p = G.popups[0];
    set('modal-title', p.title);
    set('modal-info', '');
    show('modal-c', false);
    show('modal-text', true);
    if (popupKey === p) return;
    popupKey = p;
    let h = '', rows = '';
    const flush = () => { if (rows) h += `<table class="tbl stats">${rows}</table>`; rows = ''; };
    for (const r of p.rows) {
      if (Array.isArray(r)) rows += `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`;
      else { flush(); h += `<p>${esc(r)}</p>`; }
    }
    flush();
    $('modal-text').innerHTML = h;
  }
  function closePopup(S) {
    const p = G.popups.shift();
    popupKey = null;
    // Volta à velocidade de antes, a menos que haja uma decisão esperando.
    if (p && S.speed === 0 && p.resume > 0 && !S.social.pending && !G.popups.length) S.speed = p.resume;
  }
  function renderZoom(S) {
    const box = $('modal');
    box.hidden = !zoom && !G.popups.length;
    if (G.popups.length && !zoom) return renderPopup();
    show('modal-c', true);
    show('modal-text', false);
    if (!zoom) return;
    const s = series(S, zoom);
    if (!s) { zoom = null; box.hidden = true; return; }
    set('modal-title', s.title);
    const d = s.data, last = d[d.length - 1];
    const ret = n => (d.length > n ? f.signedPct(last / d[d.length - 1 - n] - 1, 1) : '—');
    const per = s.step === 1 ? [[tr('1 mês', '1 month'), 30], [tr('6 meses', '6 months'), 180], [tr('1 ano', '1 year'), 360], [tr('2 anos', '2 years'), 719]]
      : s.step === 30 ? [[tr('1 ano', '1 year'), 12], [tr('5 anos', '5 years'), 60], [tr('20 anos', '20 years'), 239]] : [];
    set('modal-info', `${tr('Agora', 'Now')}: ${s.money ? f.money(last) : s.pct ? f.pct(last) : f.num(last, 1)}` +
      (s.neutral ? '' : per.map(([n, k]) => ` · ${n}: ${ret(k)}`).join('')));
    bigChart($('modal-c'), s);
  }

  // Dicas de tutorial: a primeira que se aplica aparece acima das abas; dá para dispensar ou desligar.
  const HINTS = [
    { id: 'estudar', when: S => S.knowledge < 3 && !Object.keys(S.research).length,
      t: tr('Comece clicando em <b>Estudar</b> para ganhar conhecimento, ou em <b>Hora extra</b> para ganhar dinheiro. A energia volta todo dia.',
        'Start by clicking <b>Study</b> to gain knowledge, or <b>Overtime</b> to earn money. Energy refills every day.') },
    { id: 'poupanca', when: S => S.tabs.investimentos && G.portfolio.invested(S) === 0,
      t: tr('Dinheiro parado perde para a inflação. Na aba <b>Investimentos</b>, aplique na poupança o que sobrar.',
        'Idle money loses to inflation. In the <b>Investments</b> tab, put what\'s left over into savings.') },
    { id: 'rotina', when: S => S.tabs.conhecimento && !S.research.rotina,
      t: tr('Pesquise <b>Rotina</b> (aba Conhecimento) para ligar o piloto automático e parar de clicar.',
        'Research <b>Routine</b> (Knowledge tab) to turn on autopilot and stop clicking.') },
    { id: 'piloto', when: S => S.research.rotina && S.routine === 'off',
      t: tr('Ligue o <b>piloto automático</b> em Trabalho → Dia a dia.', 'Turn on <b>autopilot</b> in Work → Day to day.') },
    { id: 'edu_fin', when: S => S.tabs.conhecimento && !S.research.edu_fin && S.knowledge >= 5,
      t: tr('Pesquise <b>Educação financeira</b>: o Tesouro Selic rende bem mais que a poupança.',
        'Research <b>Financial literacy</b>: the Selic Treasury pays much more than savings.') },
    { id: 'promocao', when: S => G.work.canPromote(S),
      t: tr('Você já pode <b>pedir promoção</b> na aba Trabalho.', 'You can now <b>ask for a promotion</b> in the Work tab.') },
    { id: 'alvos', when: S => S.research.aporte_auto && !Object.values(S.auto.targets).some(v => v > 0),
      t: tr('Defina seus alvos em <b>Investimentos → Estratégia automática</b> e ligue o aporte automático.',
        'Set your targets in <b>Investments → Automatic strategy</b> and turn on automatic investing.') },
    { id: 'apertado', when: S => G.work.crowded(S) > 0,
      t: tr('Sua família não cabe mais onde você mora. Mude para um padrão maior em <b>Trabalho → Estilo de vida</b>: o aperto aumenta o stress e derruba o bem-estar.',
        'Your family no longer fits where you live. Move up in <b>Work → Lifestyle</b>: cramped quarters raise stress and sink well-being.') },
    { id: 'habito', when: S => S.tabs.vida && !Object.keys(S.social.habits).length,
      t: tr('Na aba <b>Vida</b>, comece um hábito. Exercício e leitura se pagam rápido.', 'In the <b>Life</b> tab, start a habit. Exercise and reading pay off fast.') },
    { id: 'panico', when: S => S.social.pending && S.social.pending.type === 'panic',
      t: tr('Pânico na bolsa: veja a aba <b>Vida</b>. Quem vende no fundo costuma se arrepender.',
        'Market panic: check the <b>Life</b> tab. Those who sell at the bottom usually regret it.') },
    { id: 'herdeiro', when: S => G.legacy.age(S) >= 50 && !S.social.family.kids,
      t: tr('Sem filhos, metade do seu legado se perde. A família fica na aba <b>Vida</b>.', 'Without children, half your legacy is lost. Family is in the <b>Life</b> tab.') },
  ];
  let hintKey = null;
  function renderHint(S) {
    const on = S.settings.hints !== false, off = S.settings.hintsOff || {};
    const h = on ? HINTS.find(x => !off[x.id] && x.when(S)) : null;
    const k = h ? h.id : '';
    if (k === hintKey) return;
    hintKey = k;
    const box = $('hint');
    box.hidden = !h;
    if (h) box.innerHTML = `<span>${h.t}</span> <button class="link" data-act="hint-ok" data-id="${h.id}">${tr('entendi', 'got it')}</button>
      <button class="link" data-act="hint-all">${tr('desligar dicas', 'turn off tips')}</button>`;
  }

  // Decisão pendente (pânico, tentação ou carta de escolha): aparece acima de qualquer aba.
  let decisionKey = null;
  function renderDecision(S) {
    const p = S.social.pending, SO = G.social;
    const k = p ? p.type + (p.id || '') + p.until : '';
    if (k !== decisionKey) {
      decisionKey = k;
      const box = $('decision');
      box.hidden = !p;
      if (!p) return;
      let h;
      if (p.type === 'panic') {
        h = tr(`<h3>Pânico no mercado</h3><p>A bolsa despencou e você não dorme direito. Vender todas as ações e criptos agora?</p>
          <p class="muted">Se você não decidir em <span id="d-left"></span> dias, o impulso passa e você segura.</p>
          <button data-act="decide" data-id="1">Vender tudo</button> <button data-act="decide" data-id="0">Segurar firme</button>`,
          `<h3>Market panic</h3><p>The market crashed and you can't sleep. Sell all your stocks and crypto now?</p>
          <p class="muted">If you don't decide within <span id="d-left"></span> days, the urge passes and you hold.</p>
          <button data-act="decide" data-id="1">Sell everything</button> <button data-act="decide" data-id="0">Hold firm</button>`);
      } else if (p.type === 'tempt') {
        h = `<h3>${tr('Tentação', 'Temptation')}</h3><p>${esc(SO.HABITS[p.id].offer)}</p>
          <p class="muted">${esc(SO.HABITS[p.id].d)} ${tr('Ocupa uma vaga de hábito. A oferta some em <span id="d-left"></span> dias.',
            'Takes up a habit slot. The offer disappears in <span id="d-left"></span> days.')}</p>
          <button data-act="decide" data-id="1" id="b-tempt">${tr('Aceitar', 'Accept')}</button> <button data-act="decide" data-id="0">${tr('Recusar', 'Decline')}</button>`;
      } else {
        const c = G.choices.byId(p.id);
        h = `<h3>${esc(c.title)}</h3><p>${esc(c.text(S, p.data))}</p>
          <p class="muted">${tr('Sem resposta em <span id="d-left"></span> dias, fica valendo', 'With no answer within <span id="d-left"></span> days, the default is')} "${esc(c.options[c.def].label)}".</p>
          ${c.options.map((o, i) => `<button data-act="decide" data-id="${i}">${esc(o.label)}${o.hint ? ` <small>${esc(o.hint)}</small>` : ''}</button>`).join(' ')}`;
      }
      box.innerHTML = `<section class="card alert">${h}</section>`;
    }
    if (p) {
      set('d-left', String(Math.max(0, p.until - S.day)));
      dis('b-tempt', SO.used(S) >= SO.slots(S));
    }
  }

  // Cada aba: key() muda quando a estrutura muda (rebuild); update() só troca valores.
  const VIEWS = {
    trabalho: {
      key: S => [S.job.level, S.job.employed, !!S.job.retired, !!S.research.fire, !!S.research.rotina, S.lifestyle, !!S.tabs.estilo, S.job.wageIndex, G.work.salaryMult(S), G.work.studyCost(S), G.work.emax(S),
        S.job.track, !!S.job.sabbatical, S.life.city, !!G.life.home(S)].join('|'),
      build(S) {
        const W = G.work, cur = W.CAREER[S.job.level], nx = W.nextLevel(S);
        const neg = W.salaryMult(S), bonusE = W.emax(S) - W.LIFESTYLE[S.lifestyle].emax;
        let h = `<section class="card"><h3>${tr('Carreira', 'Career')}</h3>
          <p><b>${cur.t}</b>${S.job.track && S.job.track !== 'corporativo' ? ` <small>(${W.TRACKS[S.job.track].n})</small>` : ''} · <span id="w-sal"></span>/${tr('mês', 'month')}
          ${S.job.employed ? '' : `<span class="bad">(${tr('desempregado', 'unemployed')})</span>`}${S.job.sabbatical ? ` <span class="good">${tr('em ano sabático', 'on sabbatical')}</span>` : ''}</p>`;
        if (nx) {
          h += tr(`<p class="muted">Próximo cargo: <b>${nx.t}</b> (${f.money(nx.sal * S.job.wageIndex * neg)}/mês).
            Requer ${nx.k} de conhecimento (gasto na promoção) e ${nx.rep} de reputação.</p>
            <button data-act="promote" id="b-promote">Pedir promoção</button>`,
            `<p class="muted">Next position: <b>${nx.t}</b> (${f.money(nx.sal * S.job.wageIndex * neg)}/month).
            Requires ${nx.k} knowledge (spent on the promotion) and ${nx.rep} reputation.</p>
            <button data-act="promote" id="b-promote">Ask for a promotion</button>`);
        } else h += `<p class="muted">${tr('Você chegou ao topo da carreira.', 'You have reached the top of your career.')}</p>`;
        if (S.job.employed && !S.job.sabbatical) {
          h += ` <button data-act="sabbatical" id="b-sabb">${tr('Ano sabático <small>12 meses sem salário, stress zerado, +30 conhecimento</small>',
            'Sabbatical year <small>12 months without salary, stress reset, +30 knowledge</small>')}</button>`;
        }
        h += `</section><section class="card"><h3>${tr('Dia a dia', 'Day to day')}</h3><div class="btns">`;
        h += S.job.employed
          ? `<button data-act="overtime" id="b-ot">${tr('Hora extra', 'Overtime')} <small>[H] −${W.OT_COST} ${tr('energia', 'energy')}, <span id="w-ot"></span></small></button>`
          : `<button data-act="search" id="b-search">${S.job.retired ? tr('Voltar a trabalhar', 'Go back to work') : tr('Procurar emprego', 'Look for a job')} <small>−${W.SEARCH_COST} ${tr('energia', 'energy')}</small></button>`;
        h += `<button data-act="study" id="b-study">${tr('Estudar', 'Study')} <small>[E] −${W.studyCost(S)} ${tr('energia', 'energy')}, <span id="w-st"></span></small></button>
          </div>`;
        if (S.research.rotina) {
          h += `<p>${tr('Piloto automático', 'Autopilot')}: <select data-set="routine">${Object.entries(W.ROUTINES).map(([k, n]) =>
            `<option value="${k}"${k === S.routine ? ' selected' : ''}>${n}</option>`).join('')}</select>
            <span class="muted" id="w-auto"></span></p>`;
        }
        h += '<p id="w-burn" class="bad" hidden></p></section>';
        if (S.research.fire) {
          h += tr(`<section class="card"><h3>Independência financeira</h3>
            <p>Número FIRE (25× o custo anual): <b id="w-fire"></b> · você tem <b id="w-fire-pct"></b></p>
            <p>Renda passiva: <b id="w-passive"></b>/mês contra custo de vida de <b id="w-cost"></b>/mês</p>
            ${S.job.employed ? '<button data-act="retire" id="b-retire">Pedir demissão e viver de renda</button>' : ''}</section>`,
            `<section class="card"><h3>Financial independence</h3>
            <p>FIRE number (25× annual cost): <b id="w-fire"></b> · you have <b id="w-fire-pct"></b></p>
            <p>Passive income: <b id="w-passive"></b>/month against a cost of living of <b id="w-cost"></b>/month</p>
            ${S.job.employed ? '<button data-act="retire" id="b-retire">Quit and live off your income</button>' : ''}</section>`);
        }
        if (S.tabs.estilo) {
          h += `<section class="card"><h3>${tr('Estilo de vida', 'Lifestyle')}</h3>
            <p class="muted">${tr('Morar melhor dá mais energia, mas custa todo mês. Subir de padrão custa 2 meses do novo custo (mudança, móveis).',
              'Living better gives more energy, but costs every month. Moving up costs 2 months of the new cost (moving, furniture).')}</p>
            <table class="tbl">`;
          W.LIFESTYLE.forEach((l, i) => {
            const cur = i === S.lifestyle;
            h += `<tr class="${cur ? 'cur' : ''}"><td>${l.n}<br><small class="muted">${tr(`até ${l.people} ${l.people === 1 ? 'pessoa' : 'pessoas'}`, `up to ${l.people} ${l.people === 1 ? 'person' : 'people'}`)}</small></td><td id="ls-c-${i}"></td><td>${tr('energia', 'energy')} ${l.emax + bonusE}, +${l.regen}/${tr('dia', 'day')}</td>
              <td>${cur ? `<b>${tr('atual', 'current')}</b>` : `<button data-act="lifestyle" data-i="${i}" id="b-ls-${i}">${i > S.lifestyle ? tr('Mudar', 'Move') : tr('Reduzir', 'Downsize')}</button>`}</td></tr>`;
          });
          h += '</table>';
          // Cidade e casa própria
          const LF = G.life, home = LF.home(S);
          h += `<h3 style="margin-top:10px">${tr('Cidade', 'City')}</h3><table class="tbl">`;
          for (const [id, c] of Object.entries(LF.CITIES)) {
            h += `<tr class="${id === S.life.city ? 'cur' : ''}"><td>${c.n}<br><small class="muted">${c.d}</small></td>
              <td>${id === S.life.city ? `<b>${tr('atual', 'current')}</b>` : `<button data-act="city" data-id="${id}" id="b-city-${id}">${tr('Mudar', 'Move')} <small id="w-cc-${id}"></small></button>`}</td></tr>`;
          }
          h += `</table><p>${home ? `${tr('Você mora no seu imóvel', 'You live in your own property')} (${G.realty.prop(home.pid).n.toLowerCase()}): <span id="w-home"></span>
            <button class="link" data-act="home-out">${tr('voltar a alugar', 'go back to renting')}</button>`
            : `<span class="muted">${tr('Você mora de aluguel. Com um imóvel seu vago (aba Imóveis), dá para morar nele e cortar 40% do custo de vida.',
              'You rent. With a vacant property of your own (Real estate tab), you can live in it and cut 40% of your cost of living.')}</span>`}</p></section>`;
        }
        return h;
      },
      update(S) {
        const W = G.work;
        dis('b-sabb', !W.canSabbatical(S));
        why('b-sabb', W.canSabbatical(S) ? '' : S.day - (S.job.since || 0) < 1800
          ? tr(`precisa de 5 anos na mesma empresa (faltam ${f.num((1800 - (S.day - (S.job.since || 0))) / 360, 1)})`,
            `needs 5 years at the same company (${f.num((1800 - (S.day - (S.job.since || 0))) / 360, 1)} to go)`)
          : tr('só um sabático a cada 7 anos', 'only one sabbatical every 7 years'));
        if (S.tabs.estilo) {
          const LF = G.life;
          for (const id in LF.CITIES) {
            set(`w-cc-${id}`, f.money(LF.cityCost(S, id)));
            dis(`b-city-${id}`, S.cash < LF.cityCost(S, id));
            why(`b-city-${id}`, need(S, { cash: LF.cityCost(S, id) }));
          }
          const upkeep = LF.home(S) ? G.realty.value(S, LF.home(S)) * G.realty.VACANT_COST : 0;
          set('w-home', LF.homeOk(S) ? tr(`custo de vida −40% (${f.money(W.rentCost(S) - W.cost(S))}/mês); condomínio e IPTU: ${f.money(upkeep)}/mês.`,
            `cost of living −40% (${f.money(W.rentCost(S) - W.cost(S))}/month); building fees and property tax: ${f.money(upkeep)}/month.`)
            : LF.home(S) ? `${homeWhy(S, LF.home(S))}${tr(', sem desconto no custo de vida.', ', no cost-of-living discount.')}` : '');
        }
        set('w-sal', f.money(W.salary(S)));
        set('w-ot', '+' + f.money(W.otGain(S)));
        set('w-st', `+${f.num(W.studyGain(S), 1)} ${tr('conhecimento', 'knowledge')}`);
        dis('b-promote', !W.canPromote(S));
        const nx = W.nextLevel(S);
        why('b-promote', !nx || W.canPromote(S) ? '' : !S.job.employed ? tr('você está sem emprego', 'you are unemployed')
          : [S.knowledge < nx.k && tr(`faltam ${f.num(nx.k - S.knowledge, 0)} de conhecimento`, `${f.num(nx.k - S.knowledge, 0)} knowledge short`),
            S.reputation < nx.rep && tr(`faltam ${f.num(nx.rep - S.reputation, 0)} de reputação`, `${f.num(nx.rep - S.reputation, 0)} reputation short`)].filter(Boolean).join(tr(' e ', ' and ')));
        dis('b-ot', !W.canAct(S, W.OT_COST));
        why('b-ot', need(S, { energy: W.OT_COST }));
        dis('b-study', !W.canAct(S, W.studyCost(S)));
        why('b-study', need(S, { energy: W.studyCost(S) }));
        const sb = W.searchBlock(S);
        dis('b-search', !!sb || !W.canAct(S, W.SEARCH_COST));
        why('b-search', sb === 'cedo' ? tr(`processos seletivos levam no mínimo 1 mês: respostas a partir de ${f.date(W.hireFrom(S))}`,
          `hiring takes at least a month: answers from ${f.date(W.hireFrom(S))} on`)
          : sb === 'hoje' ? tr('você já mandou currículos hoje; tente amanhã', 'you already sent out résumés today; try tomorrow')
          : need(S, { energy: W.SEARCH_COST }));
        if (S.research.rotina) {
          // Estimativa do que o piloto faz por dia com a energia que sobra das empresas.
          const free = W.freeEnergy(S), r = S.routine;
          const studyShare = r === 'estudar' || (r !== 'off' && S.job.retired) ? 1 : r === 'misto' ? 0.5 : 0;
          const perDay = [];
          if (studyShare) perDay.push(`+${f.num((free * studyShare) / W.studyCost(S) * W.studyGain(S), 1)} ${tr('conhecimento', 'knowledge')}`);
          if (studyShare < 1 && r !== 'off' && S.job.employed) perDay.push(`+${f.money((free * (1 - studyShare)) / W.OT_COST * W.otGain(S))}`);
          if (studyShare < 1 && r !== 'off' && !S.job.employed && !S.job.retired) perDay.push(tr('procurando emprego', 'job hunting'));
          set('w-auto', r === 'off' ? tr('mantém 25% de energia de reserva, sem risco de burnout', 'keeps 25% energy in reserve, no burnout risk')
            : `≈ ${perDay.join(tr(' e ', ' and '))} ${tr('por dia', 'per day')}`);
        }
        if (S.research.fire) {
          const nw = G.portfolio.netWorth(S), fire = W.fireNumber(S);
          set('w-fire', f.money(fire));
          set('w-fire-pct', f.pct(nw / fire, 0));
          set('w-passive', f.money(W.passiveIncome(S)));
          set('w-cost', f.money(W.cost(S)));
          dis('b-retire', !W.canRetire(S));
        }
        show('w-burn', S.burnout > 0);
        set('w-burn', tr(`Em burnout: mais ${S.burnout} dia(s) de descanso.`, `Burned out: ${S.burnout} more day(s) of rest.`));
        if (S.tabs.estilo) {
          W.LIFESTYLE.forEach((l, i) => {
            const rentI = l.cost * S.macro.priceIndex * W.costMult(S), home = G.life.home(S), hp = home && G.realty.prop(home.pid);
            const own = hp && hp.people >= G.social.familySize(S) && G.realty.value(S, home) >= G.life.HOME_MIN * rentI ? 1 - G.life.HOME_SHARE : 1;
            set(`ls-c-${i}`, f.money(rentI * own) + tr('/mês', '/month'));
            const small = i < S.lifestyle && !W.fits(S, i);
            dis(`b-ls-${i}`, small || S.cash < W.moveCost(S, i));
            why(`b-ls-${i}`, small ? tr(`sua família tem ${G.social.familySize(S)} pessoas; aqui cabem ${l.people}`,
              `your family has ${G.social.familySize(S)} people; this fits ${l.people}`) : need(S, { cash: W.moveCost(S, i) }));
          });
        }
      },
    },

    investimentos: {
      unlocked: S => Object.keys(G.ASSETS).filter(id => G.portfolio.unlocked(S, id)),
      shown(S) {
        return this.unlocked(S).filter(id => invFilter === ALL || G.ASSETS[id].cls === invFilter);
      },
      key(S) {
        return [invFilter, this.unlocked(S).join(','), G.tax.exemptSales(S), !!S.research.aporte_auto, !!S.research.rebalanceamento, !!S.research.quant, !!S.research.cripto, !!S.research.tributacao, !!S.research.dividendos, !!S.research.fundamentalista].join('|');
      },
      build(S) {
        const classes = [ALL, ...new Set(this.unlocked(S).map(id => G.ASSETS[id].cls))];
        if (!classes.includes(invFilter)) invFilter = ALL;
        let h = tr(`<section class="card summary"><span>Total investido <b id="i-tot"></b></span>
          <span>Renda ~<b id="i-y"></b>/mês</span><span>Caixa livre <b id="i-cash"></b></span>
          <span>IR pago <b id="i-tax"></b></span>`, `<section class="card summary"><span>Total invested <b id="i-tot"></b></span>
          <span>Income ~<b id="i-y"></b>/month</span><span>Free cash <b id="i-cash"></b></span>
          <span>Income tax paid <b id="i-tax"></b></span>`);
        if (S.research.tributacao) {
          h += tr(`<span>Vendas de ações no mês <b id="i-sales"></b> / ${f.money(G.tax.exemptSales(S))} isentos</span>
            <span>IR a apurar <b id="i-pend"></b></span>`, `<span>Stock sales this month <b id="i-sales"></b> / ${f.money(G.tax.exemptSales(S))} exempt</span>
            <span>Income tax due <b id="i-pend"></b></span>`);
          if (S.research.cripto) h += tr(`<span>Vendas de cripto no mês <b id="i-csales"></b> / ${f.money(G.tax.CRYPTO_EXEMPT)} isentos</span>`,
            `<span>Crypto sales this month <b id="i-csales"></b> / ${f.money(G.tax.CRYPTO_EXEMPT)} exempt</span>`);
        }
        if (S.research.dividendos) {
          h += `<label class="check"><input type="checkbox" data-act="reinvest" id="i-reinv"> ${tr('Reinvestir dividendos e aluguéis', 'Reinvest dividends and rents')}</label>`;
        }
        h += '</section>';
        if (S.research.aporte_auto) h += autoSection(S, this.unlocked(S));
        if (classes.length > 2) {
          h += '<div class="filters">' + classes.map(c =>
            `<button data-act="filter" data-id="${c}" class="${c === invFilter ? 'active' : ''}">${c}</button>`).join('') + '</div>';
        }
        for (const id of this.shown(S)) {
          const a = G.ASSETS[id], eq = a.kind === 'equity';
          const buyW = eq ? tr('Comprar', 'Buy') : tr('Aplicar', 'Deposit'), sellW = eq ? tr('Vender', 'Sell') : tr('Resgatar', 'Withdraw');
          h += `<section class="card asset">
            <div class="asset-head"><h3>${a.n}</h3><span class="tag">${a.cls}</span><span class="yield" id="a-y-${id}"></span></div>
            <p class="muted">${a.d}</p>
            <canvas class="spark zoom" id="a-c-${id}" data-act="chart" data-id="asset:${id}" title="${tr('Clique para ampliar', 'Click to enlarge')}"></canvas>
            <div class="asset-pos"><span class="muted">${tr('Cota', 'Price')} <span id="a-p-${id}"></span> <span id="a-dc-${id}"></span></span> ·
              ${eq && id !== 'ibov' && S.research.fundamentalista ? `Valuation <b id="a-val-${id}"></b> · ` : ''}${tr('Posição', 'Position')} <b id="a-v-${id}"></b> <span id="a-pl-${id}"></span> <span id="a-lock-${id}" class="muted"></span></div>
            <div class="asset-ops">
              <input id="a-in-${id}" inputmode="decimal" placeholder="${tr('valor em R$', 'amount in R$')}">
              <button data-act="buy" data-id="${id}" id="b-buy-${id}">${buyW}</button>
              <button data-act="buymax" data-id="${id}" id="b-max-${id}">${buyW} ${tr('com todo o caixa', 'all cash')}</button>
              <button data-act="sell" data-id="${id}" id="b-sell-${id}">${sellW}</button>
              <button data-act="sellall" data-id="${id}" id="b-sellall-${id}">${sellW} ${tr('tudo', 'all')}</button>
            </div>
            <div class="asset-ops"><span class="frac"><small>${buyW} ${tr('% do caixa', '% of cash')}:</small>${FRACS.map(x =>
              `<button data-act="buyfrac" data-id="${id}" data-f="${x}" id="b-bf${x * 100}-${id}">${x * 100}%</button>`).join('')}</span>
              <span class="frac"><small>${sellW} ${tr('% da posição', '% of position')}:</small>${FRACS.map(x =>
              `<button data-act="sellfrac" data-id="${id}" data-f="${x}" id="b-sf${x * 100}-${id}">${x * 100}%</button>`).join('')}</span>
            </div></section>`;
        }
        return h;
      },
      update(S) {
        const P = G.portfolio;
        set('i-tot', f.money(P.invested(S)));
        set('i-y', f.money(P.monthlyYield(S)));
        set('i-cash', f.money(S.cash));
        set('i-tax', f.money(S.tax.paid));
        set('i-sales', f.money(S.tax.acaoSales));
        set('i-csales', f.money(S.tax.criptoSales));
        set('i-pend', f.money(G.tax.pending(S)));
        const sales = $('i-sales');
        if (sales) sales.className = S.tax.acaoSales > G.tax.exemptSales(S) ? 'bad' : '';
        const rv = $('i-reinv');
        if (rv) rv.checked = !!S.settings.reinvest;
        if (S.research.aporte_auto) updateAuto(S, this.unlocked(S));
        for (const id of this.shown(S)) {
          const a = G.ASSETS[id];
          const v = P.value(S, id), c = P.cost(S, id), lk = P.locked(S, id);
          const y = G.market.annualYield(S, id), h = S.market.hist[id];
          set(`a-y-${id}`, a.kind === 'equity'
            ? `${a.divFreq === 12 ? tr('Aluguéis', 'Rents') : tr('Dividendos', 'Dividends')} ${f.pct(y)} ${tr('a.a.', 'p.a.')}`
            : `${f.pct(y)} ${tr('a.a.', 'p.a.')}${a.kind === 'pre' ? tr(' (taxa de mercado)', ' (market rate)') : ''}`);
          set(`a-p-${id}`, f.money(S.market.prices[id] * (a.unit || 1)));
          const dc = $(`a-dc-${id}`);
          if (dc && h.length > 1) {
            const ch = h[h.length - 1] / h[h.length - 2] - 1;
            dc.textContent = `(${f.signedPct(ch)} ${tr('hoje', 'today')})`;
            dc.className = ch >= 0 ? 'good' : 'bad';
          }
          set(`a-v-${id}`, f.money(v));
          const val = $(`a-val-${id}`);
          if (val) {
            const dev = S.market.idio[id] || 0;
            val.textContent = dev > 0.15 ? tr('caro', 'expensive') : dev < -0.15 ? tr('barato', 'cheap') : tr('justo', 'fair');
            val.className = dev > 0.15 ? 'bad' : dev < -0.15 ? 'good' : '';
          }
          const pl = $(`a-pl-${id}`);
          if (pl) {
            pl.textContent = c > 0 ? `${f.money(v - c)} (${f.signedPct(v / c - 1)})` : '';
            pl.className = v >= c ? 'good' : 'bad';
          }
          set(`a-lock-${id}`, lk.value > 0.01 ? tr(`· ${f.money(lk.value)} em carência (próxima liberação em ${lk.inDays} dias)`,
            `· ${f.money(lk.value)} locked (next release in ${lk.inDays} days)`) : '');
          const noCash = S.cash < 0.01, noPos = v - lk.value < 0.01;
          for (const bid of [`b-buy-${id}`, `b-max-${id}`, ...FRACS.map(x => `b-bf${x * 100}-${id}`)]) {
            dis(bid, noCash);
            why(bid, noCash ? tr('sem caixa livre', 'no free cash') : '');
          }
          for (const bid of [`b-sell-${id}`, `b-sellall-${id}`, ...FRACS.map(x => `b-sf${x * 100}-${id}`)]) {
            dis(bid, noPos);
            why(bid, noPos ? (lk.value > 0.01 ? tr('tudo em carência', 'all locked') : tr('sem posição', 'no position')) : '');
          }
          spark(`a-c-${id}`, h, { ma: S.research.analise_tecnica && a.kind === 'equity' ? 200 : 0 });
        }
      },
    },

    conhecimento: {
      key: S => G.RESEARCH.map(r => (S.research[r.id] ? 'o' : G.research.visible(S, r) ? 'v' : G.research.teased(S, r) ? 't' : '-')).join(''),
      build(S) {
        const R = G.research;
        const done = G.RESEARCH.filter(r => S.research[r.id]).length;
        let h = `<section class="card summary"><span>${tr('Conhecimento', 'Knowledge')} <b id="k-have"></b></span>
          <span>${tr('Ganho passivo', 'Passive gain')} <b id="k-rate"></b>/${tr('dia', 'day')}</span><span>${tr('Pesquisas', 'Research')} <b>${done}/${G.RESEARCH.length}</b></span></section>`;
        for (const [b, name] of G.BRANCHES) {
          const nodes = G.RESEARCH.filter(r => r.b === b);
          const avail = nodes.filter(r => R.visible(S, r));
          const teased = nodes.filter(r => !R.visible(S, r) && R.teased(S, r));
          const owned = nodes.filter(r => S.research[r.id]);
          if (!avail.length && !teased.length && !owned.length) continue;
          const hidden = nodes.length - avail.length - teased.length - owned.length;
          h += `<section class="card"><h3>${name} <small>${owned.length}/${nodes.length}</small></h3>`;
          for (const r of avail) {
            h += `<div class="research"><div><b>${r.n}</b><p class="muted">${r.d}</p></div>
              <button data-act="research" data-id="${r.id}" id="b-r-${r.id}">${tr('Pesquisar', 'Research')} <small>${r.k} ${tr('conhecimento', 'knowledge')}${r.cost ? ' + ' + f.money(r.cost) : ''}</small></button></div>`;
          }
          for (const r of teased) {
            const missing = r.req.filter(q => !S.research[q]).map(q => R.byId(q).n).join(', ');
            h += `<div class="research locked"><div><b>${r.n}</b><p class="muted">${tr('Requer', 'Requires')}: ${missing}</p></div></div>`;
          }
          for (const r of owned) h += `<div class="research done"><div><b>✓ ${r.n}</b> <span class="muted">${r.d}</span></div></div>`;
          if (hidden > 0) h += `<p class="muted">${tr(`+ ${hidden} pesquisa(s) ainda oculta(s)`, `+ ${hidden} more hidden research item(s)`)}</p>`;
          h += '</section>';
        }
        return h;
      },
      update(S) {
        set('k-have', f.num(S.knowledge, 1));
        let rate = G.work.knowledgeRate(S);
        if (S.research.experiencia) rate += Object.keys(S.port).filter(id => G.portfolio.value(S, id) > 1).length / 30;
        set('k-rate', '+' + f.num(rate, 2));
        for (const r of G.RESEARCH) {
          dis(`b-r-${r.id}`, !G.research.affordable(S, r));
          why(`b-r-${r.id}`, S.knowledge < r.k ? tr(`faltam ${f.num(r.k - S.knowledge, 1)} de conhecimento`, `${f.num(r.k - S.knowledge, 1)} knowledge short`) : need(S, { cash: r.cost || 0 }));
        }
      },
    },

    mercado: {
      key: S => ['macro1', 'macro2', 'curva', 'rv1', 'sentimento', 'pmi', 'focus', 'cripto', 'ciclo_cripto'].map(r => +!!S.research[r]).join(''),
      build(S) {
        const R = S.research;
        const zoomTip = tr('Clique para ampliar', 'Click to enlarge');
        let h = `<section class="card"><h3>${tr('Juros', 'Interest rates')}</h3>
          <p>Selic: <b id="m-selic"></b> <span id="m-bias" class="muted"></span></p>
          <canvas class="spark tall zoom" id="m-selic-c" data-act="chart" data-id="selic" title="${zoomTip}"></canvas>
          <p class="muted">${tr('Histórico das decisões do Copom (a cada 45 dias).', 'History of Copom rate decisions (every 45 days).')}</p>`;
        if (R.macro1) h += tr('<p>Próximo Copom em <b id="m-copom"></b>.</p>', '<p>Next Copom meeting in <b id="m-copom"></b>.</p>');
        if (R.focus) h += tr('<p>Boletim Focus: o mercado espera Selic de <b id="m-focus"></b> daqui a 12 meses.</p>',
          '<p>Focus survey: the market expects a Selic of <b id="m-focus"></b> 12 months from now.</p>');
        h += '</section>';
        if (R.macro1) {
          h += tr(`<section class="card"><h3>Inflação</h3>
            <p>Inflação corrente: <b id="m-infl"></b> a.a. · Juro real: <b id="m-real"></b></p>
            <p class="muted">Custo de vida acumulado desde o início: <b id="m-pi"></b></p></section>`,
            `<section class="card"><h3>Inflation</h3>
            <p>Current inflation: <b id="m-infl"></b> p.a. · Real rate: <b id="m-real"></b></p>
            <p class="muted">Cumulative cost of living since the start: <b id="m-pi"></b></p></section>`);
        }
        if (R.pmi) {
          h += tr(`<section class="card"><h3>Indicadores</h3>
            <p>PMI da indústria: <b id="m-pmi"></b> <span class="muted">(acima de 50, a indústria cresce; costuma virar antes do ciclo)</span></p>
            <canvas class="spark tall zoom" id="m-pmi-c" data-act="chart" data-id="pmi" title="${zoomTip}"></canvas>
            <p>Desemprego: <b id="m-unemp"></b> <span class="muted">(reage devagar; confirma o ciclo depois que ele já virou)</span></p></section>`,
            `<section class="card"><h3>Indicators</h3>
            <p>Manufacturing PMI: <b id="m-pmi"></b> <span class="muted">(above 50, industry is growing; it usually turns before the cycle)</span></p>
            <canvas class="spark tall zoom" id="m-pmi-c" data-act="chart" data-id="pmi" title="${zoomTip}"></canvas>
            <p>Unemployment: <b id="m-unemp"></b> <span class="muted">(reacts slowly; confirms the cycle after it has already turned)</span></p></section>`);
        }
        if (R.macro2) {
          h += tr(`<section class="card"><h3>Ciclo econômico</h3>
            <p>Leitura deste mês: <b id="m-cycle"></b></p>
            <p class="muted">Estimativa com ruído (${R.curva ? '~85%' : '~60%'} de acerto). Ciclo típico: Expansão → Pico → Recessão → Recuperação.</p></section>`,
            `<section class="card"><h3>Business cycle</h3>
            <p>This month's reading: <b id="m-cycle"></b></p>
            <p class="muted">Noisy estimate (${R.curva ? '~85%' : '~60%'} accurate). Typical cycle: Expansion → Peak → Recession → Recovery.</p></section>`);
        }
        if (R.curva) {
          h += tr(`<section class="card"><h3>Curva de juros</h3>
            <p>Prefixado <b id="m-pre"></b> vs Selic <b id="m-selic2"></b> → <b id="m-curve"></b></p></section>`,
            `<section class="card"><h3>Yield curve</h3>
            <p>Fixed-rate <b id="m-pre"></b> vs Selic <b id="m-selic2"></b> → <b id="m-curve"></b></p></section>`);
        }
        if (R.rv1) {
          h += tr(`<section class="card"><h3>Bolsa</h3>
            <p>Ibovespa: <b id="m-ibov"></b> pts · <span id="m-ibov12"></span> em 12 meses</p>`, `<section class="card"><h3>Stock market</h3>
            <p>Ibovespa: <b id="m-ibov"></b> pts · <span id="m-ibov12"></span> over 12 months</p>`) +
            `<canvas class="spark tall zoom" id="m-ibov-c" data-act="chart" data-id="asset:ibov" title="${zoomTip}"></canvas>`;
          if (R.sentimento) {
            h += tr(`<p>Medo e ganância: <b id="m-fg"></b> <span class="muted">(quando todos estão gananciosos, cuidado; quando têm medo, oportunidade)</span></p>
              <p>P/L do Ibovespa: <b id="m-pe"></b> <span class="muted">(média histórica ≈ 9; bolsa cara tende a render menos daqui para frente)</span></p>`,
              `<p>Fear & greed: <b id="m-fg"></b> <span class="muted">(when everyone is greedy, be careful; when they're afraid, opportunity)</span></p>
              <p>Ibovespa P/E: <b id="m-pe"></b> <span class="muted">(historical average ≈ 9; an expensive market tends to return less from here)</span></p>`);
          }
          h += '</section>';
        }
        if (R.cripto) {
          h += tr(`<section class="card"><h3>Cripto</h3>
            <p>Bitcoin: <b id="m-btc"></b> · <span id="m-btc12"></span> em 12 meses · próximo halving: <b id="m-halving"></b></p>`,
            `<section class="card"><h3>Crypto</h3>
            <p>Bitcoin: <b id="m-btc"></b> · <span id="m-btc12"></span> over 12 months · next halving: <b id="m-halving"></b></p>`);
          if (R.ciclo_cripto) h += tr('<p>Fase do ciclo: <b id="m-cphase"></b> <span class="muted">(pós-halving → euforia → estouro → inverno → acumulação)</span></p>',
            '<p>Cycle phase: <b id="m-cphase"></b> <span class="muted">(post-halving → euphoria → bust → winter → accumulation)</span></p>');
          h += '</section>';
        }
        h += tr(`<section class="card"><h3>Política</h3>
          <p>Governo: <b id="m-policy"></b> · Próxima eleição: <b id="m-elec"></b></p></section>`,
          `<section class="card"><h3>Politics</h3>
          <p>Government: <b id="m-policy"></b> · Next election: <b id="m-elec"></b></p></section>`);
        return h;
      },
      update(S) {
        const m = S.macro, t = G.macro.target(S);
        set('m-selic', f.pct(m.selic));
        spark('m-selic-c', m.selicHist, { neutral: true });
        if (S.research.macro1) {
          const bias = t.selic - m.selic + (m.infl - t.infl) * 0.5;
          set('m-bias', bias > 0.002 ? tr('· viés de alta', '· hawkish bias') : bias < -0.002 ? tr('· viés de baixa', '· dovish bias') : tr('· viés neutro', '· neutral bias'));
          set('m-copom', `${Math.max(0, m.nextCopom - S.day)} ${tr('dias', 'days')}`);
          set('m-infl', f.pct(m.infl));
          set('m-real', f.pct((1 + m.selic) / (1 + m.infl) - 1));
          set('m-pi', f.signedPct(m.priceIndex - 1, 1));
        } else set('m-bias', '');
        if (S.research.focus) set('m-focus', f.pct(m.shown.focus));
        if (S.research.pmi) {
          set('m-pmi', f.num(m.shown.pmi, 1));
          spark('m-pmi-c', m.pmiHist, { neutral: true });
          set('m-unemp', f.pct(m.shown.unemp, 1));
        }
        if (S.research.macro2) set('m-cycle', m.perceived ? G.macro.REGIMES[m.perceived].n : tr('aguardando dados do mês', 'waiting for this month\'s data'));
        if (S.research.curva) {
          const spread = S.market.pre - m.selic;
          set('m-pre', f.pct(S.market.pre));
          set('m-selic2', f.pct(m.selic));
          set('m-curve', spread > 0.01 ? tr('inclinada: mercado espera alta de juros', 'steep: the market expects rate hikes')
            : spread < -0.005 ? tr('invertida: mercado espera cortes (recessão à vista?)', 'inverted: the market expects cuts (recession ahead?)') : tr('plana', 'flat'));
        }
        if (S.research.rv1) {
          const h = S.market.hist.ibov, r12 = h[h.length - 1] / h[Math.max(0, h.length - 361)] - 1;
          set('m-ibov', f.num(S.market.prices.ibov * 1300));
          const el = $('m-ibov12');
          el.textContent = f.signedPct(r12, 1);
          el.className = r12 >= 0 ? 'good' : 'bad';
          spark('m-ibov-c', h, { ma: S.research.analise_tecnica ? 200 : 0 });
          const fg = S.market.fg;
          set('m-pe', f.num(G.market.pe(S), 1));
          set('m-fg', `${Math.round(fg)} · ${fg < 25 ? tr('medo extremo', 'extreme fear') : fg < 45 ? tr('medo', 'fear') : fg < 55 ? tr('neutro', 'neutral')
            : fg < 75 ? tr('ganância', 'greed') : tr('ganância extrema', 'extreme greed')}`);
        }
        if (S.research.cripto) {
          const hb = S.market.hist.bitcoin, r12 = hb[hb.length - 1] / hb[Math.max(0, hb.length - 361)] - 1;
          set('m-btc', f.money(S.market.prices.bitcoin * G.ASSETS.bitcoin.unit));
          const el = $('m-btc12');
          el.textContent = f.signedPct(r12, 1);
          el.className = r12 >= 0 ? 'good' : 'bad';
          set('m-halving', f.monthYear(G.market.nextHalving(S.day)));
          set('m-cphase', G.market.cryptoPhase(S.day));
        }
        set('m-policy', G.macro.POLICIES[m.policy].n);
        set('m-elec', `${f.MESES[9]}/${G.cal.nextElection(S.day)}`);
      },
    },

    vida: {
      key(S) {
        const so = S.social, SO = G.social;
        return [SO.tierIdx(S), SO.slots(S), Object.entries(so.habits).map(([k, h]) => k + h.state).join(','),
          Object.keys(so.clubs).join(','), so.family.married, so.family.kids,
          so.family.school, ['etiqueta', 'comunicacao', 'oratoria'].map(r => +!!S.research[r]).join('')].join('|');
      },
      build(S) {
        const SO = G.social, so = S.social, t = SO.tierIdx(S);
        let h = `<section class="card summary"><span>${tr('Posição social', 'Social status')} <b>${SO.tierName(S)}</b></span>
          <span>${tr('Prestígio', 'Prestige')} <b id="v-prest"></b></span><span>${tr('Visibilidade', 'Visibility')} <b id="v-vis"></b></span>
          <span>Stress <b id="v-stress"></b></span><span id="v-next" class="muted"></span>
          <span id="v-nr" class="bad" hidden>${tr('Visibilidade muito acima do prestígio: fama de novo-rico atrai crítica e golpistas.',
            'Visibility far above prestige: a nouveau-riche reputation attracts criticism and con artists.')}</span></section>`;

        // Hábitos
        h += `<section class="card"><h3>${tr('Hábitos', 'Habits')} <small id="v-slots"></small></h3>
          <p class="muted">${tr(`Um hábito leva ${SO.formDays(S)} dias para se formar e custa energia todo dia nesse período; depois fica quase de graça.
          Stress acima de 70 pode quebrar hábitos já formados.`, `A habit takes ${SO.formDays(S)} days to form and costs energy every day during that time; after that it's almost free.
          Stress above 70 can break habits already formed.`)}</p><table class="tbl">`;
        for (const id of Object.keys(so.habits)) {
          const d = SO.HABITS[id];
          h += `<tr><td><b class="${d.good ? '' : 'bad'}">${d.n}</b><br><small class="muted">${d.d}</small></td>
            <td id="v-h-${id}"></td><td><button data-act="habit-drop" data-id="${id}" id="b-hd-${id}">${d.good ? tr('Abandonar', 'Drop') : tr('Largar', 'Quit')}</button></td></tr>`;
        }
        h += '</table><div class="btns">';
        for (const [id, d] of Object.entries(SO.HABITS)) {
          if (!d.good || so.habits[id]) continue;
          h += `<button data-act="habit-start" data-id="${id}" id="b-hs-${id}" title="${esc(d.d)}">${d.n}
            <small>${d.cost} ${tr('energia/dia para formar', 'energy/day to form')} · ${esc(d.d)}</small></button>`;
        }
        h += '</div></section>';

        // Vida social
        h += `<section class="card"><h3>${tr('Vida social', 'Social life')}</h3><div class="btns">`;
        for (const a of SO.ACTIVITIES) {
          if ((a.tier || 0) > t + 1 || (a.req && !S.research[a.req])) continue;
          const locked = (a.tier || 0) > t;
          const gains = [a.vis && `+${a.vis} ${tr('visib.', 'visib.')}`, a.prest && `+${a.prest} ${tr('prestígio', 'prestige')}`,
            a.know && `+${a.know} ${tr('conhec.', 'knowl.')}`, a.fee && tr('cachê', 'fee')].filter(Boolean).join(', ');
          h += `<button data-act="social" data-id="${a.id}" id="b-sa-${a.id}">${a.n}
            <small>${locked ? `${tr('requer', 'requires')} ${SO.TIERS[a.tier][1]}` : `${a.energy} ${tr('energia', 'energy')}${a.cost ? ' · <span id="v-ac-' + a.id + '"></span>' : ''} · ${gains}`}</small></button>`;
        }
        h += '</div></section>';

        // Clubes
        if (S.research.etiqueta) {
          h += `<section class="card"><h3>${tr('Clubes', 'Clubs')}</h3><table class="tbl">`;
          for (const c of SO.CLUBS) {
            const member = so.clubs[c.id];
            h += `<tr><td><b>${c.n}</b><br><small class="muted">${c.d}</small></td><td id="v-cf-${c.id}"></td>
              <td>${member ? `<button data-act="club-leave" data-id="${c.id}">${tr('Sair', 'Leave')}</button>`
                : c.tier > t ? `<small class="muted">${tr('requer', 'requires')} ${SO.TIERS[c.tier][1]}</small>`
                : `<button data-act="club-join" data-id="${c.id}" id="b-cj-${c.id}">${tr('Entrar', 'Join')} <small id="v-cj-${c.id}"></small></button>`}</td></tr>`;
          }
          h += '</table></section>';
        }

        // Consumo e filantropia
        h += tr('<section class="card"><h3>Consumo</h3><p class="muted">Visibilidade na hora, mas ela some rápido (cai 10% ao mês).</p><div class="btns">',
          '<section class="card"><h3>Spending</h3><p class="muted">Instant visibility, but it fades fast (drops 10% per month).</p><div class="btns">');
        for (const l of SO.LUXURY) {
          if ((l.tier || 0) > t) continue;
          h += `<button data-act="luxury" data-id="${l.id}" id="b-lx-${l.id}">${l.n} <small><span id="v-lx-${l.id}"></span> · +${l.vis} ${tr('visib.', 'visib.')}${l.stress ? ', −stress' : ''}</small></button>`;
        }
        h += tr(`</div></section><section class="card"><h3>Filantropia</h3>
          <p class="muted">Doar gera prestígio durável. Total doado: <b id="v-don"></b></p>
          <p><input id="v-don-in" inputmode="decimal" placeholder="valor em R$"> <button data-act="donate">Doar</button></p></section>`,
          `</div></section><section class="card"><h3>Philanthropy</h3>
          <p class="muted">Giving builds lasting prestige. Total donated: <b id="v-don"></b></p>
          <p><input id="v-don-in" inputmode="decimal" placeholder="amount in R$"> <button data-act="donate">Donate</button></p></section>`);

        // Família
        const f = so.family;
        h += tr(`<section class="card"><h3>Família</h3><p>${f.married ? 'Casado(a)' : 'Solteiro(a)'} · ${f.kids} filho(s)
          ${f.married && f.spouseIncome ? ' · renda do cônjuge <b id="v-sp"></b>/mês' : ''}</p>
          <p class="muted">Casar aumenta o custo de vida em 40% e reduz o stress; cada filho, +25%. Sem filhos, não há herdeiro para o seu legado.</p><div class="btns">`,
          `<section class="card"><h3>Family</h3><p>${f.married ? 'Married' : 'Single'} · ${f.kids} ${f.kids === 1 ? 'child' : 'children'}
          ${f.married && f.spouseIncome ? ' · spouse income <b id="v-sp"></b>/month' : ''}</p>
          <p class="muted">Marriage raises the cost of living by 40% and lowers stress; each child, +25%. Without children, there is no heir for your legacy.</p><div class="btns">`);
        if (!f.married) {
          h += `<button data-act="marry" data-id="0" id="b-m0">${tr('Casar', 'Get married')} <small id="v-m0"></small></button>
            <button data-act="marry" data-id="1" id="b-m1">${tr('Casamento de revista', 'Society-page wedding')} <small id="v-m1"></small></button>`;
        } else h += `<button data-act="kid" id="b-kid">${tr('Ter um filho', 'Have a child')} <small id="v-kid"></small></button>`;
        if (f.kids) h += `<button data-act="school">${f.school ? tr('Tirar da escola particular', 'Leave private school') : tr('Escola particular', 'Private school')} <small id="v-sch"></small></button>`;
        h += '</div><p id="v-kidst"></p><p id="v-house"></p></section>';
        return h;
      },
      update(S) {
        const SO = G.social, so = S.social, pi = S.macro.priceIndex, t = SO.tierIdx(S);
        set('v-prest', f.num(so.prestige, 1));
        set('v-vis', f.num(so.visibility, 1));
        const st = $('v-stress');
        st.textContent = f.num(so.stress, 0);
        st.className = so.stress > 70 ? 'bad' : '';
        const nx = SO.nextTier(S);
        set('v-next', nx ? tr(`faltam ${f.num(nx[0] - SO.score(S), 1)} pontos para ${nx[1]}`, `${f.num(nx[0] - SO.score(S), 1)} points to ${nx[1]}`) : '');
        show('v-nr', SO.nouveauRiche(S));
        set('v-slots', `${SO.used(S)}/${SO.slots(S)} ${tr('vagas', 'slots')}`);
        for (const [id, h] of Object.entries(so.habits)) {
          set(`v-h-${id}`, h.state === 'forming' ? tr(`formando: ${h.days}/${SO.formDays(S)} dias`, `forming: ${h.days}/${SO.formDays(S)} days`)
            : h.state === 'quitting' ? tr(`largando: ${h.days}/${SO.QUIT_DAYS} dias`, `quitting: ${h.days}/${SO.QUIT_DAYS} days`) : tr('formado', 'formed'));
          dis(`b-hd-${id}`, h.state === 'quitting');
        }
        for (const id of Object.keys(SO.HABITS)) dis(`b-hs-${id}`, SO.used(S) >= SO.slots(S));
        for (const a of SO.ACTIVITIES) {
          dis(`b-sa-${a.id}`, !SO.canDo(S, a));
          why(`b-sa-${a.id}`, SO.canDo(S, a) ? '' : (a.tier || 0) > t ? tr(`requer posição ${SO.TIERS[a.tier][1]}`, `requires ${SO.TIERS[a.tier][1]} status`)
            : a.season && G.cal.season(S.day).id !== a.season ? tr('só no outono', 'autumn only')
            : a.cooldown && S.day < (so.cooldowns[a.id] || 0) ? tr(`de novo em ${so.cooldowns[a.id] - S.day} dias`, `available again in ${so.cooldowns[a.id] - S.day} days`)
            : need(S, { energy: a.energy, cash: a.cost * pi }));
          if (a.cost) set(`v-ac-${a.id}`, f.money(a.cost * pi));
        }
        for (const c of SO.CLUBS) {
          set(`v-cf-${c.id}`, f.money(c.fee * pi) + tr('/mês', '/month'));
          set(`v-cj-${c.id}`, `${tr('joia', 'joining fee')} ${f.money(6 * c.fee * pi)}`);
          dis(`b-cj-${c.id}`, S.cash < 6 * c.fee * pi);
          why(`b-cj-${c.id}`, need(S, { cash: 6 * c.fee * pi }));
        }
        for (const l of SO.LUXURY) {
          set(`v-lx-${l.id}`, f.money(l.cost * pi));
          dis(`b-lx-${l.id}`, S.cash < l.cost * pi);
          why(`b-lx-${l.id}`, need(S, { cash: l.cost * pi }));
        }
        set('v-don', f.money(so.donated));
        const fam = so.family;
        set('v-sp', f.money(fam.spouseIncome * pi));
        set('v-m0', f.money(60000 * pi));
        set('v-m1', f.money(800000 * pi) + ' · +20 visib.');
        set('v-kid', f.money(SO.KID_COST * pi) + tr(' + custo de vida · 9 meses de gravidez', ' + cost of living · 9-month pregnancy'));
        set('v-sch', f.money(4000 * pi) + tr('/mês por filho · prestígio', '/month per child · prestige'));
        dis('b-m0', S.cash < 60000 * pi);
        dis('b-m1', S.cash < 800000 * pi);
        const ks = SO.kidState(S), months = d => Math.max(1, Math.ceil((d - S.day) / 30));
        const kidMsg = ks === 'trying' ? tr('Vocês estão tentando engravidar.', 'You are trying to get pregnant.')
          : ks === 'pregnant' ? tr(`Bebê a caminho: nasce em ~${months(fam.pregnant.due)} mês(es), em ${f.monthYear(fam.pregnant.due)}.`,
            `Baby on the way: due in ~${months(fam.pregnant.due)} month(s), in ${f.monthYear(fam.pregnant.due)}.`)
          : ks === 'recovering' ? tr(`Recuperação do parto: dá para tentar outro filho em ~${months(fam.nextKid)} mês(es).`,
            `Recovering from the birth: you can try for another child in ~${months(fam.nextKid)} month(s).`) : '';
        set('v-kidst', fam.married || ks === 'pregnant' ? kidMsg : '');
        const crowd = G.work.crowded(S), house = $('v-house');
        set('v-house', tr(`Em casa: ${SO.familySize(S)} ${SO.familySize(S) === 1 ? 'pessoa' : 'pessoas'}; onde você mora cabem ${G.work.capacity(S)}.`,
          `At home: ${SO.familySize(S)} ${SO.familySize(S) === 1 ? 'person' : 'people'}; where you live fits ${G.work.capacity(S)}.`) +
          (crowd ? tr(' Apertado: mais stress e menos bem-estar. Mude em Trabalho → Estilo de vida.', ' Cramped: more stress and less well-being. Move in Work → Lifestyle.') : ''));
        if (house) house.className = crowd ? 'bad' : 'muted';
        dis('b-kid', ks !== 'ready' || S.cash < SO.KID_COST * pi);
        why('b-m0', need(S, { cash: 60000 * pi }));
        why('b-m1', need(S, { cash: 800000 * pi }));
        why('b-kid', ks !== 'ready' ? kidMsg : need(S, { cash: SO.KID_COST * pi }));
      },
    },

    lazer: {
      key(S) {
        const lf = S.life;
        return [Object.keys(lf.hobbies).join(','), G.life.hobbySlots(S), lf.collections.map(h => h.kind + h.lot + (h.selling ? 's' : '')).join(','),
          lf.second.map(h => h.id + (h.selling ? 's' : '')).join(','), lf.health, !!lf.pet, Object.keys(lf.bucket).join(','), G.social.tierIdx(S)].join('|');
      },
      build(S) {
        const LF = G.life, lf = S.life;
        let h = tr(`<section class="card summary"><span>Bem-estar <b id="lz-well"></b></span><span>Média da vida <b id="lz-avg"></b></span>
          <span>Stress <b id="lz-stress"></b></span><span id="lz-away" class="good"></span></section>
          <p class="muted">Bem-estar vem de família, saúde, hobbies, férias e pouco stress. A média da vida também vira pontos de legado.</p>`,
          `<section class="card summary"><span>Well-being <b id="lz-well"></b></span><span>Lifetime average <b id="lz-avg"></b></span>
          <span>Stress <b id="lz-stress"></b></span><span id="lz-away" class="good"></span></section>
          <p class="muted">Well-being comes from family, health, hobbies, vacations and low stress. The lifetime average also turns into legacy points.</p>`);

        // Férias
        h += tr(`<section class="card"><h3>Férias <small id="lz-vac"></small></h3>
          <p class="muted">Uma viagem por ano. Durante as férias você não trabalha nem estuda (a energia fica cheia) e empresas sem gerente ficam largadas.
          Um ano inteiro sem férias termina com +10 de stress.</p><div class="btns">`,
          `<section class="card"><h3>Vacations <small id="lz-vac"></small></h3>
          <p class="muted">One trip per year. On vacation you don't work or study (energy stays full) and businesses without a manager are neglected.
          A whole year without a vacation ends with +10 stress.</p><div class="btns">`);
        for (const d of LF.DESTINATIONS) {
          h += `<button data-act="vacation" data-id="${d.id}" id="b-vc-${d.id}">${lf.bucket[d.id] ? '✓ ' : ''}${d.n}
            <small><span id="lz-vc-${d.id}"></span> · ${d.days} ${tr('dias', 'days')} · ${d.stress} ${tr('de stress', 'stress')}${d.vis ? ` · +${d.vis} visib.` : ''}</small></button>`;
        }
        h += `</div><p class="muted">${tr(`Lista de desejos: ${Object.keys(lf.bucket).length}/${LF.DESTINATIONS.length} destinos visitados.`,
          `Bucket list: ${Object.keys(lf.bucket).length}/${LF.DESTINATIONS.length} destinations visited.`)}</p></section>`;

        // Hobbies
        h += `<section class="card"><h3>Hobbies <small>${Object.keys(lf.hobbies).length}/${LF.hobbySlots(S)} ${tr('vagas', 'slots')}</small></h3>
          <p class="muted">${tr('Custam energia todo dia e uma mensalidade. Sem energia, o efeito do mês cai na proporção dos dias perdidos.',
            'They cost energy every day plus a monthly fee. Without energy, the month\'s effect drops in proportion to the days missed.')}</p><table class="tbl">`;
        for (const [id, x] of Object.entries(LF.HOBBIES)) {
          const on = !!lf.hobbies[id];
          h += `<tr><td><b>${x.n}</b><br><small class="muted">${x.d}</small></td><td><small>${x.energy} ${tr('energia/dia', 'energy/day')} · <span id="lz-hc-${id}"></span>/${tr('mês', 'month')}</small></td>
            <td>${on ? `<button data-act="hobby-stop" data-id="${id}">${tr('Parar', 'Stop')}</button>` : `<button data-act="hobby-start" data-id="${id}" id="b-hb-${id}">${tr('Começar', 'Start')}</button>`}</td></tr>`;
        }
        h += '</table></section>';

        // Saúde e pet
        h += tr('<section class="card"><h3>Saúde</h3><p class="muted">Plano de saúde reduz o custo de imprevistos médicos. O premium inclui check-ups: +2 anos de vida e o aviso do médico chega antes.</p><div class="btns">',
          '<section class="card"><h3>Health</h3><p class="muted">Health insurance lowers the cost of medical emergencies. Premium includes check-ups: +2 years of life and the doctor\'s warning comes earlier.</p><div class="btns">');
        for (const [id, x] of Object.entries(LF.PLANS)) {
          h += `<button data-act="plan" data-id="${id}" class="${lf.health === id ? 'active' : ''}">${lf.health === id ? '✓ ' : ''}${x.n}
            <small>${x.cost ? `<span id="lz-pl-${id}"></span>/${tr('mês', 'month')} · ` : ''}${tr('imprevistos', 'emergencies')} ×${G.EN ? x.med : String(x.med).replace('.', ',')}</small></button>`;
        }
        h += tr(`</div><p class="muted">Depois dos 45, a energia máxima cai 1 por ano (metade com exercício ou corrida): hoje <b id="lz-age"></b>.</p></section>`,
          `</div><p class="muted">After 45, max energy drops 1 per year (half with exercise or running): currently <b id="lz-age"></b>.</p></section>`);
        h += '<section class="card"><h3>Pet</h3>';
        h += lf.pet
          ? tr(`<p>${esc(lf.pet.name)}, seu cachorro, está com você há <span id="lz-pet"></span>. −3 de stress por mês, +bem-estar, 1 de energia/dia e <span id="lz-petc"></span>/mês.</p>`,
            `<p>${esc(lf.pet.name)}, your dog, has been with you for <span id="lz-pet"></span>. −3 stress per month, +well-being, 1 energy/day and <span id="lz-petc"></span>/month.</p>`)
          : tr('<p class="muted">Um cachorro reduz o stress e aumenta o bem-estar. Vive de 10 a 15 anos.</p><button data-act="adopt" id="b-adopt">Adotar <small id="lz-adopt"></small></button>',
            '<p class="muted">A dog lowers stress and raises well-being. Lives 10 to 15 years.</p><button data-act="adopt" id="b-adopt">Adopt <small id="lz-adopt"></small></button>');
        h += '</section>';

        // Segunda casa
        h += tr(`<section class="card"><h3>Segunda casa</h3><p class="muted">−3 de stress por mês e +bem-estar; manutenção de 0,1% do valor ao mês.
          Com a casa de praia, as férias na praia saem de graça. Segue o índice imobiliário e entra no patrimônio.</p><table class="tbl">`,
          `<section class="card"><h3>Second home</h3><p class="muted">−3 stress per month and +well-being; upkeep of 0.1% of the value per month.
          With the beach house, beach vacations are free. Follows the real estate index and counts toward net worth.</p><table class="tbl">`);
        for (const x of LF.SECOND) {
          const i = lf.second.findIndex(y => y.id === x.id), own = lf.second[i];
          h += `<tr><td><b>${x.n}</b></td><td id="lz-2v-${x.id}"></td><td>${own ? (own.selling ? `<small class="muted">${tr('à venda', 'for sale')}</small>`
            : `<button data-act="second-sell" data-i="${i}">${tr('Vender', 'Sell')}</button>`) : `<button data-act="second-buy" data-id="${x.id}" id="b-2b-${x.id}">${tr('Comprar', 'Buy')} <small id="lz-2c-${x.id}"></small></button>`}</td></tr>`;
        }
        h += '</table></section>';

        // Coleções
        h += tr(`<section class="card"><h3>Coleções</h3><p class="muted">Peças valorizam (ou não) com o tempo e dão visibilidade e prestígio na compra. Vender é por leilão:
          de 1 a 4 meses, 10% de comissão e 15% de IR sobre o ganho.</p><table class="tbl">`,
          `<section class="card"><h3>Collections</h3><p class="muted">Pieces appreciate (or not) over time and give visibility and prestige when bought. Selling is by auction:
          1 to 4 months, 10% commission and 15% income tax on the gain.</p><table class="tbl">`);
        for (const [kind, c] of Object.entries(LF.COLLECTIONS)) {
          h += `<tr><td><b>${c.n}</b><br><small id="lz-cx-${kind}"></small></td><td class="ops">${LF.LOTS.map((l, i) =>
            `<button data-act="col-buy" data-id="${kind}" data-i="${i}" id="b-cb-${kind}-${i}">${c.lots[i]} <small id="lz-cc-${kind}-${i}"></small></button>`).join('')}</td></tr>`;
        }
        h += '</table>';
        if (lf.collections.length) {
          h += '<table class="tbl">';
          lf.collections.forEach((x, i) => {
            h += `<tr><td>${LF.COLLECTIONS[x.kind].lots[x.lot]}</td><td><b id="lz-cv-${i}"></b> <small id="lz-cp-${i}"></small></td>
              <td>${x.selling ? `<small class="muted" id="lz-cs-${i}"></small>` : `<button data-act="col-sell" data-i="${i}">${tr('Leiloar', 'Auction')}</button>`}</td></tr>`;
          });
          h += '</table>';
        }
        h += '</section>';
        return h;
      },
      update(S) {
        const LF = G.life, lf = S.life, pi = S.macro.priceIndex;
        set('lz-well', f.num(lf.well, 0));
        set('lz-avg', lf.wellN ? f.num(LF.avgWell(S), 0) : '—');
        set('lz-stress', f.num(S.social.stress, 0));
        set('lz-away', lf.away > 0 ? tr(`De férias: mais ${lf.away} dia(s)`, `On vacation: ${lf.away} more day(s)`) : '');
        const year = G.cal.of(S.day).year;
        set('lz-vac', lf.vacYear === year ? `${tr('feitas este ano', 'taken this year')}${lf.lastDest ? ': ' + LF.destName(lf.lastDest) : ''}` : tr('ainda não tirou este ano', 'not taken yet this year'));
        for (const d of LF.DESTINATIONS) {
          const c = LF.vacationCost(S, d);
          set(`lz-vc-${d.id}`, c ? f.money(c) : tr('grátis', 'free'));
          dis(`b-vc-${d.id}`, !LF.canVacation(S, d));
          why(`b-vc-${d.id}`, lf.vacYear === year ? tr('você já tirou férias este ano', 'you already took a vacation this year')
            : LF.away(S) ? tr('você já está de férias', 'you are already on vacation') : need(S, { cash: c }));
        }
        const full = Object.keys(lf.hobbies).length >= LF.hobbySlots(S);
        for (const [id, x] of Object.entries(LF.HOBBIES)) {
          set(`lz-hc-${id}`, f.money(x.cost * pi));
          dis(`b-hb-${id}`, full);
          why(`b-hb-${id}`, full ? tr('sem vaga para outro hobby', 'no slot for another hobby') : '');
        }
        for (const [id, x] of Object.entries(LF.PLANS)) if (x.cost) set(`lz-pl-${id}`, f.money(x.cost * pi));
        set('lz-age', LF.ageDrain(S) ? `−${LF.ageDrain(S)}` : tr('sem perda', 'no loss'));
        if (lf.pet) {
          const y = (S.day - lf.pet.born) / 360;
          set('lz-pet', y < 1 ? `${Math.floor(S.day - lf.pet.born)} ${tr('dias', 'days')}` : `${f.num(y, 1)} ${tr('anos', 'years')}`);
          set('lz-petc', f.money(400 * pi));
        } else {
          set('lz-adopt', f.money(2000 * pi));
          dis('b-adopt', S.cash < 2000 * pi);
          why('b-adopt', need(S, { cash: 2000 * pi }));
        }
        for (const x of LF.SECOND) {
          const own = lf.second.find(y => y.id === x.id), p = LF.secondPrice(S, x);
          set(`lz-2v-${x.id}`, own ? `${f.money(LF.value(S, own))}${own.selling ? ` · ~${own.selling} ${tr('dias', 'days')}` : ''}` : f.money(p));
          set(`lz-2c-${x.id}`, f.money(p * 1.03));
          dis(`b-2b-${x.id}`, S.cash < p * 1.03);
          why(`b-2b-${x.id}`, need(S, { cash: p * 1.03 }));
        }
        for (const [kind, c] of Object.entries(LF.COLLECTIONS)) {
          const h = S.market.hist[c.asset], r12 = h[h.length - 1] / h[Math.max(0, h.length - 361)] - 1;
          set(`lz-cx-${kind}`, tr(`mercado ${f.signedPct(r12, 1)} em 12 meses`, `market ${f.signedPct(r12, 1)} over 12 months`));
          LF.LOTS.forEach((l, i) => {
            const cost = LF.lotCost(S, i);
            set(`lz-cc-${kind}-${i}`, f.money(cost));
            dis(`b-cb-${kind}-${i}`, S.cash < cost);
            why(`b-cb-${kind}-${i}`, need(S, { cash: cost }));
          });
        }
        lf.collections.forEach((x, i) => {
          const v = LF.value(S, x);
          set(`lz-cv-${i}`, f.money(v));
          const pl = $(`lz-cp-${i}`);
          if (pl) {
            pl.textContent = `${f.signedPct(v / x.cost - 1, 1)} ${tr('desde a compra', 'since purchase')}`;
            pl.className = v >= x.cost ? 'good' : 'bad';
          }
          set(`lz-cs-${i}`, x.selling ? tr(`em leilão: ~${x.selling} dias`, `at auction: ~${x.selling} days`) : '');
        });
      },
    },

    poder: {
      key(S) {
        const pol = S.pol;
        return [G.social.tierIdx(S), S.macro.policy, !!pol.poll, Object.keys(pol.backed).join(','), pol.bills.map(b => b.id).join(','),
          Object.keys(pol.passed).join(','), Object.keys(pol.media).join(','), pol.thinkTank ? pol.thinkTank.side : '', Object.keys(pol.entities).join(','),
          pol.office ? pol.office.id : '', ['relacoes_institucionais', 'midia', 'filantropia_estrategica', 'economia_politica'].map(r => +!!S.research[r]).join(''),
          G.nation.isPresident(S), !!S.nation.campaign, G.nation.window(S), G.nation.reelection(S)].join('|');
      },
      build(S) {
        const PL = G.politics, pol = S.pol, P = G.macro.POLICIES, t = G.social.tierIdx(S);
        const opts = (sel) => Object.entries(P).map(([k, p]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${p.n}</option>`).join('');
        let h = `<section class="card summary"><span>${tr('Influência', 'Influence')} <b id="p-inf"></b></span><span>${tr('Imagem pública', 'Public image')} <b id="p-img"></b></span>
          <span>${tr('Governo', 'Government')} <b>${P[S.macro.policy].n}</b>${pol.access ? ` <small class="good">(${tr('você tem acesso', 'you have access')})</small>` : ''}</span>
          <span>${tr('Risco de escândalo', 'Scandal risk')} <b id="p-risk"></b></span>
          ${pol.office ? `<span>${tr('Cargo', 'Office')} <b>${PL.office(pol.office.id).n}</b> <small id="p-office"></small></span>` : ''}</section>`;

        // Eleições
        h += tr(`<section class="card"><h3>Eleições <small>próxima: out/${G.cal.nextElection(S.day)}</small></h3>
          <p class="muted">Doações aumentam a chance de uma plataforma vencer. Quem apoia o vencedor ganha influência e acesso ao governo;
          quem apoia perdedores fica malvisto. A doação oficial tem limite (10% da sua renda anual); acima disso, só por caixa 2,
          que alimenta o risco de escândalo.</p><table class="tbl">
          <tr><td><b>Plataforma</b></td><td><b>${pol.poll ? 'Pesquisa' : 'Chance estimada'}</b></td><td><b>Suas doações</b></td></tr>`,
          `<section class="card"><h3>Elections <small>next: Oct/${G.cal.nextElection(S.day)}</small></h3>
          <p class="muted">Donations raise a platform's chance of winning. Backing the winner earns influence and access to the government;
          backing losers makes you unpopular. Official donations are capped (10% of your annual income); beyond that, only off the books,
          which feeds the scandal risk.</p><table class="tbl">
          <tr><td><b>Platform</b></td><td><b>${pol.poll ? 'Poll' : 'Estimated chance'}</b></td><td><b>Your donations</b></td></tr>`);
        for (const [k, p] of Object.entries(P)) {
          h += `<tr><td><b>${p.n}</b><br><small class="muted">${p.d}</small></td><td id="p-w-${k}"></td><td id="p-d-${k}"></td></tr>`;
        }
        h += tr(`</table><p>Doar <input id="p-don-in" inputmode="decimal" placeholder="valor em R$"> para <select id="p-don-side">${opts('moderado')}</select>
          <button data-act="pol-donate" data-id="legal">Doação oficial</button> <button data-act="pol-donate" data-id="dirty">Caixa 2</button>
          <span class="muted">limite oficial restante: <span id="p-limit"></span></span></p></section>`,
          `</table><p>Donate <input id="p-don-in" inputmode="decimal" placeholder="amount in R$"> to <select id="p-don-side">${opts('moderado')}</select>
          <button data-act="pol-donate" data-id="legal">Official donation</button> <button data-act="pol-donate" data-id="dirty">Off the books</button>
          <span class="muted">official limit remaining: <span id="p-limit"></span></span></p></section>`);

        // Lobby
        if (S.research.relacoes_institucionais) {
          h += tr(`<section class="card"><h3>Lobby</h3><p class="muted">Gaste influência para empurrar projetos de lei. A tramitação leva meses; imagem ruim atrapalha
            e vazamentos acontecem. Um governo redistributivo revoga as isenções.</p><table class="tbl">`,
            `<section class="card"><h3>Lobbying</h3><p class="muted">Spend influence to push bills through. Passage takes months; a bad image gets in the way
            and leaks happen. A redistributive government repeals the exemptions.</p><table class="tbl">`);
          for (const b of PL.BILLS) {
            const run = pol.bills.find(x => x.id === b.id), done = pol.passed[b.id];
            h += `<tr><td><b>${b.n}</b><br><small class="muted">${b.d}</small></td><td>`;
            if (done) h += `<span class="good">${tr('aprovado', 'passed')}${done.sector ? ` (${G.ASSETS[done.sector].short})` : ''}</span>`;
            else if (run) h += `<span class="muted">${tr(`em tramitação: ${run.left} meses`, `in progress: ${run.left} months`)}</span>`;
            else {
              h += b.sector ? `<select id="p-sec">${G.events.SECTORS.map(id => `<option value="${id}">${G.ASSETS[id].short}</option>`).join('')}</select> ` : '';
              h += `<button data-act="lobby" data-id="${b.id}" id="b-lb-${b.id}">${tr('Fazer lobby', 'Lobby')} <small id="p-lc-${b.id}"></small></button>`;
            }
            h += '</td></tr>';
          }
          h += '</table></section>';
        }

        // Mídia e think tank
        if (S.research.midia || S.research.filantropia_estrategica) {
          h += `<section class="card"><h3>${tr('Mídia e ideias', 'Media and ideas')}</h3>`;
          if (S.research.midia) {
            h += '<table class="tbl">';
            for (const m of PL.MEDIA) {
              h += `<tr><td><b>${m.n}</b><br><small class="muted">${tr(`+${m.inf} influência e +${m.img} imagem por mês; manutenção de 0,3% do valor ao mês.`,
                `+${m.inf} influence and +${m.img} image per month; upkeep of 0.3% of the value per month.`)}</small></td>
                <td>${pol.media[m.id] ? `<span class="good">${tr('seu', 'yours')}</span>` : `<button data-act="media" data-id="${m.id}" id="b-md-${m.id}">${tr('Comprar', 'Buy')} <small id="p-mc-${m.id}"></small></button>`}</td></tr>`;
            }
            h += '</table>';
          }
          if (S.research.filantropia_estrategica) {
            h += pol.thinkTank
              ? tr(`<p>Seu think tank defende a plataforma <b>${P[pol.thinkTank.side].n}</b> há ${pol.thinkTank.years} ano(s): +2 de influência por mês e mais chance para ela nas eleições.
                 <button data-act="tt-stop">Fechar</button></p>`,
                `<p>Your think tank has championed the <b>${P[pol.thinkTank.side].n}</b> platform for ${pol.thinkTank.years} year(s): +2 influence per month and better odds for it in elections.
                 <button data-act="tt-stop">Close</button></p>`)
              : tr(`<p>Fundar um think tank (R$ 250 mil/mês) para defender <select id="p-tt-side">${opts('austero')}</select> <button data-act="tt-start">Fundar</button></p>`,
                `<p>Found a think tank (R$ 250k/month) to champion <select id="p-tt-side">${opts('austero')}</select> <button data-act="tt-start">Found</button></p>`);
          }
          h += '</section>';
        }

        // Entidades e cargos
        h += `<section class="card"><h3>${tr('Entidades e cargos', 'Associations and offices')}</h3><table class="tbl">`;
        for (const e of PL.ENTITIES) {
          h += `<tr><td><b>${e.n}</b><br><small class="muted">${e.d}</small></td><td>${G.fmt.money(e.fee * S.macro.priceIndex)}/${tr('mês', 'month')}</td><td>${
            pol.entities[e.id] ? `<button data-act="ent-leave" data-id="${e.id}">${tr('Sair', 'Leave')}</button>`
            : t < e.tier ? `<small class="muted">${tr('requer', 'requires')} ${G.social.TIERS[e.tier][1]}</small>` : `<button data-act="ent-join" data-id="${e.id}">${tr('Entrar', 'Join')}</button>`}</td></tr>`;
        }
        for (const o of PL.OFFICES) {
          if (o.req && !S.research[o.req]) continue;
          h += `<tr><td><b>${o.n}</b><br><small class="muted">${o.d} ${tr(`Requer ${o.inf} de influência e posição ${G.social.TIERS[o.tier][1]}.`,
            `Requires ${o.inf} influence and ${G.social.TIERS[o.tier][1]} status.`)}</small></td><td></td><td>`;
          if (pol.office && pol.office.id === o.id) h += `<span class="good">${tr('no cargo', 'in office')}</span>`;
          else if (o.id === 'bc') {
            h += tr(`<select id="p-bc"><option value="dovish">Juros baixos (inflação sobe)</option><option value="neutro">Neutro</option>
              <option value="hawkish">Juros altos (inflação cai)</option></select> <button data-act="office" data-id="bc" id="b-of-bc">Assumir</button>`,
              `<select id="p-bc"><option value="dovish">Low rates (inflation rises)</option><option value="neutro">Neutral</option>
              <option value="hawkish">High rates (inflation falls)</option></select> <button data-act="office" data-id="bc" id="b-of-bc">Take office</button>`);
          } else h += `<button data-act="office" data-id="${o.id}" id="b-of-${o.id}">${tr('Assumir', 'Take office')}</button>`;
          h += '</td></tr>';
        }
        h += '</table></section>';
        return h + presidencySection(S, opts);
      },
      update(S) {
        const PL = G.politics, pol = S.pol;
        set('p-inf', f.num(pol.influence, 0));
        const img = $('p-img');
        img.textContent = f.num(pol.image, 0);
        img.className = pol.image < -20 ? 'bad' : pol.image > 20 ? 'good' : '';
        const r = PL.scandalChance(S);
        set('p-risk', r < 0.005 ? tr('baixo', 'low') : r < 0.03 ? tr('médio', 'medium') : tr('alto', 'high'));
        if (pol.office) set('p-office', `${tr('até', 'until')} ${f.monthYear(pol.office.until)}`);
        const w = pol.poll || PL.weights(S);
        for (const k in G.macro.POLICIES) {
          set(`p-w-${k}`, f.pct(w[k], 0));
          const b = pol.backed[k];
          set(`p-d-${k}`, b ? f.money(b.legal) + (b.dirty ? ` + ${f.money(b.dirty)} ${tr('por fora', 'off the books')}` : '') : '');
        }
        set('p-limit', f.money(PL.legalLimit(S)));
        for (const b of PL.BILLS) {
          set(`p-lc-${b.id}`, `${f.num(PL.lobbyCost(S, b), 0)} ${tr('influência', 'influence')}`);
          dis(`b-lb-${b.id}`, pol.influence < PL.lobbyCost(S, b));
          why(`b-lb-${b.id}`, pol.influence < PL.lobbyCost(S, b) ? tr(`faltam ${f.num(PL.lobbyCost(S, b) - pol.influence, 0)} de influência`,
            `${f.num(PL.lobbyCost(S, b) - pol.influence, 0)} influence short`) : '');
        }
        for (const m of PL.MEDIA) {
          set(`p-mc-${m.id}`, f.money(m.cost * S.macro.priceIndex));
          dis(`b-md-${m.id}`, S.cash < m.cost * S.macro.priceIndex);
          why(`b-md-${m.id}`, need(S, { cash: m.cost * S.macro.priceIndex }));
        }
        for (const o of PL.OFFICES) {
          dis(`b-of-${o.id}`, !PL.canTakeOffice(S, o));
          why(`b-of-${o.id}`, PL.canTakeOffice(S, o) ? '' : pol.office ? tr('você já ocupa um cargo', 'you already hold an office')
            : pol.influence < o.inf ? tr(`faltam ${f.num(o.inf - pol.influence, 0)} de influência`, `${f.num(o.inf - pol.influence, 0)} influence short`)
            : G.social.tierIdx(S) < o.tier ? tr(`requer posição ${G.social.TIERS[o.tier][1]}`, `requires ${G.social.TIERS[o.tier][1]} status`)
            : o.access && !pol.access ? tr('precisa ter apoiado o governo eleito', 'you must have backed the elected government') : '');
        }
        updatePresidency(S);
      },
    },

    legado: {
      key(S) {
        const L = S.legacy;
        return [L.generation, Object.keys(L.ach).length, JSON.stringify(L.up), S.social.family.kids > 0, G.legacy.age(S) >= G.legacy.HEIR_AGE,
          G.legacy.elders(S).length, L.history.map(g => g.died || '').join()].join('|');
      },
      build(S) {
        const LG = G.legacy, L = S.legacy;
        let h = tr(`<section class="card summary"><span>Geração <b>${L.generation}</b></span><span>Idade <b id="l-age"></b></span>
          <span>Saúde <b id="l-health"></b></span><span>Pontos de legado <b id="l-lp"></b></span></section>
          <section class="card"><h3>Sucessão</h3>
          <p>Se passasse o bastão hoje: <b id="l-gain"></b> pontos de legado
          <span class="muted">(raiz do patrimônio real + prestígio + bem-estar da vida; sem filhos, a fortuna vai para uma fundação e metade se perde)</span>.</p>
          <p>Bem-estar médio desta vida: <b id="l-well"></b> <span class="muted">(acima de 40, cada ponto rende legado; hoje vale <span id="l-wellpts"></span> pontos)</span></p>
          <p>Se você morrer, seu herdeiro recebe <b id="l-heir"></b> de uma vez <span class="muted">(${G.fmt.pct(LG.heirShare(S), 0)} do patrimônio, menos 8% de ITCMD)</span>.
          Se você se aposentar, ele recebe <b id="l-gift"></b> agora, como doação em vida, e <b id="l-kept"></b> ficam com você: rendem, pagam seu custo de vida
          e o que sobrar vira herança quando você morrer. Nos dois casos, o herdeiro escolhido na aba Dinastia assume com a idade e as habilidades que tem, no mesmo mundo e no mesmo ano.</p>`,
          `<section class="card summary"><span>Generation <b>${L.generation}</b></span><span>Age <b id="l-age"></b></span>
          <span>Health <b id="l-health"></b></span><span>Legacy points <b id="l-lp"></b></span></section>
          <section class="card"><h3>Succession</h3>
          <p>If you passed the torch today: <b id="l-gain"></b> legacy points
          <span class="muted">(square root of real net worth + prestige + lifetime well-being; without children, the fortune goes to a foundation and half is lost)</span>.</p>
          <p>Average well-being this life: <b id="l-well"></b> <span class="muted">(above 40, each point earns legacy; currently worth <span id="l-wellpts"></span> points)</span></p>
          <p>If you die, your heir receives <b id="l-heir"></b> all at once <span class="muted">(${G.fmt.pct(LG.heirShare(S), 0)} of net worth, minus 8% inheritance tax)</span>.
          If you retire, they receive <b id="l-gift"></b> now, as a lifetime gift, and <b id="l-kept"></b> stay with you: it earns returns, pays your cost of living
          and whatever is left becomes an inheritance when you die. Either way, the heir chosen in the Dynasty tab takes over at their age and with their skills, in the same world and the same year.</p>`);
        const elders = LG.elders(S);
        if (elders.length) {
          h += `<p>${tr('Gerações anteriores vivas', 'Living previous generations')}:</p><ul>` + elders.map((e, i) =>
            `<li>${e.name ? `${esc(e.name)}, ` : ''}${tr(`${e.gen}ª geração, aposentada`, `generation ${e.gen}, retired`)}: <span id="l-el-${i}"></span></li>`).join('') + '</ul>';
        }
        if (S.social.family.kids === 0) h += tr('<p class="bad">Você ainda não tem filhos (aba Vida → Família).</p>', '<p class="bad">You have no children yet (Life tab → Family).</p>');
        h += LG.age(S) >= LG.HEIR_AGE
          ? `<button data-act="succeed">${tr('Aposentar e passar o bastão', 'Retire and pass the torch')}</button>`
          : `<p class="muted">${tr(`Dá para passar o bastão a partir dos ${LG.HEIR_AGE} anos. Se a saúde acabar antes, a sucessão acontece sozinha.`,
            `You can pass the torch from age ${LG.HEIR_AGE}. If your health runs out first, succession happens on its own.`)}</p>`;
        h += `</section><section class="card"><h3>${tr('Melhorias permanentes', 'Permanent upgrades')}</h3><table class="tbl">`;
        for (const u of LG.UPGRADES) {
          const lvl = LG.level(S, u.id), cost = LG.upgradeCost(S, u);
          h += `<tr><td><b>${u.n}</b> <small>${tr('nível', 'level')} ${lvl}/${u.costs.length}</small><br><small class="muted">${u.d(lvl)}</small></td>
            <td>${cost === undefined ? `<span class="good">${tr('máximo', 'maxed')}</span>` : `<button data-act="legacy-up" data-id="${u.id}" id="b-lu-${u.id}">${tr('Comprar', 'Buy')} <small>${cost} ${tr('pontos', 'points')}</small></button>`}</td></tr>`;
        }
        h += tr(`</table></section><section class="card"><h3>Estatísticas desta vida</h3><table class="tbl stats">
          <tr><td>Anos vividos no jogo</td><td id="st-years"></td><td>Maior patrimônio</td><td id="st-peak"></td></tr>
          <tr><td>Salários e horas extras</td><td id="st-work"></td><td>Dividendos</td><td id="st-div"></td></tr>
          <tr><td>Aluguéis de imóveis</td><td id="st-rent"></td><td>Lucro das empresas</td><td id="st-biz"></td></tr>
          <tr><td>Lucro da gestora</td><td id="st-fund"></td><td>Retorno de startups</td><td id="st-angel"></td></tr>
          <tr><td>IR pago</td><td id="st-tax"></td><td>Doado</td><td id="st-don"></td></tr></table>
          <p class="muted">Valores nominais somados ao longo da vida. <button class="link" data-act="hints-on">Religar dicas do tutorial</button></p>
          <p><label class="check"><input type="checkbox" data-act="retro-toggle" id="l-retro"> Mostrar a retrospectiva de cada ano (em janeiro)</label></p>
          <p><label class="check"><input type="checkbox" data-act="badges-toggle" id="l-badges"> Marcar com • as abas que têm algo a fazer</label></p></section>
          <section class="card"><h3>Conquistas <small>${Object.keys(L.ach).length}/${LG.ACHIEVEMENTS.length} · +3 pontos cada</small></h3><table class="tbl">`,
          `</table></section><section class="card"><h3>Stats for this life</h3><table class="tbl stats">
          <tr><td>Years lived in the game</td><td id="st-years"></td><td>Peak net worth</td><td id="st-peak"></td></tr>
          <tr><td>Salaries and overtime</td><td id="st-work"></td><td>Dividends</td><td id="st-div"></td></tr>
          <tr><td>Property rents</td><td id="st-rent"></td><td>Business profit</td><td id="st-biz"></td></tr>
          <tr><td>Asset manager profit</td><td id="st-fund"></td><td>Startup returns</td><td id="st-angel"></td></tr>
          <tr><td>Income tax paid</td><td id="st-tax"></td><td>Donated</td><td id="st-don"></td></tr></table>
          <p class="muted">Nominal amounts summed over the lifetime. <button class="link" data-act="hints-on">Turn tutorial tips back on</button></p>
          <p><label class="check"><input type="checkbox" data-act="retro-toggle" id="l-retro"> Show each year's review (in January)</label></p>
          <p><label class="check"><input type="checkbox" data-act="badges-toggle" id="l-badges"> Mark tabs that have something to do with •</label></p></section>
          <section class="card"><h3>Achievements <small>${Object.keys(L.ach).length}/${LG.ACHIEVEMENTS.length} · +3 points each</small></h3><table class="tbl">`);
        for (const a of LG.ACHIEVEMENTS) {
          const got = L.ach[a.id] !== undefined;
          h += `<tr><td>${got ? `<b class="good">✓ ${a.n}</b>` : `<span class="muted">${a.n}</span>`}</td><td class="muted">${a.d}</td></tr>`;
        }
        h += '</table></section>';
        if (L.history.length) {
          h += tr('<section class="card"><h3>Gerações</h3><table class="tbl"><tr><td><b>Geração</b></td><td><b>Anos</b></td><td><b>Patrimônio final (R$ de 2026)</b></td><td><b>Pontos</b></td></tr>',
            '<section class="card"><h3>Generations</h3><table class="tbl"><tr><td><b>Generation</b></td><td><b>Years</b></td><td><b>Final net worth (2026 R$)</b></td><td><b>Points</b></td></tr>');
          for (const g of L.history) {
            const fate = g.reason === 'morte' ? tr(`morreu aos ${g.age}`, `died at ${g.age}`)
              : tr(`aposentou aos ${g.age}`, `retired at ${g.age}`) + (g.died ? tr(`, morreu aos ${g.died}`, `, died at ${g.died}`) : '');
            h += `<tr><td>${tr(`${g.gen}ª`, `#${g.gen}`)}${g.name ? ` · ${esc(g.name)}` : ''}</td><td>${g.from}–${g.to} (${fate})</td><td>${f.money(g.nw)}</td><td>+${g.lp}</td></tr>`;
          }
          h += '</table></section>';
        }
        return h;
      },
      update(S) {
        const LG = G.legacy;
        set('l-age', `${Math.floor(LG.age(S))} ${tr('anos', 'years')}`);
        set('l-health', LG.health(S));
        set('l-lp', f.num(S.legacy.lp));
        set('l-gain', f.num(LG.points(S)));
        set('l-well', S.life.wellN ? f.num(G.life.avgWell(S), 0) : '—');
        set('l-wellpts', f.num(G.life.wellPoints(S)));
        $('l-retro').checked = S.settings.retro !== false;
        $('l-badges').checked = S.settings.badges !== false;
        const st = S.stats;
        set('st-years', f.num((S.day - S.birthDay) / 360, 1));
        set('st-peak', f.money(st.peakNW || 0));
        set('st-work', f.money(st.workIncome || 0));
        set('st-div', f.money(st.dividends || 0));
        set('st-rent', f.money(st.rent || 0));
        set('st-biz', f.money(st.bizIncome || 0));
        set('st-fund', f.money(st.fundIncome || 0));
        set('st-angel', f.money(st.angelOut || 0));
        set('st-tax', f.money(S.tax.paid));
        set('st-don', f.money(S.social.donated));
        set('l-heir', f.money(LG.handover(S, 'morte').now));
        const ret = LG.handover(S, 'aposentadoria');
        set('l-gift', f.money(ret.now));
        set('l-kept', f.money(ret.kept));
        LG.elders(S).forEach((e, i) => set(`l-el-${i}`, tr(`${Math.floor(e.age + (S.day - e.since) / 360)} anos, patrimônio ${f.money(e.estate)}`,
          `age ${Math.floor(e.age + (S.day - e.since) / 360)}, estate ${f.money(e.estate)}`)));
        for (const u of LG.UPGRADES) {
          const cost = LG.upgradeCost(S, u);
          dis(`b-lu-${u.id}`, cost === undefined || S.legacy.lp < cost);
          why(`b-lu-${u.id}`, cost !== undefined && S.legacy.lp < cost ? tr(`faltam ${cost - S.legacy.lp} pontos de legado`, `${cost - S.legacy.lp} legacy points short`) : '');
        }
      },
    },

    negocios: {
      key: S => [!!S.research.empreendedorismo, !!S.research.gestao_pessoas, !!S.research.gestora, !!S.fund,
        G.BUSINESSES.map(b => G.business.count(S, b.id) > 0 ? 1 : 0).join(''), G.social.tierIdx(S)].join('|'),
      build(S) {
        const B = G.business;
        let h = '';
        if (S.research.empreendedorismo) {
          h += tr(`<section class="card summary"><span>Lucro das empresas <b id="bz-profit"></b>/mês</span>
            <span>Valor das empresas <b id="bz-value"></b></span><span>Dívida <b id="bz-debt"></b> · parcelas <b id="bz-pmt"></b>/mês</span>
            <span>Consumo de energia <b id="bz-drain"></b>/dia</span></section>
            <section class="card"><h3>Empresas</h3>
            <p class="muted">Cada unidade sem gerente consome energia todo dia; sem energia, o negócio fica largado e lucra menos.
            Lucro paga 15% de imposto. Vender uma unidade rende 90% do preço de uma nova hoje: 75% no fundo da recessão, até 115% no pico.
            <b>Financiar</b>: 30% de entrada e 70% em 10 anos a <span id="bz-rate"></span> (pós-fixado: a parcela sobe com a Selic).
            <span id="bz-bndes"></span></p><table class="tbl">`,
            `<section class="card summary"><span>Business profit <b id="bz-profit"></b>/month</span>
            <span>Business value <b id="bz-value"></b></span><span>Debt <b id="bz-debt"></b> · payments <b id="bz-pmt"></b>/month</span>
            <span>Energy drain <b id="bz-drain"></b>/day</span></section>
            <section class="card"><h3>Businesses</h3>
            <p class="muted">Each unit without a manager drains energy every day; without energy, the business is neglected and earns less.
            Profit pays 15% tax. Selling a unit yields 90% of the price of a new one today: 75% at the bottom of a recession, up to 115% at the peak.
            <b>Finance</b>: 30% down and 70% over 10 years at <span id="bz-rate"></span> (floating: the payment rises with the Selic).
            <span id="bz-bndes"></span></p><table class="tbl">`);
          for (const b of G.BUSINESSES) {
            if ((b.tier || 0) > G.social.tierIdx(S) + 1) continue;
            h += `<tr><td><b>${b.n}</b>${b.tier ? ` <small class="muted">${tr('requer', 'requires')} ${G.social.TIERS[b.tier][1]}</small>` : ''}<br><small class="muted">${tr(`energia ${b.energy}/dia sem gerente`, `${b.energy} energy/day without a manager`)}${b.beta >= 1 ? tr(' · sofre na recessão', ' · suffers in recessions') : b.beta <= 0.5 ? tr(' · defensivo', ' · defensive') : ''}</small></td>
              <td>${tr('unidades', 'units')} <b id="bz-n-${b.id}"></b><br><small class="muted" id="bz-m-${b.id}"></small></td>
              <td><span id="bz-u-${b.id}"></span>${tr('/mês cada', '/month each')}</td>
              <td class="ops"><button data-act="biz-open" data-id="${b.id}" id="b-bo-${b.id}">${tr('Abrir', 'Open')} <small id="bz-p-${b.id}"></small></button>
              <button data-act="biz-fin" data-id="${b.id}" id="b-bf-${b.id}">${tr('Financiar', 'Finance')} <small id="bz-f-${b.id}"></small></button>
              ${S.research.gestao_pessoas ? `<button data-act="biz-hire" data-id="${b.id}" id="b-bh-${b.id}">${tr('Contratar gerente', 'Hire a manager')}</button>` : ''}
              <button data-act="biz-sell" data-id="${b.id}" id="b-bs-${b.id}">${tr('Vender uma', 'Sell one')} <small id="bz-s-${b.id}"></small></button></td></tr>`;
          }
          h += '</table></section>';
        }
        if (S.research.gestora) {
          h += `<section class="card"><h3>${tr('Gestora', 'Asset manager')}</h3>`;
          if (!S.fund) {
            h += tr(`<p class="muted">O fundo replica sua estratégia automática (ou sua carteira atual, se não houver alvos).
              Amigos, família e ex-colegas trazem o capital inicial conforme sua reputação.</p>
              <button data-act="fund-open" id="b-fd-open">Abrir a gestora</button> <small class="muted" id="fd-block"></small>`,
              `<p class="muted">The fund replicates your automatic strategy (or your current portfolio, if there are no targets).
              Friends, family and former colleagues bring the seed capital according to your reputation.</p>
              <button data-act="fund-open" id="b-fd-open">Open the asset manager</button> <small class="muted" id="fd-block"></small>`);
          } else {
            h += tr(`<p>Patrimônio sob gestão: <b id="fd-aum"></b> · cota em 12 meses <b id="fd-r12"></b> vs CDI <b id="fd-cdi"></b></p>
              <p>Lucro da gestora no mês: <b id="fd-profit"></b> · captação líquida: <b id="fd-flow"></b></p>
              <p class="muted">2% ao ano de administração + 20% do que passar do CDI. Bater o CDI traz dinheiro novo; perder dele por 12 meses traz resgates.</p>
              <p>Valor da gestora: <b id="fd-value"></b> <span class="muted">(~3% do patrimônio sob gestão; preço cheio com 2 anos de histórico)</span></p>
              <button data-act="fund-sell">Vender a gestora <small id="fd-sale"></small></button>`,
              `<p>Assets under management: <b id="fd-aum"></b> · fund return over 12 months <b id="fd-r12"></b> vs CDI <b id="fd-cdi"></b></p>
              <p>Asset manager profit this month: <b id="fd-profit"></b> · net inflows: <b id="fd-flow"></b></p>
              <p class="muted">2% annual management fee + 20% of returns above CDI. Beating CDI brings in new money; trailing it for 12 months brings redemptions.</p>
              <p>Asset manager value: <b id="fd-value"></b> <span class="muted">(~3% of assets under management; full price with a 2-year track record)</span></p>
              <button data-act="fund-sell">Sell the asset manager <small id="fd-sale"></small></button>`);
          }
          h += '</section>';
        }
        return h;
      },
      update(S) {
        const B = G.business;
        if (S.research.empreendedorismo) {
          set('bz-profit', f.money(B.monthlyProfit(S)));
          set('bz-value', f.money(B.value(S)));
          set('bz-debt', f.money(B.debt(S)));
          set('bz-pmt', f.money(B.monthlyPayments(S)));
          set('bz-rate', tr(`Selic + ${f.pct(B.spread(S), 0)} (hoje ${f.pct(B.loanRate(S), 1)} a.a.)`, `Selic + ${f.pct(B.spread(S), 0)} (currently ${f.pct(B.loanRate(S), 1)} p.a.)`));
          set('bz-bndes', B.bndes(S) ? tr('Você tem acesso à linha do BNDES.', 'You have access to the BNDES development bank credit line.')
            : tr(`Com ${B.BNDES_INFLUENCE} de influência (aba Poder), o BNDES empresta a Selic + 2%.`,
              `With ${B.BNDES_INFLUENCE} influence (Power tab), the BNDES development bank lends at Selic + 2%.`));
          const d = B.drain(S);
          const dr = $('bz-drain');
          dr.textContent = f.num(d);
          dr.className = d > G.work.LIFESTYLE[S.lifestyle].regen ? 'bad' : '';
          for (const b of G.BUSINESSES) {
            const n = B.count(S, b.id), m = B.managers(S, b.id), p = B.price(S, b);
            set(`bz-n-${b.id}`, String(n));
            set(`bz-m-${b.id}`, n ? tr(`${m} com gerente`, `${m} with a manager`) : '');
            set(`bz-u-${b.id}`, f.money(B.unitProfit(S, b)));
            set(`bz-p-${b.id}`, f.money(p));
            dis(`b-bo-${b.id}`, S.cash < p || !B.allowed(S, b));
            const tierMsg = (b.tier || 0) > G.social.tierIdx(S) ? tr(`requer posição ${G.social.TIERS[b.tier][1]}`, `requires ${G.social.TIERS[b.tier][1]} status`)
              : !B.allowed(S, b) ? tr('só existe uma', 'there is only one') : '';
            why(`b-bo-${b.id}`, tierMsg || need(S, { cash: p }));
            const q = B.quote(S, b);
            set(`bz-f-${b.id}`, tr(`entrada ${f.money(q.down)} · ${f.money(q.pmt)}/mês`, `${f.money(q.down)} down · ${f.money(q.pmt)}/month`));
            dis(`b-bf-${b.id}`, S.cash < q.down || !B.allowed(S, b));
            why(`b-bf-${b.id}`, tierMsg || need(S, { cash: q.down }));
            dis(`b-bh-${b.id}`, m >= n);
            dis(`b-bs-${b.id}`, !n);
            set(`bz-s-${b.id}`, n ? f.money(B.saleValue(S, b)) : '');
          }
        }
        if (S.fund) {
          const F = G.fund;
          set('fd-aum', f.money(S.fund.aum));
          const r = $('fd-r12'), r12 = F.ret12(S), c12 = F.cdi12(S);
          r.textContent = f.signedPct(r12, 1);
          r.className = r12 >= c12 ? 'good' : 'bad';
          set('fd-cdi', f.pct(c12, 1));
          set('fd-profit', f.money(S.fund.lastProfit));
          set('fd-flow', f.money(S.fund.lastFlow));
          set('fd-value', f.money(F.value(S)));
          set('fd-sale', f.money(F.saleValue(S)));
        } else if (S.research.gestora) {
          const blocked = (S.fundBlockedUntil || 0) > S.day;
          dis('b-fd-open', blocked);
          set('fd-block', blocked ? tr(`não concorrência até ${f.monthYear(S.fundBlockedUntil)}`, `non-compete until ${f.monthYear(S.fundBlockedUntil)}`) : '');
        }
      },
    },

    terras: {
      key: S => [S.agro.lands.map(h => h.id + h.crop + (h.mgr ? 'g' : '') + (h.insured ? 's' : '') + (h.selling ? 'v' : '')).join(','),
        !!S.research.gestao_pessoas].join('|'),
      build(S) {
        const A = G.agro;
        let h = tr(`<section class="card summary"><span>Preço da terra <b id="t-idx"></b> em 12 meses</span>
          <span>Suas terras <b id="t-eq"></b></span><span>Renda do agro até agora <b id="t-inc"></b></span>
          <span>Clima do ano <b id="t-clim"></b></span><span>Commodities <b id="t-cf"></b> da média do ano</span></section>
          <section class="card"><h3>Comprar terra</h3>
          <p class="muted">Terra se valoriza com a inflação e um pouco mais. Na compra, 3% de ITBI; vender leva de 2 a 8 meses e paga 6% de corretagem.`,
          `<section class="card summary"><span>Land price <b id="t-idx"></b> over 12 months</span>
          <span>Your land <b id="t-eq"></b></span><span>Farm income so far <b id="t-inc"></b></span>
          <span>This year's weather <b id="t-clim"></b></span><span>Commodities at <b id="t-cf"></b> of the yearly average</span></section>
          <section class="card"><h3>Buy land</h3>
          <p class="muted">Land appreciates with inflation and a bit more. On purchase, 3% transfer tax (ITBI); selling takes 2 to 8 months and pays a 6% broker fee.`) + `
          ${Object.entries(A.CROPS).map(([, c]) => `<b>${c.n}</b>: ${c.d}`).join(' ')}</p><table class="tbl">`;
        for (const l of A.LANDS) {
          h += `<tr><td><b>${l.n}</b><br><small class="muted">${tr('usos', 'uses')}: ${l.crops.map(c => A.CROPS[c].n.toLowerCase()).join(', ')}</small></td>
            <td id="t-p-${l.id}"></td><td><button data-act="agro-buy" data-id="${l.id}" id="b-ab-${l.id}">${tr('Comprar', 'Buy')} <small id="t-c-${l.id}"></small></button></td></tr>`;
        }
        h += '</table></section>';
        if (S.agro.lands.length) {
          h += `<section class="card"><h3>${tr('Suas terras', 'Your land')}</h3><table class="tbl">`;
          S.agro.lands.forEach((x, i) => {
            const l = A.land(x.id), farm = x.crop === 'soja' || x.crop === 'cafe';
            h += `<tr><td><b>${l.n}</b><br><small class="muted" id="t-s-${i}"></small></td>
              <td><b id="t-v-${i}"></b><br><small id="t-pl-${i}"></small></td>
              <td>${x.selling ? `<small class="muted">${tr('à venda', 'for sale')}</small>` : `<select data-set="crop" data-i="${i}">${l.crops.map(c =>
                `<option value="${c}"${c === x.crop ? ' selected' : ''}>${A.CROPS[c].n}</option>`).join('')}</select>
                ${farm ? `<label class="check"><input type="checkbox" data-act="agro-ins" data-i="${i}"${x.insured ? ' checked' : ''}> ${tr('seguro rural', 'crop insurance')}</label>` : ''}
                ${A.operated(x) ? (x.mgr ? `<br><small class="muted">${tr('com gerente agrícola', 'with a farm manager')}</small>`
                  : S.research.gestao_pessoas ? `<br><button data-act="agro-hire" data-i="${i}">${tr('Contratar gerente <small>12% do lucro</small>', 'Hire a manager <small>12% of profit</small>')}</button>`
                  : `<br><small class="muted">${tr(`consome ${l.energy} de energia/dia`, `drains ${l.energy} energy/day`)}</small>`) : ''}`}</td>
              <td>${x.selling ? '' : `<button data-act="agro-sell" data-i="${i}">${tr('Vender', 'Sell')}</button>`}</td></tr>`;
          });
          h += '</table></section>';
        }
        return h;
      },
      update(S) {
        const A = G.agro, hi = S.market.hist.terra, r12 = hi[hi.length - 1] / hi[Math.max(0, hi.length - 361)] - 1;
        const idx = $('t-idx');
        idx.textContent = f.signedPct(r12, 1);
        idx.className = r12 >= 0 ? 'good' : 'bad';
        set('t-eq', f.money(A.equity(S)));
        set('t-inc', f.money(S.agro.income));
        set('t-clim', A.CLIMATES[S.agro.climate].n);
        set('t-cf', f.pct(A.commodityFactor(S), 0));
        for (const l of A.LANDS) {
          const p = A.price(S, l);
          set(`t-p-${l.id}`, f.money(p));
          set(`t-c-${l.id}`, f.money(p * 1.03));
          dis(`b-ab-${l.id}`, S.cash < p * 1.03);
          why(`b-ab-${l.id}`, need(S, { cash: p * 1.03 }));
        }
        S.agro.lands.forEach((x, i) => {
          const v = A.value(S, x);
          set(`t-v-${i}`, f.money(v));
          const pl = $(`t-pl-${i}`);
          if (pl) {
            pl.textContent = `${f.signedPct(v / x.cost - 1, 1)} ${tr('desde a compra', 'since purchase')}`;
            pl.className = v >= x.cost ? 'good' : 'bad';
          }
          const crop = A.PLANTED[x.planted && x.planted.crop] || (x.planted && x.planted.crop);
          const planted = x.planted ? tr(`${crop} plantado, colheita em ${f.MESES[x.planted.harvest - 1]}`, `${crop} planted, harvest in ${f.MESES[x.planted.harvest - 1]}`) : '';
          set(`t-s-${i}`, x.selling ? tr(`à venda: ~${x.selling} dias`, `for sale: ~${x.selling} days`) : [planted, G.i18n.show(x.last, x.last2, x.lastL)].filter(Boolean).join(' · ') || A.CROPS[x.crop].n.toLowerCase());
        });
      },
    },

    imoveis: {
      key: S => [S.realty.length, S.realty.map(h => (h.selling ? 's' : '-') + (h.loan ? 'l' : '-') + (h.home ? 'h' : '-') + (h.occupied ? 'o' : '-')).join(''), !!S.research.financiamento].join('|'),
      build(S) {
        const R = G.realty, fin = S.research.financiamento;
        let h = tr(`<section class="card summary"><span>Índice imobiliário <b id="re-idx"></b> em 12 meses</span>
          <span>Patrimônio em imóveis <b id="re-eq"></b></span><span>Aluguel líquido <b id="re-rent"></b>/mês</span>
          ${fin ? '<span>Financiamento hoje <b id="re-rate"></b> a.a.</span>' : ''}</section>
          <section class="card"><h3>Comprar</h3>
          <p class="muted">Na compra: 3% de ITBI e cartório. Na venda: 6% de corretagem, 15% de IR sobre o lucro e meses até aparecer comprador.
          O aluguel paga 8% à imobiliária e 15% de IR; imóvel vago custa condomínio e IPTU.</p><table class="tbl">`,
          `<section class="card summary"><span>Real estate index <b id="re-idx"></b> over 12 months</span>
          <span>Real estate equity <b id="re-eq"></b></span><span>Net rent <b id="re-rent"></b>/month</span>
          ${fin ? '<span>Mortgage rate today <b id="re-rate"></b> p.a.</span>' : ''}</section>
          <section class="card"><h3>Buy</h3>
          <p class="muted">On purchase: 3% transfer tax (ITBI) and notary fees. On sale: 6% realtor fee, 15% income tax on the gain and months until a buyer shows up.
          Rent pays 8% to the property manager and 15% income tax; a vacant property costs building fees and property tax.</p><table class="tbl">`);
        for (const p of G.PROPERTIES) {
          h += `<tr><td>${p.n}<br><small class="muted">${tr('aluguel', 'rent')} ~${f.pct(p.yield, 1)} ${tr('a.a.', 'p.a.')} · ${p.people
            ? tr(`moradia para até ${p.people} pessoas`, `home for up to ${p.people} people`) : tr('comercial', 'commercial')}</small></td><td id="re-p-${p.id}"></td>
            <td class="ops"><button data-act="re-buy" data-id="${p.id}" id="b-re-${p.id}">${tr('À vista', 'Pay cash')} <small id="re-c-${p.id}"></small></button>
            ${fin ? `<button data-act="re-fin" data-id="${p.id}" id="b-rf-${p.id}">${tr('Financiar', 'Finance')} <small id="re-f-${p.id}"></small></button>` : ''}</td></tr>`;
        }
        h += '</table></section>';
        if (S.realty.length) {
          h += `<section class="card"><h3>${tr('Seus imóveis', 'Your properties')}</h3><table class="tbl">`;
          S.realty.forEach((x, i) => {
            h += `<tr><td>${R.prop(x.pid).n}<br><small class="muted" id="rh-s-${i}"></small></td>
              <td><b id="rh-v-${i}"></b><br><small id="rh-pl-${i}"></small></td><td><small id="rh-l-${i}"></small></td>
              <td>${x.selling ? '' : `<button data-act="re-sell" data-i="${i}">${tr('Vender', 'Sell')}</button>`}
                ${x.home ? `<br><small class="good">${tr('você mora aqui', 'you live here')}</small>` : !x.selling && !x.occupied && R.prop(x.pid).people ? `<br><button data-act="home" data-i="${i}" id="b-home-${i}">${tr('Morar aqui', 'Live here')}</button>` : ''}</td></tr>`;
          });
          h += '</table></section>';
        }
        return h;
      },
      update(S) {
        const R = G.realty, hi = S.market.hist.imob;
        const r12 = hi[hi.length - 1] / hi[Math.max(0, hi.length - 361)] - 1;
        const idx = $('re-idx');
        idx.textContent = f.signedPct(r12, 1);
        idx.className = r12 >= 0 ? 'good' : 'bad';
        set('re-eq', f.money(R.equity(S)));
        set('re-rent', f.money(R.monthlyNet(S).rent));
        set('re-rate', f.pct(R.loanRate(S)));
        for (const p of G.PROPERTIES) {
          const cash = R.quote(S, p, false), fin = R.quote(S, p, true);
          set(`re-p-${p.id}`, f.money(R.price(S, p)));
          set(`re-c-${p.id}`, f.money(cash.upfront));
          set(`re-f-${p.id}`, tr(`entrada ${f.money(fin.upfront)} · ${f.money(fin.pmt)}/mês`, `${f.money(fin.upfront)} down · ${f.money(fin.pmt)}/month`));
          dis(`b-re-${p.id}`, S.cash < cash.upfront);
          dis(`b-rf-${p.id}`, S.cash < fin.upfront);
          why(`b-re-${p.id}`, need(S, { cash: cash.upfront }));
          why(`b-rf-${p.id}`, need(S, { cash: fin.upfront }));
        }
        S.realty.forEach((x, i) => {
          const v = R.value(S, x);
          set(`rh-s-${i}`, x.selling ? tr(`à venda: ~${x.selling} dias para fechar`, `for sale: ~${x.selling} days to close`) : x.home ? tr('sua casa', 'your home')
            : x.occupied ? tr(`alugado · ${f.money(R.rent(S, x))}/mês bruto`, `rented · ${f.money(R.rent(S, x))}/month gross`) : tr('vago, procurando inquilino', 'vacant, looking for a tenant'));
          const problem = G.life.homeProblem(S, x);
          dis(`b-home-${i}`, !!problem);
          why(`b-home-${i}`, problem ? homeWhy(S, x)
            : tr('para de alugar e corta 40% do custo de vida', 'stop renting and cut 40% of your cost of living'));
          set(`rh-v-${i}`, f.money(v));
          const pl = $(`rh-pl-${i}`);
          if (pl) {
            pl.textContent = `${f.signedPct(v / x.cost - 1, 1)} ${tr('desde a compra', 'since purchase')}`;
            pl.className = v >= x.cost ? 'good' : 'bad';
          }
          set(`rh-l-${i}`, x.loan ? tr(`saldo devedor ${f.money(x.loan.bal)} · parcela ${f.money(x.loan.pmt)} · ${x.loan.left} meses`,
            `balance ${f.money(x.loan.bal)} · payment ${f.money(x.loan.pmt)} · ${x.loan.left} months`) : tr('quitado', 'paid off'));
        });
      },
    },

    dinastia: {
      key: S => {
        const D = G.dynasty, f = S.social.family;
        return [D.surname(S), S.me && S.me.name, f.married, f.spouse, D.children(S).map(c => c.id + (D.age(S, c) >= D.ADULT ? 'a' : '') + c.dream + (c.focus || '')).join(),
          D.heir(S) && D.heir(S).id, f.heir, G.legacy.elders(S).length, D.relatives(S).length, S.legacy.generation].join('|');
      },
      build(S) {
        const D = G.dynasty, f = S.social.family, W = G.work, esc2 = x => esc(x || '');
        const heir = D.heir(S), kids = D.children(S);
        let h = `<section class="card"><h3>${esc(D.familyName(S))}</h3>
          <p>${tr('Sobrenome', 'Surname')} <input data-set="surname" value="${esc2(D.surname(S))}" maxlength="30">
          ${tr('Seu nome', 'Your name')} <input data-set="myname" value="${esc2(S.me && S.me.name)}" maxlength="30"></p>
          <p class="muted">${tr(`Geração ${S.legacy.generation}. Você é o líder da família; os anciãos são as gerações que se aposentaram e ainda vivem. Quando um ancião morre, o patrimônio dele vira herança.
            Cada filho nasce com aptidões (o potencial em cada área) e um sonho de carreira. Escolha o foco da educação (${G.fmt.money(D.FOCUS_COST * S.macro.priceIndex)}/mês por filho):
            as habilidades crescem até a aptidão. Insistir numa área longe do sonho desgasta a relação; com relação boa, o sonho pode mudar.
            Escolha o herdeiro: ele assume com a idade real e o que aprendeu (finanças e negócios dão cargo inicial e conhecimento, política dá influência, ciência dá conhecimento, artes dão prestígio).
            Os outros filhos saem de casa aos ${D.ADULT} anos, seguem carreira e ajudam a família.`,
            `Generation ${S.legacy.generation}. You are the head of the family; the elders are the generations that retired and are still alive. When an elder dies, their estate becomes an inheritance.
            Each child is born with aptitudes (their potential in each area) and a dream career. Choose the focus of their education (${G.fmt.money(D.FOCUS_COST * S.macro.priceIndex)}/month per child):
            skills grow up to the aptitude. Pushing an area far from their dream wears the relationship down; with a good relationship, the dream can change.
            Choose the heir: they take over at their real age with what they learned (finance and business give a starting position and knowledge, politics gives influence, science gives knowledge, arts give prestige).
            The other children move out at ${D.ADULT}, pursue careers and help the family.`)}</p></section>`;

        // Líder, cônjuge e anciãos
        h += `<section class="card"><h3>${tr('Casa', 'Household')}</h3><table class="tbl">
          <tr><td><b>${esc2(S.me && S.me.name)}</b> <small class="muted">${tr('líder', 'head')}</small></td><td id="dy-me"></td></tr>`;
        if (f.married) h += `<tr><td>${esc2(f.spouse)} <small class="muted">${tr('cônjuge', 'spouse')}</small></td><td></td></tr>`;
        G.legacy.elders(S).forEach((e, i) => {
          h += `<tr><td>${esc2(e.name) || tr(`${e.gen}ª geração`, `Generation ${e.gen}`)} <small class="muted">${tr('ancião', 'elder')}${e.spouse ? ` · ${tr('com', 'with')} ${esc(e.spouse)}` : ''}</small></td><td id="dy-el-${i}"></td></tr>`;
        });
        h += '</table></section>';

        // Filhos
        h += `<section class="card"><h3>${tr('Filhos', 'Children')} <small>${kids.length}</small></h3>`;
        if (!kids.length) h += `<p class="muted">${tr('Sem filhos ainda. Casamento e filhos ficam na aba Vida → Família.', 'No children yet. Marriage and children are in the Life tab → Family.')}</p>`;
        const areaOpts = sel => `<option value="">${tr('sem foco', 'no focus')}</option>` + D.AREAS.map(a => `<option value="${a.id}"${a.id === sel ? ' selected' : ''}>${a.n}</option>`).join('');
        for (const c of kids) {
          const adult = D.age(S, c) >= D.ADULT;
          h += `<div class="research"><div><b>${esc(c.name)}</b> <span id="dy-age-${c.id}" class="muted"></span>
            ${heir && heir.id === c.id ? ` <span class="good">${tr('herdeiro', 'heir')}</span>` : ''}
            <p class="muted">${tr('Sonho', 'Dream')}: ${D.area(c.dream).career}${adult ? tr(' (seguindo carreira)', ' (pursuing it)') : ''} · ${tr('relação', 'relationship')} <span id="dy-bond-${c.id}"></span></p>
            <table class="tbl alloc">${D.AREAS.map(a => `<tr><td>${a.n}</td><td id="dy-sk-${c.id}-${a.id}"></td></tr>`).join('')}</table></div>
            <div class="btns" style="display:block">
            ${adult ? '' : `<p>${tr('Foco', 'Focus')} <select data-set="focus" data-id="${c.id}">${areaOpts(c.focus)}</select></p>`}
            <button data-act="kid-time" data-id="${c.id}" id="b-kt-${c.id}">${tr('Passar tempo junto', 'Spend time together')} <small>${D.TIME_ENERGY} ${tr('energia', 'energy')} · ${tr('relação', 'relationship')} +6</small></button>
            ${heir && heir.id === c.id && f.heir === c.id ? '' : `<button data-act="kid-heir" data-id="${c.id}">${tr('Escolher como herdeiro', 'Choose as heir')}</button>`}
            </div></div>`;
        }
        h += '</section>';
        if (heir) h += `<section class="card"><h3>${tr('Se', 'If')} ${esc(heir.name)} ${tr('assumisse hoje', 'took over today')}</h3><p id="dy-heir"></p></section>`;

        // Parentes
        const rel = D.relatives(S);
        if (rel.length) {
          h += `<section class="card"><h3>${tr('Parentes', 'Relatives')}</h3><p class="muted">${tr('Irmãos das gerações que lideraram. Seguem a carreira e ajudam a família todo mês.',
            'Siblings of past heads of the family. They pursue their careers and help the family every month.')}</p><table class="tbl">`;
          rel.forEach((r, i) => {
            h += `<tr><td>${esc(r.name)} <small class="muted">${tr(`${r.gen}ª geração`, `generation ${r.gen}`)}</small></td><td>${D.area(r.dream).career}</td><td id="dy-rel-${i}"></td></tr>`;
          });
          h += '</table></section>';
        }
        return h;
      },
      update(S) {
        const D = G.dynasty, f = G.fmt;
        set('dy-me', tr(`${Math.floor(G.legacy.age(S))} anos · ${G.work.CAREER[S.job.level].t}`, `age ${Math.floor(G.legacy.age(S))} · ${G.work.CAREER[S.job.level].t}`));
        G.legacy.elders(S).forEach((e, i) => set(`dy-el-${i}`, tr(`${Math.floor(e.age + (S.day - e.since) / 360)} anos · patrimônio ${f.money(e.estate)}`,
          `age ${Math.floor(e.age + (S.day - e.since) / 360)} · estate ${f.money(e.estate)}`)));
        for (const c of D.children(S)) {
          const age = D.age(S, c);
          set(`dy-age-${c.id}`, age < 1 ? tr(`${Math.floor(age * 12)} meses`, `${Math.floor(age * 12)} months`) : tr(`${Math.floor(age)} anos`, `age ${Math.floor(age)}`));
          const b = $(`dy-bond-${c.id}`);
          if (b) { b.textContent = f.num(c.bond, 0); b.className = c.bond < 30 ? 'bad' : c.bond >= 70 ? 'good' : ''; }
          for (const a of D.AREAS) {
            set(`dy-sk-${c.id}-${a.id}`, tr(`${f.num(c.skill[a.id], 0)} de ${f.num(c.apt[a.id], 0)}`, `${f.num(c.skill[a.id], 0)} of ${f.num(c.apt[a.id], 0)}`)
              + (a.id === c.dream ? ' ★' : '') + (a.id === c.focus ? tr(' · foco', ' · focus') : ''));
          }
          dis(`b-kt-${c.id}`, !D.canSpendTime(S, c));
          why(`b-kt-${c.id}`, S.day < (c.cd || 0) ? tr(`de novo em ${c.cd - S.day} dias`, `available again in ${c.cd - S.day} days`) : need(S, { energy: D.TIME_ENERGY }));
        }
        const heir = D.heir(S);
        if (heir) {
          const x = D.heirBonus(heir), age = Math.max(18, D.age(S, heir));
          set('dy-heir', tr(`Assumiria com ${Math.floor(age)} anos como ${G.work.CAREER[x.level].t}, +${f.num(x.knowledge, 0)} de conhecimento, +${f.num(x.reputation, 0)} de reputação, +${f.num(x.influence, 0)} de influência e +${f.num(x.prestige, 0)} de prestígio${x.research.length ? `, com ${new Set(x.research).size} pesquisa(s) feitas` : ''}.${heir.bond < 30 ? ' A relação ruim corta 40% disso.' : ''}`,
            `Would take over at age ${Math.floor(age)} as ${G.work.CAREER[x.level].t}, +${f.num(x.knowledge, 0)} knowledge, +${f.num(x.reputation, 0)} reputation, +${f.num(x.influence, 0)} influence and +${f.num(x.prestige, 0)} prestige${x.research.length ? `, with ${new Set(x.research).size} research item(s) done` : ''}.${heir.bond < 30 ? ' The poor relationship cuts 40% of that.' : ''}`));
        }
        D.relatives(S).forEach((r, i) => set(`dy-rel-${i}`, tr(`${Math.floor((S.day - r.born) / 360)} anos · habilidade ${f.num(r.skill, 0)}`, `age ${Math.floor((S.day - r.born) / 360)} · skill ${f.num(r.skill, 0)}`)));
      },
    },

    familias: {
      key: S => [G.social.tierIdx(S), G.families.ranking(S).map(r => r.id).join(), G.politics.hasBigMedia(S),
        G.families.FAMILIES.map(fm => G.families.relation(S, fm.id) + (G.families.st(S, fm.id).dossie ? 'd' : '')).join()].join('|'),
      build(S) {
        const FM = G.families, P = G.macro.POLICIES;
        let h = `<section class="card summary"><span>${tr('Sua posição no ranking', 'Your ranking position')} <b id="fm-rank"></b></span>
          <span>${tr('Aliadas', 'Allies')} <b>${FM.allies(S).length}/${FM.MAX_ALLIES}</b></span><span id="fm-war" class="bad"></span></section>
          <p class="muted">${tr(`As famílias mais ricas do país. Cada uma vive de um setor e é um grupo de poder ligado a uma plataforma política: empurra a sua nas eleições.
          Competir no setor delas, apoiar a plataforma rival ou atacá-las cria rivais, e rivais sabotam (guerra de preços, difamação, lobby contra, roubo de gerentes, denúncias).
          Aliadas abrem portas, ajudam em campanhas e deixam de sabotar. Ações com a mesma família: uma a cada 3 meses.`,
          `The country's richest families. Each lives off a sector and is a power group tied to a political platform, pushing it in elections.
          Competing in their sector, backing the rival platform or attacking them creates rivals, and rivals sabotage you (price wars, smears, lobbying against you, poaching managers, complaints).
          Allies open doors, help in campaigns and stop sabotaging. Actions with the same family: one every 3 months.`)}</p>
          <section class="card"><table class="tbl"><tr><td><b>#</b></td><td><b>${tr('Família', 'Family')}</b></td><td><b>${tr('Patrimônio', 'Net worth')}</b></td>
          <td><b>${tr('Relação', 'Relationship')}</b></td><td></td></tr>`;
        FM.ranking(S).forEach((r, i) => {
          if (r.you) {
            h += `<tr class="cur"><td>${i + 1}</td><td>${tr(`Sua família (${S.legacy.generation}ª geração)`, `Your family (generation ${S.legacy.generation})`)}</td><td id="fm-w-voce"></td><td></td><td></td></tr>`;
            return;
          }
          const fm = FM.byId(r.id), x = FM.st(S, r.id);
          const ld = x.leader;
          h += `<tr><td>${i + 1}</td><td><b>${fm.n}</b><br><small class="muted">${FM.sectorName(fm)} · ${P[fm.side].n} · ${fm.d}${ld ? ` ${tr(`Líder: ${ld.name}, ${Math.floor(ld.age)} anos, gestão ${ld.skill >= 70 ? 'forte' : ld.skill >= 45 ? 'regular' : 'fraca'}.`,
            `Head: ${ld.name}, age ${Math.floor(ld.age)}, ${ld.skill >= 70 ? 'strong' : ld.skill >= 45 ? 'average' : 'weak'} management.`)}` : ''}</small></td>
            <td id="fm-w-${fm.id}"></td><td id="fm-r-${fm.id}"></td><td class="ops">
            <button data-act="fam-approach" data-id="${fm.id}" id="b-fa-${fm.id}">${tr('Aproximar', 'Get closer')} <small id="fm-ac-${fm.id}"></small></button>
            ${x.ally ? `<button data-act="fam-break" data-id="${fm.id}">${tr('Romper aliança', 'Break alliance')}</button>`
              : `<button data-act="fam-ally" data-id="${fm.id}" id="b-fl-${fm.id}">${tr('Propor aliança', 'Propose alliance')} <small>30 ${tr('influência', 'influence')}</small></button>`}
            <button data-act="fam-inv" data-id="${fm.id}" id="b-fi-${fm.id}">${tr('Investigar', 'Investigate')} <small id="fm-ic-${fm.id}"></small></button>
            <button data-act="fam-attack" data-id="${fm.id}" id="b-fk-${fm.id}">${tr('Atacar na mídia', 'Attack in the media')}${x.dossie ? ` <small>${tr('com dossiê', 'with dossier')}</small>` : ''}</button></td></tr>`;
        });
        return h + '</table></section>';
      },
      update(S) {
        const FM = G.families;
        set('fm-rank', tr(`${FM.myRank(S)}º`, `#${FM.myRank(S)}`));
        set('fm-w-voce', f.money(Math.max(0, G.portfolio.netWorth(S))));
        const war = S.fam.priceWar;
        set('fm-war', war && S.day < war.until ? tr(`Guerra de preços da família ${FM.byId(war.by).n}: suas empresas do setor lucram 20% menos até ${f.monthYear(war.until)}.`,
          `Price war by the ${FM.byId(war.by).n} family: your businesses in the sector earn 20% less until ${f.monthYear(war.until)}.`) : '');
        for (const fm of FM.FAMILIES) {
          const x = FM.st(S, fm.id), rel = FM.relation(S, fm.id);
          set(`fm-w-${fm.id}`, f.money(x.w));
          const el = $(`fm-r-${fm.id}`);
          if (el) {
            el.textContent = `${FM.RELATION_NAME[rel]} (${f.num(x.att, 0)})`;
            el.className = rel === 'aliada' || rel === 'amistosa' ? 'good' : rel === 'hostil' || rel === 'rival' ? 'bad' : '';
          }
          const tier = G.social.tierIdx(S) < FM.tierReq(fm) ? tr(`requer posição ${G.social.TIERS[FM.tierReq(fm)][1]}`, `requires ${G.social.TIERS[FM.tierReq(fm)][1]} status`) : '';
          const wait = S.day < x.cd ? tr(`de novo em ${x.cd - S.day} dias`, `available again in ${x.cd - S.day} days`) : '';
          set(`fm-ac-${fm.id}`, f.money(FM.approachCost(S)));
          set(`fm-ic-${fm.id}`, f.money(FM.investigateCost(S)));
          dis(`b-fa-${fm.id}`, !FM.canAct(S, fm) || S.cash < FM.approachCost(S));
          why(`b-fa-${fm.id}`, tier || wait || need(S, { cash: FM.approachCost(S) }));
          dis(`b-fl-${fm.id}`, !FM.canAlly(S, fm));
          why(`b-fl-${fm.id}`, FM.canAlly(S, fm) ? '' : tier || wait || (x.att < 40 ? tr('a relação precisa estar em 40 ou mais', 'the relationship must be 40 or higher')
            : FM.allies(S).length >= FM.MAX_ALLIES ? tr(`no máximo ${FM.MAX_ALLIES} aliadas`, `at most ${FM.MAX_ALLIES} allies`) : tr('precisa de 30 de influência', 'needs 30 influence')));
          dis(`b-fi-${fm.id}`, S.day < x.cd || S.cash < FM.investigateCost(S));
          why(`b-fi-${fm.id}`, wait || need(S, { cash: FM.investigateCost(S) }));
          dis(`b-fk-${fm.id}`, !FM.canAttack(S, fm));
          why(`b-fk-${fm.id}`, FM.canAttack(S, fm) ? '' : wait || (!x.dossie && !G.politics.hasBigMedia(S)
            ? tr('precisa de um dossiê (investigar) ou de um portal ou canal de TV', 'needs a dossier (investigate) or a news website or TV channel') : tr('precisa de 20 de influência', 'needs 20 influence')));
        }
      },
    },

    brasil: {
      key: S => {
        const N = G.nation, n = S.nation;
        return [N.isPresident(S), n.pending ? n.pending.id : '', Object.keys(n.reforms).join(), n.unSeat, !!n.reforms.bc_autonomo,
          N.worldRanking(S).map(r => r.id).join()].join('|');
      },
      build(S) {
        const N = G.nation, n = S.nation, pres = N.isPresident(S), P = G.macro.POLICIES;
        let h = `<section class="card summary"><span>${tr('PIB', 'GDP')} <b id="nx-gdp"></b></span><span>${tr('Crescimento', 'Growth')} <b id="nx-g"></b></span>
          <span>${tr('Dívida pública', 'Public debt')} <b id="nx-debt"></b></span><span>${tr('Aprovação', 'Approval')} <b id="nx-appr"></b></span>
          <span>${tr('Governabilidade', 'Governability')} <b id="nx-gov"></b></span><span>${tr('Poder nacional', 'National power')} <b id="nx-pow"></b></span>
          <span>${tr('Posição no mundo', 'World rank')} <b id="nx-rank"></b></span></section>`;
        if (!pres) {
          h += `<p class="muted">${tr(`Governo atual: plataforma ${P[S.macro.policy].n}, conduzido pela IA. Você só governa se vencer a eleição presidencial (aba Poder).`,
            `Current government: ${P[S.macro.policy].n} platform, run by the AI. You only govern if you win the presidential election (Power tab).`)}</p>`;
        } else {
          h += `<section class="card"><h3>${tr('Orçamento', 'Budget')}</h3>
            <p class="muted">${tr('Divida o gasto do governo entre as áreas (em %; o total é normalizado). Cada índice persegue um alvo que depende da verba; educação e tecnologia respondem devagar.',
              'Split government spending across areas (in %; the total is normalized). Each index chases a target set by its funding; education and technology respond slowly.')}</p>
            <table class="tbl alloc"><tr><td><b>${tr('Área', 'Area')}</b></td><td><b>${tr('Verba', 'Funding')}</b></td><td><b>${tr('Índice', 'Index')}</b></td></tr>`;
          for (const a of N.AREAS) {
            h += `<tr><td>${a.n}</td><td><input class="num" data-nb="${a.id}" value="${n.budget[a.id]}" inputmode="numeric"> %</td><td id="nb-v-${a.id}"></td></tr>`;
          }
          const stances = [[-2, tr('austeridade forte', 'strong austerity')], [-1, tr('austeridade', 'austerity')], [0, tr('neutra', 'neutral')], [1, tr('expansão', 'expansion')], [2, tr('expansão forte', 'strong expansion')]];
          h += `</table><p class="muted" id="nb-sum"></p></section>
            <section class="card"><h3>${tr('Política econômica', 'Economic policy')}</h3>
            <p>${tr('Postura fiscal', 'Fiscal stance')} <select data-set="stance">${stances.map(([v, l]) => `<option value="${v}"${v === n.stance ? ' selected' : ''}>${l}</option>`).join('')}</select>
            <span class="muted">${tr('gastar mais acelera o crescimento e a aprovação agora, mas aumenta déficit, dívida e inflação', 'spending more speeds up growth and approval now, but raises the deficit, debt and inflation')}</span></p>
            <p>${tr('Emendas e cargos para a base', 'Pork and posts for the coalition')} <select data-set="emendas">${[0, 1, 2, 3].map(v => `<option value="${v}"${v === n.emendas ? ' selected' : ''}>${v}</option>`).join('')}</select>
            <span class="muted">${tr('cada nível dá governabilidade, custa 0,2% do PIB por ano, corrói as instituições e suja você', 'each level adds governability, costs 0.2% of GDP a year, erodes institutions and dirties you')}</span></p>
            <p><label class="check"><input type="checkbox" data-act="bc" id="nx-bc"${n.reforms.bc_autonomo ? ' disabled' : ''}> ${tr('Pressionar o Banco Central por juros menores (Selic −1 ponto, inflação sobe)',
              'Pressure the Central Bank for lower rates (Selic −1 point, inflation rises)')}</label></p></section>
            <section class="card"><h3>${tr('Reformas', 'Reforms')}</h3>
            <p class="muted">${tr('Uma por vez. Enviar gasta governabilidade; a aprovação depende da governabilidade e das instituições.',
              'One at a time. Sending one spends governability; passage depends on governability and institutions.')}</p><table class="tbl">`;
          for (const r of N.REFORMS) {
            const st = n.reforms[r.id] ? `<span class="good">${tr('aprovada', 'passed')}</span>`
              : n.pending && n.pending.id === r.id ? `<span class="muted" id="nx-pend"></span>`
              : `<button data-act="reform" data-id="${r.id}" id="b-nr-${r.id}">${tr('Enviar ao Congresso', 'Send to Congress')} <small>${tr('governab.', 'govern.')} ${f.pct(r.gov, 0)}</small></button>`;
            h += `<tr><td><b>${r.n}</b><br><small class="muted">${r.d} ${tr(`Tramitação: ${r.months} meses.`, `Takes ${r.months} months.`)}</small></td><td>${st}</td></tr>`;
          }
          h += `</table></section><section class="card"><h3>${tr('Diplomacia', 'Diplomacy')}</h3><div class="btns">
            <button data-act="summit" id="b-summit">${tr('Viagem de Estado', 'State visit')} <small>${tr('diplomacia +3 · uma a cada 3 meses', 'diplomacy +3 · one every 3 months')}</small></button>
            ${n.unSeat ? `<span class="good">${tr('Assento permanente na ONU conquistado', 'Permanent UN seat secured')}</span>`
              : `<button data-act="unseat" id="b-un">${tr('Assento permanente no Conselho de Segurança da ONU', 'Permanent UN Security Council seat')} <small>${tr('diplomacia 80 e top 6 do mundo', 'diplomacy 80 and world top 6')}</small></button>`}
            </div></section>`;
        }
        h += `<section class="card"><h3>${tr('Índices do país', 'Country indices')}</h3><table class="tbl">`;
        for (const a of N.AREAS.concat(N.EXTRA)) h += `<tr><td>${a.n}</td><td id="nx-i-${a.id}"></td></tr>`;
        h += `</table></section><section class="card"><h3>${tr('Poder mundial', 'World power')}</h3>
          <p class="muted">${tr(`Tamanho e renda da economia, educação, tecnologia, defesa, diplomacia, instituições, infraestrutura e estabilidade. Superpotência: poder ${N.SUPERPOWER} e top 3.`,
            `Economic size and income, education, technology, defense, diplomacy, institutions, infrastructure and stability. Superpower: power ${N.SUPERPOWER} and top 3.`)}</p><table class="tbl">`;
        N.worldRanking(S).forEach((r, i) => {
          h += `<tr class="${r.you ? 'cur' : ''}"><td>${i + 1}</td><td>${r.n}</td><td id="nw-${r.id}"></td></tr>`;
        });
        return h + '</table></section>';
      },
      update(S) {
        const N = G.nation, n = S.nation, pres = N.isPresident(S);
        set('nx-gdp', f.money(n.gdpReal * S.macro.priceIndex));
        const g = $('nx-g');
        if (g) { g.textContent = f.signedPct(n.growth, 1) + tr(' a.a.', ' p.a.'); g.className = n.growth >= 0.02 ? 'good' : n.growth < 0 ? 'bad' : ''; }
        const debt = $('nx-debt');
        if (debt) { debt.textContent = f.pct(n.debt, 0) + tr(' do PIB', ' of GDP'); debt.className = n.debt > 1 ? 'bad' : ''; }
        const ap = $('nx-appr');
        if (ap) { ap.textContent = f.pct(n.approval, 0); ap.className = n.approval < 0.25 ? 'bad' : n.approval > 0.5 ? 'good' : ''; }
        set('nx-gov', f.pct(n.gov, 0));
        set('nx-pow', f.num(N.power(S), 1));
        set('nx-rank', tr(`${N.rank(S)}º`, `#${N.rank(S)}`));
        for (const a of N.AREAS.concat(N.EXTRA)) set(`nx-i-${a.id}`, f.num(n.idx[a.id], 0));
        for (const r of N.worldRanking(S)) set(`nw-${r.id}`, f.num(r.p, 1));
        if (!pres) return;
        const sh = N.shares(S);
        for (const a of N.AREAS) set(`nb-v-${a.id}`, `${f.num(n.idx[a.id], 0)} · ${f.pct(sh[a.id] / 100, 0)}`);
        const total = Object.values(n.budget).reduce((s, v) => s + v, 0);
        set('nb-sum', tr(`Total digitado: ${f.num(total, 0)}%. Déficit primário: ${f.pct(N.primary(S), 1)} do PIB por ano.`,
          `Total entered: ${f.num(total, 0)}%. Primary deficit: ${f.pct(N.primary(S), 1)} of GDP a year.`));
        const bc = $('nx-bc');
        if (bc) bc.checked = !!n.bcPressure;
        if (n.pending) set('nx-pend', tr(`em votação: ${n.pending.left} mês(es)`, `being voted: ${n.pending.left} month(s)`));
        for (const r of N.REFORMS) {
          dis(`b-nr-${r.id}`, !N.canReform(S, r));
          why(`b-nr-${r.id}`, N.canReform(S, r) ? '' : n.pending ? tr('já há uma reforma em votação', 'a reform is already being voted') : tr(`precisa de ${f.pct(r.gov, 0)} de governabilidade`, `needs ${f.pct(r.gov, 0)} governability`));
        }
        dis('b-summit', !N.canDiplomacy(S));
        why('b-summit', N.canDiplomacy(S) ? '' : tr(`de novo em ${n.dipCd - S.day} dias`, `available again in ${n.dipCd - S.day} days`));
        dis('b-un', !N.canUN(S));
        why('b-un', N.canUN(S) ? '' : tr('precisa de diplomacia 80 e estar no top 6 do mundo', 'needs diplomacy 80 and a world top 6 spot'));
      },
    },

    startups: {
      key: S => S.angel.deals.map(d => d.name + d.until).join(',') + '|' + S.angel.tickets.length,
      build(S) {
        const A = S.angel;
        let h = tr(`<section class="card summary"><span>Investido em startups <b id="an-book"></b></span>
          <span>Retornos já recebidos <b id="an-out"></b></span></section>
          <section class="card"><h3>Rodadas abertas</h3>
          <p class="muted">Cheque de anjo leva anos para voltar, quando volta: 6 em cada 10 quebram. A tração é só um palpite;
          com due diligence fica bem mais confiável. Lucro paga 15% de IR.</p>`,
          `<section class="card summary"><span>Invested in startups <b id="an-book"></b></span>
          <span>Returns received so far <b id="an-out"></b></span></section>
          <section class="card"><h3>Open rounds</h3>
          <p class="muted">An angel check takes years to come back, if it does: 6 in 10 fail. Traction is just a hint;
          with due diligence it becomes much more reliable. Gains pay 15% income tax.</p>`);
        if (!A.deals.length) h += tr('<p class="muted">Novas rodadas aparecem todo mês.</p>', '<p class="muted">New rounds show up every month.</p>');
        A.deals.forEach((d, i) => {
          const cls = d.signal === 'forte' ? 'good' : d.signal === 'fraca' ? 'bad' : '';
          h += `<div class="research"><div><b>${d.name}</b> <span class="muted">— ${G.i18n.show(d.pitch, d.pitch2, d.pitchL)}</span>
            <p>${tr('Tração', 'Traction')} <b class="${cls}">${G.angel.SIGNAL_NAMES[d.signal] || d.signal}</b> · ${tr('cheque de', 'check of')} ${f.money(d.ticket)} · <span class="muted" id="an-d-${i}"></span></p></div>
            <button data-act="angel" data-i="${i}" id="b-an-${i}">${tr('Investir', 'Invest')}</button></div>`;
        });
        h += '</section>';
        if (A.tickets.length) {
          h += `<section class="card"><h3>${tr('Sua carteira de startups', 'Your startup portfolio')}</h3><table class="tbl">`;
          A.tickets.forEach((t, i) => {
            h += `<tr><td>${t.name}</td><td>${f.money(t.amount)}</td><td class="muted" id="an-t-${i}"></td></tr>`;
          });
          h += '</table></section>';
        }
        return h;
      },
      update(S) {
        set('an-book', f.money(G.angel.book(S)));
        set('an-out', f.money(S.stats.angelOut || 0));
        S.angel.deals.forEach((d, i) => {
          set(`an-d-${i}`, tr(`rodada fecha em ${d.until - S.day} dias`, `round closes in ${d.until - S.day} days`));
          dis(`b-an-${i}`, S.cash < d.ticket);
          why(`b-an-${i}`, need(S, { cash: d.ticket }));
        });
        S.angel.tickets.forEach((t, i) => {
          const y = (S.day - t.day) / 360;
          const ago = y < 1 ? `${Math.floor(S.day - t.day)} ${tr('dias', 'days')}` : `${f.num(y, 1)} ${tr('anos', 'years')}`;
          set(`an-t-${i}`, tr(`investido há ${ago} · sem notícias`, `invested ${ago} ago · no news`));
        });
      },
    },
  };

  function buildResources() {
    const row = (id, label) => `<div class="row" id="row-${id}" title="${esc(TIPS[id] || '')}"><span>${label}</span><b id="r-${id}"></b></div>`;
    $('resources').innerHTML = `
      ${row('cash', tr('Caixa', 'Cash'))}
      ${row('nw', tr('Patrimônio', 'Net worth'))}
      <canvas class="spark zoom" id="r-nwc" data-act="chart" data-id="nw" title="${tr('Clique para ampliar', 'Click to enlarge')}" hidden></canvas>
      ${row('reserve', tr('Reserva', 'Reserve'))}
      <div class="row" title="${esc(TIPS.en)}"><span>${tr('Energia', 'Energy')}</span><b id="r-en"></b></div>
      <div class="bar"><i id="r-enbar"></i></div>
      ${row('age', tr('Idade', 'Age'))}
      ${row('k', tr('Conhecimento', 'Knowledge'))}
      ${row('rep', tr('Reputação', 'Reputation'))}
      ${row('status', tr('Posição', 'Status'))}
      ${row('stress', 'Stress')}
      ${row('well', tr('Bem-estar', 'Well-being'))}
      ${row('inf', tr('Influência', 'Influence'))}
      ${row('img', tr('Imagem pública', 'Public image'))}
      <h4>${tr('Mês', 'Month')}</h4>
      ${row('sal', tr('Salário', 'Salary'))}
      ${row('yield', tr('Rendimentos', 'Investment income'))}
      ${row('rent', tr('Aluguéis', 'Rents'))}
      ${row('agro', tr('Terras', 'Land'))}
      ${row('loan', tr('Financiamentos', 'Loans'))}
      ${row('biz', tr('Empresas', 'Businesses'))}
      ${row('fund', tr('Gestora', 'Asset manager'))}
      ${row('social', tr('Família e clubes', 'Family and clubs'))}
      ${row('pol', tr('Política', 'Politics'))}
      ${row('cost', tr('Custo de vida', 'Cost of living'))}
      ${row('net', tr('Sobra', 'Surplus'))}
      <h4>${tr('Economia', 'Economy')}</h4>
      ${row('selic', 'Selic')}
      ${row('infl', tr('Inflação', 'Inflation'))}
      <h4>${tr('Próximos passos', 'Next steps')}</h4>
      <div id="r-goals"></div>`;
  }

  // Metas curtas no painel: promoção, FIRE e a próxima conquista da lista.
  // Próximos passos (ver goals.js): um objetivo por eixo; clicar leva à aba onde ele se resolve.
  function goals(S) {
    return G.goals.list(S).map(g => {
      const body = `<b>${esc(G.goals.AXES[g.axis])}</b>: ${esc(g.text)}`;
      return S.tabs[g.tab] ? `<button class="goal link" data-act="tab" data-id="${g.tab}">${body}</button>` : `<div class="goal">${body}</div>`;
    }).join('');
  }

  function renderResources(S) {
    const W = G.work, P = G.portfolio;
    const sal = S.job.employed ? W.salary(S) : 0, yld = P.monthlyYield(S), cost = W.cost(S);
    set('r-cash', f.money(S.cash));
    $('r-cash').className = S.cash < 0 ? 'bad' : '';
    set('r-nw', f.money(P.netWorth(S)));
    const nwc = $('r-nwc');
    nwc.hidden = !(S.research.planilha && S.stats.nwHist.length > 1);
    if (!nwc.hidden) spark('r-nwc', nwSeries(S));
    show('row-reserve', S.research.reserva);
    const rm = W.reserveMonths(S);
    set('r-reserve', rm >= 24 ? f.num(rm / 12, 0) + tr(' anos', ' years') : f.num(rm, 1) + tr(' meses', ' months'));
    set('r-en', `${Math.floor(S.energy)}/${W.emax(S)}`);
    $('r-enbar').style.width = `${(100 * S.energy) / W.emax(S)}%`;
    set('r-k', f.num(S.knowledge, 1));
    set('r-age', `${Math.floor(G.legacy.age(S))} ${tr('anos', 'years')}${S.legacy.generation > 1 ? ` · ${tr(`${S.legacy.generation}ª geração`, `generation ${S.legacy.generation}`)}` : ''}`);
    set('r-rep', f.num(Math.floor(S.reputation)));
    show('row-status', S.tabs.vida);
    show('row-stress', S.tabs.vida);
    set('r-status', G.social.tierName(S));
    set('r-stress', f.num(S.social.stress, 0));
    show('row-well', S.tabs.vida);
    set('r-well', f.num(S.life.well, 0) + (S.life.away > 0 ? tr(' · de férias', ' · on vacation') : ''));
    $('r-stress').className = S.social.stress > 70 ? 'bad' : '';
    show('row-inf', S.tabs.poder);
    show('row-img', S.tabs.poder);
    set('r-inf', f.num(S.pol.influence, 0));
    set('r-img', f.num(S.pol.image, 0));
    $('r-img').className = S.pol.image < -20 ? 'bad' : S.pol.image > 20 ? 'good' : '';
    set('r-sal', S.job.employed ? f.money(sal) : S.job.retired ? tr('vive de renda', 'living off income') : tr('desempregado', 'unemployed'));
    set('r-yield', f.money(yld));
    set('r-cost', '−' + f.money(cost));
    const re = G.realty.monthlyNet(S), bz = G.business.monthlyProfit(S), fd = S.fund ? S.fund.lastProfit : 0;
    const loans = re.pmt + G.business.monthlyPayments(S);
    const fam = S.social.family, spouse = fam.married ? fam.spouseIncome * S.macro.priceIndex : 0;
    const social = spouse - G.social.clubFees(S) - G.social.schoolCost(S) - G.social.partilhaPayment(S) - G.dynasty.focusCost(S);
    const officePay = (S.pol.office ? G.politics.office(S.pol.office.id).pay * S.macro.priceIndex : 0) + G.nation.pay(S);
    const polCost = G.politics.mediaUpkeep(S) + G.politics.thinkTankCost(S) + G.politics.entityFees(S) - officePay;
    const agro = G.agro.monthlyExpected(S) - G.agro.monthlyCost(S);
    // Mesma conta do motor: tudo que entra menos W.outflow (custo de vida, parcelas, clubes, política...).
    const net = sal + yld + re.rent + agro + bz + fd + spouse + officePay - W.outflow(S);
    set('r-pol', f.money(-polCost));
    show('row-pol', polCost !== 0);
    set('r-social', f.money(social));
    show('row-social', social !== 0);
    set('r-biz', f.money(bz));
    set('r-fund', f.money(fd));
    show('row-biz', bz !== 0);
    show('row-fund', !!S.fund);
    set('r-rent', f.money(re.rent - re.upkeep));
    set('r-agro', f.money(agro));
    show('row-agro', S.agro.lands.length > 0);
    set('r-loan', '−' + f.money(loans));
    show('row-rent', S.realty.length > 0);
    show('row-loan', loans > 0);
    set('r-net', f.money(net));
    $('r-net').className = net < 0 ? 'bad' : 'good';
    set('r-selic', f.pct(S.macro.selic));
    set('r-infl', f.pct(S.macro.infl));
    show('row-k', S.tabs.conhecimento);
    show('row-yield', S.tabs.investimentos);
    show('row-infl', S.research.macro1);
    const g = goals(S);
    if (keys.goals !== g) { keys.goals = g; $('r-goals').innerHTML = g; }
  }

  // Abas; um "•" marca as que têm algo a fazer agora (goals.js), com os motivos no tooltip.
  function renderNav(S) {
    const tabs = TABS.filter(([id]) => S.tabs[id]);
    if (!S.tabs[active]) active = 'trabalho';
    const badges = S.settings.badges === false ? {} : G.goals.badges(S);
    const mark = id => (badges[id] && id !== active ? badges[id] : null);
    const k = tabs.map(t => t[0] + (mark(t[0]) ? '*' + mark(t[0]).join('/') : '')).join() + '|' + active;
    if (keys.nav === k) return;
    keys.nav = k;
    $('tabs').innerHTML = tabs
      .map(([id, n]) => `<button data-act="tab" data-id="${id}" class="tablink${id === active ? ' active' : ''}"${mark(id) ? ` title="${esc(mark(id).join('; '))}"` : ''}>${n}${
        mark(id) ? '<span class="badge">•</span>' : ''}</button>`)
      .join('<span class="sep">|</span>');
  }

  // Filtros do jornal: cada um aceita alguns tipos de notícia.
  const LOG_FILTERS = [
    ['tudo', tr('Tudo', 'All'), null],
    ['bom', tr('Bom', 'Good'), ['good']],
    ['ruim', tr('Ruim', 'Bad'), ['bad']],
    ['macro', 'Macro', ['macro', 'hint']],
    ['politica', tr('Política', 'Politics'), ['politica']],
    ['marcos', tr('Marcos', 'Milestones'), ['unlock', 'story']],
  ];
  function renderLog(S) {
    const cur = S.settings.logFilter || 'tudo', kinds = (LOG_FILTERS.find(x => x[0] === cur) || LOG_FILTERS[0])[2];
    const top = S.log[0];
    const k = S.log.length + '|' + (top ? top.d + top.t : '') + '|' + cur;
    if (keys.log === k) return;
    keys.log = k;
    $('log-filters').innerHTML = LOG_FILTERS.map(([id, n]) =>
      `<button class="link${id === cur ? ' active' : ''}" data-act="log-filter" data-id="${id}">${n}</button>`).join(' · ');
    $('log').innerHTML = S.log
      .filter(e => !kinds || kinds.includes(e.k))
      .slice(0, 40)
      .map(e => `<li class="k-${e.k}"><time>${f.date(e.d)}</time> ${esc(G.i18n.show(e.t, e.t2, e.l))}</li>`)
      .join('');
  }

  function render() {
    G.i18n.rec = false; // a tela não grava textos: nada a registrar
    try { renderAll(); } finally { G.i18n.rec = true; }
  }
  function renderAll() {
    const S = G.S;
    const cs = getComputedStyle(document.body);
    colors = { up: cs.getPropertyValue('--up').trim(), down: cs.getPropertyValue('--down').trim(), accent: cs.getPropertyValue('--warn').trim(), muted: cs.getPropertyValue('--muted').trim() };
    set('clock', `${f.date(S.day)} · ${G.cal.season(S.day).n}${S.speed === 0 ? tr(' · pausado', ' · paused') : ''}`);
    document.querySelectorAll('[data-act="speed"]').forEach(b => b.classList.toggle('active', +b.dataset.v === S.speed));
    $('b-autopause').checked = S.settings.autoPause !== false;
    show('b-sp3', G.legacy.maxSpeed(S) >= 3);
    show('b-sp5', G.legacy.maxSpeed(S) >= 5);
    renderResources(S);
    renderNav(S);
    const v = VIEWS[active], k = active + '#' + v.key(S);
    if (keys.body !== k) {
      keys.body = k;
      $('tab-body').innerHTML = v.build(S);
    }
    v.update(S);
    renderDecision(S);
    renderHint(S);
    renderZoom(S);
    renderLog(S);
    if (G.debug) set('dbg-info', `${G.macro.REGIMES[S.macro.regime].n} (${S.macro.daysLeft}d) · ${G.macro.POLICIES[S.macro.policy].n}`);
  }

  const BLIND_MSG = tr('Seu patrimônio está num blind trust enquanto você ocupa o cargo: só a estratégia automática opera.',
    'Your assets are in a blind trust while you hold office: only the automatic strategy trades.');

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const S = G.S, id = b.dataset.id, W = G.work, P = G.portfolio;
    const input = () => parseMoney(($(`a-in-${id}`) || {}).value || '');
    const clearInput = x => { const el = $(`a-in-${x}`); if (el) el.value = ''; };
    const BLIND = ['buy', 'buymax', 'buyfrac', 'sell', 'sellall', 'sellfrac', 're-buy', 're-fin', 're-sell', 'angel', 'biz-open', 'biz-sell', 'biz-fin',
      'biz-hire', 'agro-buy', 'agro-sell', 'agro-hire', 'agro-ins', 'fund-open', 'fund-sell', 'col-buy', 'col-sell', 'home', 'second-buy', 'second-sell'];
    if (BLIND.includes(b.dataset.act) && G.politics.blind(S)) {
      G.news(BLIND_MSG, 'info');
      render();
      return;
    }
    switch (b.dataset.act) {
      case 'tab': active = id; break;
      case 'log-filter': S.settings.logFilter = id; break;
      case 'autopause': S.settings.autoPause = b.checked; break;
      case 'speed': S.speed = +b.dataset.v; break;
      case 'overtime': W.overtime(S); break;
      case 'study': W.study(S); break;
      case 'search': W.search(S); break;
      case 'promote': W.promote(S); break;
      case 'lifestyle': W.setLifestyle(S, +b.dataset.i); break;
      case 'buy': P.buy(S, id, input()); clearInput(id); break;
      case 'buymax': P.buy(S, id, S.cash); break;
      case 'buyfrac': P.buy(S, id, S.cash * +b.dataset.f); break;
      case 'sell': P.sell(S, id, input()); clearInput(id); break;
      case 'sellfrac': P.sell(S, id, (P.value(S, id) - P.locked(S, id).value) * +b.dataset.f); break;
      case 'sellall': P.sell(S, id, Infinity); break;
      case 'research': G.research.buy(S, id); break;
      case 'filter': invFilter = id; break;
      case 'reinvest': S.settings.reinvest = b.checked; break;
      case 're-buy': G.realty.buy(S, id, false); break;
      case 'agro-buy': G.agro.buy(S, id); break;
      case 'agro-hire': G.agro.hire(S, +b.dataset.i); break;
      case 'agro-ins': G.agro.toggleInsurance(S, +b.dataset.i); break;
      case 'agro-sell': G.agro.sell(S, +b.dataset.i); break;
      case 're-fin': G.realty.buy(S, id, true); break;
      case 're-sell': G.realty.sell(S, +b.dataset.i); break;
      case 'angel': G.angel.invest(S, +b.dataset.i); break;
      case 'retire': W.retire(S); break;
      case 'succeed':
        if (confirm(tr('Aposentar e passar o bastão para o herdeiro? Seu personagem sai de cena e a próxima geração começa agora. Metade da parte do herdeiro vai agora; a outra metade fica com você e vira herança quando você morrer.',
          'Retire and pass the torch to your heir? Your character leaves the stage and the next generation starts now. Half of the heir\'s share goes now; the other half stays with you and becomes an inheritance when you die.'))) G.legacy.succeed(S, 'aposentadoria');
        break;
      case 'legacy-up': G.legacy.buyUpgrade(S, id); break;
      case 'chart': zoom = id; break;
      case 'modal-close': if (zoom) zoom = null; else closePopup(S); break;
      case 'hint-ok': (S.settings.hintsOff || (S.settings.hintsOff = {}))[id] = true; break;
      case 'hint-all': S.settings.hints = false; break;
      case 'hints-on': S.settings.hints = true; S.settings.hintsOff = {}; hintKey = null; break;
      case 'decide':
        G.social.decide(S, +id);
        if (S.speed === 0 && G.pausedFrom && !G.popups.length) S.speed = G.pausedFrom;
        G.pausedFrom = 0;
        break;
      case 'pol-donate': G.politics.donate(S, $('p-don-side').value, parseMoney($('p-don-in').value), id === 'dirty'); break;
      case 'lobby': G.politics.startLobby(S, id, ($('p-sec') || {}).value); break;
      case 'media': G.politics.buyMedia(S, id); break;
      case 'tt-start': G.politics.startThinkTank(S, $('p-tt-side').value); break;
      case 'tt-stop': G.politics.stopThinkTank(S); break;
      case 'ent-join': G.politics.joinEntity(S, id); break;
      case 'ent-leave': G.politics.leaveEntity(S, id); break;
      case 'run': {
        const N = G.nation;
        const plat = ($('pr-side') || {}).value || (S.nation.president && S.nation.president.platform), budget = parseMoney(($('pr-budget') || {}).value || '');
        if (budget < N.minBudget(S)) G.news(tr(`A verba mínima de campanha é ${f.money(N.minBudget(S))}.`, `The minimum campaign budget is ${f.money(N.minBudget(S))}.`), 'info');
        else N.launch(S, plat, budget);
        break;
      }
      case 'fam-approach': G.families.approach(S, id); break;
      case 'kid-time': G.dynasty.spendTime(S, id); break;
      case 'kid-heir': G.dynasty.setHeir(S, id); break;
      case 'fam-ally': G.families.ally(S, id); break;
      case 'fam-break': G.families.breakAlly(S, id); break;
      case 'fam-inv': G.families.investigate(S, id); break;
      case 'fam-attack':
        if (confirm(tr('Atacar essa família na mídia? A relação vira guerra e a retaliação é provável.', 'Attack this family in the media? The relationship turns into war and retaliation is likely.'))) G.families.attack(S, id);
        break;
      case 'reform': G.nation.proposeReform(S, id); break;
      case 'summit': G.nation.summit(S); break;
      case 'unseat': G.nation.unSeat(S); break;
      case 'bc': G.nation.setBC(S, b.checked); break;
      case 'office': G.politics.takeOffice(S, id, ($('p-bc') || {}).value); break;
      case 'vacation': G.life.vacation(S, id); break;
      case 'hobby-start': G.life.startHobby(S, id); break;
      case 'hobby-stop': G.life.stopHobby(S, id); break;
      case 'plan': G.life.setPlan(S, id); break;
      case 'adopt': G.life.adopt(S); break;
      case 'second-buy': G.life.buySecond(S, id); break;
      case 'second-sell': G.life.sellSecond(S, +b.dataset.i); break;
      case 'col-buy': G.life.buyLot(S, id, +b.dataset.i); break;
      case 'col-sell': G.life.sellLot(S, +b.dataset.i); break;
      case 'city': G.life.moveCity(S, id); break;
      case 'home': G.life.moveIn(S, +b.dataset.i); break;
      case 'home-out': G.life.moveOut(S); break;
      case 'sabbatical':
        if (confirm(tr('Tirar um ano sabático? Você fica 12 meses sem salário, mas mantém o cargo.',
          'Take a sabbatical year? You go 12 months without salary, but keep your position.'))) G.work.sabbatical(S);
        break;
      case 'retro-toggle': S.settings.retro = b.checked; break;
      case 'badges-toggle': S.settings.badges = b.checked; break;
      case 'habit-start': G.social.startHabit(S, id); break;
      case 'habit-drop': G.social.dropHabit(S, id); break;
      case 'social': G.social.doActivity(S, id); break;
      case 'club-join': G.social.joinClub(S, id); break;
      case 'club-leave': G.social.leaveClub(S, id); break;
      case 'luxury': G.social.buyLuxury(S, id); break;
      case 'donate': G.social.donate(S, parseMoney(($('v-don-in') || {}).value || '')); break;
      case 'marry': G.social.marry(S, id === '1'); break;
      case 'kid': G.social.haveKid(S); break;
      case 'school': S.social.family.school = !S.social.family.school; break;
      case 'auto-on': S.auto.on = b.checked; break;
      case 'auto-rebal': S.auto.rebal = b.checked; break;
      case 'biz-open': G.business.open(S, id); break;
      case 'biz-fin': G.business.open(S, id, true); break;
      case 'biz-hire': G.business.hire(S, id); break;
      case 'biz-sell': G.business.sell(S, id); break;
      case 'fund-open': G.fund.open(S); break;
      case 'fund-sell':
        if (confirm(tr(`Vender a gestora por ${f.money(G.fund.saleValue(S))}? Depois, 5 anos sem poder abrir outra.`,
          `Sell the asset manager for ${f.money(G.fund.saleValue(S))}? Afterwards, 5 years before you can open another.`))) G.fund.sell(S);
        break;
      case 'theme': setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); break;
      case 'lang': G.setLang(G.EN ? 'pt' : 'en'); return;
      case 'export': exportFile(); break;
      case 'import': $('import-file').click(); break;
      case 'reset':
        if (confirm(tr('Começar um jogo novo do zero?\n\nO jogo atual fica guardado: dá para voltar a ele pelo link "Desfazer reinício".',
          'Start a brand-new game from scratch?\n\nThe current game is kept: you can go back to it with the "Undo restart" link.'))) G.restart();
        break;
      case 'undo-reset':
        if (confirm(tr('Voltar ao jogo de antes do reinício? O jogo novo será descartado.', 'Go back to the game from before the restart? The new game will be discarded.')) && G.restoreBackup()) {
          reset();
          G.news(tr('Jogo anterior restaurado.', 'Previous game restored.'), 'info');
        }
        break;
      case 'dbg-cash': S.cash += 10000; break;
      case 'dbg-know': S.knowledge += 100; break;
      case 'dbg-regime': S.macro.daysLeft = 1; break;
    }
    render();
  }

  // Atalhos: espaço pausa/continua, 1/2/3/5 velocidade, E estuda, H hora extra, Esc fecha janelas.
  let lastSpeed = 1;
  function onKey(e) {
    const S = G.S;
    if (e.key === 'Escape') {
      if (zoom) zoom = null; else if (G.popups.length) closePopup(S); else return;
      render();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      if (S.speed > 0) { lastSpeed = S.speed; S.speed = 0; } else S.speed = lastSpeed || 1;
    } else if (['1', '2', '3', '5'].includes(k) && +k <= G.legacy.maxSpeed(S)) S.speed = +k;
    else if (k === 'e') G.work.study(S);
    else if (k === 'h') G.work.overtime(S);
    else return;
    render();
  }

  // Tema claro por padrão (estilo Kittens Game); a escolha fica no navegador.
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('juros-compostos-tema', t); } catch (e) { /* sem storage */ }
    set('b-theme', t === 'dark' ? tr('Tema claro', 'Light theme') : tr('Tema escuro', 'Dark theme'));
  }

  // Exporta o save como arquivo .txt (vai para a pasta de downloads).
  function exportFile() {
    G.save();
    const c = G.cal.of(G.S.day);
    const name = `jogo-da-vida-${c.year}-${String(c.month).padStart(2, '0')}.txt`;
    const url = URL.createObjectURL(new Blob([G.exportSave()], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    G.news(tr(`Save exportado para o arquivo ${name}, na sua pasta de downloads.`, `Save exported to the file ${name}, in your downloads folder.`), 'info');
  }

  function importText(text) {
    try {
      G.S = G.importSave(text);
      G.save();
      reset();
      G.news(tr('Save importado.', 'Save imported.'), 'info');
    } catch (err) {
      alert(tr('Esse arquivo não é um save válido do Jogo da Vida.', 'That file is not a valid Game of Life save.'));
    }
  }

  function onChange(e) {
    const el = e.target, S = G.S;
    if (el.id === 'import-file') {
      const file = el.files[0];
      if (file) file.text().then(importText);
      el.value = '';
      return;
    }
    if (el.dataset.alloc) S.auto.targets[el.dataset.alloc] = Math.max(0, parseFloat(el.value.replace(',', '.')) || 0);
    else if (el.dataset.set === 'reserve') S.auto.reserve = Math.max(0, parseFloat(el.value.replace(',', '.')) || 0);
    else if (el.dataset.set === 'robot') S.auto.robot = el.value;
    else if (el.dataset.set === 'routine') S.routine = el.value;
    else if (el.dataset.set === 'focus') G.dynasty.setFocus(S, el.dataset.id, el.value);
    else if (el.dataset.set === 'surname') { if (el.value.trim()) S.legacy.surname = el.value.trim().slice(0, 30); }
    else if (el.dataset.set === 'myname') { if (el.value.trim()) S.me.name = el.value.trim().slice(0, 30); }
    else if (el.dataset.nb) G.nation.setBudget(S, el.dataset.nb, parseFloat(el.value.replace(',', '.')));
    else if (el.dataset.set === 'stance') G.nation.setStance(S, el.value);
    else if (el.dataset.set === 'emendas') G.nation.setEmendas(S, el.value);
    else if (el.dataset.set === 'crop') {
      if (G.politics.blind(S)) G.news(BLIND_MSG, 'info');
      else G.agro.setCrop(S, +el.dataset.i, el.value);
      keys.body = null; // o select volta a mostrar a cultura real
    }
    else return;
    render();
  }

  function reset() {
    hintKey = null;
    zoom = null;
    show('b-undo', G.hasBackup()); // checado só aqui: ler o backup a cada quadro seria caro
    keys = {};
    active = 'trabalho';
    render();
  }

  G.ui = {
    init() {
      const params = new URLSearchParams(location.search);
      G.debug = params.has('debug');
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
      if (params.get('tab')) active = params.get('tab');
      if (params.get('zoom')) zoom = params.get('zoom');
      $('debug-controls').hidden = !G.debug;
      buildResources();
      document.addEventListener('click', onClick);
      document.addEventListener('change', onChange);
      document.addEventListener('keydown', onKey);
      $('modal').addEventListener('click', e => {
        if (e.target.id !== 'modal') return;
        if (zoom) zoom = null; else closePopup(G.S);
        render();
      });
      show('b-undo', G.hasBackup());
      render();
    },
    render,
    reset,
  };
})();

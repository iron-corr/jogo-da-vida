(function () {
  const G = globalThis.G;
  const f = G.fmt;
  const $ = id => document.getElementById(id);

  const TABS = [
    ['trabalho', 'Trabalho'],
    ['investimentos', 'Investimentos'],
    ['conhecimento', 'Conhecimento'],
    ['mercado', 'Mercado'],
    ['vida', 'Vida'],
    ['lazer', 'Lazer'],
    ['poder', 'Poder'],
    ['negocios', 'Negócios'],
    ['imoveis', 'Imóveis'],
    ['terras', 'Terras'],
    ['startups', 'Startups'],
    ['legado', 'Legado'],
  ];

  const FRACS = [0.1, 0.25, 0.5];
  let active = 'trabalho';
  let invFilter = 'Todos';
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
    if (energy && S.burnout > 0) return `em burnout por mais ${S.burnout} dia(s)`;
    if (energy && S.energy < energy) return `falta energia: ${Math.floor(S.energy)}/${energy}`;
    if (cash && S.cash < cash) return `faltam ${f.money(cash - S.cash)}`;
    return '';
  };
  const show = (id, on) => {
    const el = $(id);
    if (el) el.hidden = !on;
  };
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // Aceita "1.500,50", "1500.5", "R$ 2 mil" não (só números).
  function parseMoney(s) {
    s = String(s).replace(/[^\d,.]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
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
    let h = `<section class="card"><h3>Estratégia automática</h3>
      <p><label class="check"><input type="checkbox" data-act="auto-on" id="au-on"> Aporte automático: todo mês, investir o que passar de
      <input class="num" data-set="reserve" value="${A.reserve}" inputmode="numeric"> meses de gastos em caixa</label></p>`;
    if (S.research.rebalanceamento) {
      h += `<p><label class="check"><input type="checkbox" data-act="auto-rebal" id="au-rebal"> Rebalancear ${S.research.quant ? 'todo mês' : 'a cada trimestre'}
        quando um ativo sair mais de ${f.pct(A.band, 0)} do alvo</label></p>`;
    }
    if (S.research.quant) {
      h += `<p>Robô: <select data-set="robot">${Object.entries(G.auto.ROBOTS).map(([k, r]) =>
        `<option value="${k}"${k === A.robot ? ' selected' : ''}>${r.n}</option>`).join('')}</select>
        <span class="muted" id="au-robot-d"></span></p>`;
    }
    h += '<table class="tbl alloc"><tr><td><b>Ativo</b></td><td><b>Alvo</b></td><td><b>Efetivo</b></td><td><b>Atual</b></td></tr>';
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
    set('au-sum', sum ? `Os alvos somam ${sum}%; são normalizados para 100%. "Efetivo" já inclui a inclinação do robô.`
      : 'Preencha os alvos (em %) para ligar a estratégia.');
  }


  // Explicações do painel lateral (aparecem ao passar o mouse).
  const TIPS = {
    cash: 'Dinheiro parado na conta. Perde para a inflação; o que passar da reserva pode ir para investimentos.',
    nw: 'Tudo o que você tem: caixa, investimentos, imóveis (menos dívidas), startups, empresas e gestora.',
    reserve: 'Quantos meses de gastos o caixa, a poupança e o Tesouro Selic cobrem. Protege contra demissão.',
    en: 'Gasta em estudar, hora extra, hábitos e empresas sem gerente. Volta todo dia. Abaixo de 25% há risco de burnout.',
    age: 'Aos 60 dá para passar o bastão ao herdeiro. A expectativa de vida é oculta; o stress a reduz, exercício a aumenta.',
    k: 'Moeda das pesquisas e das promoções. Vem de estudar, ler e investir.',
    rep: 'Cresce com os meses de trabalho. Exigida nas promoções; ajuda a achar emprego e captar na gestora.',
    status: 'Posição social: prestígio + metade da visibilidade. Abre clubes, cargos, palestras e o fim de jogo.',
    stress: 'Sobe com quedas do patrimônio, dívidas e desemprego. Acima de 70 quebra hábitos e aumenta o burnout.',
    well: 'Bem-estar (0 a 100): família, saúde, hobbies, férias, cidade e pouco stress. A média da vida vira pontos de legado.',
    inf: 'Capital político. Vem de doações a quem vence, mídia, entidades e cargos. Paga o lobby. Cai 2% ao mês.',
    img: 'Imagem pública (−100 a +100). Filantropia sobe; ostentação, lobby exposto e escândalos derrubam.',
    sal: 'Salário do cargo atual, reajustado pela inflação todo janeiro.',
    yield: 'Juros, dividendos e aluguéis de FIIs esperados por mês (sem contar a variação de preço).',
    rent: 'Aluguel líquido dos imóveis ocupados.',
    agro: 'Arrendamentos e gado por mês. As safras de soja e café entram de uma vez na colheita.',
    loan: 'Parcelas dos financiamentos de imóveis (taxa fixa) e de empresas (acompanham a Selic).',
    biz: 'Lucro das empresas, já descontando gerentes e imposto.',
    fund: 'Lucro da gestora no último mês.',
    social: 'Renda do cônjuge menos clubes e escola.',
    pol: 'Mídia e think tank, menos o que o cargo público paga.',
    cost: 'Custo de vida do mês: moradia, família e hábitos. Sobe com a inflação.',
    net: 'Quanto sobra (ou falta) por mês com tudo somado.',
    selic: 'Taxa básica de juros, decidida pelo Copom a cada 45 dias.',
    infl: 'Inflação anual corrente.',
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
    if (key === 'selic') return { title: 'Selic', data: S.macro.selicHist, step: 45, pct: true };
    if (key === 'pmi') return { title: 'PMI da indústria', data: S.macro.pmiHist, step: 30 };
    if (key === 'nw') return { title: 'Seu patrimônio', data: nwSeries(S), step: 30, money: true };
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
    ctx.fillText(days >= 360 ? `há ${f.num(days / 360, 1)} anos` : `há ${days} dias`, L, h - 6);
    const hoje = 'hoje';
    ctx.fillText(hoje, w - R - ctx.measureText(hoje).width, h - 6);
    ctx.strokeStyle = s.pct || s.title.startsWith('PMI') ? colors.accent : data[data.length - 1] >= data[0] ? colors.up : colors.down;
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
    const per = s.step === 1 ? [['1 mês', 30], ['6 meses', 180], ['1 ano', 360], ['2 anos', 719]]
      : s.step === 30 ? [['1 ano', 12], ['5 anos', 60], ['20 anos', 239]] : [];
    set('modal-info', `Agora: ${s.money ? f.money(last) : s.pct ? f.pct(last) : f.num(last, 1)}` +
      (s.pct || s.title.startsWith('PMI') ? '' : per.map(([n, k]) => ` · ${n}: ${ret(k)}`).join('')));
    bigChart($('modal-c'), s);
  }

  // Dicas de tutorial: a primeira que se aplica aparece acima das abas; dá para dispensar ou desligar.
  const HINTS = [
    { id: 'estudar', when: S => S.knowledge < 3 && !Object.keys(S.research).length,
      t: 'Comece clicando em <b>Estudar</b> para ganhar conhecimento, ou em <b>Hora extra</b> para ganhar dinheiro. A energia volta todo dia.' },
    { id: 'poupanca', when: S => S.tabs.investimentos && G.portfolio.invested(S) === 0,
      t: 'Dinheiro parado perde para a inflação. Na aba <b>Investimentos</b>, aplique na poupança o que sobrar.' },
    { id: 'rotina', when: S => S.tabs.conhecimento && !S.research.rotina,
      t: 'Pesquise <b>Rotina</b> (aba Conhecimento) para ligar o piloto automático e parar de clicar.' },
    { id: 'piloto', when: S => S.research.rotina && S.routine === 'off',
      t: 'Ligue o <b>piloto automático</b> em Trabalho → Dia a dia.' },
    { id: 'edu_fin', when: S => S.tabs.conhecimento && !S.research.edu_fin && S.knowledge >= 5,
      t: 'Pesquise <b>Educação financeira</b>: o Tesouro Selic rende bem mais que a poupança.' },
    { id: 'promocao', when: S => G.work.canPromote(S),
      t: 'Você já pode <b>pedir promoção</b> na aba Trabalho.' },
    { id: 'alvos', when: S => S.research.aporte_auto && !Object.values(S.auto.targets).some(v => v > 0),
      t: 'Defina seus alvos em <b>Investimentos → Estratégia automática</b> e ligue o aporte automático.' },
    { id: 'habito', when: S => S.tabs.vida && !Object.keys(S.social.habits).length,
      t: 'Na aba <b>Vida</b>, comece um hábito. Exercício e leitura se pagam rápido.' },
    { id: 'panico', when: S => S.social.pending && S.social.pending.type === 'panic',
      t: 'Pânico na bolsa: veja a aba <b>Vida</b>. Quem vende no fundo costuma se arrepender.' },
    { id: 'herdeiro', when: S => G.legacy.age(S) >= 50 && !S.social.family.kids,
      t: 'Sem filhos, metade do seu legado se perde. A família fica na aba <b>Vida</b>.' },
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
    if (h) box.innerHTML = `<span>${h.t}</span> <button class="link" data-act="hint-ok" data-id="${h.id}">entendi</button>
      <button class="link" data-act="hint-all">desligar dicas</button>`;
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
        h = `<h3>Pânico no mercado</h3><p>A bolsa despencou e você não dorme direito. Vender todas as ações e criptos agora?</p>
          <p class="muted">Se você não decidir em <span id="d-left"></span> dias, o impulso passa e você segura.</p>
          <button data-act="decide" data-id="1">Vender tudo</button> <button data-act="decide" data-id="0">Segurar firme</button>`;
      } else if (p.type === 'tempt') {
        h = `<h3>Tentação</h3><p>${esc(SO.HABITS[p.id].offer)}</p>
          <p class="muted">${esc(SO.HABITS[p.id].d)} Ocupa uma vaga de hábito. A oferta some em <span id="d-left"></span> dias.</p>
          <button data-act="decide" data-id="1" id="b-tempt">Aceitar</button> <button data-act="decide" data-id="0">Recusar</button>`;
      } else {
        const c = G.choices.byId(p.id);
        h = `<h3>${esc(c.title)}</h3><p>${esc(c.text(S, p.data))}</p>
          <p class="muted">Sem resposta em <span id="d-left"></span> dias, fica valendo "${esc(c.options[c.def].label)}".</p>
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
        let h = `<section class="card"><h3>Carreira</h3>
          <p><b>${cur.t}</b>${S.job.track && S.job.track !== 'corporativo' ? ` <small>(${W.TRACKS[S.job.track].n})</small>` : ''} · <span id="w-sal"></span>/mês
          ${S.job.employed ? '' : '<span class="bad">(desempregado)</span>'}${S.job.sabbatical ? ' <span class="good">em ano sabático</span>' : ''}</p>`;
        if (nx) {
          h += `<p class="muted">Próximo cargo: <b>${nx.t}</b> (${f.money(nx.sal * S.job.wageIndex * neg)}/mês).
            Requer ${nx.k} de conhecimento (gasto na promoção) e ${nx.rep} de reputação.</p>
            <button data-act="promote" id="b-promote">Pedir promoção</button>`;
        } else h += '<p class="muted">Você chegou ao topo da carreira.</p>';
        if (S.job.employed && !S.job.sabbatical) {
          h += ` <button data-act="sabbatical" id="b-sabb">Ano sabático <small>12 meses sem salário, stress zerado, +30 conhecimento</small></button>`;
        }
        h += '</section><section class="card"><h3>Dia a dia</h3><div class="btns">';
        h += S.job.employed
          ? `<button data-act="overtime" id="b-ot">Hora extra <small>[H] −${W.OT_COST} energia, <span id="w-ot"></span></small></button>`
          : `<button data-act="search" id="b-search">${S.job.retired ? 'Voltar a trabalhar' : 'Procurar emprego'} <small>−${W.SEARCH_COST} energia</small></button>`;
        h += `<button data-act="study" id="b-study">Estudar <small>[E] −${W.studyCost(S)} energia, <span id="w-st"></span></small></button>
          </div>`;
        if (S.research.rotina) {
          h += `<p>Piloto automático: <select data-set="routine">${Object.entries(W.ROUTINES).map(([k, n]) =>
            `<option value="${k}"${k === S.routine ? ' selected' : ''}>${n}</option>`).join('')}</select>
            <span class="muted" id="w-auto"></span></p>`;
        }
        h += '<p id="w-burn" class="bad" hidden></p></section>';
        if (S.research.fire) {
          h += `<section class="card"><h3>Independência financeira</h3>
            <p>Número FIRE (25× o custo anual): <b id="w-fire"></b> · você tem <b id="w-fire-pct"></b></p>
            <p>Renda passiva: <b id="w-passive"></b>/mês contra custo de vida de <b id="w-cost"></b>/mês</p>
            ${S.job.employed ? '<button data-act="retire" id="b-retire">Pedir demissão e viver de renda</button>' : ''}</section>`;
        }
        if (S.tabs.estilo) {
          h += `<section class="card"><h3>Estilo de vida</h3>
            <p class="muted">Morar melhor dá mais energia, mas custa todo mês. Subir de padrão custa 2 meses do novo custo (mudança, móveis).</p>
            <table class="tbl">`;
          W.LIFESTYLE.forEach((l, i) => {
            const cur = i === S.lifestyle;
            h += `<tr class="${cur ? 'cur' : ''}"><td>${l.n}</td><td id="ls-c-${i}"></td><td>energia ${l.emax + bonusE}, +${l.regen}/dia</td>
              <td>${cur ? '<b>atual</b>' : `<button data-act="lifestyle" data-i="${i}" id="b-ls-${i}">${i > S.lifestyle ? 'Mudar' : 'Reduzir'}</button>`}</td></tr>`;
          });
          h += '</table>';
          // Cidade e casa própria
          const LF = G.life, home = LF.home(S);
          h += `<h3 style="margin-top:10px">Cidade</h3><table class="tbl">`;
          for (const [id, c] of Object.entries(LF.CITIES)) {
            h += `<tr class="${id === S.life.city ? 'cur' : ''}"><td>${c.n}<br><small class="muted">${c.d}</small></td>
              <td>${id === S.life.city ? '<b>atual</b>' : `<button data-act="city" data-id="${id}" id="b-city-${id}">Mudar <small id="w-cc-${id}"></small></button>`}</td></tr>`;
          }
          h += `</table><p>${home ? `Você mora no seu imóvel (${G.realty.prop(home.pid).n.toLowerCase()}): <span id="w-home"></span>
            <button class="link" data-act="home-out">voltar a alugar</button>`
            : '<span class="muted">Você mora de aluguel. Com um imóvel seu vago (aba Imóveis), dá para morar nele e cortar 40% do custo de vida.</span>'}</p></section>`;
        }
        return h;
      },
      update(S) {
        const W = G.work;
        dis('b-sabb', !W.canSabbatical(S));
        why('b-sabb', W.canSabbatical(S) ? '' : S.day - (S.job.since || 0) < 1800
          ? `precisa de 5 anos na mesma empresa (faltam ${f.num((1800 - (S.day - (S.job.since || 0))) / 360, 1)})` : 'só um sabático a cada 7 anos');
        if (S.tabs.estilo) {
          const LF = G.life;
          for (const id in LF.CITIES) {
            set(`w-cc-${id}`, f.money(LF.cityCost(S, id)));
            dis(`b-city-${id}`, S.cash < LF.cityCost(S, id));
            why(`b-city-${id}`, need(S, { cash: LF.cityCost(S, id) }));
          }
          set('w-home', LF.homeOk(S) ? 'custo de vida −40%.'
            : `pequeno para o padrão atual (precisa valer ${f.money(LF.homeMin(S))}), sem desconto no custo de vida.`);
        }
        set('w-sal', f.money(W.salary(S)));
        set('w-ot', '+' + f.money(W.otGain(S)));
        set('w-st', `+${f.num(W.studyGain(S), 1)} conhecimento`);
        dis('b-promote', !W.canPromote(S));
        const nx = W.nextLevel(S);
        why('b-promote', !nx || W.canPromote(S) ? '' : !S.job.employed ? 'você está sem emprego'
          : [S.knowledge < nx.k && `faltam ${f.num(nx.k - S.knowledge, 0)} de conhecimento`, S.reputation < nx.rep && `faltam ${f.num(nx.rep - S.reputation, 0)} de reputação`].filter(Boolean).join(' e '));
        dis('b-ot', !W.canAct(S, W.OT_COST));
        why('b-ot', need(S, { energy: W.OT_COST }));
        dis('b-study', !W.canAct(S, W.studyCost(S)));
        why('b-study', need(S, { energy: W.studyCost(S) }));
        dis('b-search', !W.canAct(S, W.SEARCH_COST));
        why('b-search', need(S, { energy: W.SEARCH_COST }));
        if (S.research.rotina) {
          // Estimativa do que o piloto faz por dia com a energia que sobra das empresas.
          const free = W.freeEnergy(S), r = S.routine;
          const studyShare = r === 'estudar' || (r !== 'off' && S.job.retired) ? 1 : r === 'misto' ? 0.5 : 0;
          const perDay = [];
          if (studyShare) perDay.push(`+${f.num((free * studyShare) / W.studyCost(S) * W.studyGain(S), 1)} conhecimento`);
          if (studyShare < 1 && r !== 'off' && S.job.employed) perDay.push(`+${f.money((free * (1 - studyShare)) / W.OT_COST * W.otGain(S))}`);
          if (studyShare < 1 && r !== 'off' && !S.job.employed && !S.job.retired) perDay.push('procurando emprego');
          set('w-auto', r === 'off' ? 'mantém 25% de energia de reserva, sem risco de burnout' : `≈ ${perDay.join(' e ')} por dia`);
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
        set('w-burn', `Em burnout: mais ${S.burnout} dia(s) de descanso.`);
        if (S.tabs.estilo) {
          W.LIFESTYLE.forEach((l, i) => {
            set(`ls-c-${i}`, f.money(l.cost * S.macro.priceIndex * W.costMult(S)) + '/mês');
            dis(`b-ls-${i}`, S.cash < W.moveCost(S, i));
            why(`b-ls-${i}`, need(S, { cash: W.moveCost(S, i) }));
          });
        }
      },
    },

    investimentos: {
      unlocked: S => Object.keys(G.ASSETS).filter(id => G.portfolio.unlocked(S, id)),
      shown(S) {
        return this.unlocked(S).filter(id => invFilter === 'Todos' || G.ASSETS[id].cls === invFilter);
      },
      key(S) {
        return [invFilter, this.unlocked(S).join(','), G.tax.exemptSales(S), !!S.research.aporte_auto, !!S.research.rebalanceamento, !!S.research.quant, !!S.research.cripto, !!S.research.tributacao, !!S.research.dividendos, !!S.research.fundamentalista].join('|');
      },
      build(S) {
        const classes = ['Todos', ...new Set(this.unlocked(S).map(id => G.ASSETS[id].cls))];
        if (!classes.includes(invFilter)) invFilter = 'Todos';
        let h = `<section class="card summary"><span>Total investido <b id="i-tot"></b></span>
          <span>Renda ~<b id="i-y"></b>/mês</span><span>Caixa livre <b id="i-cash"></b></span>
          <span>IR pago <b id="i-tax"></b></span>`;
        if (S.research.tributacao) {
          h += `<span>Vendas de ações no mês <b id="i-sales"></b> / ${f.money(G.tax.exemptSales(S))} isentos</span>
            <span>IR a apurar <b id="i-pend"></b></span>`;
          if (S.research.cripto) h += `<span>Vendas de cripto no mês <b id="i-csales"></b> / ${f.money(G.tax.CRYPTO_EXEMPT)} isentos</span>`;
        }
        if (S.research.dividendos) {
          h += '<label class="check"><input type="checkbox" data-act="reinvest" id="i-reinv"> Reinvestir dividendos e aluguéis</label>';
        }
        h += '</section>';
        if (S.research.aporte_auto) h += autoSection(S, this.unlocked(S));
        if (classes.length > 2) {
          h += '<div class="filters">' + classes.map(c =>
            `<button data-act="filter" data-id="${c}" class="${c === invFilter ? 'active' : ''}">${c}</button>`).join('') + '</div>';
        }
        for (const id of this.shown(S)) {
          const a = G.ASSETS[id], eq = a.kind === 'equity';
          h += `<section class="card asset">
            <div class="asset-head"><h3>${a.n}</h3><span class="tag">${a.cls}</span><span class="yield" id="a-y-${id}"></span></div>
            <p class="muted">${a.d}</p>
            <canvas class="spark zoom" id="a-c-${id}" data-act="chart" data-id="asset:${id}" title="Clique para ampliar"></canvas>
            <div class="asset-pos"><span class="muted">Cota <span id="a-p-${id}"></span> <span id="a-dc-${id}"></span></span> ·
              ${eq && id !== 'ibov' && S.research.fundamentalista ? `Valuation <b id="a-val-${id}"></b> · ` : ''}Posição <b id="a-v-${id}"></b> <span id="a-pl-${id}"></span> <span id="a-lock-${id}" class="muted"></span></div>
            <div class="asset-ops">
              <input id="a-in-${id}" inputmode="decimal" placeholder="valor em R$">
              <button data-act="buy" data-id="${id}" id="b-buy-${id}">${eq ? 'Comprar' : 'Aplicar'}</button>
              <button data-act="buymax" data-id="${id}" id="b-max-${id}">${eq ? 'Comprar' : 'Aplicar'} com todo o caixa</button>
              <button data-act="sell" data-id="${id}" id="b-sell-${id}">${eq ? 'Vender' : 'Resgatar'}</button>
              <button data-act="sellall" data-id="${id}" id="b-sellall-${id}">${eq ? 'Vender' : 'Resgatar'} tudo</button>
            </div>
            <div class="asset-ops"><span class="frac"><small>${eq ? 'Comprar' : 'Aplicar'} % do caixa:</small>${FRACS.map(x =>
              `<button data-act="buyfrac" data-id="${id}" data-f="${x}" id="b-bf${x * 100}-${id}">${x * 100}%</button>`).join('')}</span>
              <span class="frac"><small>${eq ? 'Vender' : 'Resgatar'} % da posição:</small>${FRACS.map(x =>
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
            ? `${a.divFreq === 12 ? 'Aluguéis' : 'Dividendos'} ${f.pct(y)} a.a.`
            : `${f.pct(y)} a.a.${a.kind === 'pre' ? ' (taxa de mercado)' : ''}`);
          set(`a-p-${id}`, f.money(S.market.prices[id] * (a.unit || 1)));
          const dc = $(`a-dc-${id}`);
          if (dc && h.length > 1) {
            const ch = h[h.length - 1] / h[h.length - 2] - 1;
            dc.textContent = `(${f.signedPct(ch)} hoje)`;
            dc.className = ch >= 0 ? 'good' : 'bad';
          }
          set(`a-v-${id}`, f.money(v));
          const val = $(`a-val-${id}`);
          if (val) {
            const dev = S.market.idio[id] || 0;
            val.textContent = dev > 0.15 ? 'caro' : dev < -0.15 ? 'barato' : 'justo';
            val.className = dev > 0.15 ? 'bad' : dev < -0.15 ? 'good' : '';
          }
          const pl = $(`a-pl-${id}`);
          if (pl) {
            pl.textContent = c > 0 ? `${f.money(v - c)} (${f.signedPct(v / c - 1)})` : '';
            pl.className = v >= c ? 'good' : 'bad';
          }
          set(`a-lock-${id}`, lk.value > 0.01 ? `· ${f.money(lk.value)} em carência (próxima liberação em ${lk.inDays} dias)` : '');
          const noCash = S.cash < 0.01, noPos = v - lk.value < 0.01;
          for (const bid of [`b-buy-${id}`, `b-max-${id}`, ...FRACS.map(x => `b-bf${x * 100}-${id}`)]) {
            dis(bid, noCash);
            why(bid, noCash ? 'sem caixa livre' : '');
          }
          for (const bid of [`b-sell-${id}`, `b-sellall-${id}`, ...FRACS.map(x => `b-sf${x * 100}-${id}`)]) {
            dis(bid, noPos);
            why(bid, noPos ? (lk.value > 0.01 ? 'tudo em carência' : 'sem posição') : '');
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
        let h = `<section class="card summary"><span>Conhecimento <b id="k-have"></b></span>
          <span>Ganho passivo <b id="k-rate"></b>/dia</span><span>Pesquisas <b>${done}/${G.RESEARCH.length}</b></span></section>`;
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
              <button data-act="research" data-id="${r.id}" id="b-r-${r.id}">Pesquisar <small>${r.k} conhecimento${r.cost ? ' + ' + f.money(r.cost) : ''}</small></button></div>`;
          }
          for (const r of teased) {
            const missing = r.req.filter(q => !S.research[q]).map(q => R.byId(q).n).join(', ');
            h += `<div class="research locked"><div><b>${r.n}</b><p class="muted">Requer: ${missing}</p></div></div>`;
          }
          for (const r of owned) h += `<div class="research done"><div><b>✓ ${r.n}</b> <span class="muted">${r.d}</span></div></div>`;
          if (hidden > 0) h += `<p class="muted">+ ${hidden} pesquisa(s) ainda oculta(s)</p>`;
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
          why(`b-r-${r.id}`, S.knowledge < r.k ? `faltam ${f.num(r.k - S.knowledge, 1)} de conhecimento` : need(S, { cash: r.cost || 0 }));
        }
      },
    },

    mercado: {
      key: S => ['macro1', 'macro2', 'curva', 'rv1', 'sentimento', 'pmi', 'focus', 'cripto', 'ciclo_cripto'].map(r => +!!S.research[r]).join(''),
      build(S) {
        const R = S.research;
        let h = `<section class="card"><h3>Juros</h3>
          <p>Selic: <b id="m-selic"></b> <span id="m-bias" class="muted"></span></p>
          <canvas class="spark tall zoom" id="m-selic-c" data-act="chart" data-id="selic" title="Clique para ampliar"></canvas>
          <p class="muted">Histórico das decisões do Copom (a cada 45 dias).</p>`;
        if (R.macro1) h += '<p>Próximo Copom em <b id="m-copom"></b>.</p>';
        if (R.focus) h += '<p>Boletim Focus: o mercado espera Selic de <b id="m-focus"></b> daqui a 12 meses.</p>';
        h += '</section>';
        if (R.macro1) {
          h += `<section class="card"><h3>Inflação</h3>
            <p>Inflação corrente: <b id="m-infl"></b> a.a. · Juro real: <b id="m-real"></b></p>
            <p class="muted">Custo de vida acumulado desde o início: <b id="m-pi"></b></p></section>`;
        }
        if (R.pmi) {
          h += `<section class="card"><h3>Indicadores</h3>
            <p>PMI da indústria: <b id="m-pmi"></b> <span class="muted">(acima de 50, a indústria cresce; costuma virar antes do ciclo)</span></p>
            <canvas class="spark tall zoom" id="m-pmi-c" data-act="chart" data-id="pmi" title="Clique para ampliar"></canvas>
            <p>Desemprego: <b id="m-unemp"></b> <span class="muted">(reage devagar; confirma o ciclo depois que ele já virou)</span></p></section>`;
        }
        if (R.macro2) {
          h += `<section class="card"><h3>Ciclo econômico</h3>
            <p>Leitura deste mês: <b id="m-cycle"></b></p>
            <p class="muted">Estimativa com ruído (${R.curva ? '~85%' : '~60%'} de acerto). Ciclo típico: Expansão → Pico → Recessão → Recuperação.</p></section>`;
        }
        if (R.curva) {
          h += `<section class="card"><h3>Curva de juros</h3>
            <p>Prefixado <b id="m-pre"></b> vs Selic <b id="m-selic2"></b> → <b id="m-curve"></b></p></section>`;
        }
        if (R.rv1) {
          h += `<section class="card"><h3>Bolsa</h3>
            <p>Ibovespa: <b id="m-ibov"></b> pts · <span id="m-ibov12"></span> em 12 meses</p>
            <canvas class="spark tall zoom" id="m-ibov-c" data-act="chart" data-id="asset:ibov" title="Clique para ampliar"></canvas>`;
          if (R.sentimento) {
            h += `<p>Medo e ganância: <b id="m-fg"></b> <span class="muted">(quando todos estão gananciosos, cuidado; quando têm medo, oportunidade)</span></p>
              <p>P/L do Ibovespa: <b id="m-pe"></b> <span class="muted">(média histórica ≈ 9; bolsa cara tende a render menos daqui para frente)</span></p>`;
          }
          h += '</section>';
        }
        if (R.cripto) {
          h += `<section class="card"><h3>Cripto</h3>
            <p>Bitcoin: <b id="m-btc"></b> · <span id="m-btc12"></span> em 12 meses · próximo halving: <b id="m-halving"></b></p>`;
          if (R.ciclo_cripto) h += '<p>Fase do ciclo: <b id="m-cphase"></b> <span class="muted">(pós-halving → euforia → estouro → inverno → acumulação)</span></p>';
          h += '</section>';
        }
        h += `<section class="card"><h3>Política</h3>
          <p>Governo: <b id="m-policy"></b> · Próxima eleição: <b id="m-elec"></b></p></section>`;
        return h;
      },
      update(S) {
        const m = S.macro, t = G.macro.target(S);
        set('m-selic', f.pct(m.selic));
        spark('m-selic-c', m.selicHist, { neutral: true });
        if (S.research.macro1) {
          const bias = t.selic - m.selic + (m.infl - t.infl) * 0.5;
          set('m-bias', bias > 0.002 ? '· viés de alta' : bias < -0.002 ? '· viés de baixa' : '· viés neutro');
          set('m-copom', `${Math.max(0, m.nextCopom - S.day)} dias`);
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
        if (S.research.macro2) set('m-cycle', m.perceived ? G.macro.REGIMES[m.perceived].n : 'aguardando dados do mês');
        if (S.research.curva) {
          const spread = S.market.pre - m.selic;
          set('m-pre', f.pct(S.market.pre));
          set('m-selic2', f.pct(m.selic));
          set('m-curve', spread > 0.01 ? 'inclinada: mercado espera alta de juros'
            : spread < -0.005 ? 'invertida: mercado espera cortes (recessão à vista?)' : 'plana');
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
          set('m-fg', `${Math.round(fg)} · ${fg < 25 ? 'medo extremo' : fg < 45 ? 'medo' : fg < 55 ? 'neutro' : fg < 75 ? 'ganância' : 'ganância extrema'}`);
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
        set('m-elec', `out/${G.cal.nextElection(S.day)}`);
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
        let h = `<section class="card summary"><span>Posição social <b>${SO.tierName(S)}</b></span>
          <span>Prestígio <b id="v-prest"></b></span><span>Visibilidade <b id="v-vis"></b></span>
          <span>Stress <b id="v-stress"></b></span><span id="v-next" class="muted"></span>
          <span id="v-nr" class="bad" hidden>Visibilidade muito acima do prestígio: fama de novo-rico atrai crítica e golpistas.</span></section>`;

        // Hábitos
        h += `<section class="card"><h3>Hábitos <small id="v-slots"></small></h3>
          <p class="muted">Um hábito leva ${SO.formDays(S)} dias para se formar e custa energia todo dia nesse período; depois fica quase de graça.
          Stress acima de 70 pode quebrar hábitos já formados.</p><table class="tbl">`;
        for (const id of Object.keys(so.habits)) {
          const d = SO.HABITS[id];
          h += `<tr><td><b class="${d.good ? '' : 'bad'}">${d.n}</b><br><small class="muted">${d.d}</small></td>
            <td id="v-h-${id}"></td><td><button data-act="habit-drop" data-id="${id}" id="b-hd-${id}">${d.good ? 'Abandonar' : 'Largar'}</button></td></tr>`;
        }
        h += '</table><div class="btns">';
        for (const [id, d] of Object.entries(SO.HABITS)) {
          if (!d.good || so.habits[id]) continue;
          h += `<button data-act="habit-start" data-id="${id}" id="b-hs-${id}" title="${esc(d.d)}">${d.n}
            <small>${d.cost} energia/dia para formar · ${esc(d.d)}</small></button>`;
        }
        h += '</div></section>';

        // Vida social
        h += '<section class="card"><h3>Vida social</h3><div class="btns">';
        for (const a of SO.ACTIVITIES) {
          if ((a.tier || 0) > t + 1 || (a.req && !S.research[a.req])) continue;
          const locked = (a.tier || 0) > t;
          const gains = [a.vis && `+${a.vis} visib.`, a.prest && `+${a.prest} prestígio`, a.know && `+${a.know} conhec.`, a.fee && 'cachê'].filter(Boolean).join(', ');
          h += `<button data-act="social" data-id="${a.id}" id="b-sa-${a.id}">${a.n}
            <small>${locked ? `requer ${SO.TIERS[a.tier][1]}` : `${a.energy} energia${a.cost ? ' · <span id="v-ac-' + a.id + '"></span>' : ''} · ${gains}`}</small></button>`;
        }
        h += '</div></section>';

        // Clubes
        if (S.research.etiqueta) {
          h += '<section class="card"><h3>Clubes</h3><table class="tbl">';
          for (const c of SO.CLUBS) {
            const member = so.clubs[c.id];
            h += `<tr><td><b>${c.n}</b><br><small class="muted">${c.d}</small></td><td id="v-cf-${c.id}"></td>
              <td>${member ? `<button data-act="club-leave" data-id="${c.id}">Sair</button>`
                : c.tier > t ? `<small class="muted">requer ${SO.TIERS[c.tier][1]}</small>`
                : `<button data-act="club-join" data-id="${c.id}" id="b-cj-${c.id}">Entrar <small id="v-cj-${c.id}"></small></button>`}</td></tr>`;
          }
          h += '</table></section>';
        }

        // Consumo e filantropia
        h += '<section class="card"><h3>Consumo</h3><p class="muted">Visibilidade na hora, mas ela some rápido (cai 10% ao mês).</p><div class="btns">';
        for (const l of SO.LUXURY) {
          if ((l.tier || 0) > t) continue;
          h += `<button data-act="luxury" data-id="${l.id}" id="b-lx-${l.id}">${l.n} <small><span id="v-lx-${l.id}"></span> · +${l.vis} visib.${l.stress ? ', −stress' : ''}</small></button>`;
        }
        h += `</div></section><section class="card"><h3>Filantropia</h3>
          <p class="muted">Doar gera prestígio durável. Total doado: <b id="v-don"></b></p>
          <p><input id="v-don-in" inputmode="decimal" placeholder="valor em R$"> <button data-act="donate">Doar</button></p></section>`;

        // Família
        const f = so.family;
        h += `<section class="card"><h3>Família</h3><p>${f.married ? 'Casado(a)' : 'Solteiro(a)'} · ${f.kids} filho(s)
          ${f.married && f.spouseIncome ? ' · renda do cônjuge <b id="v-sp"></b>/mês' : ''}</p>
          <p class="muted">Casar aumenta o custo de vida em 40% e reduz o stress; cada filho, +25%. Sem filhos, não há herdeiro para o seu legado.</p><div class="btns">`;
        if (!f.married) {
          h += `<button data-act="marry" data-id="0" id="b-m0">Casar <small id="v-m0"></small></button>
            <button data-act="marry" data-id="1" id="b-m1">Casamento de revista <small id="v-m1"></small></button>`;
        } else h += `<button data-act="kid" id="b-kid">Ter um filho <small id="v-kid"></small></button>`;
        if (f.kids) h += `<button data-act="school">${f.school ? 'Tirar da escola particular' : 'Escola particular'} <small id="v-sch"></small></button>`;
        h += '</div></section>';
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
        set('v-next', nx ? `faltam ${f.num(nx[0] - SO.score(S), 1)} pontos para ${nx[1]}` : '');
        show('v-nr', SO.nouveauRiche(S));
        set('v-slots', `${SO.used(S)}/${SO.slots(S)} vagas`);
        for (const [id, h] of Object.entries(so.habits)) {
          set(`v-h-${id}`, h.state === 'forming' ? `formando: ${h.days}/${SO.formDays(S)} dias`
            : h.state === 'quitting' ? `largando: ${h.days}/${SO.QUIT_DAYS} dias` : 'formado');
          dis(`b-hd-${id}`, h.state === 'quitting');
        }
        for (const id of Object.keys(SO.HABITS)) dis(`b-hs-${id}`, SO.used(S) >= SO.slots(S));
        for (const a of SO.ACTIVITIES) {
          dis(`b-sa-${a.id}`, !SO.canDo(S, a));
          why(`b-sa-${a.id}`, SO.canDo(S, a) ? '' : (a.tier || 0) > t ? `requer posição ${SO.TIERS[a.tier][1]}`
            : a.season && G.cal.season(S.day).id !== a.season ? 'só no outono'
            : a.cooldown && S.day < (so.cooldowns[a.id] || 0) ? `de novo em ${so.cooldowns[a.id] - S.day} dias`
            : need(S, { energy: a.energy, cash: a.cost * pi }));
          if (a.cost) set(`v-ac-${a.id}`, f.money(a.cost * pi));
        }
        for (const c of SO.CLUBS) {
          set(`v-cf-${c.id}`, f.money(c.fee * pi) + '/mês');
          set(`v-cj-${c.id}`, `joia ${f.money(6 * c.fee * pi)}`);
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
        set('v-kid', f.money(20000 * pi) + ' + custo de vida');
        set('v-sch', f.money(4000 * pi) + '/mês por filho · prestígio');
        dis('b-m0', S.cash < 60000 * pi);
        dis('b-m1', S.cash < 800000 * pi);
        dis('b-kid', S.cash < 20000 * pi);
        why('b-m0', need(S, { cash: 60000 * pi }));
        why('b-m1', need(S, { cash: 800000 * pi }));
        why('b-kid', need(S, { cash: 20000 * pi }));
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
        let h = `<section class="card summary"><span>Bem-estar <b id="lz-well"></b></span><span>Média da vida <b id="lz-avg"></b></span>
          <span>Stress <b id="lz-stress"></b></span><span id="lz-away" class="good"></span></section>
          <p class="muted">Bem-estar vem de família, saúde, hobbies, férias e pouco stress. A média da vida também vira pontos de legado.</p>`;

        // Férias
        h += `<section class="card"><h3>Férias <small id="lz-vac"></small></h3>
          <p class="muted">Uma viagem por ano. Durante as férias você não trabalha nem estuda (a energia fica cheia) e empresas sem gerente ficam largadas.
          Um ano inteiro sem férias termina com +10 de stress.</p><div class="btns">`;
        for (const d of LF.DESTINATIONS) {
          h += `<button data-act="vacation" data-id="${d.id}" id="b-vc-${d.id}">${lf.bucket[d.id] ? '✓ ' : ''}${d.n}
            <small><span id="lz-vc-${d.id}"></span> · ${d.days} dias · ${d.stress} de stress${d.vis ? ` · +${d.vis} visib.` : ''}</small></button>`;
        }
        h += `</div><p class="muted">Lista de desejos: ${Object.keys(lf.bucket).length}/${LF.DESTINATIONS.length} destinos visitados.</p></section>`;

        // Hobbies
        h += `<section class="card"><h3>Hobbies <small>${Object.keys(lf.hobbies).length}/${LF.hobbySlots(S)} vagas</small></h3>
          <p class="muted">Custam energia todo dia e uma mensalidade. Sem energia, o efeito do mês cai na proporção dos dias perdidos.</p><table class="tbl">`;
        for (const [id, x] of Object.entries(LF.HOBBIES)) {
          const on = !!lf.hobbies[id];
          h += `<tr><td><b>${x.n}</b><br><small class="muted">${x.d}</small></td><td><small>${x.energy} energia/dia · <span id="lz-hc-${id}"></span>/mês</small></td>
            <td>${on ? `<button data-act="hobby-stop" data-id="${id}">Parar</button>` : `<button data-act="hobby-start" data-id="${id}" id="b-hb-${id}">Começar</button>`}</td></tr>`;
        }
        h += '</table></section>';

        // Saúde e pet
        h += '<section class="card"><h3>Saúde</h3><p class="muted">Plano de saúde reduz o custo de imprevistos médicos. O premium inclui check-ups: +2 anos de vida e o aviso do médico chega antes.</p><div class="btns">';
        for (const [id, x] of Object.entries(LF.PLANS)) {
          h += `<button data-act="plan" data-id="${id}" class="${lf.health === id ? 'active' : ''}">${lf.health === id ? '✓ ' : ''}${x.n}
            <small>${x.cost ? `<span id="lz-pl-${id}"></span>/mês · ` : ''}imprevistos ×${String(x.med).replace('.', ',')}</small></button>`;
        }
        h += `</div><p class="muted">Depois dos 45, a energia máxima cai 1 por ano (metade com exercício ou corrida): hoje <b id="lz-age"></b>.</p></section>`;
        h += '<section class="card"><h3>Pet</h3>';
        h += lf.pet
          ? `<p>${esc(lf.pet.name)}, seu cachorro, está com você há <span id="lz-pet"></span>. −3 de stress por mês, +bem-estar, 1 de energia/dia e <span id="lz-petc"></span>/mês.</p>`
          : '<p class="muted">Um cachorro reduz o stress e aumenta o bem-estar. Vive de 10 a 15 anos.</p><button data-act="adopt" id="b-adopt">Adotar <small id="lz-adopt"></small></button>';
        h += '</section>';

        // Segunda casa
        h += `<section class="card"><h3>Segunda casa</h3><p class="muted">−3 de stress por mês e +bem-estar; manutenção de 0,1% do valor ao mês.
          Com a casa de praia, as férias na praia saem de graça. Segue o índice imobiliário e entra no patrimônio.</p><table class="tbl">`;
        for (const x of LF.SECOND) {
          const i = lf.second.findIndex(y => y.id === x.id), own = lf.second[i];
          h += `<tr><td><b>${x.n}</b></td><td id="lz-2v-${x.id}"></td><td>${own ? (own.selling ? '<small class="muted">à venda</small>'
            : `<button data-act="second-sell" data-i="${i}">Vender</button>`) : `<button data-act="second-buy" data-id="${x.id}" id="b-2b-${x.id}">Comprar <small id="lz-2c-${x.id}"></small></button>`}</td></tr>`;
        }
        h += '</table></section>';

        // Coleções
        h += `<section class="card"><h3>Coleções</h3><p class="muted">Peças valorizam (ou não) com o tempo e dão visibilidade e prestígio na compra. Vender é por leilão:
          de 1 a 4 meses, 10% de comissão e 15% de IR sobre o ganho.</p><table class="tbl">`;
        for (const [kind, c] of Object.entries(LF.COLLECTIONS)) {
          h += `<tr><td><b>${c.n}</b><br><small id="lz-cx-${kind}"></small></td><td class="ops">${LF.LOTS.map((l, i) =>
            `<button data-act="col-buy" data-id="${kind}" data-i="${i}" id="b-cb-${kind}-${i}">${c.lots[i]} <small id="lz-cc-${kind}-${i}"></small></button>`).join('')}</td></tr>`;
        }
        h += '</table>';
        if (lf.collections.length) {
          h += '<table class="tbl">';
          lf.collections.forEach((x, i) => {
            h += `<tr><td>${LF.COLLECTIONS[x.kind].lots[x.lot]}</td><td><b id="lz-cv-${i}"></b> <small id="lz-cp-${i}"></small></td>
              <td>${x.selling ? `<small class="muted" id="lz-cs-${i}"></small>` : `<button data-act="col-sell" data-i="${i}">Leiloar</button>`}</td></tr>`;
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
        set('lz-away', lf.away > 0 ? `De férias: mais ${lf.away} dia(s)` : '');
        const year = G.cal.of(S.day).year;
        set('lz-vac', lf.vacYear === year ? `feitas este ano${lf.lastDest ? ': ' + lf.lastDest : ''}` : 'ainda não tirou este ano');
        for (const d of LF.DESTINATIONS) {
          const c = LF.vacationCost(S, d);
          set(`lz-vc-${d.id}`, c ? f.money(c) : 'grátis');
          dis(`b-vc-${d.id}`, !LF.canVacation(S, d));
          why(`b-vc-${d.id}`, lf.vacYear === year ? 'você já tirou férias este ano' : LF.away(S) ? 'você já está de férias' : need(S, { cash: c }));
        }
        const full = Object.keys(lf.hobbies).length >= LF.hobbySlots(S);
        for (const [id, x] of Object.entries(LF.HOBBIES)) {
          set(`lz-hc-${id}`, f.money(x.cost * pi));
          dis(`b-hb-${id}`, full);
          why(`b-hb-${id}`, full ? 'sem vaga para outro hobby' : '');
        }
        for (const [id, x] of Object.entries(LF.PLANS)) if (x.cost) set(`lz-pl-${id}`, f.money(x.cost * pi));
        set('lz-age', LF.ageDrain(S) ? `−${LF.ageDrain(S)}` : 'sem perda');
        if (lf.pet) {
          const y = (S.day - lf.pet.born) / 360;
          set('lz-pet', y < 1 ? `${Math.floor(S.day - lf.pet.born)} dias` : `${f.num(y, 1)} anos`);
          set('lz-petc', f.money(400 * pi));
        } else {
          set('lz-adopt', f.money(2000 * pi));
          dis('b-adopt', S.cash < 2000 * pi);
          why('b-adopt', need(S, { cash: 2000 * pi }));
        }
        for (const x of LF.SECOND) {
          const own = lf.second.find(y => y.id === x.id), p = LF.secondPrice(S, x);
          set(`lz-2v-${x.id}`, own ? `${f.money(LF.value(S, own))}${own.selling ? ` · ~${own.selling} dias` : ''}` : f.money(p));
          set(`lz-2c-${x.id}`, f.money(p * 1.03));
          dis(`b-2b-${x.id}`, S.cash < p * 1.03);
          why(`b-2b-${x.id}`, need(S, { cash: p * 1.03 }));
        }
        for (const [kind, c] of Object.entries(LF.COLLECTIONS)) {
          const h = S.market.hist[c.asset], r12 = h[h.length - 1] / h[Math.max(0, h.length - 361)] - 1;
          set(`lz-cx-${kind}`, `mercado ${f.signedPct(r12, 1)} em 12 meses`);
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
            pl.textContent = `${f.signedPct(v / x.cost - 1, 1)} desde a compra`;
            pl.className = v >= x.cost ? 'good' : 'bad';
          }
          set(`lz-cs-${i}`, x.selling ? `em leilão: ~${x.selling} dias` : '');
        });
      },
    },

    poder: {
      key(S) {
        const pol = S.pol;
        return [G.social.tierIdx(S), S.macro.policy, !!pol.poll, Object.keys(pol.backed).join(','), pol.bills.map(b => b.id).join(','),
          Object.keys(pol.passed).join(','), Object.keys(pol.media).join(','), pol.thinkTank ? pol.thinkTank.side : '', Object.keys(pol.entities).join(','),
          pol.office ? pol.office.id : '', ['relacoes_institucionais', 'midia', 'filantropia_estrategica', 'economia_politica'].map(r => +!!S.research[r]).join('')].join('|');
      },
      build(S) {
        const PL = G.politics, pol = S.pol, P = G.macro.POLICIES, t = G.social.tierIdx(S);
        const opts = (sel) => Object.entries(P).map(([k, p]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${p.n}</option>`).join('');
        let h = `<section class="card summary"><span>Influência <b id="p-inf"></b></span><span>Imagem pública <b id="p-img"></b></span>
          <span>Governo <b>${P[S.macro.policy].n}</b>${pol.access ? ' <small class="good">(você tem acesso)</small>' : ''}</span>
          <span>Risco de escândalo <b id="p-risk"></b></span>
          ${pol.office ? `<span>Cargo <b>${PL.office(pol.office.id).n}</b> <small id="p-office"></small></span>` : ''}</section>`;

        // Eleições
        h += `<section class="card"><h3>Eleições <small>próxima: out/${G.cal.nextElection(S.day)}</small></h3>
          <p class="muted">Doações aumentam a chance de uma plataforma vencer. Quem apoia o vencedor ganha influência e acesso ao governo;
          quem apoia perdedores fica malvisto. A doação oficial tem limite (10% da sua renda anual); acima disso, só por caixa 2,
          que alimenta o risco de escândalo.</p><table class="tbl">
          <tr><td><b>Plataforma</b></td><td><b>${pol.poll ? 'Pesquisa' : 'Chance estimada'}</b></td><td><b>Suas doações</b></td></tr>`;
        for (const [k, p] of Object.entries(P)) {
          h += `<tr><td><b>${p.n}</b><br><small class="muted">${p.d}</small></td><td id="p-w-${k}"></td><td id="p-d-${k}"></td></tr>`;
        }
        h += `</table><p>Doar <input id="p-don-in" inputmode="decimal" placeholder="valor em R$"> para <select id="p-don-side">${opts('moderado')}</select>
          <button data-act="pol-donate" data-id="legal">Doação oficial</button> <button data-act="pol-donate" data-id="dirty">Caixa 2</button>
          <span class="muted">limite oficial restante: <span id="p-limit"></span></span></p></section>`;

        // Lobby
        if (S.research.relacoes_institucionais) {
          h += `<section class="card"><h3>Lobby</h3><p class="muted">Gaste influência para empurrar projetos de lei. A tramitação leva meses; imagem ruim atrapalha
            e vazamentos acontecem. Um governo redistributivo revoga as isenções.</p><table class="tbl">`;
          for (const b of PL.BILLS) {
            const run = pol.bills.find(x => x.id === b.id), done = pol.passed[b.id];
            h += `<tr><td><b>${b.n}</b><br><small class="muted">${b.d}</small></td><td>`;
            if (done) h += `<span class="good">aprovado${done.sector ? ` (${G.ASSETS[done.sector].short})` : ''}</span>`;
            else if (run) h += `<span class="muted">em tramitação: ${run.left} meses</span>`;
            else {
              h += b.sector ? `<select id="p-sec">${G.events.SECTORS.map(id => `<option value="${id}">${G.ASSETS[id].short}</option>`).join('')}</select> ` : '';
              h += `<button data-act="lobby" data-id="${b.id}" id="b-lb-${b.id}">Fazer lobby <small id="p-lc-${b.id}"></small></button>`;
            }
            h += '</td></tr>';
          }
          h += '</table></section>';
        }

        // Mídia e think tank
        if (S.research.midia || S.research.filantropia_estrategica) {
          h += '<section class="card"><h3>Mídia e ideias</h3>';
          if (S.research.midia) {
            h += '<table class="tbl">';
            for (const m of PL.MEDIA) {
              h += `<tr><td><b>${m.n}</b><br><small class="muted">+${m.inf} influência e +${m.img} imagem por mês; manutenção de 0,3% do valor ao mês.</small></td>
                <td>${pol.media[m.id] ? '<span class="good">seu</span>' : `<button data-act="media" data-id="${m.id}" id="b-md-${m.id}">Comprar <small id="p-mc-${m.id}"></small></button>`}</td></tr>`;
            }
            h += '</table>';
          }
          if (S.research.filantropia_estrategica) {
            h += pol.thinkTank
              ? `<p>Seu think tank defende a plataforma <b>${P[pol.thinkTank.side].n}</b> há ${pol.thinkTank.years} ano(s): +2 de influência por mês e mais chance para ela nas eleições.
                 <button data-act="tt-stop">Fechar</button></p>`
              : `<p>Fundar um think tank (R$ 250 mil/mês) para defender <select id="p-tt-side">${opts('austero')}</select> <button data-act="tt-start">Fundar</button></p>`;
          }
          h += '</section>';
        }

        // Entidades e cargos
        h += '<section class="card"><h3>Entidades e cargos</h3><table class="tbl">';
        for (const e of PL.ENTITIES) {
          h += `<tr><td><b>${e.n}</b><br><small class="muted">${e.d}</small></td><td>${G.fmt.money(e.fee * S.macro.priceIndex)}/mês</td><td>${
            pol.entities[e.id] ? `<button data-act="ent-leave" data-id="${e.id}">Sair</button>`
            : t < e.tier ? `<small class="muted">requer ${G.social.TIERS[e.tier][1]}</small>` : `<button data-act="ent-join" data-id="${e.id}">Entrar</button>`}</td></tr>`;
        }
        for (const o of PL.OFFICES) {
          if (o.req && !S.research[o.req]) continue;
          h += `<tr><td><b>${o.n}</b><br><small class="muted">${o.d} Requer ${o.inf} de influência e posição ${G.social.TIERS[o.tier][1]}.</small></td><td></td><td>`;
          if (pol.office && pol.office.id === o.id) h += '<span class="good">no cargo</span>';
          else if (o.id === 'bc') {
            h += `<select id="p-bc"><option value="dovish">Juros baixos (inflação sobe)</option><option value="neutro">Neutro</option>
              <option value="hawkish">Juros altos (inflação cai)</option></select> <button data-act="office" data-id="bc" id="b-of-bc">Assumir</button>`;
          } else h += `<button data-act="office" data-id="${o.id}" id="b-of-${o.id}">Assumir</button>`;
          h += '</td></tr>';
        }
        h += '</table></section>';
        return h;
      },
      update(S) {
        const PL = G.politics, pol = S.pol;
        set('p-inf', f.num(pol.influence, 0));
        const img = $('p-img');
        img.textContent = f.num(pol.image, 0);
        img.className = pol.image < -20 ? 'bad' : pol.image > 20 ? 'good' : '';
        const r = PL.scandalChance(S);
        set('p-risk', r < 0.005 ? 'baixo' : r < 0.03 ? 'médio' : 'alto');
        if (pol.office) set('p-office', `até ${f.monthYear(pol.office.until)}`);
        const w = pol.poll || PL.weights(S);
        for (const k in G.macro.POLICIES) {
          set(`p-w-${k}`, f.pct(w[k], 0));
          const b = pol.backed[k];
          set(`p-d-${k}`, b ? f.money(b.legal) + (b.dirty ? ` + ${f.money(b.dirty)} por fora` : '') : '');
        }
        set('p-limit', f.money(PL.legalLimit(S)));
        for (const b of PL.BILLS) {
          set(`p-lc-${b.id}`, `${f.num(PL.lobbyCost(S, b), 0)} influência`);
          dis(`b-lb-${b.id}`, pol.influence < PL.lobbyCost(S, b));
          why(`b-lb-${b.id}`, pol.influence < PL.lobbyCost(S, b) ? `faltam ${f.num(PL.lobbyCost(S, b) - pol.influence, 0)} de influência` : '');
        }
        for (const m of PL.MEDIA) {
          set(`p-mc-${m.id}`, f.money(m.cost * S.macro.priceIndex));
          dis(`b-md-${m.id}`, S.cash < m.cost * S.macro.priceIndex);
          why(`b-md-${m.id}`, need(S, { cash: m.cost * S.macro.priceIndex }));
        }
        for (const o of PL.OFFICES) {
          dis(`b-of-${o.id}`, !PL.canTakeOffice(S, o));
          why(`b-of-${o.id}`, PL.canTakeOffice(S, o) ? '' : pol.office ? 'você já ocupa um cargo'
            : pol.influence < o.inf ? `faltam ${f.num(o.inf - pol.influence, 0)} de influência`
            : G.social.tierIdx(S) < o.tier ? `requer posição ${G.social.TIERS[o.tier][1]}`
            : o.access && !pol.access ? 'precisa ter apoiado o governo eleito' : '');
        }
      },
    },

    legado: {
      key(S) {
        const L = S.legacy;
        return [L.generation, Object.keys(L.ach).length, JSON.stringify(L.up), S.social.family.kids > 0, G.legacy.age(S) >= G.legacy.HEIR_AGE].join('|');
      },
      build(S) {
        const LG = G.legacy, L = S.legacy;
        let h = `<section class="card summary"><span>Geração <b>${L.generation}</b></span><span>Idade <b id="l-age"></b></span>
          <span>Saúde <b id="l-health"></b></span><span>Pontos de legado <b id="l-lp"></b></span></section>
          <section class="card"><h3>Sucessão</h3>
          <p>Se passasse o bastão hoje: <b id="l-gain"></b> pontos de legado
          <span class="muted">(raiz do patrimônio real + prestígio + bem-estar da vida; sem filhos, a fortuna vai para uma fundação e metade se perde)</span>.</p>
          <p>Bem-estar médio desta vida: <b id="l-well"></b> <span class="muted">(acima de 40, cada ponto rende legado; hoje vale <span id="l-wellpts"></span> pontos)</span></p>
          <p>Seu herdeiro receberia <b id="l-heir"></b> <span class="muted">(${G.fmt.pct(LG.heirShare(S), 0)} do patrimônio, menos 8% de ITCMD)</span>
          e recomeçaria como estagiário, no mesmo mundo e no mesmo ano.</p>`;
        if (S.social.family.kids === 0) h += '<p class="bad">Você ainda não tem filhos (aba Vida → Família).</p>';
        h += LG.age(S) >= LG.HEIR_AGE
          ? '<button data-act="succeed">Aposentar e passar o bastão</button>'
          : `<p class="muted">Dá para passar o bastão a partir dos ${LG.HEIR_AGE} anos. Se a saúde acabar antes, a sucessão acontece sozinha.</p>`;
        h += '</section><section class="card"><h3>Melhorias permanentes</h3><table class="tbl">';
        for (const u of LG.UPGRADES) {
          const lvl = LG.level(S, u.id), cost = LG.upgradeCost(S, u);
          h += `<tr><td><b>${u.n}</b> <small>nível ${lvl}/${u.costs.length}</small><br><small class="muted">${u.d(lvl)}</small></td>
            <td>${cost === undefined ? '<span class="good">máximo</span>' : `<button data-act="legacy-up" data-id="${u.id}" id="b-lu-${u.id}">Comprar <small>${cost} pontos</small></button>`}</td></tr>`;
        }
        h += `</table></section><section class="card"><h3>Estatísticas desta vida</h3><table class="tbl stats">
          <tr><td>Anos vividos no jogo</td><td id="st-years"></td><td>Maior patrimônio</td><td id="st-peak"></td></tr>
          <tr><td>Salários e horas extras</td><td id="st-work"></td><td>Dividendos</td><td id="st-div"></td></tr>
          <tr><td>Aluguéis de imóveis</td><td id="st-rent"></td><td>Lucro das empresas</td><td id="st-biz"></td></tr>
          <tr><td>Lucro da gestora</td><td id="st-fund"></td><td>Retorno de startups</td><td id="st-angel"></td></tr>
          <tr><td>IR pago</td><td id="st-tax"></td><td>Doado</td><td id="st-don"></td></tr></table>
          <p class="muted">Valores nominais somados ao longo da vida. <button class="link" data-act="hints-on">Religar dicas do tutorial</button></p>
          <p><label class="check"><input type="checkbox" data-act="retro-toggle" id="l-retro"> Mostrar a retrospectiva de cada ano (em janeiro)</label></p></section>
          <section class="card"><h3>Conquistas <small>${Object.keys(L.ach).length}/${LG.ACHIEVEMENTS.length} · +3 pontos cada</small></h3><table class="tbl">`;
        for (const a of LG.ACHIEVEMENTS) {
          const got = L.ach[a.id] !== undefined;
          h += `<tr><td>${got ? `<b class="good">✓ ${a.n}</b>` : `<span class="muted">${a.n}</span>`}</td><td class="muted">${a.d}</td></tr>`;
        }
        h += '</table></section>';
        if (L.history.length) {
          h += '<section class="card"><h3>Dinastia</h3><table class="tbl"><tr><td><b>Geração</b></td><td><b>Anos</b></td><td><b>Patrimônio final (R$ de 2026)</b></td><td><b>Pontos</b></td></tr>';
          for (const g of L.history) {
            h += `<tr><td>${g.gen}ª</td><td>${g.from}–${g.to} (${g.reason === 'morte' ? `morreu aos ${g.age}` : `aposentou aos ${g.age}`})</td><td>${f.money(g.nw)}</td><td>+${g.lp}</td></tr>`;
          }
          h += '</table></section>';
        }
        return h;
      },
      update(S) {
        const LG = G.legacy;
        set('l-age', `${Math.floor(LG.age(S))} anos`);
        set('l-health', LG.health(S));
        set('l-lp', f.num(S.legacy.lp));
        set('l-gain', f.num(LG.points(S)));
        set('l-well', S.life.wellN ? f.num(G.life.avgWell(S), 0) : '—');
        set('l-wellpts', f.num(G.life.wellPoints(S)));
        $('l-retro').checked = S.settings.retro !== false;
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
        set('l-heir', f.money(S.social.family.kids ? Math.max(0, G.portfolio.netWorth(S)) * LG.heirShare(S) * 0.92 : 0));
        for (const u of LG.UPGRADES) {
          const cost = LG.upgradeCost(S, u);
          dis(`b-lu-${u.id}`, cost === undefined || S.legacy.lp < cost);
          why(`b-lu-${u.id}`, cost !== undefined && S.legacy.lp < cost ? `faltam ${cost - S.legacy.lp} pontos de legado` : '');
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
          h += `<section class="card summary"><span>Lucro das empresas <b id="bz-profit"></b>/mês</span>
            <span>Valor das empresas <b id="bz-value"></b></span><span>Dívida <b id="bz-debt"></b> · parcelas <b id="bz-pmt"></b>/mês</span>
            <span>Consumo de energia <b id="bz-drain"></b>/dia</span></section>
            <section class="card"><h3>Empresas</h3>
            <p class="muted">Cada unidade sem gerente consome energia todo dia; sem energia, o negócio fica largado e lucra menos.
            Lucro paga 15% de imposto. Vender uma unidade rende 90% do preço de uma nova hoje: 75% no fundo da recessão, até 115% no pico.
            <b>Financiar</b>: 30% de entrada e 70% em 10 anos a <span id="bz-rate"></span> (pós-fixado: a parcela sobe com a Selic).
            <span id="bz-bndes"></span></p><table class="tbl">`;
          for (const b of G.BUSINESSES) {
            if ((b.tier || 0) > G.social.tierIdx(S) + 1) continue;
            h += `<tr><td><b>${b.n}</b>${b.tier ? ` <small class="muted">requer ${G.social.TIERS[b.tier][1]}</small>` : ''}<br><small class="muted">energia ${b.energy}/dia sem gerente${b.beta >= 1 ? ' · sofre na recessão' : b.beta <= 0.5 ? ' · defensivo' : ''}</small></td>
              <td>unidades <b id="bz-n-${b.id}"></b><br><small class="muted" id="bz-m-${b.id}"></small></td>
              <td><span id="bz-u-${b.id}"></span>/mês cada</td>
              <td class="ops"><button data-act="biz-open" data-id="${b.id}" id="b-bo-${b.id}">Abrir <small id="bz-p-${b.id}"></small></button>
              <button data-act="biz-fin" data-id="${b.id}" id="b-bf-${b.id}">Financiar <small id="bz-f-${b.id}"></small></button>
              ${S.research.gestao_pessoas ? `<button data-act="biz-hire" data-id="${b.id}" id="b-bh-${b.id}">Contratar gerente</button>` : ''}
              <button data-act="biz-sell" data-id="${b.id}" id="b-bs-${b.id}">Vender uma <small id="bz-s-${b.id}"></small></button></td></tr>`;
          }
          h += '</table></section>';
        }
        if (S.research.gestora) {
          h += '<section class="card"><h3>Gestora</h3>';
          if (!S.fund) {
            h += `<p class="muted">O fundo replica sua estratégia automática (ou sua carteira atual, se não houver alvos).
              Amigos, família e ex-colegas trazem o capital inicial conforme sua reputação.</p>
              <button data-act="fund-open" id="b-fd-open">Abrir a gestora</button> <small class="muted" id="fd-block"></small>`;
          } else {
            h += `<p>Patrimônio sob gestão: <b id="fd-aum"></b> · cota em 12 meses <b id="fd-r12"></b> vs CDI <b id="fd-cdi"></b></p>
              <p>Lucro da gestora no mês: <b id="fd-profit"></b> · captação líquida: <b id="fd-flow"></b></p>
              <p class="muted">2% ao ano de administração + 20% do que passar do CDI. Bater o CDI traz dinheiro novo; perder dele por 12 meses traz resgates.</p>
              <p>Valor da gestora: <b id="fd-value"></b> <span class="muted">(~3% do patrimônio sob gestão; preço cheio com 2 anos de histórico)</span></p>
              <button data-act="fund-sell">Vender a gestora <small id="fd-sale"></small></button>`;
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
          set('bz-rate', `Selic + ${f.pct(B.spread(S), 0)} (hoje ${f.pct(B.loanRate(S), 1)} a.a.)`);
          set('bz-bndes', B.bndes(S) ? 'Você tem acesso à linha do BNDES.'
            : `Com ${B.BNDES_INFLUENCE} de influência (aba Poder), o BNDES empresta a Selic + 2%.`);
          const d = B.drain(S);
          const dr = $('bz-drain');
          dr.textContent = f.num(d);
          dr.className = d > G.work.LIFESTYLE[S.lifestyle].regen ? 'bad' : '';
          for (const b of G.BUSINESSES) {
            const n = B.count(S, b.id), m = B.managers(S, b.id), p = B.price(S, b);
            set(`bz-n-${b.id}`, String(n));
            set(`bz-m-${b.id}`, n ? `${m} com gerente` : '');
            set(`bz-u-${b.id}`, f.money(B.unitProfit(S, b)));
            set(`bz-p-${b.id}`, f.money(p));
            dis(`b-bo-${b.id}`, S.cash < p || !B.allowed(S, b));
            const tierMsg = (b.tier || 0) > G.social.tierIdx(S) ? `requer posição ${G.social.TIERS[b.tier][1]}` : !B.allowed(S, b) ? 'só existe uma' : '';
            why(`b-bo-${b.id}`, tierMsg || need(S, { cash: p }));
            const q = B.quote(S, b);
            set(`bz-f-${b.id}`, `entrada ${f.money(q.down)} · ${f.money(q.pmt)}/mês`);
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
          set('fd-block', blocked ? `não concorrência até ${f.monthYear(S.fundBlockedUntil)}` : '');
        }
      },
    },

    terras: {
      key: S => [S.agro.lands.map(h => h.id + h.crop + (h.mgr ? 'g' : '') + (h.insured ? 's' : '') + (h.selling ? 'v' : '')).join(','),
        !!S.research.gestao_pessoas].join('|'),
      build(S) {
        const A = G.agro;
        let h = `<section class="card summary"><span>Preço da terra <b id="t-idx"></b> em 12 meses</span>
          <span>Suas terras <b id="t-eq"></b></span><span>Renda do agro até agora <b id="t-inc"></b></span>
          <span>Clima do ano <b id="t-clim"></b></span><span>Commodities <b id="t-cf"></b> da média do ano</span></section>
          <section class="card"><h3>Comprar terra</h3>
          <p class="muted">Terra se valoriza com a inflação e um pouco mais. Na compra, 3% de ITBI; vender leva de 2 a 8 meses e paga 6% de corretagem.
          ${Object.entries(A.CROPS).map(([, c]) => `<b>${c.n}</b>: ${c.d}`).join(' ')}</p><table class="tbl">`;
        for (const l of A.LANDS) {
          h += `<tr><td><b>${l.n}</b><br><small class="muted">usos: ${l.crops.map(c => A.CROPS[c].n.toLowerCase()).join(', ')}</small></td>
            <td id="t-p-${l.id}"></td><td><button data-act="agro-buy" data-id="${l.id}" id="b-ab-${l.id}">Comprar <small id="t-c-${l.id}"></small></button></td></tr>`;
        }
        h += '</table></section>';
        if (S.agro.lands.length) {
          h += '<section class="card"><h3>Suas terras</h3><table class="tbl">';
          S.agro.lands.forEach((x, i) => {
            const l = A.land(x.id), farm = x.crop === 'soja' || x.crop === 'cafe';
            h += `<tr><td><b>${l.n}</b><br><small class="muted" id="t-s-${i}"></small></td>
              <td><b id="t-v-${i}"></b><br><small id="t-pl-${i}"></small></td>
              <td>${x.selling ? '<small class="muted">à venda</small>' : `<select data-set="crop" data-i="${i}">${l.crops.map(c =>
                `<option value="${c}"${c === x.crop ? ' selected' : ''}>${A.CROPS[c].n}</option>`).join('')}</select>
                ${farm ? `<label class="check"><input type="checkbox" data-act="agro-ins" data-i="${i}"${x.insured ? ' checked' : ''}> seguro rural</label>` : ''}
                ${A.operated(x) ? (x.mgr ? '<br><small class="muted">com gerente agrícola</small>'
                  : S.research.gestao_pessoas ? `<br><button data-act="agro-hire" data-i="${i}">Contratar gerente <small>12% do lucro</small></button>`
                  : `<br><small class="muted">consome ${l.energy} de energia/dia</small>`) : ''}`}</td>
              <td>${x.selling ? '' : `<button data-act="agro-sell" data-i="${i}">Vender</button>`}</td></tr>`;
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
            pl.textContent = `${f.signedPct(v / x.cost - 1, 1)} desde a compra`;
            pl.className = v >= x.cost ? 'good' : 'bad';
          }
          const planted = x.planted ? `${x.planted.crop} plantado, colheita em ${f.MESES[x.planted.harvest - 1]}` : '';
          set(`t-s-${i}`, x.selling ? `à venda: ~${x.selling} dias` : [planted, x.last].filter(Boolean).join(' · ') || A.CROPS[x.crop].n.toLowerCase());
        });
      },
    },

    imoveis: {
      key: S => [S.realty.length, S.realty.map(h => (h.selling ? 's' : '-') + (h.loan ? 'l' : '-') + (h.home ? 'h' : '-') + (h.occupied ? 'o' : '-')).join(''), !!S.research.financiamento].join('|'),
      build(S) {
        const R = G.realty, fin = S.research.financiamento;
        let h = `<section class="card summary"><span>Índice imobiliário <b id="re-idx"></b> em 12 meses</span>
          <span>Patrimônio em imóveis <b id="re-eq"></b></span><span>Aluguel líquido <b id="re-rent"></b>/mês</span>
          ${fin ? '<span>Financiamento hoje <b id="re-rate"></b> a.a.</span>' : ''}</section>
          <section class="card"><h3>Comprar</h3>
          <p class="muted">Na compra: 3% de ITBI e cartório. Na venda: 6% de corretagem, 15% de IR sobre o lucro e meses até aparecer comprador.
          O aluguel paga 8% à imobiliária e 15% de IR; imóvel vago custa condomínio e IPTU.</p><table class="tbl">`;
        for (const p of G.PROPERTIES) {
          h += `<tr><td>${p.n}<br><small class="muted">aluguel ~${f.pct(p.yield, 1)} a.a.</small></td><td id="re-p-${p.id}"></td>
            <td class="ops"><button data-act="re-buy" data-id="${p.id}" id="b-re-${p.id}">À vista <small id="re-c-${p.id}"></small></button>
            ${fin ? `<button data-act="re-fin" data-id="${p.id}" id="b-rf-${p.id}">Financiar <small id="re-f-${p.id}"></small></button>` : ''}</td></tr>`;
        }
        h += '</table></section>';
        if (S.realty.length) {
          h += '<section class="card"><h3>Seus imóveis</h3><table class="tbl">';
          S.realty.forEach((x, i) => {
            h += `<tr><td>${R.prop(x.pid).n}<br><small class="muted" id="rh-s-${i}"></small></td>
              <td><b id="rh-v-${i}"></b><br><small id="rh-pl-${i}"></small></td><td><small id="rh-l-${i}"></small></td>
              <td>${x.selling ? '' : `<button data-act="re-sell" data-i="${i}">Vender</button>`}
                ${x.home ? '<br><small class="good">você mora aqui</small>' : !x.selling && !x.occupied ? `<br><button data-act="home" data-i="${i}" id="b-home-${i}">Morar aqui</button>` : ''}</td></tr>`;
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
          set(`re-f-${p.id}`, `entrada ${f.money(fin.upfront)} · ${f.money(fin.pmt)}/mês`);
          dis(`b-re-${p.id}`, S.cash < cash.upfront);
          dis(`b-rf-${p.id}`, S.cash < fin.upfront);
          why(`b-re-${p.id}`, need(S, { cash: cash.upfront }));
          why(`b-rf-${p.id}`, need(S, { cash: fin.upfront }));
        }
        S.realty.forEach((x, i) => {
          const v = R.value(S, x);
          set(`rh-s-${i}`, x.selling ? `à venda: ~${x.selling} dias para fechar` : x.home ? 'sua casa'
            : x.occupied ? `alugado · ${f.money(R.rent(S, x))}/mês bruto` : 'vago, procurando inquilino');
          const small = v < G.life.homeMin(S);
          dis(`b-home-${i}`, small);
          why(`b-home-${i}`, small ? `pequeno para o seu padrão de vida: precisa valer ${f.money(G.life.homeMin(S))}` : 'para de alugar e corta 40% do custo de vida');
          set(`rh-v-${i}`, f.money(v));
          const pl = $(`rh-pl-${i}`);
          if (pl) {
            pl.textContent = `${f.signedPct(v / x.cost - 1, 1)} desde a compra`;
            pl.className = v >= x.cost ? 'good' : 'bad';
          }
          set(`rh-l-${i}`, x.loan ? `saldo devedor ${f.money(x.loan.bal)} · parcela ${f.money(x.loan.pmt)} · ${x.loan.left} meses` : 'quitado');
        });
      },
    },

    startups: {
      key: S => S.angel.deals.map(d => d.name + d.until).join(',') + '|' + S.angel.tickets.length,
      build(S) {
        const A = S.angel;
        let h = `<section class="card summary"><span>Investido em startups <b id="an-book"></b></span>
          <span>Retornos já recebidos <b id="an-out"></b></span></section>
          <section class="card"><h3>Rodadas abertas</h3>
          <p class="muted">Cheque de anjo leva anos para voltar, quando volta: 6 em cada 10 quebram. A tração é só um palpite;
          com due diligence fica bem mais confiável. Lucro paga 15% de IR.</p>`;
        if (!A.deals.length) h += '<p class="muted">Novas rodadas aparecem todo mês.</p>';
        A.deals.forEach((d, i) => {
          const cls = d.signal === 'forte' ? 'good' : d.signal === 'fraca' ? 'bad' : '';
          h += `<div class="research"><div><b>${d.name}</b> <span class="muted">— ${d.pitch}</span>
            <p>Tração <b class="${cls}">${d.signal}</b> · cheque de ${f.money(d.ticket)} · <span class="muted" id="an-d-${i}"></span></p></div>
            <button data-act="angel" data-i="${i}" id="b-an-${i}">Investir</button></div>`;
        });
        h += '</section>';
        if (A.tickets.length) {
          h += '<section class="card"><h3>Sua carteira de startups</h3><table class="tbl">';
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
          set(`an-d-${i}`, `rodada fecha em ${d.until - S.day} dias`);
          dis(`b-an-${i}`, S.cash < d.ticket);
          why(`b-an-${i}`, need(S, { cash: d.ticket }));
        });
        S.angel.tickets.forEach((t, i) => {
          const y = (S.day - t.day) / 360;
          set(`an-t-${i}`, `investido há ${y < 1 ? Math.floor(S.day - t.day) + ' dias' : f.num(y, 1) + ' anos'} · sem notícias`);
        });
      },
    },
  };

  function buildResources() {
    const row = (id, label) => `<div class="row" id="row-${id}" title="${esc(TIPS[id] || '')}"><span>${label}</span><b id="r-${id}"></b></div>`;
    $('resources').innerHTML = `
      ${row('cash', 'Caixa')}
      ${row('nw', 'Patrimônio')}
      <canvas class="spark zoom" id="r-nwc" data-act="chart" data-id="nw" title="Clique para ampliar" hidden></canvas>
      ${row('reserve', 'Reserva')}
      <div class="row" title="${esc(TIPS.en)}"><span>Energia</span><b id="r-en"></b></div>
      <div class="bar"><i id="r-enbar"></i></div>
      ${row('age', 'Idade')}
      ${row('k', 'Conhecimento')}
      ${row('rep', 'Reputação')}
      ${row('status', 'Posição')}
      ${row('stress', 'Stress')}
      ${row('well', 'Bem-estar')}
      ${row('inf', 'Influência')}
      ${row('img', 'Imagem pública')}
      <h4>Mês</h4>
      ${row('sal', 'Salário')}
      ${row('yield', 'Rendimentos')}
      ${row('rent', 'Aluguéis')}
      ${row('agro', 'Terras')}
      ${row('loan', 'Financiamentos')}
      ${row('biz', 'Empresas')}
      ${row('fund', 'Gestora')}
      ${row('social', 'Família e clubes')}
      ${row('pol', 'Política')}
      ${row('cost', 'Custo de vida')}
      ${row('net', 'Sobra')}
      <h4>Economia</h4>
      ${row('selic', 'Selic')}
      ${row('infl', 'Inflação')}
      <h4>Próximos passos</h4>
      <div id="r-goals"></div>`;
  }

  // Metas curtas no painel: promoção, FIRE e a próxima conquista da lista.
  function goals(S) {
    const W = G.work, out = [], nx = W.nextLevel(S);
    if (nx && S.job.employed) {
      const k = Math.max(0, nx.k - S.knowledge), r = Math.max(0, nx.rep - S.reputation);
      out.push(W.canPromote(S) ? `Promoção a ${nx.t} disponível!`
        : `${nx.t}: faltam ${[k && f.num(k, 0) + ' conhec.', r && f.num(r, 0) + ' reput.'].filter(Boolean).join(' e ')}`);
    }
    if (S.research.fire && S.job.employed) out.push(`FIRE: ${f.pct(Math.max(0, G.portfolio.netWorth(S)) / W.fireNumber(S), 0)} do número`);
    const a = G.legacy.ACHIEVEMENTS.find(x => S.legacy.ach[x.id] === undefined);
    if (a) out.push(`Conquista: ${a.n}, ${a.d.charAt(0).toLowerCase() + a.d.slice(1)}`);
    return out;
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
    set('r-reserve', rm >= 24 ? f.num(rm / 12, 0) + ' anos' : f.num(rm, 1) + ' meses');
    set('r-en', `${Math.floor(S.energy)}/${W.emax(S)}`);
    $('r-enbar').style.width = `${(100 * S.energy) / W.emax(S)}%`;
    set('r-k', f.num(S.knowledge, 1));
    set('r-age', `${Math.floor(G.legacy.age(S))} anos${S.legacy.generation > 1 ? ` · ${S.legacy.generation}ª geração` : ''}`);
    set('r-rep', f.num(Math.floor(S.reputation)));
    show('row-status', S.tabs.vida);
    show('row-stress', S.tabs.vida);
    set('r-status', G.social.tierName(S));
    set('r-stress', f.num(S.social.stress, 0));
    show('row-well', S.tabs.vida);
    set('r-well', f.num(S.life.well, 0) + (S.life.away > 0 ? ' · de férias' : ''));
    $('r-stress').className = S.social.stress > 70 ? 'bad' : '';
    show('row-inf', S.tabs.poder);
    show('row-img', S.tabs.poder);
    set('r-inf', f.num(S.pol.influence, 0));
    set('r-img', f.num(S.pol.image, 0));
    $('r-img').className = S.pol.image < -20 ? 'bad' : S.pol.image > 20 ? 'good' : '';
    set('r-sal', S.job.employed ? f.money(sal) : S.job.retired ? 'vive de renda' : 'desempregado');
    set('r-yield', f.money(yld));
    set('r-cost', '−' + f.money(cost));
    const re = G.realty.monthlyNet(S), bz = G.business.monthlyProfit(S), fd = S.fund ? S.fund.lastProfit : 0;
    const loans = re.pmt + G.business.monthlyPayments(S);
    const fam = S.social.family, spouse = fam.married ? fam.spouseIncome * S.macro.priceIndex : 0;
    const social = spouse - G.social.clubFees(S) - G.social.schoolCost(S) - G.social.partilhaPayment(S);
    const officePay = S.pol.office ? G.politics.office(S.pol.office.id).pay * S.macro.priceIndex : 0;
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
    set('r-rent', f.money(re.rent));
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
    const g = goals(S).map(x => `<div class="goal">${esc(x)}</div>`).join('');
    if (keys.goals !== g) { keys.goals = g; $('r-goals').innerHTML = g; }
  }

  function renderNav(S) {
    const tabs = TABS.filter(([id]) => S.tabs[id]);
    if (!S.tabs[active]) active = 'trabalho';
    const k = tabs.map(t => t[0]).join() + '|' + active;
    if (keys.nav === k) return;
    keys.nav = k;
    $('tabs').innerHTML = tabs
      .map(([id, n]) => `<button data-act="tab" data-id="${id}" class="tablink${id === active ? ' active' : ''}">${n}</button>`)
      .join('<span class="sep">|</span>');
  }

  // Filtros do jornal: cada um aceita alguns tipos de notícia.
  const LOG_FILTERS = [
    ['tudo', 'Tudo', null],
    ['bom', 'Bom', ['good']],
    ['ruim', 'Ruim', ['bad']],
    ['macro', 'Macro', ['macro', 'hint']],
    ['politica', 'Política', ['politica']],
    ['marcos', 'Marcos', ['unlock', 'story']],
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
      .map(e => `<li class="k-${e.k}"><time>${f.date(e.d)}</time> ${esc(e.t)}</li>`)
      .join('');
  }

  function render() {
    const S = G.S;
    const cs = getComputedStyle(document.body);
    colors = { up: cs.getPropertyValue('--up').trim(), down: cs.getPropertyValue('--down').trim(), accent: cs.getPropertyValue('--warn').trim(), muted: cs.getPropertyValue('--muted').trim() };
    set('clock', `${f.date(S.day)} · ${G.cal.season(S.day).n}${S.speed === 0 ? ' · pausado' : ''}`);
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

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const S = G.S, id = b.dataset.id, W = G.work, P = G.portfolio;
    const input = () => parseMoney(($(`a-in-${id}`) || {}).value || '');
    const clearInput = x => { const el = $(`a-in-${x}`); if (el) el.value = ''; };
    const BLIND = ['buy', 'buymax', 'buyfrac', 'sell', 'sellall', 'sellfrac', 're-buy', 're-fin', 're-sell', 'angel', 'biz-open', 'biz-sell', 'biz-fin',
      'biz-hire', 'agro-buy', 'agro-sell', 'agro-hire', 'agro-ins', 'fund-open', 'fund-sell', 'col-buy', 'col-sell', 'home', 'second-buy', 'second-sell'];
    if (BLIND.includes(b.dataset.act) && G.politics.blind(S)) {
      G.news('Seu patrimônio está num blind trust enquanto você ocupa o cargo: só a estratégia automática opera.', 'info');
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
        if (confirm('Aposentar e passar o bastão para o herdeiro? Seu personagem sai de cena e a próxima geração começa agora.')) G.legacy.succeed(S, 'aposentadoria');
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
        if (confirm('Tirar um ano sabático? Você fica 12 meses sem salário, mas mantém o cargo.')) G.work.sabbatical(S);
        break;
      case 'retro-toggle': S.settings.retro = b.checked; break;
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
        if (confirm(`Vender a gestora por ${f.money(G.fund.saleValue(S))}? Depois, 5 anos sem poder abrir outra.`)) G.fund.sell(S);
        break;
      case 'theme': setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); break;
      case 'export': exportFile(); break;
      case 'import': $('import-file').click(); break;
      case 'reset':
        if (confirm('Começar um jogo novo do zero?\n\nO jogo atual fica guardado: dá para voltar a ele pelo link "Desfazer reinício".')) G.restart();
        break;
      case 'undo-reset':
        if (confirm('Voltar ao jogo de antes do reinício? O jogo novo será descartado.') && G.restoreBackup()) {
          reset();
          G.news('Jogo anterior restaurado.', 'info');
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
    set('b-theme', t === 'dark' ? 'Tema claro' : 'Tema escuro');
  }

  // Exporta o save como arquivo .txt (vai para a pasta de downloads).
  function exportFile() {
    G.save();
    const c = G.cal.of(G.S.day);
    const name = `juros-compostos-${c.year}-${String(c.month).padStart(2, '0')}.txt`;
    const url = URL.createObjectURL(new Blob([G.exportSave()], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    G.news(`Save exportado para o arquivo ${name}, na sua pasta de downloads.`, 'info');
  }

  function importText(text) {
    try {
      G.S = G.importSave(text);
      G.save();
      reset();
      G.news('Save importado.', 'info');
    } catch (err) {
      alert('Esse arquivo não é um save válido do Jogo da Vida.');
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
    else if (el.dataset.set === 'crop') {
      if (G.politics.blind(S)) G.news('Seu patrimônio está num blind trust enquanto você ocupa o cargo: só a estratégia automática opera.', 'info');
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

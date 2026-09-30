(function () {
  const G = globalThis.G;

  const OFFLINE_CAP_DAYS = 360;
  const MAX_TICKS_PER_FRAME = 2000;

  G.tick = function (S) {
    S.day++;
    const c = G.cal.of(S.day);
    G.macro.step(S);
    G.events.daily(S);
    G.market.step(S);
    G.work.daily(S);
    G.business.daily(S);
    G.social.daily(S);
    G.life.daily(S);
    G.work.autopilot(S);
    G.realty.daily(S);
    G.agro.daily(S);
    if (c.dom === 1) {
      G.tax.monthly(S, c);
      G.portfolio.payDividends(S, c);
      G.realty.monthly(S);
      G.angel.monthly(S);
      G.agro.monthly(S, c);
      G.business.monthly(S);
      G.fund.monthly(S);
      G.work.monthly(S, c);
      G.social.monthly(S);
      G.life.monthly(S, c);
      G.choices.monthly(S);
      G.politics.monthly(S, c);
      G.work.settle(S);
      G.auto.monthly(S, c);
      G.macro.monthly(S, c);
      G.events.monthly(S, c);
      monthlyStats(S);
      G.legacy.monthly(S, c); // pode trocar G.S pelo herdeiro
    }
    G.checkUnlocks(G.S); // G.S: a sucessão pode ter trocado o estado neste tick
  };

  function monthlyStats(S) {
    const h = S.stats.nwHist;
    const nw = G.portfolio.netWorth(S);
    h.push(Math.round(nw));
    S.stats.peakNW = Math.max(S.stats.peakNW || 0, nw);
    if (h.length > 240) h.shift();
    if (S.research.experiencia) {
      const held = Object.keys(S.port).filter(id => G.portfolio.value(S, id) > 1).length;
      S.knowledge += held;
    }
  }

  G.checkUnlocks = function (S) {
    const open = (id, msg) => {
      if (S.tabs[id]) return;
      S.tabs[id] = true;
      G.news(msg, 'unlock');
    };
    if (S.cash >= 400 || G.portfolio.invested(S) > 0) open('investimentos', 'Seu banco oferece uma conta poupança. Dinheiro parado perde para a inflação. Nova aba: Investimentos.');
    if (S.knowledge >= 3 || Object.keys(S.research).length) open('conhecimento', 'Você percebeu que estudar abre portas. Nova aba: Conhecimento.');
    if (S.research.edu_fin) open('mercado', 'Você começou a acompanhar o noticiário econômico. Nova aba: Mercado.');
    if (S.research.imoveis) open('imoveis', 'Você começou a olhar anúncios de imóveis. Nova aba: Imóveis.');
    if (S.research.empreendedorismo || S.research.gestora) open('negocios', 'Hora de ter o próprio negócio. Nova aba: Negócios.');
    if (S.job.level >= 1 || S.reputation >= 4) open('vida', 'Com a carreira andando, sua vida social começa a pesar. Nova aba: Vida.');
    if (G.social.tierIdx(S) >= 2) open('poder', 'Seu nome começa a circular em Brasília. Nova aba: Poder.');
    if (S.research.agro) open('terras', 'Você começou a visitar fazendas à venda. Nova aba: Terras.');
    if (S.tabs.vida) open('lazer', 'Tempo livre também conta. Nova aba: Lazer (férias, hobbies, saúde e coleções).');
    if (S.research.anjo || S.angel.tickets.length) open('startups', 'Um amigo te chamou para um grupo de investidores-anjo. Nova aba: Startups.');
    if (S.reputation >= 2) open('estilo', 'Com o emprego firme, dá para pensar em onde morar. (Trabalho → Estilo de vida)');
  };

  function intro() {
    G.news('Primeiro dia de estágio. Salário de R$ 1.800, custo de vida de R$ 1.200. O resto é com você.', 'story');
  }

  G.restart = function () {
    G.backup();
    G.wipe();
    G.newState();
    intro();
    G.ui.reset();
  };

  // Simula o tempo que passou com a aba fechada (na velocidade em que ficou).
  function catchUp(S) {
    const days = Math.min(OFFLINE_CAP_DAYS, Math.floor((Date.now() - S.lastSeen) / 1000 * S.speed));
    if (days < 2) return;
    const before = G.portfolio.netWorth(S), day0 = S.day, speed = S.speed;
    G.catchingUp = true;
    for (let i = 0; i < days; i++) G.tick(G.S);
    G.catchingUp = false;
    const after = G.portfolio.netWorth(G.S);
    G.news(`Enquanto você esteve fora passaram ${days} dias. Patrimônio: ${G.fmt.money(before)} → ${G.fmt.money(after)}.`, 'story');
    // Resumo: o que de mais marcante aconteceu (o jornal guarda os últimos 100 itens).
    const notable = G.S.log.filter(e => e.d > day0 && ['good', 'bad', 'unlock', 'story', 'hint'].includes(e.k)).slice(0, 12).reverse();
    G.popup(G.S, 'Enquanto você esteve fora', [
      ['Dias que passaram', String(days)],
      ['Patrimônio', `${G.fmt.money(before)} → ${G.fmt.money(after)}`],
      ...notable.map(e => `${G.fmt.date(e.d)} · ${e.t}`),
      notable.length ? '' : 'Nada de muito marcante: o dinheiro trabalhou em silêncio.',
    ].filter(Boolean));
    G.popups[G.popups.length - 1].resume = speed;
  }

  function start() {
    const saved = G.load();
    if (saved) {
      G.S = saved;
      catchUp(saved);
    } else {
      G.newState();
      intro();
    }
    G.ui.init();

    let last = performance.now(), acc = 0;
    setInterval(() => {
      const now = performance.now();
      acc += ((now - last) / 1000) * G.S.speed;
      last = now;
      let n = 0;
      while (acc >= 1 && n < MAX_TICKS_PER_FRAME && G.S.speed > 0) {
        G.tick(G.S);
        acc -= 1;
        n++;
      }
      if (n === MAX_TICKS_PER_FRAME || G.S.speed === 0) acc = 0; // pausa automática para no meio do quadro
    }, 50);
    setInterval(G.ui.render, 200);
    setInterval(G.save, 30000);
    window.addEventListener('beforeunload', G.save);
    document.addEventListener('visibilitychange', () => document.hidden && G.save());
  }

  start();
})();

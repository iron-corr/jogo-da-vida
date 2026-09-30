(function () {
  const G = globalThis.G = globalThis.G || {};

  const KEY = 'juros-compostos-save';
  const VERSION = 12;

  G.newState = function (seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) | 0) {
    const S = {
      v: VERSION, rng: seed, day: 0, speed: 1,
      cash: 300, knowledge: 0, reputation: 0, energy: 100, burnout: 0,
      job: { level: 0, employed: true, wageIndex: 1, jobless: 0, since: 0, bonus: 1, track: 'corporativo', sabbatical: null },
      lifestyle: 0,
      port: {}, research: {}, tabs: { trabalho: true },
      log: [], stats: { workIncome: 0, dividends: 0, nwHist: [] },
      tax: G.tax.init(), settings: { reinvest: false },
      realty: [], angel: { deals: [], tickets: [] },
      auto: G.auto.init(), biz: G.business.init(), fund: null, routine: 'off', social: G.social.init(), pol: G.politics.init(),
      legacy: G.legacy.init(), birthDay: 0, flags: {}, agro: G.agro.init(), life: G.life.init(),
      lastSeen: Date.now(),
    };
    G.S = S; // o rng lê o estado daqui
    S.legacy.surname = G.rng.item(G.dynasty.SURNAMES);
    S.me = { name: G.dynasty.name() };
    S.ageOffset = 0;
    S.lifespan = S.baseLifespan = G.legacy.rollLifespan(S);
    G.macro.init(S);
    G.market.init(S);
    S.fam = G.families.init(S);
    S.nation = G.nation.init();
    return S;
  };

  G.news = function (text, kind = 'info') {
    const S = G.S;
    S.log.unshift({ d: S.day, t: text, k: kind });
    if (S.log.length > 100) S.log.pop();
  };

  // Notícia importante: além do jornal, pausa o jogo (se o jogador não desligou a pausa automática).
  // No catch-up offline não pausa; o resumo do período mostra o que aconteceu.
  G.alert = function (S, text, kind = 'bad') {
    G.news(text, kind);
    if (G.catchingUp || !S.settings || S.settings.autoPause === false || !S.speed) return;
    G.pausedFrom = S.speed; // decidir uma pendência retoma nesta velocidade
    S.speed = 0;
  };

  // Janelas de texto (resumo offline, fim de geração, retrospectiva). Não são salvas; pausam o jogo.
  // rows: string = parágrafo; [rótulo, valor] = linha de tabela.
  G.popups = [];
  G.popup = function (S, title, rows) {
    if (G.catchingUp) return;
    G.popups.push({ title, rows, resume: S.speed });
    if (G.popups.length > 5) G.popups.shift();
    S.speed = 0;
  };

  function migrate(S) {
    if (S.v < 2) { // M3: renda variável, IR e eventos
      Object.assign(S.market, { effects: [], lastSelic: S.macro.selic, fg: 50, trend: Math.log(100), idio: {} });
      S.tax = G.tax.init();
      S.settings = { reinvest: false };
      S.stats.dividends = 0;
      S.v = 2;
    }
    if (S.v < 3) { // M4: indicadores e árvore de conhecimento
      G.S = S; // o rng lê o estado daqui
      G.macro.initIndicators(S);
      S.stats.nwHist = [];
      S.v = 3;
    }
    if (S.v < 4) { // M5: alternativos, imóveis e startups
      Object.assign(S.tax, { criptoSales: 0, criptoGain: 0 });
      S.realty = [];
      S.angel = { deals: [], tickets: [] };
      S.v = 4;
    }
    if (S.v < 5) { // M6: automação, empresas e gestora
      S.auto = G.auto.init();
      S.biz = G.business.init();
      S.fund = null;
      S.v = 5;
    }
    if (S.v < 6) { // M6b: vida social e hábitos
      S.social = G.social.init();
      S.v = 6;
    }
    if (S.v < 7) { // M7: poder e política
      S.pol = G.politics.init();
      S.v = 7;
    }
    if (S.v < 8) { // M8: legado
      G.S = S;
      Object.assign(S, { legacy: G.legacy.init(), birthDay: 0, flags: {} });
      S.lifespan = S.baseLifespan = G.legacy.rollLifespan(S);
      S.v = 8;
    }
    if (S.v < 9) { // terras e agronegócio
      S.agro = G.agro.init();
      S.v = 9;
    }
    if (S.v < 10) { // vida: lazer, cidade, saúde, bem-estar, carreira e escolhas
      S.life = G.life.init();
      Object.assign(S.job, { since: S.birthDay, bonus: 1, track: 'corporativo', sabbatical: null });
      S.v = 10;
    }
    if (S.v < 11) { // famílias rivais e o país (presidência)
      G.S = S;
      S.fam = G.families.init(S);
      S.nation = G.nation.init();
      S.v = 11;
    }
    if (S.v < 12) { // dinastia: nomes, filhos com aptidões, herdeiro escolhido
      G.S = S;
      if (!S.legacy.surname) S.legacy.surname = G.rng.item(G.dynasty.SURNAMES);
      if (!S.me) S.me = { name: G.dynasty.name() };
      if (S.social.family.married && !S.social.family.spouse) S.social.family.spouse = G.dynasty.name();
      G.dynasty.children(S);
      S.v = 12;
    }
    if (!S.routine) S.routine = 'off';
    if (!S.biz.loans) S.biz.loans = [];
    // Ativos novos em qualquer versão ganham preço inicial.
    for (const id in G.ASSETS) if (!S.market.prices[id]) G.market.initAsset(S.market, id);
    return S;
  }

  G.save = function () {
    try {
      G.S.lastSeen = Date.now();
      localStorage.setItem(KEY, JSON.stringify(G.S));
    } catch (e) { /* sem storage (aba privada etc.): segue sem salvar */ }
  };
  G.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? migrate(JSON.parse(raw)) : null;
    } catch (e) {
      return null;
    }
  };
  // Cópia do jogo anterior ao "Reiniciar", para poder desfazer.
  const BACKUP = KEY + '-antes-de-reiniciar';
  G.backup = function () {
    try { localStorage.setItem(BACKUP, JSON.stringify(G.S)); } catch (e) { /* sem storage */ }
  };
  G.hasBackup = function () {
    try { return !!localStorage.getItem(BACKUP); } catch (e) { return false; }
  };
  G.restoreBackup = function () {
    try {
      const raw = localStorage.getItem(BACKUP);
      if (!raw) return false;
      G.S = migrate(JSON.parse(raw));
      localStorage.removeItem(BACKUP);
      G.save();
      return true;
    } catch (e) {
      return false;
    }
  };
  G.wipe = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* idem */ }
  };
  G.exportSave = () => btoa(unescape(encodeURIComponent(JSON.stringify(G.S))));
  G.importSave = str => migrate(JSON.parse(decodeURIComponent(escape(atob(str.trim())))));
})();

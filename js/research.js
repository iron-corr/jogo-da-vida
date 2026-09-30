(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  const byId = id => G.RESEARCH.find(r => r.id === id);

  G.research = {
    byId,
    visible: (S, r) => !S.research[r.id] && (r.req || []).every(q => S.research[q]),
    // Bloqueada mas com algum pré-requisito já feito: aparece na árvore como próximo passo.
    teased: (S, r) => !S.research[r.id] && (r.req || []).some(q => S.research[q]),
    affordable: (S, r) => S.knowledge >= r.k && S.cash >= (r.cost || 0),
    buy(S, id) {
      const r = byId(id);
      if (!r || !G.research.visible(S, r) || !G.research.affordable(S, r)) return;
      S.knowledge -= r.k;
      S.cash -= r.cost || 0;
      G.social.spent(S, r.cost || 0);
      S.research[id] = true;
      if (r.prestige) G.social.gain(S, 0, r.prestige);
      G.news(tr(`Pesquisa concluída: ${r.n}.`, `Research complete: ${r.n}.`), 'unlock');
    },
  };
})();

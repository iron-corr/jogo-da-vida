(function () {
  const G = globalThis.G = globalThis.G || {};

  // Idioma do jogo: português (padrão) ou inglês. Cada texto é escrito nos dois idiomas no próprio lugar,
  // com G.L('texto em português', 'text in English'). O idioma é fixo durante a página: trocar salva o jogo
  // e recarrega, para que tabelas, abas e botões sejam montados de novo no idioma novo.
  // ?lang=en na URL força o idioma sem gravar a escolha.
  const KEY = 'jogo-da-vida-idioma';
  let lang = 'pt';
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
    lang = q || localStorage.getItem(KEY) || 'pt';
  } catch (e) { /* sem storage (node, aba privada etc.) */ }
  if (lang !== 'en') lang = 'pt';

  G.lang = lang;
  G.EN = lang === 'en';

  // Textos gravados (jornal, andamento das terras...) precisam existir nos dois idiomas, porque o jogador pode trocar
  // de idioma depois. Cada tr() e cada número/data formatado registra o par "no idioma atual → no outro idioma":
  // - durante o carregamento (nomes de ativos, imóveis, cargos...), num dicionário fixo;
  // - durante o jogo, numa lista curta de fragmentos recentes, que G.i18n.other() usa para remontar a frase no outro
  //   idioma logo antes de gravá-la. A tela (render) não registra nada.
  const STATIC = new Map();
  let frags = [];
  const I = G.i18n = { phase: 'load', rec: true };
  I.pair = (cur, other) => {
    if (typeof cur !== 'string' || typeof other !== 'string' || cur === other || !cur) return;
    if (I.phase === 'load') {
      if (!STATIC.has(cur)) STATIC.set(cur, other);
      const lc = cur.toLowerCase();
      if (lc !== cur && !STATIC.has(lc)) STATIC.set(lc, other.toLowerCase());
    } else if (I.rec) {
      frags.push([cur, other]);
      if (frags.length > 300) frags = frags.slice(-200);
    }
  };
  G.L = (pt, en) => {
    if (Array.isArray(pt)) pt.forEach((p, i) => I.pair(G.EN ? en[i] : p, G.EN ? p : en[i]));
    else I.pair(G.EN ? en : pt, G.EN ? pt : en);
    return G.EN ? en : pt;
  };
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // A frase no outro idioma: troca, do maior para o menor, os fragmentos conhecidos pelo par (em até 3 passadas,
  // porque a frase traduzida ainda carrega nomes e números do idioma atual) e depois esquece os fragmentos.
  I.other = text => {
    let out = String(text);
    for (let pass = 0; pass < 3; pass++) {
      const map = new Map();
      for (const [c, o] of frags) if (out.includes(c)) map.set(c, o);
      for (const [c, o] of STATIC) if (!map.has(c) && out.includes(c)) map.set(c, o);
      if (!map.size) break;
      // Fronteira de palavra só onde o fragmento começa ou termina com letra ou número (não troca "Arte" dentro de "Artes").
      const word = /[\p{L}\d]/u;
      const keys = [...map.keys()].sort((a, b) => b.length - a.length)
        .map(k => `${word.test(k[0]) ? '(?<![\\p{L}\\d])' : ''}${esc(k)}${word.test(k[k.length - 1]) ? '(?![\\p{L}\\d])' : ''}`);
      const re = new RegExp(keys.join('|'), 'gu');
      const next = out.replace(re, m => map.get(m));
      if (next === out) break;
      out = next;
    }
    return out;
  };
  I.clear = () => { frags = []; };
  // Um texto gravado nos dois idiomas: { t, t2, l }. show() devolve a versão do idioma atual.
  I.both = text => {
    const b = { t: text, t2: I.other(text), l: G.lang };
    I.clear();
    return b;
  };
  I.show = (t, t2, l) => (!l || l === G.lang || !t2 ? t : t2);

  G.setLang = function (l) {
    if (G.save) G.save();
    try { localStorage.setItem(KEY, l); } catch (e) { /* sem storage: vale só até recarregar */ }
    const url = new URL(location.href);
    url.searchParams.delete('lang');
    if (url.href === location.href) location.reload();
    else location.replace(url.href);
  };

  // Textos fixos do index.html: data-en troca o texto, data-en-title troca o tooltip.
  if (typeof document !== 'undefined' && document.documentElement && document.querySelectorAll) {
    document.documentElement.lang = G.EN ? 'en' : 'pt-BR';
    if (G.EN) {
      document.querySelectorAll('[data-en]').forEach(el => { el.textContent = el.dataset.en; });
      document.querySelectorAll('[data-en-title]').forEach(el => { el.title = el.dataset.enTitle; });
    }
  }
})();

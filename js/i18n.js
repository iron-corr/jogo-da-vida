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
  G.L = (pt, en) => (G.EN ? en : pt);

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

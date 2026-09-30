(function () {
  const G = globalThis.G = globalThis.G || {};

  // Formatos dos dois idiomas. O do idioma atual vai para a tela; o outro só é calculado para registrar o par
  // (ver G.i18n.pair), para que as notícias gravadas possam ser mostradas depois no outro idioma.
  const FMT = {
    pt: { locale: 'pt-BR', suffixes: [[1e18, ' qui'], [1e15, ' quatri'], [1e12, ' tri'], [1e9, ' bi'], [1e6, ' mi']],
      months: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] },
    en: { locale: 'en-US', suffixes: [[1e18, ' Qi'], [1e15, ' Qa'], [1e12, ' T'], [1e9, ' B'], [1e6, ' M']],
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  };
  const CUR = G.EN ? FMT.en : FMT.pt, OTHER = G.EN ? FMT.pt : FMT.en;
  const MESES = CUR.months;
  const nf = (F, v, d) => v.toLocaleString(F.locale, { minimumFractionDigits: d, maximumFractionDigits: d });

  const money = (F, v) => {
    const sign = v < 0 ? '−' : '';
    const a = Math.abs(v);
    if (a >= 1e21) return `${sign}R$ ${a.toExponential(2)}`;
    for (const [lim, suf] of F.suffixes) if (a >= lim) return `${sign}R$ ${nf(F, a / lim, 2)}${suf}`;
    return `${sign}R$ ${nf(F, a, a >= 1e4 ? 0 : 2)}`;
  };
  const pct = (F, v, d = 2) => nf(F, v * 100, d) + '%';
  const signedPct = (F, v, d = 2) => (v >= 0 ? '+' : '−') + nf(F, Math.abs(v) * 100, d) + '%';
  const date = (F, day) => {
    const c = G.cal.of(day);
    return `${c.dom} ${F.months[c.month - 1]} ${c.year}`;
  };
  const monthYear = (F, day) => {
    const c = G.cal.of(day);
    return `${F.months[c.month - 1]}/${c.year}`;
  };
  // Formata no idioma atual e registra o par com o outro idioma (só durante o jogo; a tela desliga o registro).
  const both = fn => (...args) => {
    const cur = fn(CUR, ...args);
    const I = G.i18n;
    if (I && I.phase !== 'load' && I.rec) I.pair(cur, fn(OTHER, ...args));
    return cur;
  };

  G.fmt = {
    MESES,
    num: both((F, v, d = 0) => nf(F, v, d)),
    money: both(money),
    pct: both(pct),
    signedPct: both(signedPct),
    date: both(date),
    monthYear: both(monthYear),
  };
})();

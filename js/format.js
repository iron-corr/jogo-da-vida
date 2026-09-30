(function () {
  const G = globalThis.G = globalThis.G || {};

  const EN = G.EN;
  const SUFFIXES = EN
    ? [[1e18, ' Qi'], [1e15, ' Qa'], [1e12, ' T'], [1e9, ' B'], [1e6, ' M']]
    : [[1e18, ' qui'], [1e15, ' quatri'], [1e12, ' tri'], [1e9, ' bi'], [1e6, ' mi']];
  const MESES = EN
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const LOCALE = EN ? 'en-US' : 'pt-BR';
  const nf = (v, d) => v.toLocaleString(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d });

  G.fmt = {
    MESES,
    num: (v, d = 0) => nf(v, d),
    money(v) {
      const sign = v < 0 ? '−' : '';
      const a = Math.abs(v);
      if (a >= 1e21) return `${sign}R$ ${a.toExponential(2)}`;
      for (const [lim, suf] of SUFFIXES) if (a >= lim) return `${sign}R$ ${nf(a / lim, 2)}${suf}`;
      return `${sign}R$ ${nf(a, a >= 1e4 ? 0 : 2)}`;
    },
    pct: (v, d = 2) => nf(v * 100, d) + '%',
    signedPct: (v, d = 2) => (v >= 0 ? '+' : '−') + nf(Math.abs(v) * 100, d) + '%',
    date(day) {
      const c = G.cal.of(day);
      return `${c.dom} ${MESES[c.month - 1]} ${c.year}`;
    },
    monthYear(day) {
      const c = G.cal.of(day);
      return `${MESES[c.month - 1]}/${c.year}`;
    },
  };
})();

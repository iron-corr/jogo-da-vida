(function () {
  const G = globalThis.G = globalThis.G || {};

  // Ano comercial: 12 meses de 30 dias. Estações do hemisfério sul, uma por trimestre.
  const tr = G.L;
  const START_YEAR = 2026;
  const SEASONS = [
    { id: 'verao', n: tr('Verão', 'Summer') },
    { id: 'outono', n: tr('Outono', 'Autumn') },
    { id: 'inverno', n: tr('Inverno', 'Winter') },
    { id: 'primavera', n: tr('Primavera', 'Spring') },
  ];

  G.cal = {
    START_YEAR,
    SEASONS,
    of(day) {
      const doy = day % 360;
      return { year: START_YEAR + Math.floor(day / 360), month: Math.floor(doy / 30) + 1, dom: (doy % 30) + 1, doy };
    },
    season: day => SEASONS[Math.floor((day % 360) / 90)],
    isElectionYear: year => (year - 2026) % 4 === 0,
    nextElection(day) {
      let year = G.cal.of(day).year;
      while (!G.cal.isElectionYear(year) || (year === G.cal.of(day).year && G.cal.of(day).month > 10)) year++;
      return year;
    },
  };
})();

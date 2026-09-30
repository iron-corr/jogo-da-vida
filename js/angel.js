(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;

  // Investimento-anjo (retorno médio ~2,3x em 6-7 anos). O destino de cada startup é sorteado quando a rodada aparece;
  // o jogador só vê um sinal de tração, que é confiável na proporção da due diligence.
  const PREFIX = tr(['Agro', 'Pix', 'Log', 'Saúde', 'Edu', 'Pet', 'Casa', 'Frota', 'Nuvem', 'Pay', 'Food', 'Clima', 'Obra', 'Seguro'],
    ['Agro', 'Pix', 'Log', 'Health', 'Edu', 'Pet', 'Home', 'Fleet', 'Cloud', 'Pay', 'Food', 'Climate', 'Build', 'Insure']);
  const SUFFIX = ['ly', 'io', 'Hub', 'Tech', 'Bank', 'Go', 'Now', 'AI', 'Up', 'Lab', 'Flow', 'Box'];
  const PITCH = tr([
    'marketplace de', 'app para', 'SaaS para gestão de', 'fintech de crédito para', 'plataforma de dados sobre', 'IA que automatiza',
  ], [
    'marketplace for', 'app for', 'management SaaS for', 'credit fintech for', 'data platform for', 'AI that automates',
  ]);
  const TOPIC = tr(['pequenos produtores', 'clínicas veterinárias', 'condomínios', 'frotas de caminhão', 'escolas', 'obras', 'restaurantes', 'corretores'],
    ['small farmers', 'veterinary clinics', 'apartment buildings', 'truck fleets', 'schools', 'construction sites', 'restaurants', 'real estate brokers']);
  const SIGNALS = ['fraca', 'média', 'forte'];
  // O sinal fica salvo como chave em português; este é o nome exibido.
  const SIGNAL_NAMES = { fraca: tr('fraca', 'weak'), média: tr('média', 'moderate'), forte: tr('forte', 'strong') };
  const DEALS = 3;
  const DEAL_DAYS = 90;
  const money = v => G.fmt.money(v);

  function fate() {
    const r = G.rng.next();
    if (r < 0.6) return { mult: 0, exit: G.rng.int(360, 1800) };
    if (r < 0.88) return { mult: G.rng.range(0.3, 2), exit: G.rng.int(1080, 2880) };
    if (r < 0.98) return { mult: G.rng.range(3, 10), exit: G.rng.int(1440, 3240) };
    return { mult: G.rng.range(30, 100), exit: G.rng.int(1800, 3600) };
  }
  const trueSignal = mult => (mult === 0 ? 'fraca' : mult < 3 ? 'média' : 'forte');

  function newDeal(S) {
    const f = fate();
    const acc = (S.research.due_diligence ? 0.85 : 0.5) + (S.social.clubs.golfe ? 0.1 : 0);
    const ticket = Math.max(25000, Math.round((G.portfolio.netWorth(S) * 0.01) / 5000) * 5000);
    return {
      name: G.angel.newName(),
      pitch: `${G.rng.item(PITCH)} ${G.rng.item(TOPIC)}`,
      ticket, until: S.day + DEAL_DAYS,
      signal: G.rng.chance(acc) ? trueSignal(f.mult) : G.rng.item(SIGNALS),
      mult: f.mult, exit: f.exit,
    };
  }

  const A = G.angel = {
    SIGNAL_NAMES,
    fate,
    newName: () => G.rng.item(PREFIX) + G.rng.item(SUFFIX),
    book: S => S.angel.tickets.reduce((s, t) => s + t.amount, 0),
    invest(S, i) {
      const d = S.angel.deals[i];
      if (!d || S.cash < d.ticket) return;
      S.cash -= d.ticket;
      S.angel.deals.splice(i, 1);
      S.angel.tickets.push({ name: d.name, amount: d.ticket, day: S.day, exitDay: S.day + d.exit, mult: d.mult });
      G.news(tr(`Você investiu ${money(d.ticket)} na ${d.name}. Agora é esperar anos.`, `You invested ${money(d.ticket)} in ${d.name}. Now you wait for years.`), 'info');
    },
    monthly(S) {
      const a = S.angel;
      if (S.research.anjo) { // rodadas novas só para quem é investidor-anjo; participações (ex.: startup onde trabalhou) valem para todos
        a.deals = a.deals.filter(d => d.until > S.day);
        while (a.deals.length < DEALS) a.deals.push(newDeal(S));
      }
      for (let i = a.tickets.length - 1; i >= 0; i--) {
        const t = a.tickets[i];
        if (S.day < t.exitDay) continue;
        a.tickets.splice(i, 1);
        const payout = t.amount * t.mult;
        const net = payout - G.tax.flat(S, payout - t.amount);
        S.cash += net;
        S.stats.angelOut = (S.stats.angelOut || 0) + net;
        if (t.mult === 0) G.news(tr(`A ${t.name} fechou as portas. Os ${money(t.amount)} investidos viraram experiência.`,
          `${t.name} shut down. The ${money(t.amount)} invested became a learning experience.`), 'bad');
        else if (t.mult < 1) G.news(tr(`A ${t.name} foi vendida por pouco. Você recuperou ${money(net)} de ${money(t.amount)}.`,
          `${t.name} was sold for little. You got back ${money(net)} of ${money(t.amount)}.`), 'bad');
        else if (t.mult < 30) G.news(tr(`A ${t.name} foi comprada! Seu cheque de ${money(t.amount)} virou ${money(net)}.`,
          `${t.name} was acquired! Your ${money(t.amount)} check turned into ${money(net)}.`), 'good');
        else G.legacy.flag(S, 'unicornio'), G.news(tr(`UNICÓRNIO: a ${t.name} abriu capital em Nova York. Seu cheque de ${money(t.amount)} virou ${money(net)}.`,
          `UNICORN: ${t.name} went public in New York. Your ${money(t.amount)} check turned into ${money(net)}.`), 'good');
      }
    },
  };
})();

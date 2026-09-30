(function () {
  const G = globalThis.G = globalThis.G || {};
  const tr = G.L;
  const RF = tr('Renda fixa', 'Fixed income'), ACOES = tr('Ações', 'Stocks'), ALT = tr('Alternativos', 'Alternatives');

  // kind define como o preço anda (ver market.js). req = pesquisa que desbloqueia.
  // lockDays = carência de cada aplicação. tax = regra de IR (ver tax.js).
  //
  // Ações (kind 'equity'): log-retorno diário = beta × fator de mercado + alpha[regime]
  // + season[estação] + sigma × ruído próprio − selicD × variação da Selic.
  // dy = dividend yield anual, pago divFreq vezes por ano.
  G.ASSETS = {
    poupanca: {
      n: tr('Poupança', 'Savings account'), cls: RF, kind: 'poupanca', tax: 'isento',
      d: tr('Liquidez diária, risco zero, isenta de IR. Rende 70% da Selic, ou 6,17% a.a. quando a Selic passa de 8,5%.',
        'Daily liquidity, zero risk, income-tax free. Pays 70% of the Selic rate, or 6.17% p.a. when the Selic is above 8.5%.'),
    },
    tesouro_selic: {
      n: tr('Tesouro Selic', 'Selic Treasury bond'), cls: RF, kind: 'selic', spread: -0.002, tax: 'rf', req: 'edu_fin',
      d: tr('Acompanha a Selic, com liquidez diária. O porto seguro; quando a Selic cai, rende menos.',
        'Tracks the Selic rate, with daily liquidity. The safe harbor; when the Selic falls, it pays less.'),
    },
    cdb: {
      n: tr('CDB 108% do CDI', 'Bank CD (CDB) at 108% of CDI'), cls: RF, kind: 'cdi', mult: 1.08, lockDays: 360, tax: 'rf', req: 'edu_fin',
      d: tr('Rende mais que o Tesouro Selic, mas cada aplicação fica presa por 360 dias. Se o banco quebrar, o FGC cobre até R$ 250 mil.',
        'Pays more than the Selic Treasury, but each deposit is locked for 360 days. If the bank fails, the deposit guarantee fund (FGC) covers up to R$ 250k.'),
    },
    prefixado: {
      n: tr('Tesouro Prefixado', 'Fixed-rate Treasury bond'), cls: RF, kind: 'pre', duration: 3, tax: 'rf', req: 'rf_avancada',
      d: tr('Taxa travada. Se os juros de mercado sobem, o preço cai hoje (marcação a mercado); se caem, você ganha. Duration ~3 anos.',
        'Locked-in rate. If market rates rise, the price falls today (mark-to-market); if they fall, you gain. Duration ~3 years.'),
    },
    ipca: {
      n: tr('Tesouro IPCA+', 'Inflation-linked Treasury (IPCA+)'), cls: RF, kind: 'ipca', duration: 7, tax: 'rf', req: 'rf_avancada',
      d: tr('Inflação + juro real. Protege o poder de compra, mas oscila bastante: duration ~7 anos.',
        'Inflation + a real rate. Protects purchasing power, but swings a lot: duration ~7 years.'),
    },

    ibov: {
      n: tr('ETF Ibovespa', 'Ibovespa ETF'), cls: ACOES, kind: 'equity', beta: 1, sigma: 0, dy: 0.05, divFreq: 4, tax: 'etf', req: 'rv1',
      d: tr('Uma cota com as maiores empresas da bolsa. Diversificado, mas sobe e desce com o ciclo. ETF não tem a isenção de R$ 20 mil.',
        'One share holding the largest companies on the exchange. Diversified, but rises and falls with the cycle. ETFs don\'t get the R$ 20k tax exemption.'),
    },
    bancos: {
      n: tr('Ações de bancos', 'Bank stocks'), short: tr('bancos', 'banking'), cls: ACOES, kind: 'equity', beta: 0.9, sigma: 0.18, dy: 0.06, divFreq: 4,
      selicD: -1, alpha: { pico: 0.04, recessao: -0.06 }, tax: 'acao', req: 'setores',
      d: tr('Lucram com juros altos e sofrem com a inadimplência na recessão. Bons dividendos.',
        'Profit from high rates and suffer from defaults in a recession. Good dividends.'),
    },
    commodities: {
      n: tr('Mineração e agro', 'Mining and agribusiness'), short: tr('mineração e agro', 'mining and agribusiness'), cls: ACOES, kind: 'equity', beta: 0.8, sigma: 0.28, dy: 0.06, divFreq: 4,
      season: { verao: 0.15, outono: -0.05, inverno: -0.05, primavera: -0.05 }, tax: 'acao', req: 'setores',
      d: tr('Seguem os preços globais. Safra forte no verão; sujeitas a superciclos e quedas bruscas.',
        'Follow global prices. Strong harvest in summer; prone to supercycles and sharp drops.'),
    },
    varejo: {
      n: tr('Varejo', 'Retail'), short: tr('varejo', 'retail'), cls: ACOES, kind: 'equity', beta: 1.4, sigma: 0.3, dy: 0.02, divFreq: 4, selicD: 4,
      alpha: { recuperacao: 0.05 }, season: { verao: -0.05, outono: -0.05, inverno: -0.05, primavera: 0.15 }, tax: 'acao', req: 'setores',
      d: tr('Vive de crédito e consumo: brilha no fim de ano e quando os juros caem, sofre quando a Selic sobe.',
        'Lives on credit and consumption: shines at year-end and when rates fall, suffers when the Selic rises.'),
    },
    utilities: {
      n: tr('Energia elétrica', 'Electric utilities'), short: tr('energia elétrica', 'electric utilities'), cls: ACOES, kind: 'equity', beta: 0.4, sigma: 0.08, drift: 0.015, dy: 0.08, divFreq: 4,
      selicD: 1.5, season: { verao: -0.02, outono: -0.02, inverno: 0.06, primavera: -0.02 }, tax: 'acao', req: 'setores',
      d: tr('Defensivas: receita regulada, bons dividendos, pouca emoção. O inverno seco encarece a energia.',
        'Defensive: regulated revenue, good dividends, little excitement. The dry winter makes power pricier.'),
    },
    tech: {
      n: tr('Tecnologia', 'Technology'), short: tr('tecnologia', 'technology'), cls: ACOES, kind: 'equity', beta: 1.7, sigma: 0.4, dy: 0.005, divFreq: 4,
      selicD: 3, alpha: { pico: 0.3, recessao: -0.15 }, tax: 'acao', req: 'setores',
      d: tr('Crescimento acelerado e bolhas espetaculares. Quase não paga dividendos.',
        'Fast growth and spectacular bubbles. Pays almost no dividends.'),
    },

    fii: {
      n: tr('FIIs (fundos imobiliários)', 'REITs (FIIs)'), cls: tr('Fundos imobiliários', 'Real estate funds'), kind: 'equity', beta: 0.3, sigma: 0.08, drift: 0.01, dy: 0.09, divFreq: 12,
      selicD: 3, tax: 'fii', req: 'rv1',
      d: tr('Recebem aluguéis de shoppings, galpões e escritórios e pagam todo mês, isentos de IR. Caem quando a Selic sobe.',
        'Collect rent from malls, warehouses and offices and pay out every month, income-tax free. Fall when the Selic rises.'),
    },

    // Alternativos. drift = retorno próprio (log, a.a.) somado ao efeito de mercado.
    // crypto = sensibilidade ao ciclo do halving. idioDecay 0 = desvio próprio não volta.
    // unit = quantas "cotas" do motor formam uma unidade exibida (1 BTC).
    ouro: {
      n: tr('Ouro', 'Gold'), cls: ALT, kind: 'equity', beta: -0.15, sigma: 0.15, drift: 0.07, dy: 0,
      alpha: { pico: 0.03, recessao: 0.12, recuperacao: -0.05 }, tax: 'etf', req: 'ouro_dolar',
      d: tr('Não rende nada, mas sobe quando o mundo tem medo. Hedge clássico contra crises e inflação.',
        'Yields nothing, but rises when the world is afraid. The classic hedge against crises and inflation.'),
    },
    sp500: {
      n: tr('ETF S&P 500 (em dólar)', 'S&P 500 ETF (in dollars)'), cls: ALT, kind: 'equity', beta: 0.35, sigma: 0.17, drift: 0.06, dy: 0.013, divFreq: 4,
      alpha: { recessao: 0.1, recuperacao: -0.04 }, tax: 'etf', req: 'ouro_dolar',
      d: tr('As 500 maiores empresas americanas, cotadas em reais. Quando o Brasil entra em crise, o dólar dispara e protege a carteira.',
        'The 500 largest US companies, priced in reais. When Brazil hits a crisis, the dollar soars and protects the portfolio.'),
    },
    bitcoin: {
      n: 'Bitcoin', cls: ALT, kind: 'equity', beta: 0.6, sigma: 0.65, crypto: 1, dy: 0, unit: 5000,
      tax: 'cripto', req: 'cripto',
      d: tr('Escasso por design: a cada 4 anos o halving corta a emissão pela metade, e o preço costuma seguir esse ciclo. Quedas de 70% são rotina.',
        'Scarce by design: every 4 years the halving cuts issuance in half, and the price tends to follow that cycle. 70% drops are routine.'),
    },
    altcoins: {
      n: tr('Cesta de altcoins', 'Altcoin basket'), cls: ALT, kind: 'equity', beta: 0.9, sigma: 0.9, crypto: 1.4, drift: -0.25, idioDecay: 0, dy: 0,
      tax: 'cripto', req: 'cripto',
      d: tr('Sobem muito mais que o Bitcoin na euforia e somem no inverno. Muitas vão a zero e não voltam.',
        'Rise far more than Bitcoin in euphoria and vanish in the winter. Many go to zero and never come back.'),
    },

    // Preço da terra (não negociável): inflação + ganho real, puxado pelas commodities (ver agro.js).
    terra: {
      n: tr('Índice de terras', 'Land index'), cls: tr('Terras', 'Land'), kind: 'equity', hidden: true, beta: 0.15, sigma: 0.06, drift: 0.06,
      alpha: { pico: 0.02, recessao: -0.02 },
    },

    // Coleções (não negociáveis na bolsa): dão preço às peças de arte, vinhos e carros (ver life.js).
    arte: { n: tr('Índice de arte', 'Art index'), cls: tr('Coleções', 'Collections'), kind: 'equity', hidden: true, beta: 0.2, sigma: 0.18, drift: 0.06, alpha: { pico: 0.04, recessao: -0.06 } },
    vinhos: { n: tr('Índice de vinhos raros', 'Rare wine index'), cls: tr('Coleções', 'Collections'), kind: 'equity', hidden: true, beta: 0.1, sigma: 0.12, drift: 0.05 },
    classicos: { n: tr('Índice de carros clássicos', 'Classic car index'), cls: tr('Coleções', 'Collections'), kind: 'equity', hidden: true, beta: 0.3, sigma: 0.2, drift: 0.05, alpha: { pico: 0.05, recessao: -0.05 } },

    // Índice imobiliário (não negociável): dá preço aos imóveis físicos (ver realty.js).
    imob: {
      n: tr('Índice imobiliário', 'Real estate index'), cls: tr('Imóveis', 'Real estate'), kind: 'imob', hidden: true, sigma: 0.03, selicD: 2,
      alpha: { recessao: -0.03 },
    },
  };
})();

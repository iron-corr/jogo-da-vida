(function () {
  const G = globalThis.G = globalThis.G || {};

  // kind define como o preço anda (ver market.js). req = pesquisa que desbloqueia.
  // lockDays = carência de cada aplicação. tax = regra de IR (ver tax.js).
  //
  // Ações (kind 'equity'): log-retorno diário = beta × fator de mercado + alpha[regime]
  // + season[estação] + sigma × ruído próprio − selicD × variação da Selic.
  // dy = dividend yield anual, pago divFreq vezes por ano.
  G.ASSETS = {
    poupanca: {
      n: 'Poupança', cls: 'Renda fixa', kind: 'poupanca', tax: 'isento',
      d: 'Liquidez diária, risco zero, isenta de IR. Rende 70% da Selic, ou 6,17% a.a. quando a Selic passa de 8,5%.',
    },
    tesouro_selic: {
      n: 'Tesouro Selic', cls: 'Renda fixa', kind: 'selic', spread: -0.002, tax: 'rf', req: 'edu_fin',
      d: 'Acompanha a Selic, com liquidez diária. O porto seguro; quando a Selic cai, rende menos.',
    },
    cdb: {
      n: 'CDB 108% do CDI', cls: 'Renda fixa', kind: 'cdi', mult: 1.08, lockDays: 360, tax: 'rf', req: 'edu_fin',
      d: 'Rende mais que o Tesouro Selic, mas cada aplicação fica presa por 360 dias. Se o banco quebrar, o FGC cobre até R$ 250 mil.',
    },
    prefixado: {
      n: 'Tesouro Prefixado', cls: 'Renda fixa', kind: 'pre', duration: 3, tax: 'rf', req: 'rf_avancada',
      d: 'Taxa travada. Se os juros de mercado sobem, o preço cai hoje (marcação a mercado); se caem, você ganha. Duration ~3 anos.',
    },
    ipca: {
      n: 'Tesouro IPCA+', cls: 'Renda fixa', kind: 'ipca', duration: 7, tax: 'rf', req: 'rf_avancada',
      d: 'Inflação + juro real. Protege o poder de compra, mas oscila bastante: duration ~7 anos.',
    },

    ibov: {
      n: 'ETF Ibovespa', cls: 'Ações', kind: 'equity', beta: 1, sigma: 0, dy: 0.05, divFreq: 4, tax: 'etf', req: 'rv1',
      d: 'Uma cota com as maiores empresas da bolsa. Diversificado, mas sobe e desce com o ciclo. ETF não tem a isenção de R$ 20 mil.',
    },
    bancos: {
      n: 'Ações de bancos', short: 'bancos', cls: 'Ações', kind: 'equity', beta: 0.9, sigma: 0.18, dy: 0.06, divFreq: 4,
      selicD: -1, alpha: { pico: 0.04, recessao: -0.06 }, tax: 'acao', req: 'setores',
      d: 'Lucram com juros altos e sofrem com a inadimplência na recessão. Bons dividendos.',
    },
    commodities: {
      n: 'Mineração e agro', short: 'mineração e agro', cls: 'Ações', kind: 'equity', beta: 0.8, sigma: 0.28, dy: 0.06, divFreq: 4,
      season: { verao: 0.15, outono: -0.05, inverno: -0.05, primavera: -0.05 }, tax: 'acao', req: 'setores',
      d: 'Seguem os preços globais. Safra forte no verão; sujeitas a superciclos e quedas bruscas.',
    },
    varejo: {
      n: 'Varejo', short: 'varejo', cls: 'Ações', kind: 'equity', beta: 1.4, sigma: 0.3, dy: 0.02, divFreq: 4, selicD: 4,
      alpha: { recuperacao: 0.05 }, season: { verao: -0.05, outono: -0.05, inverno: -0.05, primavera: 0.15 }, tax: 'acao', req: 'setores',
      d: 'Vive de crédito e consumo: brilha no fim de ano e quando os juros caem, sofre quando a Selic sobe.',
    },
    utilities: {
      n: 'Energia elétrica', short: 'energia elétrica', cls: 'Ações', kind: 'equity', beta: 0.4, sigma: 0.08, drift: 0.015, dy: 0.08, divFreq: 4,
      selicD: 1.5, season: { verao: -0.02, outono: -0.02, inverno: 0.06, primavera: -0.02 }, tax: 'acao', req: 'setores',
      d: 'Defensivas: receita regulada, bons dividendos, pouca emoção. O inverno seco encarece a energia.',
    },
    tech: {
      n: 'Tecnologia', short: 'tecnologia', cls: 'Ações', kind: 'equity', beta: 1.7, sigma: 0.4, dy: 0.005, divFreq: 4,
      selicD: 3, alpha: { pico: 0.3, recessao: -0.15 }, tax: 'acao', req: 'setores',
      d: 'Crescimento acelerado e bolhas espetaculares. Quase não paga dividendos.',
    },

    fii: {
      n: 'FIIs (fundos imobiliários)', cls: 'Fundos imobiliários', kind: 'equity', beta: 0.3, sigma: 0.08, drift: 0.01, dy: 0.09, divFreq: 12,
      selicD: 3, tax: 'fii', req: 'rv1',
      d: 'Recebem aluguéis de shoppings, galpões e escritórios e pagam todo mês, isentos de IR. Caem quando a Selic sobe.',
    },

    // Alternativos. drift = retorno próprio (log, a.a.) somado ao efeito de mercado.
    // crypto = sensibilidade ao ciclo do halving. idioDecay 0 = desvio próprio não volta.
    // unit = quantas "cotas" do motor formam uma unidade exibida (1 BTC).
    ouro: {
      n: 'Ouro', cls: 'Alternativos', kind: 'equity', beta: -0.15, sigma: 0.15, drift: 0.07, dy: 0,
      alpha: { pico: 0.03, recessao: 0.12, recuperacao: -0.05 }, tax: 'etf', req: 'ouro_dolar',
      d: 'Não rende nada, mas sobe quando o mundo tem medo. Hedge clássico contra crises e inflação.',
    },
    sp500: {
      n: 'ETF S&P 500 (em dólar)', cls: 'Alternativos', kind: 'equity', beta: 0.35, sigma: 0.17, drift: 0.06, dy: 0.013, divFreq: 4,
      alpha: { recessao: 0.1, recuperacao: -0.04 }, tax: 'etf', req: 'ouro_dolar',
      d: 'As 500 maiores empresas americanas, cotadas em reais. Quando o Brasil entra em crise, o dólar dispara e protege a carteira.',
    },
    bitcoin: {
      n: 'Bitcoin', cls: 'Alternativos', kind: 'equity', beta: 0.6, sigma: 0.65, crypto: 1, dy: 0, unit: 5000,
      tax: 'cripto', req: 'cripto',
      d: 'Escasso por design: a cada 4 anos o halving corta a emissão pela metade, e o preço costuma seguir esse ciclo. Quedas de 70% são rotina.',
    },
    altcoins: {
      n: 'Cesta de altcoins', cls: 'Alternativos', kind: 'equity', beta: 0.9, sigma: 0.9, crypto: 1.4, drift: -0.25, idioDecay: 0, dy: 0,
      tax: 'cripto', req: 'cripto',
      d: 'Sobem muito mais que o Bitcoin na euforia e somem no inverno. Muitas vão a zero e não voltam.',
    },

    // Preço da terra (não negociável): inflação + ganho real, puxado pelas commodities (ver agro.js).
    terra: {
      n: 'Índice de terras', cls: 'Terras', kind: 'equity', hidden: true, beta: 0.15, sigma: 0.06, drift: 0.06,
      alpha: { pico: 0.02, recessao: -0.02 },
    },

    // Coleções (não negociáveis na bolsa): dão preço às peças de arte, vinhos e carros (ver life.js).
    arte: { n: 'Índice de arte', cls: 'Coleções', kind: 'equity', hidden: true, beta: 0.2, sigma: 0.18, drift: 0.06, alpha: { pico: 0.04, recessao: -0.06 } },
    vinhos: { n: 'Índice de vinhos raros', cls: 'Coleções', kind: 'equity', hidden: true, beta: 0.1, sigma: 0.12, drift: 0.05 },
    classicos: { n: 'Índice de carros clássicos', cls: 'Coleções', kind: 'equity', hidden: true, beta: 0.3, sigma: 0.2, drift: 0.05, alpha: { pico: 0.05, recessao: -0.05 } },

    // Índice imobiliário (não negociável): dá preço aos imóveis físicos (ver realty.js).
    imob: {
      n: 'Índice imobiliário', cls: 'Imóveis', kind: 'imob', hidden: true, sigma: 0.03, selicD: 2,
      alpha: { recessao: -0.03 },
    },
  };
})();

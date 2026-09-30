(function () {
  const G = globalThis.G = globalThis.G || {};

  // Ramos da árvore. Alternativos, Gestão e Política & Sociedade entram nos próximos marcos.
  G.BRANCHES = [
    ['pessoal', 'Finanças pessoais'],
    ['carreira', 'Carreira'],
    ['rf', 'Renda fixa'],
    ['rv', 'Renda variável'],
    ['macro', 'Macroeconomia'],
    ['alt', 'Alternativos'],
    ['gestao', 'Gestão'],
    ['sociedade', 'Sociedade'],
    ['politica', 'Política'],
  ];

  // k = custo em conhecimento, cost = custo em R$ (cursos, certificações). req = pré-requisitos.
  G.RESEARCH = [
    // Finanças pessoais
    { id: 'edu_fin', b: 'pessoal', n: 'Educação financeira', k: 8, d: 'Desbloqueia Tesouro Selic, CDB e a aba Mercado.' },
    { id: 'orcamento', b: 'pessoal', n: 'Orçamento doméstico', k: 20, req: ['edu_fin'], d: 'Custo de vida −5%.' },
    { id: 'planilha', b: 'pessoal', n: 'Planilha de patrimônio', k: 35, req: ['orcamento'], d: 'Mostra a evolução do seu patrimônio mês a mês.' },
    { id: 'reserva', b: 'pessoal', n: 'Reserva de emergência', k: 50, req: ['orcamento'], d: 'Mostra quantos meses de gastos sua liquidez cobre. Desempregado com reserva, você busca emprego com calma: +50% de chance.' },
    { id: 'saude', b: 'pessoal', n: 'Rotina saudável', k: 60, req: ['edu_fin'], d: 'Energia máxima +15 e metade do risco de burnout.' },
    { id: 'minimalismo', b: 'pessoal', n: 'Minimalismo', k: 120, req: ['planilha'], d: 'Custo de vida −10% (além do orçamento).' },

    // Carreira
    { id: 'rotina', b: 'carreira', n: 'Rotina', k: 10, d: 'Piloto automático: todo dia sua energia vai sozinha para estudo e/ou hora extra, sempre deixando 25% de reserva (sem risco de burnout).' },
    { id: 'produtividade', b: 'carreira', n: 'Técnicas de estudo', k: 15, d: 'Estudar rende +50% de conhecimento.' },
    { id: 'leitura', b: 'carreira', n: 'Hábito de leitura', k: 30, req: ['produtividade'], d: '+0,25 de conhecimento por dia, sem gastar energia.' },
    { id: 'foco', b: 'carreira', n: 'Trabalho focado', k: 45, req: ['produtividade'], d: 'Estudar custa 10 de energia em vez de 15.' },
    { id: 'cpa20', b: 'carreira', n: 'Certificação CPA-20', k: 60, cost: 600, prestige: 3, req: ['edu_fin'], d: 'Reputação +50% por mês trabalhado.' },
    { id: 'negociacao', b: 'carreira', n: 'Negociação salarial', k: 80, req: ['produtividade'], d: 'Salário +10%.' },
    { id: 'networking', b: 'carreira', n: 'Rede de contatos', k: 150, req: ['cpa20'], d: 'Seus contatos avisam ~60 dias antes de uma virada do ciclo (acertam ~80%).' },
    { id: 'mba', b: 'carreira', n: 'MBA em Finanças', k: 300, cost: 60000, prestige: 10, req: ['negociacao', 'cpa20'], d: 'Salário +10% e reputação +50% por mês.' },
    { id: 'cfa', b: 'carreira', n: 'Certificação CFA', k: 800, cost: 20000, prestige: 15, req: ['mba'], d: 'Salário +15% e +0,5 de conhecimento por dia.' },

    // Renda fixa
    { id: 'rf_avancada', b: 'rf', n: 'Renda fixa avançada', k: 60, req: ['edu_fin'], d: 'Desbloqueia Prefixado e IPCA+ (marcação a mercado).' },
    { id: 'focus', b: 'rf', n: 'Boletim Focus', k: 90, req: ['rf_avancada', 'macro1'], d: 'Mostra a Selic que o mercado espera para daqui a 12 meses.' },
    { id: 'curva', b: 'rf', n: 'Curva de juros', k: 300, req: ['macro2', 'rf_avancada'], d: 'Mostra a inclinação da curva e melhora a leitura de ciclo (~85%).' },

    // Renda variável
    { id: 'rv1', b: 'rv', n: 'Renda variável I', k: 80, req: ['edu_fin'], d: 'Desbloqueia o ETF de Ibovespa e os FIIs. Ações oscilam com o ciclo, mas rendem mais no longo prazo.' },
    { id: 'experiencia', b: 'rv', n: 'Diário de investidor', k: 70, req: ['rv1'], d: 'Todo mês, +1 de conhecimento por ativo diferente na carteira.' },
    { id: 'tributacao', b: 'rv', n: 'Planejamento tributário', k: 100, req: ['rv1'], d: 'Mostra o IR do mês e quanto falta para estourar a isenção de R$ 20 mil em vendas de ações.' },
    { id: 'analise_tecnica', b: 'rv', n: 'Análise gráfica', k: 100, req: ['rv1'], d: 'Desenha a média móvel de 200 dias nos gráficos. Não prevê nada, mas fica bonito.' },
    { id: 'dividendos', b: 'rv', n: 'Estratégia de dividendos', k: 120, req: ['rv1'], d: 'Permite reinvestir dividendos e aluguéis automaticamente.' },
    { id: 'setores', b: 'rv', n: 'Análise setorial', k: 180, req: ['rv1'], d: 'Desbloqueia ações por setor: bancos, mineração e agro, varejo, energia elétrica e tecnologia.' },
    { id: 'sentimento', b: 'rv', n: 'Psicologia de mercado', k: 220, req: ['rv1', 'macro1'], d: 'Mostra o índice de medo e ganância e o P/L da bolsa.' },
    { id: 'fundamentalista', b: 'rv', n: 'Análise fundamentalista', k: 250, req: ['setores'], d: 'Mostra se cada setor está barato ou caro em relação ao próprio histórico. Setores descolados tendem a voltar.' },

    // Macroeconomia
    { id: 'macro1', b: 'macro', n: 'Macroeconomia I', k: 40, req: ['edu_fin'], d: 'Mostra inflação, juro real, próximo Copom e o viés dos juros.' },
    { id: 'pmi', b: 'macro', n: 'Indicadores antecedentes', k: 120, req: ['macro1'], d: 'Mostra o PMI da indústria (antecipa o ciclo) e o desemprego (atrasa o ciclo).' },
    { id: 'macro2', b: 'macro', n: 'Leitura de ciclo', k: 150, req: ['macro1'], d: 'Estima a fase do ciclo econômico todo mês (acerta ~60%).' },

    // Alternativos
    { id: 'ouro_dolar', b: 'alt', n: 'Ouro e dólar', k: 120, req: ['rv1'], d: 'Desbloqueia ouro e o ETF de S&P 500: proteções para quando o Brasil vai mal.' },
    { id: 'cripto', b: 'alt', n: 'Criptoativos', k: 150, req: ['rv1'], d: 'Desbloqueia Bitcoin e altcoins, e mostra quando é o próximo halving.' },
    { id: 'imoveis', b: 'alt', n: 'Mercado imobiliário', k: 200, req: ['rv1'], d: 'Desbloqueia a compra de imóveis físicos: aluguel todo mês, mas vender demora meses.' },
    { id: 'autocustodia', b: 'alt', n: 'Autocustódia', k: 200, req: ['cripto'], d: 'Suas criptos ficam na sua carteira, não na corretora. Protege contra quebra de corretora.' },
    { id: 'financiamento', b: 'alt', n: 'Alavancagem imobiliária', k: 250, req: ['imoveis'], d: 'Permite financiar 80% de um imóvel em 30 anos, com juros fixados na compra (Selic + 3,5%).' },
    { id: 'ciclo_cripto', b: 'alt', n: 'Ciclo do halving', k: 300, req: ['cripto'], d: 'Mostra em que fase do ciclo de 4 anos o mercado cripto está.' },
    { id: 'anjo', b: 'alt', n: 'Investimento-anjo', k: 400, cost: 5000, req: ['imoveis', 'networking'], d: 'Acesso a rodadas de startups. A maioria quebra; uma em trinta vira unicórnio.' },
    { id: 'agro', b: 'alt', n: 'Agronegócio', k: 250, req: ['setores'], d: 'Compre terras: arrende, plante soja ou café, ou crie gado. Nova aba: Terras.' },
    { id: 'safrinha', b: 'alt', n: 'Safrinha', k: 300, req: ['agro'], d: 'Nas fazendas de soja, planta milho logo depois da colheita: uma segunda safra por ano.' },
    { id: 'agro_tec', b: 'alt', n: 'Agricultura de precisão', k: 500, req: ['agro'], d: 'Drones, sensores e sementes melhores: produtividade +15% em todas as terras.' },
    { id: 'due_diligence', b: 'alt', n: 'Due diligence', k: 600, req: ['anjo'], d: 'Os sinais de tração das startups ficam muito mais confiáveis.' },

    // Gestão: automação, negócios e gestora
    { id: 'aporte_auto', b: 'gestao', n: 'Aporte automático', k: 60, req: ['orcamento'], d: 'Defina uma alocação-alvo: todo mês, o que sobrar acima da reserva é investido sozinho.' },
    { id: 'fire', b: 'gestao', n: 'Independência financeira', k: 100, req: ['planilha'], d: 'Mostra seu número FIRE (25× o custo anual) e permite largar o emprego para viver de renda.' },
    { id: 'rebalanceamento', b: 'gestao', n: 'Rebalanceamento', k: 150, req: ['aporte_auto', 'rv1'], d: 'A cada trimestre, vende o que passou do alvo e compra o que ficou para trás.' },
    { id: 'empreendedorismo', b: 'gestao', n: 'Empreendedorismo', k: 250, cost: 10000, req: ['negociacao'], d: 'Abra empresas: lucro todo mês, mas cada uma sem gerente consome sua energia.' },
    { id: 'gestao_pessoas', b: 'gestao', n: 'Gestão de pessoas', k: 400, req: ['empreendedorismo'], d: 'Contrate gerentes: a empresa para de consumir sua energia em troca de 15% do lucro.' },
    { id: 'quant', b: 'gestao', n: 'Robôs quant', k: 700, req: ['rebalanceamento', 'fundamentalista'], d: 'Um robô inclina a alocação conforme um sinal (valor, ciclo, tendência ou contrarian) e rebalanceia todo mês.' },
    { id: 'escala', b: 'gestao', n: 'Escala', k: 900, req: ['gestao_pessoas'], d: 'Cada nova unidade de uma empresa fica só 8% mais cara (em vez de 12%).' },
    { id: 'gestora', b: 'gestao', n: 'Licença de gestora (CVM)', k: 1500, cost: 500000, req: ['cfa', 'rebalanceamento'], d: 'Abra uma gestora: o fundo replica sua estratégia e você cobra 2% ao ano de administração e 20% do que passar do CDI.' },
    // Sociedade
    { id: 'etiqueta', b: 'sociedade', n: 'Etiqueta', k: 60, d: 'Você passa a ser aceito em clubes (academia, Rotary, tênis, golfe, iate).' },
    { id: 'comunicacao', b: 'sociedade', n: 'Comunicação', k: 120, req: ['etiqueta'], d: 'Escreva artigos e, um dia, um livro.' },
    { id: 'disciplina', b: 'sociedade', n: 'Disciplina', k: 200, req: ['produtividade'], d: '+1 vaga de hábito, e hábitos se formam em 45 dias em vez de 66.' },
    { id: 'oratoria', b: 'sociedade', n: 'Oratória', k: 200, req: ['comunicacao'], d: 'Palestras pagas e +30% de visibilidade em tudo que você faz.' },
    { id: 'inteligencia_emocional', b: 'sociedade', n: 'Inteligência emocional', k: 250, req: ['etiqueta'], d: 'O stress sobe 30% menos e o pânico nas quedas acontece metade das vezes.' },
    // Política
    { id: 'ciencia_politica', b: 'politica', n: 'Ciência política', k: 300, req: ['etiqueta'], d: 'Pesquisas eleitorais bem mais precisas.' },
    { id: 'filantropia_estrategica', b: 'politica', n: 'Filantropia estratégica', k: 250, req: ['etiqueta'], d: 'Doações rendem o dobro de imagem pública, e você pode fundar um think tank.' },
    { id: 'relacoes_institucionais', b: 'politica', n: 'Relações institucionais', k: 400, req: ['ciencia_politica'], d: 'Libera o lobby por projetos de lei, e ele custa 20% menos influência.' },
    { id: 'midia', b: 'politica', n: 'Economia da mídia', k: 350, req: ['comunicacao'], d: 'Você pode comprar blog, portal ou canal de TV: influência, imagem e escândalos amenizados.' },
    { id: 'economia_politica', b: 'politica', n: 'Economia política', k: 1500, req: ['ciencia_politica', 'macro2'], d: 'Você passa a ser cotado para a diretoria do Banco Central.' },
    { id: 'compliance', b: 'gestao', n: 'Compliance', k: 800, req: ['gestora'], d: 'Investidores institucionais confiam mais: captação +0,5% ao mês e metade do risco de escândalo.' },
  ];
})();

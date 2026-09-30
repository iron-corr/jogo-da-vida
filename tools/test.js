// Testes das regras de IR, dividendos, carência, imóveis e startups. uso: node tools/test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = vm.createContext({ console });
for (const f of ['rng', 'format', 'calendar', 'data/assets', 'events', 'tax', 'portfolio', 'realty', 'agro', 'angel', 'automation', 'business', 'fund', 'social', 'politics', 'legacy', 'life', 'choices', 'work', 'macro', 'market', 'state'])
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), ctx);
const G = ctx.G;
let ok = true;
const eq = (n, a, b) => {
  const pass = Math.abs(a - b) < 0.01;
  ok = ok && pass;
  console.log(pass ? 'OK   ' : 'FALHA', n, a.toFixed(2), 'esperado', b.toFixed(2));
};
const c = { month: 2 };
let S, cash0;

// 1) ação: venda 50k com lucro 10k -> DARF 15% = 1500
S = G.newState(1); S.research = { setores: 1, edu_fin: 1, rv1: 1 }; S.cash = 40000; G.portfolio.buy(S, 'bancos', 40000);
S.market.prices.bancos *= 1.25; cash0 = S.cash; G.portfolio.sell(S, 'bancos', Infinity); eq('venda ação líquida', S.cash - cash0, 50000);
cash0 = S.cash; G.tax.monthly(S, c); eq('DARF ação >20k', cash0 - S.cash, 1500);

// 2) ação: venda 15k com lucro 3k -> isento
S = G.newState(2); S.research = { setores: 1, edu_fin: 1, rv1: 1 }; S.cash = 12000; G.portfolio.buy(S, 'bancos', 12000); S.market.prices.bancos *= 1.25;
G.portfolio.sell(S, 'bancos', Infinity); cash0 = S.cash; G.tax.monthly(S, c); eq('ação <20k isenta', cash0 - S.cash, 0);

// 3) prejuízo compensa: perde 5k num mês, ganha 10k (vendas >20k) no seguinte -> 15% de 5k
S = G.newState(3); S.research = { setores: 1, edu_fin: 1, rv1: 1 }; S.cash = 100000; G.portfolio.buy(S, 'bancos', 25000); S.market.prices.bancos *= 0.8;
G.portfolio.sell(S, 'bancos', Infinity); G.tax.monthly(S, c); eq('prejuízo guardado', S.tax.carryRv, 5000);
G.portfolio.buy(S, 'tech', 40000); S.market.prices.tech *= 1.25; G.portfolio.sell(S, 'tech', Infinity);
cash0 = S.cash; G.tax.monthly(S, c); eq('DARF após compensação', cash0 - S.cash, 750);

// 4) renda fixa: lucro 1000 em 100 dias -> 22,5% retido
S = G.newState(4); S.research = { edu_fin: 1 }; S.cash = 10000; G.portfolio.buy(S, 'tesouro_selic', 10000); S.day += 100; S.market.prices.tesouro_selic *= 1.1;
cash0 = S.cash; G.portfolio.sell(S, 'tesouro_selic', Infinity); eq('Tesouro líquido (22,5%)', S.cash - cash0, 10775);

// 5) poupança isenta
S = G.newState(5); S.cash = 10000; G.portfolio.buy(S, 'poupanca', 10000); S.market.prices.poupanca *= 1.1;
cash0 = S.cash; G.portfolio.sell(S, 'poupanca', Infinity); eq('poupança isenta', S.cash - cash0, 11000);

// 6) FII: aluguel mensal isento; ganho de capital 20%
S = G.newState(6); S.research = { edu_fin: 1, rv1: 1 }; S.cash = 12000; G.portfolio.buy(S, 'fii', 12000);
cash0 = S.cash; G.portfolio.payDividends(S, { month: 3 }); eq('aluguel FII mensal', S.cash - cash0, 90);
S.market.prices.fii *= 1.5; G.portfolio.sell(S, 'fii', Infinity); cash0 = S.cash; G.tax.monthly(S, c); eq('DARF FII 20%', cash0 - S.cash, 1200);

// 7) CDB em carência não vende
S = G.newState(7); S.research = { edu_fin: 1 }; S.cash = 1000; G.portfolio.buy(S, 'cdb', 1000); eq('CDB preso', G.portfolio.sell(S, 'cdb', Infinity), 0);

// 8) cripto: vendas até 35k isentas; acima, 15% do lucro
S = G.newState(8); S.research = { edu_fin: 1, rv1: 1, cripto: 1 }; S.cash = 100000; G.portfolio.buy(S, 'bitcoin', 25000); S.market.prices.bitcoin *= 1.2;
G.portfolio.sell(S, 'bitcoin', Infinity); cash0 = S.cash; G.tax.monthly(S, c); eq('cripto <35k isenta', cash0 - S.cash, 0);
G.portfolio.buy(S, 'bitcoin', 40000); S.market.prices.bitcoin *= 1.25; G.portfolio.sell(S, 'bitcoin', Infinity);
cash0 = S.cash; G.tax.monthly(S, c); eq('DARF cripto >35k', cash0 - S.cash, 1500);

// 9) imóvel financiado: entrada 20% + ITBI 3%; parcela Price; a venda quita o saldo e paga 6% de corretagem
S = G.newState(9); S.research = { imoveis: 1, financiamento: 1 }; S.cash = 200000; S.market.prices.imob = 100;
const apto = G.realty.prop('apto'), q = G.realty.quote(S, apto, true);
eq('entrada apto', q.upfront, 450000 * 0.23);
eq('parcela Price', q.pmt, G.realty.payment(360000, S.macro.selic + 0.035, 360));
cash0 = S.cash; G.realty.buy(S, 'apto', true); eq('caixa após compra', cash0 - S.cash, 103500);
const bal0 = S.realty[0].loan.bal;
G.realty.monthly(S); eq('saldo cai após 1 parcela', bal0 > S.realty[0].loan.bal ? 1 : 0, 1);
eq('patrimônio líquido do imóvel', G.realty.equity(S), 450000 - S.realty[0].loan.bal);
const bal = S.realty[0].loan.bal;
G.realty.sell(S, 0); cash0 = S.cash;
for (let i = 0; i < 400 && S.realty.length; i++) { S.day++; G.realty.daily(S); }
eq('venda: 94% do valor menos saldo', S.cash - cash0, 450000 * 0.94 - bal);

// 10) startup: cheque de 25k que vira 3x paga 15% sobre o lucro
S = G.newState(10); S.research = { anjo: 1 }; S.cash = 30000;
S.angel.deals = [{ name: 'Teste', pitch: '', ticket: 25000, until: S.day + 90, signal: 'forte', mult: 3, exit: 10 }];
G.angel.invest(S, 0); eq('cheque debitado', S.cash, 5000);
S.day += 10; cash0 = S.cash; G.angel.monthly(S); // monthly também abre rodadas novas, mas não gasta caixa
eq('saída 3x líquida', S.cash - cash0, 75000 - 7500);

// 11) ativos sem dividendo (ouro, cripto) não geram pagamento nem NaN
S = G.newState(11); S.research = { rv1: 1, ouro_dolar: 1, cripto: 1 }; S.cash = 20000;
G.portfolio.buy(S, 'ouro', 10000); G.portfolio.buy(S, 'bitcoin', 10000);
cash0 = S.cash; G.portfolio.payDividends(S, { month: 4 }); eq('sem dividendo em ouro/cripto', S.cash - cash0, 0);

// 12) aporte automático: investe o que passa da reserva, na proporção dos alvos
S = G.newState(12); S.research = { edu_fin: 1, aporte_auto: 1 }; S.cash = 10000;
Object.assign(S.auto, { on: true, reserve: 0, targets: { tesouro_selic: 30, poupanca: 10 } });
G.auto.monthly(S, { month: 2 });
eq('aporte no Tesouro (75%)', G.portfolio.value(S, 'tesouro_selic'), 7500);
eq('aporte na poupança (25%)', G.portfolio.value(S, 'poupanca'), 2500);

// 13) rebalanceamento: 80/20 com alvo 50/50 volta para 50/50
S = G.newState(13); S.research = { edu_fin: 1, aporte_auto: 1, rebalanceamento: 1 }; S.cash = 10000;
G.portfolio.buy(S, 'tesouro_selic', 8000); G.portfolio.buy(S, 'poupanca', 2000);
Object.assign(S.auto, { rebal: true, targets: { tesouro_selic: 50, poupanca: 50 } });
G.auto.monthly(S, { month: 1 });
eq('rebalanceado: Tesouro', G.portfolio.value(S, 'tesouro_selic'), 5000);
eq('rebalanceado: poupança', G.portfolio.value(S, 'poupanca'), 5000);

// 14) robô "valor": com a bolsa cara (P/L 18), a fatia de ações cai pela metade
S = G.newState(14); S.research = { edu_fin: 1, rv1: 1, aporte_auto: 1, quant: 1 };
Object.assign(S.auto, { robot: 'valor', targets: { ibov: 60, tesouro_selic: 40 } });
S.market.prices.ibov = 100 * Math.exp(Math.log(2)); S.market.trend = Math.log(100);
eq('robô valor: ações 30%', G.auto.targets(S).ibov, 0.3);

// 15) empresas: preço cresce 12% por unidade; lucro segue ciclo, estação e imposto
S = G.newState(15); S.research = { empreendedorismo: 1 }; S.cash = 200000; S.macro.regime = 'expansao'; S.day = 0;
const ft = G.business.biz('foodtruck');
G.business.open(S, 'foodtruck'); eq('preço 2ª unidade', G.business.price(S, ft), 60000 * 1.12);
eq('lucro mensal (verão, expansão)', G.business.monthlyProfit(S), 1500 * 1.1 * 1.3 * 0.85);
S.energy = 100; G.business.daily(S); eq('empresa sem gerente consome energia', S.energy, 97);

// 16) gestora: mês em que o fundo rende 1% (acima do CDI) cobra adm + performance
S = G.newState(16); S.research = { edu_fin: 1, gestora: 1, aporte_auto: 1 }; S.reputation = 10;
Object.assign(S.auto, { targets: { tesouro_selic: 100 } });
G.fund.open(S); eq('capital inicial mínimo', S.fund.aum, 5e6);
S.market.prices.tesouro_selic *= 1.01; cash0 = S.cash; G.fund.monthly(S);
const cdiM = Math.pow(1 + S.macro.selic - 0.001, 1 / 12) - 1;
const fees = 5e6 * 1.01 * 0.02 / 12 + 0.2 * (0.01 - cdiM) * 5e6;
eq('gestora pequena dá prejuízo (sem imposto)', S.fund.lastProfit, fees - 25000 - (5e6 * 1.01 - fees) * 0.002 / 12);
// com R$ 50 mi, as taxas pagam a estrutura e o lucro paga 34%
S.fund.aum = 5e7; S.fund.snap = { ...S.market.prices }; S.market.prices.tesouro_selic *= 1.01; G.fund.monthly(S);
eq('gestora grande lucra (com 34% de imposto)', S.fund.lastProfit > 0 ? 1 : 0, 1);

// 17) piloto automático: estuda até sobrar 25% de energia e nunca causa burnout
S = G.newState(17); S.research = { rotina: 1 }; S.routine = 'estudar'; S.energy = 100; S.knowledge = 0;
G.work.autopilot(S);
eq('piloto: estudou 5 vezes (100 → 25)', S.knowledge, 5);
eq('piloto: energia na reserva', S.energy, 25);
let burn = 0;
for (let d = 0; d < 3600; d++) { G.work.daily(S); G.work.autopilot(S); if (S.burnout > 0) burn++; }
eq('piloto: nenhum burnout em 10 anos', burn, 0);
S.routine = 'misto'; S.energy = 100; cash0 = S.cash; S.knowledge = 0; G.work.autopilot(S);
eq('piloto misto: estuda e faz hora extra', S.knowledge > 0 && S.cash > cash0 ? 1 : 0, 1);

// 18) piloto desempregado procura emprego mesmo no modo "estudar"
S = G.newState(18); S.research = { rotina: 1 }; S.routine = 'estudar'; S.job.employed = false; S.reputation = 400;
for (let d = 0; d < 60 && !S.job.employed; d++) { G.work.daily(S); G.work.autopilot(S); }
eq('piloto achou emprego', S.job.employed ? 1 : 0, 1);

// 19) dívida acima do limite do cheque especial paga 2% a.m., não 8%
S = G.newState(19); S.cash = -100000; S.job.employed = false; S.job.retired = true;
const cost19 = G.work.cost(S);
G.work.monthly(S, { month: 5 }); G.work.settle(S);
const debt19 = 100000 + cost19;
eq('juros com limite', -S.cash - debt19, 6 * cost19 * 0.08 + (debt19 - 6 * cost19) * 0.02);

// 20) hábito: 66 dias pagando energia para formar; depois dá o efeito
S = G.newState(20); S.energy = 100;
G.social.startHabit(S, 'exercicio');
for (let d = 0; d < 65; d++) { S.energy = 100; G.social.daily(S); }
eq('ainda formando no dia 65', S.social.habits.exercicio.state === 'forming' ? 1 : 0, 1);
S.energy = 100; G.social.daily(S);
eq('formado no dia 66', G.social.has(S, 'exercicio') ? 1 : 0, 1);
eq('exercício: +20 de energia máxima', G.work.emax(S), 120);
eq('vagas de hábito no início', G.social.slots(S), 2);

// 21) tentação sem vaga livre não pode ser aceita
G.social.startHabit(S, 'leitura');
S.social.pending = { type: 'tempt', id: 'bets', until: S.day + 30 };
G.social.decide(S, true);
eq('tentação recusada por falta de vaga', S.social.habits.bets ? 1 : 0, 0);

// 22) pânico: aceitar vende todos os ativos de risco e mantém a renda fixa
S = G.newState(22); S.research = { edu_fin: 1, rv1: 1 }; S.cash = 20000;
G.portfolio.buy(S, 'ibov', 10000); G.portfolio.buy(S, 'tesouro_selic', 10000);
S.social.pending = { type: 'panic', until: S.day + 30 };
G.social.decide(S, true);
eq('pânico vendeu a bolsa', G.portfolio.value(S, 'ibov'), 0);
eq('pânico manteve o Tesouro', G.portfolio.value(S, 'tesouro_selic'), 10000);

// 23) família: casar +40% e cada filho +25% no custo de vida
S = G.newState(23); const base23 = G.work.cost(S); S.cash = 1e6;
G.social.marry(S, false); G.social.haveKid(S);
eq('custo casado com 1 filho', G.work.cost(S) / base23, 1.4 * 1.25);

// 24) doação: prestígio cresce com a raiz do valor doado
S = G.newState(24); S.cash = 1e6; G.social.donate(S, 100000);
eq('prestígio por R$ 100 mil doados', S.social.prestige, 5);

// 25) doação oficial tem limite de 10% da renda anual; caixa 2 passa do limite e suja
S = G.newState(25); S.cash = 1e6;
const lim25 = G.politics.legalLimit(S);
G.politics.donate(S, 'austero', 1e6, false);
eq('doação oficial travada no limite', S.pol.backed.austero.legal, lim25);
G.politics.donate(S, 'austero', 100000, true);
eq('caixa 2 registrado', S.pol.backed.austero.dirty, 100000);
eq('caixa 2 gera sujeira', S.pol.dirty, 0.1);
const w25 = G.politics.weights(S);
eq('doação aumenta a chance', w25.austero > 0.2 ? 1 : 0, 1);

// 26) eleição: quem apoiou o vencedor ganha influência e acesso; redistributivo revoga isenções
S = G.newState(26); S.pol.backed = { redistributivo: { legal: 1e9, dirty: 0 } }; S.pol.passed.isencao_acoes = true;
const pick26 = G.rng.pick; G.rng.pick = () => 'redistributivo'; G.politics.runElection(S); G.rng.pick = pick26;
eq('venceu quem recebeu R$ 1 bi', S.macro.policy === 'redistributivo' ? 1 : 0, 1);
eq('acesso ao governo', S.pol.access ? 1 : 0, 1);
eq('isenção revogada', G.tax.exemptSales(S), 20000);
eq('dividendos pagam 15% sob redistributivo', G.politics.dividendTax(S, 'bancos', 1000), 0.15);

// 27) lobby aprovado muda a regra do jogo
S = G.newState(27); S.research = { relacoes_institucionais: 1 }; S.pol.influence = 100; S.pol.image = 100;
G.politics.startLobby(S, 'isencao_acoes');
eq('influência gasta (30 × 0,8)', S.pol.influence, 76);
for (let m = 0; m < 6; m++) G.politics.monthly(S, { month: 3, year: 2027 });
eq('isenção de ações sobe para 60 mil', G.tax.exemptSales(S), 60000);

// 28) escândalo: multa, imagem e influência caem, cargo é perdido
S = G.newState(28); S.cash = 1e7; S.pol.dirty = 2; S.pol.influence = 100; S.pol.office = { id: 'conselho', until: S.day + 700 };
cash0 = S.cash; G.politics.scandal(S);
eq('multa = (3% + 4% por ponto de sujeira) do líquido', cash0 - S.cash, 1e7 * 0.11);
eq('imagem −30', S.pol.image, -30);
eq('perdeu o cargo', S.pol.office ? 1 : 0, 0);

// 29) diretor do BC "dovish": Selic-alvo 2 pontos menor, inflação-alvo maior
S = G.newState(29); const t0 = G.macro.target(S); S.pol.bcBias = -0.02; const t1 = G.macro.target(S);
eq('Selic-alvo −2 p.p.', t1.selic - t0.selic, -0.02);
eq('inflação-alvo +1,6 p.p.', Math.round((t1.infl - t0.infl) * 1e4) / 1e4, 0.016);

// 30) pontos de legado: raiz do patrimônio real + prestígio; sem filhos, metade
S = G.newState(30); S.cash = 1e8; S.social.prestige = 100;
eq('PL sem filhos (31+5)/2', G.legacy.points(S), 18);
S.social.family.kids = 1;
eq('PL com herdeiro', G.legacy.points(S), 36);

// 31) sucessão: mundo continua, herança de 2% − ITCMD, pesquisas de berço
S = G.newState(31); S.day = 20000; S.cash = 1e8; S.social.family.kids = 1; S.legacy.up = { educacao: 1 };
const selic31 = S.macro.selic, lp31 = G.legacy.points(S);
const heir = G.legacy.succeed(S, 'aposentadoria');
eq('herdeiro no mesmo dia do mundo', heir.day, 20000);
eq('mesma Selic', heir.macro.selic, selic31);
eq('herança 30% com 8% de ITCMD', heir.cash - 300 * heir.macro.priceIndex, 1e8 * 0.3 * 0.92);
eq('PL somados', heir.legacy.lp, lp31);
eq('geração 2', heir.legacy.generation, 2);
eq('idade do herdeiro', G.legacy.age(heir), 22);
eq('educação de berço', heir.research.rotina && heir.research.edu_fin ? 1 : 0, 1);
eq('carreira zerada', heir.job.level, 0);

// 32) conquista dá +3 PL uma única vez
S = G.newState(32); S.cash = 2e6; G.legacy.checkAchievements(S); const lp32 = S.legacy.lp;
G.legacy.checkAchievements(S);
eq('conquista não conta duas vezes', S.legacy.lp, lp32);
eq('milhão conquistado', S.legacy.ach.milhao !== undefined ? 1 : 0, 1);

// 33) family office reduz IR; bolsa exige Lenda e é única
S = G.newState(33); S.legacy.up.family_office = 2;
eq('IR com family office nível 2', G.tax.flat(S, 1000), 150 * 0.81);
S.research.empreendedorismo = true; S.cash = 1e12;
G.business.open(S, 'bolsa'); eq('bolsa bloqueada sem Lenda', G.business.count(S, 'bolsa'), 0);
S.social.prestige = 2000; G.business.open(S, 'bolsa'); G.business.open(S, 'bolsa');
eq('bolsa comprada uma vez só', G.business.count(S, 'bolsa'), 1);

// 34) venda de empresa: 90% do preço de reposição, ajustado pelo ciclo (antes: lucro × múltiplo, ~15% do pago)
S = G.newState(34); S.research = { empreendedorismo: 1 }; S.cash = 1e9; S.macro.regime = 'expansao';
for (let i = 0; i < 5; i++) G.business.open(S, 'fabrica');
const paid5 = 20e6 * Math.pow(1.12, 4);
eq('5ª fábrica custou 20 mi × 1,12⁴', S.biz.cost.fabrica - 20e6 * (Math.pow(1.12, 4) - 1) / 0.12, paid5);
eq('venda na expansão: 90% da última', G.business.saleValue(S, G.business.biz('fabrica')), paid5 * 0.9);
S.macro.regime = 'recessao';
eq('venda na recessão: 75% × 90%', G.business.saleValue(S, G.business.biz('fabrica')), paid5 * 0.9 * 0.75);
cash0 = S.cash; G.business.sell(S, 'fabrica');
eq('não sobra IR sobre prejuízo', S.cash - cash0, paid5 * 0.9 * 0.75);
eq('4 fábricas restantes', G.business.count(S, 'fabrica'), 4);

// 35) terras: compra com ITBI, arrendamento mensal com IR, soja planta em outubro e colhe em fevereiro
S = G.newState(35); S.research = { agro: 1 }; S.market.prices.terra = 100; S.cash = 30e6;
G.agro.buy(S, 'mato_grosso');
eq('fazenda MT + 3% de ITBI', 30e6 - S.cash, 25e6 * 1.03);
cash0 = S.cash; G.agro.monthly(S, { month: 3 });
eq('arrendamento: 4% a.a. − 15% de IR', S.cash - cash0, 25e6 * 0.04 / 12 * 0.85);
G.agro.setCrop(S, 0, 'soja'); S.cash = 1e7;
cash0 = S.cash; G.agro.monthly(S, { month: 10 });
eq('plantio: insumos = 50% da receita esperada', cash0 - S.cash, 25e6 * 0.2 * 0.5);
eq('colheita marcada para fevereiro', S.agro.lands[0].planted.harvest, 2);
const pick35 = G.agro.weather; G.agro.weather = () => ['normal', 1]; const cf35 = G.agro.commodityFactor; G.agro.commodityFactor = () => 1;
cash0 = S.cash; G.agro.monthly(S, { month: 2 });
eq('colheita normal: 5 mi de receita, 15% de IR sobre 2,5 mi de lucro', S.cash - cash0, 5e6 - 2.5e6 * 0.15);
G.agro.weather = pick35; G.agro.commodityFactor = cf35;
eq('sem gerente, a fazenda consome energia', G.agro.drain(S), 6);
G.agro.setCrop(S, 0, 'arrendar'); eq('arrendada não consome energia', G.agro.drain(S), 0);

// 36) gestora: vale ~3% do AUM (sem picos), pode ser vendida e tem quarentena
S = G.newState(36); S.research = { edu_fin: 1, rv1: 1, gestora: 1, aporte_auto: 1 }; S.reputation = 300; S.macro.regime = 'expansao';
Object.assign(S.auto, { targets: { ibov: 60, tesouro_selic: 40 } });
G.fund.open(S); S.fund.aum = 2e8;
const vals36 = [];
for (let d = 0; d < 360 * 3; d++) {
  S.day++; G.macro.step(S); G.market.step(S);
  if (G.cal.of(S.day).dom === 1) { G.fund.monthly(S); vals36.push(G.fund.value(S)); }
}
let jump36 = 0;
for (let i = 25; i < vals36.length; i++) jump36 = Math.max(jump36, Math.abs(vals36[i] / vals36[i - 1] - 1));
eq('valor da gestora sem picos (<25% ao mês)', jump36 < 0.25 ? 1 : 0, 1);
eq('valor = 3% do AUM com 2+ anos e lucro', G.fund.value(S) / S.fund.aum, S.fund.profits.reduce((a, b) => a + b, 0) >= 0 ? 0.03 : 0.015);
S.macro.regime = 'expansao'; const sale36 = G.fund.saleValue(S);
cash0 = S.cash; G.fund.sell(S);
eq('venda: valor − 15% de IR', S.cash - cash0, sale36 * 0.85);
eq('gestora vendida', S.fund ? 1 : 0, 0);
G.fund.open(S); eq('quarentena impede reabrir', S.fund ? 1 : 0, 0);
S.day += 1800; G.fund.open(S); eq('reabre após 5 anos', S.fund ? 1 : 0, 1);

// 37) financiar empresa: 30% de entrada, parcela pós-fixada, dívida no patrimônio, venda quita
S = G.newState(37); S.research = { empreendedorismo: 1 }; S.cash = 10e6; S.macro.regime = 'expansao'; S.macro.selic = 0.1;
const nw37 = G.portfolio.netWorth(S);
G.business.open(S, 'fabrica', true);
eq('entrada de 30%', 10e6 - S.cash, 20e6 * 0.3);
eq('dívida de 70%', G.business.debt(S), 14e6);
eq('patrimônio: valor da fábrica − dívida', G.portfolio.netWorth(S) - nw37, 20e6 * 0.9 - 20e6);
const pmt37 = G.business.monthlyPayments(S);
eq('parcela Price a Selic + 5%', pmt37, G.realty.payment(14e6, 0.15, 120));
S.macro.selic = 0.14;
eq('Selic sobe, parcela sobe', G.business.monthlyPayments(S) > pmt37 ? 1 : 0, 1);
S.pol.influence = 60;
eq('BNDES com influência: Selic + 2%', G.business.loanRate(S), 0.16);
cash0 = S.cash; const debt37 = G.business.debt(S); G.business.sell(S, 'fabrica');
eq('venda quita a dívida', G.business.debt(S), 0);
eq('caixa: venda − IR − quitação', S.cash - cash0, 20e6 * 0.9 - debt37);

// 38) gestora: dividendos entram na cota do fundo
S = G.newState(38); S.research = { edu_fin: 1, rv1: 1, gestora: 1, aporte_auto: 1 }; S.reputation = 10;
Object.assign(S.auto, { targets: { fii: 100 } });
G.fund.open(S); G.fund.monthly(S);
eq('fundo de FII rende o aluguel (menos 2% a.a. de taxa) com preço parado (em bp)', S.fund.rets[0].fund * 1e4, (1.0075 * (1 - 0.02 / 12) - 1) * 1e4);

// 39) caixa negativo vende ações antes do cheque especial
S = G.newState(39); S.research = { edu_fin: 1, rv1: 1 }; S.cash = 100000; G.portfolio.buy(S, 'ibov', 100000);
S.cash = -30000; G.work.settle(S);
eq('vendeu ações e zerou o saldo negativo', S.cash >= 0 ? 1 : 0, 1);
eq('ainda sobrou ação', G.portfolio.value(S, 'ibov') > 60000 ? 1 : 0, 1);

// 40) divórcio: 40% da carteira na hora, 40% dos imóveis em 24 parcelas
S = G.newState(40); S.research = { edu_fin: 1, imoveis: 1 }; S.cash = 1e6; S.market.prices.imob = 100;
G.portfolio.buy(S, 'tesouro_selic', 500000); G.realty.buy(S, 'kitnet', false);
S.social.family.married = true; const cash40 = S.cash;
G.S = S; G.social.divorce(S);
eq('carteira: sobram 60%', G.portfolio.value(S, 'tesouro_selic'), 300000);
eq('caixa: 60% do caixa anterior', S.cash, cash40 * 0.6);
eq('partilha dos imóveis em parcelas', S.social.family.partilha.bal, 0.4 * 180000);
eq('parcela entra nas saídas do mês', G.social.partilhaPayment(S), 0.4 * 180000 / 24);

// 41) gasto voluntário não gera stress; queda da bolsa gera
S = G.newState(41); S.cash = 1e6; S.social.lastNW = G.portfolio.netWorth(S); S.social.stress = 10;
G.social.buyLuxury(S, 'carro'); G.social.monthly(S);
eq('carro importado não estressa', S.social.stress <= 10 ? 1 : 0, 1);
S.social.lastNW = G.portfolio.netWorth(S) * 1.3; S.social.stress = 10; G.social.monthly(S);
eq('perda de 23% estressa', S.social.stress > 30 ? 1 : 0, 1);

// 42) herdeiro mantém estratégia e preferências
S = G.newState(42); S.social.family.kids = 1; S.auto.targets = { ibov: 60 }; S.routine = 'misto'; S.settings.reinvest = true;
const heir42 = G.legacy.succeed(S, 'aposentadoria');
eq('alvos preservados', heir42.auto.targets.ibov, 60);
eq('piloto preservado', heir42.routine === 'misto' ? 1 : 0, 1);
eq('reinvestir preservado', heir42.settings.reinvest ? 1 : 0, 1);

// 43) pausa automática em evento importante
S = G.newState(43); S.speed = 5; G.alert(S, 'teste');
eq('alerta pausa o jogo', S.speed, 0);
S.speed = 5; S.settings.autoPause = false; G.alert(S, 'teste');
eq('pausa automática desligável', S.speed, 5);

// 44) subsídio setorial também vale para empresas do setor (+15%)
S = G.newState(44); S.research = { empreendedorismo: 1 }; S.cash = 1e6; S.macro.regime = 'expansao';
G.business.open(S, 'padaria'); const p44 = G.business.monthlyProfit(S);
S.pol.passed.subsidio = { sector: 'varejo', until: S.day + 1440 };
eq('padaria subsidiada lucra +15%', G.business.monthlyProfit(S) / p44, 1.15);

// 45) bem-estar: base 50 − stress/2, casado +8, pet +4; vira pontos de legado
S = G.newState(45); S.social.stress = 20; S.social.family.married = true; S.life.pet = { name: 'X', born: 0, dies: 1e9 };
eq('índice de bem-estar', G.life.wellbeing(S), 50 - 10 + 8 + 4);
S.life.wellSum = 70 * 720; S.life.wellN = 720; S.day = 60 * 360;
eq('PL por uma vida boa (média 70, 60 anos)', G.life.wellPoints(S), 22);

// 46) plano premium: imprevisto médico custa 5%; +2 anos de vida uma vez só
S = G.newState(46); const life46 = S.lifespan;
G.life.setPlan(S, 'premium'); G.life.setPlan(S, 'basico'); G.life.setPlan(S, 'premium');
eq('premium +2 anos uma vez', S.lifespan - life46, 2);
eq('imprevisto com premium ×0,05', G.life.medMult(S), 0.05);

// 47) morar no próprio imóvel corta 40% do custo de vida (se o imóvel for grande o bastante)
S = G.newState(47); S.research = { imoveis: 1 }; S.cash = 1e6; S.market.prices.imob = 100;
const cost47 = G.work.cost(S);
G.realty.buy(S, 'kitnet', false); G.life.moveIn(S, 0);
eq('custo de vida morando no próprio imóvel', G.work.cost(S) / cost47, 0.6);
eq('imóvel onde mora não rende aluguel', G.realty.monthlyNet(S).rent, 0);
S.lifestyle = 5; eq('cobertura: kitnet pequena demais, sem desconto', G.life.homeOk(S) ? 1 : 0, 0);

// 48) coleção entra no patrimônio; leilão cobra 10% e IR sobre o ganho
S = G.newState(48); S.cash = 100000; const nw48 = G.portfolio.netWorth(S);
G.life.buyLot(S, 'arte', 0);
eq('peça de arte no patrimônio', G.portfolio.netWorth(S), nw48);
S.market.prices.arte *= 2; G.life.sellLot(S, 0); cash0 = S.cash;
for (let d = 0; d < 200 && S.life.collections.length; d++) { S.day++; G.life.daily(S); }
eq('leilão: 90% de 100 mil − 15% sobre 40 mil de ganho', S.cash - cash0, 90000 - 0.15 * 40000);

// 49) ano sabático: sem salário e sem demissão, cargo mantido
S = G.newState(49); S.day = 2000; S.job.since = 0; S.cash = 1e5;
G.work.sabbatical(S); cash0 = S.cash;
G.work.monthly(S, { month: 5 });
eq('sabático: só o custo de vida sai', cash0 - S.cash, G.work.cost(S));
eq('sabático: continua empregado', S.job.employed ? 1 : 0, 1);
S.day += 361; G.work.monthly(S, { month: 5 });
eq('fim do sabático', S.job.sabbatical ? 1 : 0, 0);

// 50) carta de escolha: prazo vencido aplica a opção padrão (recusar = +2 de reputação)
S = G.newState(50); G.S = S; S.reputation = 20;
G.choices.offer(S, 'headhunter');
S.day = S.social.pending.until; S.social.pending.until = S.day;
G.social.decide(S, null);
eq('headhunter recusado por padrão', S.reputation, 22);
eq('carta em espera', S.life.cd.headhunter > S.day ? 1 : 0, 1);
G.choices.offer(S, 'headhunter'); const sal50 = G.work.salary(S); G.social.decide(S, 0);
eq('aceitar headhunter: +20% de salário', G.work.salary(S) / sal50, 1.2);

// 51) férias: uma vez por ano, energia cheia e sem ações manuais
S = G.newState(51); S.cash = 1e5; S.social.stress = 40;
G.life.vacation(S, 'praia');
eq('stress −15 nas férias', S.social.stress, 25);
eq('sem estudar de férias', G.work.canAct(S, 1) ? 1 : 0, 0);
G.life.vacation(S, 'europa'); eq('só uma viagem por ano', S.life.bucket.europa ? 1 : 0, 0);

console.log(ok ? '\nTODOS OK' : '\nHÁ FALHAS');
process.exitCode = ok ? 0 : 1;

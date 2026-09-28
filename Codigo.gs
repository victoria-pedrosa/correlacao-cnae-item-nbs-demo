/**
 * Consulta de Correlação Fiscal (CNAE x Item LC 116 x NBS x cIndOp x cClassTrib)
 * Planilha: Correlacao_Item_NBS_cClassTrib
 * Abas usadas: "CNAE x Item" e "Consulta" (a aba INDICE_CNAE não é mais necessária)
 */

const ABA_CNAE = 'CNAE x Item';
const ABA_CONSULTA = 'Consulta';
const CACHE_VERSAO = 'v3'; // troque o número se atualizar as abas, para limpar o cache

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Consulta de Correlação Fiscal')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Deixa só os números: "7112-0/00", "7112000" e "7112.0-00" viram "7112000" */
function soDigitos_(txt) {
  return String(txt || '').replace(/\D/g, '');
}

/** Coloca a máscara oficial: 7112000 -> 7112-0/00 */
function mascaraCnae_(d) {
  d = soDigitos_(d);
  if (d.length !== 7) return d;
  return d.slice(0, 4) + '-' + d.slice(4, 5) + '/' + d.slice(5);
}

/** Tira acento e deixa minúsculo, para a busca por palavra */
function normalizar_(txt) {
  return String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Lê uma aba como texto exibido (preserva 01.01, 000001 etc.) */
function lerAba_(nome) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!aba) throw new Error('Aba "' + nome + '" não encontrada na planilha.');
  const ult = aba.getLastRow();
  if (ult < 2) return [];
  return aba.getRange(2, 1, ult - 1, aba.getLastColumn()).getDisplayValues();
}

/**
 * Lista de CNAEs para as sugestões enquanto digita.
 * Retorna [{c:'7112-0/00', d:'7112000', t:'Serviços de engenharia', i:['07.01','07.03',...]}]
 */
function getIndiceCnae() {
  const cache = CacheService.getScriptCache();
  const chave = 'indice_cnae_' + CACHE_VERSAO;
  const guardado = cache.get(chave);
  if (guardado) return JSON.parse(guardado);

  const linhas = lerAba_(ABA_CNAE); // A=CNAE B=Descrição C=Item D=Descrição item
  const mapa = {};
  linhas.forEach(function (l) {
    const dig = soDigitos_(l[0]);
    if (dig.length !== 7) return;
    if (!mapa[dig]) mapa[dig] = { c: mascaraCnae_(dig), d: dig, t: String(l[1]).trim(), i: [] };
    const item = String(l[2]).trim();
    if (item && mapa[dig].i.indexOf(item) === -1) mapa[dig].i.push(item);
  });
  const lista = Object.keys(mapa).sort().map(function (k) { return mapa[k]; });
  try { cache.put(chave, JSON.stringify(lista), 21600); } catch (e) { /* cache é só atalho */ }
  return lista;
}

/**
 * Busca principal. Aceita:
 *  - CNAE com ou sem máscara (7112000, 7112-0/00, 7112-0)
 *  - Item da lista (07.01, 0701, 7.01)
 *  - Palavra-chave (engenharia, software...)
 */
function buscar(termo) {
  termo = String(termo || '').trim();
  if (!termo) return { tipo: 'vazio' };

  const indice = getIndiceCnae();
  const dig = soDigitos_(termo);
  const temLetra = /[a-zà-ú]/i.test(termo);

  // 1) Item da lista: 07.01 / 7.01 / 0701
  const mItem = termo.match(/^(\d{1,2})[.,](\d{2})$/) || (!temLetra && dig.length === 4 && /^\d{4}$/.test(termo) ? [null, dig.slice(0, 2), dig.slice(2)] : null);
  if (mItem) {
    const item = ('0' + mItem[1]).slice(-2) + '.' + mItem[2];
    const itens = montarItens_([item]);
    if (itens.some(function (x) { return x.nbs.length; })) return { tipo: 'item', titulo: 'Item ' + item, itens: itens };
    // se não achou como item, continua tentando como CNAE (4 dígitos = começo de CNAE)
  }

  // 2) CNAE completo
  if (!temLetra && dig.length === 7) {
    const cnae = indice.filter(function (x) { return x.d === dig; })[0];
    if (!cnae) return { tipo: 'nao_encontrado', termo: mascaraCnae_(dig) };
    return { tipo: 'cnae', cnae: cnae, itens: montarItens_(cnae.i) };
  }

  // 3) Começo de CNAE ou palavra-chave: devolve a lista de CNAEs para escolher
  const q = normalizar_(termo);
  const palavras = q.split(/\s+/).filter(String);
  const achados = indice.filter(function (x) {
    if (!temLetra && dig) return x.d.indexOf(dig) === 0;
    const alvo = normalizar_(x.t);
    return palavras.every(function (p) { return alvo.indexOf(p) !== -1; });
  });
  if (!achados.length) return { tipo: 'nao_encontrado', termo: termo };
  if (achados.length === 1) return { tipo: 'cnae', cnae: achados[0], itens: montarItens_(achados[0].i) };
  return { tipo: 'lista', termo: termo, cnaes: achados.slice(0, 50), total: achados.length };
}

/** Junta, para cada item, as linhas da aba Consulta (NBS, cIndOp, cClassTrib) */
function montarItens_(listaItens) {
  if (!listaItens || !listaItens.length) return [];
  const linhas = lerAba_(ABA_CONSULTA); // A Item B Desc C NBS D DescNBS E cIndOp F Onerosa G Exterior H cClassTrib I DescClass
  const porItem = {};
  listaItens.forEach(function (it) { porItem[it] = { item: it, descricao: '', nbs: [] }; });

  linhas.forEach(function (l) {
    const it = String(l[0]).trim();
    if (!porItem[it]) return;
    const alvo = porItem[it];
    if (!alvo.descricao) alvo.descricao = String(l[1]).trim();
    const codigos = String(l[7]).split(/\n/).map(function (s) { return s.trim(); }).filter(String);
    const nomes = String(l[8]).split(/\n/).map(function (s) { return s.trim(); });
    alvo.nbs.push({
      nbs: String(l[2]).trim(),
      descricao: String(l[3]).trim(),
      indop: String(l[4]).split(/\n/).map(function (s) { return s.trim(); }).filter(String),
      onerosa: String(l[5]).trim(),
      exterior: String(l[6]).trim(),
      cclass: codigos.map(function (c, i) { return { codigo: c, nome: nomes[i] || '' }; })
    });
  });
  return listaItens.map(function (it) { return porItem[it]; });
}

/** Rode uma vez pelo editor se mudar as abas: limpa o cache das sugestões */
function limparCache() {
  CacheService.getScriptCache().remove('indice_cnae_' + CACHE_VERSAO);
}
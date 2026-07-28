let fabricaAtual = "";
let categoriaAtual = "todos";
let buscaAtual = "";
let filtroPrecoAtual = "todos";
let produtoAtual = null;
let carrinho = [];
let codigoComercialAplicado = carregarCodigoComercialSalvo();
let statusValidacaoCodigo = "";
let codigoComercialPainelAberto = false;
let sequenciaValidacaoCodigo = 0;

// Código comercial validado via Apps Script + aba CUPONS.
// Valores padrão usados apenas como segurança quando a resposta não trouxer algum campo.
const VALOR_MINIMO_CODIGO_PADRAO = 10000;
const DESCONTO_CODIGO_PADRAO = 5;

let paginaAtualProdutos = 1;
const PRODUTOS_POR_PAGINA = 24;
const MAX_QUANTIDADE_POR_CAMPO = 9999;
let confirmacaoPopupEmAndamento = false;
let produtosFiltradosAtuais = [];
const INDICE_BUSCA_PRODUTOS = new WeakMap();
let frameRolagemPendente = false;
let frameBuscaPendente = 0;
let frameResizeCatalogoPendente = 0;
let frameIndicadorCategoriasPendente = 0;
let ultimaAlturaCarrinhoMobile = 0;
let fonteIndicesProdutos = null;
let quantidadeIndicesProdutos = -1;

const PRODUTOS_POR_FABRICA_CACHE = new Map();
const CATEGORIAS_POR_FABRICA_CACHE = new Map();
const PRODUTO_POR_CHAVE_CACHE = new Map();
const CATEGORIA_CHAVE_PRODUTO = new WeakMap();
const VALOR_UNITARIO_PRODUTO_CACHE = new WeakMap();
const PRODUTOS_DO_CATALOGO = new WeakSet();

/**
 * Executa uma inicialização independentemente do momento em que o script
 * dinâmico foi carregado. Evita perder o evento DOMContentLoaded.
 */
function executarQuandoDOMPronto(callback) {
  if (typeof callback !== "function") return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}

const ORDEM_INICIAL_TENDENZE = [
  "31036402", "31009602", "31038502", "31022702", "31034202",
  "31040702", "31040202", "31086602", "31092902", "31088302"
];
const PRIORIDADE_TENDENZE = new Map(ORDEM_INICIAL_TENDENZE.map((ref, index) => [ref, index]));

const NUMERACOES_ANEIS = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34];

// Ajuste estes valores quando o preço por grama mudar.
const COEFICIENTE_GRAMA = 18.90;
const COEFICIENTE_GRAMA_POR_FABRICA = {
  inove: 18.90,
  tendenze: 20.78
};

const GRAMA_TENDENZE_SEM_ZIRC = 18.70;
const GRAMA_TENDENZE_COM_ZIRC = 20.78;

function irParaCategoria(categoria) {
  window.location.href = `catalogo.html?fabrica=${fabricaAtual}&categoria=${categoria}`;
}

function voltarAoTopo() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function atualizarBotaoVoltarTopo() {
  const botao = document.getElementById("btn-voltar-topo");
  if (!botao) return;

  botao.classList.toggle("visivel", window.scrollY > 420);
}

function agendarAtualizacoesDeRolagem() {
  if (frameRolagemPendente) return;

  frameRolagemPendente = true;
  window.requestAnimationFrame(() => {
    frameRolagemPendente = false;
    atualizarBotaoVoltarTopo();
    atualizarVisibilidadeControlesMobile();
  });
}

window.addEventListener("scroll", agendarAtualizacoesDeRolagem, { passive: true });
executarQuandoDOMPronto(agendarAtualizacoesDeRolagem);


function atualizarBusca(valor) {
  buscaAtual = normalizarTexto(valor);
  paginaAtualProdutos = 1;

  document.body.classList.toggle(
    "busca-catalogo-com-texto",
    Boolean(String(valor || "").trim())
  );

  if (frameBuscaPendente) return;

  frameBuscaPendente = requestAnimationFrame(() => {
    frameBuscaPendente = 0;
    carregarProdutos();
    atualizarVisibilidadeControlesMobile();
  });
}

function definirEstadoFiltroPreco(aberto) {
  const painel = document.getElementById("filtros-preco");
  const botao = document.querySelector(".btn-filtro-toggle");
  const estado = Boolean(aberto);

  document.body.classList.toggle("filtro-preco-aberto", estado);

  if (botao) {
    const icone = botao.querySelector("span");
    const texto = botao.querySelector("strong");

    botao.setAttribute("aria-expanded", estado ? "true" : "false");
    botao.setAttribute(
      "aria-label",
      estado ? "Voltar à busca" : "Abrir filtros de preço"
    );

    if (icone) {
      icone.textContent = estado ? "←" : "☷";
    }

    if (texto) {
      texto.textContent = estado ? "Voltar" : "Filtro";
    }
  }

  if (painel) {
    painel.setAttribute("aria-hidden", estado ? "false" : "true");
  }
}

function alternarFiltroPrecoPainel() {
  definirEstadoFiltroPreco(
    !document.body.classList.contains("filtro-preco-aberto")
  );
}

function fecharFiltroPrecoPainel() {
  definirEstadoFiltroPreco(false);
}

function alternarBuscaCatalogo() {
  const input = document.getElementById("busca-produto");
  fecharFiltroPrecoPainel();

  if (window.innerWidth <= 768) {
    document.body.classList.remove("mobile-rolou");
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (input) {
      setTimeout(() => input.focus(), 420);
    }
    return;
  }

  if (input) {
    setTimeout(() => input.focus(), 80);
  }
}

function fecharBuscaCatalogo() {
  const input = document.getElementById("busca-produto");

  if (input) {
    input.value = "";
  }

  buscaAtual = "";
  paginaAtualProdutos = 1;
  document.body.classList.remove("busca-catalogo-com-texto");
  carregarProdutos();
}

function alternarMenuTopo() {
  const abriu = !document.body.classList.contains("menu-topo-aberto");
  document.body.classList.toggle("menu-topo-aberto", abriu);

  const botao = document.querySelector(".btn-menu-topo");
  if (botao) {
    botao.setAttribute("aria-expanded", abriu ? "true" : "false");
  }
}

function configurarPainelFiltroPreco() {
  if (document.documentElement.dataset.filtroPrecoConfigurado === "true") return;
  document.documentElement.dataset.filtroPrecoConfigurado = "true";

  document.addEventListener("pointerdown", event => {
    if (!document.body.classList.contains("filtro-preco-aberto")) return;

    const controle = event.target.closest(
      ".btn-filtro-toggle, #filtros-preco"
    );

    if (!controle) {
      fecharFiltroPrecoPainel();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" &&
        document.body.classList.contains("filtro-preco-aberto")) {
      fecharFiltroPrecoPainel();
      document.querySelector(".btn-filtro-toggle")?.focus();
    }
  });
}

function atualizarFiltroPreco(filtro) {
  filtroPrecoAtual = filtro || "todos";
  paginaAtualProdutos = 1;
  atualizarBotoesFiltroPreco();
  carregarProdutos();

  fecharFiltroPrecoPainel();
}

function produtoPassaFiltroPreco(produto) {
  if (!filtroPrecoAtual || filtroPrecoAtual === "todos") return true;

  const valor = valorUnitarioProduto(produto);

  if (filtroPrecoAtual === "ate25") return valor <= 25;
  if (filtroPrecoAtual === "25a50") return valor > 25 && valor <= 50;
  if (filtroPrecoAtual === "50a100") return valor > 50 && valor <= 100;
  if (filtroPrecoAtual === "acima100") return valor > 100;

  return true;
}

function atualizarBotoesFiltroPreco() {
  document.querySelectorAll("[data-filtro-preco]").forEach(botao => {
    botao.classList.toggle("ativo", botao.dataset.filtroPreco === filtroPrecoAtual);
  });
}

function salvarCarrinho() {
  unificarCarrinhoPorReferencia();
  localStorage.setItem("carrinhoCatalogo", JSON.stringify(carrinho));
}

function carregarCarrinho() {
  const salvo = localStorage.getItem("carrinhoCatalogo");

  if (salvo) {
    try {
      carrinho = JSON.parse(salvo) || [];
      carrinho = carrinho
        .filter(item => item && item.referencia && item.fabrica)
        .map(normalizarItemCarrinhoSalvo)
        .filter(item => item && totalPecasItem(item) > 0);
      unificarCarrinhoPorReferencia();
      salvarCarrinho();
    } catch (e) {
      carrinho = [];
      localStorage.removeItem("carrinhoCatalogo");
    }
  }
}

function normalizarItemCarrinhoSalvo(item) {
  const copia = {
    ...item,
    referencia: String(item.referencia || "").trim(),
    fabrica: String(item.fabrica || "").trim().toLowerCase(),
    categoria: String(item.categoria || "").trim().toLowerCase()
  };

  if (ehCategoriaAnel(copia.categoria)) {
    const numeracoes = {};
    NUMERACOES_ANEIS.forEach(numero => {
      const quantidade = quantidadeInteiraSegura(item.numeracoes?.[numero]);
      if (quantidade > 0) numeracoes[numero] = quantidade;
    });
    copia.numeracoes = numeracoes;
    copia.quantidade = null;
  } else {
    copia.quantidade = quantidadeInteiraSegura(item.quantidade) ?? 0;
    copia.numeracoes = null;
  }

  return copia;
}

function fabricaDoCarrinho() {
  if (carrinho.length === 0) return null;
  return carrinho[0].fabrica;
}

function nomeFabrica(fabrica) {
  fabrica = String(fabrica || "").toLowerCase();
  if (fabrica === "tendenze") return "TENDENZE";
  if (fabrica === "zarrara") return "ZARRARA";
  if (fabrica === "inove") return "INOVE";
  return String(fabrica || "").toUpperCase();
}

function limparCarrinho() {
  carrinho = [];
  salvarCarrinho();
  renderizarCarrinho();
}

function podeAdicionarProduto(produto) {
  const fabricaCarrinho = fabricaDoCarrinho();

  if (!fabricaCarrinho) return true;

  if (fabricaCarrinho !== produto.fabrica) {
    const confirmarTroca = confirm(
      `Seu carrinho atual é da ${nomeFabrica(fabricaCarrinho)}.\n\n` +
      `Se continuar, o pedido atual será apagado para começar um novo da ${nomeFabrica(produto.fabrica)}.\n\n` +
      `Deseja continuar?`
    );

    if (confirmarTroca) {
      limparCarrinho();
      return true;
    }

    return false;
  }

  return true;
}

function minimoPorFabrica(fabrica) {
  fabrica = String(fabrica || "").toLowerCase();
  if (fabrica === "tendenze") return 6;
  if (fabrica === "zarrara") return 10;
  if (fabrica === "inove") return 5;
  return 1;
}

function quantidadeInteiraSegura(valor) {
  const numero = Number(valor);
  if (
    !Number.isFinite(numero) ||
    numero < 0 ||
    numero > MAX_QUANTIDADE_POR_CAMPO ||
    !Number.isInteger(numero)
  ) return null;

  return numero;
}

function pesoNumerico(peso) {
  if (!peso) return 0;
  return Number(String(peso).replace("g", "").replace(",", ".").trim()) || 0;
}

function formatarPeso(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  }) + "g";
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function coeficienteGramaPorFabrica(fabrica) {
  fabrica = String(fabrica || "").toLowerCase();
  return COEFICIENTE_GRAMA_POR_FABRICA[fabrica] || COEFICIENTE_GRAMA;
}

function coeficienteGramaProduto(produto) {
  const fabrica = String(produto?.fabrica || "").toLowerCase();
  const descricao = String(produto?.descricao || "").toUpperCase();

  if (fabrica === "tendenze") {
    if (descricao.includes("C/ ZIRC") || descricao.includes("C/ZIRC")) {
      return GRAMA_TENDENZE_COM_ZIRC;
    }

    if (descricao.includes("S/ ZIRC") || descricao.includes("S/ZIRC")) {
      return GRAMA_TENDENZE_SEM_ZIRC;
    }

    // Segurança: se alguma peça da Tendenze vier sem marcação, usa o valor sem zircônia.
    return GRAMA_TENDENZE_SEM_ZIRC;
  }

  return coeficienteGramaPorFabrica(fabrica);
}

function valorUnitarioProduto(produtoOuItem) {
  if (!produtoOuItem || typeof produtoOuItem !== "object") return 0;

  const usarCache = PRODUTOS_DO_CATALOGO.has(produtoOuItem);
  if (usarCache && VALOR_UNITARIO_PRODUTO_CACHE.has(produtoOuItem)) {
    return VALOR_UNITARIO_PRODUTO_CACHE.get(produtoOuItem);
  }

  const fabrica = String(produtoOuItem.fabrica || "").toLowerCase();
  let valor = 0;

  // Zarrara vem do importador com preço pronto no campo "preco".
  if (fabrica === "zarrara") {
    if (
      produtoOuItem.preco !== undefined &&
      produtoOuItem.preco !== null
    ) {
      valor = Number(produtoOuItem.preco) || 0;
    } else {
      prepararIndicesProdutos();
      const produtoOriginal = PRODUTO_POR_CHAVE_CACHE.get(
        `zarrara::${String(produtoOuItem.referencia || "")}`
      );
      valor = Number(produtoOriginal?.preco) || 0;
    }
  } else {
    valor =
      pesoNumerico(produtoOuItem.peso) *
      coeficienteGramaProduto(produtoOuItem);
  }

  if (usarCache) {
    VALOR_UNITARIO_PRODUTO_CACHE.set(produtoOuItem, valor);
  }

  return valor;
}

function valorItem(item) {
  return totalPecasItem(item) * valorUnitarioProduto(item);
}

function referenciaSegura(ref) {
  return String(ref || "").replace(/[^a-zA-Z0-9_-]/g, "-");
}

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}


function categoriaChave(valor) {
  return normalizarTexto(valor)
    .replace(/\s+/g, "-")
    .replace(/_/g, "-");
}

function ehCategoriaAnel(categoria) {
  const cat = categoriaChave(categoria);

  return [
    "anel",
    "aneis",
    "aneis",
    "alianca",
    "aliancas"
  ].includes(cat);
}

function nomeCategoriaExibicao(categoria) {
  const original = String(categoria || "").trim();
  const cat = categoriaChave(original);

  const mapa = {
    "todos": "Todos",
    "anel": "Anel",
    "aneis": "Anéis",
    "alianca": "Aliança",
    "aliancas": "Alianças",
    "brinco": "Brinco",
    "brincos": "Brincos",
    "argola": "Argola",
    "argolas": "Argolas",
    "bracelete": "Bracelete",
    "braceletes": "Braceletes",
    "gargantilha": "Gargantilha",
    "gargantilhas": "Gargantilhas",
    "piercing": "Piercing",
    "piercings": "Piercings",
    "pulseira": "Pulseira",
    "pulseiras": "Pulseiras",
    "pingente": "Pingente",
    "pingentes": "Pingentes",
    "berloque": "Berloque",
    "berloques": "Berloques",
    "conjunto": "Conjunto",
    "conjuntos": "Conjuntos",
    "conjunto-infantil-cji": "Conjunto Infantil",
    "escapulario": "Escapulário",
    "escapularios": "Escapulários",
    "infantil": "Infantil",
    "tornozeleira": "Tornozeleira",
    "tornozeleiras": "Tornozeleiras",
    "acessorios": "Acessórios",
    "gravatas": "Gravatas",
    "aro": "Aro",
    "brd-brincos-duplo": "Brincos Duplo"
  };

  if (mapa[cat]) return mapa[cat];

  return original
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, letra => letra.toUpperCase());
}

function iconeCategoria(categoria) {
  const cat = categoriaChave(categoria);

  if (cat === "todos") return "cat-todos";
  if (["anel", "aneis", "alianca", "aliancas", "aro"].includes(cat)) return "cat-anel";
  if (["brinco", "brincos", "argola", "argolas", "brd-brincos-duplo"].includes(cat)) return "cat-brinco";
  if (["gargantilha", "gargantilhas", "gravatas"].includes(cat)) return "cat-gargantilha";
  if (["piercing", "piercings"].includes(cat)) return "cat-piercing";
  if (["pulseira", "pulseiras", "bracelete", "braceletes", "tornozeleira", "tornozeleiras"].includes(cat)) return "cat-pulseira";
  if (["pingente", "pingentes", "berloque", "berloques", "escapulario", "escapularios"].includes(cat)) return "cat-pingente";
  if (["infantil", "linha-infantil", "conjunto-infantil-cji"].includes(cat)) return "cat-todos";

  return "cat-todos";
}

function prepararIndicesProdutos() {
  const lista = Array.isArray(produtos) ? produtos : [];

  if (
    fonteIndicesProdutos === lista &&
    quantidadeIndicesProdutos === lista.length
  ) {
    return;
  }

  fonteIndicesProdutos = lista;
  quantidadeIndicesProdutos = lista.length;

  PRODUTOS_POR_FABRICA_CACHE.clear();
  CATEGORIAS_POR_FABRICA_CACHE.clear();
  PRODUTO_POR_CHAVE_CACHE.clear();

  lista.forEach(produto => {
    if (!produto || typeof produto !== "object") return;

    const fabrica = String(produto.fabrica || "").toLowerCase();
    const categoria = String(produto.categoria || "").trim();
    const chaveCategoria = categoriaChave(categoria);
    const chaveProduto = `${fabrica}::${String(produto.referencia || "")}`;

    PRODUTOS_DO_CATALOGO.add(produto);
    CATEGORIA_CHAVE_PRODUTO.set(produto, chaveCategoria);
    PRODUTO_POR_CHAVE_CACHE.set(chaveProduto, produto);
    indiceBuscaProduto(produto);

    if (!PRODUTOS_POR_FABRICA_CACHE.has(fabrica)) {
      PRODUTOS_POR_FABRICA_CACHE.set(fabrica, []);
    }
    PRODUTOS_POR_FABRICA_CACHE.get(fabrica).push(produto);
  });

  PRODUTOS_POR_FABRICA_CACHE.forEach((listaFabrica, fabrica) => {
    if (fabrica === "tendenze") {
      listaFabrica.sort((a, b) => {
        const prioridadeA = PRIORIDADE_TENDENZE.has(String(a.referencia))
          ? PRIORIDADE_TENDENZE.get(String(a.referencia))
          : 999999;
        const prioridadeB = PRIORIDADE_TENDENZE.has(String(b.referencia))
          ? PRIORIDADE_TENDENZE.get(String(b.referencia))
          : 999999;

        return prioridadeA - prioridadeB;
      });
    }

    const vistas = new Set();
    const categorias = [];

    listaFabrica.forEach(produto => {
      const categoria = String(produto.categoria || "").trim();
      const chave = CATEGORIA_CHAVE_PRODUTO.get(produto) || categoriaChave(categoria);
      if (!categoria || vistas.has(chave)) return;
      vistas.add(chave);
      categorias.push(categoria);
    });

    categorias.sort((a, b) =>
      nomeCategoriaExibicao(a).localeCompare(
        nomeCategoriaExibicao(b),
        "pt-BR"
      )
    );

    CATEGORIAS_POR_FABRICA_CACHE.set(fabrica, categorias);
  });
}

function produtosDaFabricaIndexados(fabrica) {
  prepararIndicesProdutos();
  return PRODUTOS_POR_FABRICA_CACHE.get(
    String(fabrica || "").toLowerCase()
  ) || [];
}

function categoriasDisponiveisDaFabrica() {
  prepararIndicesProdutos();
  const categorias = CATEGORIAS_POR_FABRICA_CACHE.get(
    String(fabricaAtual || "").toLowerCase()
  );

  return categorias ? categorias.slice() : [];
}

function categoriaExisteNaFabrica(categoria) {
  if (!categoria || categoriaChave(categoria) === "todos") return true;

  const chaveAtual = categoriaChave(categoria);
  return categoriasDisponiveisDaFabrica().some(cat => categoriaChave(cat) === chaveAtual);
}

function renderizarCategorias() {
  const container = document.getElementById("categorias-scroll");
  if (!container) return;

  const categoriasDaFabrica = categoriasDisponiveisDaFabrica();

  let html = `
    <button type="button" class="${categoriaChave(categoriaAtual) === "todos" ? "ativo" : ""}" onclick="irParaCategoria('todos')">
      <span class="cat-icone cat-todos" aria-hidden="true"></span>Todos
    </button>
  `;

  categoriasDaFabrica.forEach(categoria => {
    const ativa = categoriaChave(categoriaAtual) === categoriaChave(categoria) ? "ativo" : "";
    const categoriaAtributo = escaparHtml(categoria);

    html += `
      <button type="button" class="${ativa}" data-categoria="${categoriaAtributo}" onclick="irParaCategoria(this.dataset.categoria)">
        <span class="cat-icone ${iconeCategoria(categoria)}" aria-hidden="true"></span>${escaparHtml(nomeCategoriaExibicao(categoria))}
      </button>
    `;
  });

  container.innerHTML = html;
  agendarAtualizacaoIndicadorCategorias();
}








function chaveProdutoCarrinho(produtoOuItem) {
  return `${String(produtoOuItem?.fabrica || '').toLowerCase()}::${String(produtoOuItem?.referencia || '')}`;
}


function mesclarDadosItemCarrinho(destino, origem) {
  if (!destino || !origem) return destino;

  const destinoEhAnel = ehCategoriaAnel(destino.categoria || origem.categoria);

  // Mantém os dados mais completos/atuais do produto.
  ["descricao", "peso", "categoria", "minimo", "imagem", "preco", "precoEtiqueta"].forEach(campo => {
    if ((destino[campo] === undefined || destino[campo] === null || destino[campo] === "") && origem[campo] !== undefined) {
      destino[campo] = origem[campo];
    }
  });

  if (origem.observacao) {
    if (!destino.observacao) {
      destino.observacao = origem.observacao;
    } else if (!destino.observacao.includes(origem.observacao)) {
      destino.observacao += ` | ${origem.observacao}`;
    }
  }

  if (destinoEhAnel) {
    destino.numeracoes = destino.numeracoes || {};
    Object.entries(origem.numeracoes || {}).forEach(([numero, qtd]) => {
      const quantidadeDestino = quantidadeInteiraSegura(destino.numeracoes[numero]) ?? 0;
      const quantidadeOrigem = quantidadeInteiraSegura(qtd) ?? 0;
      destino.numeracoes[numero] = quantidadeDestino + quantidadeOrigem;
    });
    destino.quantidade = null;
  } else {
    const quantidadeDestino = quantidadeInteiraSegura(destino.quantidade) ?? 0;
    const quantidadeOrigem = quantidadeInteiraSegura(origem.quantidade) ?? 0;
    destino.quantidade = quantidadeDestino + quantidadeOrigem;
    destino.numeracoes = null;
  }

  return destino;
}

function adicionarOuSomarNoCarrinho(novoItem) {
  const chaveNova = chaveProdutoCarrinho(novoItem);
  const existente = carrinho.find(item => chaveProdutoCarrinho(item) === chaveNova);

  if (existente) {
    mesclarDadosItemCarrinho(existente, novoItem);
    return existente;
  }

  carrinho.push(novoItem);
  return novoItem;
}

function unificarCarrinhoPorReferencia() {
  const unificado = [];
  const porChave = new Map();

  carrinho.forEach(item => {
    if (!item || !item.referencia || !item.fabrica) return;

    const chave = chaveProdutoCarrinho(item);
    const existente = porChave.get(chave);

    if (existente) {
      mesclarDadosItemCarrinho(existente, item);
      return;
    }

    const copia = {
      ...item,
      numeracoes: item.numeracoes
        ? { ...item.numeracoes }
        : item.numeracoes
    };

    porChave.set(chave, copia);
    unificado.push(copia);
  });

  carrinho = unificado;
}

function produtoJaNoCarrinho(produto) {
  const chave = chaveProdutoCarrinho(produto);
  return carrinho.some(item => chaveProdutoCarrinho(item) === chave && totalPecasItem(item) > 0);
}

function seloProdutoNoCarrinhoHtml() {
  return `
    <span class="selo-no-carrinho" title="Item já adicionado ao carrinho" aria-label="Item já adicionado ao carrinho">
      <span class="selo-no-carrinho-icone">✓</span>
      <span class="selo-no-carrinho-texto">No carrinho</span>
    </span>
  `;
}

function atualizarSelosProdutosNoCarrinho() {
  const chavesAtivas = new Set(
    carrinho
      .filter(item => totalPecasItem(item) > 0)
      .map(chaveProdutoCarrinho)
  );

  document.querySelectorAll(
    ".produto[data-ref][data-fabrica]"
  ).forEach(card => {
    const ref = card.getAttribute("data-ref") || "";
    const fab = String(
      card.getAttribute("data-fabrica") || ""
    ).toLowerCase();
    const existe = chavesAtivas.has(`${fab}::${ref}`);

    card.classList.toggle("produto-no-carrinho", existe);

    const selo = card.querySelector(".selo-no-carrinho");
    if (existe && !selo) {
      card.querySelector(".imagem-produto")?.insertAdjacentHTML(
        "beforeend",
        seloProdutoNoCarrinhoHtml()
      );
    } else if (!existe && selo) {
      selo.remove();
    }
  });
}

function indiceBuscaProduto(produto) {
  if (!produto || typeof produto !== "object") return "";
  if (INDICE_BUSCA_PRODUTOS.has(produto)) return INDICE_BUSCA_PRODUTOS.get(produto);

  const indice = normalizarTexto([
    produto.referencia,
    produto.descricao,
    produto.peso,
    produto.codigo
  ].filter(Boolean).join(" "));

  INDICE_BUSCA_PRODUTOS.set(produto, indice);
  return indice;
}

function carregarProdutos() {
  const container = document.getElementById("produtos");
  if (!container) return;

  const produtosBase = produtosDaFabricaIndexados(fabricaAtual);
  const chaveCategoriaAtual = categoriaChave(categoriaAtual);
  const filtrarCategoria = chaveCategoriaAtual !== "todos";
  const termoBusca = buscaAtual;
  const filtrados = [];

  for (const produto of produtosBase) {
    if (
      filtrarCategoria &&
      (CATEGORIA_CHAVE_PRODUTO.get(produto) ||
        categoriaChave(produto.categoria)) !== chaveCategoriaAtual
    ) {
      continue;
    }

    if (!produtoPassaFiltroPreco(produto)) continue;
    if (termoBusca && !indiceBuscaProduto(produto).includes(termoBusca)) {
      continue;
    }

    filtrados.push(produto);
  }

  produtosFiltradosAtuais = filtrados;

  const totalPaginas = Math.max(1, Math.ceil(produtosFiltradosAtuais.length / PRODUTOS_POR_PAGINA));

  if (paginaAtualProdutos > totalPaginas) paginaAtualProdutos = totalPaginas;
  if (paginaAtualProdutos < 1) paginaAtualProdutos = 1;

  const inicio = (paginaAtualProdutos - 1) * PRODUTOS_POR_PAGINA;
  const fim = inicio + PRODUTOS_POR_PAGINA;
  const produtosParaMostrar = produtosFiltradosAtuais.slice(inicio, fim);

  if (produtosFiltradosAtuais.length === 0) {
    container.innerHTML = `
      <div class="produto">
        <div class="imagem-produto"><span>Nenhum produto</span></div>
        <div class="info-produto">
          <p class="ref-produto">Nenhum item encontrado</p>
          <p class="descricao-produto">Tente buscar por outra referência, descrição ou categoria.</p>
        </div>
      </div>
    `;
    return;
  }

  const limiteImagensPrioritarias = window.innerWidth <= 768 ? 2 : 4;

  const htmlProdutos = produtosParaMostrar.map((produto, indicePagina) => {
    const referenciaTexto = String(produto.referencia || "");
    const referenciaHtml = escaparHtml(referenciaTexto);
    const altImagem = escaparHtml(`Referência ${referenciaTexto}`);
    const imagemSrc = escaparHtml(produto.imagem || "");
    const imagemPrioritaria = indicePagina < limiteImagensPrioritarias;
    const imagemHtml = produto.imagem
      ? `<img src="${imagemSrc}"
              alt="${altImagem}"
              width="640"
              height="640"
              loading="${imagemPrioritaria ? "eager" : "lazy"}"
              fetchpriority="${imagemPrioritaria ? "high" : "low"}"
              decoding="async"
              draggable="false"
              onclick="abrirZoomImagem(this.currentSrc || this.src, this.alt)">`
      : `<span>Sem imagem</span>`;

    const jaNoCarrinho = produtoJaNoCarrinho(produto);
    const classeNoCarrinho = jaNoCarrinho ? " produto-no-carrinho" : "";
    const seloNoCarrinho = jaNoCarrinho ? seloProdutoNoCarrinhoHtml() : "";
    const dataRef = escaparHtml(produto.referencia || "");
    const dataFabrica = escaparHtml(produto.fabrica || "");
    const pesoHtml = escaparHtml(produto.peso || "");

    const infoHtml = `
      <div class="imagem-produto">
        ${imagemHtml}
        ${seloNoCarrinho}
        <span class="badge-ref-card">Ref. ${referenciaHtml}</span>
        ${produto.peso ? `<span class="badge-peso-card">Peso: ${pesoHtml}</span>` : ""}
      </div>
      <div class="info-produto">
        <p class="ref-produto">Ref. ${referenciaHtml}</p>
        ${produto.peso ? `<p class="peso-produto">Peso: ${pesoHtml}</p>` : ""}
        <p class="valor-produto">R$ ${formatarMoeda(valorUnitarioProduto(produto))}</p>
      </div>
    `;

    if (ehCategoriaAnel(produto.categoria)) {
      return `
        <div class="produto produto-anel${classeNoCarrinho}" data-ref="${dataRef}" data-fabrica="${dataFabrica}">
          ${infoHtml}
          <div class="produto-acoes produto-acoes-anel">
            <button class="btn-escolher-numeracoes" data-ref="${dataRef}" onclick="abrirPopup(this.dataset.ref)">Escolher numerações</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="produto produto-simples${classeNoCarrinho}" data-ref="${dataRef}" data-fabrica="${dataFabrica}">
        ${infoHtml}
        <div class="produto-acoes produto-acoes-simples">
          <button class="btn-adicionar-card" data-ref="${dataRef}" onclick="abrirPopup(this.dataset.ref)">Adicionar</button>
        </div>
      </div>
    `;
  }).join("");

  const htmlPaginacao = `
    <div class="paginacao-produtos">
      <button onclick="mudarPaginaProdutos(-1)" ${paginaAtualProdutos === 1 ? "disabled" : ""}>
        ← Anterior
      </button>

      <div class="pagina-info">
        <span>Página</span>
        <input
          type="number"
          min="1"
          max="${totalPaginas}"
          value="${paginaAtualProdutos}"
          onchange="irParaPagina(this.value)"
          onkeydown="if(event.key === 'Enter') irParaPagina(this.value)"
          class="input-pagina"
        >
        <span>de ${totalPaginas}</span>
      </div>

      <button onclick="mudarPaginaProdutos(1)" ${paginaAtualProdutos === totalPaginas ? "disabled" : ""}>
        Próxima →
      </button>
    </div>
  `;

  // Uma única escrita no DOM evita reconstruir todos os cards a cada item.
  // A busca continua respondendo imediatamente a cada tecla.
  container.innerHTML = htmlProdutos + htmlPaginacao;
}


function mudarPaginaProdutos(direcao) {
  const totalPaginas = Math.max(1, Math.ceil(produtosFiltradosAtuais.length / PRODUTOS_POR_PAGINA));

  paginaAtualProdutos += direcao;

  if (paginaAtualProdutos < 1) paginaAtualProdutos = 1;
  if (paginaAtualProdutos > totalPaginas) paginaAtualProdutos = totalPaginas;

  carregarProdutos();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function irParaPagina(numero) {
  numero = Number(numero);

  const totalPaginas = Math.max(
    1,
    Math.ceil(produtosFiltradosAtuais.length / PRODUTOS_POR_PAGINA)
  );

  if (isNaN(numero)) return;

  if (numero < 1) numero = 1;
  if (numero > totalPaginas) numero = totalPaginas;

  paginaAtualProdutos = numero;

  carregarProdutos();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function buscarProdutoPorReferencia(referencia) {
  return produtos.find(p => p.referencia === referencia);
}

function abrirPopup(referencia) {
  const produto = buscarProdutoPorReferencia(referencia);
  if (!produto) return;

  if (!podeAdicionarProduto(produto)) return;

  produtoAtual = produto;
  confirmacaoPopupEmAndamento = false;

  const observacaoPopup = document.getElementById("popup-observacao");
  if (observacaoPopup) observacaoPopup.value = "";

  const botaoConfirmarPopup = document.getElementById("botao-confirmar-popup");
  if (botaoConfirmarPopup) {
    botaoConfirmarPopup.disabled = false;
    botaoConfirmarPopup.innerText = "Adicionar ao pedido";
  }

  document.getElementById("popup-referencia").innerText = "Ref. " + produto.referencia;
  document.getElementById("popup-peso").innerText = "Peso: " + (produto.peso || "-") + " • R$ " + formatarMoeda(valorUnitarioProduto(produto));
  document.getElementById("popup-descricao").innerText = produto.descricao || "";
  document.getElementById("popup-minimo").innerText = "Mínimo: " + minimoPorFabrica(produto.fabrica) + " peças";

  const imagemPopup = document.getElementById("popup-imagem-produto");
  const quadroImagemPopup = imagemPopup?.closest(".popup-imagem-principal");

  if (imagemPopup) {
    quadroImagemPopup?.classList.remove("imagem-indisponivel");
    imagemPopup.alt = "Referência " + produto.referencia;

    imagemPopup.onload = () => {
      quadroImagemPopup?.classList.remove("imagem-indisponivel");
    };

    imagemPopup.onerror = () => {
      quadroImagemPopup?.classList.add("imagem-indisponivel");
    };

    imagemPopup.src = produto.imagem || "";

    if (!produto.imagem) {
      quadroImagemPopup?.classList.add("imagem-indisponivel");
    }
  }

  const ehAnel = ehCategoriaAnel(produto.categoria);

  document.querySelector(".popup-selecao-numeracoes .popup-label").innerText = ehAnel ? "Seleção de numerações" : "Adicionar ao carrinho";
  document.querySelector(".popup-selecao-numeracoes h3").innerText = ehAnel ? "Escolha aro e quantidade" : "Escolha quantidade";
  document.querySelector(".popup-ajuda").innerText = ehAnel ? "Distribua a quantidade da referência entre os aros disponíveis." : "Selecione a quantidade desejada para este produto.";

  let html = "";

  if (ehAnel) {
    NUMERACOES_ANEIS.forEach(numero => {
      html += `
        <div class="numero-item">
          <div class="numero-topo" aria-label="Aro ${numero}">
            <span>Aro</span>
            <strong>${numero}</strong>
          </div>
          <div class="controle-qtd" data-aro="${numero}">
            <button class="ajuste-unitario" type="button" aria-label="Diminuir uma peça do aro ${numero}" onclick="alterarQtdAro(${numero}, -1)">−</button>
            <input type="number" id="aro-${numero}" min="0" max="${MAX_QUANTIDADE_POR_CAMPO}" step="1" value="0" inputmode="numeric" aria-label="Quantidade do aro ${numero}" oninput="atualizarResumoPopup()">
            <button class="ajuste-unitario" type="button" aria-label="Aumentar uma peça do aro ${numero}" onclick="alterarQtdAro(${numero}, 1)">+</button>
          </div>
        </div>
      `;
    });
  } else {
    html = `
      <div class="numero-item numero-item-simples">
        <div class="numero-topo"><span>Qtd.</span><strong>Peças</strong></div>
        <div class="controle-qtd">
          <button type="button" aria-label="Diminuir uma peça" onclick="alterarQtdSimples(-1)">−</button>
          <input type="number" id="qtd-popup-simples" min="0" max="${MAX_QUANTIDADE_POR_CAMPO}" step="1" value="${minimoPorFabrica(produto.fabrica)}" inputmode="numeric" aria-label="Quantidade de peças" oninput="atualizarResumoPopup()">
          <button type="button" aria-label="Aumentar uma peça" onclick="alterarQtdSimples(1)">+</button>
        </div>
      </div>
    `;
  }

  const listaNumeracoesPopup = document.getElementById("numeracoes");
  listaNumeracoesPopup.innerHTML = html;
  listaNumeracoesPopup.scrollTop = 0;
  configurarRolagemNumeracoesPopup();
  configurarArrastePopupMobile();
  atualizarResumoPopup();
  const popup = document.getElementById("popup");
  popup.classList.remove("escondido");
  popup.setAttribute("aria-hidden", "false");
  document.body.classList.add("popup-aberto");
  gerenciadorOverlay.abrir("popup");
}

function configurarRolagemNumeracoesPopup() {
  const lista = document.getElementById("numeracoes");
  if (!lista || lista.dataset.rolagemConfigurada === "true") return;

  lista.dataset.rolagemConfigurada = "true";

  let toqueInicialY = 0;
  let scrollInicial = 0;
  let arrastou = false;
  let bloquearCliqueAte = 0;

  lista.addEventListener("wheel", event => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const limite = Math.max(0, lista.scrollHeight - lista.clientHeight);
    if (limite <= 0) return;

    const anterior = lista.scrollTop;
    const proximo = Math.max(
      0,
      Math.min(limite, anterior + event.deltaY)
    );

    const alvoNumerico = event.target.closest('input[type="number"]');

    if (proximo !== anterior || alvoNumerico) {
      event.preventDefault();
      event.stopPropagation();
      lista.scrollTop = proximo;
    }
  }, { passive: false, capture: true });

  lista.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) return;

    toqueInicialY = event.touches[0].clientY;
    scrollInicial = lista.scrollTop;
    arrastou = false;
  }, { passive: true, capture: true });

  lista.addEventListener("touchmove", event => {
    if (event.touches.length !== 1) return;

    const atualY = event.touches[0].clientY;
    const deslocamento = toqueInicialY - atualY;

    if (Math.abs(deslocamento) < 4) return;

    const limite = Math.max(0, lista.scrollHeight - lista.clientHeight);
    if (limite <= 0) return;

    arrastou = true;
    event.preventDefault();
    event.stopPropagation();

    lista.scrollTop = Math.max(
      0,
      Math.min(limite, scrollInicial + deslocamento)
    );
  }, { passive: false, capture: true });

  lista.addEventListener("touchend", () => {
    if (arrastou) {
      bloquearCliqueAte = Date.now() + 350;
    }
  }, { passive: true, capture: true });

  lista.addEventListener("touchcancel", () => {
    if (arrastou) {
      bloquearCliqueAte = Date.now() + 350;
    }
  }, { passive: true, capture: true });

  lista.addEventListener("click", event => {
    if (Date.now() < bloquearCliqueAte) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true });
}

function configurarArrastePopupMobile() {
  const popup = document.getElementById("popup");
  const painel = popup?.querySelector(".popup-conteudo.popup-produto-layout");
  const alca = popup?.querySelector(".popup-arraste-handle");

  if (!popup || !painel || !alca ||
      alca.dataset.arrasteConfigurado === "true") {
    return;
  }

  alca.dataset.arrasteConfigurado = "true";

  let inicioY = 0;
  let inicioTempo = 0;
  let deslocamentoAtual = 0;
  let arrastando = false;

  function restaurarPainel() {
    painel.style.transition = "transform 180ms cubic-bezier(.22,.8,.25,1)";
    painel.style.transform = "translate3d(0, 0, 0)";

    window.setTimeout(() => {
      if (!arrastando) {
        painel.style.removeProperty("transition");
        painel.style.removeProperty("transform");
      }
    }, 210);
  }

  function concluirArraste() {
    if (!arrastando) return;

    arrastando = false;

    const duracao = Math.max(1, performance.now() - inicioTempo);
    const velocidade = deslocamentoAtual / duracao;
    const deveFechar = deslocamentoAtual >= 90 || velocidade >= 0.65;

    if (deveFechar) {
      painel.style.transition = "transform 180ms ease-in";
      painel.style.transform = "translate3d(0, 110%, 0)";

      window.setTimeout(() => {
        fecharPopup();
        painel.style.removeProperty("transition");
        painel.style.removeProperty("transform");
      }, 185);
      return;
    }

    restaurarPainel();
  }

  alca.addEventListener("touchstart", event => {
    if (window.innerWidth > 768 || event.touches.length !== 1) return;

    inicioY = event.touches[0].clientY;
    inicioTempo = performance.now();
    deslocamentoAtual = 0;
    arrastando = true;

    painel.style.transition = "none";
  }, { passive: true });

  alca.addEventListener("touchmove", event => {
    if (!arrastando || event.touches.length !== 1) return;

    deslocamentoAtual = Math.max(
      0,
      event.touches[0].clientY - inicioY
    );

    if (deslocamentoAtual <= 0) return;

    event.preventDefault();
    event.stopPropagation();

    const resistencia = Math.min(
      deslocamentoAtual,
      180 + Math.sqrt(Math.max(0, deslocamentoAtual - 180)) * 8
    );

    painel.style.transform =
      `translate3d(0, ${resistencia}px, 0)`;
  }, { passive: false });

  alca.addEventListener("touchend", concluirArraste, { passive: true });
  alca.addEventListener("touchcancel", concluirArraste, { passive: true });

  alca.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " " ||
        event.key === "Escape" || event.key === "ArrowDown") {
      event.preventDefault();
      fecharPopup();
    }
  });
}

function ampliarImagemPopup() {
  const imagem = document.getElementById("popup-imagem-produto");
  if (!imagem || !imagem.src || imagem.closest(".popup-imagem-principal")?.classList.contains("imagem-indisponivel")) {
    return;
  }

  abrirZoomImagem(
    imagem.currentSrc || imagem.src,
    imagem.alt || "Imagem ampliada do produto"
  );
}

function atualizarResumoPopup() {
  const totalEl = document.getElementById("popup-total-selecionado");
  const totalRodapeEl = document.getElementById("popup-rodape-total");

  let total = 0;

  if (produtoAtual && ehCategoriaAnel(produtoAtual.categoria)) {
    NUMERACOES_ANEIS.forEach(numero => {
      const input = document.getElementById(`aro-${numero}`);
      total += quantidadeInteiraSegura(input?.value) ?? 0;
    });
  } else {
    total = quantidadeInteiraSegura(document.getElementById("qtd-popup-simples")?.value) ?? 0;
  }

  const textoTotal = total + (total === 1 ? " peça" : " peças");
  const valorTotal = produtoAtual ? total * valorUnitarioProduto(produtoAtual) : 0;
  const textoTotalComValor = textoTotal + " • R$ " + formatarMoeda(valorTotal);

  if (totalEl) totalEl.innerText = textoTotalComValor;
  if (totalRodapeEl) totalRodapeEl.innerText = textoTotalComValor;
}

function definirEstadoConfirmacaoPopup(processando) {
  confirmacaoPopupEmAndamento = Boolean(processando);

  const botao = document.getElementById("botao-confirmar-popup");
  if (!botao) return;

  botao.disabled = confirmacaoPopupEmAndamento;
  botao.innerText = confirmacaoPopupEmAndamento
    ? "Adicionando..."
    : "Adicionar ao pedido";
}

function fecharPopup() {
  const popup = document.getElementById("popup");
  const observacao = document.getElementById("popup-observacao");

  if (observacao) observacao.value = "";
  if (popup) {
    const painelPopup = popup.querySelector(".popup-conteudo.popup-produto-layout");
    painelPopup?.style.removeProperty("transition");
    painelPopup?.style.removeProperty("transform");

    popup.classList.add("escondido");
    popup.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("popup-aberto");
  gerenciadorOverlay.fechar("popup");

  produtoAtual = null;
  definirEstadoConfirmacaoPopup(false);
}

function alterarQtdAro(numero, incremento) {
  const input = document.getElementById(`aro-${numero}`);
  if (!input) return;

  const atual = quantidadeInteiraSegura(input.value) ?? 0;
  const novoValor = Math.min(MAX_QUANTIDADE_POR_CAMPO, Math.max(0, atual + incremento));

  input.value = novoValor;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}




function alterarQtdSimples(incremento) {
  const input = document.getElementById("qtd-popup-simples");
  if (!input) return;

  const atual = quantidadeInteiraSegura(input.value) ?? 0;
  input.value = Math.min(MAX_QUANTIDADE_POR_CAMPO, Math.max(0, atual + incremento));
  atualizarResumoPopup();
}

function confirmarPopup() {
  if (!produtoAtual || confirmacaoPopupEmAndamento) return;

  definirEstadoConfirmacaoPopup(true);

  const observacao = document.getElementById("popup-observacao")?.value?.trim() || "";
  const numeracoes = {};
  let totalPecas = 0;
  const ehAnel = ehCategoriaAnel(produtoAtual.categoria);

  if (ehAnel) {
    NUMERACOES_ANEIS.forEach(numero => {
      const input = document.getElementById(`aro-${numero}`);
      const valor = quantidadeInteiraSegura(input?.value);
      if (valor === null) {
        totalPecas = NaN;
        return;
      }
      numeracoes[numero] = valor;
      totalPecas += valor;
    });
  } else {
    totalPecas = quantidadeInteiraSegura(document.getElementById("qtd-popup-simples")?.value);
  }

  if (!Number.isInteger(totalPecas)) {
    alert(`Informe apenas quantidades inteiras entre 0 e ${MAX_QUANTIDADE_POR_CAMPO}.`);
    definirEstadoConfirmacaoPopup(false);
    return;
  }

  const minimoAtual = minimoPorFabrica(produtoAtual.fabrica);

  if (totalPecas < minimoAtual) {
    alert(`Mínimo de ${minimoAtual} peças para esta referência.`);
    definirEstadoConfirmacaoPopup(false);
    return;
  }

  const itemAtualizado = adicionarOuSomarNoCarrinho({
    referencia: produtoAtual.referencia,
    descricao: produtoAtual.descricao,
    peso: produtoAtual.peso,
    fabrica: produtoAtual.fabrica,
    categoria: produtoAtual.categoria,
    minimo: minimoPorFabrica(produtoAtual.fabrica),
    imagem: produtoAtual.imagem,
    preco: produtoAtual.preco,
    precoEtiqueta: produtoAtual.precoEtiqueta,
    observacao,
    numeracoes: ehAnel ? { ...numeracoes } : null,
    quantidade: ehAnel ? null : totalPecas
  });

  // Cria o clone da imagem antes de fechar o popup.
  // Assim a animação continua, mas a aba de adicionar fecha imediatamente.
  animarImagemPopupParaCarrinho();

  salvarCarrinho();
  const chaveAtualizada = chaveProdutoCarrinho(itemAtualizado);
  renderizarCarrinho({
    destacarChave: chaveAtualizada,
    rolarAteChave: chaveAtualizada
  });
  animarConfirmacaoMobileCarrinho("Adicionado ao carrinho");

  const observacaoEl = document.getElementById("popup-observacao");
  if (observacaoEl) observacaoEl.value = "";

  fecharPopup();
}


function totalPecasItem(item) {
  const itemEhAnel = ehCategoriaAnel(item?.categoria);

  if (itemEhAnel) {
    return Object.values(item?.numeracoes || {}).reduce(
      (acc, valor) => acc + (quantidadeInteiraSegura(valor) ?? 0),
      0
    );
  }

  return quantidadeInteiraSegura(item?.quantidade) ?? 0;
}

function textoObservacaoItem(item) {
  return String(item?.observacao || "").trim();
}

function escaparHtml(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function observacaoItemHtml(item) {
  const observacao = textoObservacaoItem(item);
  if (!observacao) return "";

  return `<p class="detalhe-cliente-item"><strong>Detalhes do cliente:</strong> ${escaparHtml(observacao)}</p>`;
}

function blocoObservacoesPedidoHtml() {
  const itensComObservacao = carrinho.filter(item => textoObservacaoItem(item));
  if (!itensComObservacao.length) return "";

  const linhas = itensComObservacao.map(item => `
    <li>
      <strong>Ref. ${escaparHtml(item.referencia || "-")}</strong>
      <span>${escaparHtml(textoObservacaoItem(item))}</span>
    </li>
  `).join("");

  return `
    <div class="resumo-observacoes-bloco">
      <h3>Detalhes informados pelo cliente</h3>
      <ul>${linhas}</ul>
    </div>
  `;
}

function pesoItem(item) {
  return totalPecasItem(item) * pesoNumerico(item.peso);
}

function resumoPorFabrica() {
  const resumo = {};

  carrinho.forEach(item => {
    if (!resumo[item.fabrica]) {
      resumo[item.fabrica] = {
        pecas: 0,
        peso: 0,
        valor: 0
      };
    }

    resumo[item.fabrica].pecas += totalPecasItem(item);
    resumo[item.fabrica].peso += pesoItem(item);
    resumo[item.fabrica].valor += valorItem(item);
  });

  return resumo;
}

function regrasComerciaisFabrica(fabrica) {
  fabrica = String(fabrica || "").toLowerCase();

  const regras = {
    inove: { minimo: 20000, metaDesconto: 70000, percentualDesconto: 5 },
    tendenze: { minimo: 30000, metaDesconto: 70000, percentualDesconto: 5 },
    zarrara: { minimo: 20000, metaDesconto: 70000, percentualDesconto: 5 }
  };

  return regras[fabrica] || { minimo: 0, metaDesconto: 70000, percentualDesconto: 5 };
}

function valorMinimoFabrica(fabrica) {
  if (codigoComercialEstaAtivoParaFabrica(fabrica)) {
    return Number(codigoComercialAplicado.valorMinimo || VALOR_MINIMO_CODIGO_PADRAO);
  }

  return regrasComerciaisFabrica(fabrica).minimo;
}

function carregarCodigoComercialSalvo() {
  try {
    const salvo = localStorage.getItem("codigoComercialAplicado");
    if (!salvo) return null;

    const dados = JSON.parse(salvo);
    if (!dados || !dados.codigo || !dados.valido) return null;

    return {
      codigo: normalizarCodigoComercial(dados.codigo),
      valido: false,
      revalidar: true
    };
  } catch (erro) {
    localStorage.removeItem("codigoComercialAplicado");
    return null;
  }
}

function salvarCodigoComercial() {
  if (codigoComercialAplicado && codigoComercialAplicado.valido) {
    localStorage.setItem("codigoComercialAplicado", JSON.stringify(codigoComercialAplicado));
    return;
  }

  localStorage.removeItem("codigoComercialAplicado");
}

function normalizarCodigoComercial(codigo) {
  return String(codigo || "").trim().toUpperCase();
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function codigoComercialCompativelComFabrica(fabrica) {
  if (!codigoComercialAplicado || !codigoComercialAplicado.valido) return false;

  const fabricaCodigo = String(codigoComercialAplicado.fabrica || "TODAS").trim().toUpperCase();
  const fabricaAtualPedido = String(fabrica || fabricaDoCarrinho() || fabricaAtual || "").trim().toUpperCase();

  return !fabricaCodigo || fabricaCodigo === "TODAS" || fabricaCodigo === fabricaAtualPedido;
}

function codigoComercialEstaAtivoParaFabrica(fabrica) {
  return Boolean(codigoComercialAplicado?.valido && codigoComercialCompativelComFabrica(fabrica));
}

function codigoComercialParaPayload() {
  const fabricaPedido = fabricaDoCarrinho() || fabricaAtual || "";
  if (!codigoComercialEstaAtivoParaFabrica(fabricaPedido)) return null;

  return {
    codigo: codigoComercialAplicado.codigo,
    tipo: codigoComercialAplicado.tipo || "PRIMEIRA_COMPRA",
    loja: codigoComercialAplicado.loja || codigoComercialAplicado.cliente || "",
    cliente: codigoComercialAplicado.cliente || codigoComercialAplicado.loja || "",
    valorMinimo: Number(codigoComercialAplicado.valorMinimo || VALOR_MINIMO_CODIGO_PADRAO),
    descontoPercentual: Number(codigoComercialAplicado.descontoPercentual || 0),
    validade: codigoComercialAplicado.validade || "",
    fabrica: codigoComercialAplicado.fabrica || "TODAS",
    validadoEm: codigoComercialAplicado.validadoEm || "",
    origemValidacao: codigoComercialAplicado.origemValidacao || "apps_script",
    status: "VALIDADO"
  };
}

function jsonpAppsScript(params) {
  return new Promise((resolve, reject) => {
    const callbackName = "callbackCodigoComercial_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    const script = document.createElement("script");
    const url = new URL(URL_APPS_SCRIPT_PEDIDO);

    Object.entries(params || {}).forEach(([chave, valor]) => {
      url.searchParams.set(chave, valor == null ? "" : String(valor));
    });

    url.searchParams.set("callback", callbackName);

    const limpar = () => {
      delete window[callbackName];
      script.remove();
    };

    const timeout = setTimeout(() => {
      limpar();
      reject(new Error("Tempo esgotado ao validar o código."));
    }, 12000);

    window[callbackName] = resposta => {
      clearTimeout(timeout);
      limpar();
      resolve(resposta || {});
    };

    script.onerror = () => {
      clearTimeout(timeout);
      limpar();
      reject(new Error("Não foi possível consultar o código."));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function estadoVisualCodigoComercial() {
  const fabrica = fabricaDoCarrinho() || fabricaAtual || "";
  const codigoAtual = codigoComercialAplicado?.codigo ? normalizarCodigoComercial(codigoComercialAplicado.codigo) : "";

  if (codigoComercialAplicado?.valido && codigoComercialCompativelComFabrica(fabrica)) {
    const desconto = Number(codigoComercialAplicado.descontoPercentual || 0);

    if (desconto > 0) {
      return {
        classe: "ativo",
        trigger: `Cupom ativo: ${codigoAtual}`,
        triggerNote: `${desconto}% aplicado`,
        texto: `${desconto}% aplicado no total do carrinho.`
      };
    }

    return {
      classe: "ativo",
      trigger: `Cupom validado: ${codigoAtual}`,
      triggerNote: "Mínimo especial liberado",
      texto: "Mínimo especial liberado por código comercial."
    };
  }

  if (codigoComercialAplicado?.codigo && !codigoComercialAplicado?.valido) {
    return {
      classe: "erro",
      trigger: "Cupom não aplicado",
      triggerNote: "Verifique o código",
      texto: statusValidacaoCodigo || "Código inválido ou ainda não validado."
    };
  }

  if (statusValidacaoCodigo && statusValidacaoCodigo !== "Código removido.") {
    const texto = String(statusValidacaoCodigo || "");
    const classe = /inválido|invalido|erro|não foi|nao foi|indispon/i.test(texto) ? "erro" : "info";
    return {
      classe,
      trigger: "Tenho cupom",
      triggerNote: classe === "erro" ? "Não aplicado" : "Validação em andamento",
      texto
    };
  }

  return {
    classe: "vazio",
    trigger: "+ Tenho cupom",
    triggerNote: "Adicionar desconto",
    texto: ""
  };
}

function renderizarBlocoCodigoComercial() {
  const estado = estadoVisualCodigoComercial();
  const codigoAtual = codigoComercialAplicado?.codigo
    ? normalizarCodigoComercial(codigoComercialAplicado.codigo)
    : "";
  const valorInput = codigoAtual || "";
  const aberto = codigoComercialPainelAberto ? "hb-cupom--open" : "";
  const statusHtml = estado.texto
    ? `<p class="hb-cupom__status hb-cupom__status--${escapeHtml(estado.classe)}">${escapeHtml(estado.texto)}</p>`
    : "";
  const removerHtml = codigoComercialAplicado?.valido
    ? `<span role="button" tabindex="0" class="hb-cupom__remove" onclick="removerCodigoComercial()" onkeydown="hbCupomKey(event, 'remover')">Remover</span>`
    : "";

  return `
    <section class="hb-cupom hb-cupom--${escapeHtml(estado.classe)} ${aberto}" aria-label="Cupom do pedido">
      <span role="button" tabindex="0" class="hb-cupom__trigger"
            onclick="alternarCodigoComercialPainel()"
            onkeydown="hbCupomKey(event, 'toggle')"
            aria-expanded="${codigoComercialPainelAberto ? "true" : "false"}">
        <span class="hb-cupom__trigger-prefixo" aria-hidden="true">%</span>
        <span class="hb-cupom__trigger-texto">
          <span class="hb-cupom__trigger-main">${escapeHtml(estado.trigger)}</span>
          ${estado.triggerNote
            ? `<span class="hb-cupom__trigger-note">${escapeHtml(estado.triggerNote)}</span>`
            : ""}
        </span>
        <span class="hb-cupom__trigger-icon" aria-hidden="true">⌄</span>
      </span>

      <div class="hb-cupom__body">
        <div class="hb-cupom__linha">
          <input id="hb-cupom-input"
                 class="hb-cupom__input"
                 type="text"
                 value="${escapeHtml(valorInput)}"
                 placeholder="Digite seu código"
                 autocomplete="off"
                 aria-label="Cupom ou código comercial"
                 oninput="statusValidacaoCodigo = '';" />
          <span role="button" tabindex="0" class="hb-cupom__apply"
                onclick="aplicarCodigoComercial()"
                onkeydown="hbCupomKey(event, 'aplicar')">Aplicar</span>
        </div>
        <div class="hb-cupom__feedback">
          ${statusHtml}
          ${removerHtml}
        </div>
      </div>
    </section>
  `;
}

function hbCupomKey(event, acao) {
  if (!event || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();

  if (acao === "toggle") alternarCodigoComercialPainel();
  if (acao === "aplicar") aplicarCodigoComercial();
  if (acao === "remover") removerCodigoComercial();
}

function alternarCodigoComercialPainel() {
  codigoComercialPainelAberto = !codigoComercialPainelAberto;
  statusValidacaoCodigo = statusValidacaoCodigo || "";
  sincronizarEstadoCupomMobile();
  renderizarCarrinho();

  if (codigoComercialPainelAberto) {
    setTimeout(() => {
      const input = document.getElementById("hb-cupom-input") || document.getElementById("codigo-comercial-input");
      if (input) {
        input.focus();
        input.select();
      }
    }, 80);
  }
}

function montarCodigoComercialAplicadoDaResposta(codigo, resposta) {
  return {
    codigo: normalizarCodigoComercial(resposta.codigo || codigo),
    valido: true,
    tipo: resposta.tipo || "PRIMEIRA_COMPRA",
    loja: resposta.loja || resposta.cliente || "",
    cliente: resposta.cliente || resposta.loja || "",
    valorMinimo: Number(resposta.valorMinimo || resposta.valor_minimo || VALOR_MINIMO_CODIGO_PADRAO),
    descontoPercentual: Number(resposta.descontoPercentual ?? resposta.desconto_percentual ?? DESCONTO_CODIGO_PADRAO),
    validade: resposta.validade || "",
    fabrica: resposta.fabrica || "TODAS",
    validadoEm: new Date().toISOString(),
    origemValidacao: "apps_script"
  };
}

async function aplicarCodigoComercialValor(codigoInformado) {
  return aplicarCodigoComercialPorCodigo(codigoInformado);
}

async function aplicarCodigoComercialPorCodigo(codigoInformado) {
  const codigo = normalizarCodigoComercial(codigoInformado);
  const sequenciaAtual = ++sequenciaValidacaoCodigo;

  if (!codigo) {
    codigoComercialAplicado = null;
    statusValidacaoCodigo = "Digite um código comercial.";
    codigoComercialPainelAberto = true;
    salvarCodigoComercial();
    sincronizarEstadoCupomMobile();
    renderizarCarrinho();
    return false;
  }

  codigoComercialAplicado = { codigo, valido: false };
  statusValidacaoCodigo = "Validando código...";
  codigoComercialPainelAberto = true;
  salvarCodigoComercial();
  sincronizarEstadoCupomMobile();
  renderizarCarrinho();

  try {
    const resposta = await jsonpAppsScript({
      acao: "validar_codigo",
      codigo,
      fabrica: fabricaDoCarrinho() || fabricaAtual || "",
      subtotal: valorSubtotalPedido ? valorSubtotalPedido() : 0,
      origem: "catalogo-online"
    });

    if (sequenciaAtual !== sequenciaValidacaoCodigo) return false;

    if (!resposta || !resposta.valido) {
      codigoComercialAplicado = { codigo, valido: false };
      statusValidacaoCodigo = resposta?.mensagem || "Código inválido ou indisponível.";
      codigoComercialPainelAberto = true;
      salvarCodigoComercial();
      sincronizarEstadoCupomMobile();
      renderizarCarrinho();
      return false;
    }

    codigoComercialAplicado = montarCodigoComercialAplicadoDaResposta(codigo, resposta);
    statusValidacaoCodigo = "Código aplicado.";
    codigoComercialPainelAberto = false;
    salvarCodigoComercial();
    sincronizarEstadoCupomMobile();
    renderizarCarrinho();
    return true;
  } catch (erro) {
    if (sequenciaAtual !== sequenciaValidacaoCodigo) return false;
    codigoComercialAplicado = { codigo, valido: false };
    statusValidacaoCodigo = "Não foi possível validar o código agora. Tente novamente.";
    codigoComercialPainelAberto = true;
    salvarCodigoComercial();
    sincronizarEstadoCupomMobile();
    renderizarCarrinho();
    return false;
  }
}

async function aplicarCodigoComercial() {
  const input = document.getElementById("hb-cupom-input") || document.getElementById("codigo-comercial-input");
  await aplicarCodigoComercialPorCodigo(input ? input.value : "");
}

function removerCodigoComercial() {
  sequenciaValidacaoCodigo++;
  codigoComercialAplicado = null;
  statusValidacaoCodigo = "Código removido.";
  codigoComercialPainelAberto = false;
  salvarCodigoComercial();
  sincronizarEstadoCupomMobile();
  renderizarCarrinho();
}

function metaDescontoFabrica(fabrica) {
  return regrasComerciaisFabrica(fabrica).metaDesconto;
}

function percentualDescontoFabrica(fabrica) {
  return regrasComerciaisFabrica(fabrica).percentualDesconto;
}

function percentualMeta(valorAtual, valorMeta) {
  if (!valorMeta || valorMeta <= 0) return 0;
  return Math.min((valorAtual / valorMeta) * 100, 100);
}

function criarBarraMeta(titulo, valorAtual, valorMeta) {
  const percentual = percentualMeta(valorAtual, valorMeta);
  const atingiu = valorAtual >= valorMeta;

  return `
    <div class="meta-linha">
      <span class="meta-nome">${titulo}</span>
      <div class="meta-barra">
        <div class="meta-barra-preenchimento ${atingiu ? "atingido" : ""}" style="width: ${percentual}%;"></div>
      </div>
      <span class="meta-valor">${percentual.toFixed(0)}%</span>
    </div>
  `;
}

function criarResumoMetasMobile(valorAtual, fabrica) {
  if (!fabrica) return "";

  const minimo = valorMinimoFabrica(fabrica);
  const metaDesconto = metaDescontoFabrica(fabrica);
  const percMinimo = percentualMeta(valorAtual, minimo);
  const percDesconto = percentualMeta(valorAtual, metaDesconto);

  return `
    <div class="resumo-metas-mobile">
      <span>Mín: ${percMinimo.toFixed(0)}%</span>
      <span>Meta: ${percDesconto.toFixed(0)}%</span>
    </div>
  `;
}

function mensagemMeta(valorAtual, fabrica) {
  const minimo = valorMinimoFabrica(fabrica);
  const metaDesconto = metaDescontoFabrica(fabrica);
  const percentual = percentualDescontoFabrica(fabrica);
  const codigoAtivo = codigoComercialEstaAtivoParaFabrica(fabrica);

  if (valorAtual < minimo) {
    const faltante = `faltam R$ ${formatarMoeda(minimo - valorAtual)}`;
    return codigoAtivo
      ? `Mínimo comercial pendente • ${faltante}`
      : `Faltam R$ ${formatarMoeda(minimo - valorAtual)} para o mínimo comercial`;
  }

  if (codigoAtivo) {
    const descontoCodigo = Number(codigoComercialAplicado.descontoPercentual || 0);
    return descontoCodigo > 0
      ? `Cupom aplicado no total do carrinho`
      : `Mínimo especial liberado pelo código`;
  }

  if (valorAtual < metaDesconto) {
    return `Faltam R$ ${formatarMoeda(metaDesconto - valorAtual)} para ${percentual}% de desconto por meta`;
  }

  return `${percentual}% de desconto por meta aplicado`;
}

function percentualDescontoPedido(valorAtual, fabrica) {
  // Cupom validado aplica desconto diretamente no total do carrinho.
  // O mínimo comercial continua sendo controlado separadamente por valorMinimoFabrica().
  if (codigoComercialEstaAtivoParaFabrica(fabrica)) {
    const descontoCodigo = Number(codigoComercialAplicado.descontoPercentual || 0);

    if (Number.isFinite(descontoCodigo) && descontoCodigo > 0) {
      return descontoCodigo;
    }
  }

  if (!fabrica) return 0;
  return valorAtual >= metaDescontoFabrica(fabrica) ? percentualDescontoFabrica(fabrica) : 0;
}

function valorDescontoPedido(valorAtual, fabrica) {
  return valorAtual * (percentualDescontoPedido(valorAtual, fabrica) / 100);
}

function valorTotalComDesconto(valorAtual, fabrica) {
  return Math.max(valorAtual - valorDescontoPedido(valorAtual, fabrica), 0);
}

function origemDescontoPedido(valorAtual, fabrica) {
  const percentual = percentualDescontoPedido(valorAtual, fabrica);

  if (!percentual || percentual <= 0) {
    return "";
  }

  if (codigoComercialEstaAtivoParaFabrica(fabrica)) {
    const descontoCodigo = Number(codigoComercialAplicado.descontoPercentual || 0);

    if (Number.isFinite(descontoCodigo) && descontoCodigo > 0 && descontoCodigo === percentual) {
      return "cupom";
    }
  }

  return "meta";
}

function resumoTotaisPedido(valorAtual = valorSubtotalPedido(), fabrica = fabricaDoCarrinho()) {
  const subtotal = Number(valorAtual || 0);
  const percentualDesconto = percentualDescontoPedido(subtotal, fabrica);
  const valorDesconto = valorDescontoPedido(subtotal, fabrica);
  const totalFinal = valorTotalComDesconto(subtotal, fabrica);
  const temDesconto = percentualDesconto > 0 && valorDesconto > 0;
  const origemDesconto = temDesconto ? origemDescontoPedido(subtotal, fabrica) : "";
  const codigo = origemDesconto === "cupom" && codigoComercialAplicado?.codigo
    ? normalizarCodigoComercial(codigoComercialAplicado.codigo)
    : "";

  return {
    fabrica,
    subtotal,
    percentualDesconto,
    valorDesconto,
    totalFinal,
    temDesconto,
    origemDesconto,
    codigo
  };
}

function badgeDescontoPedido(totais) {
  if (!totais || !totais.temDesconto) return "";
  return `<span class="hb-desconto-badge">-${Number(totais.percentualDesconto || 0)}%</span>`;
}

function labelDescontoPedido(totais) {
  if (!totais || !totais.temDesconto) return "Desconto";
  if (totais.origemDesconto === "cupom" && totais.codigo) return `Cupom ${escapeHtml(totais.codigo)}`;
  if (totais.origemDesconto === "meta") return "Desconto por meta";
  return "Desconto";
}

function renderizarTotalCarrinhoRodape() {
  const fabrica = fabricaDoCarrinho();
  const subtotal = valorSubtotalPedido();

  if (!fabrica || subtotal <= 0) {
    return "";
  }

  const totais = resumoTotaisPedido(subtotal, fabrica);

  // Evita duplicidade visual no carrinho: o card de total só aparece
  // quando existe desconto real aplicado. Sem desconto, o subtotal já
  // aparece no card superior da fábrica.
  if (!totais.temDesconto) {
    return "";
  }

  const badge = badgeDescontoPedido(totais);
  const labelDesconto = labelDescontoPedido(totais);
  const linhaDesconto = `<div class="hb-total-carrinho__linha hb-total-carrinho__linha--desconto"><span>${labelDesconto}</span><strong>-${totais.percentualDesconto}% / -R$ ${formatarMoeda(totais.valorDesconto)}</strong></div>`;
  const economiaHtml = `<div class="hb-total-carrinho__economia">Economia aplicada: R$ ${formatarMoeda(totais.valorDesconto)}</div>`;

  return `
    <section class="hb-total-carrinho hb-total-carrinho--com-desconto" aria-label="Total com desconto aplicado">
      <div class="hb-total-carrinho__linha">
        <span>Subtotal</span>
        <strong>R$ ${formatarMoeda(totais.subtotal)}</strong>
      </div>
      ${linhaDesconto}
      <div class="hb-total-carrinho__final">
        <span>Total com desconto</span>
        <strong>R$ ${formatarMoeda(totais.totalFinal)} ${badge}</strong>
      </div>
      ${economiaHtml}
    </section>
  `;
}


function iconeChevronCarrinho() {
  return `
    <svg class="icone-svg-carrinho icone-chevron" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6"></path>
    </svg>
  `;
}

function iconeLixeiraCarrinho() {
  return `
    <svg class="icone-svg-carrinho" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 6h18"></path>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    </svg>
  `;
}

function imagemItemCarrinhoCompacta(item) {
  const imagem = escaparHtml(item?.imagem || "");
  const referencia = escaparHtml(item?.referencia || "-");

  if (!imagem) {
    return `
      <div class="item-carrinho-miniatura item-carrinho-miniatura--vazia"
           aria-hidden="true">HB</div>
    `;
  }

  return `
    <div class="item-carrinho-miniatura">
      <img src="${imagem}"
           alt="Produto ${referencia}"
           width="64"
           height="64"
           loading="lazy"
           decoding="async"
           onerror="this.parentElement.classList.add('item-carrinho-miniatura--vazia'); this.parentElement.textContent='HB';" />
    </div>
  `;
}

function renderizarCarrinho(opcoes = {}) {
  const { destacarChave = "", rolarAteChave = "" } = opcoes;
  const lista = document.getElementById("lista-carrinho");
  const resumoDiv = document.getElementById("resumo-fabricas");

  if (!lista || !resumoDiv) return;

  const detalhesAbertos = new Set(
    Array.from(lista.querySelectorAll(".item-carrinho"))
      .filter(item => !item.querySelector(".detalhes-carrinho")?.classList.contains("escondido"))
      .map(item => item.dataset.carrinhoChave)
      .filter(Boolean)
  );

  lista.innerHTML = "";
  resumoDiv.innerHTML = "";

  const resumo = resumoPorFabrica();
  const fabCarrinho = fabricaDoCarrinho();

  if (fabCarrinho && resumo[fabCarrinho]) {
    const pesoAtual = resumo[fabCarrinho].peso;
    const pecasAtual = resumo[fabCarrinho].pecas;
    const valorAtual = resumo[fabCarrinho].valor;
    resumoDiv.innerHTML = `
      <div class="resumo-fabrica resumo-fabrica--limpo">
        <div class="resumo-principal-mobile">
          <strong>${nomeFabrica(fabCarrinho)}</strong>
          <span class="resumo-valor-final">${pecasAtual}p • Subtotal R$ ${formatarMoeda(valorAtual)}</span>
        </div>
        <div class="resumo-detalhes-desktop">
          <strong>${nomeFabrica(fabCarrinho)}</strong>
          <p>${pecasAtual} peças • ${formatarPeso(pesoAtual)}</p>
          <p><strong>Subtotal:</strong> R$ ${formatarMoeda(valorAtual)}</p>
        </div>
        <p class="mensagem-meta">${mensagemMeta(valorAtual, fabCarrinho)}</p>
        <div class="resumo-metas-desktop">
          ${criarBarraMeta("mín", valorAtual, valorMinimoFabrica(fabCarrinho))}
          ${criarBarraMeta("meta", valorAtual, metaDescontoFabrica(fabCarrinho))}
        </div>
        ${criarResumoMetasMobile(valorAtual, fabCarrinho)}
      </div>
    `;
  }

  const totalCarrinhoRoot = document.getElementById("hb-total-carrinho-root");
  if (totalCarrinhoRoot) {
    totalCarrinhoRoot.innerHTML = renderizarTotalCarrinhoRodape();
  }

  const cupomRoot = document.getElementById("hb-cupom-root");
  if (cupomRoot) {
    cupomRoot.innerHTML = renderizarBlocoCodigoComercial();
  }

  let htmlItensCarrinho = "";

  carrinho.forEach((item, index) => {
    const ehAnel = ehCategoriaAnel(item.categoria);
    const referenciaHtml = escaparHtml(item.referencia || "-");
    const pesoHtml = escaparHtml(item.peso || "-");
    const quantidadeItem = ehAnel ? totalPecasItem(item) : item.quantidade;
    const miniaturaHtml = imagemItemCarrinhoCompacta(item);

    let linhasNumeracoes = "";
    if (ehAnel) {
      NUMERACOES_ANEIS.forEach(numero => {
        const qtd = item.numeracoes?.[numero] || 0;
        if (qtd > 0) {
          linhasNumeracoes += `<li>Aro ${numero}: ${qtd} peça(s)</li>`;
        }
      });
    }

    htmlItensCarrinho += `
      <article class="item-carrinho item-carrinho-com-imagem"
               data-carrinho-chave="${escaparHtml(chaveProdutoCarrinho(item))}">
        <div class="item-carrinho-linha-principal">
          ${miniaturaHtml}

          <div class="item-carrinho-conteudo">
            <div class="item-carrinho-cabecalho">
              <div class="item-carrinho-titulo-area">
                <h3>Ref. ${referenciaHtml}</h3>
              </div>

              <div class="item-carrinho-acoes" aria-label="Ações do item">
                <button type="button"
                        class="botao-icone-carrinho botao-detalhes-carrinho"
                        onclick="alternarDetalhesItem(${index}, this)"
                        aria-label="Ver detalhes do item"
                        title="Ver detalhes"
                        aria-expanded="false">
                  ${iconeChevronCarrinho()}
                </button>
                <button type="button"
                        class="botao-icone-carrinho botao-remover-carrinho"
                        onclick="removerItem(${index})"
                        aria-label="Remover item"
                        title="Remover item">
                  ${iconeLixeiraCarrinho()}
                </button>
              </div>
            </div>

            <div class="item-carrinho-resumo-linha">
              <span>${quantidadeItem} peça(s)</span>
              <strong>R$ ${formatarMoeda(valorItem(item))}</strong>
            </div>
          </div>
        </div>

        <div class="detalhes-carrinho escondido" id="detalhes-carrinho-${index}">
          <p><strong>Peso un.:</strong> ${pesoHtml}</p>
          ${observacaoItemHtml(item)}
          <p><strong>Valor un. estimado:</strong> R$ ${formatarMoeda(valorUnitarioProduto(item))}</p>
          ${ehAnel && linhasNumeracoes ? `<ul>${linhasNumeracoes}</ul>` : ""}
        </div>
      </article>
    `;
  });

  // Evita reconstruir toda a lista a cada item incluído no HTML.
  lista.innerHTML = htmlItensCarrinho;

  lista.querySelectorAll(".item-carrinho").forEach(itemEl => {
    const chave = itemEl.dataset.carrinhoChave || "";
    if (!detalhesAbertos.has(chave)) return;

    const detalhes = itemEl.querySelector(".detalhes-carrinho");
    const botao = itemEl.querySelector(".botao-detalhes-carrinho");

    detalhes?.classList.remove("escondido");
    botao?.classList.add("aberto");
    botao?.setAttribute("aria-expanded", "true");
    botao?.setAttribute("title", "Ocultar detalhes");
    botao?.setAttribute("aria-label", "Ocultar detalhes do item");
  });

  if (destacarChave) {
    const itemDestacado = Array.from(lista.querySelectorAll(".item-carrinho"))
      .find(item => item.dataset.carrinhoChave === destacarChave);

    if (itemDestacado) {
      itemDestacado.classList.add("item-novo");
      setTimeout(() => itemDestacado.classList.remove("item-novo"), 700);
    }
  }

  atualizarBotaoCarrinhoLateral();
  atualizarSelosProdutosNoCarrinho();

  if (rolarAteChave) {
    requestAnimationFrame(() => rolarCarrinhoAteItem(rolarAteChave));
  }
}

function alternarDetalhesItem(index, botao) {
  const detalhes = document.getElementById(`detalhes-carrinho-${index}`);
  if (!detalhes) return;

  const estaEscondido = detalhes.classList.toggle("escondido");

  if (botao) {
    botao.classList.toggle("aberto", !estaEscondido);
    botao.setAttribute("aria-expanded", String(!estaEscondido));
    botao.setAttribute("title", estaEscondido ? "Ver detalhes" : "Ocultar detalhes");
    botao.setAttribute("aria-label", estaEscondido ? "Ver detalhes do item" : "Ocultar detalhes do item");
  }
}

function removerItem(index) {
  carrinho.splice(index, 1);
  salvarCarrinho();
  renderizarCarrinho();
}

function rolarCarrinhoAteItem(chave) {
  const caixa = document.getElementById("lista-carrinho");
  if (!caixa || !chave) return;

  const item = Array.from(caixa.querySelectorAll(".item-carrinho"))
    .find(elemento => elemento.dataset.carrinhoChave === chave);
  if (!item) return;

  const topoDesejado = Math.max(
    0,
    item.offsetTop - caixa.clientHeight + item.offsetHeight + 12
  );

  caixa.scrollTo({
    top: topoDesejado,
    behavior: "smooth"
  });
}


function animarConfirmacaoMobileCarrinho(texto = "Item adicionado ao carrinho") {
  if (!window.matchMedia || !window.matchMedia("(max-width: 768px)").matches) return;

  const existente = document.querySelector(".toast-carrinho-mobile");
  if (existente) existente.remove();

  const toast = document.createElement("div");
  toast.className = "toast-carrinho-mobile";
  toast.innerHTML = `
    <span class="toast-carrinho-check" aria-hidden="true">✓</span>
    <span>${texto}</span>
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("toast-carrinho-mobile-visivel");
  });

  const botaoCarrinho = alvoAnimacaoCarrinho();
  if (botaoCarrinho && movimentoReduzidoAtivo()) {
    pulsarAlvoCarrinho(botaoCarrinho);
  }

  setTimeout(() => {
    toast.classList.remove("toast-carrinho-mobile-visivel");
    setTimeout(() => toast.remove(), 220);
  }, 1050);
}

function alvoAnimacaoCarrinho() {
  const mobile =
    window.matchMedia &&
    window.matchMedia("(max-width: 768px)").matches;

  if (mobile) {
    return (
      document.querySelector(".mobile-tabbar .tab-pedido") ||
      document.querySelector(".carrinho-aba-lateral") ||
      document.querySelector(".botao-carrinho-lateral")
    );
  }

  return (
    document.querySelector(".carrinho-aba-lateral") ||
    document.querySelector(".botao-carrinho-lateral")
  );
}

function movimentoReduzidoAtivo() {
  return Boolean(
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function pulsarAlvoCarrinho(alvo = alvoAnimacaoCarrinho()) {
  if (!alvo) return;

  const classe = "hb-carrinho-impacto";
  alvo.classList.remove(classe);
  void alvo.offsetWidth;
  alvo.classList.add(classe);

  window.setTimeout(() => {
    alvo.classList.remove(classe);
  }, 900);
}

function capturarSnapshotAnimacaoCarrinho(imagem) {
  const alvo = alvoAnimacaoCarrinho();

  if (!imagem || !alvo) return null;

  const src = imagem.currentSrc || imagem.src || "";
  if (!src) return null;

  const origem = imagem.getBoundingClientRect();
  const destino = alvo.getBoundingClientRect();

  if (
    origem.width <= 0 ||
    origem.height <= 0 ||
    destino.width <= 0 ||
    destino.height <= 0
  ) {
    return null;
  }

  return {
    src,
    alt: imagem.alt || "",
    origem: {
      left: origem.left,
      top: origem.top,
      width: origem.width,
      height: origem.height
    },
    destino: {
      left: destino.left,
      top: destino.top,
      width: destino.width,
      height: destino.height
    }
  };
}

function executarAnimacaoCarrinho(snapshot) {
  if (!snapshot) {
    pulsarAlvoCarrinho();
    return Promise.resolve(false);
  }

  const reduzido = movimentoReduzidoAtivo();
  const proporcao =
    snapshot.origem.width / Math.max(snapshot.origem.height, 1);

  const larguraInicial = Math.min(
    reduzido ? 92 : 126,
    Math.max(reduzido ? 72 : 92, snapshot.origem.width)
  );

  const alturaInicial = Math.min(
    reduzido ? 92 : 126,
    Math.max(
      reduzido ? 72 : 92,
      larguraInicial / Math.max(proporcao, 0.42)
    )
  );

  const origemX =
    snapshot.origem.left +
    (snapshot.origem.width - larguraInicial) / 2;

  const origemY =
    snapshot.origem.top +
    (snapshot.origem.height - alturaInicial) / 2;

  const destinoX =
    snapshot.destino.left +
    snapshot.destino.width / 2 -
    larguraInicial / 2;

  const destinoY =
    snapshot.destino.top +
    snapshot.destino.height / 2 -
    alturaInicial / 2;

  const deslocamentoX = destinoX - origemX;
  const deslocamentoY = destinoY - origemY;
  const arcoY = reduzido
    ? -12
    : Math.min(-72, deslocamentoY * 0.20 - 38);

  const camada = document.createElement("div");
  camada.className = "hb-item-indo-carrinho";
  camada.setAttribute("aria-hidden", "true");
  camada.style.left = `${origemX}px`;
  camada.style.top = `${origemY}px`;
  camada.style.width = `${larguraInicial}px`;
  camada.style.height = `${alturaInicial}px`;

  const imagemVoo = document.createElement("img");
  imagemVoo.src = snapshot.src;
  imagemVoo.alt = "";
  imagemVoo.width = Math.round(larguraInicial);
  imagemVoo.height = Math.round(alturaInicial);
  imagemVoo.loading = "eager";
  imagemVoo.decoding = "async";
  imagemVoo.draggable = false;

  const selo = document.createElement("span");
  selo.className = "hb-item-indo-carrinho__selo";
  selo.textContent = "+";

  const brilho = document.createElement("span");
  brilho.className = "hb-item-indo-carrinho__brilho";

  camada.append(imagemVoo, brilho, selo);
  document.body.appendChild(camada);

  // Duas molduras garantem que o elemento seja pintado antes do movimento.
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const duracao = reduzido ? 340 : 960;

        if (typeof camada.animate !== "function") {
          camada.style.transition =
            `transform ${duracao}ms cubic-bezier(.18,.82,.22,1), ` +
            `opacity ${duracao}ms ease`;
          camada.style.transform =
            `translate3d(${deslocamentoX}px, ${deslocamentoY}px, 0) ` +
            "scale(.16) rotate(6deg)";
          camada.style.opacity = "0.05";

          window.setTimeout(() => {
            camada.remove();
            pulsarAlvoCarrinho();
            resolve(true);
          }, duracao + 40);
          return;
        }

        const animacao = camada.animate(
          [
            {
              transform:
                "translate3d(0, 0, 0) scale(1) rotate(0deg)",
              opacity: 1,
              filter: "brightness(1)",
              offset: 0
            },
            {
              transform:
                `translate3d(${deslocamentoX * 0.22}px, ` +
                `${deslocamentoY * 0.12 + arcoY * 0.72}px, 0) ` +
                "scale(1.03) rotate(-2deg)",
              opacity: 1,
              filter: "brightness(1.06)",
              offset: 0.25
            },
            {
              transform:
                `translate3d(${deslocamentoX * 0.62}px, ` +
                `${deslocamentoY * 0.52 + arcoY}px, 0) ` +
                "scale(.68) rotate(-5deg)",
              opacity: .96,
              filter: "brightness(1.03)",
              offset: 0.62
            },
            {
              transform:
                `translate3d(${deslocamentoX}px, ` +
                `${deslocamentoY}px, 0) ` +
                "scale(.13) rotate(8deg)",
              opacity: .08,
              filter: "brightness(1.18)",
              offset: 1
            }
          ],
          {
            duration: duracao,
            easing: "cubic-bezier(.18,.82,.22,1)",
            fill: "forwards"
          }
        );

        animacao.finished
          .catch(() => false)
          .finally(() => {
            camada.remove();
            pulsarAlvoCarrinho();
            resolve(true);
          });
      });
    });
  });
}

function agendarAnimacaoImagemAteCarrinho(imagem) {
  const snapshot = capturarSnapshotAnimacaoCarrinho(imagem);

  if (!snapshot) {
    requestAnimationFrame(() => pulsarAlvoCarrinho());
    return Promise.resolve(false);
  }

  // O fluxo pode fechar popup e reconstruir o carrinho imediatamente.
  // O snapshot preserva origem e destino antes dessas mudanças.
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        executarAnimacaoCarrinho(snapshot).then(resolve);
      });
    });
  });
}

function animarProdutoVoando(elementoProduto) {
  const imagem = elementoProduto?.querySelector(
    ".imagem-produto img, img"
  );

  return agendarAnimacaoImagemAteCarrinho(imagem);
}

function animarImagemPopupParaCarrinho() {
  return agendarAnimacaoImagemAteCarrinho(
    document.getElementById("popup-imagem-produto")
  );
}


function totalPecasPedido() {
  return carrinho.reduce((acc, item) => acc + totalPecasItem(item), 0);
}

function valorSubtotalPedido() {
  return carrinho.reduce((acc, item) => acc + valorItem(item), 0);
}

function valorTotalPedido() {
  return valorTotalComDesconto(valorSubtotalPedido(), fabricaDoCarrinho());
}

function atualizarBotaoPedidoMobile() {
  const botaoPedido = document.querySelector(".mobile-tabbar .tab-pedido");
  if (!botaoPedido) return;

  const referencias = carrinho.length;
  const pecas = totalPecasPedido();
  const valor = valorTotalPedido();
  const badge = referencias > 99 ? "99+" : String(referencias);

  botaoPedido.setAttribute(
    "aria-label",
    `Abrir pedido: ${referencias} referência(s), ${pecas} peça(s), total R$ ${formatarMoeda(valor)}`
  );

  botaoPedido.innerHTML = `
    <span class="tab-ico tab-pedido-icone" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
    </span>
    <span class="tab-pedido-label">Pedido</span>
    <span class="tab-pedido-badge" aria-hidden="true">${badge}</span>
  `;
}

function atualizarBotaoCarrinhoLateral() {
  const botao = document.querySelector(".botao-carrinho-lateral");
  const areaCarrinho = document.getElementById("area-carrinho");

  if (!botao) {
    atualizarBotaoPedidoMobile();
    return;
  }

  const aberto =
    areaCarrinho &&
    !areaCarrinho.classList.contains("carrinho-fechado");

  const referencias = carrinho.length;
  const pecas = totalPecasPedido();
  const badge = referencias > 99 ? "99+" : String(referencias);

  botao.classList.toggle("oculto", aberto);
  botao.classList.toggle("sem-itens", referencias === 0);

  botao.innerHTML = `
    <span class="icone-carrinho" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg"
           width="24"
           height="24"
           viewBox="0 0 24 24"
           fill="none"
           stroke="currentColor"
           stroke-width="1.8"
           stroke-linecap="round"
           stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39
                 a2 2 0 0 0 2 1.61
                 h9.72
                 a2 2 0 0 0 2-1.61
                 L23 6H6">
        </path>
      </svg>
    </span>
    <span class="texto-carrinho-lateral">Pedido</span>
    <span class="contador-carrinho" id="contador-carrinho" aria-hidden="true">${badge}</span>
  `;

  botao.setAttribute(
    "aria-label",
    aberto
      ? "Carrinho aberto"
      : `Abrir pedido: ${referencias} referência(s) e ${pecas} peça(s)`
  );
  botao.title = aberto ? "Carrinho aberto" : "Abrir pedido";

  atualizarBotaoPedidoMobile();
}

function abrirZoomImagem(src, alt) {
  const zoom = document.getElementById("zoom-imagem");
  const img = document.getElementById("zoom-img");

  if (!zoom || !img || !src) return;

  img.src = src;
  img.alt = alt || "Imagem ampliada do produto";
  zoom.classList.add("ativo");
  zoom.setAttribute("aria-hidden", "false");
  document.body.classList.add("zoom-aberto");
  gerenciadorOverlay.abrir("zoom-imagem");
}

function fecharZoomImagem() {
  const zoom = document.getElementById("zoom-imagem");
  const img = document.getElementById("zoom-img");

  if (!zoom || !img) return;

  zoom.classList.remove("ativo");
  zoom.setAttribute("aria-hidden", "true");
  document.body.classList.remove("zoom-aberto");
  gerenciadorOverlay.fechar("zoom-imagem");

  setTimeout(() => {
    if (!zoom.classList.contains("ativo")) {
      img.src = "";
    }
  }, 200);
}

document.addEventListener("click", function (event) {
  const zoom = document.getElementById("zoom-imagem");
  if (!zoom || !zoom.classList.contains("ativo")) return;

  if (event.target === zoom) {
    fecharZoomImagem();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") return;

  const zoom = document.getElementById("zoom-imagem");
  const modalDados = document.getElementById("modal-dados-cliente");
  const modalResumo = document.getElementById("modal-resumo");
  const popup = document.getElementById("popup");
  const carrinho = document.getElementById("area-carrinho");

  if (zoom?.classList.contains("ativo")) return fecharZoomImagem();
  if (modalDados && !modalDados.classList.contains("escondido")) return fecharDadosClientePedido();
  if (modalResumo && !modalResumo.classList.contains("escondido")) return fecharResumoPedido();
  if (popup && !popup.classList.contains("escondido")) return fecharPopup();
  if (carrinho && !carrinho.classList.contains("carrinho-fechado")) return fecharCarrinho();
});

const hbOrigensFocoModal = new WeakMap();

function elementosFocaveisModal(modal) {
  if (!modal) return [];
  return Array.from(modal.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
  )).filter(elemento => {
    const estilo = window.getComputedStyle(elemento);
    return estilo.display !== "none" && estilo.visibility !== "hidden";
  });
}

function registrarOrigemFocoModal(modal) {
  if (!modal) return;
  const ativo = document.activeElement;
  if (ativo && ativo !== document.body && !modal.contains(ativo)) {
    hbOrigensFocoModal.set(modal, ativo);
  }
}

function focarModalAcessivel(modal, alvoPreferencial) {
  if (!modal) return;
  const alvo = alvoPreferencial || elementosFocaveisModal(modal)[0] || modal;
  window.setTimeout(() => {
    if (!modal.classList.contains("escondido") && typeof alvo.focus === "function") {
      alvo.focus();
    }
  }, 80);
}

function restaurarFocoModal(modal) {
  const origem = modal ? hbOrigensFocoModal.get(modal) : null;
  hbOrigensFocoModal.delete(modal);
  if (origem && document.contains(origem) && typeof origem.focus === "function") {
    window.setTimeout(() => origem.focus(), 40);
  }
}

function modalFinalVisivelMaisAcima() {
  const dados = document.getElementById("modal-dados-cliente");
  const resumo = document.getElementById("modal-resumo");
  if (dados && !dados.classList.contains("escondido")) return dados;
  if (resumo && !resumo.classList.contains("escondido")) return resumo;
  return null;
}

function manterFocoNosModaisFinais(event) {
  if (event.key !== "Tab") return;
  const modal = modalFinalVisivelMaisAcima();
  if (!modal) return;
  const focaveis = elementosFocaveisModal(modal);
  if (!focaveis.length) {
    event.preventDefault();
    modal.focus();
    return;
  }
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];
  const ativo = document.activeElement;
  if (event.shiftKey && (ativo === primeiro || !modal.contains(ativo))) {
    event.preventDefault();
    ultimo.focus();
  } else if (!event.shiftKey && (ativo === ultimo || !modal.contains(ativo))) {
    event.preventDefault();
    primeiro.focus();
  }
}

document.addEventListener("keydown", manterFocoNosModaisFinais);

let carrinhoDragYInicial = 0;
let carrinhoArrastando = false;
let carrinhoDeltaY = 0;
let arrastoCarrinhoMobileIniciado = false;

function mobileAtivo() {
  return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
}

/* ======================================================================
   HB CATALOGO P04 — gerenciador unico de overlays e bloqueio de pagina.
   Evita touchmove global, wrappers de funcoes e travas concorrentes.
   ====================================================================== */
const gerenciadorOverlay = (() => {
  const ativos = new Set();
  let scrollYTravado = 0;
  let modoAplicado = "";
  let estilosOriginais = null;
  let frameResize = 0;

  function capturarEstilosOriginais() {
    if (estilosOriginais) return;

    estilosOriginais = {
      htmlOverflow: document.documentElement.style.overflow,
      htmlOverscroll: document.documentElement.style.overscrollBehavior,
      bodyOverflow: document.body.style.overflow,
      bodyOverscroll: document.body.style.overscrollBehavior,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyLeft: document.body.style.left,
      bodyRight: document.body.style.right,
      bodyWidth: document.body.style.width
    };
  }

  function restaurarEstilosOriginais() {
    if (!estilosOriginais) return;

    document.documentElement.style.overflow = estilosOriginais.htmlOverflow;
    document.documentElement.style.overscrollBehavior = estilosOriginais.htmlOverscroll;
    document.body.style.overflow = estilosOriginais.bodyOverflow;
    document.body.style.overscrollBehavior = estilosOriginais.bodyOverscroll;
    document.body.style.position = estilosOriginais.bodyPosition;
    document.body.style.top = estilosOriginais.bodyTop;
    document.body.style.left = estilosOriginais.bodyLeft;
    document.body.style.right = estilosOriginais.bodyRight;
    document.body.style.width = estilosOriginais.bodyWidth;
  }

  function aplicarBloqueio() {
    if (ativos.size === 0) return;

    capturarEstilosOriginais();
    const novoModo = mobileAtivo() ? "mobile" : "desktop";

    if (modoAplicado && modoAplicado !== novoModo) {
      restaurarEstilosOriginais();
      if (modoAplicado === "mobile") {
        window.scrollTo(0, scrollYTravado);
      }
    }

    if (!modoAplicado || modoAplicado !== novoModo) {
      scrollYTravado = window.scrollY || document.documentElement.scrollTop || 0;
    }

    modoAplicado = novoModo;
    document.documentElement.classList.add("hb-overlay-lock");
    document.body.classList.add("hb-overlay-lock");
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overscrollBehavior = "none";

    if (novoModo === "mobile") {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollYTravado}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    } else {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }
  }

  function liberarBloqueio() {
    if (ativos.size > 0) return;

    const modoAnterior = modoAplicado;
    restaurarEstilosOriginais();
    document.documentElement.classList.remove("hb-overlay-lock");
    document.body.classList.remove("hb-overlay-lock");

    estilosOriginais = null;
    modoAplicado = "";

    if (modoAnterior === "mobile") {
      window.scrollTo(0, scrollYTravado);
    }
  }

  function abrir(nome) {
    if (!nome) return;
    ativos.add(nome);
    aplicarBloqueio();
  }

  function fechar(nome) {
    if (!nome) return;
    ativos.delete(nome);
    liberarBloqueio();
  }

  function sincronizarAposResize() {
    if (ativos.size === 0) return;
    cancelAnimationFrame(frameResize);
    frameResize = requestAnimationFrame(aplicarBloqueio);
  }

  function estaAberto(nome) {
    return ativos.has(nome);
  }

  function ativosAtuais() {
    return Array.from(ativos);
  }

  window.addEventListener("resize", sincronizarAposResize, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", sincronizarAposResize, { passive: true });
  }

  return { abrir, fechar, estaAberto, ativosAtuais };
})();

window.__hbOverlayManager = gerenciadorOverlay;

function limparArrastoCarrinho() {
  const areaCarrinho = document.getElementById("area-carrinho");
  if (areaCarrinho) {
    areaCarrinho.style.removeProperty("transform");
    areaCarrinho.style.removeProperty("transition");
  }
  carrinhoArrastando = false;
  carrinhoDeltaY = 0;
}

function atualizarAlturaCarrinhoMobile() {
  if (!mobileAtivo()) return;

  const alturaTela = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;
  const novaAltura = Math.round(alturaTela * 0.94);

  if (Math.abs(novaAltura - ultimaAlturaCarrinhoMobile) < 2) return;

  ultimaAlturaCarrinhoMobile = novaAltura;
  document.documentElement.style.setProperty(
    "--altura-carrinho-mobile",
    `${novaAltura}px`
  );
}

function alternarCarrinho() {
  const areaCarrinho = document.getElementById("area-carrinho");
  const botao = document.querySelector(".botao-carrinho-lateral");

  if (!areaCarrinho) return;

  limparArrastoCarrinho();
  areaCarrinho.classList.toggle("carrinho-fechado");

  const aberto = !areaCarrinho.classList.contains("carrinho-fechado");
  document.body.classList.toggle("carrinho-aberto", aberto);

  if (aberto) {
    atualizarAlturaCarrinhoMobile();
    gerenciadorOverlay.abrir("carrinho");
  } else {
    gerenciadorOverlay.fechar("carrinho");
  }

  if (botao) {
    botao.setAttribute("aria-label", aberto ? "Fechar carrinho" : "Abrir carrinho");
  }

  atualizarBotaoCarrinhoLateral();
}

function fecharCarrinho() {
  const areaCarrinho = document.getElementById("area-carrinho");
  const botao = document.querySelector(".botao-carrinho-lateral");

  if (!areaCarrinho || areaCarrinho.classList.contains("carrinho-fechado")) return;

  limparArrastoCarrinho();
  areaCarrinho.classList.add("carrinho-fechado");
  document.body.classList.remove("carrinho-aberto");
  gerenciadorOverlay.fechar("carrinho");

  if (botao) botao.setAttribute("aria-label", "Abrir carrinho");
  atualizarBotaoCarrinhoLateral();
}

function cliqueForaDoCarrinho(event) {
  const areaCarrinho = document.getElementById("area-carrinho");
  const botao = document.querySelector(".botao-carrinho-lateral");
  const menuMobile = document.querySelector(".mobile-tabbar");

  if (!areaCarrinho || areaCarrinho.classList.contains("carrinho-fechado")) return;
  if (areaCarrinho.contains(event.target)) return;
  if (botao && botao.contains(event.target)) return;
  if (menuMobile && menuMobile.contains(event.target)) return;

  fecharCarrinho();
}

document.addEventListener("mousedown", cliqueForaDoCarrinho);
document.addEventListener("touchstart", cliqueForaDoCarrinho, { passive: true });

function iniciarArrastoCarrinhoMobile() {
  if (arrastoCarrinhoMobileIniciado) return;

  const areaCarrinho = document.getElementById("area-carrinho");
  if (!areaCarrinho) return;

  arrastoCarrinhoMobileIniciado = true;

  const handle = areaCarrinho.querySelector(".cart-sheet-handle");
  const topo = areaCarrinho.querySelector(".carrinho-topo");
  const alvosArrasto = [handle, topo].filter(Boolean);

  function podeIniciarArrasto(event) {
    if (!mobileAtivo() || areaCarrinho.classList.contains("carrinho-fechado")) return false;
    if (!event.touches || event.touches.length !== 1) return false;

    const alvo = event.target;
    const tocouHandleOuTopo = alvosArrasto.some(el => el.contains(alvo));

    // O arrasto fica fácil na aba e no topo do carrinho, mas não prende a rolagem da lista.
    if (tocouHandleOuTopo) return true;

    const lista = alvo.closest && alvo.closest(".lista-carrinho-scroll");
    if (lista) return lista.scrollTop <= 0;

    return false;
  }

  areaCarrinho.addEventListener("touchstart", function (event) {
    if (!podeIniciarArrasto(event)) return;

    carrinhoDragYInicial = event.touches[0].clientY;
    carrinhoArrastando = true;
    carrinhoDeltaY = 0;
    areaCarrinho.style.setProperty("transition", "none", "important");
  }, { passive: true });

  areaCarrinho.addEventListener("touchmove", function (event) {
    if (!carrinhoArrastando || !mobileAtivo()) return;
    if (!event.touches || event.touches.length !== 1) return;

    const yAtual = event.touches[0].clientY;
    carrinhoDeltaY = Math.max(0, yAtual - carrinhoDragYInicial);

    if (carrinhoDeltaY > 3) {
      event.preventDefault();
      areaCarrinho.style.setProperty("transform", `translateY(${carrinhoDeltaY}px)`, "important");
    }
  }, { passive: false });

  areaCarrinho.addEventListener("touchend", function () {
    if (!carrinhoArrastando) return;

    areaCarrinho.style.setProperty("transition", "transform 0.24s ease", "important");

    if (carrinhoDeltaY > 90) {
      areaCarrinho.style.setProperty("transform", "translateY(110%)", "important");
      setTimeout(fecharCarrinho, 80);
    } else {
      areaCarrinho.style.setProperty("transform", "translateY(0)", "important");
      setTimeout(limparArrastoCarrinho, 260);
    }

    carrinhoArrastando = false;
  }, { passive: true });

  areaCarrinho.addEventListener("touchcancel", limparArrastoCarrinho, { passive: true });
}

function inicializarCarrinhoMobile() {
  atualizarAlturaCarrinhoMobile();
  iniciarArrastoCarrinhoMobile();
}

/* Fallback desktop restrito a lista: garante roda do mouse sobre os cards
   sem instalar listener no painel inteiro ou no documento. */
function inicializarRolagemCarrinhoDesktopP04() {
  const lista = document.getElementById("lista-carrinho");
  if (!lista || lista.dataset.rolagemP04 === "ativa") return;

  lista.dataset.rolagemP04 = "ativa";
  lista.addEventListener("wheel", function (event) {
    if (window.innerWidth <= 768 || event.ctrlKey) return;
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;

    const limite = Math.max(0, lista.scrollHeight - lista.clientHeight);
    if (limite <= 1 || event.deltaY === 0) return;

    let deslocamento = event.deltaY;
    if (event.deltaMode === 1) deslocamento *= 32;
    if (event.deltaMode === 2) deslocamento *= Math.max(lista.clientHeight, 1);

    const destino = Math.min(limite, Math.max(0, lista.scrollTop + deslocamento));
    if (Math.abs(destino - lista.scrollTop) < 1) return;

    lista.scrollTop = destino;
    event.preventDefault();
  }, { passive: false });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", function () {
    inicializarCarrinhoMobile();
    inicializarRolagemCarrinhoDesktopP04();
  }, { once: true });
} else {
  inicializarCarrinhoMobile();
  inicializarRolagemCarrinhoDesktopP04();
}

function atualizarIndicadorCategorias() {
  const categorias = document.getElementById("categorias-scroll");
  const indicador = document.getElementById("categorias-indicador");

  if (!categorias || !indicador) return;

  const temRolagem = categorias.scrollWidth > categorias.clientWidth + 4;
  const chegouNoFim = categorias.scrollLeft + categorias.clientWidth >= categorias.scrollWidth - 8;

  indicador.classList.toggle("visivel", temRolagem && !chegouNoFim);
}

function agendarAtualizacaoIndicadorCategorias() {
  if (frameIndicadorCategoriasPendente) return;

  frameIndicadorCategoriasPendente = requestAnimationFrame(() => {
    frameIndicadorCategoriasPendente = 0;
    atualizarIndicadorCategorias();
  });
}

function iniciarIndicadorCategorias() {
  const categorias = document.getElementById("categorias-scroll");
  if (!categorias || categorias.dataset.indicadorIniciado === "true") {
    return;
  }

  categorias.dataset.indicadorIniciado = "true";
  categorias.addEventListener(
    "scroll",
    agendarAtualizacaoIndicadorCategorias,
    { passive: true }
  );

  agendarAtualizacaoIndicadorCategorias();
}


function atualizarVisibilidadeControlesMobile() {
  if (window.innerWidth > 768) {
    document.body.classList.remove("mobile-rolou");
    return;
  }

  const busca = document.getElementById("busca-produto");
  const buscaEmUso = busca && String(busca.value || "").trim().length > 0;
  const noTopo = window.scrollY <= 90;

  document.body.classList.toggle("mobile-rolou", !noTopo && !buscaEmUso);
}

executarQuandoDOMPronto(atualizarVisibilidadeControlesMobile);

function agendarAtualizacoesDeResizeCatalogo() {
  if (frameResizeCatalogoPendente) return;

  frameResizeCatalogoPendente = requestAnimationFrame(() => {
    frameResizeCatalogoPendente = 0;
    atualizarAlturaCarrinhoMobile();
    atualizarVisibilidadeControlesMobile();
    atualizarIndicadorCategorias();
  });
}

window.addEventListener(
  "resize",
  agendarAtualizacoesDeResizeCatalogo,
  { passive: true }
);

if (window.visualViewport) {
  window.visualViewport.addEventListener(
    "resize",
    agendarAtualizacoesDeResizeCatalogo,
    { passive: true }
  );
}

let catalogoInicializado = false;

function inicializarCatalogo() {
  if (catalogoInicializado) return;
  catalogoInicializado = true;

  const params = new URLSearchParams(window.location.search);
  const fabricasValidas = ["tendenze", "zarrara", "inove"];
  const fabricaParametro = String(params.get("fabrica") || "").toLowerCase();
  const fabricaDataset = String(document.documentElement.dataset.fabrica || "").toLowerCase();
  const fabrica = fabricasValidas.includes(fabricaParametro)
    ? fabricaParametro
    : (fabricasValidas.includes(fabricaDataset) ? fabricaDataset : "tendenze");
  const categoria = params.get("categoria");

  fabricaAtual = fabrica;

  if (categoria) {
    categoriaAtual = categoria;
  }

  const titulo = document.getElementById("titulo");
  if (titulo) {
    titulo.innerText = "HBJOIAS";
  }

  const heroSubtitulo = document.getElementById("hero-subtitulo");
  if (heroSubtitulo && fabricaAtual) {
    heroSubtitulo.innerText = `Representações • catálogo ${nomeFabrica(fabricaAtual)}`;
  }

  const fabricaAtualEl = document.getElementById("fabrica-atual");
  if (fabricaAtualEl && fabricaAtual) {
    fabricaAtualEl.innerText = `Catálogo ${nomeFabrica(fabricaAtual)}`;
  }

  carregarCarrinho();
  prepararIndicesProdutos();

  if (!categoriaExisteNaFabrica(categoriaAtual)) {
    categoriaAtual = "todos";
  }

  renderizarCategorias();
  carregarProdutos();
  renderizarCarrinho();
  atualizarBotaoCarrinhoLateral();
  iniciarIndicadorCategorias();

  const codigoSalvoParaRevalidar = codigoComercialAplicado?.revalidar
    ? codigoComercialAplicado.codigo
    : "";
  if (codigoSalvoParaRevalidar) {
    aplicarCodigoComercialPorCodigo(codigoSalvoParaRevalidar);
  }
}

executarQuandoDOMPronto(inicializarCatalogo);

function gerarMensagemWhatsApp() {
  if (!carrinho.length) {
    alert("Seu carrinho está vazio.");
    return "";
  }

  let mensagem = "*NOVO PEDIDO - CATÁLOGO ONLINE*\n\n";

  let totalPedido = 0;
  const detalhesCliente = [];

  carrinho.forEach(item => {
    const valorUnitario = valorUnitarioProduto(item);
    const valorTotal = valorItem(item);

    totalPedido += valorTotal;

    mensagem += "-----------------------------\n";
    mensagem += `REF: ${item.referencia}\n`;
    mensagem += `PESO: ${item.peso || "-"}\n`;
    mensagem += `DESCRICAO: ${item.descricao || "-"}\n`;
    mensagem += `CATEGORIA: ${item.categoria || "-"}
`;

    if (textoObservacaoItem(item)) {
      detalhesCliente.push(`Ref. ${item.referencia} — ${textoObservacaoItem(item)}`);
    }
    mensagem += `VALOR ESTIMADO: R$ ${formatarMoeda(valorUnitario)}\n`;

    if (item.numeracoes) {
      mensagem += "NUMERACOES:\n";

      Object.entries(item.numeracoes).forEach(([aro, qtd]) => {
        if (qtd > 0) {
          mensagem += `- Aro ${aro}: ${qtd} un.\n`;
        }
      });
    } else {
      mensagem += `QUANTIDADE: ${item.quantidade} un.\n`;
    }

    mensagem += `SUBTOTAL: R$ ${formatarMoeda(valorTotal)}\n\n`;
  });

  mensagem += "-----------------------------\n";
  mensagem += `TOTAL ESTIMADO: R$ ${formatarMoeda(totalPedido)}\n`;
  mensagem += `ITENS: ${carrinho.length}\n`;

  if (codigoComercialAplicado?.valido) {
    mensagem += `CÓDIGO COMERCIAL: ${codigoComercialAplicado.codigo}\n`;
    mensagem += `MÍNIMO LIBERADO PELO CÓDIGO: R$ ${formatarMoeda(codigoComercialAplicado.valorMinimo || 10000)}\n`;
  }

  return mensagem;
}


// ===============================
// ENVIO DO PEDIDO PARA PLANILHA
// ===============================
const URL_APPS_SCRIPT_PEDIDO = "https://script.google.com/macros/s/AKfycbypNx48BWBjK5XEGCkW4VGNeA6W2AHncHsSxLCFhrS6ijQDpn3vivZk87KIHKAFkJIy5A/exec";
const EMAILS_DESTINO_PEDIDO = ["traxate@gmail.com", "hbjoiasrepresentacoes@gmail.com"];

function pedidoPodeSerEnviado() {
  if (carrinho.length === 0) {
    alert("Seu carrinho está vazio.");
    return false;
  }

  const fabricasValidas = new Set(["tendenze", "zarrara", "inove"]);
  const fabricasDoPedido = new Set(
    carrinho.map(item => String(item?.fabrica || "").trim().toLowerCase())
  );

  if (fabricasDoPedido.size !== 1 || !fabricasValidas.has([...fabricasDoPedido][0])) {
    alert("O pedido precisa conter produtos de uma única fábrica válida.");
    return false;
  }

  for (const item of carrinho) {
    const quantidade = totalPecasItem(item);
    const minimoReferencia = minimoPorFabrica(item.fabrica);

    if (!Number.isInteger(quantidade) || quantidade < minimoReferencia) {
      alert(`A referência ${item.referencia || "-"} precisa ter pelo menos ${minimoReferencia} peças inteiras.`);
      return false;
    }
  }

  const resumo = resumoPorFabrica();

  for (const fabrica of Object.keys(resumo)) {
    const minimoValor = valorMinimoFabrica(fabrica);

    if (resumo[fabrica].valor < minimoValor) {
      alert(`${nomeFabrica(fabrica)} ainda não atingiu o mínimo de R$ ${formatarMoeda(minimoValor)}.`);
      return false;
    }
  }

  return true;
}

function abrirResumoPedido() {
  if (!pedidoPodeSerEnviado()) return;

  const modal = document.getElementById("modal-resumo");
  const lista = document.getElementById("resumo-pedido-itens");
  const totalEl = document.getElementById("resumo-total-valor");
  const subtotalEl = document.getElementById("resumo-subtotal-valor");
  const descontoLinha = document.getElementById("resumo-desconto-linha");
  const descontoLabel = document.getElementById("resumo-desconto-label");
  const descontoEl = document.getElementById("resumo-desconto-valor");
  const contagemEl = document.getElementById("resumo-contagem-itens");
  const observacoesEl = document.getElementById("resumo-observacoes-cliente");
  const status = document.getElementById("status-envio-pedido");
  const botao = document.getElementById("botao-confirmar-pedido");

  if (!modal || !lista || !totalEl) return;

  lista.innerHTML = "";

  if (observacoesEl) {
    observacoesEl.innerHTML = "";
    observacoesEl.classList.add("escondido");
  }

  if (status) {
    status.innerText = "";
    status.className = "status-envio-pedido";
  }

  if (botao) {
    botao.disabled = false;
    botao.innerText = "Continuar para os dados";
  }

  let totalPedido = 0;
  const htmlItensResumo = carrinho.map((item, indice) => {
    const subtotal = valorItem(item);
    const quantidade = totalPecasItem(item);
    totalPedido += subtotal;

    return `
      <article class="item-resumo item-resumo-limpo">
        <span class="item-resumo-indice" aria-hidden="true">${indice + 1}</span>
        <div class="item-resumo-conteudo">
          <div class="item-resumo-topo">
            <h3>Ref. ${escaparHtml(item.referencia || "-")}</h3>
            <strong>R$ ${formatarMoeda(subtotal)}</strong>
          </div>
          <p class="item-resumo-descricao">${escaparHtml(item.descricao || "Produto sem descrição")}</p>
          <div class="item-resumo-meta">
            <span>${quantidade} peça${quantidade === 1 ? "" : "s"}</span>
            <span>${formatarPeso(pesoItem(item))}</span>
          </div>
        </div>
      </article>
    `;
  }).join("");

  lista.innerHTML = htmlItensResumo;

  if (contagemEl) {
    contagemEl.innerText = `${carrinho.length} referência${carrinho.length === 1 ? "" : "s"}`;
  }

  if (observacoesEl) {
    const htmlObservacoes = blocoObservacoesPedidoHtml();
    if (htmlObservacoes) {
      observacoesEl.innerHTML = htmlObservacoes;
      observacoesEl.classList.remove("escondido");
    }
  }

  const totaisResumo = resumoTotaisPedido(totalPedido, fabricaDoCarrinho());
  const badgeResumo = badgeDescontoPedido(totaisResumo);

  if (subtotalEl) {
    subtotalEl.innerText = `R$ ${formatarMoeda(totaisResumo.subtotal)}`;
  }

  if (descontoLinha && descontoEl && descontoLabel) {
    descontoLinha.classList.toggle("escondido", !totaisResumo.temDesconto);
    descontoLabel.innerText = totaisResumo.temDesconto
      ? labelDescontoPedido(totaisResumo)
      : "Desconto";
    descontoEl.innerText = `-R$ ${formatarMoeda(totaisResumo.valorDesconto)}`;
  }

  totalEl.innerHTML = totaisResumo.temDesconto
    ? `<span class="resumo-total-final">R$ ${formatarMoeda(totaisResumo.totalFinal)} ${badgeResumo}</span>`
    : `R$ ${formatarMoeda(totaisResumo.totalFinal)}`;

  registrarOrigemFocoModal(modal);
  modal.classList.remove("escondido");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-aberto");
  gerenciadorOverlay.abrir("resumo-pedido");
  focarModalAcessivel(modal, modal.querySelector(".fechar-resumo"));
}

function fecharResumoPedido() {
  const modal = document.getElementById("modal-resumo");
  if (!modal) return;

  modal.classList.add("escondido");
  modal.setAttribute("aria-hidden", "true");
  gerenciadorOverlay.fechar("resumo-pedido");
  restaurarFocoModal(modal);

  const modalDados = document.getElementById("modal-dados-cliente");
  if (!modalDados || modalDados.classList.contains("escondido")) {
    document.body.classList.remove("modal-aberto");
  }
}

function montarPedidoParaEnvio() {
  return carrinho.map(item => {
    const valorUnitario = valorUnitarioProduto(item);
    const totalPecas = totalPecasItem(item);
    const itemEhAnel = ehCategoriaAnel(item.categoria);

    return {
      fabrica: nomeFabrica(item.fabrica),
      fabricaChave: item.fabrica,
      categoria: item.categoria || "",
      referencia: item.referencia,
      descricao: item.descricao || "",
      observacao: textoObservacaoItem(item),
      observacaoCliente: textoObservacaoItem(item),
      detalheCliente: textoObservacaoItem(item),
      descricaoCliente: textoObservacaoItem(item),
      descricaoDigitadaCliente: textoObservacaoItem(item),
      peso: item.peso || "",
      quantidade: itemEhAnel ? undefined : Number(item.quantidade || 0),
      numeracoes: itemEhAnel ? { ...(item.numeracoes || {}) } : undefined,
      totalPecas,
      valorUnitario,
      subtotal: valorUnitario * totalPecas
    };
  });
}

function montarTextoDadosClienteEmail(dadosCliente) {
  if (!dadosCliente) return "";

  return [
    "DADOS DO CLIENTE",
    "",
    `Loja/Cliente: ${dadosCliente.nome || "-"}`,
    `CNPJ: ${dadosCliente.cnpj || "-"}`,
    `Telefone: ${dadosCliente.contato || "-"}`,
    "",
    "ENDEREÇO DE ENTREGA",
    "",
    `CEP: ${dadosCliente.cep || "-"}`,
    `Rua/Avenida: ${dadosCliente.rua || "-"}`,
    `Número: ${dadosCliente.numero || "-"}`,
    `Bairro: ${dadosCliente.bairro || "-"}`,
    `Cidade: ${dadosCliente.cidade || "-"}`,
    `UF: ${dadosCliente.estado || "-"}`,
    `Complemento/Referência: ${dadosCliente.complemento || "-"}`,
    "",
    `Endereço completo: ${dadosCliente.localEntrega || "-"}`
  ].join("\n");
}

function montarDadosClienteParaPayload(dadosCliente) {
  const texto = montarTextoDadosClienteEmail(dadosCliente);

  return {
    texto,
    nome: dadosCliente?.nome || "",
    loja: dadosCliente?.nome || "",
    cnpj: dadosCliente?.cnpj || "",
    telefone: dadosCliente?.contato || "",
    contato: dadosCliente?.contato || "",
    cep: dadosCliente?.cep || "",
    rua: dadosCliente?.rua || "",
    numero: dadosCliente?.numero || "",
    bairro: dadosCliente?.bairro || "",
    cidade: dadosCliente?.cidade || "",
    estado: dadosCliente?.estado || "",
    uf: dadosCliente?.estado || "",
    complemento: dadosCliente?.complemento || "",
    enderecoCompleto: dadosCliente?.localEntrega || "",
    enderecoEntrega: dadosCliente?.localEntrega || ""
  };
}

function montarTextoDetalhesClienteEmail() {
  const itensComObservacao = carrinho.filter(item => textoObservacaoItem(item));

  if (!itensComObservacao.length) return "";

  return [
    "DETALHES INFORMADOS PELO CLIENTE",
    "",
    ...itensComObservacao.map(item => `Ref. ${item.referencia} — ${textoObservacaoItem(item)}`)
  ].join("\n");
}

function montarTextoItensPedidoEmail() {
  const linhas = ["ITENS DO PEDIDO", ""];

  carrinho.forEach(item => {
    linhas.push("--------------------------------");
    linhas.push(`Ref.: ${item.referencia}`);
    linhas.push(`Descrição: ${item.descricao || "-"}`);
    linhas.push(`Categoria: ${item.categoria || "-"}`);
    linhas.push(`Peso un.: ${item.peso || "-"}`);
    linhas.push(`Valor un. estimado: R$ ${formatarMoeda(valorUnitarioProduto(item))}`);

    if (item.numeracoes) {
      linhas.push("Numerações:");
      Object.entries(item.numeracoes).forEach(([aro, qtd]) => {
        if (Number(qtd || 0) > 0) {
          linhas.push(`- Aro ${aro}: ${qtd} un.`);
        }
      });
    } else {
      linhas.push(`Quantidade: ${item.quantidade || 0} un.`);
    }

    if (textoObservacaoItem(item)) {
      linhas.push(`Detalhe do cliente: ${textoObservacaoItem(item)}`);
    }

    linhas.push(`Subtotal: R$ ${formatarMoeda(valorItem(item))}`);
  });

  return linhas.join("\n");
}

// ===============================
// BACKUP LOCAL, CSV E WHATSAPP
// ===============================
// WhatsApp no aparelho do cliente fica DESATIVADO por padrão.
// Envio automático real para seu WhatsApp deve ser feito no servidor via WhatsApp Cloud API/provedor, não redirecionando o cliente.
// Se algum dia quiser reativar abertura no cliente, coloque ABRIR_WHATSAPP_CLIENTE_AUTOMATICAMENTE = true.
const WHATSAPP_DESTINO_PEDIDO = "5511952500230";
const ABRIR_WHATSAPP_CLIENTE_AUTOMATICAMENTE = false;
const BACKUP_PEDIDOS_LOCAL_KEY = "pedidosCatalogoBackupV2";
const ULTIMO_PEDIDO_LOCAL_KEY = "ultimoPedidoCatalogoBackupV2";
const LIMITE_PEDIDOS_BACKUP_LOCAL = 25;
const DIAS_RETENCAO_BACKUP_LOCAL = 7;
const RETENCAO_BACKUP_LOCAL_MS = DIAS_RETENCAO_BACKUP_LOCAL * 24 * 60 * 60 * 1000;
const LIMITE_TEXTO_WHATSAPP_PEDIDO = 6500;

function textoSeguro(valor) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function valorDecimalSeguro(valor) {
  const numero = Number(valor || 0);
  return Number.isFinite(numero) ? numero : 0;
}

function moedaCsv(valor) {
  return valorDecimalSeguro(valor).toFixed(2).replace(".", ",");
}

function campoCsv(valor) {
  const texto = String(valor ?? "").replace(/\r?\n/g, " ").trim();
  return `"${texto.replace(/"/g, '""')}"`;
}

function linhaCsv(campos) {
  return campos.map(campoCsv).join(";");
}

function nomeArquivoSeguro(texto) {
  return String(texto || "pedido")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pedido";
}

function textoNumeracoesConsolidado(numeracoes) {
  const entradas = Object.entries(numeracoes || {})
    .map(([aro, qtd]) => [aro, Number(qtd || 0)])
    .filter(([, qtd]) => qtd > 0)
    .sort((a, b) => Number(a[0]) - Number(b[0]));

  if (!entradas.length) return "-";
  return entradas.map(([aro, qtd]) => `Aro ${aro}: ${qtd}`).join(" | ");
}

function consolidarItensPayload(payload) {
  const mapa = new Map();
  const pedido = Array.isArray(payload?.pedido) ? payload.pedido : [];

  pedido.forEach(item => {
    if (!item) return;

    const fabrica = textoSeguro(item.fabrica || item.fabricaChave || payload.fabrica || "");
    const referencia = textoSeguro(item.referencia || "");
    const descricao = textoSeguro(item.descricao || "");
    const peso = textoSeguro(item.peso || "");
    const chave = [fabrica, referencia, descricao, peso].join("::");

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        fabrica,
        referencia,
        descricao,
        peso,
        numeracoes: {},
        quantidadeTotal: 0,
        valorUnitario: valorDecimalSeguro(item.valorUnitario),
        observacoes: []
      });
    }

    const atual = mapa.get(chave);
    const observacao = textoSeguro(
      item.observacaoCliente ||
      item.detalheCliente ||
      item.descricaoCliente ||
      item.descricaoDigitadaCliente ||
      item.observacao ||
      item.obs ||
      ""
    );

    if (observacao && !atual.observacoes.includes(observacao)) {
      atual.observacoes.push(observacao);
    }

    const numeracoes = item.numeracoes && typeof item.numeracoes === "object" ? item.numeracoes : null;

    if (numeracoes && Object.keys(numeracoes).length) {
      Object.entries(numeracoes).forEach(([aro, qtd]) => {
        const quantidade = Number(qtd || 0);
        if (quantidade <= 0) return;

        atual.numeracoes[aro] = Number(atual.numeracoes[aro] || 0) + quantidade;
        atual.quantidadeTotal += quantidade;
      });
      return;
    }

    const quantidade = Number(item.quantidade || item.totalPecas || 0);
    if (quantidade > 0) {
      atual.quantidadeTotal += quantidade;
    }
  });

  return Array.from(mapa.values())
    .filter(item => item.quantidadeTotal > 0)
    .map(item => ({
      ...item,
      numeracoesTexto: textoNumeracoesConsolidado(item.numeracoes),
      subtotal: item.valorUnitario * item.quantidadeTotal,
      observacao: item.observacoes.join(" | ")
    }));
}

function montarCsvPedido(payload) {
  const dadosCliente = payload?.dadosCliente || {};
  const itens = consolidarItensPayload(payload);
  const linhas = [];

  linhas.push(linhaCsv(["PEDIDO HBJOIAS"]));
  linhas.push(linhaCsv(["Número do Pedido", payload?.numeroPedido || ""]));
  linhas.push(linhaCsv(["Data", new Date(payload?.dataPedido || Date.now()).toLocaleString("pt-BR")]));
  linhas.push(linhaCsv(["Fábrica", payload?.fabrica || ""]));
  linhas.push(linhaCsv(["Origem", payload?.origem || "catalogo-online"]));

  if (payload?.codigoComercial) {
    linhas.push(linhaCsv(["Código comercial", payload.codigoComercial.codigo || ""]));
    linhas.push(linhaCsv(["Tipo do código", payload.codigoComercial.tipo || ""]));
    linhas.push(linhaCsv(["Cliente do código", payload.codigoComercial.cliente || payload.codigoComercial.loja || ""]));
    linhas.push(linhaCsv(["Mínimo liberado", moedaCsv(payload.codigoComercial.valorMinimo || 0)]));
    linhas.push(linhaCsv(["Desconto do código", String(payload.codigoComercial.descontoPercentual || 0) + "%"]));
  }

  linhas.push(linhaCsv([]));

  linhas.push(linhaCsv(["DADOS DO CLIENTE"]));
  linhas.push(linhaCsv(["Nome/Loja", dadosCliente.nome || dadosCliente.loja || ""]));
  linhas.push(linhaCsv(["CNPJ", dadosCliente.cnpj || ""]));
  linhas.push(linhaCsv(["Telefone", dadosCliente.telefone || dadosCliente.contato || ""]));
  linhas.push(linhaCsv(["CEP", dadosCliente.cep || ""]));
  linhas.push(linhaCsv(["Rua", dadosCliente.rua || ""]));
  linhas.push(linhaCsv(["Número", dadosCliente.numero || ""]));
  linhas.push(linhaCsv(["Bairro", dadosCliente.bairro || ""]));
  linhas.push(linhaCsv(["Cidade", dadosCliente.cidade || ""]));
  linhas.push(linhaCsv(["UF", dadosCliente.estado || dadosCliente.uf || ""]));
  linhas.push(linhaCsv(["Complemento/Referência", dadosCliente.complemento || ""]));
  linhas.push(linhaCsv(["Endereço completo", dadosCliente.enderecoCompleto || dadosCliente.enderecoEntrega || ""]));
  linhas.push(linhaCsv([]));

  linhas.push(linhaCsv([
    "Número do Pedido",
    "Data",
    "Fábrica",
    "Referência",
    "Descrição",
    "Peso",
    "Numerações",
    "Quantidade Total",
    "Valor Unitário",
    "Subtotal",
    "Observação do Cliente"
  ]));

  itens.forEach(item => {
    linhas.push(linhaCsv([
      payload?.numeroPedido || "",
      new Date(payload?.dataPedido || Date.now()).toLocaleString("pt-BR"),
      item.fabrica,
      item.referencia,
      item.descricao,
      item.peso,
      item.numeracoesTexto,
      item.quantidadeTotal,
      moedaCsv(item.valorUnitario),
      moedaCsv(item.subtotal),
      item.observacao
    ]));
  });

  linhas.push(linhaCsv([]));
  linhas.push(linhaCsv(["RESUMO"]));
  linhas.push(linhaCsv(["Total de referências", itens.length]));
  linhas.push(linhaCsv(["Total de peças", payload?.totalPecas || itens.reduce((soma, item) => soma + item.quantidadeTotal, 0)]));
  linhas.push(linhaCsv(["Subtotal estimado", moedaCsv(payload?.subtotalEstimado || itens.reduce((soma, item) => soma + item.subtotal, 0))]));
  linhas.push(linhaCsv(["Desconto", moedaCsv(payload?.valorDesconto || 0)]));
  linhas.push(linhaCsv(["Total estimado", moedaCsv(payload?.totalEstimado || 0)]));

  // BOM UTF-8 para abrir corretamente no Excel em PT-BR.
  return "\ufeff" + linhas.join("\r\n");
}

function baixarArquivoTexto(nomeArquivo, conteudo, mimeType) {
  const blob = new Blob([conteudo], { type: mimeType || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivo;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
}

function baixarCsvPedido(payload) {
  const numeroPedido = nomeArquivoSeguro(payload?.numeroPedido || gerarNumeroPedido());
  const csv = montarCsvPedido(payload);
  baixarArquivoTexto(`Pedido ${numeroPedido}.csv`, csv, "text/csv;charset=utf-8");
}

function salvarBackupLocalPedido(payload, status, erro) {
  try {
    const agora = Date.now();
    const registro = {
      numeroPedido: payload?.numeroPedido || "",
      status: status || "GERADO_LOCALMENTE",
      erro: erro || "",
      salvoEm: new Date(agora).toISOString(),
      expiraEm: new Date(agora + RETENCAO_BACKUP_LOCAL_MS).toISOString(),
      payload
    };

    localStorage.setItem(ULTIMO_PEDIDO_LOCAL_KEY, JSON.stringify(registro));

    const listaAtual = JSON.parse(localStorage.getItem(BACKUP_PEDIDOS_LOCAL_KEY) || "[]");
    const listaFiltrada = Array.isArray(listaAtual)
      ? listaAtual.filter(item =>
          registroBackupLocalAindaValido(item, agora) &&
          item.numeroPedido !== registro.numeroPedido
        )
      : [];

    listaFiltrada.unshift(registro);
    localStorage.setItem(BACKUP_PEDIDOS_LOCAL_KEY, JSON.stringify(listaFiltrada.slice(0, LIMITE_PEDIDOS_BACKUP_LOCAL)));
  } catch (erroLocalStorage) {
    console.warn("Não foi possível salvar backup local do pedido:", erroLocalStorage);
  }
}

function registroBackupLocalAindaValido(registro, agora = Date.now()) {
  if (!registro || !registro.numeroPedido) return false;

  const expiraEm = Date.parse(registro.expiraEm || "");
  if (Number.isFinite(expiraEm)) return expiraEm > agora;

  const salvoEm = Date.parse(registro.salvoEm || "");
  return Number.isFinite(salvoEm) && salvoEm + RETENCAO_BACKUP_LOCAL_MS > agora;
}

function limparBackupsLocaisExpirados() {
  try {
    const agora = Date.now();
    const listaAtual = JSON.parse(localStorage.getItem(BACKUP_PEDIDOS_LOCAL_KEY) || "[]");
    const listaValida = Array.isArray(listaAtual)
      ? listaAtual.filter(item => registroBackupLocalAindaValido(item, agora))
      : [];

    if (listaValida.length) {
      localStorage.setItem(BACKUP_PEDIDOS_LOCAL_KEY, JSON.stringify(listaValida));
    } else {
      localStorage.removeItem(BACKUP_PEDIDOS_LOCAL_KEY);
    }

    const ultimo = JSON.parse(localStorage.getItem(ULTIMO_PEDIDO_LOCAL_KEY) || "null");
    if (!registroBackupLocalAindaValido(ultimo, agora)) {
      localStorage.removeItem(ULTIMO_PEDIDO_LOCAL_KEY);
    }
  } catch (erroLocalStorage) {
    console.warn("Não foi possível limpar backups locais expirados:", erroLocalStorage);
  }
}

executarQuandoDOMPronto(limparBackupsLocaisExpirados);

function atualizarBackupLocalPedido(numeroPedido, status, erro) {
  try {
    const listaAtual = JSON.parse(localStorage.getItem(BACKUP_PEDIDOS_LOCAL_KEY) || "[]");
    if (!Array.isArray(listaAtual)) return;

    const atualizada = listaAtual.map(item => {
      if (!item || item.numeroPedido !== numeroPedido) return item;
      return {
        ...item,
        status: status || item.status,
        erro: erro || item.erro || "",
        atualizadoEm: new Date().toISOString()
      };
    });

    localStorage.setItem(BACKUP_PEDIDOS_LOCAL_KEY, JSON.stringify(atualizada));

    const ultimo = atualizada.find(item => item && item.numeroPedido === numeroPedido);
    if (ultimo) localStorage.setItem(ULTIMO_PEDIDO_LOCAL_KEY, JSON.stringify(ultimo));
  } catch (erroLocalStorage) {
    console.warn("Não foi possível atualizar backup local do pedido:", erroLocalStorage);
  }
}

function montarTextoWhatsAppPedido(payload) {
  const dadosCliente = payload?.dadosCliente || {};
  const itens = consolidarItensPayload(payload);
  const linhas = [];

  linhas.push("*NOVO PEDIDO HBJOIAS - CRU*");
  linhas.push(`Número: ${payload?.numeroPedido || "-"}`);
  linhas.push(`Data: ${new Date(payload?.dataPedido || Date.now()).toLocaleString("pt-BR")}`);
  linhas.push(`Fábrica: ${payload?.fabrica || "-"}`);
  linhas.push("");
  linhas.push("*CLIENTE*");
  linhas.push(`Nome/Loja: ${dadosCliente.nome || dadosCliente.loja || "-"}`);
  linhas.push(`CNPJ: ${dadosCliente.cnpj || "-"}`);
  linhas.push(`Telefone: ${dadosCliente.telefone || dadosCliente.contato || "-"}`);
  linhas.push(`Endereço: ${dadosCliente.enderecoCompleto || dadosCliente.enderecoEntrega || "-"}`);
  linhas.push("");
  linhas.push("*ITENS CONSOLIDADOS*");

  itens.forEach(item => {
    linhas.push(`Ref. ${item.referencia}`);
    linhas.push(`Descrição: ${item.descricao || "-"}`);
    linhas.push(`Peso: ${item.peso || "-"}`);
    linhas.push(`Numerações: ${item.numeracoesTexto || "-"}`);
    linhas.push(`Quantidade total: ${item.quantidadeTotal}`);
    linhas.push(`Valor un.: R$ ${formatarMoeda(item.valorUnitario)}`);
    linhas.push(`Subtotal: R$ ${formatarMoeda(item.subtotal)}`);
    if (item.observacao) linhas.push(`Obs.: ${item.observacao}`);
    linhas.push("---");
  });

  linhas.push("");
  linhas.push("*RESUMO*");
  linhas.push(`Total de referências: ${itens.length}`);
  linhas.push(`Total de peças: ${payload?.totalPecas || itens.reduce((soma, item) => soma + item.quantidadeTotal, 0)}`);
  linhas.push(`Subtotal: R$ ${formatarMoeda(payload?.subtotalEstimado || 0)}`);
  linhas.push(`Desconto: R$ ${formatarMoeda(payload?.valorDesconto || 0)}`);
  linhas.push(`Total estimado: R$ ${formatarMoeda(payload?.totalEstimado || 0)}`);
  linhas.push("");
  linhas.push("CSV do pedido foi baixado automaticamente no dispositivo do cliente.");

  let texto = linhas.join("\n");

  if (texto.length > LIMITE_TEXTO_WHATSAPP_PEDIDO) {
    texto = texto.slice(0, LIMITE_TEXTO_WHATSAPP_PEDIDO) +
      "\n\n[Pedido grande: texto truncado para caber no WhatsApp. Usar o CSV baixado automaticamente.]";
  }

  return texto;
}

function abrirWhatsAppPedido(payload) {
  const texto = montarTextoWhatsAppPedido(payload);
  const numero = String(WHATSAPP_DESTINO_PEDIDO || "").replace(/\D/g, "");
  const url = numero
    ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`;

  const janela = window.open(url, "_blank", "noopener,noreferrer");
  return Boolean(janela);
}

function gerarSaidasLocaisDeSeguranca(payload) {
  salvarBackupLocalPedido(payload, "GERADO_LOCALMENTE", "");

  try {
    baixarCsvPedido(payload);
  } catch (erroCsv) {
    salvarBackupLocalPedido(payload, "ERRO_DOWNLOAD_CSV", String(erroCsv));
    console.error("Erro ao baixar CSV do pedido:", erroCsv);
  }

  if (ABRIR_WHATSAPP_CLIENTE_AUTOMATICAMENTE) {
    try {
      abrirWhatsAppPedido(payload);
    } catch (erroWhatsApp) {
      atualizarBackupLocalPedido(payload?.numeroPedido || "", "ERRO_WHATSAPP", String(erroWhatsApp));
      console.error("Erro ao abrir WhatsApp do pedido:", erroWhatsApp);
    }
  }
}

function limparErroCampoCliente() {
  document.querySelectorAll(".campo-cliente.erro").forEach(campo => campo.classList.remove("erro"));
}

function somenteNumeros(texto) {
  return String(texto || "").replace(/\D/g, "");
}

const UFS_BRASIL_VALIDAS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO"
]);

function normalizarCnpj(valor) {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 14);
}

function formatarCnpj(valor) {
  const cnpj = normalizarCnpj(valor);
  const partes = [];
  if (cnpj.slice(0, 2)) partes.push(cnpj.slice(0, 2));
  let texto = partes.join("");
  if (cnpj.length > 2) texto += "." + cnpj.slice(2, 5);
  if (cnpj.length > 5) texto += "." + cnpj.slice(5, 8);
  if (cnpj.length > 8) texto += "/" + cnpj.slice(8, 12);
  if (cnpj.length > 12) texto += "-" + cnpj.slice(12, 14);
  return texto;
}

function digitoCnpjNumerico(base, pesos) {
  const soma = base.split("").reduce(
    (total, digito, indice) => total + Number(digito) * pesos[indice],
    0
  );
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cnpjNumericoValido(cnpj) {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const base12 = cnpj.slice(0, 12);
  const dv1 = digitoCnpjNumerico(base12, [5,4,3,2,9,8,7,6,5,4,3,2]);
  const dv2 = digitoCnpjNumerico(base12 + dv1, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return cnpj === base12 + String(dv1) + String(dv2);
}

function cnpjClienteValido(valor) {
  const cnpj = normalizarCnpj(valor);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj)) return false;
  // CNPJs numéricos continuam com validação completa dos dígitos.
  // O novo formato alfanumérico mantém 14 posições e os dois DVs numéricos.
  return /^\d{14}$/.test(cnpj) ? cnpjNumericoValido(cnpj) : true;
}

function telefoneClienteValido(valor) {
  const numeros = somenteNumeros(valor);
  return numeros.length >= 10 && numeros.length <= 13;
}

function cepClienteValido(valor) {
  return somenteNumeros(valor).length === 8;
}

function ufClienteValida(valor) {
  return UFS_BRASIL_VALIDAS.has(String(valor || "").trim().toUpperCase());
}

function marcarCampoClienteInvalido(campo, invalido) {
  if (!campo) return;
  campo.classList.toggle("erro", Boolean(invalido));
  campo.setAttribute("aria-invalid", invalido ? "true" : "false");
}

function formatarCep(valor) {
  const cep = somenteNumeros(valor).slice(0, 8);
  if (cep.length > 5) return `${cep.slice(0, 5)}-${cep.slice(5)}`;
  return cep;
}

function montarLabelCampoCliente(classe, texto, htmlCampo) {
  return `
    <label class="${classe}">
      <span>${texto}</span>
      ${htmlCampo}
    </label>
  `;
}

function inicializarEnderecoClientePedido() {
  const form = document.querySelector(".form-dados-cliente");
  if (!form) return;

  // Compatibilidade com versões anteriores: cria os campos apenas quando o
  // HTML antigo ainda estiver sendo usado. No P08.3-C eles já vêm estruturados.
  if (!document.getElementById("cliente-cep")) {
    const campoEntrega = document.querySelector(".campo-entrega");
    const textareaEntrega = document.getElementById("cliente-local-entrega");

    if (campoEntrega) {
      const tituloEntrega = campoEntrega.querySelector("span");
      if (tituloEntrega) tituloEntrega.innerText = "Complemento ou referência";
    }

    if (textareaEntrega) {
      textareaEntrega.placeholder = "Apartamento, sala, ponto de referência ou observação de entrega";
      textareaEntrega.classList.remove("campo-cliente");
    }

    const blocoEndereco = document.createElement("div");
    blocoEndereco.className = "campos-endereco-cliente";
    blocoEndereco.innerHTML = `
      ${montarLabelCampoCliente("campo-cep-cliente", "CEP", '<input type="text" id="cliente-cep" class="campo-cliente" placeholder="00000-000" inputmode="numeric" maxlength="9" autocomplete="postal-code">')}
      ${montarLabelCampoCliente("campo-rua-cliente campo-largo", "Rua / Avenida", '<input type="text" id="cliente-rua" class="campo-cliente" placeholder="Rua, avenida ou travessa" autocomplete="address-line1">')}
      ${montarLabelCampoCliente("campo-numero-cliente", "Número", '<input type="text" id="cliente-numero" class="campo-cliente" placeholder="Nº" autocomplete="address-line2">')}
      ${montarLabelCampoCliente("campo-bairro-cliente", "Bairro", '<input type="text" id="cliente-bairro" class="campo-cliente" placeholder="Bairro">')}
      ${montarLabelCampoCliente("campo-cidade-cliente", "Cidade", '<input type="text" id="cliente-cidade" class="campo-cliente" placeholder="Cidade" autocomplete="address-level2">')}
      ${montarLabelCampoCliente("campo-estado-cliente", "UF", '<input type="text" id="cliente-estado" class="campo-cliente" placeholder="UF" maxlength="2" autocomplete="address-level1">')}
    `;

    if (campoEntrega) form.insertBefore(blocoEndereco, campoEntrega);
    else form.appendChild(blocoEndereco);
  }

  const todosCampos = form.querySelectorAll("input, textarea");
  todosCampos.forEach(campo => {
    if (campo.dataset.validacaoP083c === "ativa") return;
    campo.dataset.validacaoP083c = "ativa";
    campo.addEventListener("input", () => marcarCampoClienteInvalido(campo, false));
  });

  const cnpjInput = document.getElementById("cliente-cnpj");
  if (cnpjInput && cnpjInput.dataset.formatacaoP083c !== "ativa") {
    cnpjInput.dataset.formatacaoP083c = "ativa";
    cnpjInput.addEventListener("input", () => {
      cnpjInput.value = formatarCnpj(cnpjInput.value);
    });
  }

  const cepInput = document.getElementById("cliente-cep");
  if (cepInput && cepInput.dataset.formatacaoP083c !== "ativa") {
    cepInput.dataset.formatacaoP083c = "ativa";
    cepInput.addEventListener("input", () => {
      cepInput.value = formatarCep(cepInput.value);
    });
    cepInput.addEventListener("blur", buscarEnderecoClientePorCep);
  }

  const estadoInput = document.getElementById("cliente-estado");
  if (estadoInput && estadoInput.dataset.formatacaoP083c !== "ativa") {
    estadoInput.dataset.formatacaoP083c = "ativa";
    estadoInput.addEventListener("input", () => {
      estadoInput.value = String(estadoInput.value || "")
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 2);
    });
  }
}

async function buscarEnderecoClientePorCep() {
  const cepInput = document.getElementById("cliente-cep");
  const status = document.getElementById("status-dados-cliente");
  const cep = somenteNumeros(cepInput?.value);

  if (!cepInput || cep.length !== 8) return;

  cepInput.classList.remove("erro");

  if (status) {
    status.innerText = "Buscando endereço pelo CEP...";
    status.className = "status-envio-pedido carregando";
  }

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const dados = await resposta.json();

    if (!resposta.ok || dados.erro) {
      cepInput.classList.add("erro");
      if (status) {
        status.innerText = "CEP não encontrado. Preencha o endereço manualmente.";
        status.className = "status-envio-pedido erro";
      }
      return;
    }

    const rua = document.getElementById("cliente-rua");
    const bairro = document.getElementById("cliente-bairro");
    const cidade = document.getElementById("cliente-cidade");
    const estado = document.getElementById("cliente-estado");
    const numero = document.getElementById("cliente-numero");

    if (rua) rua.value = dados.logradouro || "";
    if (bairro) bairro.value = dados.bairro || "";
    if (cidade) cidade.value = dados.localidade || "";
    if (estado) estado.value = dados.uf || "";

    [rua, bairro, cidade, estado].forEach(campo => campo?.classList.remove("erro"));

    if (status) {
      status.innerText = "";
      status.className = "status-envio-pedido";
    }

    if (numero) numero.focus();
  } catch (erro) {
    if (status) {
      status.innerText = "Não foi possível buscar o CEP agora. Preencha o endereço manualmente.";
      status.className = "status-envio-pedido erro";
    }
  }
}

function montarEnderecoCliente(dados) {
  const partes = [
    dados.rua,
    dados.numero ? `nº ${dados.numero}` : "",
    dados.bairro,
    [dados.cidade, dados.estado].filter(Boolean).join(" / "),
    dados.cep ? `CEP ${dados.cep}` : ""
  ].filter(Boolean);

  return partes.join(" - ");
}

function abrirDadosClientePedido() {
  if (!pedidoPodeSerEnviado()) return;

  const modal = document.getElementById("modal-dados-cliente");
  const status = document.getElementById("status-dados-cliente");
  const botao = document.getElementById("botao-enviar-dados-cliente");

  if (!modal) return;

  inicializarEnderecoClientePedido();
  limparErroCampoCliente();

  if (status) {
    status.innerText = "";
    status.className = "status-envio-pedido";
  }

  if (botao) {
    botao.disabled = false;
    botao.innerText = "Enviar pedido";
  }

  registrarOrigemFocoModal(modal);
  modal.classList.remove("escondido");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-aberto");
  gerenciadorOverlay.abrir("dados-cliente");

  const primeiroCampo = document.getElementById("cliente-nome");
  focarModalAcessivel(modal, primeiroCampo);
}

function fecharDadosClientePedido() {
  const modal = document.getElementById("modal-dados-cliente");
  if (!modal) return;

  modal.classList.add("escondido");
  modal.setAttribute("aria-hidden", "true");
  gerenciadorOverlay.fechar("dados-cliente");
  restaurarFocoModal(modal);

  const modalResumo = document.getElementById("modal-resumo");
  if (!modalResumo || modalResumo.classList.contains("escondido")) {
    document.body.classList.remove("modal-aberto");
  }
}

function coletarDadosClientePedido() {
  inicializarEnderecoClientePedido();

  const campos = {
    nome: document.getElementById("cliente-nome"),
    cnpj: document.getElementById("cliente-cnpj"),
    contato: document.getElementById("cliente-contato"),
    cep: document.getElementById("cliente-cep"),
    rua: document.getElementById("cliente-rua"),
    numero: document.getElementById("cliente-numero"),
    bairro: document.getElementById("cliente-bairro"),
    cidade: document.getElementById("cliente-cidade"),
    estado: document.getElementById("cliente-estado")
  };

  const campoComplemento = document.getElementById("cliente-local-entrega");

  limparErroCampoCliente();

  const dados = {
    nome: campos.nome ? campos.nome.value.trim() : "",
    cnpj: campos.cnpj ? campos.cnpj.value.trim() : "",
    contato: campos.contato ? campos.contato.value.trim() : "",
    cep: campos.cep ? formatarCep(campos.cep.value.trim()) : "",
    rua: campos.rua ? campos.rua.value.trim() : "",
    numero: campos.numero ? campos.numero.value.trim() : "",
    bairro: campos.bairro ? campos.bairro.value.trim() : "",
    cidade: campos.cidade ? campos.cidade.value.trim() : "",
    estado: campos.estado ? campos.estado.value.trim().toUpperCase() : "",
    complemento: campoComplemento ? campoComplemento.value.trim() : ""
  };

  dados.localEntrega = montarEnderecoCliente(dados);
  if (dados.complemento) {
    dados.localEntrega += `${dados.localEntrega ? " - " : ""}${dados.complemento}`;
  }

  const erros = [];

  Object.entries(campos).forEach(([chave, campo]) => {
    if (!campo) return;
    const vazio = !dados[chave];
    marcarCampoClienteInvalido(campo, vazio);
    if (vazio) erros.push(chave);
  });

  if (dados.cnpj && !cnpjClienteValido(dados.cnpj)) {
    marcarCampoClienteInvalido(campos.cnpj, true);
    erros.push("cnpj-formato");
  }

  if (dados.contato && !telefoneClienteValido(dados.contato)) {
    marcarCampoClienteInvalido(campos.contato, true);
    erros.push("contato-formato");
  }

  if (dados.cep && !cepClienteValido(dados.cep)) {
    marcarCampoClienteInvalido(campos.cep, true);
    erros.push("cep-formato");
  }

  if (dados.estado && !ufClienteValida(dados.estado)) {
    marcarCampoClienteInvalido(campos.estado, true);
    erros.push("uf-formato");
  }

  if (erros.length) {
    const status = document.getElementById("status-dados-cliente");
    const possuiFormato = erros.some(erro => erro.includes("-formato"));
    if (status) {
      status.innerText = possuiFormato
        ? "Confira CNPJ, telefone, CEP e UF antes de enviar."
        : "Preencha os dados obrigatórios do cliente e endereço.";
      status.className = "status-envio-pedido erro";
    }
    const primeiroInvalido = document.querySelector(".campo-cliente.erro");
    if (primeiroInvalido) primeiroInvalido.focus();
    return null;
  }

  dados.cnpj = formatarCnpj(dados.cnpj);
  return dados;
}

function gerarNumeroPedido() {
  const agora = new Date();
  const data = [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, "0"),
    String(agora.getDate()).padStart(2, "0")
  ].join("");
  const hora = [
    String(agora.getHours()).padStart(2, "0"),
    String(agora.getMinutes()).padStart(2, "0"),
    String(agora.getSeconds()).padStart(2, "0"),
    String(agora.getMilliseconds()).padStart(3, "0")
  ].join("");
  let aleatorio = Math.floor(Math.random() * 10000);
  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    const buffer = new Uint16Array(1);
    window.crypto.getRandomValues(buffer);
    aleatorio = buffer[0] % 10000;
  }
  return `PED-${data}-${hora}-${String(aleatorio).padStart(4, "0")}`;
}

function mostrarAvisoSucessoPedido(numeroPedido) {
  const aviso = document.getElementById("aviso-sucesso-pedido");
  const numero = document.getElementById("aviso-numero-pedido");

  if (!aviso) {
    alert(`Pedido enviado com sucesso! Número do pedido: ${numeroPedido}`);
    return;
  }

  if (numero) {
    numero.innerText = numeroPedido;
  }

  aviso.classList.remove("escondido");
  aviso.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    fecharAvisoSucessoPedido();
  }, 9000);
}

function fecharAvisoSucessoPedido() {
  const aviso = document.getElementById("aviso-sucesso-pedido");
  if (!aviso) return;

  aviso.classList.add("escondido");
  aviso.setAttribute("aria-hidden", "true");
}

function confirmarEnviarPedido() {
  abrirDadosClientePedido();
}

let envioPedidoPendente = null;

function configuracaoConfirmacaoPedido() {
  const custom = window.HB_ENVIO_CONFIG || {};
  return {
    timeoutMs: Number(custom.timeoutMs || 45000),
    intervaloMs: Number(custom.intervaloMs || 1000),
    jsonpTimeoutMs: Number(custom.jsonpTimeoutMs || 6000)
  };
}

function gerarTokenConfirmacaoPedido() {
  const partes = [];
  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    const bytes = new Uint32Array(4);
    window.crypto.getRandomValues(bytes);
    bytes.forEach(valor => partes.push(valor.toString(36)));
  } else {
    partes.push(Date.now().toString(36), Math.random().toString(36).slice(2));
  }
  return partes.join("").slice(0, 64);
}

function esperar(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function requisicaoJsonp(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const callback = `__hbJsonpPedido_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement("script");
    let concluida = false;
    const limpar = () => {
      if (concluida) return;
      concluida = true;
      window.clearTimeout(timer);
      script.remove();
      try { delete window[callback]; } catch (_) { window[callback] = undefined; }
    };
    window[callback] = dados => {
      limpar();
      resolve(dados || {});
    };
    script.onerror = () => {
      limpar();
      reject(new Error("Não foi possível consultar a confirmação do pedido."));
    };
    const separador = url.includes("?") ? "&" : "?";
    script.src = `${url}${separador}callback=${encodeURIComponent(callback)}&_=${Date.now()}`;
    script.async = true;
    const timer = window.setTimeout(() => {
      limpar();
      reject(new Error("Tempo esgotado ao consultar a confirmação do pedido."));
    }, timeoutMs);
    document.head.appendChild(script);
  });
}

async function consultarConfirmacaoPedido(numeroPedido, tokenConfirmacao) {
  const params = new URLSearchParams({
    acao: "verificar_pedido",
    numeroPedido,
    tokenConfirmacao,
    origem: "catalogo-online"
  });
  const config = configuracaoConfirmacaoPedido();
  return requisicaoJsonp(
    `${URL_APPS_SCRIPT_PEDIDO}?${params.toString()}`,
    config.jsonpTimeoutMs
  );
}

function confirmacaoPedidoConcluida(resposta) {
  return Boolean(
    resposta && resposta.sucesso === true &&
    String(resposta.status || "").toUpperCase() === "CONFIRMADO"
  );
}

async function aguardarConfirmacaoPedido(numeroPedido, tokenConfirmacao, statusEl) {
  const config = configuracaoConfirmacaoPedido();
  const inicio = Date.now();
  let ultimaResposta = null;
  let consultas = 0;

  while (Date.now() - inicio < config.timeoutMs) {
    consultas += 1;
    try {
      ultimaResposta = await consultarConfirmacaoPedido(numeroPedido, tokenConfirmacao);
      const estado = String(ultimaResposta?.status || "").toUpperCase();
      const decorrido = Date.now() - inicio;

      if (confirmacaoPedidoConcluida(ultimaResposta)) return ultimaResposta;

      if (estado === "ERRO") {
        const erro = new Error(ultimaResposta.mensagem || "O servidor recusou o processamento do pedido.");
        erro.codigo = "SERVIDOR_REJEITOU";
        throw erro;
      }

      if (statusEl && estado === "PROCESSANDO") {
        statusEl.innerText = decorrido < 18000
          ? "Pedido recebido pelo servidor. Validando os dados..."
          : decorrido < 48000
            ? "Pedido recebido. Encaminhando o e-mail e os anexos..."
            : "O e-mail está sendo finalizado. Não envie novamente...";
        statusEl.className = "status-envio-pedido carregando";
      } else if (statusEl && consultas > 2) {
        statusEl.innerText = "Enviando o pedido e aguardando a confirmação do servidor...";
        statusEl.className = "status-envio-pedido carregando";
      }
    } catch (erro) {
      if (erro?.codigo === "SERVIDOR_REJEITOU") throw erro;
      // Falha transitória da consulta: tenta novamente até o limite total.
    }

    await esperar(config.intervaloMs);
  }

  // Uma última consulta evita mostrar pendência no instante exato em que o
  // servidor termina o e-mail e grava CONFIRMADO.
  try {
    ultimaResposta = await consultarConfirmacaoPedido(numeroPedido, tokenConfirmacao);
    if (confirmacaoPedidoConcluida(ultimaResposta)) return ultimaResposta;
  } catch (_) {}

  const erro = new Error("O servidor ainda está finalizando a confirmação do pedido.");
  erro.codigo = "CONFIRMACAO_PENDENTE";
  erro.ultimaResposta = ultimaResposta;
  throw erro;
}

function dispararPedidoSemBloquear(payload) {
  const corpo = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    try {
      const blob = new Blob(
        [corpo],
        { type: "text/plain;charset=UTF-8" }
      );
      if (navigator.sendBeacon(URL_APPS_SCRIPT_PEDIDO, blob)) {
        return "beacon";
      }
    } catch (erroBeacon) {
      console.warn("SendBeacon indisponível para o pedido:", erroBeacon);
    }
  }

  // O fetch é iniciado, mas não bloqueia a interface aguardando o Apps Script
  // terminar e responder. A confirmação passa a ser acompanhada por JSONP.
  fetch(URL_APPS_SCRIPT_PEDIDO, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: corpo,
    keepalive: true
  }).catch(erro => {
    console.error("Falha ao disparar o pedido:", erro);
  });

  return "fetch";
}

async function encaminharPedidoEConfirmar(payload, statusEl) {
  let estadoInicial = null;
  try {
    estadoInicial = await consultarConfirmacaoPedido(
      payload.numeroPedido,
      payload.tokenConfirmacao
    );
  } catch (_) {}

  if (confirmacaoPedidoConcluida(estadoInicial)) return estadoInicial;

  const estado = String(estadoInicial?.status || "").toUpperCase();
  if (estado !== "PROCESSANDO") {
    dispararPedidoSemBloquear(payload);

    if (statusEl) {
      statusEl.innerText = "Pedido enviado ao servidor. Aguardando a confirmação...";
      statusEl.className = "status-envio-pedido carregando";
    }

    // Dá tempo para o Apps Script registrar PROCESSANDO sem segurar a interface
    // até o término do e-mail e dos anexos.
    await esperar(350);
  }

  return aguardarConfirmacaoPedido(
    payload.numeroPedido,
    payload.tokenConfirmacao,
    statusEl
  );
}

async function enviarPedidoComDadosCliente() {
  if (!pedidoPodeSerEnviado()) return;

  const dadosCliente = coletarDadosClientePedido();
  if (!dadosCliente) return;

  const botao = document.getElementById("botao-enviar-dados-cliente");
  const status = document.getElementById("status-dados-cliente");

  if (botao) {
    botao.disabled = true;
    botao.innerText = "Preparando segurança...";
  }

  if (status) {
    status.innerText = "Gerando o backup local do pedido...";
    status.className = "status-envio-pedido carregando";
  }

  if (!envioPedidoPendente) {
    const numeroPedido = gerarNumeroPedido();
    const dadosClientePayload = montarDadosClienteParaPayload(dadosCliente);
    const detalhesCliente = carrinho
      .filter(item => textoObservacaoItem(item))
      .map(item => ({
        referencia: item.referencia,
        observacao: textoObservacaoItem(item)
      }));

    const payload = {
      origem: "catalogo-online",
      numeroPedido,
      tokenConfirmacao: gerarTokenConfirmacaoPedido(),
      protocoloFrontend: "P08.3-C.2",
      dataPedido: new Date().toISOString(),
      emailsDestino: EMAILS_DESTINO_PEDIDO,
      codigoComercial: codigoComercialParaPayload(),
      dadosCliente: dadosClientePayload,
      detalhesCliente,
      fabrica: nomeFabrica(fabricaDoCarrinho()),
      totalPecas: totalPecasPedido(),
      subtotalEstimado: valorSubtotalPedido(),
      percentualDesconto: percentualDescontoPedido(valorSubtotalPedido(), fabricaDoCarrinho()),
      valorDesconto: valorDescontoPedido(valorSubtotalPedido(), fabricaDoCarrinho()),
      totalEstimado: valorTotalPedido(),
      pedido: montarPedidoParaEnvio()
    };

    envioPedidoPendente = { payload };
    gerarSaidasLocaisDeSeguranca(payload);
  }

  const payload = envioPedidoPendente.payload;
  const numeroPedido = payload.numeroPedido;

  if (status) {
    status.innerText = "Backup criado. Enviando o pedido com segurança...";
    status.className = "status-envio-pedido carregando";
  }
  if (botao) botao.innerText = "Confirmando recebimento...";

  try {
    const confirmacao = await encaminharPedidoEConfirmar(payload, status);
    if (!confirmacaoPedidoConcluida(confirmacao)) {
      throw new Error("Confirmação inválida recebida do servidor.");
    }

    atualizarBackupLocalPedido(
      numeroPedido,
      "CONFIRMADO_PELO_SERVIDOR",
      `Confirmado em ${confirmacao.confirmadoEm || new Date().toISOString()}`
    );

    if (status) {
      status.innerText = "Pedido confirmado pelo servidor e encaminhado para análise.";
      status.className = "status-envio-pedido sucesso";
    }

    carrinho = [];
    salvarCarrinho();
    renderizarCarrinho();
    envioPedidoPendente = null;

    fecharDadosClientePedido();
    fecharResumoPedido();
    mostrarAvisoSucessoPedido(numeroPedido);

    if (botao) {
      botao.disabled = false;
      botao.innerText = "Enviar pedido";
    }
  } catch (erro) {
    console.error("Erro ao confirmar pedido:", erro);
    const pendente = erro?.codigo === "CONFIRMACAO_PENDENTE";
    atualizarBackupLocalPedido(
      numeroPedido,
      pendente ? "AGUARDANDO_CONFIRMACAO" : "ERRO_ENVIO_SERVIDOR",
      String(erro)
    );

    if (status) {
      const estadoServidor = String(erro?.ultimaResposta?.status || "").toUpperCase();
      if (pendente && estadoServidor === "PROCESSANDO") {
        status.innerText = "O servidor já recebeu o pedido e ainda está finalizando os anexos. Não envie outro pedido; clique abaixo apenas para verificar a confirmação.";
        status.className = "status-envio-pedido aviso";
      } else if (pendente) {
        status.innerText = "Ainda não conseguimos confirmar o recebimento. O carrinho e o backup foram preservados para uma nova verificação segura.";
        status.className = "status-envio-pedido aviso";
      } else {
        status.innerText = "O pedido não foi confirmado pelo sistema. O carrinho e o backup foram preservados para nova tentativa.";
        status.className = "status-envio-pedido erro";
      }
    }

    if (botao) {
      botao.disabled = false;
      botao.innerText = pendente ? "Verificar recebimento" : "Tentar enviar novamente";
    }
  }
}


// Mantém o estado visual dos filtros de preço sincronizado após carregamentos parciais/cache.
executarQuandoDOMPronto(atualizarBotoesFiltroPreco);
executarQuandoDOMPronto(configurarPainelFiltroPreco);
executarQuandoDOMPronto(configurarRolagemNumeracoesPopup);
executarQuandoDOMPronto(configurarArrastePopupMobile);

window.addEventListener("click", (evento) => {
  const menuWrap = evento.target.closest && evento.target.closest(".menu-topo-wrap");
  if (!menuWrap) {
    document.body.classList.remove("menu-topo-aberto");
    const botaoMenu = document.querySelector(".btn-menu-topo");
    if (botaoMenu) botaoMenu.setAttribute("aria-expanded", "false");
  }
});


/* =======================================================================
   Cupom — visual novo isolado; lógica comercial preservada
   ======================================================================= */
function sincronizarEstadoCupomMobile() {
  // Mantido por compatibilidade com a lógica antiga. O visual novo é renderizado em #hb-cupom-root.
}


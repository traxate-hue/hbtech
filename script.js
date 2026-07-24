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
let produtosFiltradosAtuais = [];

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

function entrar(fabrica) {
  window.location.href = "catalogo.html?fabrica=" + fabrica + "&categoria=todos";
}

function irParaCategoria(categoria) {
  window.location.href = `catalogo.html?fabrica=${fabricaAtual}&categoria=${categoria}`;
}

function trocarFabrica() {
  window.location.href = "index.html";
}

function voltarAoTopo() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function atualizarBotaoVoltarTopo() {
  const botao = document.getElementById("btn-voltar-topo");
  if (!botao) return;

  botao.classList.toggle("visivel", window.scrollY > 420);
}

window.addEventListener("scroll", atualizarBotaoVoltarTopo, { passive: true });
window.addEventListener("DOMContentLoaded", atualizarBotaoVoltarTopo);


function atualizarBusca(valor) {
  buscaAtual = normalizarTexto(valor);
  paginaAtualProdutos = 1;

  document.body.classList.toggle("busca-catalogo-com-texto", Boolean(String(valor || "").trim()));
  carregarProdutos();
  atualizarVisibilidadeControlesMobile();
}

function alternarFiltroPrecoPainel() {
  const abriu = !document.body.classList.contains("filtro-preco-aberto");
  document.body.classList.toggle("filtro-preco-aberto", abriu);

  const botao = document.querySelector(".btn-filtro-toggle");
  if (botao) {
    botao.setAttribute("aria-expanded", abriu ? "true" : "false");
  }
}

function fecharFiltroPrecoPainel() {
  document.body.classList.remove("filtro-preco-aberto");
  const botao = document.querySelector(".btn-filtro-toggle");
  if (botao) {
    botao.setAttribute("aria-expanded", "false");
  }
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
      carrinho = carrinho.filter(item => item && item.referencia && item.fabrica);
      unificarCarrinhoPorReferencia();
    } catch (e) {
      carrinho = [];
    }
  }
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
  if (fabrica === "inove") return 6;
  return 1;
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
  const fabrica = String(produtoOuItem?.fabrica || "").toLowerCase();

  // Zarrara vem do importador com preço pronto no campo "preco".
  if (fabrica === "zarrara") {
    if (produtoOuItem && produtoOuItem.preco !== undefined && produtoOuItem.preco !== null) {
      return Number(produtoOuItem.preco) || 0;
    }

    // Segurança para itens antigos que já estavam salvos no carrinho sem o campo preco.
    const produtoOriginal = produtos.find(produto =>
      produto.referencia === produtoOuItem?.referencia &&
      String(produto.fabrica || "").toLowerCase() === "zarrara"
    );

    return Number(produtoOriginal?.preco) || 0;
  }

  // Tendenze usa preço por grama conforme a descrição: C/ ZIRC. ou S/ ZIRC.
  // As outras fábricas continuam usando o coeficiente padrão por fábrica.
  return pesoNumerico(produtoOuItem?.peso) * coeficienteGramaProduto(produtoOuItem);
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

function pastaCategoria(categoria) {
  const cat = categoriaChave(categoria);

  const mapa = {
    "anel": "aneis",
    "aneis": "aneis",
    "brinco": "brincos",
    "brincos": "brincos",
    "berloque": "berloques",
    "berloques": "berloques",
    "escapulario": "escapularios",
    "escapularios": "escapularios",
    "infantil": "infantil",
    "linha-infantil": "infantil",
    "conjunto-infantil-cji": "infantil",
    "gargantilha": "gargantilhas",
    "gargantilhas": "gargantilhas",
    "piercing": "piercings",
    "piercings": "piercings",
    "pulseira": "pulseiras",
    "pulseiras": "pulseiras",
    "pingente": "pingentes",
    "pingentes": "pingentes",
    "pingente-galeria": "pingente-galeria"
  };

  return mapa[cat] || cat;
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

function categoriasDisponiveisDaFabrica() {
  const vistas = new Set();
  const categoriasDaFabrica = [];

  produtos
    .filter(produto => String(produto.fabrica || "").toLowerCase() === String(fabricaAtual || "").toLowerCase())
    .forEach(produto => {
      const categoria = String(produto.categoria || "").trim();
      const chave = categoriaChave(categoria);

      if (!categoria || vistas.has(chave)) return;

      vistas.add(chave);
      categoriasDaFabrica.push(categoria);
    });

  return categoriasDaFabrica.sort((a, b) =>
    nomeCategoriaExibicao(a).localeCompare(nomeCategoriaExibicao(b), "pt-BR")
  );
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
    const categoriaJson = JSON.stringify(categoria);
    const ativa = categoriaChave(categoriaAtual) === categoriaChave(categoria) ? "ativo" : "";

    html += `
      <button type="button" class="${ativa}" onclick='irParaCategoria(${categoriaJson})'>
        <span class="cat-icone ${iconeCategoria(categoria)}" aria-hidden="true"></span>${nomeCategoriaExibicao(categoria)}
      </button>
    `;
  });

  container.innerHTML = html;
  setTimeout(atualizarIndicadorCategorias, 50);
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
      destino.numeracoes[numero] = Number(destino.numeracoes[numero] || 0) + Number(qtd || 0);
    });
    destino.quantidade = null;
  } else {
    destino.quantidade = Number(destino.quantidade || 0) + Number(origem.quantidade || 0);
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

  carrinho.forEach(item => {
    if (!item || !item.referencia || !item.fabrica) return;
    const existente = unificado.find(atual => chaveProdutoCarrinho(atual) === chaveProdutoCarrinho(item));

    if (existente) {
      mesclarDadosItemCarrinho(existente, item);
    } else {
      unificado.push({ ...item, numeracoes: item.numeracoes ? { ...item.numeracoes } : item.numeracoes });
    }
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
  document.querySelectorAll('.produto[data-ref][data-fabrica]').forEach(card => {
    const ref = card.getAttribute('data-ref') || '';
    const fab = card.getAttribute('data-fabrica') || '';
    const existe = carrinho.some(item =>
      String(item.referencia || '') === ref &&
      String(item.fabrica || '').toLowerCase() === fab.toLowerCase() &&
      totalPecasItem(item) > 0
    );

    card.classList.toggle('produto-no-carrinho', existe);

    let selo = card.querySelector('.selo-no-carrinho');
    if (existe && !selo) {
      const imagem = card.querySelector('.imagem-produto');
      if (imagem) imagem.insertAdjacentHTML('beforeend', seloProdutoNoCarrinhoHtml());
    } else if (!existe && selo) {
      selo.remove();
    }
  });
}

function carregarProdutos() {
  const container = document.getElementById("produtos");
  if (!container) return;

  container.innerHTML = "";

  produtosFiltradosAtuais = produtos
    .filter(produto => String(produto.fabrica || "").toLowerCase() === String(fabricaAtual || "").toLowerCase())
    .filter(produto => categoriaAtual === "todos" || categoriaChave(produto.categoria) === categoriaChave(categoriaAtual))
    .filter(produto => produtoPassaFiltroPreco(produto))
    .filter(produto => {
      if (!buscaAtual) return true;

      const referencia = normalizarTexto(produto.referencia);
      const descricao = normalizarTexto(produto.descricao);
      const peso = normalizarTexto(produto.peso);
      const codigo = normalizarTexto(produto.codigo);

      return (
        referencia.includes(buscaAtual) ||
        descricao.includes(buscaAtual) ||
        peso.includes(buscaAtual) ||
        codigo.includes(buscaAtual)
      );
    });

  if (String(fabricaAtual || "").toLowerCase() === "tendenze") {
    produtosFiltradosAtuais = produtosFiltradosAtuais
      .map((produto, ordemOriginal) => ({ produto, ordemOriginal }))
      .sort((a, b) => {
        const prioridadeA = PRIORIDADE_TENDENZE.has(String(a.produto.referencia))
          ? PRIORIDADE_TENDENZE.get(String(a.produto.referencia))
          : 999999;
        const prioridadeB = PRIORIDADE_TENDENZE.has(String(b.produto.referencia))
          ? PRIORIDADE_TENDENZE.get(String(b.produto.referencia))
          : 999999;

        if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;
        return a.ordemOriginal - b.ordemOriginal;
      })
      .map(item => item.produto);
  }

  const totalPaginas = Math.max(1, Math.ceil(produtosFiltradosAtuais.length / PRODUTOS_POR_PAGINA));

  if (paginaAtualProdutos > totalPaginas) paginaAtualProdutos = totalPaginas;
  if (paginaAtualProdutos < 1) paginaAtualProdutos = 1;

  const inicio = (paginaAtualProdutos - 1) * PRODUTOS_POR_PAGINA;
  const fim = inicio + PRODUTOS_POR_PAGINA;
  const produtosParaMostrar = produtosFiltradosAtuais.slice(inicio, fim);

  produtosParaMostrar.forEach(produto => {
    const refJson = JSON.stringify(produto.referencia);
    const altImagem = `Referência ${produto.referencia}`;

    const imagemSrcJson = JSON.stringify(produto.imagem || "");
    const imagemAltJson = JSON.stringify(altImagem);

    const imagemHtml = produto.imagem
      ? `<img src="${produto.imagem}" alt="${altImagem}" loading="lazy" onclick='abrirZoomImagem(${imagemSrcJson}, ${imagemAltJson})'>`
      : `<span>Sem imagem</span>`;

    const jaNoCarrinho = produtoJaNoCarrinho(produto);
    const classeNoCarrinho = jaNoCarrinho ? " produto-no-carrinho" : "";
    const seloNoCarrinho = jaNoCarrinho ? seloProdutoNoCarrinhoHtml() : "";
    const dataRef = String(produto.referencia || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const dataFabrica = String(produto.fabrica || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");

    const infoHtml = `
      <div class="imagem-produto">
        ${imagemHtml}
        ${seloNoCarrinho}
        <span class="badge-ref-card">Ref. ${produto.referencia}</span>
        ${produto.peso ? `<span class="badge-peso-card">Peso: ${produto.peso}</span>` : ""}
      </div>
      <div class="info-produto">
        <p class="ref-produto">Ref. ${produto.referencia}</p>
        ${produto.peso ? `<p class="peso-produto">Peso: ${produto.peso}</p>` : ""}
        <p class="valor-produto">R$ ${formatarMoeda(valorUnitarioProduto(produto))}</p>
      </div>
    `;

    if (ehCategoriaAnel(produto.categoria)) {
      container.innerHTML += `
        <div class="produto produto-anel${classeNoCarrinho}" data-ref="${dataRef}" data-fabrica="${dataFabrica}">
          ${infoHtml}
          <div class="produto-acoes produto-acoes-anel">
            <button class="btn-escolher-numeracoes" onclick='abrirPopup(${refJson})'>Escolher numerações</button>
          </div>
        </div>
      `;
    } else {
      container.innerHTML += `
        <div class="produto produto-simples${classeNoCarrinho}" data-ref="${dataRef}" data-fabrica="${dataFabrica}">
          ${infoHtml}
          <div class="produto-acoes produto-acoes-simples">
            <button class="btn-adicionar-card" onclick='abrirPopup(${refJson})'>Adicionar</button>
          </div>
        </div>
      `;
    }
  });

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

  container.innerHTML += `
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

  document.getElementById("popup-referencia").innerText = "Ref. " + produto.referencia;
  document.getElementById("popup-peso").innerText = "Peso: " + (produto.peso || "-") + " • R$ " + formatarMoeda(valorUnitarioProduto(produto));
  document.getElementById("popup-descricao").innerText = produto.descricao || "";
  document.getElementById("popup-minimo").innerText = "Mínimo: " + minimoPorFabrica(produto.fabrica) + " peças";

  const imagemPopup = document.getElementById("popup-imagem-produto");
  if (imagemPopup) {
    imagemPopup.src = produto.imagem || "";
    imagemPopup.alt = "Referência " + produto.referencia;
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
          <div class="numero-topo">
            <span>Aro</span>
            <strong>${numero}</strong>
          </div>

          <div class="controle-qtd" data-aro="${numero}">
            <button class="ajuste-rapido" type="button" aria-label="Diminuir 5 peças do aro ${numero}" onclick="alterarQtdAro(${numero}, -5)">−5</button>
            <button class="ajuste-unitario" type="button" aria-label="Diminuir 1 peça do aro ${numero}" onclick="alterarQtdAro(${numero}, -1)">−1</button>
            <input type="number" id="aro-${numero}" min="0" value="0" inputmode="numeric" aria-label="Quantidade do aro ${numero}" oninput="atualizarResumoPopup()">
            <button class="ajuste-unitario" type="button" aria-label="Aumentar 1 peça do aro ${numero}" onclick="alterarQtdAro(${numero}, 1)">+1</button>
            <button class="ajuste-rapido" type="button" aria-label="Aumentar 5 peças do aro ${numero}" onclick="alterarQtdAro(${numero}, 5)">+5</button>
          </div>
        </div>
      `;
    });
  } else {
    html = `
      <div class="numero-item numero-item-simples">
        <div class="numero-topo">
          <span>Quantidade</span>
          <strong>Peças</strong>
        </div>

        <div class="controle-qtd">
          <button type="button" onclick="alterarQtdSimples(-5)">-5</button>
          <button type="button" onclick="alterarQtdSimples(-1)">-1</button>
          <input type="number" id="qtd-popup-simples" min="0" value="${minimoPorFabrica(produto.fabrica)}" inputmode="numeric" oninput="atualizarResumoPopup()">
          <button type="button" onclick="alterarQtdSimples(1)">+1</button>
          <button type="button" onclick="alterarQtdSimples(5)">+5</button>
        </div>
      </div>
    `;
  }

  document.getElementById("numeracoes").innerHTML = html;
  atualizarResumoPopup();
  ajustarPopupMobileNumeracoes();
  aplicarLayoutPopupNumeracoesForcado();
  document.getElementById("popup").classList.remove("escondido");
  requestAnimationFrame(aplicarLayoutPopupNumeracoesForcado);
}

function ajustarPopupMobileNumeracoes() {
  const popup = document.getElementById("popup");
  const grid = popup?.querySelector(".popup-produto-grid");
  const visual = popup?.querySelector(".popup-produto-visual");
  const selecao = popup?.querySelector(".popup-selecao-numeracoes");

  if (!grid || !visual || !selecao) return;

  const isMobile = window.innerWidth <= 768;
  visual.classList.toggle("produto-info-inline-mobile", isMobile);

  // Mantém uma única estrutura de DOM. Desktop e mobile são reorganizados
  // somente pelo CSS, evitando cortes da referência e sumiço da observação.
  if (visual.parentElement !== grid) {
    grid.insertBefore(visual, selecao);
  }
}

function aplicarEstilosImportantesPopup(elemento, estilos) {
  if (!elemento) return;

  Object.entries(estilos).forEach(([propriedade, valor]) => {
    elemento.style.setProperty(propriedade, String(valor), "important");
  });
}

function garantirCssPseudoPopupNumeracoes() {
  if (document.getElementById("hb-popup-runtime-pseudo-v4")) return;

  const estilo = document.createElement("style");
  estilo.id = "hb-popup-runtime-pseudo-v4";
  estilo.textContent = `
    @media (min-width: 769px) {
      #popup .popup-conteudo.popup-produto-layout::before {
        display: none !important;
        content: none !important;
      }
    }

    @media (max-width: 768px) {
      #popup .popup-conteudo.popup-produto-layout::before {
        position: absolute !important;
        z-index: 7 !important;
        top: 12px !important;
        left: 50% !important;
        display: block !important;
        width: 54px !important;
        height: 5px !important;
        content: "" !important;
        border-radius: 999px !important;
        background: #c9e1f1 !important;
        transform: translateX(-50%) !important;
      }
    }
  `;
  document.head.appendChild(estilo);
}

function aplicarLayoutPopupNumeracoesForcado() {
  const popup = document.getElementById("popup");
  if (!popup) return;

  garantirCssPseudoPopupNumeracoes();

  const mobile = window.innerWidth <= 768;
  const conteudo = popup.querySelector(".popup-conteudo.popup-produto-layout");
  const grid = popup.querySelector(".popup-produto-grid");
  const visual = popup.querySelector(".popup-produto-visual");
  const imagemBox = popup.querySelector(".popup-imagem-principal");
  const imagem = popup.querySelector(".popup-imagem-principal img");
  const info = popup.querySelector(".popup-info-produto");
  const infoLabel = popup.querySelector(".popup-info-produto > .popup-label");
  const referencia = document.getElementById("popup-referencia");
  const descricao = document.getElementById("popup-descricao");
  const meta = popup.querySelector(".popup-meta-linha");
  const metaItens = popup.querySelectorAll(".popup-meta-linha span");
  const selecao = popup.querySelector(".popup-selecao-numeracoes");
  const selecaoLabel = popup.querySelector(".popup-selecao-numeracoes > .popup-label");
  const titulo = popup.querySelector(".popup-selecao-numeracoes > h3");
  const ajuda = popup.querySelector(".popup-ajuda");
  const numeracoes = document.getElementById("numeracoes");
  const observacaoBox = popup.querySelector(".popup-observacao-box");
  const observacaoLabel = popup.querySelector(".popup-observacao-box label");
  const observacao = document.getElementById("popup-observacao");
  const resumoInterno = popup.querySelector(".popup-resumo-selecao");
  const rodape = popup.querySelector(".popup-rodape-fixo");
  const rodapeInfo = popup.querySelector(".popup-rodape-info");
  const rodapeLabel = popup.querySelector(".popup-rodape-info span");
  const rodapeTotal = document.getElementById("popup-rodape-total");
  const confirmar = document.getElementById("botao-confirmar-popup");
  const fechar = popup.querySelector(".fechar-popup");

  aplicarEstilosImportantesPopup(popup, {
    "box-sizing": "border-box",
    "align-items": "center",
    "justify-content": "center",
    "padding": mobile ? "8px 6px" : "16px 20px"
  });

  aplicarEstilosImportantesPopup(conteudo, {
    "box-sizing": "border-box",
    "position": "relative",
    "display": "flex",
    "flex-direction": "column",
    "width": mobile ? "calc(100vw - 12px)" : "min(880px, calc(100vw - 40px))",
    "height": mobile ? "calc(100dvh - 16px)" : "min(720px, calc(100dvh - 32px))",
    "max-width": mobile ? "calc(100vw - 12px)" : "880px",
    "max-height": mobile ? "calc(100dvh - 16px)" : "calc(100dvh - 32px)",
    "margin": "0",
    "padding": "0",
    "overflow": "hidden",
    "border-radius": mobile ? "21px" : "20px",
    "background": "#fff",
    "transform": "none"
  });

  aplicarEstilosImportantesPopup(grid, {
    "box-sizing": "border-box",
    "position": "relative",
    "inset": "auto",
    "display": "grid",
    "grid-template-columns": "minmax(0, 1fr)",
    "grid-template-rows": "auto minmax(0, 1fr)",
    "flex": "1 1 auto",
    "width": "100%",
    "min-width": "0",
    "min-height": "0",
    "height": "auto",
    "margin": "0",
    "padding": "0",
    "overflow": "hidden",
    "transform": "none"
  });

  aplicarEstilosImportantesPopup(visual, {
    "box-sizing": "border-box",
    "position": "relative",
    "inset": "auto",
    "order": "0",
    "display": "grid",
    "grid-template-columns": mobile ? "54px minmax(0, 1fr)" : "78px minmax(0, 1fr)",
    "align-items": "center",
    "gap": mobile ? "9px" : "14px",
    "width": "100%",
    "min-width": "0",
    "min-height": "0",
    "height": "auto",
    "margin": "0",
    "padding": mobile ? "40px 44px 8px 12px" : "18px 48px 12px 22px",
    "overflow": "visible",
    "border": "0",
    "border-bottom": "1px solid rgba(0, 32, 99, 0.12)",
    "border-radius": "0",
    "background": "#fff",
    "box-shadow": "none",
    "transform": "none"
  });

  aplicarEstilosImportantesPopup(imagemBox, {
    "box-sizing": "border-box",
    "position": "relative",
    "inset": "auto",
    "display": "grid",
    "place-items": "center",
    "width": mobile ? "54px" : "78px",
    "min-width": mobile ? "54px" : "78px",
    "height": mobile ? "54px" : "78px",
    "min-height": mobile ? "54px" : "78px",
    "aspect-ratio": "auto",
    "margin": "0",
    "padding": "0",
    "overflow": "hidden",
    "border": "1px solid rgba(0, 32, 99, 0.10)",
    "border-radius": mobile ? "8px" : "11px",
    "background": "#f7f8fb",
    "transform": "none"
  });

  aplicarEstilosImportantesPopup(imagem, {
    "display": "block",
    "width": "100%",
    "height": "100%",
    "max-width": "none",
    "max-height": "none",
    "margin": "0",
    "object-fit": "contain",
    "opacity": "1",
    "visibility": "visible"
  });

  aplicarEstilosImportantesPopup(info, {
    "box-sizing": "border-box",
    "position": "relative",
    "inset": "auto",
    "display": "block",
    "width": "100%",
    "min-width": "0",
    "max-width": "none",
    "margin": "0",
    "padding": "0",
    "overflow": "visible",
    "transform": "none"
  });
  aplicarEstilosImportantesPopup(infoLabel, { "display": "none" });

  aplicarEstilosImportantesPopup(referencia, {
    "display": "block",
    "width": "100%",
    "max-width": "none",
    "margin": "0",
    "padding": "0",
    "overflow": "visible",
    "color": "#002063",
    "font-size": mobile ? "0.92rem" : "1.05rem",
    "line-height": "1.15",
    "white-space": "normal",
    "text-overflow": "clip",
    "overflow-wrap": "anywhere"
  });

  aplicarEstilosImportantesPopup(descricao, {
    "display": mobile ? "-webkit-box" : "block",
    "width": "100%",
    "max-width": "none",
    "margin": mobile ? "2px 0 4px" : "4px 0 7px",
    "padding": "0",
    "overflow": mobile ? "hidden" : "visible",
    "color": "#465169",
    "font-size": mobile ? "0.67rem" : "0.78rem",
    "line-height": "1.2",
    "white-space": "normal",
    "text-overflow": "clip",
    "-webkit-box-orient": "vertical",
    "-webkit-line-clamp": mobile ? "1" : "unset"
  });

  aplicarEstilosImportantesPopup(meta, {
    "display": "flex",
    "flex-wrap": "wrap",
    "align-items": "center",
    "gap": mobile ? "2px 8px" : "5px 12px",
    "width": "100%",
    "margin": "0",
    "padding": "0",
    "overflow": "visible"
  });
  metaItens.forEach(item => aplicarEstilosImportantesPopup(item, {
    "display": "inline-block",
    "width": "auto",
    "max-width": "100%",
    "margin": "0",
    "padding": "0",
    "overflow": "visible",
    "color": "#39445c",
    "font-size": mobile ? "0.64rem" : "0.75rem",
    "line-height": "1.15",
    "white-space": "normal",
    "text-overflow": "clip"
  }));

  aplicarEstilosImportantesPopup(selecao, {
    "box-sizing": "border-box",
    "position": "relative",
    "inset": "auto",
    "order": "1",
    "display": "flex",
    "flex-direction": "column",
    "width": "100%",
    "min-width": "0",
    "min-height": "0",
    "height": "auto",
    "margin": "0",
    "padding": mobile ? "8px 9px 7px" : "12px 18px 10px",
    "overflow": "hidden",
    "border": "0",
    "background": "#fff",
    "transform": "none"
  });

  aplicarEstilosImportantesPopup(selecaoLabel, {
    "order": "0",
    "display": mobile ? "none" : "block",
    "margin": "0 0 2px",
    "padding": "0",
    "font-size": "0.64rem",
    "line-height": "1.1"
  });

  aplicarEstilosImportantesPopup(titulo, {
    "order": "1",
    "display": "block",
    "width": "100%",
    "margin": "0",
    "padding": "0",
    "color": "#002063",
    "font-size": mobile ? "0.94rem" : "1.08rem",
    "line-height": "1.15",
    "white-space": mobile ? "nowrap" : "normal"
  });

  aplicarEstilosImportantesPopup(ajuda, {
    "order": "2",
    "display": "block",
    "width": "100%",
    "margin": mobile ? "3px 0 6px" : "4px 0 8px",
    "padding": "0",
    "color": "#536078",
    "font-size": mobile ? "0.64rem" : "0.73rem",
    "line-height": "1.2"
  });

  aplicarEstilosImportantesPopup(numeracoes, {
    "box-sizing": "border-box",
    "position": "relative",
    "inset": "auto",
    "order": "3",
    "display": "grid",
    "grid-template-columns": "repeat(2, minmax(0, 1fr))",
    "grid-auto-rows": mobile ? "minmax(0, auto)" : "minmax(42px, auto)",
    "grid-auto-flow": "row",
    "align-content": "start",
    "gap": mobile ? "5px" : "7px",
    "flex": "1 1 auto",
    "width": "100%",
    "min-width": "0",
    "min-height": "0",
    "height": "auto",
    "margin": "0",
    "padding": mobile ? "1px 2px 1px 1px" : "1px 5px 1px 1px",
    "overflow-x": "hidden",
    "overflow-y": "auto",
    "overscroll-behavior": "contain",
    "border": "0",
    "background": "transparent",
    "transform": "none"
  });

  popup.querySelectorAll(".numero-item").forEach(item => {
    aplicarEstilosImportantesPopup(item, {
      "box-sizing": "border-box",
      "position": "relative",
      "inset": "auto",
      "display": "grid",
      "grid-template-columns": mobile ? "28px minmax(0, 1fr)" : "48px minmax(0, 1fr)",
      "align-items": "center",
      "gap": mobile ? "3px" : "7px",
      "width": "100%",
      "min-width": "0",
      "min-height": mobile ? "0" : "42px",
      "height": "auto",
      "margin": "0",
      "padding": "4px",
      "overflow": "hidden",
      "border": "1px solid rgba(0, 32, 99, 0.14)",
      "border-radius": mobile ? "8px" : "10px",
      "background": "#fff",
      "box-shadow": "none",
      "transform": "none"
    });

    const topo = item.querySelector(".numero-topo");
    const aroLabel = topo?.querySelector("span");
    const aroNumero = topo?.querySelector("strong");
    const controle = item.querySelector(".controle-qtd");

    aplicarEstilosImportantesPopup(topo, {
      "display": "flex",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "center",
      "gap": "1px",
      "min-width": "0",
      "margin": "0",
      "padding": "0"
    });
    aplicarEstilosImportantesPopup(aroLabel, {
      "display": mobile ? "none" : "block",
      "color": "#8a6400",
      "font-size": "0.58rem",
      "font-weight": "700",
      "line-height": "1",
      "letter-spacing": "0.08em"
    });
    aplicarEstilosImportantesPopup(aroNumero, {
      "display": "block",
      "color": "#002063",
      "font-size": mobile ? "0.88rem" : "1.02rem",
      "line-height": "1"
    });
    aplicarEstilosImportantesPopup(controle, {
      "box-sizing": "border-box",
      "display": "grid",
      "grid-template-columns": mobile
        ? "30px minmax(30px, 1fr) 30px"
        : "34px 34px 76px 34px 34px",
      "align-items": "center",
      "justify-content": mobile ? "stretch" : "end",
      "justify-self": mobile ? "stretch" : "end",
      "gap": mobile ? "2px" : "4px",
      "width": mobile ? "100%" : "auto",
      "min-width": "0",
      "margin": "0",
      "padding": "0",
      "overflow": "visible",
      "border": "0",
      "background": "transparent"
    });

    controle?.querySelectorAll("button, input").forEach(campo => {
      const rapido = campo.classList.contains("ajuste-rapido");
      aplicarEstilosImportantesPopup(campo, {
        "box-sizing": "border-box",
        "display": rapido && mobile ? "none" : "block",
        "width": "100%",
        "min-width": "0",
        "height": mobile ? "32px" : "34px",
        "margin": "0",
        "padding": "0 2px",
        "border": "1px solid rgba(0, 32, 99, 0.20)",
        "border-radius": mobile ? "7px" : "8px",
        "background": "#fff",
        "color": "#002063",
        "font-size": mobile ? "0.70rem" : "0.74rem",
        "font-weight": "700",
        "line-height": "1",
        "text-align": "center",
        "transform": "none"
      });
    });
  });

  aplicarEstilosImportantesPopup(observacaoBox, {
    "box-sizing": "border-box",
    "position": "relative",
    "inset": "auto",
    "order": "4",
    "display": "block",
    "flex": "0 0 auto",
    "width": "100%",
    "min-width": "0",
    "height": "auto",
    "min-height": "0",
    "max-height": "none",
    "margin": mobile ? "6px 0 0" : "8px 0 0",
    "padding": "0",
    "overflow": "visible",
    "border": "0",
    "background": "transparent",
    "opacity": "1",
    "visibility": "visible",
    "transform": "none"
  });
  aplicarEstilosImportantesPopup(observacaoLabel, {
    "display": "block",
    "margin": mobile ? "0 0 3px" : "0 0 4px",
    "padding": "0",
    "color": "#39445c",
    "font-size": mobile ? "0.64rem" : "0.70rem",
    "font-weight": "600",
    "line-height": "1.1",
    "opacity": "1",
    "visibility": "visible"
  });
  aplicarEstilosImportantesPopup(observacao, {
    "box-sizing": "border-box",
    "position": "relative",
    "inset": "auto",
    "display": "block",
    "width": "100%",
    "min-width": "0",
    "height": mobile ? "40px" : "46px",
    "min-height": mobile ? "40px" : "46px",
    "max-height": mobile ? "40px" : "70px",
    "margin": "0",
    "padding": mobile ? "6px 8px" : "8px 10px",
    "overflow": "auto",
    "resize": mobile ? "none" : "vertical",
    "border": "1px solid rgba(0, 32, 99, 0.18)",
    "border-radius": "8px",
    "background": "#fff",
    "color": "#172033",
    "font-size": mobile ? "0.70rem" : "0.76rem",
    "line-height": "1.25",
    "opacity": "1",
    "visibility": "visible",
    "transform": "none"
  });
  aplicarEstilosImportantesPopup(resumoInterno, {
    "order": "5",
    "display": "none"
  });

  aplicarEstilosImportantesPopup(rodape, {
    "box-sizing": "border-box",
    "position": "relative",
    "inset": "auto",
    "z-index": "3",
    "display": "grid",
    "grid-template-columns": "minmax(0, 1fr) auto",
    "align-items": "center",
    "gap": mobile ? "8px" : "16px",
    "flex": "0 0 auto",
    "width": "100%",
    "min-width": "0",
    "height": mobile ? "auto" : "64px",
    "min-height": mobile ? "0" : "64px",
    "max-height": mobile ? "none" : "64px",
    "margin": "0",
    "padding": mobile ? "7px 9px calc(7px + env(safe-area-inset-bottom))" : "10px 14px",
    "overflow": "visible",
    "border": "0",
    "border-top": "1px solid rgba(0, 32, 99, 0.13)",
    "border-radius": "0",
    "background": "#fff",
    "box-shadow": "0 -5px 18px rgba(0, 32, 99, 0.05)",
    "transform": "none"
  });
  aplicarEstilosImportantesPopup(rodapeInfo, {
    "box-sizing": "border-box",
    "display": "block",
    "width": mobile ? "auto" : "max-content",
    "min-width": "0",
    "height": "auto",
    "margin": "0",
    "padding": "0",
    "overflow": "visible",
    "border": "0",
    "border-radius": "0",
    "background": "transparent",
    "box-shadow": "none",
    "text-align": "left",
    "justify-self": "start"
  });
  aplicarEstilosImportantesPopup(rodapeLabel, {
    "display": "block",
    "margin": "0 0 2px",
    "padding": "0",
    "color": "#8a6400",
    "font-size": mobile ? "0.54rem" : "0.61rem",
    "font-weight": "700",
    "line-height": "1",
    "letter-spacing": "0.08em",
    "text-transform": "uppercase"
  });
  aplicarEstilosImportantesPopup(rodapeTotal, {
    "display": "block",
    "margin": "0",
    "padding": "0",
    "overflow": "visible",
    "color": "#002063",
    "font-size": mobile ? "0.72rem" : "0.86rem",
    "line-height": "1.15",
    "text-align": "left",
    "white-space": mobile ? "nowrap" : "normal",
    "text-overflow": "clip"
  });
  aplicarEstilosImportantesPopup(confirmar, {
    "box-sizing": "border-box",
    "display": "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    "width": "auto",
    "min-width": mobile ? "144px" : "190px",
    "min-height": mobile ? "40px" : "44px",
    "height": mobile ? "40px" : "44px",
    "margin": "0",
    "padding": mobile ? "7px 11px" : "8px 18px",
    "border": "0",
    "border-radius": mobile ? "9px" : "10px",
    "background": "#002b74",
    "color": "#fff",
    "font-size": mobile ? "0.72rem" : "0.82rem",
    "font-weight": "700",
    "line-height": "1",
    "white-space": "nowrap",
    "box-shadow": "none",
    "transform": "none"
  });
  aplicarEstilosImportantesPopup(fechar, {
    "position": "absolute",
    "z-index": "8",
    "top": "12px",
    "right": mobile ? "10px" : "14px",
    "margin": "0",
    "transform": "none"
  });
}

function restaurarPopupDesktopSeNecessario() {
  const popup = document.getElementById("popup");
  if (!popup || !popup.classList.contains("escondido")) return;
  ajustarPopupMobileNumeracoes();
}

window.addEventListener("resize", () => {
  if (document.getElementById("popup") && !document.getElementById("popup").classList.contains("escondido")) {
    ajustarPopupMobileNumeracoes();
    aplicarLayoutPopupNumeracoesForcado();
  }
});

function atualizarResumoPopup() {
  const totalEl = document.getElementById("popup-total-selecionado");
  const totalRodapeEl = document.getElementById("popup-rodape-total");

  let total = 0;

  if (produtoAtual && ehCategoriaAnel(produtoAtual.categoria)) {
    NUMERACOES_ANEIS.forEach(numero => {
      const input = document.getElementById(`aro-${numero}`);
      total += Number(input?.value || 0);
    });
  } else {
    total = Number(document.getElementById("qtd-popup-simples")?.value || 0);
  }

  const textoTotal = total + (total === 1 ? " peça" : " peças");
  const valorTotal = produtoAtual ? total * valorUnitarioProduto(produtoAtual) : 0;
  const textoTotalComValor = textoTotal + " • R$ " + formatarMoeda(valorTotal);

  if (totalEl) totalEl.innerText = textoTotalComValor;
  if (totalRodapeEl) totalRodapeEl.innerText = textoTotalComValor;
}

function fecharPopup() {
  document.getElementById("popup").classList.add("escondido");
}

function alterarQtdAro(numero, incremento) {
  const input = document.getElementById(`aro-${numero}`);
  if (!input) return;

  const atual = Number(input.value) || 0;
  const novoValor = Math.max(0, atual + incremento);

  input.value = novoValor;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}




function alterarQtdSimples(incremento) {
  const input = document.getElementById("qtd-popup-simples");
  if (!input) return;

  const atual = Number(input.value) || 0;
  input.value = Math.max(0, atual + incremento);
  atualizarResumoPopup();
}

function confirmarPopup() {
  if (!produtoAtual) return;

  const observacao = document.getElementById("popup-observacao")?.value?.trim() || "";
  const numeracoes = {};
  let totalPecas = 0;
  const ehAnel = ehCategoriaAnel(produtoAtual.categoria);

  if (ehAnel) {
    NUMERACOES_ANEIS.forEach(numero => {
      const valor = Number(document.getElementById(`aro-${numero}`).value) || 0;
      numeracoes[numero] = valor;
      totalPecas += valor;
    });
  } else {
    totalPecas = Number(document.getElementById("qtd-popup-simples")?.value || 0);
  }

  const minimoAtual = minimoPorFabrica(produtoAtual.fabrica);

  if (totalPecas < minimoAtual) {
    alert(`Mínimo de ${minimoAtual} peças para esta referência.`);
    return;
  }

  adicionarOuSomarNoCarrinho({
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
  renderizarCarrinho();
  animarConfirmacaoMobileCarrinho("Adicionado ao carrinho");

  const observacaoEl = document.getElementById("popup-observacao");
  if (observacaoEl) observacaoEl.value = "";

  fecharPopup();
}


function adicionarProdutoSimples(referencia, botao) {
  const produto = buscarProdutoPorReferencia(referencia);
  if (!produto) return;

  if (!podeAdicionarProduto(produto)) return;

  const input = document.getElementById(`qtd-${referenciaSegura(referencia)}`);
  const quantidade = Number(input.value) || 0;
  const minimoAtual = minimoPorFabrica(produto.fabrica);

  if (quantidade < minimoAtual) {
    alert(`Mínimo de ${minimoAtual} peça(s) para esta referência.`);
    return;
  }

  const card = botao?.closest(".produto");
  if (card) animarProdutoVoando(card);

  adicionarOuSomarNoCarrinho({
    referencia: produto.referencia,
    descricao: produto.descricao,
    peso: produto.peso,
    fabrica: produto.fabrica,
    categoria: produto.categoria,
    minimo: minimoPorFabrica(produto.fabrica),
    imagem: produto.imagem,
    preco: produto.preco,
    precoEtiqueta: produto.precoEtiqueta,
    numeracoes: null,
    quantidade: quantidade
  });

  input.value = "";
  salvarCarrinho();
  renderizarCarrinho();
  animarConfirmacaoMobileCarrinho("Adicionado ao carrinho");

  if (botao) {
    const textoOriginal = botao.innerText;
    botao.innerText = "✔ Adicionado";
    botao.classList.add("botao-adicionado");
    botao.style.animation = "pulseAdd 0.3s ease";

    setTimeout(() => {
      botao.innerText = textoOriginal;
      botao.classList.remove("botao-adicionado");
      botao.style.animation = "";
    }, 800);
  }
}

function totalPecasItem(item) {
  const itemEhAnel = ehCategoriaAnel(item?.categoria);

  if (itemEhAnel) {
    return Object.values(item?.numeracoes || {}).reduce((acc, valor) => acc + Number(valor || 0), 0);
  }

  return Number(item?.quantidade || 0);
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

function valorMinimoNormalFabrica(fabrica) {
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
      valido: true,
      tipo: dados.tipo || "PRIMEIRA_COMPRA",
      loja: dados.loja || dados.cliente || "",
      cliente: dados.cliente || dados.loja || "",
      valorMinimo: Number(dados.valorMinimo || VALOR_MINIMO_CODIGO_PADRAO),
      descontoPercentual: Number(dados.descontoPercentual ?? DESCONTO_CODIGO_PADRAO),
      validade: dados.validade || "",
      fabrica: dados.fabrica || "TODAS",
      validadoEm: dados.validadoEm || "",
      origemValidacao: dados.origemValidacao || "localStorage"
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
  const codigoAtual = codigoComercialAplicado?.codigo ? normalizarCodigoComercial(codigoComercialAplicado.codigo) : "";
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
      <span role="button" tabindex="0" class="hb-cupom__trigger" onclick="alternarCodigoComercialPainel()" onkeydown="hbCupomKey(event, 'toggle')" aria-expanded="${codigoComercialPainelAberto ? "true" : "false"}">
        <span class="hb-cupom__trigger-texto">
          <span class="hb-cupom__trigger-main">${escapeHtml(estado.trigger)}</span>
          ${estado.triggerNote ? `<span class="hb-cupom__trigger-note">${escapeHtml(estado.triggerNote)}</span>` : ""}
        </span>
        <span class="hb-cupom__trigger-icon" aria-hidden="true">⌄</span>
      </span>

      <div class="hb-cupom__body">
        <div class="hb-cupom__topo">
          <span class="hb-cupom__titulo">Cupom</span>
          <span class="hb-cupom__subtitulo">Opcional</span>
        </div>
        <div class="hb-cupom__linha">
          <input id="hb-cupom-input" class="hb-cupom__input" type="text" value="${escapeHtml(valorInput)}" placeholder="Digite seu código" autocomplete="off" aria-label="Cupom ou código comercial" oninput="statusValidacaoCodigo = '';" />
          <span role="button" tabindex="0" class="hb-cupom__apply" onclick="aplicarCodigoComercial()" onkeydown="hbCupomKey(event, 'aplicar')">Aplicar</span>
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

function renderizarCarrinho() {
  const lista = document.getElementById("lista-carrinho");
  const resumoDiv = document.getElementById("resumo-fabricas");

  if (!lista || !resumoDiv) return;

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


  carrinho.forEach((item, index) => {
    const ehAnel = ehCategoriaAnel(item.categoria);

    if (ehAnel) {
      let linhasNumeracoes = "";

      NUMERACOES_ANEIS.forEach(numero => {
        const qtd = item.numeracoes?.[numero] || 0;
        if (qtd > 0) {
          linhasNumeracoes += `<li>Aro ${numero}: ${qtd} peça(s)</li>`;
        }
      });

      lista.innerHTML += `
        <div class="item-carrinho">
          <div class="item-carrinho-cabecalho">
            <div class="item-carrinho-titulo-area">
              <h3>Ref. ${item.referencia}</h3>
            </div>
            <div class="item-carrinho-acoes" aria-label="Ações do item">
              <button type="button" class="botao-icone-carrinho botao-detalhes-carrinho" onclick="alternarDetalhesItem(${index}, this)" aria-label="Ver detalhes do item" title="Ver detalhes" aria-expanded="false">
                ${iconeChevronCarrinho()}
              </button>
              <button type="button" class="botao-icone-carrinho botao-remover-carrinho" onclick="removerItem(${index})" aria-label="Remover item" title="Remover item">
                ${iconeLixeiraCarrinho()}
              </button>
            </div>
          </div>
          <div class="item-carrinho-resumo-linha">
            <span>${totalPecasItem(item)} peça(s)</span>
            <strong>R$ ${formatarMoeda(valorItem(item))}</strong>
          </div>
          <div class="detalhes-carrinho escondido" id="detalhes-carrinho-${index}">
            <p><strong>Peso un.:</strong> ${item.peso || "-"}</p>
            ${observacaoItemHtml(item)}
            <p><strong>Valor un. estimado:</strong> R$ ${formatarMoeda(valorUnitarioProduto(item))}</p>
            <ul>${linhasNumeracoes}</ul>
          </div>
        </div>
      `;
    } else {
      lista.innerHTML += `
        <div class="item-carrinho">
          <div class="item-carrinho-cabecalho">
            <div class="item-carrinho-titulo-area">
              <h3>Ref. ${item.referencia}</h3>
            </div>
            <div class="item-carrinho-acoes" aria-label="Ações do item">
              <button type="button" class="botao-icone-carrinho botao-detalhes-carrinho" onclick="alternarDetalhesItem(${index}, this)" aria-label="Ver detalhes do item" title="Ver detalhes" aria-expanded="false">
                ${iconeChevronCarrinho()}
              </button>
              <button type="button" class="botao-icone-carrinho botao-remover-carrinho" onclick="removerItem(${index})" aria-label="Remover item" title="Remover item">
                ${iconeLixeiraCarrinho()}
              </button>
            </div>
          </div>
          <div class="item-carrinho-resumo-linha">
            <span>${item.quantidade} peça(s)</span>
            <strong>R$ ${formatarMoeda(valorItem(item))}</strong>
          </div>
          <div class="detalhes-carrinho escondido" id="detalhes-carrinho-${index}">
            <p><strong>Peso un.:</strong> ${item.peso || "-"}</p>
            ${observacaoItemHtml(item)}
            <p><strong>Valor un. estimado:</strong> R$ ${formatarMoeda(valorUnitarioProduto(item))}</p>
          </div>
        </div>
      `;
    }
  });

  const ultimoItem = lista.querySelector(".item-carrinho:last-child");
  if (ultimoItem) {
    ultimoItem.classList.add("item-novo");
    setTimeout(() => {
      ultimoItem.classList.remove("item-novo");
    }, 700);
  }

  atualizarBotaoCarrinhoLateral();
  atualizarSelosProdutosNoCarrinho();
  rolarCarrinhoParaBaixo();
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

function validarPedidoAntesDoWhatsApp() {
  if (carrinho.length === 0) {
    alert("Carrinho vazio.");
    return false;
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

function enviarWhatsApp() {
  const mensagem = gerarMensagemWhatsApp();

  if (!mensagem) return;

  const numero = "5511944469755";
  const link = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;

  window.open(link, "_blank");
}

function rolarCarrinhoParaBaixo() {
  const caixa = document.getElementById("lista-carrinho");
  if (!caixa) return;

  caixa.scrollTo({
    top: caixa.scrollHeight,
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

  const botaoCarrinho = document.querySelector(".botao-carrinho-lateral");
  if (botaoCarrinho) {
    botaoCarrinho.classList.remove("carrinho-mobile-salto");
    void botaoCarrinho.offsetWidth;
    botaoCarrinho.classList.add("carrinho-mobile-salto");

    setTimeout(() => {
      botaoCarrinho.classList.remove("carrinho-mobile-salto");
    }, 680);
  }

  setTimeout(() => {
    toast.classList.remove("toast-carrinho-mobile-visivel");
    setTimeout(() => toast.remove(), 220);
  }, 1050);
}

function alvoAnimacaoCarrinho() {
  if (window.matchMedia && window.matchMedia("(max-width: 768px)").matches) {
    return document.querySelector(".mobile-tabbar .tab-pedido") ||
           document.querySelector(".botao-carrinho-lateral") ||
           document.querySelector(".carrinho");
  }

  return document.querySelector(".botao-carrinho-lateral") ||
         document.querySelector(".carrinho");
}

function pulsarAlvoCarrinho(alvo) {
  if (!alvo) return;

  if (window.matchMedia && window.matchMedia("(max-width: 768px)").matches) {
    alvo.classList.remove("carrinho-mobile-salto");
    void alvo.offsetWidth;
    alvo.classList.add("carrinho-mobile-salto");
    setTimeout(() => alvo.classList.remove("carrinho-mobile-salto"), 680);
    return;
  }

  alvo.classList.add("carrinho-pulso");
  setTimeout(() => alvo.classList.remove("carrinho-pulso"), 760);
}

function animarProdutoVoando(elementoProduto) {
  const img = elementoProduto.querySelector("img");
  if (!img) return;

  const carrinho = alvoAnimacaoCarrinho();
  if (!carrinho) return;

  const imgRect = img.getBoundingClientRect();
  const carrinhoRect = carrinho.getBoundingClientRect();

  const clone = img.cloneNode(true);
  clone.classList.add("fly-item");

  clone.style.top = imgRect.top + "px";
  clone.style.left = imgRect.left + "px";
  clone.style.width = imgRect.width + "px";
  clone.style.height = imgRect.height + "px";

  document.body.appendChild(clone);

  setTimeout(() => {
    clone.style.top = carrinhoRect.top + "px";
    clone.style.left = carrinhoRect.left + "px";
    clone.style.width = "40px";
    clone.style.height = "40px";
    clone.style.opacity = "0.3";
  }, 10);

  pulsarAlvoCarrinho(carrinho);

  setTimeout(() => {
    clone.remove();
  }, 700);
}

function animarImagemPopupParaCarrinho() {
  const img = document.getElementById("popup-imagem-produto");
  if (!img || !img.src) return;

  const alvo = alvoAnimacaoCarrinho();
  if (!alvo) return;

  const imgRect = img.getBoundingClientRect();
  const alvoRect = alvo.getBoundingClientRect();

  const clone = img.cloneNode(true);
  clone.classList.add("fly-item", "fly-item-popup");

  clone.style.top = imgRect.top + "px";
  clone.style.left = imgRect.left + "px";
  clone.style.width = Math.min(imgRect.width, 260) + "px";
  clone.style.height = Math.min(imgRect.height, 260) + "px";

  document.body.appendChild(clone);

  const destinoTop = alvoRect.top + alvoRect.height / 2 - 20;
  const destinoLeft = alvoRect.left + alvoRect.width / 2 - 20;

  requestAnimationFrame(() => {
    clone.style.top = destinoTop + "px";
    clone.style.left = destinoLeft + "px";
    clone.style.width = "40px";
    clone.style.height = "40px";
    clone.style.opacity = "0.15";
    clone.style.transform = "rotate(8deg) scale(0.2)";
  });

  pulsarAlvoCarrinho(alvo);

  setTimeout(() => {
    clone.remove();
  }, 760);
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

  botaoPedido.innerHTML = `
    <span class="tab-pedido-icone" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
    </span>
    <span class="tab-pedido-texto">${referencias} ref. • ${pecas} peça(s)</span>
    <strong class="tab-pedido-total">R$ ${formatarMoeda(valor)}</strong>
  `;
}

function atualizarBotaoCarrinhoLateral() {
  const botao = document.querySelector(".botao-carrinho-lateral");
  const areaCarrinho = document.getElementById("area-carrinho");

  if (!botao) return;

  const aberto =
    areaCarrinho &&
    !areaCarrinho.classList.contains("carrinho-fechado");

  botao.classList.toggle("oculto", aberto);

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
  `;

  botao.title = "Abrir carrinho";
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
}

function fecharZoomImagem() {
  const zoom = document.getElementById("zoom-imagem");
  const img = document.getElementById("zoom-img");

  if (!zoom || !img) return;

  zoom.classList.remove("ativo");
  zoom.setAttribute("aria-hidden", "true");
  document.body.classList.remove("zoom-aberto");

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
  if (event.key === "Escape") {
    fecharZoomImagem();
  }
});

let scrollBloqueadoCarrinho = 0;
let carrinhoDragYInicial = 0;
let carrinhoArrastando = false;
let carrinhoDeltaY = 0;
let arrastoCarrinhoMobileIniciado = false;

function mobileAtivo() {
  return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
}

function bloquearRolagemFundoCarrinho() {
  if (!mobileAtivo()) return;
  if (document.body.classList.contains("carrinho-mobile-bloqueado")) return;

  scrollBloqueadoCarrinho = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.classList.add("carrinho-mobile-bloqueado");
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollBloqueadoCarrinho}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function liberarRolagemFundoCarrinho() {
  if (!document.body.classList.contains("carrinho-mobile-bloqueado")) return;

  document.body.classList.remove("carrinho-mobile-bloqueado");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, scrollBloqueadoCarrinho || 0);
}

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

  const alturaTela = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty("--altura-carrinho-mobile", `${Math.round(alturaTela * 0.94)}px`);
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
    bloquearRolagemFundoCarrinho();
  } else {
    liberarRolagemFundoCarrinho();
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
  liberarRolagemFundoCarrinho();

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

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", inicializarCarrinhoMobile);
} else {
  inicializarCarrinhoMobile();
}
window.addEventListener("resize", function () {
  atualizarAlturaCarrinhoMobile();
  if (!mobileAtivo()) liberarRolagemFundoCarrinho();
});

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", atualizarAlturaCarrinhoMobile);
}

function atualizarIndicadorCategorias() {
  const categorias = document.getElementById("categorias-scroll");
  const indicador = document.getElementById("categorias-indicador");

  if (!categorias || !indicador) return;

  const temRolagem = categorias.scrollWidth > categorias.clientWidth + 4;
  const chegouNoFim = categorias.scrollLeft + categorias.clientWidth >= categorias.scrollWidth - 8;

  indicador.classList.toggle("visivel", temRolagem && !chegouNoFim);
}

function iniciarIndicadorCategorias() {
  const categorias = document.getElementById("categorias-scroll");
  if (!categorias) return;

  atualizarIndicadorCategorias();
  categorias.addEventListener("scroll", atualizarIndicadorCategorias, { passive: true });
  window.addEventListener("resize", atualizarIndicadorCategorias);

  setTimeout(atualizarIndicadorCategorias, 80);
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

window.addEventListener("scroll", atualizarVisibilidadeControlesMobile, { passive: true });
window.addEventListener("resize", atualizarVisibilidadeControlesMobile);
window.addEventListener("DOMContentLoaded", atualizarVisibilidadeControlesMobile);

window.onload = function () {
  const params = new URLSearchParams(window.location.search);
  const fabrica = params.get("fabrica");
  const categoria = params.get("categoria");

  if (fabrica) {
    fabricaAtual = fabrica;
  }

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

  if (!categoriaExisteNaFabrica(categoriaAtual)) {
    categoriaAtual = "todos";
  }

  renderizarCategorias();
  carregarProdutos();
  renderizarCarrinho();
  atualizarBotaoCarrinhoLateral();
  iniciarIndicadorCategorias();
};

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
const URL_APPS_SCRIPT_PEDIDO = "https://script.google.com/macros/s/AKfycbz_6YoIPX8JGBR-LBFYb1PMc-TjCJtVFwxPRQuDwwxvYczWEUlD2JbForsaNF3VPvbRaA/exec";
const EMAILS_DESTINO_PEDIDO = ["traxate@gmail.com", "hbjoiasrepresentacoes@gmail.com"];

function pedidoPodeSerEnviado() {
  if (carrinho.length === 0) {
    alert("Seu carrinho está vazio.");
    return false;
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
    botao.innerText = "Confirmar e enviar pedido";
  }

  let totalPedido = 0;

  carrinho.forEach(item => {
    const subtotal = valorItem(item);
    totalPedido += subtotal;

    lista.innerHTML += `
      <div class="item-resumo item-resumo-limpo">
        <div>
          <h3>Ref. ${item.referencia}</h3>
          <p>${item.descricao || ""}</p>
          <p>${totalPecasItem(item)} peça(s) • ${formatarPeso(pesoItem(item))}</p>
        </div>
        <strong>R$ ${formatarMoeda(subtotal)}</strong>
      </div>
    `;
  });

  if (observacoesEl) {
    const htmlObservacoes = blocoObservacoesPedidoHtml();
    if (htmlObservacoes) {
      observacoesEl.innerHTML = htmlObservacoes;
      observacoesEl.classList.remove("escondido");
    }
  }

  const totaisResumo = resumoTotaisPedido(totalPedido, fabricaDoCarrinho());
  const badgeResumo = badgeDescontoPedido(totaisResumo);

  totalEl.innerHTML = totaisResumo.temDesconto
    ? `<span class="resumo-total-final">R$ ${formatarMoeda(totaisResumo.totalFinal)} ${badgeResumo}</span><small class="resumo-total-economia">${labelDescontoPedido(totaisResumo)}: -R$ ${formatarMoeda(totaisResumo.valorDesconto)}</small>`
    : `R$ ${formatarMoeda(totaisResumo.totalFinal)}`;
  modal.classList.remove("escondido");
  modal.setAttribute("aria-hidden", "false");
}

function fecharResumoPedido() {
  const modal = document.getElementById("modal-resumo");
  if (!modal) return;

  modal.classList.add("escondido");
  modal.setAttribute("aria-hidden", "true");
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

function montarCorpoEmailPedido(numeroPedido, dadosCliente) {
  const subtotal = valorSubtotalPedido();
  const fabrica = fabricaDoCarrinho();
  const descontoPercentual = percentualDescontoPedido(subtotal, fabrica);
  const descontoValor = valorDescontoPedido(subtotal, fabrica);
  const totalFinal = valorTotalComDesconto(subtotal, fabrica);
  const detalhesCliente = montarTextoDetalhesClienteEmail();

  const blocos = [
    `NOVO PEDIDO - CATÁLOGO ONLINE`,
    `Número do pedido: ${numeroPedido}`,
    `Data: ${new Date().toLocaleString("pt-BR")}`,
    `Fábrica: ${nomeFabrica(fabrica)}`,
    "",
    montarTextoDadosClienteEmail(dadosCliente),
    ""
  ];

  if (detalhesCliente) {
    blocos.push("--------------------------------");
    blocos.push(detalhesCliente);
    blocos.push("");
  }

  blocos.push("--------------------------------");
  blocos.push(montarTextoItensPedidoEmail());
  blocos.push("");
  blocos.push("--------------------------------");
  blocos.push("RESUMO FINANCEIRO");
  blocos.push("");
  blocos.push(`Total de referências: ${carrinho.length}`);
  blocos.push(`Total de peças: ${totalPecasPedido()}`);
  blocos.push(`Subtotal estimado: R$ ${formatarMoeda(subtotal)}`);

  if (descontoPercentual > 0) {
    blocos.push(`Desconto (${descontoPercentual}%): - R$ ${formatarMoeda(descontoValor)}`);
  }

  blocos.push(`Total estimado: R$ ${formatarMoeda(totalFinal)}`);

  return blocos.join("\n");
}


// ===============================
// BACKUP LOCAL, CSV E WHATSAPP
// ===============================
// WhatsApp no aparelho do cliente fica DESATIVADO por padrão.
// Envio automático real para seu WhatsApp deve ser feito no servidor via WhatsApp Cloud API/provedor, não redirecionando o cliente.
// Se algum dia quiser reativar abertura no cliente, coloque ABRIR_WHATSAPP_CLIENTE_AUTOMATICAMENTE = true.
const WHATSAPP_DESTINO_PEDIDO = "5511944469755";
const ABRIR_WHATSAPP_CLIENTE_AUTOMATICAMENTE = false;
const BACKUP_PEDIDOS_LOCAL_KEY = "pedidosCatalogoBackupV2";
const ULTIMO_PEDIDO_LOCAL_KEY = "ultimoPedidoCatalogoBackupV2";
const LIMITE_PEDIDOS_BACKUP_LOCAL = 25;
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
    const registro = {
      numeroPedido: payload?.numeroPedido || "",
      status: status || "GERADO_LOCALMENTE",
      erro: erro || "",
      salvoEm: new Date().toISOString(),
      payload
    };

    localStorage.setItem(ULTIMO_PEDIDO_LOCAL_KEY, JSON.stringify(registro));

    const listaAtual = JSON.parse(localStorage.getItem(BACKUP_PEDIDOS_LOCAL_KEY) || "[]");
    const listaFiltrada = Array.isArray(listaAtual)
      ? listaAtual.filter(item => item && item.numeroPedido !== registro.numeroPedido)
      : [];

    listaFiltrada.unshift(registro);
    localStorage.setItem(BACKUP_PEDIDOS_LOCAL_KEY, JSON.stringify(listaFiltrada.slice(0, LIMITE_PEDIDOS_BACKUP_LOCAL)));
  } catch (erroLocalStorage) {
    console.warn("Não foi possível salvar backup local do pedido:", erroLocalStorage);
  }
}

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
  if (!form || document.getElementById("cliente-cep")) return;

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

  if (campoEntrega) {
    form.insertBefore(blocoEndereco, campoEntrega);
  } else {
    form.appendChild(blocoEndereco);
  }

  const cepInput = document.getElementById("cliente-cep");
  if (cepInput) {
    cepInput.addEventListener("input", () => {
      cepInput.value = formatarCep(cepInput.value);
    });

    cepInput.addEventListener("blur", buscarEnderecoClientePorCep);
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

  modal.classList.remove("escondido");
  modal.setAttribute("aria-hidden", "false");

  const primeiroCampo = document.getElementById("cliente-nome");
  if (primeiroCampo) setTimeout(() => primeiroCampo.focus(), 80);
}

function fecharDadosClientePedido() {
  const modal = document.getElementById("modal-dados-cliente");
  if (!modal) return;

  modal.classList.add("escondido");
  modal.setAttribute("aria-hidden", "true");
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

  let valido = true;

  Object.entries(campos).forEach(([chave, campo]) => {
    if (!campo) return;
    if (!dados[chave]) {
      campo.classList.add("erro");
      valido = false;
    }
  });

  if (!valido) {
    const status = document.getElementById("status-dados-cliente");
    if (status) {
      status.innerText = "Preencha os dados obrigatórios do cliente e endereço.";
      status.className = "status-envio-pedido erro";
    }
    return null;
  }

  return dados;
}

function gerarNumeroPedido() {
  const agora = new Date();
  const data = agora.toISOString().slice(0, 10).replace(/-/g, "");
  const hora = String(agora.getHours()).padStart(2, "0") + String(agora.getMinutes()).padStart(2, "0") + String(agora.getSeconds()).padStart(2, "0");
  const sufixo = Math.floor(Math.random() * 900 + 100);

  return `PED-${data}-${hora}-${sufixo}`;
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

async function enviarPedidoComDadosCliente() {
  if (!pedidoPodeSerEnviado()) return;

  const dadosCliente = coletarDadosClientePedido();
  if (!dadosCliente) return;

  const botao = document.getElementById("botao-enviar-dados-cliente");
  const status = document.getElementById("status-dados-cliente");
  const numeroPedido = gerarNumeroPedido();

  if (botao) {
    botao.disabled = true;
    botao.innerText = "Preparando segurança...";
  }

  if (status) {
    status.innerText = "Gerando backup local e planilha do pedido...";
    status.className = "status-envio-pedido carregando";
  }

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

  // Camada de segurança independente do servidor:
  // 1) salva no navegador, 2) baixa CSV local.
  // Não abre WhatsApp no aparelho do cliente por padrão.
  gerarSaidasLocaisDeSeguranca(payload);

  if (status) {
    status.innerText = "Backup criado. Encaminhando pedido para processamento...";
    status.className = "status-envio-pedido carregando";
  }

  if (botao) {
    botao.innerText = "Enviando ao sistema...";
  }

  try {
    await fetch(URL_APPS_SCRIPT_PEDIDO, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    atualizarBackupLocalPedido(
      numeroPedido,
      "ENCAMINHADO_PARA_PROCESSAMENTO",
      "O navegador usa no-cors com Apps Script; a resposta final do servidor não é legível pelo front."
    );

    if (status) {
      status.innerText = "Pedido finalizado. A planilha foi baixada e o pedido foi encaminhado para análise.";
      status.className = "status-envio-pedido sucesso";
    }

    carrinho = [];
    salvarCarrinho();
    renderizarCarrinho();

    fecharDadosClientePedido();
    fecharResumoPedido();
    mostrarAvisoSucessoPedido(numeroPedido);

    if (botao) {
      botao.disabled = false;
      botao.innerText = "Enviar pedido";
    }

  } catch (erro) {
    console.error("Erro ao encaminhar pedido:", erro);

    atualizarBackupLocalPedido(numeroPedido, "ERRO_ENVIO_SERVIDOR", String(erro));

    if (status) {
      status.innerText = "Pedido salvo no dispositivo e CSV baixado. Não consegui encaminhar ao sistema agora; tente novamente antes de fechar esta tela.";
      status.className = "status-envio-pedido erro";
    }

    if (botao) {
      botao.disabled = false;
      botao.innerText = "Tentar enviar novamente";
    }
  }
}


// Mantém o estado visual dos filtros de preço sincronizado após carregamentos parciais/cache.
window.addEventListener("DOMContentLoaded", atualizarBotoesFiltroPreco);

window.addEventListener("click", (evento) => {
  const menuWrap = evento.target.closest && evento.target.closest(".menu-topo-wrap");
  if (!menuWrap) {
    document.body.classList.remove("menu-topo-aberto");
    const botaoMenu = document.querySelector(".btn-menu-topo");
    if (botaoMenu) botaoMenu.setAttribute("aria-expanded", "false");
  }
});

/* ======================================================================
   HBJOIAS - V6: trava de rolagem mobile para carrinho, popup e modais.
   Objetivo: impedir que o fundo da página mexa ao tocar/arrastar em áreas
   vazias entre itens no carrinho ou na seleção de numeração.
   ====================================================================== */
(function hbJoiasTravaRolagemMobileV6() {
  let yTravadoV6 = 0;
  const classesBloqueioV6 = ["carrinho-aberto", "popup-aberto", "modal-aberto", "hb-overlay-mobile-lock"];

  function mobileV6() {
    return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
  }

  function existeOverlayAbertoV6() {
    const popup = document.getElementById("popup");
    const carrinho = document.getElementById("area-carrinho");
    const modalResumo = document.getElementById("modal-resumo");
    const modalDados = document.getElementById("modal-dados-cliente");

    return Boolean(
      (popup && !popup.classList.contains("escondido")) ||
      (carrinho && !carrinho.classList.contains("carrinho-fechado")) ||
      (modalResumo && !modalResumo.classList.contains("escondido")) ||
      (modalDados && !modalDados.classList.contains("escondido"))
    );
  }

  function travarV6() {
    if (!mobileV6()) return;
    if (document.documentElement.classList.contains("hb-overlay-mobile-lock")) return;

    yTravadoV6 = window.scrollY || document.documentElement.scrollTop || 0;
    document.documentElement.classList.add("hb-overlay-mobile-lock");
    document.body.classList.add("hb-overlay-mobile-lock");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    // Não sobrescreve o controle antigo do carrinho se ele já estiver fixando o body.
    if (!document.body.classList.contains("carrinho-mobile-bloqueado")) {
      document.body.style.position = "fixed";
      document.body.style.top = `-${yTravadoV6}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }
  }

  function liberarV6() {
    if (existeOverlayAbertoV6()) return;

    const estavaTravado = document.documentElement.classList.contains("hb-overlay-mobile-lock");
    document.documentElement.classList.remove("hb-overlay-mobile-lock");
    document.body.classList.remove("hb-overlay-mobile-lock", "popup-aberto", "modal-aberto");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";

    if (estavaTravado && !document.body.classList.contains("carrinho-mobile-bloqueado")) {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, yTravadoV6 || 0);
    }
  }

  function alvoComRolagemPermitidaV6(alvo) {
    if (!alvo || !alvo.closest) return null;
    return alvo.closest(
      ".lista-carrinho-scroll, #numeracoes, .popup-selecao-numeracoes, .modal-resumo-conteudo, .modal-dados-cliente-conteudo, .lista-carrinho-scroll *"
    );
  }

  function podeRolarInternamenteV6(container, deltaY) {
    if (!container) return false;
    const el = container.closest && container.closest(".lista-carrinho-scroll, #numeracoes, .popup-selecao-numeracoes, .modal-resumo-conteudo, .modal-dados-cliente-conteudo") || container;
    if (!el || el.scrollHeight <= el.clientHeight + 1) return false;

    if (deltaY < 0 && el.scrollTop <= 0) return false;
    if (deltaY > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) return false;
    return true;
  }

  let toqueYV6 = 0;
  document.addEventListener("touchstart", function (event) {
    if (!mobileV6()) return;
    if (!existeOverlayAbertoV6()) return;
    toqueYV6 = event.touches && event.touches[0] ? event.touches[0].clientY : 0;
  }, { passive: true });

  document.addEventListener("touchmove", function (event) {
    if (!mobileV6()) return;
    if (!existeOverlayAbertoV6()) return;

    const toqueAtual = event.touches && event.touches[0] ? event.touches[0].clientY : toqueYV6;
    const deltaY = toqueYV6 - toqueAtual;
    const alvoScroll = alvoComRolagemPermitidaV6(event.target);

    if (alvoScroll && podeRolarInternamenteV6(alvoScroll, deltaY)) {
      return;
    }

    event.preventDefault();
  }, { passive: false });

  function envolverFuncaoV6(nome, antes, depois) {
    const original = window[nome];
    if (typeof original !== "function" || original.__hbV6Wrapped) return;

    const novaFuncao = function () {
      if (typeof antes === "function") antes.apply(this, arguments);
      const retorno = original.apply(this, arguments);
      if (typeof depois === "function") depois.apply(this, arguments);
      return retorno;
    };

    novaFuncao.__hbV6Wrapped = true;
    window[nome] = novaFuncao;
  }

  envolverFuncaoV6("abrirPopup", null, function () {
    document.body.classList.add("popup-aberto");
    travarV6();
  });

  envolverFuncaoV6("fecharPopup", null, function () {
    document.body.classList.remove("popup-aberto");
    setTimeout(liberarV6, 20);
  });

  envolverFuncaoV6("abrirResumoPedido", null, function () {
    document.body.classList.add("modal-aberto");
    travarV6();
  });

  envolverFuncaoV6("fecharResumoPedido", null, function () {
    const modalDados = document.getElementById("modal-dados-cliente");
    if (!modalDados || modalDados.classList.contains("escondido")) {
      document.body.classList.remove("modal-aberto");
    }
    setTimeout(liberarV6, 20);
  });

  envolverFuncaoV6("abrirDadosClientePedido", null, function () {
    document.body.classList.add("modal-aberto");
    travarV6();
  });

  envolverFuncaoV6("fecharDadosClientePedido", null, function () {
    document.body.classList.remove("modal-aberto");
    setTimeout(liberarV6, 20);
  });

  // Complementa o carrinho já existente sem brigar com a trava antiga.
  envolverFuncaoV6("alternarCarrinho", null, function () {
    const carrinho = document.getElementById("area-carrinho");
    const aberto = carrinho && !carrinho.classList.contains("carrinho-fechado");
    if (aberto) {
      travarV6();
    } else {
      setTimeout(liberarV6, 20);
    }
  });

  envolverFuncaoV6("fecharCarrinho", null, function () {
    setTimeout(liberarV6, 20);
  });

  window.addEventListener("resize", function () {
    if (!mobileV6()) liberarV6();
  });
})();


/* =======================================================================
   Cupom — visual novo isolado; lógica comercial preservada
   ======================================================================= */
function sincronizarEstadoCupomMobile() {
  // Mantido por compatibilidade com a lógica antiga. O visual novo é renderizado em #hb-cupom-root.
}

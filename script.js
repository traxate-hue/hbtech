let fabricaAtual = "";
let categoriaAtual = "todos";
let buscaAtual = "";
let filtroPrecoAtual = "todos";
let produtoAtual = null;
let carrinho = [];
let paginaAtualProdutos = 1;
const PRODUTOS_POR_PAGINA = 24;
let produtosFiltradosAtuais = [];

const NUMERACOES_ANEIS = [12, 14, 16, 18, 20, 22, 24, 26];

// Ajuste este valor quando o preço por grama mudar.
const COEFICIENTE_GRAMA = 18.50;

function entrar(fabrica) {
  window.location.href = "catalogo.html?fabrica=" + fabrica + "&categoria=todos";
}

function irParaCategoria(categoria) {
  window.location.href = `catalogo.html?fabrica=${fabricaAtual}&categoria=${categoria}`;
}

function trocarFabrica() {
  window.location.href = "index.html";
}


function atualizarBusca(valor) {
  buscaAtual = normalizarTexto(valor);
  paginaAtualProdutos = 1;
  carregarProdutos();
}

function atualizarFiltroPreco(filtro) {
  filtroPrecoAtual = filtro || "todos";
  paginaAtualProdutos = 1;
  atualizarBotoesFiltroPreco();
  carregarProdutos();
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
  localStorage.setItem("carrinhoCatalogo", JSON.stringify(carrinho));
}

function carregarCarrinho() {
  const salvo = localStorage.getItem("carrinhoCatalogo");

  if (salvo) {
    try {
      carrinho = JSON.parse(salvo) || [];
      carrinho = carrinho.filter(item => item && item.referencia && item.fabrica);
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
  if (fabrica === "tendenze") return "TENDENZE";
  if (fabrica === "zarrara") return "ZARRARA";
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
  if (fabrica === "tendenze") return 6;
  if (fabrica === "zarrara") return 10;
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

function valorUnitarioProduto(produtoOuItem) {
  return pesoNumerico(produtoOuItem.peso) * COEFICIENTE_GRAMA;
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
  return cat === "anel" || cat === "aneis" || cat === "anéis";
}

function pastaCategoria(categoria) {
  const cat = categoriaChave(categoria);

  const mapa = {
    "anel": "aneis",
    "aneis": "aneis",
    "brinco": "brincos",
    "brincos": "brincos",
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








function carregarProdutos() {
  const container = document.getElementById("produtos");
  if (!container) return;

  container.innerHTML = "";

  produtosFiltradosAtuais = produtos
    .filter(produto => produto.fabrica === fabricaAtual)
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

  const totalPaginas = Math.max(1, Math.ceil(produtosFiltradosAtuais.length / PRODUTOS_POR_PAGINA));

  if (paginaAtualProdutos > totalPaginas) paginaAtualProdutos = totalPaginas;
  if (paginaAtualProdutos < 1) paginaAtualProdutos = 1;

  const inicio = (paginaAtualProdutos - 1) * PRODUTOS_POR_PAGINA;
  const fim = inicio + PRODUTOS_POR_PAGINA;
  const produtosParaMostrar = produtosFiltradosAtuais.slice(inicio, fim);

  produtosParaMostrar.forEach(produto => {
    const refJson = JSON.stringify(produto.referencia);
    const inputId = `qtd-${referenciaSegura(produto.referencia)}`;
    const altImagem = `Referência ${produto.referencia}`;

    const imagemSrcJson = JSON.stringify(produto.imagem || "");
    const imagemAltJson = JSON.stringify(altImagem);

    const imagemHtml = produto.imagem
      ? `<img src="${produto.imagem}" alt="${altImagem}" loading="lazy" onclick='abrirZoomImagem(${imagemSrcJson}, ${imagemAltJson})'>`
      : `<span>Sem imagem</span>`;

    const infoHtml = `
      <div class="imagem-produto">${imagemHtml}</div>
      <div class="info-produto">
        <p class="ref-produto">Ref. ${produto.referencia}</p>
        <p class="peso-produto">Peso: ${produto.peso || "-"}</p>
        <p class="valor-produto">Valor estimado: R$ ${formatarMoeda(valorUnitarioProduto(produto))}</p>
        <p class="descricao-produto">${produto.descricao || ""}</p>
        <p class="minimo-produto">Mínimo: ${minimoPorFabrica(produto.fabrica)} peças</p>
      </div>
    `;

    if (ehCategoriaAnel(produto.categoria)) {
      container.innerHTML += `
        <div class="produto">
          ${infoHtml}
          <button onclick='abrirPopup(${refJson})'>Ver numerações</button>
        </div>
      `;
    } else {
      container.innerHTML += `
        <div class="produto">
          ${infoHtml}
          <input type="number" id="${inputId}" min="0" placeholder="Quantidade">
          <button onclick='adicionarProdutoSimples(${refJson}, this)'>Adicionar</button>
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

  let html = "";

  NUMERACOES_ANEIS.forEach(numero => {
    html += `
      <div class="numero-item">
        <div class="numero-topo">
          <span>Aro</span>
          <strong>${numero}</strong>
        </div>

        <div class="controle-qtd" data-aro="${numero}">
          <button type="button" onclick="alterarQtdAro(${numero}, -5)">-5</button>
          <button type="button" onclick="alterarQtdAro(${numero}, -1)">−</button>
          <input type="number" id="aro-${numero}" min="0" value="0" inputmode="numeric" aria-label="Quantidade do aro ${numero}" oninput="atualizarResumoPopup()">
          <button type="button" onclick="alterarQtdAro(${numero}, 1)">+</button>
          <button type="button" onclick="alterarQtdAro(${numero}, 5)">+5</button>
        </div>
      </div>
    `;
  });

  document.getElementById("numeracoes").innerHTML = html;
  atualizarResumoPopup();
  document.getElementById("popup").classList.remove("escondido");
}

function atualizarResumoPopup() {
  const totalEl = document.getElementById("popup-total-selecionado");
  const totalRodapeEl = document.getElementById("popup-rodape-total");

  let total = 0;
  NUMERACOES_ANEIS.forEach(numero => {
    const input = document.getElementById(`aro-${numero}`);
    total += Number(input?.value || 0);
  });

  const textoTotal = total + (total === 1 ? " peça" : " peças");

  if (totalEl) totalEl.innerText = textoTotal;
  if (totalRodapeEl) totalRodapeEl.innerText = textoTotal;
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


function confirmarPopup() {
  if (!produtoAtual) return;

  const numeracoes = {};
  let totalPecas = 0;

  NUMERACOES_ANEIS.forEach(numero => {
    const valor = Number(document.getElementById(`aro-${numero}`).value) || 0;
    numeracoes[numero] = valor;
    totalPecas += valor;
  });

  const minimoAtual = minimoPorFabrica(produtoAtual.fabrica);

  if (totalPecas < minimoAtual) {
    alert(`Mínimo de ${minimoAtual} peças para esta referência.`);
    return;
  }

  const existente = carrinho.find(item =>
    item.referencia === produtoAtual.referencia &&
    item.fabrica === produtoAtual.fabrica &&
    ehCategoriaAnel(item.categoria)
  );

  if (existente) {
    NUMERACOES_ANEIS.forEach(numero => {
      existente.numeracoes[numero] = (existente.numeracoes[numero] || 0) + (numeracoes[numero] || 0);
    });
  } else {
    carrinho.push({
      referencia: produtoAtual.referencia,
      descricao: produtoAtual.descricao,
      peso: produtoAtual.peso,
      fabrica: produtoAtual.fabrica,
      categoria: produtoAtual.categoria,
      minimo: minimoPorFabrica(produtoAtual.fabrica),
      imagem: produtoAtual.imagem,
      numeracoes: { ...numeracoes }
    });
  }

  animarImagemPopupParaCarrinho();

  const botaoPopup = document.getElementById("botao-confirmar-popup");

  salvarCarrinho();
  renderizarCarrinho();

  if (botaoPopup) {
    const textoOriginal = botaoPopup.innerText;
    botaoPopup.innerText = "✔ Adicionado";
    botaoPopup.classList.add("botao-adicionado");
    botaoPopup.style.animation = "pulseAdd 0.3s ease";

    setTimeout(() => {
      botaoPopup.innerText = textoOriginal;
      botaoPopup.classList.remove("botao-adicionado");
      botaoPopup.style.animation = "";
      fecharPopup();
    }, 800);
  } else {
    fecharPopup();
  }
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

  const existente = carrinho.find(item =>
    item.referencia === produto.referencia &&
    item.fabrica === produto.fabrica &&
    !ehCategoriaAnel(item.categoria)
  );

  if (existente) {
    existente.quantidade += quantidade;
  } else {
    carrinho.push({
      referencia: produto.referencia,
      descricao: produto.descricao,
      peso: produto.peso,
      fabrica: produto.fabrica,
      categoria: produto.categoria,
      minimo: minimoPorFabrica(produto.fabrica),
      imagem: produto.imagem,
      quantidade: quantidade
    });
  }

  input.value = "";
  salvarCarrinho();
  renderizarCarrinho();

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
  if (ehCategoriaAnel(item.categoria)) {
    return Object.values(item.numeracoes || {}).reduce((acc, valor) => acc + Number(valor || 0), 0);
  }

  return Number(item.quantidade || 0);
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

function valorMinimoFabrica(fabrica) {
  if (fabrica === "tendenze") return 5000;
  if (fabrica === "zarrara") return 5000;
  return 0;
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

function mensagemMeta(valorAtual, fabrica) {
  const minimo = valorMinimoFabrica(fabrica);

  if (valorAtual < minimo) {
    return `Faltam R$ ${formatarMoeda(minimo - valorAtual)} para o mínimo`;
  }

  if (valorAtual < 30000) {
    return `Faltam R$ ${formatarMoeda(30000 - valorAtual)} para 5%`;
  }

  if (valorAtual < 75000) {
    return `Faltam R$ ${formatarMoeda(75000 - valorAtual)} para 10%`;
  }

  return "Você atingiu o máximo de desconto 🔥";
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
      <div class="resumo-fabrica">
        <strong>${nomeFabrica(fabCarrinho)}</strong> • ${pecasAtual} peças • ${formatarPeso(pesoAtual)}
        <p><strong>Total estimado:</strong> R$ ${formatarMoeda(valorAtual)}</p>
        <p class="mensagem-meta">${mensagemMeta(valorAtual, fabCarrinho)}</p>
        ${criarBarraMeta("mín", valorAtual, valorMinimoFabrica(fabCarrinho))}
        ${criarBarraMeta("5%", valorAtual, 30000)}
        ${criarBarraMeta("10%", valorAtual, 75000)}
      </div>
    `;
  }

  carrinho.forEach((item, index) => {
    if (ehCategoriaAnel(item.categoria)) {
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
              <p class="item-carrinho-descricao">${item.descricao || ""}</p>
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
              <p class="item-carrinho-descricao">${item.descricao || ""}</p>
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

function animarProdutoVoando(elementoProduto) {
  const img = elementoProduto.querySelector("img");
  if (!img) return;

  const carrinho = document.querySelector(".carrinho");
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

  setTimeout(() => {
    clone.remove();
  }, 700);
}

function animarImagemPopupParaCarrinho() {
  const img = document.getElementById("popup-imagem-produto");
  if (!img || !img.src) return;

  const alvo = document.querySelector(".botao-carrinho-lateral") || document.querySelector(".carrinho");
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

  alvo.classList.add("carrinho-pulso");

  setTimeout(() => {
    clone.remove();
    alvo.classList.remove("carrinho-pulso");
  }, 760);
}

function totalPecasPedido() {
  return carrinho.reduce((acc, item) => acc + totalPecasItem(item), 0);
}

function valorTotalPedido() {
  return carrinho.reduce((acc, item) => acc + valorItem(item), 0);
}

function atualizarBotaoCarrinhoLateral() {
  const botao = document.querySelector(".botao-carrinho-lateral");
  if (!botao) return;

  const referencias = carrinho.length;
  const pecas = totalPecasPedido();
  const valor = valorTotalPedido();

  botao.innerHTML = `
    <span class="icone-carrinho">
      <svg xmlns="http://www.w3.org/2000/svg"
           width="22"
           height="22"
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
    <span class="contador-carrinho" id="contador-carrinho">${pecas}</span>
  `;

  botao.title =
    referencias > 0
      ? `${referencias} referência(s) • ${pecas} peça(s) • R$ ${formatarMoeda(valor)}`
      : "Abrir carrinho";
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

function alternarCarrinho() {
  const areaCarrinho = document.getElementById("area-carrinho");
  const botao = document.querySelector(".botao-carrinho-lateral");

  if (!areaCarrinho || !botao) return;

  areaCarrinho.classList.toggle("carrinho-fechado");
  botao.setAttribute(
    "aria-label",
    areaCarrinho.classList.contains("carrinho-fechado") ? "Abrir carrinho" : "Fechar carrinho"
  );

  atualizarBotaoCarrinhoLateral();
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

window.onload = function () {
  const params = new URLSearchParams(window.location.search);
  const fabrica = params.get("fabrica");
  const categoria = params.get("categoria");

  if (fabrica) {
    fabricaAtual = fabrica === "inove" ? "tendenze" : fabrica;
  }

  if (categoria) {
    categoriaAtual = categoria;
  }

  const titulo = document.getElementById("titulo");
  if (titulo && fabricaAtual) {
    titulo.innerText = nomeFabrica(fabricaAtual);
  }

  const fabricaAtualEl = document.getElementById("fabrica-atual");
  if (fabricaAtualEl && fabricaAtual) {
    fabricaAtualEl.innerText = nomeFabrica(fabricaAtual);
  }

  carregarCarrinho();
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

  carrinho.forEach(item => {
    const valorUnitario = valorUnitarioProduto(item);
    const valorTotal = valorItem(item);

    totalPedido += valorTotal;

    mensagem += "-----------------------------\n";
    mensagem += `REF: ${item.referencia}\n`;
    mensagem += `PESO: ${item.peso || "-"}\n`;
    mensagem += `DESCRICAO: ${item.descricao || "-"}\n`;
    mensagem += `CATEGORIA: ${item.categoria || "-"}\n`;
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

  return mensagem;
}


// ===============================
// ENVIO DO PEDIDO PARA PLANILHA
// ===============================
const URL_APPS_SCRIPT_PEDIDO = "https://script.google.com/macros/s/AKfycbz_6YoIPX8JGBR-LBFYb1PMc-TjCJtVFwxPRQuDwwxvYczWEUlD2JbForsaNF3VPvbRaA/exec";

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
  const status = document.getElementById("status-envio-pedido");
  const botao = document.getElementById("botao-confirmar-pedido");

  if (!modal || !lista || !totalEl) return;

  lista.innerHTML = "";

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

  totalEl.innerText = `R$ ${formatarMoeda(totalPedido)}`;
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

    return {
      fabrica: nomeFabrica(item.fabrica),
      fabricaChave: item.fabrica,
      categoria: item.categoria || "",
      referencia: item.referencia,
      descricao: item.descricao || "",
      peso: item.peso || "",
      quantidade: ehCategoriaAnel(item.categoria) ? undefined : Number(item.quantidade || 0),
      numeracoes: ehCategoriaAnel(item.categoria) ? { ...(item.numeracoes || {}) } : undefined,
      totalPecas,
      valorUnitario,
      subtotal: valorUnitario * totalPecas
    };
  });
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

async function confirmarEnviarPedido() {
  if (!pedidoPodeSerEnviado()) return;

  const botao = document.getElementById("botao-confirmar-pedido");
  const status = document.getElementById("status-envio-pedido");
  const numeroPedido = gerarNumeroPedido();

  if (botao) {
    botao.disabled = true;
    botao.innerText = "Enviando pedido...";
  }

  if (status) {
    status.innerText = "Enviando pedido e criando a planilha...";
    status.className = "status-envio-pedido carregando";
  }

  const payload = {
    origem: "catalogo-online",
    numeroPedido,
    dataPedido: new Date().toISOString(),
    fabrica: nomeFabrica(fabricaDoCarrinho()),
    totalPecas: totalPecasPedido(),
    totalEstimado: valorTotalPedido(),
    pedido: montarPedidoParaEnvio()
  };

  try {
    await fetch(URL_APPS_SCRIPT_PEDIDO, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    if (status) {
      status.innerText = "Pedido enviado com sucesso!";
      status.className = "status-envio-pedido sucesso";
    }

    carrinho = [];
    salvarCarrinho();
    renderizarCarrinho();

    fecharResumoPedido();
    mostrarAvisoSucessoPedido(numeroPedido);

    if (botao) {
      botao.disabled = false;
      botao.innerText = "Confirmar e enviar pedido";
    }

  } catch (erro) {
    console.error("Erro ao enviar pedido:", erro);

    if (status) {
      status.innerText = "Não foi possível enviar agora. Confira sua conexão e tente novamente.";
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

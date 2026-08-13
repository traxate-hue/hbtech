# HB Joias — pacote P11

Substitua no site os arquivos deste pacote pelos arquivos de mesmo nome. As referências de cache já foram atualizadas para `P11_20260812`.

## Alterações desta rodada

- Tipografia das páginas Sobre, Como Comprar e Contato trocada por Manrope, com títulos, números e cards em tamanhos menores.
- Cartão do WhatsApp ajustado para manter o número em uma linha.
- Tendenze corrigida: removida toda referência a tecnologia 3D; agora o texto informa o processo de impressão da peça.
- Inove corrigida: agora o texto informa o sistema de fundição.
- Cartão visual “Em breve” recolocado no carrossel da página inicial, sem link nem comportamento de botão.
- Botão “Escolher uma fábrica e iniciar pedido” removido do topo da página inicial.
- Nova seção de benefícios do catálogo na página inicial, destacando busca por palavras-chave, filtro de preço e organização do pedido.
- Aviso “Valores estimados e conferência comercial” centralizado no catálogo em desktop e mobile.
- Cupom tornado genérico antes da validação: o site não antecipa desconto ou mínimo.
- Depois de aplicar, o carrinho mostra somente os benefícios devolvidos para aquele código.
- Cupons com apenas desconto, apenas mínimo ou benefício em texto agora são aceitos sem presumir R$ 10.000 ou 5%.
- Erros internos do Apps Script deixam de aparecer para o cliente; o site mostra uma mensagem comercial de indisponibilidade.
- Textos da página Como Comprar ajustados para explicar que cada cupom pode ter condições diferentes.

## Atenção: permissão do Apps Script

A mensagem `Você não tem permissão para acessar o documento solicitado` nasce no Apps Script, dentro de `obterOuCriarAba`. O pacote recebido não contém o arquivo `.gs`, então o site consegue proteger a experiência do cliente, mas a consulta de cupons só voltará a funcionar após corrigir o acesso à planilha no projeto do Google.

No projeto que publica a URL usada em `URL_APPS_SCRIPT_PEDIDO`:

1. confira se o ID da planilha aponta para o arquivo correto;
2. dê permissão de Editor da planilha à conta proprietária da implantação;
3. execute `obterOuCriarAba` manualmente no editor e conclua a autorização solicitada;
4. implante novamente como aplicativo da web, executando como a conta proprietária;
5. confirme o nível de acesso necessário para os compradores e atualize a URL no `script.js` se a nova implantação gerar outro endereço.

Para uma correção direta no back-end, envie também o arquivo `Código.gs`/projeto do Apps Script.

## Itens mantidos para uma fase futura

- seletor de teor/banho com comparação de preços;
- criação de link de pagamento.

## Validação realizada

- JavaScript validado sem erro de sintaxe;
- páginas verificadas em 1440 × 900 e 375 × 812;
- sem overflow horizontal nas cinco páginas testadas;
- aviso comercial centralizado em desktop e mobile;
- cupom testado com quatro cenários: 5% + mínimo, benefício em texto, desconto sem mínimo especial e falha de permissão;
- nenhum benefício de cupom aparece antes da validação.

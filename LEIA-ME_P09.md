# HB Joias — arquivos modificados P09

Data: 11/08/2026

Este pacote contém somente os arquivos alterados na revisão. O arquivo RAR recebido foi preservado sem alterações.

## Arquivos do pacote

- `index.html`
- `index.css`
- `sobre.html`
- `como-comprar.html`
- `contato.html`
- `institucional.css`
- `catalogo.html`
- `catalogo.css`
- `script.js`

## Como publicar

1. Faça uma cópia de segurança da versão atualmente publicada.
2. Substitua no servidor somente os nove arquivos listados acima, mantendo a mesma estrutura de pastas e nomes.
3. Não apague os arquivos de produtos, imagens ou outras dependências já existentes no servidor.
4. Limpe o cache da hospedagem/CDN, se houver, e teste o site em uma janela anônima.

## Principais correções

- Posicionamento B2B mais claro: prata e semijoias para compradores com CNPJ, atacadistas, revendedores e distribuidores.
- Fluxo comercial explicado de forma consistente: a solicitação é enviada, a HB confere e confirma, a fábrica prepara, a HB fatura e cobra, o cliente paga e a fábrica libera e envia.
- Avisos claros de que o envio não confirma o pedido e não gera cobrança automática.
- Formas de pagamento informadas: Pix, boleto e cartão.
- Página Sobre reestruturada com papéis da HB, das fábricas e do comprador.
- Página Como Comprar ampliada com etapas, mínimos, prazos e FAQ comercial.
- Página Contato ampliada com função de cada canal, telefone do representante e horário de atendimento.
- Benefícios do cupom exibidos em conjunto: 5% de desconto e pedido mínimo reduzido para R$ 10.000.
- Revisões de acessibilidade, foco em modais, semântica, áreas de toque e responsividade.
- Mensagens de erro e sucesso do catálogo mais claras.
- Cópia do pedido disponível para download somente quando o comprador solicitar; dados do formulário não são mantidos automaticamente em backup local.
- Metadados, títulos e descrições revisados.

## Validação realizada

- Sintaxe JavaScript validada.
- HTML verificado sem erros de análise e sem IDs duplicados.
- Fluxo do catálogo testado em 1440 × 900 e 375 × 812.
- Cupom testado com os dois benefícios, inclusive persistência após recarregar.
- Carrinho, resumo, formulário e confirmação testados em desktop e mobile.
- Auditoria automática WCAG A/AA sem violações nas telas testadas.
- Sem rolagem horizontal indevida nas telas testadas.

Os testes do catálogo usaram produtos simulados porque os arquivos `produtos-tendenze.js`, `produtos-inove.js` e `produtos-zarrara.js` não estavam no RAR recebido. Esses arquivos não fazem parte deste pacote e devem ser mantidos no servidor.

## Pendência de servidor

O código do endpoint/Apps Script que recebe o pedido não estava no material recebido. Por isso, ainda é necessário confirmar no servidor que preços, mínimos, cupom, desconto e destinatários são recalculados e validados de forma independente do navegador. A interface foi ajustada para tratar valores como estimativas e para falhar com segurança quando a validação do cupom não retorna dados comerciais completos, mas a validação definitiva deve existir também no backend.

# HB Joias — pacote P12

Substitua os arquivos do site pelos arquivos de mesmo nome deste pacote. Esta versão inclui todas as correções anteriores da P11 e as alterações abaixo.

## Correções da P12

### Carrossel de fábricas no desktop

- bloqueado o arraste nativo dos links e textos dos cards;
- o carrossel passa a capturar o ponteiro somente depois de um movimento real;
- durante o arraste, a rolagem deixa de usar animação suave para acompanhar o mouse corretamente;
- ao soltar, o carrossel encaixa no card mais próximo;
- o clique normal continua abrindo o catálogo da fábrica;
- setas, teclado e swipe mobile permanecem funcionando.

### Intenção de pagamento

- nova seção no último formulário do pedido;
- escolha obrigatória entre Pix, boleto e cartão;
- aviso explícito de que a escolha não gera cobrança automática;
- a HB ainda confirma a forma de pagamento no contato comercial;
- a cobrança continua acontecendo somente quando o pedido estiver pronto;
- a intenção escolhida é incluída no payload, no texto comercial, no CSV e na saída de WhatsApp;
- a página Como Comprar foi atualizada para refletir esse fluxo.

## Validação realizada

- arraste desktop moveu o carrossel de `0` para `446 px` no teste automatizado;
- o arraste não abriu nenhum catálogo;
- o clique normal continuou abrindo a Tendenze;
- envio bloqueado quando a intenção de pagamento não foi escolhida;
- Pix coletado corretamente em desktop e mobile;
- intenção presente no payload, texto de e-mail, CSV e WhatsApp;
- formulário e páginas sem overflow horizontal em 1440 × 900 e 375 × 812;
- JavaScript validado sem erro de sintaxe.

## Pendências confirmadas

### Precisa corrigir

1. **Apps Script dos cupons:** a conta que executa a implantação não tem acesso ao documento usado por `obterOuCriarAba`. É necessário corrigir a permissão da planilha e reimplantar o aplicativo da web.
2. **Validação no servidor:** o Apps Script deve recalcular preços, mínimo, desconto e total, além de revalidar o cupom. Não deve confiar nos valores enviados pelo navegador.
3. **Registro da intenção de pagamento no back-end:** o front-end já envia `intencaoPagamento` e `formaPagamentoPretendida`. Quando o `Código.gs` for fornecido, deve-se confirmar a gravação desses campos na planilha e no e-mail.
4. **Pacote de produção:** confirmar que `produtos-tendenze.js`, `produtos-inove.js`, `produtos-zarrara.js` e as pastas de imagens estão presentes no deploy final.

### Próxima fase já decidida

- seletor de teor/banho com atualização do valor;
- geração de link de pagamento somente após preparação e conferência do valor final.

### Melhoria técnica não bloqueante

- refatorar gradualmente o `catalogo.css`, que ainda acumula muitas regras antigas e `!important`;
- adicionar dados empresariais reais, política de privacidade, canonical, sitemap e `robots.txt` quando as informações comerciais forem fornecidas.

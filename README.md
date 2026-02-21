# @forkzz/mercadopago

> O SDK não-oficial do Mercado Pago feito para quem quer produtividade, tipagem forte e zero dor de cabeça.

Totalmente escrito em TypeScript, leve, modular e pensado para ambientes modernos como Node.js (ESM/CJS) e Bun.

Se você já sofreu com SDK pesado, tipagem fraca ou dependências desnecessárias… essa lib é pra você.


---

# Por que usar essa biblioteca?

## 100% Type-Safe

Autocomplete real para todos os campos da API.
Menos erros em runtime, mais confiança no desenvolvimento.

## Modular

Importe apenas o que for usar.
Nada de instalar meio mundo de dependências à toa.

# Moderna

Compatível com:

• Node.js (ESM e CommonJS)

• Bun

• Projetos TypeScript-first


##  Minimalista

Sem dependências pesadas.

---

# Instalação

```
npm install @forkzz/mercadopago
```

ou

```
pnpm add @forkzz/mercadopago
```

---

# Guia de Uso

## Inicializando o Cliente

```
import { Client } from '@forkzz/mercadopago';

const client = new Client('APP-USR-XXXXXXXX');
```

Pronto. Agora você já pode interagir com a API.


---

# 1. Checkout Pro (Link de Pagamento)

- Ideal quando você quer que o Mercado Pago gerencie toda a página de pagamento.

## Criando um pedido:

```
const order = await client.orders.create({
  body: {
    items: [
      {
        title: 'Produto Incrível',
        quantity: 1,
        unit_price: 49.90
      }
    ]
  }
});

console.log('Link para pagamento:', order.initPoint);
```

## O que acontece aqui?

Você cria uma ordem

Recebe uma URL (initPoint)

Redireciona o usuário para concluir o pagamento


Simples assim.


---

# Checkout Transparente (PIX ou Cartão)

Use quando quiser processar pagamentos diretamente na sua aplicação.

## Pagamento via PIX

```
const payment = await client.payments.generate({
  body: {
    transaction_amount: 100,
    description: 'Venda via API',
    payment_method_id: 'pix',
    payer: { email: 'cliente@email.com' }
  }
});
```

Você receberá os dados necessários para exibir o QR Code ou copiar/colar do PIX.


---

# Pagamento com Cartão de Crédito

## IMPORTANTE — PCI Compliance

Você não deve enviar dados sensíveis do cartão para o seu backend.

Para isso, utilize nossa biblioteca frontend:

## @forkzz/card-mercadopago

# `🔄 ` Fluxo recomendado:

`1️⃣` Frontend

Use @forkzz/card-mercadopago para:

Capturar dados do cartão

Gerar um card_token


`2️⃣` Backend

Envie o card_token para sua API e finalize o pagamento:

```
const payment = await client.payments.generate({
  body: {
    transaction_amount: 100,
    description: 'Venda via API',
    payment_method_id: 'visa',
    token: 'CARD_TOKEN_GERADO_NO_FRONT',
    payer: { email: 'cliente@email.com' }
  }
});
```

`🔐` Assim você mantém segurança e conformidade.


---

# Estrutura da Biblioteca

A arquitetura foi pensada para ser:

Separada por módulos (orders, payments, etc.)

Fácil de extender

Simples de manter

Clara nos retornos tipados



---

# Contribuindo

Achou um bug?
Quer melhorar algo?

Abra uma Issue ou envie um Pull Request.

Vamos construir juntos a melhor integração com o Mercado Pago da comunidade brasileira `🇧🇷`


---

# Autor

Desenvolvido com carinho por isforkzz
GitHub: https://github.com/isforkzz

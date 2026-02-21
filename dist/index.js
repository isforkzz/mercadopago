"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Client: () => Client,
  MercadoPagoError: () => MercadoPagoError,
  WebhookSignatureError: () => WebhookSignatureError
});
module.exports = __toCommonJS(index_exports);
var import_axios = __toESM(require("axios"));
var import_crypto = require("crypto");
var MercadoPagoError = class extends Error {
  constructor(statusCode, message, raw) {
    super(`[MercadoPago] ${statusCode}: ${message}`);
    this.statusCode = statusCode;
    this.raw = raw;
    this.name = "MercadoPagoError";
  }
};
var WebhookSignatureError = class extends Error {
  constructor() {
    super("[MercadoPago] Assinatura de webhook inv\xE1lida");
    this.name = "WebhookSignatureError";
  }
};
var Client = class {
  constructor(token, options = {}) {
    this.token = token;
    this.payments = {
      /**
       * Cria um pagamento (PIX, cartão, boleto…).
       * @example
       * // PIX
       * const p = await client.payments.generate({ value: 99.90, type: "pix", payer: { email: "a@b.com" } })
       * console.log(p.qrCode)
       *
       * // Cartão parcelado
       * const p = await client.payments.generate({
       *   value: 500, type: "credit_card", cardToken: "tok_xxx", installments: 3,
       *   payer: { email: "a@b.com", identification: { type: "CPF", number: "12345678900" } }
       * })
       */
      generate: async (options = {}) => {
        const {
          value = 0.99,
          type = "pix",
          currency = "BRL",
          description = "Pagamento",
          payer,
          payerEmail,
          externalReference,
          installments = 1,
          cardToken,
          issuerId,
          notificationUrl,
          metadata,
          idempotencyKey
        } = options;
        const resolvedPayer = {
          email: payer?.email ?? payerEmail,
          first_name: payer?.name,
          last_name: payer?.surname,
          identification: payer?.identification,
          ...payer?.phone && {
            phone: { area_code: payer.phone.areaCode, number: payer.phone.number }
          },
          ...payer?.address && {
            address: {
              zip_code: payer.address.zipCode,
              street_name: payer.address.streetName,
              street_number: payer.address.streetNumber,
              neighborhood: payer.address.neighborhood,
              city: payer.address.city,
              federal_unit: payer.address.federalUnit
            }
          }
        };
        const body = {
          transaction_amount: value,
          payment_method_id: type,
          description,
          currency_id: currency,
          installments,
          external_reference: externalReference,
          notification_url: notificationUrl,
          metadata,
          payer: resolvedPayer,
          ...cardToken && { token: cardToken },
          ...issuerId && { issuer_id: issuerId }
        };
        const { data } = await this.http.post("/v1/payments", body, {
          headers: idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}
        });
        return this.parsePayment(data);
      },
      /** Busca um pagamento pelo ID. */
      get: async (paymentId) => {
        const { data } = await this.http.get(`/v1/payments/${paymentId}`);
        return this.parsePayment(data);
      },
      /** Lista pagamentos com filtros e paginação cursor. */
      list: async (filters = {}) => {
        const { data } = await this.http.get("/v1/payments/search", {
          params: {
            status: filters.status,
            payment_method_id: filters.paymentMethodId,
            external_reference: filters.externalReference,
            "range.date_created.from": filters.dateCreatedFrom,
            "range.date_created.to": filters.dateCreatedTo,
            limit: filters.limit ?? 30,
            offset: filters.offset ?? 0
          }
        });
        const results = (data.results ?? []).map(this.parsePayment.bind(this));
        const total = data.paging?.total ?? results.length;
        const limit = data.paging?.limit ?? results.length;
        const offset = data.paging?.offset ?? 0;
        return { results, total, limit, offset, hasMore: offset + results.length < total };
      },
      /** Cancela um pagamento pendente. */
      cancel: async (paymentId) => {
        const { data } = await this.http.put(`/v1/payments/${paymentId}`, {
          status: "cancelled"
        });
        return this.parsePayment(data);
      },
      /**
       * Estorna total ou parcialmente.
       * @example
       * await client.payments.refund({ paymentId: "123" })             // total
       * await client.payments.refund({ paymentId: "123", amount: 50 }) // parcial
       */
      refund: async (options) => {
        const body = options.amount ? { amount: options.amount } : {};
        const { data } = await this.http.post(
          `/v1/payments/${options.paymentId}/refunds`,
          body,
          { headers: options.idempotencyKey ? { "X-Idempotency-Key": options.idempotencyKey } : {} }
        );
        return { id: String(data.id), amount: data.amount, createdAt: data.date_created };
      },
      /** Lista todos os estornos de um pagamento. */
      listRefunds: async (paymentId) => {
        const { data } = await this.http.get(`/v1/payments/${paymentId}/refunds`);
        return (data ?? []).map((r) => ({
          id: String(r.id),
          amount: r.amount,
          createdAt: r.date_created
        }));
      },
      /**
       * Captura um pagamento pré-autorizado (two-step capture).
       * Usado quando o pagamento foi criado com capture: false.
       */
      capture: async (paymentId, amount) => {
        const { data } = await this.http.put(`/v1/payments/${paymentId}`, {
          capture: true,
          ...amount && { transaction_amount: amount }
        });
        return this.parsePayment(data);
      }
    };
    this.customers = {
      /** Cria um cliente. */
      create: async (options) => {
        const { data } = await this.http.post("/v1/customers", {
          email: options.email,
          first_name: options.name,
          last_name: options.surname,
          phone: options.phone ? { area_code: options.phone.areaCode, number: options.phone.number } : void 0,
          identification: options.identification,
          default_address: options.defaultAddress,
          metadata: options.metadata
        });
        return this.parseCustomer(data);
      },
      /** Busca cliente por ID. */
      get: async (customerId) => {
        const { data } = await this.http.get(`/v1/customers/${customerId}`);
        return this.parseCustomer(data);
      },
      /** Busca cliente por email (retorna null se não encontrar). */
      findByEmail: async (email) => {
        const { data } = await this.http.get("/v1/customers/search", {
          params: { email }
        });
        const first = data.results?.[0];
        return first ? this.parseCustomer(first) : null;
      },
      /** Atualiza dados do cliente. */
      update: async (customerId, options) => {
        const { data } = await this.http.put(`/v1/customers/${customerId}`, {
          email: options.email,
          first_name: options.name,
          last_name: options.surname,
          phone: options.phone ? { area_code: options.phone.areaCode, number: options.phone.number } : void 0
        });
        return this.parseCustomer(data);
      },
      /** Remove um cliente. */
      delete: async (customerId) => {
        await this.http.delete(`/v1/customers/${customerId}`);
      },
      cards: {
        /** Salva cartão no cliente via token (gerado pelo SDK JS do MP). */
        add: async (options) => {
          const { data } = await this.http.post(
            `/v1/customers/${options.customerId}/cards`,
            { token: options.token }
          );
          return this.parseCard(data);
        },
        /** Lista cartões salvos do cliente. */
        list: async (customerId) => {
          const { data } = await this.http.get(`/v1/customers/${customerId}/cards`);
          return (data ?? []).map(this.parseCard.bind(this));
        },
        /** Remove um cartão salvo. */
        remove: async (customerId, cardId) => {
          await this.http.delete(`/v1/customers/${customerId}/cards/${cardId}`);
        }
      }
    };
    this.subscriptions = {
      /**
       * Cria uma assinatura recorrente.
       * @example
       * const sub = await client.subscriptions.create({
       *   payerEmail: "user@email.com",
       *   transactionAmount: 29.90,
       *   description: "Plano Pro",
       *   frequency: { type: "months", value: 1 },
       * })
       */
      create: async (options) => {
        const body = {
          payer_email: options.payerEmail,
          reason: options.description,
          external_reference: options.externalReference,
          back_url: options.backUrl,
          auto_recurring: {
            frequency: options.frequency?.value ?? 1,
            frequency_type: options.frequency?.type ?? "months",
            transaction_amount: options.transactionAmount,
            currency_id: options.currency ?? "BRL",
            ...options.repetitions && { repetitions: options.repetitions }
          },
          ...options.planId && { preapproval_plan_id: options.planId },
          ...options.cardTokenId && { card_token_id: options.cardTokenId },
          ...options.customerId && { payer_id: options.customerId }
        };
        const { data } = await this.http.post("/preapproval", body);
        return this.parseSubscription(data);
      },
      /** Busca uma assinatura pelo ID. */
      get: async (subscriptionId) => {
        const { data } = await this.http.get(`/preapproval/${subscriptionId}`);
        return this.parseSubscription(data);
      },
      /** Pausa, reativa ou cancela uma assinatura. */
      updateStatus: async (subscriptionId, status) => {
        const { data } = await this.http.put(`/preapproval/${subscriptionId}`, { status });
        return this.parseSubscription(data);
      },
      /** Lista assinaturas com filtros. */
      list: async (filters) => {
        const { data } = await this.http.get("/preapproval/search", {
          params: {
            status: filters?.status,
            limit: filters?.limit ?? 30,
            offset: filters?.offset ?? 0
          }
        });
        const results = (data.results ?? []).map(this.parseSubscription.bind(this));
        const total = data.paging?.total ?? results.length;
        const offset = filters?.offset ?? 0;
        return { results, total, limit: filters?.limit ?? 30, offset, hasMore: offset + results.length < total };
      }
    };
    this.orders = {
      /**
       * Cria uma preferência de checkout (link de pagamento).
       * @example
       * const order = await client.orders.create({
       *   items: [{ title: "Curso Dev", quantity: 1, unitPrice: 197 }],
       *   backUrls: { success: "https://meusite.com/obrigado" },
       *   autoReturn: "approved",
       * })
       * redirect(order.initPoint)
       */
      create: async (options) => {
        const { data } = await this.http.post("/checkout/preferences", {
          items: options.items.map((i) => ({
            id: i.id,
            title: i.title,
            quantity: i.quantity,
            unit_price: i.unitPrice,
            description: i.description,
            picture_url: i.pictureUrl,
            category_id: i.categoryId,
            currency_id: i.currency ?? "BRL"
          })),
          payer: options.payer ? {
            email: options.payer.email,
            name: options.payer.name,
            surname: options.payer.surname,
            identification: options.payer.identification
          } : void 0,
          external_reference: options.externalReference,
          notification_url: options.notificationUrl,
          back_urls: options.backUrls,
          auto_return: options.autoReturn,
          expires: options.expires,
          expiration_date_from: options.expirationDateFrom,
          expiration_date_to: options.expirationDateTo,
          excluded_payment_methods: options.excludedPaymentMethods?.map((m) => ({ id: m })),
          payment_methods: options.installments ? {
            default_installments: options.installments.default,
            installments: options.installments.max,
            min_installments: options.installments.min
          } : void 0,
          marketplace: options.marketplace,
          marketplace_fee: options.marketplaceFee,
          metadata: options.metadata
        });
        return {
          id: data.id,
          initPoint: data.init_point,
          sandboxInitPoint: data.sandbox_init_point,
          externalReference: data.external_reference,
          items: options.items,
          createdAt: data.date_created
        };
      },
      /** Busca uma preferência de checkout pelo ID. */
      get: async (preferenceId) => {
        const { data } = await this.http.get(`/checkout/preferences/${preferenceId}`);
        return {
          id: data.id,
          initPoint: data.init_point,
          sandboxInitPoint: data.sandbox_init_point,
          externalReference: data.external_reference,
          items: (data.items ?? []).map((i) => ({
            id: i.id,
            title: i.title,
            quantity: i.quantity,
            unitPrice: i.unit_price,
            currency: i.currency_id
          })),
          createdAt: data.date_created
        };
      }
    };
    // ══════════════════════════════════════════════════════════════════════
    //  WEBHOOKS
    // ══════════════════════════════════════════════════════════════════════
    this.webhooks = {
      /**
       * Verifica assinatura HMAC e parseia um evento de webhook do MP.
       *
       * @example
       * // Express
       * app.post("/webhook/mp", express.raw({ type: "*\/*" }), async (req, res) => {
       *   try {
       *     const event = client.webhooks.parse({
       *       rawBody: req.body,
       *       signature: req.headers["x-signature"] as string,
       *       requestId: req.headers["x-request-id"] as string,
       *     })
       *     if (event.topic === "payment") {
       *       const payment = await client.payments.get(event.resourceId)
       *       if (payment.status === "approved") { ... }
       *     }
       *     res.sendStatus(200)
       *   } catch (e) {
       *     if (e instanceof WebhookSignatureError) return res.sendStatus(401)
       *     throw e
       *   }
       * })
       */
      parse: (options) => {
        const { rawBody, signature, requestId, skipVerification } = options;
        if (!skipVerification && this.opts.webhookSecret && signature) {
          this.verifyWebhookSignature(rawBody, signature, requestId);
        }
        const body = typeof rawBody === "string" ? JSON.parse(rawBody) : JSON.parse(rawBody.toString("utf-8"));
        return {
          id: String(body.id ?? ""),
          topic: body.topic ?? body.type,
          resourceId: String(body.data?.id ?? ""),
          resourceUrl: body.resource ?? "",
          action: body.action ?? "",
          apiVersion: body.api_version ?? "v1",
          createdAt: body.date_created ?? (/* @__PURE__ */ new Date()).toISOString(),
          liveMode: body.live_mode ?? false
        };
      },
      /**
       * Resolve o recurso completo de um evento.
       * Atalho para não precisar verificar o topic manualmente.
       */
      resolve: async (event) => {
        if (event.topic === "payment") {
          return this.payments.get(event.resourceId);
        }
        return null;
      }
    };
    // ══════════════════════════════════════════════════════════════════════
    //  INSTALLMENTS (consulta opções de parcelamento)
    // ══════════════════════════════════════════════════════════════════════
    this.installments = {
      /**
       * Retorna opções de parcelamento para um valor e BIN do cartão.
       * O BIN são os 6 primeiros dígitos do cartão.
       *
       * @example
       * const opts = await client.installments.get({ amount: 500, bin: "123456" })
       * opts[0].installments.forEach(i => {
       *   console.log(`${i.installments}x de R$${i.installmentAmount} (${i.rate}% juros)`)
       * })
       */
      get: async (options) => {
        const { data } = await this.http.get("/v1/payment_methods/installments", {
          params: {
            amount: options.amount,
            bin: options.bin,
            currency_id: options.currency ?? "BRL"
          }
        });
        return (data ?? []).map((pm) => ({
          paymentMethodId: pm.payment_method_id,
          paymentTypeName: pm.payment_type_id,
          installments: (pm.payer_costs ?? []).map((pc) => ({
            installments: pc.installments,
            installmentAmount: pc.installment_amount,
            totalAmount: pc.total_amount,
            rate: pc.installment_rate,
            labels: pc.labels ?? []
          }))
        }));
      }
    };
    this.opts = {
      sandbox: false,
      timeout: 1e4,
      retries: 2,
      webhookSecret: "",
      ...options
    };
    this.http = import_axios.default.create({
      baseURL: "https://api.mercadopago.com",
      timeout: this.opts.timeout,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json"
      }
    });
    this.setupInterceptors();
  }
  setupInterceptors() {
    this.http.interceptors.request.use((config) => {
      if (["post", "put", "patch"].includes(config.method ?? "")) {
        config.headers["X-Idempotency-Key"] = config.headers["X-Idempotency-Key"] ?? crypto.randomUUID();
      }
      return config;
    });
    this.http.interceptors.response.use(
      (res) => res,
      async (err) => {
        const config = err.config;
        config._retries = config._retries ?? 0;
        const shouldRetry = config._retries < this.opts.retries && (!err.response || err.response.status >= 500);
        if (shouldRetry) {
          config._retries++;
          await new Promise((r) => setTimeout(r, 300 * config._retries));
          return this.http(config);
        }
        const status = err.response?.status ?? 0;
        const body = err.response?.data;
        const msg = body?.message ?? body?.error ?? body?.cause?.[0]?.description ?? err.message;
        throw new MercadoPagoError(status, msg, body);
      }
    );
  }
  parsePayment(data) {
    const poi = data.point_of_interaction?.transaction_data ?? {};
    const card = data.card;
    const fees = data.fee_details?.[0];
    return {
      id: String(data.id),
      status: data.status,
      statusDetail: data.status_detail ?? "",
      value: data.transaction_amount,
      netAmount: data.transaction_details?.net_received_amount,
      feeAmount: fees?.amount,
      type: data.payment_method_id,
      currency: data.currency_id ?? "BRL",
      description: data.description ?? "",
      installments: data.installments ?? 1,
      createdAt: data.date_created,
      updatedAt: data.date_last_updated ?? data.date_created,
      payer: {
        email: data.payer?.email,
        name: data.payer?.first_name,
        surname: data.payer?.last_name,
        identification: data.payer?.identification
      },
      qrCode: poi.qr_code,
      qrCodeBase64: poi.qr_code_base64,
      pixCopyPaste: poi.qr_code,
      pixExpirationDate: poi.expiration_date,
      ticketUrl: data.ticket_url,
      barcode: data.barcode?.content,
      boletoExpirationDate: data.date_of_expiration,
      lastFourDigits: card?.last_four_digits,
      cardHolder: card?.cardholder?.name,
      externalReference: data.external_reference,
      metadata: data.metadata,
      refunds: (data.refunds ?? []).map((r) => ({
        id: String(r.id),
        amount: r.amount,
        createdAt: r.date_created
      }))
    };
  }
  parseCustomer(data) {
    return {
      id: String(data.id),
      email: data.email,
      name: data.first_name ?? "",
      surname: data.last_name ?? "",
      cards: (data.cards ?? []).map(this.parseCard.bind(this)),
      createdAt: data.date_registered
    };
  }
  parseCard(data) {
    return {
      id: String(data.id),
      lastFourDigits: data.last_four_digits ?? "",
      expirationMonth: data.expiration_month,
      expirationYear: data.expiration_year,
      cardHolder: data.cardholder?.name ?? "",
      paymentMethod: data.payment_method?.id ?? "",
      brand: data.payment_method?.name ?? ""
    };
  }
  parseSubscription(data) {
    const ar = data.auto_recurring;
    return {
      id: String(data.id),
      status: data.status,
      payerEmail: data.payer_email,
      description: data.reason ?? "",
      transactionAmount: ar?.transaction_amount ?? 0,
      currency: ar?.currency_id ?? "BRL",
      nextPaymentDate: data.next_payment_date ?? "",
      createdAt: data.date_created,
      externalReference: data.external_reference
    };
  }
  verifyWebhookSignature(rawBody, signature, requestId) {
    const parts = Object.fromEntries(
      signature.split(",").map((p) => p.split("="))
    );
    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) throw new WebhookSignatureError();
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
    const manifest = `id:${requestId ?? ""};request-id:${requestId ?? ""};ts:${ts};${body}`;
    const expected = (0, import_crypto.createHmac)("sha256", this.opts.webhookSecret).update(manifest).digest("hex");
    if (expected !== v1) throw new WebhookSignatureError();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Client,
  MercadoPagoError,
  WebhookSignatureError
});

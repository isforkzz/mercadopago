import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { createHmac } from "crypto";


export type PaymentType =
  | "pix"
  | "credit_card"
  | "debit_card"
  | "boleto"
  | "account_money"
  | "mercadopago";

export type PaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export type Currency = "BRL" | "USD" | "ARS" | "MXN" | "CLP" | "COP" | "PEN";
export type SubscriptionStatus = "authorized" | "paused" | "cancelled";
export type WebhookTopic =
  | "payment"
  | "plan"
  | "subscription"
  | "invoice"
  | "point_integration_wh"
  | "delivery"
  | "customer";

export interface Payer {
  email?: string;
  name?: string;
  surname?: string;
  identification?: { type: "CPF" | "CNPJ" | "DNI" | "CI"; number: string };
  phone?: { areaCode: string; number: string };
  address?: {
    zipCode: string;
    streetName: string;
    streetNumber: string;
    neighborhood?: string;
    city?: string;
    federalUnit?: string;
  };
}


export interface PaymentOptions {
  value?: number;
  type?: PaymentType;
  currency?: Currency;
  description?: string;
  payer?: Payer;
  /** @deprecated use payer.email */
  payerEmail?: string;
  externalReference?: string;
  installments?: number;
  /** Token gerado pelo SDK JS do MP no frontend */
  cardToken?: string;
  issuerId?: string;
  notificationUrl?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface PaymentResponse {
  id: string;
  status: PaymentStatus;
  statusDetail: string;
  value: number;
  netAmount?: number;
  feeAmount?: number;
  type: PaymentType;
  currency: Currency;
  description: string;
  installments: number;
  createdAt: string;
  updatedAt: string;
  payer: Payer;
  // PIX
  qrCode?: string;
  qrCodeBase64?: string;
  pixCopyPaste?: string;
  pixExpirationDate?: string;
  // Boleto
  ticketUrl?: string;
  barcode?: string;
  boletoExpirationDate?: string;
  // Cartão
  lastFourDigits?: string;
  cardHolder?: string;
  // Geral
  externalReference?: string;
  metadata?: Record<string, unknown>;
  refunds: Array<{ id: string; amount: number; createdAt: string }>;
}

export interface RefundOptions {
  paymentId: string;
  amount?: number;
  idempotencyKey?: string;
}

export interface ListFilters {
  status?: PaymentStatus;
  paymentMethodId?: PaymentType;
  externalReference?: string;
  dateCreatedFrom?: string;
  dateCreatedTo?: string;
  limit?: number;
  offset?: number;
}

export interface PagedResponse<T> {
  results: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}


export interface CustomerOptions {
  email: string;
  name?: string;
  surname?: string;
  phone?: { areaCode: string; number: string };
  identification?: { type: string; number: string };
  defaultAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface CustomerResponse {
  id: string;
  email: string;
  name: string;
  surname: string;
  cards: CardResponse[];
  createdAt: string;
}

export interface CardOptions {
  customerId: string;
  /** Token gerado pelo SDK JS do MP no frontend */
  token: string;
}

export interface CardResponse {
  id: string;
  lastFourDigits: string;
  expirationMonth: number;
  expirationYear: number;
  cardHolder: string;
  paymentMethod: string;
  brand: string;
}


export interface SubscriptionOptions {
  planId?: string;
  payerEmail: string;
  transactionAmount?: number;
  currency?: Currency;
  description?: string;
  cardTokenId?: string;
  customerId?: string;
  backUrl?: string;
  externalReference?: string;
  repetitions?: number;
  frequency?: { type: "days" | "months"; value: number };
}

export interface SubscriptionResponse {
  id: string;
  status: SubscriptionStatus;
  payerEmail: string;
  description: string;
  transactionAmount: number;
  currency: Currency;
  nextPaymentDate: string;
  createdAt: string;
  externalReference?: string;
}


export interface OrderItem {
  id?: string;
  title: string;
  quantity: number;
  unitPrice: number;
  description?: string;
  pictureUrl?: string;
  categoryId?: string;
  currency?: Currency;
}

export interface OrderOptions {
  items: OrderItem[];
  payer?: Payer;
  externalReference?: string;
  notificationUrl?: string;
  expires?: boolean;
  expirationDateFrom?: string;
  expirationDateTo?: string;
  backUrls?: { success?: string; failure?: string; pending?: string };
  autoReturn?: "approved" | "all";
  excludedPaymentMethods?: PaymentType[];
  installments?: { default?: number; min?: number; max?: number };
  marketplace?: string;
  marketplaceFee?: number;
  metadata?: Record<string, unknown>;
}

export interface OrderResponse {
  id: string;
  initPoint: string;
  sandboxInitPoint: string;
  externalReference?: string;
  items: OrderItem[];
  createdAt: string;
}


export interface WebhookEvent {
  id: string;
  topic: WebhookTopic;
  resourceId: string;
  resourceUrl: string;
  action: string;
  apiVersion: string;
  createdAt: string;
  liveMode: boolean;
}

// ── Client Options ────────────────────────────────────────────────────────

export interface ClientOptions {
  sandbox?: boolean;
  timeout?: number;
  retries?: number;
  webhookSecret?: string;
}


export class MercadoPagoError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly raw?: unknown
  ) {
    super(`[MercadoPago] ${statusCode}: ${message}`);
    this.name = "MercadoPagoError";
  }
}

export class WebhookSignatureError extends Error {
  constructor() {
    super("[MercadoPago] Assinatura de webhook inválida");
    this.name = "WebhookSignatureError";
  }
}

export class Client {
  private readonly http: AxiosInstance;
  private readonly opts: Required<ClientOptions>;

  constructor(
    private readonly token: string,
    options: ClientOptions = {}
  ) {
    this.opts = {
      sandbox: false,
      timeout: 10_000,
      retries: 2,
      webhookSecret: "",
      ...options,
    };

    this.http = axios.create({
      baseURL: "https://api.mercadopago.com",
      timeout: this.opts.timeout,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }


  private setupInterceptors() {
    this.http.interceptors.request.use((config) => {
      if (["post", "put", "patch"].includes(config.method ?? "")) {
        config.headers["X-Idempotency-Key"] =
          config.headers["X-Idempotency-Key"] ?? crypto.randomUUID();
      }
      return config;
    });

    // ✅ Retry automático em falha de rede ou 5xx
    this.http.interceptors.response.use(
      (res) => res,
      async (err) => {
        const config = err.config as AxiosRequestConfig & { _retries?: number };
        config._retries = config._retries ?? 0;

        const shouldRetry =
          config._retries < this.opts.retries &&
          (!err.response || err.response.status >= 500);

        if (shouldRetry) {
          config._retries++;
          await new Promise((r) => setTimeout(r, 300 * config._retries!));
          return this.http(config);
        }

        const status = err.response?.status ?? 0;
        const body   = err.response?.data;
        const msg    =
          body?.message ??
          body?.error ??
          body?.cause?.[0]?.description ??
          err.message;

        throw new MercadoPagoError(status, msg, body);
      }
    );
  }

  readonly payments = {
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
    generate: async (options: PaymentOptions = {}): Promise<PaymentResponse> => {
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
        idempotencyKey,
      } = options;

      const resolvedPayer: Record<string, unknown> = {
        email: payer?.email ?? payerEmail,
        first_name: payer?.name,
        last_name: payer?.surname,
        identification: payer?.identification,
        ...(payer?.phone && {
          phone: { area_code: payer.phone.areaCode, number: payer.phone.number },
        }),
        ...(payer?.address && {
          address: {
            zip_code: payer.address.zipCode,
            street_name: payer.address.streetName,
            street_number: payer.address.streetNumber,
            neighborhood: payer.address.neighborhood,
            city: payer.address.city,
            federal_unit: payer.address.federalUnit,
          },
        }),
      };

      const body: Record<string, unknown> = {
        transaction_amount: value,
        payment_method_id: type,
        description,
        currency_id: currency,
        installments,
        external_reference: externalReference,
        notification_url: notificationUrl,
        metadata,
        payer: resolvedPayer,
        ...(cardToken && { token: cardToken }),
        ...(issuerId && { issuer_id: issuerId }),
      };

      const { data } = await this.http.post("/v1/payments", body, {
        headers: idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {},
      });

      return this.parsePayment(data);
    },

    /** Busca um pagamento pelo ID. */
    get: async (paymentId: string): Promise<PaymentResponse> => {
      const { data } = await this.http.get(`/v1/payments/${paymentId}`);
      return this.parsePayment(data);
    },

    /** Lista pagamentos com filtros e paginação cursor. */
    list: async (filters: ListFilters = {}): Promise<PagedResponse<PaymentResponse>> => {
      const { data } = await this.http.get("/v1/payments/search", {
        params: {
          status: filters.status,
          payment_method_id: filters.paymentMethodId,
          external_reference: filters.externalReference,
          "range.date_created.from": filters.dateCreatedFrom,
          "range.date_created.to": filters.dateCreatedTo,
          limit: filters.limit ?? 30,
          offset: filters.offset ?? 0,
        },
      });

      const results = (data.results ?? []).map(this.parsePayment.bind(this));
      const total   = data.paging?.total ?? results.length;
      const limit   = data.paging?.limit ?? results.length;
      const offset  = data.paging?.offset ?? 0;

      return { results, total, limit, offset, hasMore: offset + results.length < total };
    },

    /** Cancela um pagamento pendente. */
    cancel: async (paymentId: string): Promise<PaymentResponse> => {
      const { data } = await this.http.put(`/v1/payments/${paymentId}`, {
        status: "cancelled",
      });
      return this.parsePayment(data);
    },

    /**
     * Estorna total ou parcialmente.
     * @example
     * await client.payments.refund({ paymentId: "123" })             // total
     * await client.payments.refund({ paymentId: "123", amount: 50 }) // parcial
     */
    refund: async (
      options: RefundOptions
    ): Promise<{ id: string; amount: number; createdAt: string }> => {
      const body = options.amount ? { amount: options.amount } : {};
      const { data } = await this.http.post(
        `/v1/payments/${options.paymentId}/refunds`,
        body,
        { headers: options.idempotencyKey ? { "X-Idempotency-Key": options.idempotencyKey } : {} }
      );
      return { id: String(data.id), amount: data.amount, createdAt: data.date_created };
    },

    /** Lista todos os estornos de um pagamento. */
    listRefunds: async (paymentId: string) => {
      const { data } = await this.http.get(`/v1/payments/${paymentId}/refunds`);
      return (data ?? []).map((r: any) => ({
        id: String(r.id),
        amount: r.amount,
        createdAt: r.date_created,
      }));
    },

    /**
     * Captura um pagamento pré-autorizado (two-step capture).
     * Usado quando o pagamento foi criado com capture: false.
     */
    capture: async (paymentId: string, amount?: number): Promise<PaymentResponse> => {
      const { data } = await this.http.put(`/v1/payments/${paymentId}`, {
        capture: true,
        ...(amount && { transaction_amount: amount }),
      });
      return this.parsePayment(data);
    },
  };

  readonly customers = {
    /** Cria um cliente. */
    create: async (options: CustomerOptions): Promise<CustomerResponse> => {
      const { data } = await this.http.post("/v1/customers", {
        email: options.email,
        first_name: options.name,
        last_name: options.surname,
        phone: options.phone
          ? { area_code: options.phone.areaCode, number: options.phone.number }
          : undefined,
        identification: options.identification,
        default_address: options.defaultAddress,
        metadata: options.metadata,
      });
      return this.parseCustomer(data);
    },

    /** Busca cliente por ID. */
    get: async (customerId: string): Promise<CustomerResponse> => {
      const { data } = await this.http.get(`/v1/customers/${customerId}`);
      return this.parseCustomer(data);
    },

    /** Busca cliente por email (retorna null se não encontrar). */
    findByEmail: async (email: string): Promise<CustomerResponse | null> => {
      const { data } = await this.http.get("/v1/customers/search", {
        params: { email },
      });
      const first = data.results?.[0];
      return first ? this.parseCustomer(first) : null;
    },

    /** Atualiza dados do cliente. */
    update: async (
      customerId: string,
      options: Partial<CustomerOptions>
    ): Promise<CustomerResponse> => {
      const { data } = await this.http.put(`/v1/customers/${customerId}`, {
        email: options.email,
        first_name: options.name,
        last_name: options.surname,
        phone: options.phone
          ? { area_code: options.phone.areaCode, number: options.phone.number }
          : undefined,
      });
      return this.parseCustomer(data);
    },

    /** Remove um cliente. */
    delete: async (customerId: string): Promise<void> => {
      await this.http.delete(`/v1/customers/${customerId}`);
    },

    cards: {
      /** Salva cartão no cliente via token (gerado pelo SDK JS do MP). */
      add: async (options: CardOptions): Promise<CardResponse> => {
        const { data } = await this.http.post(
          `/v1/customers/${options.customerId}/cards`,
          { token: options.token }
        );
        return this.parseCard(data);
      },

      /** Lista cartões salvos do cliente. */
      list: async (customerId: string): Promise<CardResponse[]> => {
        const { data } = await this.http.get(`/v1/customers/${customerId}/cards`);
        return (data ?? []).map(this.parseCard.bind(this));
      },

      /** Remove um cartão salvo. */
      remove: async (customerId: string, cardId: string): Promise<void> => {
        await this.http.delete(`/v1/customers/${customerId}/cards/${cardId}`);
      },
    },
  };


  readonly subscriptions = {
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
    create: async (options: SubscriptionOptions): Promise<SubscriptionResponse> => {
      const body: Record<string, unknown> = {
        payer_email: options.payerEmail,
        reason: options.description,
        external_reference: options.externalReference,
        back_url: options.backUrl,
        auto_recurring: {
          frequency: options.frequency?.value ?? 1,
          frequency_type: options.frequency?.type ?? "months",
          transaction_amount: options.transactionAmount,
          currency_id: options.currency ?? "BRL",
          ...(options.repetitions && { repetitions: options.repetitions }),
        },
        ...(options.planId && { preapproval_plan_id: options.planId }),
        ...(options.cardTokenId && { card_token_id: options.cardTokenId }),
        ...(options.customerId && { payer_id: options.customerId }),
      };
      const { data } = await this.http.post("/preapproval", body);
      return this.parseSubscription(data);
    },

    /** Busca uma assinatura pelo ID. */
    get: async (subscriptionId: string): Promise<SubscriptionResponse> => {
      const { data } = await this.http.get(`/preapproval/${subscriptionId}`);
      return this.parseSubscription(data);
    },

    /** Pausa, reativa ou cancela uma assinatura. */
    updateStatus: async (
      subscriptionId: string,
      status: SubscriptionStatus
    ): Promise<SubscriptionResponse> => {
      const { data } = await this.http.put(`/preapproval/${subscriptionId}`, { status });
      return this.parseSubscription(data);
    },

    /** Lista assinaturas com filtros. */
    list: async (filters?: {
      status?: SubscriptionStatus;
      limit?: number;
      offset?: number;
    }): Promise<PagedResponse<SubscriptionResponse>> => {
      const { data } = await this.http.get("/preapproval/search", {
        params: {
          status: filters?.status,
          limit: filters?.limit ?? 30,
          offset: filters?.offset ?? 0,
        },
      });
      const results = (data.results ?? []).map(this.parseSubscription.bind(this));
      const total   = data.paging?.total ?? results.length;
      const offset  = filters?.offset ?? 0;
      return { results, total, limit: filters?.limit ?? 30, offset, hasMore: offset + results.length < total };
    },
  };


  readonly orders = {
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
    create: async (options: OrderOptions): Promise<OrderResponse> => {
      const { data } = await this.http.post("/checkout/preferences", {
        items: options.items.map((i) => ({
          id: i.id,
          title: i.title,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          description: i.description,
          picture_url: i.pictureUrl,
          category_id: i.categoryId,
          currency_id: i.currency ?? "BRL",
        })),
        payer: options.payer
          ? {
              email: options.payer.email,
              name: options.payer.name,
              surname: options.payer.surname,
              identification: options.payer.identification,
            }
          : undefined,
        external_reference: options.externalReference,
        notification_url: options.notificationUrl,
        back_urls: options.backUrls,
        auto_return: options.autoReturn,
        expires: options.expires,
        expiration_date_from: options.expirationDateFrom,
        expiration_date_to: options.expirationDateTo,
        excluded_payment_methods: options.excludedPaymentMethods?.map((m) => ({ id: m })),
        payment_methods: options.installments
          ? {
              default_installments: options.installments.default,
              installments: options.installments.max,
              min_installments: options.installments.min,
            }
          : undefined,
        marketplace: options.marketplace,
        marketplace_fee: options.marketplaceFee,
        metadata: options.metadata,
      });

      return {
        id: data.id,
        initPoint: data.init_point,
        sandboxInitPoint: data.sandbox_init_point,
        externalReference: data.external_reference,
        items: options.items,
        createdAt: data.date_created,
      };
    },

    /** Busca uma preferência de checkout pelo ID. */
    get: async (preferenceId: string): Promise<OrderResponse> => {
      const { data } = await this.http.get(`/checkout/preferences/${preferenceId}`);
      return {
        id: data.id,
        initPoint: data.init_point,
        sandboxInitPoint: data.sandbox_init_point,
        externalReference: data.external_reference,
        items: (data.items ?? []).map((i: any) => ({
          id: i.id,
          title: i.title,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          currency: i.currency_id,
        })),
        createdAt: data.date_created,
      };
    },
  };

  // ══════════════════════════════════════════════════════════════════════
  //  WEBHOOKS
  // ══════════════════════════════════════════════════════════════════════

  readonly webhooks = {
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
    parse: (options: {
      rawBody: Buffer | string;
      signature?: string;
      requestId?: string;
      /** Pula verificação de assinatura (só use em dev) */
      skipVerification?: boolean;
    }): WebhookEvent => {
      const { rawBody, signature, requestId, skipVerification } = options;

      if (!skipVerification && this.opts.webhookSecret && signature) {
        this.verifyWebhookSignature(rawBody, signature, requestId);
      }

      const body =
        typeof rawBody === "string"
          ? JSON.parse(rawBody)
          : JSON.parse(rawBody.toString("utf-8"));

      return {
        id: String(body.id ?? ""),
        topic: body.topic ?? body.type,
        resourceId: String(body.data?.id ?? ""),
        resourceUrl: body.resource ?? "",
        action: body.action ?? "",
        apiVersion: body.api_version ?? "v1",
        createdAt: body.date_created ?? new Date().toISOString(),
        liveMode: body.live_mode ?? false,
      };
    },

    /**
     * Resolve o recurso completo de um evento.
     * Atalho para não precisar verificar o topic manualmente.
     */
    resolve: async (event: WebhookEvent): Promise<PaymentResponse | null> => {
      if (event.topic === "payment") {
        return this.payments.get(event.resourceId);
      }
      return null;
    },
  };

  // ══════════════════════════════════════════════════════════════════════
  //  INSTALLMENTS (consulta opções de parcelamento)
  // ══════════════════════════════════════════════════════════════════════

  readonly installments = {
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
    get: async (options: {
      amount: number;
      bin: string;
      currency?: Currency;
    }): Promise<
      Array<{
        paymentMethodId: string;
        paymentTypeName: string;
        installments: Array<{
          installments: number;
          installmentAmount: number;
          totalAmount: number;
          rate: number;
          labels: string[];
        }>;
      }>
    > => {
      const { data } = await this.http.get("/v1/payment_methods/installments", {
        params: {
          amount: options.amount,
          bin: options.bin,
          currency_id: options.currency ?? "BRL",
        },
      });
      return (data ?? []).map((pm: any) => ({
        paymentMethodId: pm.payment_method_id,
        paymentTypeName: pm.payment_type_id,
        installments: (pm.payer_costs ?? []).map((pc: any) => ({
          installments: pc.installments,
          installmentAmount: pc.installment_amount,
          totalAmount: pc.total_amount,
          rate: pc.installment_rate,
          labels: pc.labels ?? [],
        })),
      }));
    },
  };
  
  private parsePayment(data: Record<string, unknown>): PaymentResponse {
    const poi  = (data.point_of_interaction as any)?.transaction_data ?? {};
    const card = data.card as any;
    const fees = (data.fee_details as any[])?.[0];

    return {
      id: String(data.id),
      status: data.status as PaymentStatus,
      statusDetail: (data.status_detail as string) ?? "",
      value: data.transaction_amount as number,
      netAmount: (data.transaction_details as any)?.net_received_amount,
      feeAmount: fees?.amount,
      type: data.payment_method_id as PaymentType,
      currency: (data.currency_id as Currency) ?? "BRL",
      description: (data.description as string) ?? "",
      installments: (data.installments as number) ?? 1,
      createdAt: data.date_created as string,
      updatedAt: (data.date_last_updated ?? data.date_created) as string,
      payer: {
        email: (data.payer as any)?.email,
        name: (data.payer as any)?.first_name,
        surname: (data.payer as any)?.last_name,
        identification: (data.payer as any)?.identification,
      },
      qrCode: poi.qr_code,
      qrCodeBase64: poi.qr_code_base64,
      pixCopyPaste: poi.qr_code,
      pixExpirationDate: poi.expiration_date,
      ticketUrl: data.ticket_url as string | undefined,
      barcode: (data.barcode as any)?.content,
      boletoExpirationDate: data.date_of_expiration as string | undefined,
      lastFourDigits: card?.last_four_digits,
      cardHolder: card?.cardholder?.name,
      externalReference: data.external_reference as string | undefined,
      metadata: data.metadata as Record<string, unknown> | undefined,
      refunds: ((data.refunds as any[]) ?? []).map((r) => ({
        id: String(r.id),
        amount: r.amount,
        createdAt: r.date_created,
      })),
    };
  }

  private parseCustomer(data: Record<string, unknown>): CustomerResponse {
    return {
      id: String(data.id),
      email: data.email as string,
      name: (data.first_name as string) ?? "",
      surname: (data.last_name as string) ?? "",
      cards: ((data.cards as any[]) ?? []).map(this.parseCard.bind(this)),
      createdAt: data.date_registered as string,
    };
  }

  private parseCard(data: Record<string, unknown>): CardResponse {
    return {
      id: String(data.id),
      lastFourDigits: (data.last_four_digits as string) ?? "",
      expirationMonth: data.expiration_month as number,
      expirationYear: data.expiration_year as number,
      cardHolder: (data.cardholder as any)?.name ?? "",
      paymentMethod: (data.payment_method as any)?.id ?? "",
      brand: (data.payment_method as any)?.name ?? "",
    };
  }

  private parseSubscription(data: Record<string, unknown>): SubscriptionResponse {
    const ar = data.auto_recurring as any;
    return {
      id: String(data.id),
      status: data.status as SubscriptionStatus,
      payerEmail: data.payer_email as string,
      description: (data.reason as string) ?? "",
      transactionAmount: ar?.transaction_amount ?? 0,
      currency: ar?.currency_id ?? "BRL",
      nextPaymentDate: (data.next_payment_date as string) ?? "",
      createdAt: data.date_created as string,
      externalReference: data.external_reference as string | undefined,
    };
  }

  private verifyWebhookSignature(
    rawBody: Buffer | string,
    signature: string,
    requestId?: string
  ) {
    // Formato do header: ts=<timestamp>,v1=<hmac-hex>
    const parts = Object.fromEntries(
      signature.split(",").map((p) => p.split("=") as [string, string])
    );
    const ts = parts["ts"];
    const v1 = parts["v1"];

    if (!ts || !v1) throw new WebhookSignatureError();

    const body     = typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8");
    const manifest = `id:${requestId ?? ""};request-id:${requestId ?? ""};ts:${ts};${body}`;
    const expected = createHmac("sha256", this.opts.webhookSecret).update(manifest).digest("hex");

    if (expected !== v1) throw new WebhookSignatureError();
  }
}
type PaymentType = "pix" | "credit_card" | "debit_card" | "boleto" | "account_money" | "mercadopago";
type PaymentStatus = "pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back";
type Currency = "BRL" | "USD" | "ARS" | "MXN" | "CLP" | "COP" | "PEN";
type SubscriptionStatus = "authorized" | "paused" | "cancelled";
type WebhookTopic = "payment" | "plan" | "subscription" | "invoice" | "point_integration_wh" | "delivery" | "customer";
interface Payer {
    email?: string;
    name?: string;
    surname?: string;
    identification?: {
        type: "CPF" | "CNPJ" | "DNI" | "CI";
        number: string;
    };
    phone?: {
        areaCode: string;
        number: string;
    };
    address?: {
        zipCode: string;
        streetName: string;
        streetNumber: string;
        neighborhood?: string;
        city?: string;
        federalUnit?: string;
    };
}
interface PaymentOptions {
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
interface PaymentResponse {
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
    qrCode?: string;
    qrCodeBase64?: string;
    pixCopyPaste?: string;
    pixExpirationDate?: string;
    ticketUrl?: string;
    barcode?: string;
    boletoExpirationDate?: string;
    lastFourDigits?: string;
    cardHolder?: string;
    externalReference?: string;
    metadata?: Record<string, unknown>;
    refunds: Array<{
        id: string;
        amount: number;
        createdAt: string;
    }>;
}
interface RefundOptions {
    paymentId: string;
    amount?: number;
    idempotencyKey?: string;
}
interface ListFilters {
    status?: PaymentStatus;
    paymentMethodId?: PaymentType;
    externalReference?: string;
    dateCreatedFrom?: string;
    dateCreatedTo?: string;
    limit?: number;
    offset?: number;
}
interface PagedResponse<T> {
    results: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}
interface CustomerOptions {
    email: string;
    name?: string;
    surname?: string;
    phone?: {
        areaCode: string;
        number: string;
    };
    identification?: {
        type: string;
        number: string;
    };
    defaultAddress?: string;
    metadata?: Record<string, unknown>;
}
interface CustomerResponse {
    id: string;
    email: string;
    name: string;
    surname: string;
    cards: CardResponse[];
    createdAt: string;
}
interface CardOptions {
    customerId: string;
    /** Token gerado pelo SDK JS do MP no frontend */
    token: string;
}
interface CardResponse {
    id: string;
    lastFourDigits: string;
    expirationMonth: number;
    expirationYear: number;
    cardHolder: string;
    paymentMethod: string;
    brand: string;
}
interface SubscriptionOptions {
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
    frequency?: {
        type: "days" | "months";
        value: number;
    };
}
interface SubscriptionResponse {
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
interface OrderItem {
    id?: string;
    title: string;
    quantity: number;
    unitPrice: number;
    description?: string;
    pictureUrl?: string;
    categoryId?: string;
    currency?: Currency;
}
interface OrderOptions {
    items: OrderItem[];
    payer?: Payer;
    externalReference?: string;
    notificationUrl?: string;
    expires?: boolean;
    expirationDateFrom?: string;
    expirationDateTo?: string;
    backUrls?: {
        success?: string;
        failure?: string;
        pending?: string;
    };
    autoReturn?: "approved" | "all";
    excludedPaymentMethods?: PaymentType[];
    installments?: {
        default?: number;
        min?: number;
        max?: number;
    };
    marketplace?: string;
    marketplaceFee?: number;
    metadata?: Record<string, unknown>;
}
interface OrderResponse {
    id: string;
    initPoint: string;
    sandboxInitPoint: string;
    externalReference?: string;
    items: OrderItem[];
    createdAt: string;
}
interface WebhookEvent {
    id: string;
    topic: WebhookTopic;
    resourceId: string;
    resourceUrl: string;
    action: string;
    apiVersion: string;
    createdAt: string;
    liveMode: boolean;
}
interface ClientOptions {
    sandbox?: boolean;
    timeout?: number;
    retries?: number;
    webhookSecret?: string;
}
declare class MercadoPagoError extends Error {
    readonly statusCode: number;
    readonly raw?: unknown | undefined;
    constructor(statusCode: number, message: string, raw?: unknown | undefined);
}
declare class WebhookSignatureError extends Error {
    constructor();
}
declare class Client {
    private readonly token;
    private readonly http;
    private readonly opts;
    constructor(token: string, options?: ClientOptions);
    private setupInterceptors;
    readonly payments: {
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
        generate: (options?: PaymentOptions) => Promise<PaymentResponse>;
        /** Busca um pagamento pelo ID. */
        get: (paymentId: string) => Promise<PaymentResponse>;
        /** Lista pagamentos com filtros e paginação cursor. */
        list: (filters?: ListFilters) => Promise<PagedResponse<PaymentResponse>>;
        /** Cancela um pagamento pendente. */
        cancel: (paymentId: string) => Promise<PaymentResponse>;
        /**
         * Estorna total ou parcialmente.
         * @example
         * await client.payments.refund({ paymentId: "123" })             // total
         * await client.payments.refund({ paymentId: "123", amount: 50 }) // parcial
         */
        refund: (options: RefundOptions) => Promise<{
            id: string;
            amount: number;
            createdAt: string;
        }>;
        /** Lista todos os estornos de um pagamento. */
        listRefunds: (paymentId: string) => Promise<any>;
        /**
         * Captura um pagamento pré-autorizado (two-step capture).
         * Usado quando o pagamento foi criado com capture: false.
         */
        capture: (paymentId: string, amount?: number) => Promise<PaymentResponse>;
    };
    readonly customers: {
        /** Cria um cliente. */
        create: (options: CustomerOptions) => Promise<CustomerResponse>;
        /** Busca cliente por ID. */
        get: (customerId: string) => Promise<CustomerResponse>;
        /** Busca cliente por email (retorna null se não encontrar). */
        findByEmail: (email: string) => Promise<CustomerResponse | null>;
        /** Atualiza dados do cliente. */
        update: (customerId: string, options: Partial<CustomerOptions>) => Promise<CustomerResponse>;
        /** Remove um cliente. */
        delete: (customerId: string) => Promise<void>;
        cards: {
            /** Salva cartão no cliente via token (gerado pelo SDK JS do MP). */
            add: (options: CardOptions) => Promise<CardResponse>;
            /** Lista cartões salvos do cliente. */
            list: (customerId: string) => Promise<CardResponse[]>;
            /** Remove um cartão salvo. */
            remove: (customerId: string, cardId: string) => Promise<void>;
        };
    };
    readonly subscriptions: {
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
        create: (options: SubscriptionOptions) => Promise<SubscriptionResponse>;
        /** Busca uma assinatura pelo ID. */
        get: (subscriptionId: string) => Promise<SubscriptionResponse>;
        /** Pausa, reativa ou cancela uma assinatura. */
        updateStatus: (subscriptionId: string, status: SubscriptionStatus) => Promise<SubscriptionResponse>;
        /** Lista assinaturas com filtros. */
        list: (filters?: {
            status?: SubscriptionStatus;
            limit?: number;
            offset?: number;
        }) => Promise<PagedResponse<SubscriptionResponse>>;
    };
    readonly orders: {
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
        create: (options: OrderOptions) => Promise<OrderResponse>;
        /** Busca uma preferência de checkout pelo ID. */
        get: (preferenceId: string) => Promise<OrderResponse>;
    };
    readonly webhooks: {
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
        }) => WebhookEvent;
        /**
         * Resolve o recurso completo de um evento.
         * Atalho para não precisar verificar o topic manualmente.
         */
        resolve: (event: WebhookEvent) => Promise<PaymentResponse | null>;
    };
    readonly installments: {
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
        get: (options: {
            amount: number;
            bin: string;
            currency?: Currency;
        }) => Promise<Array<{
            paymentMethodId: string;
            paymentTypeName: string;
            installments: Array<{
                installments: number;
                installmentAmount: number;
                totalAmount: number;
                rate: number;
                labels: string[];
            }>;
        }>>;
    };
    private parsePayment;
    private parseCustomer;
    private parseCard;
    private parseSubscription;
    private verifyWebhookSignature;
}

export { type CardOptions, type CardResponse, Client, type ClientOptions, type Currency, type CustomerOptions, type CustomerResponse, type ListFilters, MercadoPagoError, type OrderItem, type OrderOptions, type OrderResponse, type PagedResponse, type Payer, type PaymentOptions, type PaymentResponse, type PaymentStatus, type PaymentType, type RefundOptions, type SubscriptionOptions, type SubscriptionResponse, type SubscriptionStatus, type WebhookEvent, WebhookSignatureError, type WebhookTopic };

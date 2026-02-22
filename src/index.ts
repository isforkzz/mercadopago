MERCADOPAGO CLIENT - SECURE VERSION

-   Enforces APP-USR token validation
-   Removes default payment value
-   Validates notificationUrl
-   Secure webhook verification (correct manifest)
-   timingSafeEqual protection
-   randomUUID from crypto import
-   Clear validation errors

  ------
  CODE
  ------

import axios, { AxiosInstance, AxiosRequestConfig } from “axios”; import
{ createHmac, randomUUID, timingSafeEqual } from “crypto”;

export interface ClientOptions { token: string; webhookSecret?: string;
sandbox?: boolean; timeout?: number; }

export class MercadoPagoClient { private http: AxiosInstance; private
opts: ClientOptions;

constructor(options: ClientOptions) { if (!options?.token) { throw new
Error(“MercadoPago: token é obrigatório.”); }

    if (!options.token.startsWith("APP-USR")) {
      throw new Error("MercadoPago: token inválido. Deve começar com 'APP-USR'.");
    }

    this.opts = {
      timeout: 15000,
      sandbox: false,
      ...options,
    };

    const baseURL = "https://api.mercadopago.com";

    this.http = axios.create({
      baseURL,
      timeout: this.opts.timeout,
      headers: {
        Authorization: `Bearer ${this.opts.token}`,
        "Content-Type": "application/json",
      },
    });

    this.http.interceptors.request.use((config: AxiosRequestConfig) => {
      if (!config.headers) config.headers = {};
      config.headers["X-Idempotency-Key"] =
        config.headers["X-Idempotency-Key"] ?? randomUUID();
      return config;
    });

}

public payments = { generate: async (params: { type: “pix” |
“credit_card” | “boleto”; value: number; description?: string;
notificationUrl?: string; payer: { email: string; first_name?: string;
last_name?: string; identification?: { type: string; number: string; };
}; metadata?: Record<string, any>; }) => { const { type, value,
description, notificationUrl, payer, metadata } = params;

      if (value === undefined || value === null) {
        throw new Error("MercadoPago: 'value' é obrigatório.");
      }

      if (typeof value !== "number" || value <= 0) {
        throw new Error("MercadoPago: 'value' deve ser maior que 0.");
      }

      if (!payer?.email) {
        throw new Error("MercadoPago: payer.email é obrigatório.");
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer.email)) {
        throw new Error("MercadoPago: payer.email inválido.");
      }

      if (notificationUrl) {
        try {
          const parsed = new URL(notificationUrl);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error();
          }
        } catch {
          throw new Error("MercadoPago: notificationUrl inválida.");
        }
      }

      const payload = {
        transaction_amount: value,
        description,
        payment_method_id: type,
        notification_url: notificationUrl,
        payer,
        metadata,
      };

      const { data } = await this.http.post("/v1/payments", payload);
      return data;
    },

};

public webhooks = { verify: (params: { body: any; headers:
Record<string, string | string[] | undefined>; }) => { const { body,
headers } = params;

      if (!this.opts.webhookSecret) {
        throw new Error("MercadoPago: webhookSecret é obrigatório.");
      }

      const signatureHeader = headers["x-signature"];
      const requestId = headers["x-request-id"];

      if (!signatureHeader || !requestId) {
        throw new Error("MercadoPago: headers obrigatórios ausentes.");
      }

      const signature = Array.isArray(signatureHeader)
        ? signatureHeader[0]
        : signatureHeader;

      const tsMatch = signature.match(/ts=(\d+)/);
      const v1Match = signature.match(/v1=([a-f0-9]+)/);

      if (!tsMatch || !v1Match) {
        throw new Error("MercadoPago: assinatura inválida.");
      }

      const ts = tsMatch[1];
      const receivedSignature = v1Match[1];

      const rawBody = typeof body === "string" ? body : JSON.stringify(body);
      const parsedBody = typeof body === "string" ? JSON.parse(body) : body;

      if (!parsedBody?.id) {
        throw new Error("MercadoPago: body.id é obrigatório.");
      }

      const manifest = `id:${parsedBody.id};request-id:${requestId};ts:${ts};${rawBody}`;

      const expectedSignature = createHmac("sha256", this.opts.webhookSecret)
        .update(manifest)
        .digest("hex");

      const isValid =
        expectedSignature.length === receivedSignature.length &&
        timingSafeEqual(
          Buffer.from(expectedSignature),
          Buffer.from(receivedSignature)
        );

      if (!isValid) {
        throw new Error("MercadoPago: assinatura inválida.");
      }

      return parsedBody;
    },

}; }

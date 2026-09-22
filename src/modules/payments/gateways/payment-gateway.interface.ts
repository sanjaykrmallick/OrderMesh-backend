export interface CreatePaymentParams {
  amountInCents: number;
  currency: string;

  orderId: string;
  paymentId: string;
  attemptId: string;

  customerEmail?: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface PaymentGatewayResult {
  providerPaymentId: string;

  clientSecret?: string;

  status: 'CREATED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

  raw?: unknown;
}

export interface PaymentWebhookResult {
  providerPaymentId: string;

  eventId: string;

  eventType: string;

  status: 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

  failureCode?: string;

  failureMessage?: string;

  raw?: unknown;
}

export interface PaymentGateway {
  createPayment(params: CreatePaymentParams): Promise<PaymentGatewayResult>;

  parseWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<PaymentWebhookResult>;

  refund(providerPaymentId: string, amountInCents?: number): Promise<void>;
}

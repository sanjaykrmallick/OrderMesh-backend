export interface OrderEventPayload {
  orderId: string;
  userId: string;
  orderNumber: string;
  totalAmountInCents: number;
}

export interface PaymentEventPayload {
  orderId: string;
  userId: string;
  paymentId: string;
  paymentAttemptId: string;
  amountInCents: number;
  provider: string;
  providerPaymentId?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface InventoryEventPayload {
  productId: string;
  quantity: number;
  orderId?: string;
}

export interface UserRegisteredEventPayload {
  userId: string;
  email: string;
  firstName: string;
}

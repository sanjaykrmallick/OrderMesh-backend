export const EVENTS = {
  USER_REGISTERED: 'user.registered',

  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',

  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',

  ORDER_PROCESSING: 'order.processing',
  ORDER_PACKED: 'order.packed',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',

  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RELEASED: 'inventory.released',
} as const;

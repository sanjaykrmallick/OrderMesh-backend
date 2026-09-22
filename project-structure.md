order-fulfillment-platform/
│
├── src/
│ ├── app.module.ts
│ ├── main.ts
│ │
│ ├── common/
│ │ ├── decorators/
│ │ ├── guards/
│ │ ├── interceptors/
│ │ ├── filters/
│ │ ├── middleware/
│ │ ├── pipes/
│ │ ├── exceptions/
│ │ └── utils/
│ │
│ ├── config/
│ │ ├── configuration.ts
│ │ └── validation.ts
│ │
│ ├── database/
│ │ ├── database.module.ts
│ │ └── prisma.service.ts
│ │
│ ├── auth/
│ │ ├── auth.module.ts
│ │ ├── auth.controller.ts
│ │ ├── auth.service.ts
│ │ ├── dto/
│ │ ├── strategies/
│ │ └── guards/
│ │
│ ├── users/
│ │ ├── users.module.ts
│ │ ├── users.controller.ts
│ │ ├── users.service.ts
│ │ └── dto/
│ │
│ ├── products/
│ │ ├── products.module.ts
│ │ ├── products.controller.ts
│ │ ├── products.service.ts
│ │ └── dto/
│ │
│ ├── cart/
│ │ ├── cart.module.ts
│ │ ├── cart.controller.ts
│ │ ├── cart.service.ts
│ │ └── dto/
│ │
│ ├── inventory/
│ │ ├── inventory.module.ts
│ │ ├── inventory.controller.ts
│ │ ├── inventory.service.ts
│ │ └── dto/
│ │
│ ├── /categories
│ │ ├── categories.module.ts
│ │ ├── categories.controller.ts
│ │ ├── categories.service.ts
│ │ └── dto/
│ │
│ ├── orders/
│ │ ├── orders.module.ts
│ │ ├── orders.controller.ts
│ │ ├── orders.service.ts
│ │ └── dto/
│ │
│ ├── payments/
| │ ├── gateways/
│ │ │ ├── payment-gateway.interface.ts
│ │ │ ├── stripe.gateway.ts
│ │ │ ├── razorpay.gateway.ts
│ │ │ └── paypal.gateway.ts
│ │ │
| │ ├── webhooks/
| │ │ ├── payment-webhook-event.service.ts
| │ │ ├── stripe-webhook.service.ts
| │ │ ├── razorpay-webhook.service.ts
| │ │ └── paypal-webhook.service.ts
│ │ │
│ │ ├── payments.module.ts
│ │ ├── payments.controller.ts
│ │ └── payments.service.ts
│ │
│ ├── fulfillment/
│ │ ├── fulfillment.module.ts
│ │ ├── fulfillment.controller.ts
│ │ └── fulfillment.service.ts
│ │
│ ├── notifications/
│ │ ├── notifications.module.ts
│ │ └── notifications.service.ts
│ │
│ ├── analytics/
│ │ ├── analytics.module.ts
│ │ ├── analytics.controller.ts
│ │ └── analytics.service.ts
│ │
│ └── health/
│ ├── health.module.ts
│ └── health.controller.ts
│
├── prisma/
│ └── schema.prisma
│
├── test/
├── .env
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── nest-cli.json
├── tsconfig.json
└── package.json

# API authorization

The final authorization model is:

API--------------Customer---Warehouse---Operations---Admin
GET Categories------✅-------✅-----------✅-------✅
POST Category-------❌-------❌-----------❌-------✅
PATCH Category------❌-------❌-----------❌-------✅
DELETE Category-----❌-------❌-----------❌-------✅
GET Products--------✅-------✅-----------✅-------✅
POST Product--------❌-------❌-----------✅-------✅
PATCH Product-------❌-------❌-----------✅-------✅
DELETE Product------❌-------❌-----------✅-------✅
GET Inventory-------❌-------✅-----------✅-------✅
Adjust Inventory----❌-------✅-----------✅-------✅
Reserve Inventory---❌-------❌-----------✅-------✅
Release Inventory---❌-------❌-----------✅-------✅

# Target payment flow :-

Customer
│
│ POST /orders/checkout
▼
OrderService
│
├── Mongo Transaction
│ ├── Reserve inventory
│ ├── Create Order
│ ├── Create PaymentAttempt
│ └── Clear Cart
│
▼
PaymentService
│
│ createPayment()
▼
StripeGateway
│
│ PaymentIntent
▼
Stripe
│
│ client_secret
▼
Frontend
│
│ Stripe.js confirms payment
▼
Stripe
│
│ webhook
▼
POST /api/payments/webhook/stripe
│
▼
PaymentService
│
├── Verify signature
├── Check idempotency
├── Atomic state transition
├── Update PaymentAttempt
└── Update Order

# Payment Webhook Event

Stripe
│
│ webhook event
▼
POST /api/payments/webhook/stripe
│
▼
Verify Stripe signature
│
▼
PaymentWebhookEvent
│
├── already PROCESSED → return 200
│
├── PROCESSING → ignore duplicate
│
└── RECEIVED/FAILED → claim event
│
▼
Mongo Transaction
│
├── PaymentAttempt state transition
├── Payment update
├── Order update
└── Inventory release if required
│
▼
Mark WebhookEvent = PROCESSED

#

# Stripe Webhook

Stripe
│
▼
POST /api/payments/webhook/stripe
│
▼
Verify signature
│
▼
PaymentWebhookEvent.create()
│
├── duplicate → existing event
│
▼
claimEvent()
│
├── another worker owns it → return 200
│
▼
processWebhook()
│
▼
Mongo Transaction
│
├── PaymentAttempt
├── Payment
├── Order
└── Inventory
│
▼
markProcessed()

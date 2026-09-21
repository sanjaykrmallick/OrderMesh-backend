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

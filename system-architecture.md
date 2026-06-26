# Project Overview

This repository is a NestJS backend for a food delivery system. The codebase already had modules for authentication, restaurant browsing, cart, ordering, payment, realtime chat, conversation, user profile, address handling, device registration, notifications, MinIO uploads, email, and Twilio integration.

The backend was enhanced by refactoring the existing APIs instead of rebuilding them. The current work focused on the flows visible in the mobile UI and on the modules already present in the repository:

- `restaurant`
- `cart`
- `order`
- `payment`
- `conversation`
- realtime chat
- `address`
- `category`
- `voucher`
- `notification`
- `admin`
- `audit`

# Architecture Overview

The application follows a modular NestJS structure:

- `src/app.module.ts`
  Registers feature modules and global infrastructure.
- `src/modules/*`
  Feature modules that expose controllers and services.
- `src/prisma`
  Prisma client bootstrap plus soft-delete extensions.
- `src/realtime`
  Socket.IO gateway and realtime chat helpers.
- `src/bases`
  Shared guards, decorators, filters, and interceptors.

Core runtime behaviors:

- Global API prefix: `/api`
- Global validation: `ValidationPipe` with `transform` and `whitelist`
- Global HTTP exception filter
- Global logging and transform interceptors

# API Overview

## Restaurant

- `GET /api/restaurant`
  List approved restaurants with keyword/category filtering.
- `GET /api/restaurant/my`
  Business/Admin restaurant management list.
- `POST /api/restaurant/manage`
  Create a restaurant.
- `PATCH /api/restaurant/manage/:restaurantId`
  Update an owned restaurant.
- `GET /api/restaurant/detail/:restaurantId`
  Restaurant detail with address, foods, and rating summary.
- `GET /api/restaurant/menu/:restaurantId`
  Restaurant food list with keyword/category filtering.
- `GET /api/restaurant/reviews/:restaurantId`
  Restaurant reviews and rating aggregate.
- `POST /api/restaurant/reviews/:restaurantId`
  Create or update a customer review.

## Cart

- `GET /api/cart`
  Current customer cart with summary and line totals.
- `POST /api/cart`
  Add food to cart with single-restaurant validation.
- `PATCH /api/cart/:cartItemId`
  Update item quantity. Quantity `0` removes the item.
- `DELETE /api/cart/:cartItemId`
  Remove one cart item.
- `DELETE /api/cart`
  Clear the entire customer cart.

## Orders

- `POST /api/orders`
  Create a customer order from foods, address, and payment method.
- `GET /api/orders`
  List orders. Customers see their own orders. Business/Admin users can see restaurant orders.
- `GET /api/orders/:orderId`
  Detailed order view with foods, address, payment, voucher, and conversation.
- `DELETE /api/orders/:orderId`
  Cancel an order instead of soft-deleting the order history.
- `PATCH /api/orders/:orderId`
  Update status with role-aware restrictions.

## Categories

- `GET /api/categories`
  Public category list for discovery screens.
- `GET /api/categories/:id`
  Category detail with sample foods.
- `POST /api/categories`
- `PATCH /api/categories/:id`
- `DELETE /api/categories/:id`
  Business/Admin category management.

## Vouchers

- `GET /api/vouchers`
  Browse vouchers and coupons.
- `GET /api/vouchers/:id`
  Voucher detail.
- `GET /api/vouchers/code/:code`
  Voucher lookup by code.
- `POST /api/vouchers`
- `PATCH /api/vouchers/:id`
- `DELETE /api/vouchers/:id`
  Business/Admin voucher management.

## Payment

- `POST /api/payment/check-payment`
  Update MoMo payment status from callback/mock flow.
- `GET /api/payment/:orderId`
  Read payment snapshot for an order.

## Conversation

- `GET /api/conversation/me`
  Current user's conversation list with last message preview.
- `GET /api/conversation/user/:userId`
  Backward-compatible user conversation route. The authenticated user is still enforced.
- `POST /api/conversation`
  Create or reuse the single conversation for the authenticated customer and seller.
- `GET /api/conversation/detail`
  Load messages by using `orderId` to resolve the customer and restaurant owner.
- `GET /api/conversation/:conversationId`
  Load messages directly by `conversationId`.

## Realtime Chat

Socket.IO events:

- Client -> Server
    - `join-room`
    - `leave-room`
    - `text-chat`
- Server -> Client
    - `join-room`
    - `leave-room`
    - `text-chat`
    - `exception`

The gateway authenticates the socket with the same JWT access token used by REST APIs.

## Notifications

- `POST /api/notification`
  Create and push a notification to the current user.
- `GET /api/notification/me`
  Read current user's notifications.
- `PATCH /api/notification/:notificationId/read`
  Mark one notification as read.
- `PATCH /api/notification/read-all`
  Mark all notifications as read.

## Admin

- `GET /api/admin/dashboard`
  Read platform summary metrics.
- `GET /api/admin/audit-logs`
  Read audit history.
- `GET /api/admin/payments`
  Inspect payments with filters.
- `PATCH /api/admin/payments/:paymentId`
  Override payment status.
- `POST /api/admin/users/:userId/reset-password`
  Reset a user password and optionally email the temporary password.
- `PATCH /api/admin/restaurants/:restaurantId/approval`
  Approve or reject a restaurant.

# Database Overview

Prisma uses PostgreSQL and is configured from `prisma/models`. The current backend relies on the existing domain models:

- `User`, `UserRole`, `Identity`, `OTP`, `AuthToken`
- `Address`, `UserAddress`
- `Restaurant`, `RestaurantRating`
- `Category`, `Food`, `Ingredient`, `FoodIngredient`
- `Cart`, `CartItem`
- `Order`, `OrderFood`
- `Payment`
- `Conversation`, `Message`
- `Device`, `Notification`
- `Voucher`
- `AuditLog`

Soft delete behavior:

- Models use `deleteAt`
- Prisma client extensions automatically filter soft-deleted rows for reads
- `delete` and `deleteMany` are translated into soft-delete updates

Important business-side constraints currently enforced in service logic:

- A cart can only contain foods from one restaurant at a time
- All foods in an order must belong to the same restaurant
- Customer order cancellation preserves order history by using `OrderStatus.CANCELLED`
- One conversation is shared by one customer and one restaurant owner
- One payment snapshot is created per order
- Restaurant-scoped vouchers can only be used for the matching restaurant
- Voucher validation respects status, validity window, and minimum order amount

# Technology Stack

- NestJS 11
- TypeScript
- Prisma ORM
- PostgreSQL
- Socket.IO
- MinIO
- Nodemailer / `@nestjs-modules/mailer`
- Firebase Admin SDK
- Twilio

# Environment Variables

Required variables:

- `PORT`
- `NODE_ENV`
- `DATABASE_URL`
- `ACCESS_SECRET_KEY`
- `REFRESH_SECRET_KEY`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_USE_SSL`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`

Optional but used when the corresponding integrations are enabled:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFICATION_OTP_SERVICE_SID`
- `TWILIO_SENDING_SMS_SERVICE_SID`
- `TWILIO_SENDER_PHONE_NUMBER`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `MOMO_PARTNER_CODE`
- `MOMO_ACCESS_KEY`
- `MOMO_SECRET_KEY`

Notes:

- `.env.example` has been updated to remove hard-coded secrets.
- MoMo payment flow now degrades to a mock pay URL when credentials or network access are unavailable.

# Business Flows

## Authentication Flow

1. User authenticates with JWT-based login.
2. Access token is used for both REST and websocket authentication.
3. Role guards protect customer-only and business/admin order operations.

## Ordering Flow

1. Customer adds foods to cart.
2. Cart rejects foods from a different restaurant.
3. Customer creates an order with a saved or custom address.
4. Backend validates restaurant ownership for all foods.
5. Order foods are snapshotted into `OrderFood`.
6. Cart items can be cleared after successful order creation.
7. A conversation is provisioned for the order.

## Payment Flow

1. Order creation triggers payment snapshot creation.
2. `CASH` creates an unpaid payment record.
3. `MOMO` creates a payment record and attempts to generate a pay URL.
4. If MoMo credentials/network are unavailable, a mock response is returned.
5. Payment callback/status update can move the payment to `DONE`.
6. Admin can manually inspect and override payment states.

## Conversation and Realtime Chat Flow

1. Each customer/seller pair can own one conversation.
2. Users can fetch conversation history by order context or conversation id.
3. Socket clients connect with bearer token auth.
4. Users join `room-{conversationId}`.
5. Messages are validated, stored, and broadcast to the room.

## Delivery / Order Tracking Flow

1. Orders start as `PENDING`.
2. Business/Admin actors can move orders through operational statuses.
3. Customers can cancel eligible orders.
4. Order detail endpoint returns status, address, payment, foods, and conversation metadata for tracking screens.

## Admin and Audit Flow

1. Admin operations are grouped under `/api/admin`.
2. Sensitive administrative actions are written into `AuditLog`.
3. Audit history can be filtered by action, entity type, and actor.

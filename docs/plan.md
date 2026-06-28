# Implementation Plan: KFood Backend Sync

Audit date: 2026-06-20

This plan keeps the original 9-issue roadmap, but updates each issue against the real backend state in this repository. The goal is not to rebuild the backend from scratch. The goal is to move the current NestJS + Prisma backend toward the requested product behavior while preserving existing modules, route style, DTO patterns, authorization guards, Prisma model folder layout, and business flows.

## Current Backend Reality

- Backend compiles successfully with `npm run build`.
- Prisma uses multi-file schema config: `prisma.config.ts` points to `schema: "prisma/models"`. Do not move work to `prisma/schema.prisma`.
- Existing route style uses controllers such as `/food`, `/restaurant`, `/payment`, `/orders`, and `/admin`.
- `Ingredient` and `FoodIngredient` already exist in Prisma and seed data.
- `GET /food/:id` already returns `foodIngredients`.
- `POST /food/manage` and `PATCH /food/manage/:id` do not yet accept or persist `ingredientIds`.
- Food currently has a single `price`. There is no `Size` master table, no food-size variant table, and cart/order flows do not accept `foodSizeId`.
- Order module currently has `GET /orders`, `GET /orders/:orderId`, `DELETE /orders/:orderId`, and `PATCH /orders/:orderId`. It does not have reorder, polling status, `/cancel` compatibility endpoint, or `ongoing|history` list grouping for frontend.
- `FoodRating`, `UserCard`, `Message.image`, `Restaurant.isOpen`, `Restaurant.operatingHours`, `Restaurant.isFeatured`, `RestaurantRating.reply`, `RestaurantRating.replyCreatedAt`, and `User.stripeCustomerId` are not yet in Prisma.
- Notification currently has a simple `Notification` model and direct Firebase sending in `NotificationService`. It does not yet have `NotificationChannel` delivery records or event-driven producers/listeners.
- `PUT /user/profile` is still restricted to `Role.CUSTOMER`.
- MoMo and CASH payment snapshots exist. MoMo already returns a mock `payUrl` when credentials or network are unavailable, but there is no vendor confirm-payment endpoint.
- Admin dashboard already exposes total delivered revenue, but there is no dedicated commission revenue endpoint.
- README ERD still contains a stale `Menu` entity even though the schema links `Restaurant -> Food` directly.

## Status Legend

- `[TODO]`: not implemented.
- `[PARTIAL]`: the foundation exists, but the requested behavior is incomplete.
- `[DONE]`: already supported by the current backend and should only be verified/regression-tested.

---

## ISSUE 1: Database and Authorization Foundation

Goal: add the missing schema surface required by later issues and fix the vendor profile permission gap.

### Task 1.1 [TODO]: Add `FoodRating`, `UserCard`, and `Message.image`

Current state:
- `Food`, `Ingredient`, and `FoodIngredient` exist.
- `Message` currently has `content` only; no `image` field.
- No `FoodRating` model exists.
- No `UserCard` model exists.

Required work:
- Add `FoodRating` in `prisma/models/food.prisma`.
- Add `UserCard` in `prisma/models/payment.prisma` or a dedicated payment-related model file following the current model organization.
- Add `image String @default("")` to `Message` in `prisma/models/chat.prisma`.
- Add proper foreign keys and indexes for query paths used by food reviews and saved cards.

Acceptance criteria:
- `FoodRating` links to `Food`, `User`, and the completed `Order` or `OrderFood` context needed to enforce one review per purchased item.
- `UserCard` links to `User` and stores only safe tokenized/card-display fields, not raw card numbers.
- `Message.image` is persisted as a string URL and defaults to an empty string.
- Prisma validates with the multi-file schema setup.

Verification:
- Run `npx prisma validate`.
- Run `npm run build`.

Affected files:
- `prisma/models/food.prisma`
- `prisma/models/payment.prisma`
- `prisma/models/chat.prisma`
- `prisma/models/user.prisma`

Size: Medium.

### Task 1.2 [TODO]: Add restaurant status fields and rating reply fields

Current state:
- `Restaurant` has business profile fields such as `coverImage`, `deliveryFee`, `minimumOrder`, and `estimatedDeliveryTime`.
- `Restaurant` does not have open/featured/operating-hours fields.
- `RestaurantRating` does not support vendor replies.
- `User` does not have `stripeCustomerId`, `userCards`, or `foodRatings`.

Required work:
- Add `Restaurant.isOpen Boolean @default(true)`.
- Add `Restaurant.operatingHours Json?`.
- Add `Restaurant.isFeatured Boolean @default(false)`.
- Add `RestaurantRating.reply String? @db.Text`.
- Add `RestaurantRating.replyCreatedAt DateTime?`.
- Add `User.stripeCustomerId String?`.
- Add inverse relations from `User` to `UserCard` and `FoodRating`.

Acceptance criteria:
- Existing restaurant creation continues to work without requiring new fields.
- Existing restaurant detail/list endpoints can include new fields where relevant.
- Reply fields remain nullable so old reviews stay valid.

Verification:
- Run `npx prisma validate`.
- Run `npm run build`.

Affected files:
- `prisma/models/restaurant.prisma`
- `prisma/models/user.prisma`

Size: Medium.

### Task 1.3 [TODO]: Create and verify migration

Current state:
- Migrations exist under `prisma/migrations`.
- Schema files live under `prisma/models`.
- `prisma.config.ts` already configures schema and seed paths.

Required work:
- Create a migration from the updated `prisma/models` schema.
- Do not create or rely on `prisma/schema.prisma`.
- Preserve existing data with nullable/defaulted fields where possible.

Acceptance criteria:
- Migration applies cleanly to a local PostgreSQL database.
- Existing seed still runs or is updated if required by new constraints.
- No destructive migration is introduced unless explicitly reviewed.

Verification:
- Run `npx prisma migrate dev --name backend_sync_gap_fields`.
- Run `npx prisma validate`.
- Run `npm run build`.
- Optional: run `bun prisma/seed/seed.ts` after migration if the local database needs refreshed seed data.

Affected files:
- `prisma/models/*.prisma`
- `prisma/migrations/*`
- `prisma/seed/*` only if seed data must cover new fields.

Size: Small.

### Task 1.4 [TODO]: Allow BUSINESS users to update their profile

Current state:
- `PUT /user/profile` is guarded with `@Roles(Role.CUSTOMER)`.
- Business users cannot update avatar/phone through the existing profile endpoint.

Required work:
- Change the route role decorator to `@Roles(Role.CUSTOMER, Role.BUSINESS)`.
- Keep JWT and role guard behavior unchanged.

Acceptance criteria:
- CUSTOMER and BUSINESS can update their own profile.
- ADMIN access is not added unless explicitly required.
- Existing upload behavior using `avatar` remains compatible.

Verification:
- Run `npm run build`.
- Call `PUT /user/profile` with a BUSINESS JWT and verify `200 OK`.

Affected files:
- `src/modules/user/user.controller.ts`

Size: XS.

---

## ISSUE 2: Vendor Dashboard and Restaurant Status

Goal: give vendors operational visibility and control over restaurant availability.

### Task 2.1 [TODO]: Add vendor dashboard endpoint

Current state:
- No `GET /restaurant/manage/:restaurantId/dashboard` endpoint exists.
- `Order`, `OrderFood`, `Payment`, and restaurant ownership data already exist.

Required work:
- Add `GET /restaurant/manage/:restaurantId/dashboard`.
- Support `range=day|week|month` query.
- Reuse existing ownership check behavior in `RestaurantService`.
- Calculate delivered revenue, delivered order count, cancelled order count, and top 5 foods by quantity/revenue.

Acceptance criteria:
- BUSINESS can access only owned restaurants.
- ADMIN can access any restaurant.
- Revenue uses `Order.status = DELIVERED`.
- Decimal values are returned as numbers consistently with existing services.

Verification:
- Run `npm run build`.
- Create sample orders with different statuses and compare dashboard totals manually.

Affected files:
- `src/modules/restaurant/restaurant.controller.ts`
- `src/modules/restaurant/restaurant.service.ts`
- `src/modules/restaurant/dto/restaurant.dto.ts`

Size: Small.

### Task 2.2 [TODO]: Add restaurant open status and operating-hours APIs

Current state:
- Schema does not yet have `isOpen` or `operatingHours`.
- Existing restaurant update endpoint does not manage operational status.

Required work:
- Add `PATCH /restaurant/manage/:restaurantId/status`.
- Add `PATCH /restaurant/manage/:restaurantId/operating-hours`.
- Return `isOpen` and `operatingHours` in `GET /restaurant/detail/:restaurantId`.
- Consider filtering closed restaurants from customer discovery only if product wants hard hiding; otherwise expose status and let frontend label it.

Acceptance criteria:
- BUSINESS owner and ADMIN can update status/hours.
- `GET /restaurant/detail/:restaurantId` shows the updated status.
- Invalid operating-hours shape is rejected by DTO validation.

Verification:
- Run `npm run build`.
- Patch `isOpen: false`, then fetch restaurant detail and verify `isOpen` is false.

Affected files:
- `prisma/models/restaurant.prisma`
- `src/modules/restaurant/restaurant.controller.ts`
- `src/modules/restaurant/restaurant.service.ts`
- `src/modules/restaurant/dto/restaurant.dto.ts`

Size: Small.

---

## ISSUE 3: Ingredients and Toppings

Goal: complete ingredient management around the schema that already exists.

### Task 3.1 [TODO]: Add public ingredients list endpoint

Current state:
- `Ingredient` exists.
- Seed contains ingredient data.
- No `GET /food/ingredients` endpoint exists.

Required work:
- Add `GET /food/ingredients`.
- Return all active ingredients with `id`, `name`, and `icon`.

Acceptance criteria:
- Endpoint is public like current food listing/detail endpoints.
- Response order is stable, preferably by `id ASC` or `name ASC`.

Verification:
- Run `npm run build`.
- Call `GET /food/ingredients` and verify JSON shape.

Affected files:
- `src/modules/food/food.controller.ts`
- `src/modules/food/food.service.ts`

Size: XS.

### Task 3.2 [PARTIAL]: Persist ingredients when creating/updating foods

Current state:
- `FoodIngredient` exists.
- Food create/update does not accept `ingredientIds`.

Required work:
- Add `ingredientIds?: number[]` to create/update food DTOs.
- For multipart/form-data compatibility, support array input from form submissions if needed by frontend.
- On create, write `FoodIngredient` rows.
- On update, replace old links with the submitted set when `ingredientIds` is provided.
- Keep image upload behavior unchanged.

Acceptance criteria:
- Creating a food with `ingredientIds` stores the links.
- Updating a food with `ingredientIds` replaces previous links.
- Omitting `ingredientIds` during update does not accidentally clear existing links.
- Ownership rules remain unchanged.

Verification:
- Run `npm run build`.
- Create and update a food, then verify `GET /food/:id` returns the chosen ingredients.

Affected files:
- `src/modules/food/dto/food.dto.ts`
- `src/modules/food/food.service.ts`

Size: Small.

### Task 3.3 [DONE]: Keep food detail ingredients response covered

Current state:
- `GET /food/:id` already includes `foodIngredients` mapped to `{ id, name, icon }`.

Required work:
- Keep this behavior while implementing Task 3.2.
- Add regression verification after create/update ingredient links.

Acceptance criteria:
- Food detail continues returning `foodIngredients` as a flat array.

Verification:
- Run `npm run build`.
- Call `GET /food/:id` for a seeded food that has ingredients.

Affected files:
- `src/modules/food/food.service.ts`

Size: XS.

---

## ISSUE 4: Food Reviews and Vendor Replies

Goal: support customer reviews for individual foods and vendor replies to restaurant reviews.

### Task 4.1 [TODO]: Add food rating APIs

Current state:
- `Food.rating` exists as an integer, but no `FoodRating` model or food rating endpoints exist.
- Existing restaurant rating flow allows one restaurant rating per user, but food rating needs order-completion checks.

Required work:
- Add `POST /food/:id/ratings`.
- Add `GET /food/:id/ratings`.
- Validate that the customer has a delivered order containing the food.
- Enforce one rating per customer per food per qualifying order/order item.
- Recalculate and persist `Food.rating` after successful rating changes.

Acceptance criteria:
- CUSTOMER can rate only foods they actually received in `DELIVERED` orders.
- Duplicate reviews for the same food/order context are blocked or updated according to chosen behavior.
- Food detail reflects updated average rating.

Verification:
- Run `npm run build`.
- Create a delivered order with a food, submit rating, then verify rating list and food detail.

Affected files:
- `prisma/models/food.prisma`
- `src/modules/food/food.controller.ts`
- `src/modules/food/food.service.ts`
- `src/modules/food/dto/food.dto.ts`

Size: Medium.

### Task 4.2 [TODO]: Add vendor reply to restaurant reviews

Current state:
- Restaurant reviews exist via `GET /restaurant/reviews/:restaurantId` and `POST /restaurant/reviews/:restaurantId`.
- `RestaurantRating` does not have reply fields.
- No reply endpoint exists.

Required work:
- Add `POST /restaurant/reviews/:reviewId/reply`.
- Store `reply` and `replyCreatedAt`.
- Include reply data in restaurant review responses and restaurant detail review snippets.

Acceptance criteria:
- BUSINESS owner of the restaurant can reply.
- ADMIN can reply.
- Other BUSINESS users receive `403`.
- Empty reply is rejected.

Verification:
- Run `npm run build`.
- Reply as owner and non-owner to verify success and forbidden cases.

Affected files:
- `prisma/models/restaurant.prisma`
- `src/modules/restaurant/restaurant.controller.ts`
- `src/modules/restaurant/restaurant.service.ts`
- `src/modules/restaurant/dto/restaurant.dto.ts`

Size: Small.

---

## ISSUE 5: Advanced Search and Location Sorting

Goal: make restaurant and food discovery match frontend filtering needs.

### Task 5.1 [TODO]: Add restaurant GPS/rating filtering and sorting

Current state:
- `GET /restaurant` supports `limit`, `offset`, `keyword`, and `categoryId`.
- Address has `latitude` and `longitude`.
- Restaurant average rating is calculated in service from ratings.

Required work:
- Extend `GetRestaurantsQueryDto` with `latitude`, `longitude`, `minRating`, and `sortBy`.
- Support `sortBy=DISTANCE|RATING|NEWEST`.
- Calculate distance with Haversine in service or raw SQL.
- Filter by `minRating`.
- Include `distanceKm` when coordinates are provided.

Acceptance criteria:
- Existing calls without new query params behave the same.
- Distance sorting is stable and correct for sample coordinates.
- Rating sorting uses calculated average rating.

Verification:
- Run `npm run build`.
- Call `GET /restaurant?latitude=...&longitude=...&sortBy=DISTANCE`.

Affected files:
- `src/modules/restaurant/restaurant.controller.ts`
- `src/modules/restaurant/restaurant.service.ts`
- `src/modules/restaurant/dto/restaurant.dto.ts`

Size: Medium.

### Task 5.2 [TODO]: Add food price/rating filtering and sorting

Current state:
- `GET /food` supports `limit`, `offset`, `name`, `categoryId`, and `restaurantId`.
- Food list always orders by `id DESC`.

Required work:
- Extend `FoodQueryDto` with `minPrice`, `maxPrice`, `minRating`, and `sortBy`.
- Support `sortBy=PRICE_ASC|PRICE_DESC|RATING|NEWEST`.
- Keep `isAvailable: true` behavior.

Acceptance criteria:
- Price filters are inclusive.
- Rating filter uses `Food.rating`.
- Existing calls without new query params behave the same.

Verification:
- Run `npm run build`.
- Call `GET /food?minPrice=...&maxPrice=...&sortBy=PRICE_ASC`.

Affected files:
- `src/modules/food/food.service.ts`
- `src/modules/food/dto/food.dto.ts`

Size: Small.

---

## ISSUE 6: MoMo and Cash Payment Flow Sync

Goal: finish the payment state machine around the existing payment snapshot behavior.

### Task 6.1 [PARTIAL]: Align MoMo QR/payment response with frontend needs

Current state:
- `POST /order` creates a payment snapshot.
- MoMo returns a real response when configured, otherwise a mock `payUrl`.
- Mock response currently includes `qrCodeUrl: ""`.
- CASH creates an `UNPAID` payment snapshot.

Required work:
- Decide the exact frontend field contract for QR display: prefer `paymentInformation.payUrl` for hosted payment and `paymentInformation.qrCodeUrl` for QR image.
- If frontend needs a QR image URL, populate a deterministic mock/static `qrCodeUrl` when MoMo credentials are unavailable.
- Keep initial `paymentStatus` as `UNPAID`.

Acceptance criteria:
- `POST /order` with `paymentMethod=MOMO` returns a usable frontend payment URL or QR URL.
- CASH still returns payment snapshot data.
- Existing order creation transaction stays atomic.

Verification:
- Run `npm run build`.
- Create a MOMO order and inspect `paymentInformation`.

Affected files:
- `src/modules/payment/payment.service.ts`
- `src/modules/order/order.service.ts`

Size: Small.

### Task 6.2 [TODO]: Add vendor/admin confirm payment endpoint

Current state:
- `POST /payment/check-payment` updates payment status by MoMo order id.
- `GET /payment/:orderId` returns payment detail.
- Admin can update payment status via `PATCH /admin/payments/:paymentId`, but that does not represent vendor confirmation and does not update order status.

Required work:
- Add `PATCH /payment/manage/:paymentId/confirm` to match the existing singular `payment` route style.
- Allow BUSINESS owner of the payment's restaurant or ADMIN.
- Set `paymentStatus` to `DONE`.
- If the order is `PENDING`, set order status to `CONFIRMED`.
- Record audit log if consistent with existing admin/restaurant mutation patterns.

Acceptance criteria:
- BUSINESS owner can confirm.
- Other BUSINESS users receive `403`.
- ADMIN can confirm.
- Payment and order status update in the same transaction.

Verification:
- Run `npm run build`.
- Confirm payment as restaurant owner and verify `Payment.paymentStatus = DONE`, `Order.status = CONFIRMED`.

Affected files:
- `src/modules/payment/payment.controller.ts`
- `src/modules/payment/payment.service.ts`
- `src/modules/payment/payment.module.ts` if `AuditService` or guards need imports.

Size: Medium.

---

## ISSUE 7: Order Tracking and Real-Time Image Chat

Goal: allow order conversations to send image messages while preserving current Socket.IO flow.

### Task 7.1 [TODO]: Add image support to chat message storage

Current state:
- `ChatMessage` requires non-empty `content`.
- `Message` schema does not include `image`.
- `ChatService.storeDbAndEmitMessage` rejects empty text content.

Required work:
- Add `Message.image`.
- Update `ChatMessage` DTO with `content?: string` and `image?: string`.
- Accept messages with content, image, or both.
- Reject messages where both content and image are empty.
- Include `image` in selected/returned message payload.

Acceptance criteria:
- Text-only messages still work.
- Image-only messages work.
- Text+image messages work.
- Empty messages fail with a socket exception.

Verification:
- Run `npm run build`.
- Send image-only socket message and verify database row.

Affected files:
- `prisma/models/chat.prisma`
- `src/realtime/dto/chat.dto.ts`
- `src/realtime/chat.service.ts`

Size: Small.

### Task 7.2 [PARTIAL]: Verify and harden Socket.IO room flow

Current state:
- `ChatGateway` validates JWT from the authorization header.
- `joinRoom`, `leaveRoom`, and `TEXT_CHAT` exist.
- Messages are emitted to `room-{conversationId}`.

Required work:
- Regression-test two clients joining the same conversation.
- Ensure image payloads emit to all clients in the room.
- Consider supporting token from Socket.IO `auth` payload if frontend cannot send authorization headers during websocket handshake.

Acceptance criteria:
- Valid clients can join and leave rooms.
- Unauthorized clients are disconnected.
- Text and image messages are emitted to all clients in the same room.

Verification:
- Run `npm run build`.
- Test with two Socket.IO clients using valid JWTs.

Affected files:
- `src/realtime/chat.gateway.ts`
- `src/realtime/chat.service.ts`
- `src/realtime/dto/chat.dto.ts`

Size: Small.

---

## ISSUE 8: Admin and Restaurant Revenue Management

Goal: expose commission revenue calculations based on delivered orders.

### Task 8.1 [PARTIAL]: Add dedicated admin revenue endpoint

Current state:
- `GET /admin/dashboard` already returns `deliveredRevenue`.
- No `GET /admin/revenue` endpoint exists.
- Commission is not explicitly returned as 20%.

Required work:
- Add `GET /admin/revenue`.
- Calculate:
  - `grossRevenue = SUM(Order.totalPrice where DELIVERED)`.
  - `adminCommissionRate = 0.2`.
  - `adminRevenue = grossRevenue * 0.2`.
  - Optional grouped revenue by restaurant.

Acceptance criteria:
- ADMIN-only route.
- Decimal values returned as numbers.
- Empty delivered order set returns zero values.

Verification:
- Run `npm run build`.
- Create delivered orders and verify commission calculation.

Affected files:
- `src/modules/admin/admin.controller.ts`
- `src/modules/admin/admin.service.ts`

Size: Small.

### Task 8.2 [TODO]: Add restaurant net revenue endpoint

Current state:
- No `GET /restaurant/manage/:restaurantId/revenue` endpoint exists.

Required work:
- Add `GET /restaurant/manage/:restaurantId/revenue`.
- Allow BUSINESS owner or ADMIN.
- Calculate:
  - `grossRevenue = SUM(Order.totalPrice where DELIVERED and restaurantId)`.
  - `platformCommissionRate = 0.2`.
  - `platformCommission = grossRevenue * 0.2`.
  - `restaurantNetRevenue = grossRevenue * 0.8`.

Acceptance criteria:
- BUSINESS owner can view own restaurant revenue.
- Other BUSINESS users receive `403`.
- ADMIN can view any restaurant revenue.

Verification:
- Run `npm run build`.
- Compare returned values against delivered orders for a known restaurant.

Affected files:
- `src/modules/restaurant/restaurant.controller.ts`
- `src/modules/restaurant/restaurant.service.ts`

Size: Small.

---

## ISSUE 9: Maintenance and ERD Documentation

Goal: keep repository documentation aligned with the real schema and routes.

### Task 9.1 [TODO]: Update README ERD

Current state:
- README says `prisma/schema.prisma` is the ER model.
- README ERD contains `Menu`.
- Real schema uses `prisma/models` and links `Restaurant -> Food` directly.

Required work:
- Update README project structure to mention `prisma/models`.
- Remove `Menu` from Mermaid ERD.
- Add key new entities after implementation: `FoodRating`, `UserCard`, `Size`, `FoodSize`, `Notification`, `NotificationChannel`, `AuditLog`, `Conversation`, `Message`, `Ingredient`, and `FoodIngredient` if not already documented.

Acceptance criteria:
- Mermaid ERD renders without syntax errors.
- README no longer documents stale `Menu` relationship.
- README matches the final schema after feature issues are implemented.

Verification:
- Preview Mermaid rendering or validate syntax manually.
- Cross-check README entities against `prisma/models`.

Affected files:
- `README.md`

Size: XS.

### Task 9.2 [TODO]: Update backend architecture notes after implementation

Current state:
- `system-architecture.md` exists.
- Plan changes will affect payment, reviews, restaurant operations, chat, food size variants, and notifications.

Required work:
- Update architecture notes only after implementation lands.
- Document routes and business flows that actually exist.
- Avoid documenting speculative flows.

Acceptance criteria:
- Architecture docs match implemented code.
- Payment flow explains MoMo mock/real behavior and vendor confirm.
- Chat flow explains text/image message requirements.
- Notification flow explains event producers, channel delivery records, Firebase device delivery, and in-app read state.

Verification:
- Cross-check docs against controllers and services.

Affected files:
- `system-architecture.md`
- `README.md`

Size: Small.

---

## ISSUE 10: Food Size Variants

Goal: allow restaurants to configure fixed system sizes for foods, each with its own price, and make cart/order pricing use `foodSizeId` instead of trusting frontend text.

Recommended direction:
- Add a master `Size` table seeded with `S`, `M`, `L`, and `XL`.
- Add a food-size variant table, tentatively named `FoodSize`, to connect `Food` and `Size`.
- Store a separate `price` per `FoodSize`.
- Require each newly created food to have at least one size and exactly one default size.
- Backfill existing foods with one default size using the current `Food.price`.

Out of scope:
- Free-form restaurant-defined size labels.
- Per-size inventory.
- Extra topping pricing.
- Size-specific images.

### Task 10.1 [TODO]: Add `Size` and `FoodSize` schema plus seed data

Current state:
- `Food.price` is the only price source.
- There is no size model or relation.

Required work:
- Add `Size` model with fixed labels seeded as `S`, `M`, `L`, `XL`.
- Add `FoodSize` model with `foodId`, `sizeId`, `price`, `isDefault`, and optional soft-delete field if aligned with existing schema style.
- Add relations from `Food` to `FoodSize` and from `Size` to `FoodSize`.
- Add unique constraint to prevent duplicate size per food.
- Add a data migration or seed/backfill step that creates a default `FoodSize` for every existing food using `Food.price`.

Acceptance criteria:
- `Size` table contains exactly the initial labels `S`, `M`, `L`, `XL` after seed.
- Each existing food has at least one default `FoodSize` after migration/backfill.
- New schema validates with the repository multi-file Prisma setup.

Verification:
- Run `npx prisma validate`.
- Run `npx prisma migrate dev --name add_food_size_variants`.
- Run `npm run build`.
- Verify seeded sizes and backfilled food sizes in the database.

Affected files:
- `prisma/models/food.prisma`
- `prisma/seed/seed.ts`
- `prisma/seed/data.ts` if seed constants are stored there
- `prisma/migrations/*`

Size: Medium.

### Task 10.2 [TODO]: Require food sizes when creating/updating foods

Current state:
- `CreateFoodDto` and `UpdateFoodDto` accept a single `price`.
- `FoodService.createFood` writes only `Food.price`.
- `FoodService.updateFood` does not manage size variants.

Required work:
- Add DTO support for `sizes`, where each item contains `sizeId`, `price`, and `isDefault`.
- Require at least one size on `POST /food/manage`.
- Require exactly one `isDefault=true` among submitted sizes.
- Validate all `sizeId` values exist in `Size`.
- On create, write `FoodSize` rows in the same transaction as food creation.
- On update, replace submitted size variants when `sizes` is provided; do not clear variants when omitted.
- Keep `Food.price` as the default-size price or lowest display price for backward-compatible listing APIs.

Acceptance criteria:
- Creating a food without sizes fails validation.
- Creating a food with sizes succeeds and stores prices per size.
- Updating a food can change size prices and default size.
- Existing image upload and ingredient behavior remain compatible.

Verification:
- Run `npm run build`.
- Create a food with `S/M/L/XL` size prices and verify `FoodSize` rows.
- Update the default size and verify `Food.price` follows the chosen compatibility rule.

Affected files:
- `src/modules/food/dto/food.dto.ts`
- `src/modules/food/food.service.ts`
- `src/modules/food/food.controller.ts` only if request parsing needs route-level handling.

Size: Medium.

### Task 10.3 [TODO]: Expose sizes in food list/detail responses

Current state:
- `GET /food` returns food fields without size variants.
- `GET /food/:id` returns ingredients, category, and restaurant data but not size variants.

Required work:
- Include food sizes in `GET /food/:id`.
- Include enough size/default-price data in `GET /food` for frontend cards and selection UI.
- Ensure response values convert Prisma decimals to numbers.

Acceptance criteria:
- Food detail returns `sizes: [{ foodSizeId, sizeId, name, price, isDefault }]`.
- Food list returns either the same compact size list or at minimum default size and display price.
- Existing clients using `Food.price` continue to receive a sensible price.

Verification:
- Run `npm run build`.
- Call `GET /food` and `GET /food/:id` for a food with multiple sizes.

Affected files:
- `src/modules/food/food.service.ts`

Size: Small.

### Task 10.4 [TODO]: Make cart and order flows use `foodSizeId`

Current state:
- Cart and order flows use `foodId`, quantity, and current food price.
- `OrderFood.fullText` exists for snapshot text, but there is no structured size reference or size price snapshot.

Required work:
- Add `foodSizeId` to cart item/order item DTOs.
- Add `foodSizeId` relation or nullable reference to `CartItem` and `OrderFood`, plus snapshot fields if needed for size label/price history.
- Validate that `foodSizeId` belongs to the selected `foodId`.
- Use `FoodSize.price` as the source of truth for cart/order pricing.
- Snapshot size name and price in order items so historical orders remain correct if restaurant changes future size prices.
- Preserve backward compatibility for existing cart/order rows via nullable fields or migration backfill.

Acceptance criteria:
- Frontend submits `foodSizeId`, not raw text like `S/M/XL`.
- Backend rejects a size that does not belong to the selected food.
- Order total uses the selected size price.
- Order detail returns selected size information for each item.

Verification:
- Run `npm run build`.
- Add item to cart/order with a selected `foodSizeId` and verify total price.
- Try mismatched `foodId + foodSizeId` and verify validation error.

Affected files:
- `prisma/models/cart.prisma`
- `prisma/models/order.prisma`
- `src/modules/cart/dto/*` if DTO files exist or need to be created
- `src/modules/cart/cart.service.ts`
- `src/modules/order/dto/order.dto.ts`
- `src/modules/order/order.service.ts`

Size: Large.

---

## ISSUE 11: Event-Driven Notification System

Goal: redesign notifications around backend domain events, with one logical `Notification` and per-channel delivery records in `NotificationChannel`. Supported channels are `IN_APP` and `DEVICE`; event payloads can specify channels, defaulting to both.

Recommended direction:
- Keep `Notification` as the logical message shown to a user.
- Add `NotificationChannel` as the delivery record for each channel of a notification.
- Add notification channel enum values: `IN_APP`, `DEVICE`.
- Add delivery status values such as `PENDING`, `SENT`, `FAILED`, and optionally `SKIPPED`.
- Use backend events so order/chat/voucher/review/approval flows publish notification intents instead of calling Firebase or notification persistence directly.
- Do not put accept/reject order business logic inside notification module. Store action metadata in notification payload and let order APIs handle status changes.

Out of scope:
- User-level notification preference toggles.
- Email/SMS channels.
- Complex queue/retry infrastructure.
- Realtime websocket notification delivery beyond existing in-app fetch/read APIs.

### Task 11.1 [TODO]: Redesign notification schema and channel delivery records

Current state:
- `Notification` exists with `title`, `body`, `type`, `userId`, `readAt`, and timestamps.
- There is no `NotificationChannel`.
- Firebase delivery success/failure is not persisted.

Required work:
- Extend `Notification` to support logical notification metadata:
  - recipient user relation.
  - `title`, `body`, `type`.
  - optional `targetType`, `targetId`, `actorId`, and `metadata Json`.
  - `readAt` for in-app read state.
- Add `NotificationChannel` model:
  - `notificationId`.
  - `channel` as `IN_APP` or `DEVICE`.
  - `status`.
  - `sentAt`, `failedAt`, `error`.
  - optional provider/message metadata for Firebase responses.
- Add indexes for recipient notification list, unread counts, channel status, and created time.
- Preserve or migrate existing notification rows into the new logical notification shape.

Acceptance criteria:
- A logical notification can have one or two delivery records.
- IN_APP delivery can be marked as `SENT` once persisted/visible.
- DEVICE delivery records store Firebase success/failure state.
- Existing notification list/read APIs can continue working against the new schema.

Verification:
- Run `npx prisma validate`.
- Run `npx prisma migrate dev --name event_driven_notifications`.
- Run `npm run build`.

Affected files:
- `prisma/models/notification.prisma`
- `prisma/models/base.prisma`
- `prisma/models/user.prisma`
- `prisma/migrations/*`

Size: Medium.

### Task 11.2 [TODO]: Add notification event contract and listener

Current state:
- `NotificationService.pushNotification()` directly creates a notification and sends Firebase.
- There is no shared domain event contract for notification-producing modules.

Required work:
- Add event infrastructure using the project's NestJS module style, for example `@nestjs/event-emitter` if selected during implementation.
- Define a notification event payload contract with:
  - `recipientUserId`.
  - `title`, `body`, `type`.
  - optional `channels`, defaulting to `[IN_APP, DEVICE]`.
  - optional `targetType`, `targetId`, `actorId`, `metadata`, and `actions`.
- Add a listener in notification module that creates the logical notification and channel records.
- Ensure notification send failures do not break the original business transaction.

Acceptance criteria:
- Business modules emit a notification event instead of directly calling Firebase.
- Missing `channels` defaults to both `IN_APP` and `DEVICE`.
- Listener creates channel records consistently.
- Firebase/device failures are isolated and recorded.

Verification:
- Run `npm run build`.
- Emit a test notification event and verify notification plus channel rows.

Affected files:
- `src/modules/notification/notification.module.ts`
- `src/modules/notification/notification.service.ts`
- `src/modules/notification/events/*` or equivalent event contract location
- `src/app.module.ts` if a root event emitter module is required.
- `package.json` if a new Nest event dependency is selected.

Size: Medium.

### Task 11.3 [TODO]: Implement IN_APP and DEVICE channel delivery behavior

Current state:
- In-app rows are created in `Notification`.
- Device push sends directly through Firebase to all registered device tokens.
- Device delivery outcome is not recorded per channel.

Required work:
- Implement IN_APP channel delivery as persisted notification visibility for `GET /notification/me`.
- Implement DEVICE channel delivery using `FirebaseService` and registered `Device` tokens.
- Record delivery status per channel:
  - `SENT` when at least one device send succeeds, or when IN_APP is visible.
  - `FAILED` when Firebase send fails for all device tokens.
  - `SKIPPED` if there are no registered devices, if this status is adopted.
- Keep existing notification read APIs and update them if the schema changes.
- Remove or restrict `GET /notification/test` from production-facing behavior in the plan implementation.

Acceptance criteria:
- `IN_APP` notification appears in `GET /notification/me`.
- `DEVICE` sends Firebase payload containing notification id, type, target, and metadata.
- Firebase failures are recorded without throwing away the in-app notification.
- Mark-as-read and mark-all-as-read still work.

Verification:
- Run `npm run build`.
- Register a device token, emit DEVICE notification, and verify Firebase call path plus channel status.
- Emit IN_APP-only notification and verify no Firebase send is attempted.

Affected files:
- `src/modules/notification/notification.service.ts`
- `src/modules/notification/notification.controller.ts`
- `src/modules/notification/firebase/firebase.service.ts`
- `src/modules/device/device.service.ts`
- `src/modules/notification/dto/notification.dto.ts`

Size: Medium.

### Task 11.4 [TODO]: Emit notification events from order lifecycle changes

Current state:
- Order status updates exist through order service/controller.
- Notification is not integrated into order status changes.

Required work:
- Emit notification events for order status transitions:
  - `CONFIRMED`: Customer sees "Order Received" when restaurant accepts the order.
  - `PREPARING`: Customer sees "Preparing" when restaurant starts preparing.
  - `DELIVERING`: Customer sees "On the Way" when driver starts delivery.
  - `DELIVERED`: Customer sees "Delivered" when delivery succeeds.
  - `CANCELLED`: Customer sees "Canceled" when order is canceled.
- Emit restaurant-owner notification when customer creates a new order.
- New-order notification metadata must include order ID, customer name, total amount, and item summary.
- New-order notification actions must include `ACCEPT_ORDER` and `REJECT_ORDER`, with `targetType=ORDER` and `targetId=orderId`.
- Keep accept/reject business logic in the order module, using existing order status update capability or a dedicated order endpoint if implemented later.

Acceptance criteria:
- Customers receive correct status notifications.
- Restaurant owners receive new-order notifications.
- New-order notification payload contains action metadata for frontend buttons.
- Channels default to both IN_APP and DEVICE unless explicitly overridden.

Verification:
- Run `npm run build`.
- Create an order and verify restaurant notification payload.
- Change order status through each lifecycle state and verify customer notifications.

Affected files:
- `src/modules/order/order.service.ts`
- `src/modules/order/order.controller.ts` only if route behavior changes.
- `src/modules/notification/events/*`

Size: Medium.

### Task 11.5 [TODO]: Emit notification events from chat, voucher, review, and approval flows

Current state:
- Chat stores and emits socket messages, but does not create notifications.
- Voucher module exists, but voucher create/update is not connected to notification.
- Restaurant review creation exists, but restaurant owner is not notified.
- Admin approval endpoint exists, but restaurant owner is not notified.

Required work:
- Chat:
  - Customer receives notification when restaurant replies.
  - Restaurant receives notification when customer sends a message.
  - Metadata includes conversation ID, order ID if available, preview message, sender name, and unread count if feasible.
- Voucher:
  - Emit "New voucher available" notification when a new active voucher/promotion is created.
  - Recipient scope must be explicit during implementation. MVP can target all CUSTOMER users or a narrower eligible group if defined later.
- Restaurant review:
  - Restaurant owner receives notification when customer reviews the restaurant.
  - Metadata includes rating, comment, customer name, restaurant ID, and review ID.
- Restaurant approval:
  - Restaurant owner receives accept/reject notification when ADMIN updates approval.
  - Metadata includes restaurant ID, restaurant name, and approved status.

Acceptance criteria:
- Each listed source emits notification events with target and metadata.
- Chat notifications route to the opposite party only.
- Review/approval notifications route to the restaurant owner.
- Voucher recipient scope is documented in code or task notes during implementation.

Verification:
- Run `npm run build`.
- Exercise each event source and verify notification plus channel records.

Affected files:
- `src/realtime/chat.service.ts`
- `src/modules/voucher/voucher.service.ts`
- `src/modules/restaurant/restaurant.service.ts`
- `src/modules/admin/admin.service.ts`
- `src/modules/notification/events/*`

Size: Large.

### Task 11.6 [TODO]: Update notification APIs for listing, unread counts, and delivery visibility

Current state:
- `GET /notification/me`, mark-read, and mark-all-read already exist.
- There is no unread-count endpoint.
- There is no delivery/channel filter.

Required work:
- Keep `GET /notification/me` compatible.
- Add filters for `type`, `read`, and optionally `channel`.
- Add unread count endpoint, for example `GET /notification/me/unread-count`.
- Return metadata/actions in notification list so frontend can render order accept/reject and deep links.
- Avoid exposing internal Firebase errors to normal users.

Acceptance criteria:
- Frontend can list notifications, show unread count, mark one/all as read, and render action metadata.
- Users can only read their own notifications.
- Admin/test notification endpoints are not exposed as casual public tools.

Verification:
- Run `npm run build`.
- Call list/unread/read endpoints with a JWT and verify ownership filtering.

Affected files:
- `src/modules/notification/notification.controller.ts`
- `src/modules/notification/notification.service.ts`
- `src/modules/notification/dto/notification.dto.ts`

Size: Small.

---

## ISSUE 12: Frontend Order API Compatibility

Goal: add and adjust order APIs required by the frontend without breaking existing backend consumers. Existing enum-based order APIs should keep working; frontend-specific behavior is activated through the requested routes and `status=ongoing|history`.

Recommended direction:
- Keep existing `GET /orders?status=<OrderStatus>` behavior for old clients.
- Add frontend-compatible behavior for `GET /orders?status=ongoing|history`.
- Add missing frontend endpoints:
  - `POST /orders/:orderId/reorder`.
  - `GET /orders/:orderId/status`.
  - `POST /orders/:orderId/cancel` or `PUT /orders/:orderId/cancel`; prefer `POST` unless frontend has already fixed `PUT`.
- Add status mapping helpers so backend enum stays unchanged while frontend receives mobile/app-friendly statuses.

Status mapping:
- `PENDING` -> `RECEIVED`, `status_step: 0`.
- `CONFIRMED` -> `RECEIVED`, `status_step: 0`.
- `PREPARING` -> `PREPARING`, `status_step: 1`.
- `DELIVERING` -> `ON_THE_WAY`, `status_step: 2`.
- `DELIVERED` -> `DELIVERED`, `status_step: 3`.
- `CANCELLED` -> `CANCELED`, terminal state; use `status_step: -1` unless frontend specifies another terminal representation.

Out of scope:
- Changing Prisma `OrderStatus` enum names.
- Rewriting order module internals from scratch.
- Realtime driver tracking.
- Driver assignment/location APIs.

### Task 12.1 [TODO]: Add reorder endpoint

Current state:
- There is no `POST /orders/:orderId/reorder`.
- Cart service already exists and can be reused for cart item persistence.
- Order detail stores previous order foods, but size support will later require `foodSizeId` from Issue 10.

Required work:
- Add `POST /orders/:orderId/reorder`.
- Allow CUSTOMER owner of the original order to reorder.
- Load items from the old order and add them to the user's cart.
- Validate foods are still available and belong to an active/approved restaurant if that rule is enforced elsewhere.
- Preserve selected `foodSizeId` when Issue 10 is implemented; until then, use existing `foodId` and quantity behavior.
- Return updated cart info in the same shape as the existing cart API.

Acceptance criteria:
- Customer can reorder their own previous order.
- Customer cannot reorder another user's order.
- Missing/deleted/unavailable foods are skipped or rejected according to a documented rule.
- Response includes updated cart info.

Verification:
- Run `npm run build`.
- Create an order, call reorder, and verify cart items are added.
- Try reorder using another customer and verify `403`.

Affected files:
- `src/modules/order/order.controller.ts`
- `src/modules/order/order.service.ts`
- `src/modules/cart/cart.service.ts`
- `src/modules/cart/cart.module.ts` if service export/import changes are needed.

Size: Medium.

### Task 12.2 [TODO]: Add polling order status endpoint

Current state:
- There is no dedicated status polling endpoint.
- `GET /orders/:orderId` returns full order details.

Required work:
- Add `GET /orders/:orderId/status`.
- Return `{ order_id, status, status_step, updated_at }`.
- Use the frontend status mapping defined in this issue.
- Ensure customer/business/admin access rules match `GET /orders/:orderId`.

Acceptance criteria:
- Endpoint is lightweight and safe for polling.
- `updated_at` is an ISO string.
- Access control matches existing order detail rules.

Verification:
- Run `npm run build`.
- Change order status and verify mapped status response.

Affected files:
- `src/modules/order/order.controller.ts`
- `src/modules/order/order.service.ts`

Size: Small.

### Task 12.3 [TODO]: Support frontend order list grouping

Current state:
- `GET /orders` accepts `limit`, `offset`, and enum `status`.
- Response is a single array.
- Frontend wants `GET /orders?status=ongoing|history`.

Required work:
- Extend `GetOrdersQueryDto` to accept either backend enum values or frontend values `ongoing|history`.
- Keep existing enum behavior unchanged.
- When `status=ongoing`, return orders whose backend status is one of `PENDING`, `CONFIRMED`, `PREPARING`, `DELIVERING`.
- When `status=history`, return orders whose backend status is one of `DELIVERED`, `CANCELLED`.
- For frontend mode, return grouped shape:
  - `ongoing_orders` for ongoing requests.
  - `history_orders` for history requests.
  - optionally both arrays if no status grouping is requested by a later frontend contract.
- Add fields required by frontend:
  - `item_count`.
  - `type` such as `FOOD` or `DRINK`; default to `FOOD` unless category-driven classification is implemented.
  - `date` as ISO string.
  - mapped `status` and `status_step`.

Acceptance criteria:
- Old `GET /orders?status=PENDING` still returns the current compatible array shape.
- New `GET /orders?status=ongoing` returns `ongoing_orders`.
- New `GET /orders?status=history` returns `history_orders`.
- Returned orders include frontend-required summary fields.

Verification:
- Run `npm run build`.
- Create orders in multiple statuses and verify both old enum and new grouped query behavior.

Affected files:
- `src/modules/order/order.controller.ts`
- `src/modules/order/order.service.ts`
- `src/modules/order/dto/order.dto.ts`

Size: Medium.

### Task 12.4 [TODO]: Add cancel endpoint compatibility

Current state:
- Cancel currently uses `DELETE /orders/:orderId`.
- Frontend expects `POST /orders/:orderId/cancel` or `PUT /orders/:orderId/cancel`.
- Existing response is only `{ message }`.

Required work:
- Add `POST /orders/:orderId/cancel` as frontend-compatible cancel endpoint.
- Optionally support `PUT /orders/:orderId/cancel` if frontend cannot use POST.
- Reuse existing cancellation rules from `deleteOrderById`.
- Return frontend-friendly response including:
  - `order_id`.
  - `new_status`.
  - mapped frontend `status`.
  - `status_step`.
  - `message`.
- Keep existing `DELETE /orders/:orderId` behavior for backward compatibility.

Acceptance criteria:
- Existing DELETE cancel still works.
- New cancel endpoint works for cancellable statuses.
- New response includes order id and new status.
- Non-cancellable statuses still return an error.

Verification:
- Run `npm run build`.
- Cancel a `PENDING` order through the new endpoint and verify response.
- Try canceling a `DELIVERED` order and verify error.

Affected files:
- `src/modules/order/order.controller.ts`
- `src/modules/order/order.service.ts`

Size: Small.

### Task 12.5 [TODO]: Add frontend fields to order detail response

Current state:
- `GET /orders/:orderId` exists.
- Response does not include `expected_arrival`.
- Response shape may not match frontend expectations.

Required work:
- Add `expected_arrival` to order detail response.
- Derive expected arrival from restaurant estimated delivery time, order timestamps, or a conservative fallback if the schema lacks order timestamps.
- Include mapped frontend status fields in detail response:
  - `status`.
  - `status_step`.
  - optionally `backend_status` for debugging/compatibility.
- Ensure item summaries are compatible with Issue 10 size variants when implemented.

Acceptance criteria:
- Order detail includes `expected_arrival` as an ISO string or `null` with documented fallback.
- Order detail includes mapped frontend status.
- Existing access control remains unchanged.

Verification:
- Run `npm run build`.
- Fetch order detail and verify frontend-required fields.

Affected files:
- `src/modules/order/order.service.ts`

Size: Small.

### Task 12.6 [TODO]: Centralize order frontend mapping helpers

Current state:
- Status mapping logic does not exist.
- Response shaping is embedded in service methods.

Required work:
- Add helper methods for:
  - mapping backend status to frontend status.
  - mapping backend status to `status_step`.
  - classifying ongoing/history.
  - formatting order summary fields.
- Keep helpers private to order service unless reused elsewhere.

Acceptance criteria:
- Status mapping is implemented once and reused by list/status/detail/cancel responses.
- Mapping matches the table in this issue.
- Tests or manual verification cover every `OrderStatus` enum value.

Verification:
- Run `npm run build`.
- Manually verify all enum statuses map as expected.

Affected files:
- `src/modules/order/order.service.ts`
- `src/modules/order/dto/order.dto.ts` if response/query DTOs are added.

Size: Small.

---

## Recommended Implementation Order

1. Issue 1: schema and permission foundation.
2. Issue 10: food size variants, because food create/update and order pricing depend on it.
3. Issue 12: frontend order API compatibility, because customer order screens depend on these endpoints.
4. Issue 3: complete ingredients because schema foundation already exists.
5. Issue 2: vendor dashboard/status.
6. Issue 4: ratings and replies.
7. Issue 6: payment confirmation flow.
8. Issue 8: revenue endpoints.
9. Issue 7: image chat.
10. Issue 11: event-driven notification system.
11. Issue 5: advanced filtering and distance sorting.
12. Issue 9: documentation sync after code is real.

Reasoning:
- Schema work must land first because later issues depend on it.
- Size variants should land before food management/order-pricing work expands further, otherwise cart/order totals will need to be reworked twice.
- Order API compatibility should land early because frontend order history/detail/reorder/polling screens depend on it and notification events reuse order status semantics.
- Ingredients can be finished quickly and unlock frontend food management.
- Payment/revenue work should share delivered-order assumptions.
- Notifications should land after the main event source flows exist, then wire events across order, chat, voucher, review, and approval.
- README/architecture docs should be finalized after implementation, not before.

---

## Checkpoints

### Checkpoint 1: Foundation complete

- [ ] `npx prisma validate` passes.
- [ ] Migration applies cleanly.
- [ ] `npm run build` passes.
- [ ] BUSINESS can update profile.

### Checkpoint 2: Vendor management complete

- [ ] Vendor dashboard returns delivered revenue, order counts, and top foods.
- [ ] Restaurant open status and operating hours persist and appear in detail API.

### Checkpoint 3: Food management and feedback complete

- [ ] `Size` seed contains `S`, `M`, `L`, `XL`.
- [ ] Food create/update requires at least one size and exactly one default size.
- [ ] Food list/detail expose size variants and prices.
- [ ] Cart/order uses `foodSizeId` and calculates totals from selected size price.
- [ ] Ingredients list endpoint works.
- [ ] Food create/update persists ingredient links.
- [ ] Food detail returns selected ingredients.
- [ ] Customer can rate delivered foods.
- [ ] Vendor can reply to restaurant reviews.

### Checkpoint 4: Payment and revenue complete

- [ ] `POST /orders/:orderId/reorder` adds previous items to cart and returns cart info.
- [ ] `GET /orders/:orderId/status` returns mapped status polling payload.
- [ ] `GET /orders?status=ongoing|history` returns frontend grouped shape while enum status compatibility remains.
- [ ] `POST /orders/:orderId/cancel` works and returns `order_id` plus `new_status`.
- [ ] `GET /orders/:orderId` includes `expected_arrival` and mapped status fields.
- [ ] MOMO order response includes frontend-usable payment URL or QR URL.
- [ ] BUSINESS owner can confirm payment.
- [ ] Confirmed payment updates order status to `CONFIRMED` when appropriate.
- [ ] Admin revenue returns 20% commission.
- [ ] Restaurant revenue returns 80% net revenue.

### Checkpoint 5: Discovery and chat complete

- [ ] Restaurant search supports distance and rating filters.
- [ ] Food search supports price and rating filters.
- [ ] Socket chat supports text-only, image-only, and text+image messages.

### Checkpoint 6: Notification complete

- [ ] `Notification` and `NotificationChannel` schema supports logical message plus IN_APP/DEVICE delivery records.
- [ ] Notification events default to `[IN_APP, DEVICE]` when channels are omitted.
- [ ] Order lifecycle, new order, chat, voucher, review, and restaurant approval events create notifications.
- [ ] DEVICE channel records Firebase success/failure without breaking business flows.
- [ ] Notification list, read state, unread count, metadata, and actions work for the recipient user.

### Checkpoint 7: Documentation complete

- [ ] README ERD no longer contains `Menu`.
- [ ] README and `system-architecture.md` match implemented routes and schema.
- [ ] Final `npm run build` passes.

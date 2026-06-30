# Food Delivery Backend

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-runtime-000000?style=for-the-badge&logo=bun&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Admin-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Socket.IO](https://img.shields.io/badge/Socket.IO-realtime-010101?style=for-the-badge&logo=socketdotio&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-storage-C72E49?style=for-the-badge&logo=minio&logoColor=white)

## Overview

Food Delivery Backend is a NestJS API for a food delivery application. It handles authentication, users, addresses, restaurants, foods, carts, orders, payments, vouchers, notifications, chat, search, and admin workflows. The backend uses Prisma with PostgreSQL, Socket.IO for realtime chat, Firebase Admin for push notifications, MinIO for local object storage, and Mailpit for local email testing.

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Bun |
| Backend framework | NestJS 11 |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Local resources | Docker Compose |
| Object storage | MinIO |
| Email testing | Mailpit |
| Push notifications | Firebase Admin SDK |
| Realtime | Socket.IO |
| API docs | Swagger + Scalar at `/api/docs` in non-production mode |

## Prerequisites

- Bun installed
- Docker and Docker Compose installed
- Firebase service account for notification features

## Local Backend Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Start local resources with Docker

For local backend development, run the infrastructure services and start the API from your machine:

```bash
docker compose up -d postgres minio mailpit
```

Local resource URLs:

| Resource | URL / Port | Default credentials |
| --- | --- | --- |
| PostgreSQL | `localhost:5430` | `admin` / `admin` |
| MinIO API | `http://localhost:9000` | `minioadmin` / `minioadmin` |
| MinIO Console | `http://localhost:9001` | `minioadmin` / `minioadmin` |
| Mailpit SMTP | `localhost:1025` | none |
| Mailpit UI | `http://localhost:8025` | none |

The `api` service also exists in `docker-compose.yaml`, but the easiest local development flow is to run only `postgres`, `minio`, and `mailpit` in Docker, then run the NestJS server with `bun dev`.

### 3. Create `.env`

Copy the example file:

```bash
cp .env.example .env
```

Use these local development values as the base:

```env
PORT=4000
DATABASE_URL="postgresql://admin:admin@localhost:5430/app_db?schema=public"
NODE_ENV='development'

EMAIL_HOST=localhost
EMAIL_PORT=1025
EMAIL_FROM="deliveryapplication@gmail.com"

MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_USER=minioadmin
MINIO_PASSWORD=minioadmin
MINIO_BUCKET="deliveryapp"
MINIO_ENDPOINT="localhost"
MINIO_PUBLIC_URL=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

Also fill in these groups depending on the feature you are testing:

| Group | Variables |
| --- | --- |
| JWT and OTP | `ACCESS_SECRET_KEY`, `REFRESH_SECRET_KEY`, `VERIFY_OTP_KEY`, `RESET_PASSWORD_KEY`, `RESET_EMAIL_KEY` |
| Firebase | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFICATION_OTP_SERVICE_SID`, `TWILIO_SENDING_SMS_SERVICE_SID`, `TWILIO_SENDER_PHONE_NUMBER` |
| Facebook login | `APP_ID`, `APP_SECRET` |
| MoMo payment | `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY` |
| Public callback/testing | `NGROK_URL` |

### 4. Configure Firebase

Notifications require a Firebase service account. You can configure it in either of these ways.

Option A: use environment variables in `.env`:

```env
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Keep newline characters in `FIREBASE_PRIVATE_KEY` escaped as `\n`. The backend converts them before initializing Firebase Admin.

Option B: use a service account JSON file:

1. Download the Firebase Admin service account JSON from Firebase Console.
2. Put it at the project root as `firebase-credential.json`, or set `FIREBASE_CREDENTIAL_PATH` / `GOOGLE_APPLICATION_CREDENTIALS` to the file path.
3. Make sure the JSON contains `project_id`, `client_email`, and `private_key`.

Do not commit real Firebase credentials or production secrets.

### 5. Prepare the database

The Prisma schema is split across files in `prisma/models`. `prisma.config.ts` points Prisma to that folder and reads `DATABASE_URL` from `.env`.

Generate the Prisma client:

```bash
bunx prisma generate
```

Apply existing migrations:

```bash
bunx prisma migrate deploy
```

For quick local development, you can push the current schema directly instead:

```bash
bunx prisma db push
```

Seed local data:

```bash
bunx prisma db seed
```

### 6. Run the backend

```bash
bun dev
```

The API runs at:

```text
http://localhost:4000/api
```

In development, API documentation is available at:

```text
http://localhost:4000/api/docs
```

## Useful Commands

| Command | Description |
| --- | --- |
| `bun install` | Install dependencies |
| `docker compose up -d postgres minio mailpit` | Start local backend resources |
| `docker compose down` | Stop Docker resources |
| `bunx prisma generate` | Generate Prisma client |
| `bunx prisma migrate deploy` | Apply checked-in migrations |
| `bunx prisma db push` | Push schema directly for local development |
| `bunx prisma db seed` | Seed local database |
| `bun dev` | Start backend in watch mode |
| `bun run build` | Build TypeScript output |
| `bun run start:prod` | Run compiled production build |
| `bun test` | Run unit tests |
| `bun run test:e2e` | Run e2e tests |

## Database Schema

The database uses PostgreSQL with Prisma models stored in `prisma/models`.

Schema entrypoint:

- `prisma.config.ts` sets `schema: "prisma/models"`
- `prisma/models/schema.prisma` defines Prisma generators and the PostgreSQL datasource
- Domain models are split by feature, for example `user.prisma`, `restaurant.prisma`, `food.prisma`, `order.prisma`, and `notification.prisma`

### Model Groups

| Group | Models |
| --- | --- |
| Auth and users | `User`, `UserRole`, `OTP`, `Identity`, `AuthToken`, `Device`, `UserCard` |
| Addresses | `Address`, `UserAddress` |
| Restaurant catalog | `Restaurant`, `RestaurantRating`, `Category`, `Food`, `Size`, `FoodSize`, `Ingredient`, `FoodIngredient`, `FoodRating` |
| Cart and order | `Cart`, `CartItem`, `Order`, `OrderFood`, `Payment`, `Voucher` |
| Social and discovery | `UserFavoriteRestaurant`, `SearchHistory` |
| Chat | `Conversation`, `Message` |
| Notifications | `Notification`, `NotificationChannel` |
| Audit | `AuditLog` |

### Main Relationships

```mermaid
erDiagram
    User ||--o{ UserRole : has
    User ||--o{ Identity : owns
    User ||--o{ Device : registers
    User ||--o{ UserCard : stores
    User ||--o{ UserAddress : saves
    User ||--o{ Restaurant : owns
    User ||--o| Cart : owns
    User ||--o{ Order : places
    User ||--o{ RestaurantRating : writes
    User ||--o{ FoodRating : writes
    User ||--o{ UserFavoriteRestaurant : favorites
    User ||--o{ SearchHistory : searches
    User ||--o{ Notification : receives
    User ||--o{ Conversation : customer
    User ||--o{ Conversation : seller
    User ||--o{ Message : sends
    User ||--o{ AuditLog : acts

    Address ||--o{ UserAddress : linked_to
    Address ||--o{ Restaurant : locates
    Address ||--o{ Order : delivers_to

    Restaurant ||--o{ Food : sells
    Restaurant ||--o{ RestaurantRating : receives
    Restaurant ||--o{ Voucher : offers
    Restaurant ||--o{ Order : receives
    Restaurant ||--o{ UserFavoriteRestaurant : favorited_by

    Category ||--o{ Food : categorizes
    Food ||--o{ FoodSize : has
    Size ||--o{ FoodSize : defines
    Food ||--o{ FoodIngredient : uses
    Ingredient ||--o{ FoodIngredient : included_in
    Food ||--o{ FoodRating : receives
    Food ||--o{ CartItem : added_as
    Food ||--o{ OrderFood : ordered_as
    FoodSize ||--o{ CartItem : selected
    FoodSize ||--o{ OrderFood : selected

    Cart ||--o{ CartItem : contains
    Order ||--o{ OrderFood : contains
    Order ||--o| Payment : paid_by
    Order ||--o{ FoodRating : reviewed_by_food
    Order ||--o| RestaurantRating : reviewed_by_restaurant
    Voucher ||--o{ Order : applied_to

    Notification ||--o{ NotificationChannel : delivered_through
    Conversation ||--o{ Message : contains
```

### Enums

Core enums are defined in `prisma/models/base.prisma`:

- `Role`: `ADMIN`, `BUSINESS`, `CUSTOMER`
- `RestaurantApprovalStatus`: `PENDING`, `APPROVED`, `REJECTED`
- `TokenType`: `ACCESS`, `REFRESH`
- `OTPType`: `RESET_PASSWORD_OTP`, `RESET_EMAIL_OTP`, `VERIFY_OTP`
- `AuthProvider`: `LOCAL`, `FACEBOOK`, `GOOGLE`
- `OrderStatus`: `PENDING`, `CONFIRMED`, `PREPARING`, `DELIVERING`, `DELIVERED`, `CANCELLED`
- `ConfirmedBy`: `CUSTOMER`, `SYSTEM`, `ADMIN`
- `PaymentMethod`: `MOMO`, `CASH`
- `PaymentStatus`: `UNPAID`, `FAILED`, `SOLVING`, `DONE`
- `VoucherType`: `PERCENT`, `MONEY`
- `VoucherStatus`: `APPLYING`, `ENDED`
- `NotificationType`: `SYSTEM`, `ORDER`, `PAYMENT`, `PROMOTION`, `CHAT`
- `DeliveryChannel`: `IN_APP`, `DEVICE`
- `DeliveryStatus`: `PENDING`, `SENT`, `FAILED`, `SKIPPED`

## Notes

- Keep `.env`, Firebase credentials, and production secrets out of git.
- Run `bunx prisma generate` after schema changes.
- Use Mailpit for local email testing instead of a real SMTP account.
- Use MinIO locally for upload flows that need object storage.

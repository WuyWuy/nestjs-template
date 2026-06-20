# Food Delivery Backend (NestJS)

![Build](https://img.shields.io/badge/build-passing-brightgreen?logo=githubactions&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-%23E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue?logo=open-source-initiative&logoColor=white)

## 🚀 Project Overview

This repository is a backend template for a food delivery app built with NestJS. It provides API modules for auth, users, restaurants, menu, cart, and orders. The code is structured for clarity, scalability, and quick extension.

## 🛠️ Tech Stack

- Node.js
- TypeScript
- NestJS
- Prisma ORM
- PostgreSQL (or compatible SQL)
- Jest (testing)

## Run PostgreSQL locally

You can run the database on your machine or start only the Postgres container from `docker-compose.yaml`.

```bash
docker compose up -d postgres
```

If you prefer a native install, create a local database named `app_db` and make sure it listens on `localhost:5432`.

## ▶️ Run locally

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`:

- `DATABASE_URL=postgresql://admin:admin@localhost:5432/app_db?schema=public`
- `ACCESS_SECRET_KEY`
- `REFRESH_SECRET_KEY`

The sample values are in [/.env.example](.env.example).

3. Run Prisma migrate + seed (if required):

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

4. Start app in development:

```bash
bun install 
npm dev 
```

5. Production build + start:

```bash
bun run build 
bun run start 
```

## 📁 Folder structure

- `src/` - application source
  - `modules/` - features and endpoints
  - `bases/` - generic decorators, guards, filters, interceptors
  - `prisma/` - database module, service
  - `main.ts` - app bootstrap
- `prisma/` - schema and migrations
- `generated/prisma` - generated Prisma client models
- `test/` - e2e tests
- `scripts/` - helper scripts

## 🗂️ Relevant files

- `src/app.module.ts` - root module
- `src/main.ts` - application startup
- `src/modules/auth` - auth flow (JWT/local)
- `prisma/schema.prisma` - ER model
- `prisma/migrations` - DB history

## 🧩 Database diagram (Mermaid)

```mermaid
erDiagram
    User ||--o{ Cart : has
    User ||--o{ Order : places
    User ||--o{ OTP : requests
    Restaurant ||--o{ Menu : contains
    Restaurant ||--o{ Food : offers
    Menu ||--o{ Food : includes
    Food ||--o{ CartItem : in
    Cart ||--o{ CartItem : has
    Order ||--o{ OrderFood : contains
    Food ||--o{ OrderFood : item
    Order ||--|| Payment : pays
    Restaurant ||--o{ RestaurantRating : receives
    User ||--o{ RestaurantRating : gives

    User {
      int id PK
      string name
      string email
    }
    Restaurant {
      int id PK
      string name
      string address
    }
    Menu {
      int id PK
      string title
      int restaurantId FK
    }
    Food {
      int id PK
      string name
      float price
      int restaurantId FK
      int categoryId FK
    }
    Cart {
      int id PK
      int userId FK
    }
    CartItem {
      int id PK
      int cartId FK
      int foodId FK
      int quantity
    }
    Order {
      int id PK
      int userId FK
      int restaurantId FK
      string status
    }
    OrderFood {
      int id PK
      int orderId FK
      int foodId FK
      int quantity
    }
    Payment {
      int id PK
      int orderId FK
      float amount
      string method
      string status
    }
    OTP {
      int id PK
      int userId FK
      string code
      bool used
    }
    RestaurantRating {
      int id PK
      int restaurantId FK
      int userId FK
      int rating
      string comment
    }
```

## 🧪 Tests

- Unit / e2e: `npm run test` or `npm run test:e2e`

## 📮 Postman Samples

Use the sample collection in [postman/food-delivery-api.postman_collection.json](postman/food-delivery-api.postman_collection.json) and the environment in [postman/local.postman_environment.json](postman/local.postman_environment.json).

1. Import both files into Postman.
2. Select the `Local` environment.
3. Set the login credentials in the requests if you want to test your own account.
4. Run `Login Customer` or `Login Admin` first to store the access token automatically.

The API base URL used in the sample is `http://localhost:4000/api`.

If `POST /auth/login` still returns `500`, make sure `ACCESS_SECRET_KEY` and `REFRESH_SECRET_KEY` are loaded from your `.env` file and that the account you are testing is active/verified. Opening `/auth/login` in a browser with `GET` will always return `404` because that route only supports `POST`.

## 📌 Notes

- Keep `prisma/generated` in sync: `npx prisma generate`.
- Use modern NestJS module-based design for new features.

---
![](https://capgo.app/conventional_commits.webp)
> Simple, clean, and ready for production-grade extension.

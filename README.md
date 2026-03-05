# NestJS Template Server

A **clean and ready-to-use backend template** built with NestJS.
This template helps you quickly start building scalable backend applications with authentication, database integration, API documentation, and modern developer tooling.

---

# Tech Stack

* **Framework**: NestJS
* **Language**: TypeScript
* **ORM**: Prisma
* **Database**: PostgreSQL
* **Runtime**: Bun
* **Authentication**: JWT + Passport
* **API Documentation**: Scalar
* **Containerization**: Docker & Docker Compose
* **Code Quality**: ESLint + Prettier
* **Git Workflow**: Conventional Commits + Husky + lint-staged

---

# Badges

![NestJS](https://img.shields.io/badge/NestJS-framework-E0234E?style=for-the-badge\&logo=nestjs\&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-language-007ACC?style=for-the-badge\&logo=typescript\&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-3982CE?style=for-the-badge\&logo=prisma\&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-database-316192?style=for-the-badge\&logo=postgresql\&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-runtime-F9F1E1?style=for-the-badge\&logo=bun\&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-container-2496ED?style=for-the-badge\&logo=docker\&logoColor=white)

---

# Features Included

This template already provides several useful configurations so you can focus on building your application.

## Prisma Configuration

* Ready-to-use Prisma setup
* PostgreSQL integration
* Database migrations
* Seed scripts support
* Auto-generated TypeScript types

Example commands:

```
bunx prisma migrate dev
bunx prisma db seed
```

---

## Scalar API Documentation

Interactive API documentation is available automatically.

Features:

* Clean API interface
* OpenAPI specification support
* Live updates when your API changes

After running the server, open:

```
http://localhost:4000/api/docs
```

---

## Commit Convention + lint-staged

This project enforces **clean commit history** and **code quality**.

Tools included:

* Conventional Commits
* Husky Git hooks
* lint-staged
* ESLint
* Prettier

Before each commit:

* Lint runs automatically
* Formatting is applied
* Invalid commits are blocked

---

## Authentication Workflow

Authentication is already implemented using JWT.

Includes:

* Login and Register workflow
* JWT Access Token
* Passport strategies
* Guards for protected routes
* Role-based authorization

Typical flow:

```
User Login
   ↓
Server generates JWT
   ↓
Client sends Authorization header
   ↓
JWT Guard verifies token
   ↓
User information attached to request
```

---

# Project Structure

```
src
│
├── app.module.ts
├── main.ts
│
├── bases
│   ├── commons
│   ├── decorators
│   ├── guards
│   ├── filters
│   └── interceptors
│
├── modules
│   ├── auth
│   └── test
│
└── prisma
```

Prisma schema files are located in:

```
prisma/models
```

---

# Prerequisites

Make sure you have installed:

* Bun
* Docker
* Docker Compose
* Node.js 18+

---

# Installation

## 1 Clone the repository

```
git clone <repository-url>
cd template-server
```

---

## 2 Install dependencies using Bun

```
bun install
```

---

## 3 Setup environment variables

Create a `.env` file in the root directory.

Example:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app_db"
JWT_SECRET="your-secret-key"
PORT=4000
```

---

## 4 Start database services

```
docker-compose up -d
```

---

## 5 Run database migration

```
bunx prisma migrate dev
```

---

## 6 (Optional) Seed the database

```
bunx prisma db seed
```

---

# Running the Project with Bun

## Development mode

```
bun dev
```

Server runs at:

```
http://localhost:4000
```

Hot reload is enabled.

---

## Production build

```
bun run build
bun run start:prod
```

---

## Run with Docker

```
docker-compose up --build
```

---

# Available Scripts

| Command          | Description              |
| ---------------- | ------------------------ |
| `bun dev`        | Start development server |
| `bun start`      | Start production server  |
| `bun run build`  | Build the project        |
| `bun run lint`   | Run ESLint               |
| `bun run format` | Format code              |
| `bun test`       | Run tests                |
| `bun test:e2e`   | Run end-to-end tests     |
| `bun test:cov`   | Test coverage            |

---

# Contributing

Before submitting code:

1. Follow Conventional Commit format
2. Run lint

```
bun run lint
```

3. Format code

```
bun run format
```

4. Ensure tests pass

```
bun test
```

---

# License

- Belong to Cloudian 

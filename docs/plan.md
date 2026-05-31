# Role

You are a Senior Fullstack Developer responsible for analyzing, refactoring, and completing an existing Backend system for a Food Delivery Application.

The repository already contains:

- Existing source code
- Existing Prisma schema
- Existing API modules
- Existing business logic
- Existing services
- Existing frontend screenshots

You must analyze the current implementation and infer the missing requirements from both the codebase and the provided UI screenshots.

Do not assume the screenshots represent the entire product. They only represent a subset of the current application.

Your goal is to deliver a complete, consistent, and production-ready backend system.

---

# Important Instructions

- Read and understand the entire codebase before making changes.
- Reuse existing architecture, coding style, modules, services, utilities, and patterns whenever possible.
- Do not create duplicate logic if similar functionality already exists.
- Refactor existing code when necessary.
- Prefer improving existing modules over creating unnecessary new modules.
- Infer business requirements from:
  - Existing code
  - Existing database design
  - Existing APIs
  - Existing frontend screenshots
- If required functionality is missing, implement it.
- If database models are incomplete, extend them.
- If APIs are incomplete, extend them.
- If business logic is inconsistent, fix it.
- If there are architectural issues, improve them while maintaining compatibility with the current project.

# Plan 1: Database Review & Refactoring

Analyze the existing Prisma schema.

Tasks:

- Review all existing models.
- Review all relationships.
- Review all enums.
- Review indexes and constraints.
- Review audit fields.
- Review soft-delete support.

Then:

- Modify existing models to better fit the current application.
- Add missing fields if necessary.
- Add missing relationships if necessary.
- Add missing enums if necessary.
- Add missing models if necessary.
- Remove redundant structures if necessary.

The final database design must be consistent with:

- Existing frontend screens
- Existing business logic
- Existing APIs
- Typical Food Delivery Application requirements

Do not blindly create tables. Only add what is necessary after analyzing the project.

# Plan 2: API Refactoring

Analyze all existing APIs.

Review:

- Controllers
- Services
- DTOs
- Validation
- Authorization
- Database queries
- Business logic

Tasks:

- Refactor existing APIs when necessary.
- Upgrade APIs to match the updated database schema.
- Ensure compatibility with frontend requirements.
- Fix incorrect business logic.
- Fix validation issues.
- Fix authorization issues.
- Improve error handling.
- Improve transaction handling.
- Improve performance where necessary.

If functionality is missing:

- Implement the missing logic.
- Implement missing services.
- Implement missing endpoints.
- Implement missing helper functions.

---

## MinIO Integration

Use the existing `minioService` wherever file storage is needed.

If file upload features are missing:

- Implement them.
- Integrate them with existing business flows.

---

## Email Integration

Use the existing `emailService` wherever email functionality is required.

If email functionality is missing:

- Implement it.

When creating email functionality:

- Create the corresponding `.hbs` template files.
- Follow the existing email configuration already present in the project.

---

# Plan 3: New API Development

Identify functionality that is currently missing from the backend.

Tasks:

- Analyze current frontend screens.
- Analyze current modules.
- Analyze current business requirements.
- Determine which APIs are missing.
- Implement the missing APIs.

Requirements:

- APIs must follow the project's existing architecture.
- APIs must integrate correctly with the database.
- APIs must integrate correctly with frontend requirements.
- APIs must be production-ready.

---

## Third-Party Services

For APIs that require external services (for example: payment providers, SMS providers, etc.):

- Implement the complete backend flow.
- Create service abstractions.
- Create request/response handling.
- Create callback/webhook handling if applicable.

Since real credentials may not be available:

- Mock external responses when necessary.
- Ensure the application can still run correctly.
- Preserve the correct business flow.

Do not block implementation because external accounts are unavailable.

---

# Plan 4: Testing & Validation

Review the entire backend after implementation.

Tasks:

- Verify API behavior.
- Verify database consistency.
- Verify business logic.
- Verify authorization.
- Verify validation.
- Verify integrations.

If issues are found:

- Fix them.
- Refactor affected code.

If APIs are poorly designed:

- Improve them.
- Keep consistency with the rest of the project.

Add tests where appropriate.

---

# Deliverables

## 1. Backend System

Deliver a complete backend system that:

- Matches the current frontend requirements.
- Supports the current business logic.
- Supports future expansion.
- Is consistent across all modules.

The backend should be more complete than the currently available UI because the UI only represents part of the application.

---

## 2. Documentation

Create:

```text
system-architecture.md
```

The document must include:

### Project Overview
### Architecture Overview
### API Overview


### Database Overview
### Technology Stack
### Environment Variables

Document all required environment variables.

Include an updated:

```text
.env.example
```

### Business Flows

Document important system flows so they can be used for validation and testing.

Examples:

- Authentication flow
- Ordering flow
- Payment flow
- Notification flow
- Delivery flow

(Only document flows that actually exist or are implemented in the project.)
# Final Goal

Deliver a fully functional, consistent, maintainable, and production-ready Food Delivery Backend system by analyzing and improving the existing project rather than rebuilding it from scratch.
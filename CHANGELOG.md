# Changelog

## 2025-09-22
- Updated `.env` defaults for Railway: enforced production mode, enabled offline fallbacks, corrected Gemini base URL, disabled ngrok by default, and documented the need for the Redis Cloud TLS URI placeholder.

## 2025-09-21
- Pointed local Redis configuration to Redis Cloud endpoint to unblock BullMQ connectivity for Railway deployments.
- Added Railway deployment configuration and documented the deployment workflow for hosting on Railway.
- Updated server TypeScript build configuration to exclude test suites from production builds, switched build scripts to use TypeScript project references for shared package compilation, replaced deep-relative shared package imports with the `@mr-leo/shared` workspace alias, automated Railway variable syncing, and ignored `.tsbuildinfo` artifacts.
- Added Makefile targets for starting the @mr-leo/server dev workspace with structured logging signals.
- Hardened local development startup by adding configurable offline fallbacks for MongoDB and BullMQ dependencies, defaulting to in-memory implementations when remote services are unreachable.

## 2025-09-18
- Added optional ngrok tunnel orchestration with dynamic module loading and graceful shutdown hooks.
- Expanded server configuration to include ngrok environment controls and introduced tests covering tunnel lifecycle.
- Wired optional Gemini-backed AI acknowledgements in the LINE webhook with helper classes and tests.
- Added `npm run dev:ngrok --workspace @mr-leo/server` helper and bundled ngrok dependency for turnkey tunnel startup.
- Updated environment loader to auto-discover repo-level `.env` when running from workspace packages.

## 2025-09-17
- Extended README with Just_Do_It tagline to align with new repository namespace.
- Initialized Git repository and documented repository metadata in project_info.
- Scaffolded Node.js + TypeScript workspaces, shared schema package, and lint/test tooling.
- Rebuilt project_info tracker to align with active repository files.
- Implemented LINE webhook skeleton, tRPC router, Mongo-backed task repository, and server bootstrap with comprehensive logging.
- Added signature validation test coverage, environment loader, and logging utilities refinements.
- Created local .env template containing LINE channel configuration and development defaults.
- Replaced placeholder reminders with BullMQ queue + worker, added LINE push dispatcher enforcing persona phrasing, and expanded test coverage.
- Updated .env with provided MongoDB Atlas connection string for development connectivity.
- Inserted LINE channel access token into .env for authenticated push messaging.
- Introduced reminder scheduler placeholder with configuration-driven defaults and webhook integration.

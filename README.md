# Media Library API

A RESTful backend for a content team to upload, organize, search, and manage media files (images and PDFs). Each user owns their own media — only the uploader can edit or delete their files.

Built with TypeScript, Express 5, MongoDB (Mongoose), JWT auth, and Multer + Cloudinary for file uploads.

> For the full architectural design, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
> For a plain-English explanation of the project tooling (TypeScript, ESLint, Prettier, Husky), see [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md).

---

## Features

- **Authentication** — JWT-based register / login. Tokens carry the user identity.
- **Ownership model** — every media item belongs to one user. Only the owner can update or delete.
- **File uploads** — accepts `image/jpeg`, `image/png`, and `application/pdf` via `multipart/form-data`. Max 5 MB per file.
- **Metadata** — every upload stores a title, optional tags, a category, plus the file path, original filename, MIME type, and size.
- **Search, filter, paginate** — list endpoint supports full-text search on title, tag filtering, category filtering, pagination, and sorting in one call.
- **Consistent response envelope** — every success and error response follows the same JSON shape.
- **Centralized error handling** — single global error middleware turns thrown errors into properly-formatted responses.
- **Structured logging** — Pino logs in JSON for production, pretty-printed in development.
- **Fail-fast configuration** — missing or malformed env vars crash the app at boot with a clear message.
- **Hardened by default** — Helmet security headers, a CORS allowlist, and per-IP rate limiting that's tighter on the credential endpoints. See [Security](#security).
- **Deploys to Vercel** — the same Express app runs as a long-lived local server or a serverless function. See [Deployment](#deployment-vercel).

---

## Tech stack

| Area         | Tool                               |
| ------------ | ---------------------------------- |
| Language     | TypeScript                         |
| Runtime      | Node.js 22 LTS                     |
| Framework    | Express 5                          |
| Database     | MongoDB                            |
| ODM          | Mongoose                           |
| Validation   | Zod                                |
| File uploads | Multer (memory) + Cloudinary       |
| Auth         | bcryptjs + jsonwebtoken            |
| Logging      | Pino + pino-pretty                 |
| Env loading  | dotenv                             |
| Dev runner   | tsx                                |
| Linting      | ESLint (flat config)               |
| Formatting   | Prettier                           |
| Git hooks    | Husky + lint-staged                |
| Security     | Helmet + CORS + express-rate-limit |

---

## Requirements

- Node.js **22.22.1** or newer (see `.nvmrc`)
- **Yarn** (the project uses `yarn.lock`)
- A MongoDB instance — local install **or** MongoDB Atlas connection string

---

## Setup

```bash
# 1. Install dependencies
yarn install

# 2. Create your local env files from the template
cp .env.example .env.development
cp .env.example .env.test

# 3. Edit .env.development (and .env.test) and fill in real values (especially DATABASE_URL and JWT_SECRET)

# 4. Start the dev server
yarn dev
```

The server starts on `http://localhost:3000` (or whatever `PORT` you set).

---

## Scripts

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `yarn dev`          | Start the dev server with auto-reload (tsx watch). |
| `yarn build`        | Compile TypeScript to `dist/`.                     |
| `yarn start`        | Run the compiled app from `dist/server.js`.        |
| `yarn lint`         | Check code for lint errors.                        |
| `yarn format`       | Auto-format all files with Prettier.               |
| `yarn format:check` | Check formatting without changing files.           |
| `yarn typecheck`    | Type-check without compiling (no emit).            |

---

## Environment variables

All vars are loaded from `.env.<NODE_ENV>` at boot (so `.env.development`, `.env.test`, etc.) and validated by Zod. The app refuses to start if any required var is missing or malformed. In production on Vercel, vars are injected by the platform — no file is read.

| Variable                       | Required | Default       | Description                                                                             |
| ------------------------------ | -------- | ------------- | --------------------------------------------------------------------------------------- |
| `NODE_ENV`                     | no       | `development` | One of `development` \| `production` \| `test`. Also picks which `.env.*` file loads.   |
| `PORT`                         | no       | `3000`        | Port the HTTP server listens on.                                                        |
| `DATABASE_URL`                 | **yes**  | —             | MongoDB connection string (local or Atlas).                                             |
| `JWT_SECRET`                   | **yes**  | —             | Secret for signing JWTs. Minimum 16 characters. Use a long random string in production. |
| `JWT_EXPIRES_IN`               | no       | `7d`          | Token lifetime (e.g. `1h`, `7d`, `30d`).                                                |
| `MAX_FILE_SIZE_MB`             | no       | `5`           | Max upload size in megabytes (enforced by Multer). See the Vercel body limit below.     |
| `LOG_LEVEL`                    | no       | `info`        | Pino log level: `debug` \| `info` \| `warn` \| `error` \| `fatal` \| `silent`.          |
| `CORS_ORIGINS`                 | no       | _(empty)_     | Comma-separated browser origins allowed to call the API. Empty allows none.             |
| `RATE_LIMIT_WINDOW_MINUTES`    | no       | `15`          | Length of the rate-limit window.                                                        |
| `RATE_LIMIT_MAX_REQUESTS`      | no       | `100`         | Requests per IP per window across `/api/v1`.                                            |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | no       | `10`          | Failed login/register attempts per IP per window.                                       |
| `CLOUDINARY_CLOUD_NAME`        | no\*     | —             | Cloudinary cloud name. Required from step 4 (Cloudinary migration) onward.              |
| `CLOUDINARY_API_KEY`           | no\*     | —             | Cloudinary API key. Required from step 4 onward.                                        |
| `CLOUDINARY_API_SECRET`        | no\*     | —             | Cloudinary API secret. Required from step 4 onward.                                     |

See [`.env.example`](.env.example) for a copy-paste template.

---

## Project structure

```
media-library-api/
├── api/
│   └── index.js                Vercel entry — exports the app, no listen()
├── docs/                       Architectural and setup documentation
├── src/
│   ├── config/                 env loading, logger, db, cloudinary, cors
│   ├── routes/                 URL → controller wiring (no logic)
│   ├── controllers/            Request/response handling (delegates to services)
│   ├── services/               Business rules and orchestration
│   ├── repositories/           Database queries
│   ├── models/                 Mongoose schemas and TypeScript types
│   ├── middlewares/            validate, authenticate, upload, rateLimit, errorHandler
│   ├── utils/                  AppError, catchAsync, sendSuccess, mongoErrors
│   ├── app.ts                  Express app construction (no listening)
│   └── server.ts               Local entrypoint: connect DB, listen, process handlers
├── tests/
│   ├── integration/            Route-level tests against an in-memory MongoDB
│   ├── unit/                   Middleware, service, and utility tests
│   ├── helpers/                supertest agent and data factories
│   └── setup/                  Global Cloudinary mock and DB lifecycle
├── .editorconfig
├── .env.example
├── .gitignore
├── .prettierrc
├── .prettierignore
├── .vercelignore
├── eslint.config.js
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── vercel.json
```

**Layer rule:** routes → controllers → services → repositories. Never skip a layer, never go backwards. Controllers never touch the database directly.

---

## Response format

Every response follows one of these two shapes.

### Success

```json
{ "status": "success", "data": { ... } }
```

### Error

```json
{ "status": "error", "message": "Human-readable summary", "details": [ ... ] }
```

The `details` array is included for validation errors:

```json
{
    "status": "error",
    "message": "Validation failed",
    "details": [{ "field": "title", "message": "title is required" }]
}
```

### Paginated list responses

```json
{
  "status": "success",
  "data": {
    "results": [ ... ],
    "pagination": { "total": 84, "page": 2, "limit": 10, "totalPages": 9 }
  }
}
```

---

## API endpoints

All `/media` endpoints require a valid JWT in the `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint         | Description                                        |
| ------ | ---------------- | -------------------------------------------------- |
| `POST` | `/auth/register` | Create an account; returns a JWT.                  |
| `POST` | `/auth/login`    | Authenticate with email + password; returns a JWT. |
| `GET`  | `/auth/me`       | Return the currently authenticated user.           |

### Media

| Method   | Endpoint     | Description                                                                                 |
| -------- | ------------ | ------------------------------------------------------------------------------------------- |
| `POST`   | `/media`     | Upload one file with metadata (multipart form, `file` field + `title`, `tags`, `category`). |
| `GET`    | `/media`     | List your media with filters, search, and pagination.                                       |
| `GET`    | `/media/:id` | Get a single media item (owner only).                                                       |
| `PUT`    | `/media/:id` | Update metadata (owner only).                                                               |
| `DELETE` | `/media/:id` | Delete the media item and its asset from Cloudinary (owner only).                           |

### Health

| Method | Endpoint  | Description                                                    |
| ------ | --------- | -------------------------------------------------------------- |
| `GET`  | `/health` | Liveness probe — returns `{ status: "ok" }`. No auth required. |

### `GET /media` query parameters

| Param      | Description                                   | Default     |
| ---------- | --------------------------------------------- | ----------- |
| `page`     | Page number                                   | `1`         |
| `limit`    | Results per page (max 50)                     | `10`        |
| `category` | Filter by category (e.g. `image`, `document`) | —           |
| `tags`     | Filter by tags (comma-separated)              | —           |
| `search`   | Full-text search on title                     | —           |
| `sortBy`   | Field to sort by (e.g. `createdAt`, `title`)  | `createdAt` |
| `order`    | Sort direction: `asc` or `desc`               | `desc`      |

### Upload constraints

- **Accepted MIME types:** `image/jpeg`, `image/png`, `application/pdf`
- **Maximum file size:** 5 MB
- **Allowed categories:** `image`, `document`

Unsupported file types or oversized files return `400` with a descriptive error message.

---

## Security

| Concern          | How it's handled                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Password storage | `bcryptjs` hash with cost 10, applied in a `pre("save")` hook so a plaintext password can't reach the database.          |
| Auth             | Stateless JWT in `Authorization: Bearer`. Every request re-checks the user still exists.                                 |
| Brute force      | Failed login/register attempts are rate-limited per IP. Successful logins don't count against the budget.                |
| HTTP headers     | Helmet — `nosniff`, `SAMEORIGIN`, HSTS, and a restrictive referrer policy.                                               |
| Browser access   | CORS allowlist from `CORS_ORIGINS`. No wildcard, because `*` plus credentials lets any site make authenticated calls.    |
| Ownership        | Every media read and write re-checks `ownerId` server-side. A valid token for user A can't touch user B's media.         |
| Request size     | JSON bodies capped at 100 kB; uploads capped by `MAX_FILE_SIZE_MB` and Multer's MIME allowlist.                          |
| Client IP        | `trust proxy` is `1`, so the rate limiter reads the real client IP from Vercel's `X-Forwarded-For` and not a forged one. |

### Known gap: rate limiting is per-container

The limiter uses an in-memory store, so counters live in one serverless
container. Each warm container counts separately and every cold start resets to
zero — an attacker spread across containers gets more attempts than
`AUTH_RATE_LIMIT_MAX_REQUESTS` suggests. It still stops the ordinary case of one
client hammering one endpoint.

Closing it properly needs a shared store. The Vercel-native option is Upstash
Redis with `rate-limit-redis` swapped into `src/middlewares/rateLimit.ts` — the
store is already injected there, so it's a one-line change plus credentials.
Deliberately not done yet: it adds a hard dependency on a provisioned Redis for
every request, which isn't worth it until there's real traffic.

---

## Deployment (Vercel)

The app runs two ways off the same Express instance in `src/app.ts`:

| Environment | Entry point     | How it starts                                              |
| ----------- | --------------- | ---------------------------------------------------------- |
| Local       | `src/server.ts` | `app.listen()` — a long-lived process you own              |
| Vercel      | `api/index.js`  | Vercel imports the app and passes it one request at a time |

`vercel.json` sets the build to `yarn build` and rewrites every path to `/api`, so
Express keeps doing its own routing instead of Vercel splitting routes into
separate functions.

**Environment variables** are set in the Vercel dashboard, not in a file — there
is no `.env.production`. Every variable in [`.env.example`](.env.example) must be
set for the Production environment, except `PORT` (Vercel assigns it).

**Connection reuse** — `connectDB()` in `src/config/db.ts` caches its connection
promise on `globalThis`, which survives between requests on a warm container.
Without this, every cold start would open a new pool and exhaust the Atlas
connection limit under load. `ensureDbConnection` connects lazily per request
because serverless has no boot step to hang the connection off.

### Platform limits to know

- **Request body ≈ 4.5 MB** — enforced by Vercel before your code runs, so
  `MAX_FILE_SIZE_MB` above ~4 is not actually reachable in production and
  Multer's error message never fires. Keep the two in sync.
- **Execution timeout** — a slow upload passing through the function can exceed
  it. Tune with `functions.maxDuration` in `vercel.json` if needed.
- **Ephemeral filesystem** — nothing may be written to disk. Uploads use
  Multer's `memoryStorage()` and stream straight to Cloudinary, so this is
  already satisfied.

### Local verification

```bash
yarn build && yarn start   # production build, long-lived server
vercel dev                 # emulates the serverless runtime and vercel.json
```

---

## Development workflow

- **Pre-commit hook** — On every commit, Husky runs `lint-staged`, which runs Prettier and ESLint on the files you staged. Commits with lint errors are blocked.
- **Type-only checks** — `yarn typecheck` runs the compiler in no-emit mode to surface type errors without producing output. Faster than a full build.
- **Logging** — Use the shared `logger` from `src/config/logger.ts`. Do **not** use `console.log` in committed code.
- **Errors** — Throw `new AppError(message, statusCode)` for expected failures. The global error middleware turns them into the standard error envelope. Don't construct error responses by hand.

---

## License

MIT

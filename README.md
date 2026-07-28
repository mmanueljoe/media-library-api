# Media Library API

A RESTful backend for a content team to upload, organize, search, and manage media files (images and PDFs). Each user owns their own media — only the uploader can edit or delete their files.

Built with TypeScript, Express 5, MongoDB (Mongoose), JWT auth, and Multer + Cloudinary for file uploads.

> For the full architectural design, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
> For a plain-English explanation of the project tooling (TypeScript, ESLint, Prettier, Husky), see [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md).

---

## Features

- **Authentication** — JWT-based register / login. Tokens carry the user identity.
- **Ownership model** — every media item belongs to one user. Only the owner can update or delete.
- **Soft delete** — deletes are recoverable; the row is stamped, not removed. See [Soft delete](#soft-delete).
- **File uploads** — accepts `image/jpeg`, `image/png`, and `application/pdf` via `multipart/form-data`. Max 5 MB per file.
- **Metadata** — every upload stores a title, optional tags, a category, plus the file path, original filename, MIME type, and size.
- **Search, filter, paginate** — list endpoint supports full-text search on title, tag filtering, category filtering, pagination, and sorting in one call.
- **Consistent response envelope** — every success and error response follows the same JSON shape.
- **Centralized error handling** — single global error middleware turns thrown errors into properly-formatted responses.
- **Structured logging** — Pino JSON logs, every line correlated by request id, secrets redacted. See [Logging](#logging).
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
| `yarn build`        | Clean `dist/`, then compile TypeScript into it.    |
| `yarn clean`        | Remove `dist/`.                                    |
| `yarn start`        | Run the compiled app from `dist/bootstrap.js`.     |
| `yarn lint`         | Check code for lint errors.                        |
| `yarn format`       | Auto-format all files with Prettier.               |
| `yarn format:check` | Check formatting without changing files.           |
| `yarn typecheck`    | Type-check without compiling (no emit).            |

---

## Environment variables

All vars are loaded from `.env.<NODE_ENV>` at boot (so `.env.development`, `.env.test`, etc.) and validated by Zod. The app refuses to start if any required var is missing or malformed. In production on Vercel, vars are injected by the platform — no file is read.

| Variable                       | Required | Default       | Description                                                                                           |
| ------------------------------ | -------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                     | no       | `development` | One of `development` \| `production` \| `test`. Also picks which `.env.*` file loads.                 |
| `PORT`                         | no       | `3000`        | Port the HTTP server listens on.                                                                      |
| `DATABASE_URL`                 | **yes**  | —             | MongoDB connection string (local or Atlas).                                                           |
| `JWT_SECRET`                   | **yes**  | —             | Secret for signing JWTs. Minimum 16 characters. Use a long random string in production.               |
| `JWT_EXPIRES_IN`               | no       | `7d`          | Token lifetime (e.g. `1h`, `7d`, `30d`).                                                              |
| `MAX_FILE_SIZE_MB`             | no       | `5`           | Max upload size in megabytes (enforced by Multer). See the Vercel body limit below.                   |
| `LOG_LEVEL`                    | no       | `info`        | Pino log level: `debug` \| `info` \| `warn` \| `error` \| `fatal` \| `silent`.                        |
| `CORS_ORIGINS`                 | no       | _(empty)_     | Comma-separated browser origins allowed to call the API. Empty allows none.                           |
| `RATE_LIMIT_WINDOW_MINUTES`    | no       | `15`          | Length of the rate-limit window.                                                                      |
| `RATE_LIMIT_MAX_REQUESTS`      | no       | `100`         | Requests per IP per window across `/api/v1`.                                                          |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | no       | `10`          | Failed login/register attempts per IP per window.                                                     |
| `MEDIA_RETENTION_DAYS`         | no       | `30`          | How long a soft-deleted item stays restorable before the purge job removes it.                        |
| `MEDIA_PURGE_BATCH_LIMIT`      | no       | `100`         | Max items one purge run will process.                                                                 |
| `CRON_SECRET`                  | no\*     | —             | Bearer token Vercel sends when triggering the cron. Without it the purge endpoint rejects everything. |
| `CLOUDINARY_CLOUD_NAME`        | no\*     | —             | Cloudinary cloud name. Required from step 4 (Cloudinary migration) onward.                            |
| `CLOUDINARY_API_KEY`           | no\*     | —             | Cloudinary API key. Required from step 4 onward.                                                      |
| `CLOUDINARY_API_SECRET`        | no\*     | —             | Cloudinary API secret. Required from step 4 onward.                                                   |

See [`.env.example`](.env.example) for a copy-paste template.

---

## Project structure

```
media-library-api/
├── api/
│   └── index.js                Vercel entry — exports the app, no listen()
├── docs/                       Architectural and setup documentation
├── src/
│   ├── config/                 env loading, logger, db, cloudinary, cors, requestContext
│   ├── routes/                 URL → controller wiring (no logic), incl. cron.routes.ts
│   ├── controllers/            Request/response handling (delegates to services)
│   ├── services/               Business rules and orchestration
│   ├── repositories/           Database queries
│   ├── models/                 Mongoose schemas and TypeScript types
│   ├── middlewares/            validate, authenticate, authenticateCron, upload, rateLimit, errorHandler
│   ├── utils/                  AppError, catchAsync, sendSuccess, mongoErrors
│   ├── createApp.ts            Express app construction (no listening)
│   └── bootstrap.ts            Local entrypoint: connect DB, listen, process handlers
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
| `PATCH`  | `/media/:id` | Update metadata (owner only).                                                               |
| `DELETE` | `/media/:id` | Soft-delete the media item (owner only). See [Soft delete](#soft-delete).                   |

### Health

| Method | Endpoint  | Description                                                                                                                   |
| ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/health` | Liveness probe. `200` when Mongo is reachable, `503` when it isn't. No auth, not rate-limited. See [Monitoring](#monitoring). |

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

## Soft delete

`DELETE /media/:id` stamps a `deletedAt` timestamp instead of removing the
document. Nothing about the response changes — still `200` with the id — and the
item disappears from every read: get-by-id, list, search, and update all `404`.

Why: an accidental delete is otherwise unrecoverable, and the row is the only
record that the upload ever happened. Keeping it means a mistake is a database
update away from being fixed rather than gone for good.

Two consequences worth knowing:

- **The Cloudinary asset is deliberately _not_ destroyed.** Destroying it would
  leave a restorable record pointing at a file that no longer exists, which
  defeats the point. So assets for deleted media accumulate and nothing reclaims
  them yet — the missing piece is a scheduled job that hard-deletes rows past a
  retention window and destroys their assets in the same pass. Not built; it needs
  a cron and a retention-policy decision.
- **Every read path has to filter `deletedAt: null`.** That's enforced in
  [mediaRepository.ts](src/repositories/mediaRepository.ts) rather than sprinkled
  through the services, so there's one place to get it right. A compound index on
  `{ ownerId, deletedAt, createdAt }` keeps the list query from degrading now that
  it filters on two fields.

### Restore

`POST /media/:id/restore` clears `deletedAt` and the item returns to every read.
Owner-only, same as every other media route. It 404s on an item that was never
deleted, on an id that does not exist, and on a second restore — reporting success
twice would misrepresent what happened.

Once the purge job has run, restore 404s permanently. That is the deal the
retention window makes.

### The purge job

A daily Vercel Cron hits `GET /api/cron/purge-deleted-media`, which hard-deletes
items soft-deleted longer ago than `MEDIA_RETENTION_DAYS` (default 30) and
destroys their Cloudinary assets.

```json
{ "crons": [{ "path": "/api/cron/purge-deleted-media", "schedule": "0 3 * * *" }] }
```

Four things worth knowing:

- **Order is asset first, then row.** If destroying the asset fails we leave the
  row alone so the next run retries it. The other order would drop the row and
  orphan the file permanently, with nothing left pointing at it to clean up.
- **Each item is independent.** One unreachable asset does not abort the batch;
  the response reports `purged` and `failed` counts.
- **Batched** at `MEDIA_PURGE_BATCH_LIMIT` (default 100) so one run cannot exceed
  the function timeout. Hitting the limit logs a warning — more work is pending.
- **Authenticated by `CRON_SECRET`,** which Vercel sends as a Bearer token. The
  endpoint fails closed: if `CRON_SECRET` is unset it rejects everything, because
  an open hard-delete endpoint is worse than a cron that never runs.

**Hobby plan limit:** crons run at most once per day, and a more frequent
expression fails the deployment. Vercel may also fire it anywhere within the
scheduled hour.

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

The app runs two ways off the same Express instance in `src/createApp.ts`:

| Environment | Entry point        | How it starts                                              |
| ----------- | ------------------ | ---------------------------------------------------------- |
| Local       | `src/bootstrap.ts` | `app.listen()` — a long-lived process you own              |
| Vercel      | `api/index.js`     | Vercel imports the app and passes it one request at a time |

`vercel.json` sets the build to `yarn build` and rewrites every path to `/api`, so
Express keeps doing its own routing instead of Vercel splitting routes into
separate functions.

**Why the files are named `createApp.ts` and `bootstrap.ts`** rather than the more
obvious `app.ts` and `server.ts`: Vercel treats a default-exporting `app`,
`index`, or `server` file in `src/` as an Express entrypoint and compiles it with
its own TypeScript settings, which do not match `tsconfig.build.json`. That
produced a build error on a default import that compiles fine locally. These names
match nothing it looks for, so `api/index.js` is the only entrypoint it finds.
`framework: null` in `vercel.json` disables the detection as well — belt and braces.

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

## Logging

Pino, structured JSON in production and pretty-printed in development, level set
by `LOG_LEVEL`.

**Every line carries a `requestId`.** It comes from Vercel's `x-vercel-id` when
present, so our logs line up with Vercel's own function logs for the same request;
otherwise one is generated. It's also echoed back as the `x-request-id` response
header, so a user reporting a problem can quote it.

The id travels via `AsyncLocalStorage` ([requestContext.ts](src/config/requestContext.ts))
and gets attached by a Pino mixin. That's why no call site passes it in — services
stay free of HTTP concepts, and nothing had to change to gain correlation.

What gets logged:

| Event                | Level             | Carries                                        |
| -------------------- | ----------------- | ---------------------------------------------- |
| Every request        | `info`            | method, path, status, duration, `userId`       |
| Register / login OK  | `info`            | `userId`, email                                |
| Login failed         | `warn`            | email, and `unknown_email` vs `wrong_password` |
| Rate limit tripped   | `warn`            | IP, path                                       |
| Upload / soft delete | `info`            | media id, owner, Cloudinary `publicId`         |
| 4xx                  | `warn`            | error, method, path, status                    |
| 5xx and crashes      | `error` / `fatal` | error and stack                                |

The failed-login split is intentional: scattered unknown emails is someone
spraying a leaked list, repeated wrong passwords on one real account is someone
targeting it. Those are different incidents. The **response** is an identical
`Invalid credentials` either way, so the distinction never reaches the client.

**Secrets are redacted** at the logger, not the call site — `password`,
`passwordHash`, `token`, and `authorization` headers are replaced with
`[Redacted]` wherever they appear in a log object. Nothing currently logs a
request body; this is the guardrail for when someone does it while debugging.

Not set up: **error tracking**. Logs go to Vercel's log drain, which is searchable
but doesn't alert — nobody gets paged on a spike in 500s. Sentry or similar is the
next thing worth adding.

---

## Monitoring

Two layers, because they answer different questions. Vercel can tell you how the
app is behaving, but it can't tell you it's down — something outside the platform
has to watch for that.

| Layer                | What it answers                                         | Setup                                                 |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| **Vercel Analytics** | Traffic, response times, error rates, cold-start counts | Project → Analytics → enable. No code changes.        |
| **UptimeRobot**      | Is the API reachable from outside right now?            | Add an HTTP monitor on `GET /health`, 5-min interval. |

### What the uptime check is actually testing

`GET /health` is unauthenticated and unrate-limited on purpose — a monitor polls
it far more often than the rate limit allows, and an uptime check that needs
credentials is one more thing to expire silently.

It probes the database before answering, so it reports on the connection rather
than merely on the process being alive:

| Response                                        | Meaning                                               |
| ----------------------------------------------- | ----------------------------------------------------- |
| `200` `{ status: "ok", db: "connected" }`       | Function is running and Mongo is reachable.           |
| `503` `{ status: "error", db: "disconnected" }` | Function is running but Mongo is not reachable.       |
| No response / timeout                           | The deployment itself is down or the build is broken. |

The `503` case is the useful one: it distinguishes "your app is broken" from
"Atlas is refusing connections," which are different incidents with different
fixes. Configure the alert on any non-200 so both are caught.

`uptime` in the payload is `process.uptime()` — seconds since _this container_
started, not since the last deploy. On serverless it resets on every cold start,
so treat it as a cold-start signal, not as an availability metric. Availability
is what UptimeRobot measures.

### Not set up

Error tracking — see the Logging section above. Everything else here is dashboard
setup on your side; the code already returns what these tools need.

---

## Development workflow

- **Pre-commit hook** — On every commit, Husky runs `lint-staged`, which runs Prettier and ESLint on the files you staged. Commits with lint errors are blocked.
- **Type-only checks** — `yarn typecheck` runs the compiler in no-emit mode to surface type errors without producing output. Faster than a full build.
- **Logging** — Use the shared `logger` from `src/config/logger.ts`. Do **not** use `console.log` in committed code.
- **Errors** — Throw `new AppError(message, statusCode)` for expected failures. The global error middleware turns them into the standard error envelope. Don't construct error responses by hand.

---

## License

MIT

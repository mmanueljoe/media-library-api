# Media Library API — Production Readiness Plan

This document is the single source of truth for taking the Media Library API from "works on my machine" to "live, tested, observable, and deployable." Every decision below has a short reason attached. If we change our minds later, we update this file first, then the code.

It is the companion to [`ARCHITECTURE.md`](./ARCHITECTURE.md). That file describes _what we built_; this file describes _how we make it shippable_.

---

## 1. The big picture

The API is built and runs locally. It has never been formally tested, it reads config out of a single `.env`, and it lives only on one laptop. The goal of this phase is to close every one of those gaps:

- A **test suite** (unit + integration) the team can trust before shipping changes.
- **Environment configuration** that behaves correctly in dev, test, and production.
- **Git history and CI** so changes go through review and verification.
- **A live deployment** at a public URL with health monitoring.
- **Structured logging** so we can diagnose what's happening in production.

Nothing in this phase changes the _contract_ of the API — the five media endpoints, the auth endpoints, the response envelope — all stay identical. We change _how the project is configured, tested, observed, and shipped_, not what it does.

---

## 2. Decisions and why

Each line is a deliberate choice with the alternative considered.

| Area                 | Choice                                               | Why this and not something else                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Test runner          | **Vitest**                                           | The project is TypeScript + ESM. Jest on TS+ESM needs `ts-jest`, an experimental-vm-modules flag, and config files. Vitest needs none of that and exposes the same `describe`/`it`/`expect` API. If a grader insists on Jest later, the test code barely changes — only the runner config.                                                                                                                                                    |
| HTTP testing         | **Supertest**                                        | The lab specifies it. Industry default for Express integration tests. Wraps the Express app directly without binding a port — works perfectly in CI.                                                                                                                                                                                                                                                                                          |
| Test database        | **`mongodb-memory-server`**                          | Real `mongod` binary in RAM, fresh per run. Hermetic, fast, no secrets in CI, no Atlas rate-limit risk. Pointing tests at Atlas would require a separate cluster URI in GitHub Secrets and would burn the free-tier connection cap.                                                                                                                                                                                                           |
| File storage in prod | **Cloudinary**                                       | Vercel's filesystem is ephemeral — Multer's disk storage breaks the moment the function cold-starts. Cloudinary's free tier (25 GB) supports both images and PDFs (PDFs as `resource_type: raw`), needs only an API key + secret in env vars, and is a one-call SDK. S3 is the industry standard for raw storage but adds AWS account setup, IAM, signed URLs, and region config — too much for this lab. Base64-in-Mongo is an anti-pattern. |
| Multer storage mode  | **`memoryStorage`**                                  | Files no longer live on disk at all. The buffer is streamed straight to Cloudinary. No leftover temp files, no `unlink` calls, no `UPLOAD_DIR` dependency.                                                                                                                                                                                                                                                                                    |
| Env loader           | **`dotenv` + Zod, extended for multi-env**           | `dotenv.config({ path: \`.env.\${NODE_ENV}\` })`, then the existing Zod schema. ~5 lines of new code. `dotenv-flow`would add a dependency for behavior we should understand. In real production,`.env.production`is never deployed — Vercel injects vars at runtime — so the file is a learning fiction;`.gitignore` enforces this.                                                                                                           |
| Logger               | **Pino** (already in place)                          | Fast, JSON by default, `pino-pretty` for dev. We extend it with a request-logging middleware and add explicit log calls at the events the lab requires. We do **not** switch to Winston — Pino is already wired and is faster.                                                                                                                                                                                                                |
| Package manager      | **Yarn** (the repo has `yarn.lock`)                  | CI uses `yarn install --frozen-lockfile`. Switching to npm now would mean deleting `yarn.lock` and producing a new `package-lock.json` — a churn commit with no payoff. Mixing both is the real anti-pattern. The lab's `npm ci` example is illustrative, not prescriptive.                                                                                                                                                                   |
| Node version         | **20 LTS**, pinned via `.nvmrc` and `engines`        | Same version used in dev, CI, and Vercel. `.nvmrc` lets `nvm use` pick the right version locally; the GitHub Actions workflow reads it; Vercel respects `engines.node`.                                                                                                                                                                                                                                                                       |
| Deployment           | **Vercel**                                           | The lab specifies it. Free hobby tier, GitHub-integrated, automatic preview deploys per PR. The serverless model forces us to confront ephemeral storage (resolved via Cloudinary) and stateless design — both good lessons.                                                                                                                                                                                                                  |
| Branch model         | **Git Flow (`main` + `develop` + feature branches)** | `main` holds the stable, submitted state. `develop` is the integration branch for the production-readiness work. Feature branches (`feat/*`, `chore/*`, etc.) PR into `develop`. When ready, `develop` PRs into `main`. Matches what the lab asks for and mirrors real-team release flow.                                                                                                                                                     |
| CI provider          | **GitHub Actions**                                   | The lab specifies it. Free for public repos and generous for private. Native to where the code lives.                                                                                                                                                                                                                                                                                                                                         |

---

## 3. New folders and files

```
media-library-api/
├── .github/
│   └── workflows/
│       └── ci.yml                 ← test + lint + typecheck on every push/PR
├── .nvmrc                         ← single line: "20"
├── .env.example                   ← every key, no values (committed)
├── .env.development               ← local dev values (git-ignored)
├── .env.test                      ← test DB + suppressed logging (git-ignored)
├── docs/
│   ├── ARCHITECTURE.md            ← (existing)
│   ├── SETUP_GUIDE.md             ← (existing)
│   └── PRODUCTION_READINESS.md    ← this file
├── postman/
│   └── Media-Library-API.postman_collection.json
├── src/
│   ├── config/
│   │   ├── env.ts                 ← extended for multi-env loading
│   │   └── cloudinary.ts          ← NEW: SDK config
│   ├── middlewares/
│   │   ├── upload.ts              ← switched to memoryStorage
│   │   └── requestLogger.ts       ← NEW: Pino-based request logging
│   ├── services/
│   │   └── mediaService.ts        ← streams to Cloudinary
│   └── routes/
│       └── health.routes.ts       ← NEW: extracted from app.ts, returns uptime + timestamp
├── tests/
│   ├── unit/
│   │   ├── AppError.test.ts
│   │   ├── catchAsync.test.ts
│   │   ├── validate.test.ts
│   │   └── mediaService.pagination.test.ts
│   ├── integration/
│   │   ├── auth.test.ts
│   │   └── media.test.ts
│   ├── setup/
│   │   ├── mongo.ts               ← starts/stops mongodb-memory-server
│   │   └── app.ts                 ← builds an Express app for Supertest
│   └── helpers/
│       └── factories.ts           ← test data builders (user, media)
├── vercel.json
├── vitest.config.ts
└── package.json
```

### What each new folder owns

- **`.github/workflows/`** — CI definition only. No deploy steps (Vercel does that via its own GitHub integration).
- **`postman/`** — exported Postman collection JSON. Committed so any teammate (or grader) can import it.
- **`tests/`** — sits at the project root, parallel to `src/`. We separate `unit/` (pure functions, no DB) from `integration/` (full HTTP layer with in-memory Mongo). `setup/` and `helpers/` are infrastructure, not tests.
- **`src/config/cloudinary.ts`** — owns the Cloudinary SDK instance. Other code imports the configured instance, never touches the SDK directly.

---

## 4. Environment configuration

### The three environments

| File               | Loaded when            | Committed?     | Purpose                                                                                                                 |
| ------------------ | ---------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `.env.example`     | never                  | **yes**        | Lists every variable with no values. Documentation.                                                                     |
| `.env.development` | `NODE_ENV=development` | no             | Local dev values (Atlas dev URI, dev JWT secret, etc.).                                                                 |
| `.env.test`        | `NODE_ENV=test`        | no             | In-memory Mongo URI gets injected by the test setup, so `DATABASE_URL` here is mostly a placeholder. `LOG_LEVEL=error`. |
| `.env.production`  | `NODE_ENV=production`  | **no — never** | Does not exist as a file. Vercel injects production vars at runtime from its dashboard.                                 |

### Required keys (in `.env.example`)

```
NODE_ENV=
PORT=
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=
MAX_FILE_SIZE_MB=
LOG_LEVEL=
CORS_ORIGINS=
RATE_LIMIT_WINDOW_MINUTES=
RATE_LIMIT_MAX_REQUESTS=
AUTH_RATE_LIMIT_MAX_REQUESTS=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Notes:

- `DATABASE_URL` replaces the previous `MONGO_URI` naming, to match the lab spec. We rename consistently across env, config, and any docs.
- `UPLOAD_DIR` was dropped entirely. A var no code reads is a var that misleads whoever reads it next.
- `MAX_FILE_SIZE_MB` becomes the source of truth for Multer's size limit (previously hardcoded to 5 MB in [upload.ts:26](src/middlewares/upload.ts:26)).

### Loading and validation

In `src/config/env.ts`:

1. Read `process.env.NODE_ENV` (default `development`).
2. Call `dotenv.config({ path: \`.env.\${NODE_ENV}\` })`— populates`process.env` from the matching file. In production on Vercel, this no-ops because the file doesn't exist; Vercel already injected the vars. Either way the next step runs.
3. Pass `process.env` through the Zod schema. Missing or malformed → process crashes with a clear message at boot.
4. Export a typed `env` object. Every other module reads config from here, never from `process.env` directly.

This is fail-fast: the app refuses to start in an unknown state.

---

## 5. Testing strategy

### Levels

- **Unit tests** — pure functions and small units. No HTTP, no DB, no I/O. Fast (~ms per test). Located in `tests/unit/`.
- **Integration tests** — full Express app, real Mongoose, in-memory Mongo. Hit endpoints via Supertest. Slower (~tens of ms per test) but verify the whole stack.

We do **not** mock Mongoose in integration tests. The whole point is to verify the real query layer.

### Test database lifecycle

In `tests/setup/mongo.ts`:

- `beforeAll` — start `mongodb-memory-server`, get its URI, `mongoose.connect`.
- `afterEach` — drop all collections (fresh state per test).
- `afterAll` — `mongoose.disconnect`, stop the in-memory server.

### Cloudinary in tests

Cloudinary calls are mocked at the SDK boundary. We never make real network requests in tests — that would be slow, flaky, and burn the free-tier quota. The mock returns a fixed `{ secure_url, public_id }` shape.

This means we test:

- The **service** correctly passes the buffer to the SDK and persists the returned URL.
- The **controller** correctly wires the request to the service.

We do not test that Cloudinary itself works — that's their job.

### Coverage target

≥ 80% on `src/services/` and `src/middlewares/` (the lab requirement). Configured in `vitest.config.ts` via the `coverage` block. The CI workflow uploads the coverage report as an artifact (bonus).

### Test scripts

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

We alias `test` to `vitest run` rather than `jest --runInBand --forceExit` (the lab's literal text), because Vitest runs serially within a file by default and exits cleanly on its own. The intent of those flags ("don't parallelize, exit cleanly") is satisfied without them.

---

## 6. Logging strategy

Pino is already wired. We extend it with:

### A request-logging middleware

`src/middlewares/requestLogger.ts` — logs every incoming request at `info` level with method, path, status code, and duration. Mounted in `app.ts` **before** any route. Does not log the response body (PII risk).

### Explicit log calls at the required events

Per the lab's event/level table:

| Event                                    | Level   | Where the call lives                                             |
| ---------------------------------------- | ------- | ---------------------------------------------------------------- |
| Server started on port X                 | `info`  | [server.ts](src/server.ts) — replaces the leftover `console.log` |
| Incoming request                         | `info`  | new request-logger middleware                                    |
| File uploaded successfully               | `info`  | `mediaService.createMedia` after Cloudinary returns              |
| Validation error                         | `warn`  | `errorHandler` when `err.statusCode === 400`                     |
| Resource not found                       | `warn`  | `errorHandler` when `err.statusCode === 404`                     |
| Unhandled error caught by global handler | `error` | `errorHandler` for any non-`AppError`                            |
| Unhandled rejection / uncaught exception | `error` | `server.ts` process handlers (already in place — verify level)   |

### Per-environment behavior

- **development** — `pino-pretty` transport, color, human-readable.
- **test** — level `error` (set in `.env.test`). Suppresses info/warn chatter but real errors still surface during a test run.
- **production** — JSON one-object-per-line. No transport. Compatible with Vercel's log drain and any aggregator (Datadog, Logtail, etc.).

The transport is selected once in `src/config/logger.ts` based on `env.NODE_ENV`.

### The `console.log` audit

There is one leftover in [server.ts:11](src/server.ts:11). It goes. After this lab, the only `console.*` allowed in committed code is in test files when explicitly silencing output is needed.

---

## 7. Health endpoint

`GET /health` returns:

```json
{ "status": "ok", "uptime": 123.45, "timestamp": "2026-03-31T10:00:00.000Z" }
```

- `uptime` — `process.uptime()` (seconds since the process started).
- `timestamp` — `new Date().toISOString()`.
- No auth. No DB call. Cheap and synchronous. The whole point is "is the process alive."

A **deeper** `/health/ready` check (verifies Mongo connectivity, Cloudinary reachability) is _not_ in scope for this lab but would be the natural next step in a real production app. We note it for the roadmap.

The endpoint moves out of `app.ts` into `src/routes/health.routes.ts` for consistency with the rest of the codebase (everything else has its own route file).

---

## 8. Deployment to Vercel

### `vercel.json`

The lab's example points at `src/app.js`. Our project is TypeScript. We have two clean options:

- **Option A — let `@vercel/node` handle TS** — point at `src/app.ts`. The builder transpiles on the fly. Simplest. We use this.
- **Option B — pre-build to `dist/`** — run `yarn build` in Vercel's build step, point at `dist/app.js`. More control, slower deploys.

We use Option A:

```json
{
    "version": 2,
    "builds": [{ "src": "src/app.ts", "use": "@vercel/node" }],
    "routes": [{ "src": "/(.*)", "dest": "src/app.ts" }]
}
```

### What gets exported

Vercel's `@vercel/node` expects the entry file to export an Express app or a handler. Our [`app.ts`](src/app.ts) already does `export default app`, which is correct. `server.ts` is **not** used on Vercel — Vercel does its own listening. `server.ts` stays the local entrypoint.

### Production env vars

Set via the Vercel **dashboard**, not the CLI. The lab is explicit about this — the CLI variant (`vercel env add`) is fine for non-secrets but the dashboard provides better audit and reduces shell-history exposure. Required:

`NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `MAX_FILE_SIZE_MB`, `LOG_LEVEL`, `CORS_ORIGINS`, `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS`, `AUTH_RATE_LIMIT_MAX_REQUESTS`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

`PORT` is **not** set — Vercel chooses it. Our `server.ts` reads `env.PORT`, but `server.ts` doesn't run on Vercel, so it doesn't matter.

`UPLOAD_DIR` no longer exists — see above. Nothing writes to disk, so Vercel's read-only filesystem is a non-issue rather than something to work around.

### Known Vercel limitations (documented for the lab)

| Limitation                              | Our response                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Ephemeral filesystem                    | All uploads go through Cloudinary. No `fs.writeFile` in any request handler.                    |
| Cold starts                             | Mongo connection is created lazily and cached across invocations in the same warm container.    |
| 10-second function timeout (hobby tier) | Acceptable for this API. Larger Cloudinary uploads could hit it; we set Multer's limit to 5 MB. |
| No persistent in-memory state           | We do not use in-memory caches. JWT verification is stateless.                                  |

---

## 9. Git workflow and CI/CD

### Branch model

- **`main`** — stable, submission-grade. Only updated by merges from `develop`.
- **`develop`** — integration branch for the production-readiness work.
- **`feat/*`, `chore/*`, `test/*`, `ci/*`** — short-lived feature branches off `develop`. One per build-order step. PR'd into `develop`.

### `.github/workflows/ci.yml`

Triggers: every push to any branch, every pull request to `main` or `develop`. Steps:

1. Checkout code.
2. Read Node version from `.nvmrc`, install it via `actions/setup-node`.
3. Cache yarn dependencies.
4. `yarn install --frozen-lockfile`.
5. `yarn lint`.
6. `yarn typecheck`.
7. `yarn test:coverage`.
8. Upload coverage report as artifact (bonus).

We deliberately include lint and typecheck in CI, not only tests. Lint errors and type errors are bugs caught earlier; running them in CI prevents a green-test-but-broken-typecheck branch from merging.

### Branch protection

Set on both `main` and `develop` in GitHub's repository settings, **after** the CI workflow lands (otherwise we'd lock ourselves out before CI exists):

- Require a pull request before merging.
- Require the CI workflow to pass.
- No force pushes.
- No direct deletes.

### Commit history

We aim for a clean linear history that tells the story of the project. Per the lab:

1. Initial project setup (already on `main`)
2. Feature implementation — previous lab (already on `main`)
3. Production readiness planning doc (this commit)
4. Environment configuration
5. Health endpoint
6. Structured logging
7. Cloudinary upload migration
8. Test suite (unit + integration)
9. Postman collection
10. CI pipeline
11. Deployment configuration

Each lands as a separate PR with a descriptive message. Co-author trailer when AI-assisted, per project convention.

---

## 10. Postman collection

### Structure

A single collection `Media Library API`, with two environments:

- **Development** — `BASE_URL = http://localhost:3000/api/v1`
- **Production** — `BASE_URL = https://<deployed>.vercel.app/api/v1`

### Variables used throughout

`{{BASE_URL}}`, `{{TOKEN}}`, `{{MEDIA_ID}}`. The collection's pre-request scripts log in once and stash the token; the upload request stashes the new media's `_id` into `{{MEDIA_ID}}` so subsequent GET/PUT/DELETE requests use it without manual editing.

### Per-request tests

Each request has a `Tests` tab with assertions for:

- HTTP status code.
- Response envelope shape (`status` is `success` or `error`, `data` or `message` present).
- Endpoint-specific fields (`data.pagination` on list; `data._id` on create; `data.url` on upload).

### Where it lives

Exported as JSON to `/postman/Media-Library-API.postman_collection.json` and committed. The two environment JSON files (`Development.postman_environment.json`, `Production.postman_environment.json`) also go in `/postman/`. Both are committed because they contain only the base URL, no secrets.

---

## 11. Coding style additions

The conventions in `ARCHITECTURE.md` §10 still apply. New for this phase:

- **Tests use `describe`/`it`** (Vitest's API). One `describe` per unit under test. Assertions read like English: `expect(result.totalPages).toBe(3)`.
- **No real network in any test.** Cloudinary and any future external service is mocked at its SDK boundary.
- **Test files end in `.test.ts`** and live under `tests/`, mirroring the `src/` structure they cover.
- **Factories over fixtures.** Instead of static JSON fixtures, `tests/helpers/factories.ts` exports functions that produce test data (`makeUser({ email: "x@y.com" })`). Reduces drift when the schema changes.
- **No `process.env` reads outside `config/env.ts`.** All env access goes through the typed `env` object.
- **No `console.*` in committed code** outside `tests/` (and even there, only when explicitly muting logs).

---

## 12. Build order

The order minimizes risk: each step leaves a runnable, testable project. We do not write any code that depends on an unbuilt foundation. Each step is its own feature branch off `develop` and lands via PR.

1. **Environment config refactor**
   Rename `MONGO_URI` → `DATABASE_URL`, introduce `MAX_FILE_SIZE_MB`, `UPLOAD_DIR`, Cloudinary keys. Extend `env.ts` to load by `NODE_ENV`. Update `.env.example`. Verify the app still boots locally.

2. **Health endpoint enhancement**
   Move `/health` into its own route file. Return `{ status, uptime, timestamp }`. No dependencies — quick win.

3. **Logger enhancements**
   Add request-logging middleware. Add the event-specific log calls. Remove the `console.log` in `server.ts`. Configure `error` level for test env.

4. **Cloudinary migration**
   Add `cloudinary` SDK + config module. Switch Multer to `memoryStorage`. Update `Media` model (`url`, `publicId` replace `filePath`). Update create + delete services. Test locally with real Cloudinary dev credentials.

5. **Vitest setup**
   Install Vitest, Supertest, `mongodb-memory-server`. Write `vitest.config.ts` with coverage thresholds. Write the `tests/setup/` infrastructure.

6. **Unit tests**
   `AppError`, `catchAsync`, `validate`, `mediaService` pagination. Fast iteration loop.

7. **Integration tests**
   All five media endpoints, with auth wired. Verify coverage ≥ 80% on `services/` and `middlewares/`.

8. **Postman collection**
   Build manually, export, commit. Run the dev environment against localhost to verify.

9. **CI pipeline**
   `.github/workflows/ci.yml`. Push a feature branch, open a PR, watch it go green.

10. **Branch protection**
    Enable on `main` and `develop` in GitHub settings. From now on, no direct pushes to either.

11. **Vercel deployment**
    Create `vercel.json`, connect the GitHub repo via the Vercel dashboard, add production env vars in the dashboard, deploy. Verify all endpoints respond.

12. **Postman production verification**
    Switch Postman to the Production environment, run the full collection against the live URL. Every test should pass.

13. **(Bonus) Uptime monitoring**
    Point UptimeRobot or Better Uptime at `/health`. Configure email/slack on downtime.

14. **Final merge**
    Open `develop` → `main` PR. Once green, merge. `main` now reflects the production-ready state.

---

## 13. Open questions and known trade-offs

- **Cloudinary free-tier limits.** 25 GB storage, 25 GB bandwidth/month. Fine for a learning project; we'd need to upgrade or move to S3 for a real product.
- **No request-ID correlation across logs.** Each request log line stands alone. A small `req.id` middleware (using `crypto.randomUUID()`) would let us correlate logs for a single request. Worth adding later; not required by the lab.
- **No rate limiting.** Auth endpoints especially could be hit hard. `express-rate-limit` is the canonical fix. Out of scope here; noted for the next lab.
- **No `/health/ready` deep check.** `/health` only proves the process is alive, not that Mongo and Cloudinary are reachable. A separate readiness endpoint is the production-grade upgrade.
- **Vercel cold starts on Mongo connection.** Each cold container reconnects. Mongoose's default pool handles this, but tail-latency on the first request after idle will be higher than a long-running server. Acceptable for a hobby tier; documented for awareness.

---

**This document is the contract for the production-readiness phase. If something we implement does not match what's here, we either fix the code or update this file — never let them drift.**

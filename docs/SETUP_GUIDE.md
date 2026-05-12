# Node + TypeScript Backend Setup — Plain English Guide

A reference for setting up a Node.js backend project with TypeScript, ESLint, Prettier, Husky, and lint-staged. Written so you can read it once, understand what each tool does and why, and copy the steps next time without looking things up.

---

## Part 1 — The mental model

Before any installs, understand what each tool is for. If you know **what problem each one solves**, the setup stops feeling like magic.

### The tools, one sentence each

| Tool                          | What it solves                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Node.js**                   | Runs JavaScript outside the browser (on your server).                                                          |
| **TypeScript**                | Adds types to JavaScript so the compiler catches bugs before runtime.                                          |
| **tsc** (TypeScript compiler) | Turns `.ts` files into plain `.js` files the Node runtime can run.                                             |
| **tsx**                       | Runs `.ts` files directly in development, no compile step. Has its own watcher (`tsx watch`).                  |
| **ESLint**                    | Reads your code and flags real bugs and bad patterns (unused variables, missing awaits, etc.).                 |
| **Prettier**                  | Formats your code so spacing, quotes, and semicolons are always identical. Not about bugs — about consistency. |
| **eslint-config-prettier**    | Turns off the ESLint rules that overlap with Prettier so they stop arguing with each other.                    |
| **Husky**                     | Runs scripts automatically on git events like `commit` or `push`.                                              |
| **lint-staged**               | Runs commands only on the files you staged with `git add`. Pairs with Husky to make commits fast.              |
| **EditorConfig**              | A tiny file that tells every editor to use the same indentation and line endings.                              |
| **dotenv**                    | Loads environment variables from a `.env` file into `process.env`.                                             |
| **Yarn** (or npm/pnpm)        | Installs packages and runs scripts.                                                                            |

### Two things people get confused about

**1. ESLint vs Prettier — they do different jobs.**

- ESLint cares about **correctness** ("you have an unused variable", "this promise has no await").
- Prettier cares about **appearance** ("use two spaces, double quotes, semicolons").
- They overlap on some style rules (e.g. quotes). That's why `eslint-config-prettier` exists — it disables ESLint's style rules so Prettier wins those battles.

**2. `tsc` vs `tsx` — different tools.**

- `tsc` is the official **compiler**. It produces `.js` files in `dist/`. Use it for production builds (`yarn build`) and for type-checking (`yarn typecheck`).
- `tsx` is a **runner**. It executes `.ts` files directly without writing any output. Use it for development (`tsx watch src/app.ts`).
- They're not interchangeable. `tsc` does not run your code; `tsx` does not produce build output.

---

## Part 2 — The setup, step by step

This is the full recipe. Do these in order.

### Step 1 — Create the project

```bash
mkdir my-api
cd my-api
yarn init -y
```

That creates a basic `package.json`. Open it and add:

```json
"type": "module"
```

**Why:** This tells Node to treat your `.js` files as ECMAScript modules (the modern standard with `import`/`export`) instead of the old CommonJS format (`require`/`module.exports`).

### Step 2 — Install TypeScript and the Node runtime helpers

```bash
yarn add -D typescript @types/node tsx
```

**What each does:**

- `typescript` — the TypeScript compiler (`tsc`).
- `@types/node` — type definitions for Node's built-in modules (`fs`, `path`, `process`, etc.). Without these, TypeScript doesn't know what `process.env` is.
- `tsx` — runs `.ts` files directly during development.

**`-D` means devDependency** — these are only needed during development, not when the app runs in production.

### Step 3 — Create `tsconfig.json`

```bash
yarn tsc --init
```

That generates a default config. Replace it with this minimal modern setup:

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "module": "nodenext",
    "target": "esnext",
    "types": ["node"],
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true,
    "noEmit": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Plain-English explanation of the important options:**

- `rootDir` / `outDir` — read from `src/`, write to `dist/`.
- `module: "nodenext"` — use Node's modern module resolution (matches `"type": "module"` in package.json).
- `target: "esnext"` — output the newest JS features. Node 20 supports them all.
- `strict: true` — turn on every type-safety check. Catches real bugs.
- `noUncheckedIndexedAccess: true` — when you write `arr[0]`, the type includes `undefined`. Forces you to handle the case where the index doesn't exist.
- `exactOptionalPropertyTypes: true` — `field?: string` is different from `field: string | undefined`. Stricter and clearer.
- `verbatimModuleSyntax: true` — forces you to write `import type { Foo }` for type-only imports. Helps the bundler/compiler drop type imports cleanly.
- `isolatedModules: true` — every file must be compilable in isolation. Needed for tools like tsx, esbuild, swc.
- `skipLibCheck: true` — don't type-check files inside `node_modules`. Faster builds.
- `include` / `exclude` — only compile files under `src/`.

### Step 4 — Optional: a second tsconfig for dev/typecheck

Create `tsconfig.dev.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

**Why have two?**

- `tsconfig.json` is for **building** — it writes `.js` to `dist/`.
- `tsconfig.dev.json` is for **checking types only** — it doesn't write anything. Used by `tsc --noEmit -p tsconfig.dev.json` in your `typecheck` script. It also allows `.ts` extensions in imports if you ever want that during dev.

### Step 5 — Create the project structure

```bash
mkdir src
```

For our media-library project specifically:

```bash
mkdir -p src/{config,routes,controllers,services,repositories,models,middlewares,utils}
mkdir uploads docs
```

### Step 6 — Install Express and friends (project-specific)

For this project:

```bash
yarn add express mongoose zod multer bcrypt jsonwebtoken pino pino-pretty dotenv
yarn add -D @types/express @types/multer @types/bcrypt @types/jsonwebtoken
```

**Rule of thumb for types packages:** Any package whose name starts with `@types/...` belongs in **devDependencies**. They're TypeScript-only and never used at runtime.

### Step 7 — Install ESLint and Prettier

```bash
yarn add -D eslint @eslint/js typescript-eslint globals \
            prettier eslint-config-prettier eslint-plugin-prettier
```

**What each does:**

- `eslint` — the linter itself.
- `@eslint/js` — ESLint's core JavaScript rules.
- `typescript-eslint` — adds TypeScript support to ESLint (and TypeScript-specific rules).
- `globals` — ready-made lists of global variables (e.g. all Node globals like `process`, `Buffer`).
- `prettier` — the formatter.
- `eslint-config-prettier` — disables ESLint rules that conflict with Prettier.
- `eslint-plugin-prettier` — optional; runs Prettier _as_ an ESLint rule. Most people skip this and run them as separate steps.

### Step 8 — Create `eslint.config.js` (flat config)

ESLint v9+ uses "flat config" — one file, no `.eslintrc` nonsense.

```js
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
  },
  tseslint.configs.recommended,
  prettier,
]);
```

**Plain English:**

- The first object says "lint these file types, use the recommended JS rules, and assume Node globals exist."
- `tseslint.configs.recommended` adds the recommended TypeScript rules.
- `prettier` (the config, last in the list) turns off any earlier rule that conflicts with Prettier.

**Why "last in the list" matters:** ESLint configs are merged in order. Anything later overrides earlier. Putting `prettier` last guarantees it has the final say on style conflicts.

### Step 9 — Create `.prettierrc`

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": false,
  "tabWidth": 2,
  "printWidth": 80
}
```

**Plain English:** semicolons on, trailing commas where ES5 allows (objects/arrays), double quotes, 2-space indent, wrap lines at 80 chars.

### Step 10 — Create `.prettierignore`

```
dist/
node_modules/
yarn.lock
uploads/
```

Prettier should not touch generated or vendor files.

### Step 11 — Create `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

**Why:** Anyone who clones the repo and opens it in VS Code, WebStorm, Sublime, etc. gets identical indent/line-ending settings. This stops "my editor reformatted everything" diffs.

### Step 12 — Set up Husky + lint-staged

```bash
yarn add -D husky lint-staged
yarn husky install
```

`husky install` creates a `.husky/` folder. Now create the pre-commit hook:

```bash
echo "yarn lint-staged" > .husky/pre-commit
```

(On Windows, just create the file `.husky/pre-commit` with `yarn lint-staged` as its single line.)

Then add to `package.json`:

```json
"lint-staged": {
  "src/**/*.ts": [
    "prettier --write",
    "eslint --fix"
  ]
},
"scripts": {
  "prepare": "husky install"
}
```

**Plain English:**

- Every time you run `git commit`, Husky runs the pre-commit hook.
- The hook runs `lint-staged`.
- `lint-staged` looks at only the **staged** files matching `src/**/*.ts`, runs Prettier on them (auto-fixes formatting), then ESLint (auto-fixes what it can).
- The `prepare` script makes Husky reinstall itself whenever someone runs `yarn install`. This way fresh clones get the hooks automatically.

**Why "only staged files"?** Linting the whole project on every commit gets slow. With lint-staged, commit speed stays the same forever.

### Step 13 — Write your full `scripts` block

```json
"scripts": {
  "prepare": "husky install",
  "dev": "tsx watch src/app.ts",
  "start": "node dist/server.js",
  "build": "tsc",
  "lint": "eslint .",
  "format:check": "prettier --check .",
  "format": "prettier --write .",
  "typecheck": "tsc --noEmit -p tsconfig.dev.json"
}
```

**Memorize this set.** Every backend project needs roughly the same eight scripts. The names are conventions other devs will recognize.

### Step 14 — Create `.gitignore`

```
dist/
node_modules/
uploads/
.env
*.log
```

Anything generated, secret, or per-machine should never be committed.

### Step 15 — Create `.env.example` (commit it) and `.env` (don't)

`.env.example` lists every variable with a placeholder. `.env` has the real values and stays out of git.

```
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/media-library
JWT_SECRET=change-me-to-a-long-random-string
JWT_EXPIRES_IN=7d
LOG_LEVEL=debug
```

---

## Part 3 — Common confusion and gotchas

### "Why do I have to write `.js` in imports of `.ts` files?"

Because we set `"type": "module"` and `module: "nodenext"`. Native ESM in Node requires fully-specified file extensions in imports. TypeScript expects you to write the path **as it will appear after compilation**, which is `.js`.

```ts
// In src/services/mediaService.ts
import { Media } from "../models/media.js"; // ✅ correct
import { Media } from "../models/media"; // ❌ won't work in compiled output
import { Media } from "../models/media.ts"; // ❌ TypeScript hates this in prod tsconfig
```

It feels weird the first day. After that it's invisible.

### "What's the difference between `dependencies` and `devDependencies`?"

- **dependencies** — packages your _running app_ needs. (Express, Mongoose, Zod.)
- **devDependencies** — packages used during development, building, or testing only. (TypeScript, ESLint, Prettier, all `@types/*` packages.)

If you'd deploy to a server, run `yarn install --production` there and only `dependencies` get installed.

### "ESLint and Prettier keep fighting"

You forgot to add `eslint-config-prettier` to your ESLint config, or you put it before other configs instead of last.

### "My pre-commit hook does nothing"

Common causes:

1. You didn't run `yarn husky install` (or the `prepare` script didn't run on install).
2. The hook file (`.husky/pre-commit`) doesn't have execute permission on Mac/Linux. Run `chmod +x .husky/pre-commit`.
3. Your `lint-staged` config doesn't match any files (check the glob pattern).

### "`yarn lint` says `--ext` is unknown"

You're on ESLint v9+ with flat config. The `--ext` flag was removed. Just run `eslint .` — file patterns come from the config file now.

### "Why two tsconfigs?"

- `tsconfig.json` → for `tsc` to **build** production output.
- `tsconfig.dev.json` → extends the base with `noEmit: true` so `typecheck` runs faster (no file writing) and allows looser dev-time options.

### "What does `prepare` do?"

It's a special npm/yarn script name. It runs **automatically** after `yarn install`. We use it to make sure Husky reinstalls its git hooks for every fresh clone.

---

## Part 4 — The minimum setup, copy-paste edition

When you start your next project, this is the speed-run order:

```bash
# 1. Init
mkdir my-api && cd my-api
yarn init -y

# 2. Add "type": "module" to package.json manually

# 3. Install everything
yarn add -D typescript @types/node tsx \
            eslint @eslint/js typescript-eslint globals \
            prettier eslint-config-prettier \
            husky lint-staged

# 4. Bootstrap configs
yarn tsc --init               # then replace contents with the minimal one above
yarn husky install
echo "yarn lint-staged" > .husky/pre-commit

# 5. Make the folders
mkdir src
```

Then create these files by hand (templates above):

- `tsconfig.json` and `tsconfig.dev.json`
- `eslint.config.js`
- `.prettierrc`, `.prettierignore`
- `.editorconfig`
- `.gitignore`
- `.env.example`

Add `scripts` and `lint-staged` blocks to `package.json`.

That's the whole setup. Once you've done it twice, it takes about 15 minutes.

---

## Part 5 — When something breaks, check this first

| Symptom                                                    | Likely cause                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Cannot find module './foo'` at runtime                    | Missing `.js` extension on the import                                           |
| `Cannot use import statement outside a module`             | Forgot `"type": "module"` in package.json                                       |
| ESLint and Prettier disagree                               | `eslint-config-prettier` missing or not last in extends                         |
| Pre-commit hook runs nothing                               | Husky not installed, or `lint-staged` glob doesn't match                        |
| `tsc` writes files to `dist/src/...` instead of `dist/...` | `rootDir` is missing from tsconfig                                              |
| TypeScript error about `process` not defined               | Missing `@types/node` or `types: ["node"]` in tsconfig                          |
| `import type` errors after refactor                        | `verbatimModuleSyntax` is on — you must use `import type` for type-only imports |
| Random files getting compiled                              | Missing `include` field in tsconfig                                             |

---

**Keep this guide next to your projects. The recipe rarely changes — once you know it, every Node + TypeScript backend starts the same way.**

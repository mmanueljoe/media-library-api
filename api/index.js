/**
 * Vercel's entry point. Locally `src/bootstrap.ts` calls app.listen() and owns
 * the process; here there is no process to own — Vercel imports this file and
 * hands the Express app one request at a time. So we export the app and nothing
 * else: no listen, no signal handlers, no connect-on-boot.
 *
 * Plain .js importing from dist/ on purpose. `yarn build` runs first (see
 * vercel.json), and tsc-alias has already rewritten the @/ aliases into real
 * relative paths by then, so Vercel never has to resolve our TS path mapping.
 *
 * The odd filenames in src/ (createApp, bootstrap) exist because Vercel treats a
 * default-exporting `app`/`index`/`server` file in src/ as an Express entrypoint
 * and compiles it with its own TypeScript settings, which broke the build. This
 * file is the only entrypoint we want it to find.
 */
export { default } from "../dist/createApp.js";

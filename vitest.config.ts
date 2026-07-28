import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    test: {
        globals: false,
        environment: "node",
        setupFiles: ["./tests/setup/setup.ts"],
        include: ["tests/**/*.test.ts"],
        testTimeout: 30_000,
        hookTimeout: 60_000,
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            include: ["src/services/**", "src/middlewares/**"],
            exclude: ["src/middlewares/validators/**"],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
});

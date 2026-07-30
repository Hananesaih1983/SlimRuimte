import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * The brief specified `new URL('./src', import.meta.url).pathname` for the alias.
 * On Windows that yields `/C:/Users/...` (a leading slash before the drive
 * letter), which no loader can resolve — every `@/...` import fails. `fileURLToPath`
 * is the platform-correct conversion and behaves identically on POSIX.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/test/**/*.test.{ts,tsx}"],
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});

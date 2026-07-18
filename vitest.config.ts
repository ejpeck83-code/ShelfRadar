import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    coverage: { reporter: ["text", "json", "html"] }
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } }
});

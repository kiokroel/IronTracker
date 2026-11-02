import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "react-native": "./src/utils/test/react-native-mock.ts",
    },
  },
});

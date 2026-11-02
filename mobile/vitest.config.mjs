import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: true,
  },
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "react-native": "./src/utils/test/react-native-mock.ts",
      "expo-secure-store": "./src/utils/test/expo-secure-store-mock.ts",
    },
  },
});

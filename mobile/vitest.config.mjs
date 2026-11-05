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
      "expo-constants": "./src/utils/test/expo-constants-mock.ts",
      "expo-keep-awake": "./src/utils/test/expo-keep-awake-mock.ts",
      "expo-haptics": "./src/utils/test/expo-haptics-mock.ts",
      "expo-av": "./src/utils/test/expo-av-mock.ts",
      "@react-native-async-storage/async-storage": "./src/utils/test/async-storage-mock.ts",
    },
  },
});

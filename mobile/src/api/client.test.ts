import { beforeEach, describe, expect, it } from "vitest";
import apiClient, {
  getApiBaseUrl,
  getAuthToken,
  setApiBaseUrl,
  setAuthToken,
} from "./client";

describe("API Client", () => {
  beforeEach(() => {
    setAuthToken(null);
  });

  it("should have a default base URL", () => {
    expect(getApiBaseUrl()).toBeDefined();
    expect(apiClient.defaults.baseURL).toBe(getApiBaseUrl());
  });

  it("should allow setting a custom base URL", () => {
    const customUrl = "http://192.168.1.100:80/api/v1";
    setApiBaseUrl(customUrl);
    expect(getApiBaseUrl()).toBe(customUrl);
    expect(apiClient.defaults.baseURL).toBe(customUrl);
  });

  it("should manage authentication token properly", () => {
    expect(getAuthToken()).toBeNull();
    setAuthToken("test-jwt-token-12345");
    expect(getAuthToken()).toBe("test-jwt-token-12345");
    expect(apiClient.defaults.headers.common.Authorization).toBe(
      "Bearer test-jwt-token-12345"
    );

    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
    expect(apiClient.defaults.headers.common.Authorization).toBeUndefined();
  });
});

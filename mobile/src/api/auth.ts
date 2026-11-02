import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  User,
} from "../types";
import apiClient from "./client";

export async function loginUser(
  credentials: LoginRequest
): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>(
    "/users/login",
    credentials
  );
  return response.data;
}

export async function registerUser(
  payload: RegisterRequest
): Promise<User> {
  const response = await apiClient.post<User>(
    "/users/register",
    payload
  );
  return response.data;
}

export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>("/users/me");
  return response.data;
}

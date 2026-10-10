import apiClient from './client';
import { User, LoginRequest, RegisterRequest, TokenResponse, UserUpdate } from '@/types/auth';

export const authApi = {
  /**
   * Register a new athlete account.
   */
  async register(data: RegisterRequest): Promise<User> {
    const response = await apiClient.post<User>('/users/register', data);
    return response.data;
  },

  /**
   * Authenticate athlete and obtain signed JWT access token.
   */
  async login(data: LoginRequest): Promise<TokenResponse> {
    const response = await apiClient.post<TokenResponse>('/users/login', data);
    return response.data;
  },

  /**
   * Fetch current athlete's profile.
   */
  async getMe(): Promise<User> {
    const response = await apiClient.get<User>('/users/me');
    return response.data;
  },

  /**
   * Update current athlete's profile details.
   */
  async updateMe(data: UserUpdate): Promise<User> {
    const response = await apiClient.put<User>('/users/me', data);
    return response.data;
  },
};

export default authApi;

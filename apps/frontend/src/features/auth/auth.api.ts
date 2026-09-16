import { apiClient } from "@/lib/api-client";
import type { LoginInput, RegisterInput, User } from "@/features/auth/auth.types";

export async function apiLogin(input: LoginInput): Promise<User> {
  const { data } = await apiClient.post<{ user: User }>("/auth/login", input);
  return data.user;
}

export async function apiRegister(input: RegisterInput): Promise<User> {
  const { data } = await apiClient.post<{ user: User }>("/auth/register", input);
  return data.user;
}

export async function apiLogout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function apiFetchMe(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>("/auth/me");
  return data.user;
}

import { apiClient } from "@/lib/api-client";
import type { PaginatedResult } from "@/features/movies/movies.types";
import type { AdminUser, CreateUserInput, ListUsersParams, UpdateUserInput } from "@/features/users/users.types";

export async function fetchUsers(params: ListUsersParams): Promise<PaginatedResult<AdminUser>> {
  const { data } = await apiClient.get<PaginatedResult<AdminUser>>("/users", { params });
  return data;
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  const { data } = await apiClient.post<{ user: AdminUser }>("/users", input);
  return data.user;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<AdminUser> {
  const { data } = await apiClient.patch<{ user: AdminUser }>(`/users/${id}`, input);
  return data.user;
}

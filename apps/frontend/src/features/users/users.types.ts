import type { Role, User } from "@/features/auth/auth.types";

export type AdminUser = User;

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: Role;
  isActive?: boolean;
}

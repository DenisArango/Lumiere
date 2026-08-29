import { create } from "zustand";
import type { User } from "@/features/auth/auth.types";
import { apiFetchMe, apiLogin, apiLogout, apiRegister } from "@/features/auth/auth.api";
import type { LoginInput, RegisterInput } from "@/features/auth/auth.types";

interface AuthState {
  user: User | null;
  /** true mientras se resuelve la sesion inicial (GET /auth/me al cargar la app) - evita un parpadeo de "no autenticado" antes de saber la respuesta real. */
  isInitializing: boolean;
  isSubmitting: boolean;
  initialize: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isInitializing: true,
  isSubmitting: false,

  initialize: async () => {
    try {
      const user = await apiFetchMe();
      set({ user, isInitializing: false });
    } catch {
      set({ user: null, isInitializing: false });
    }
  },

  login: async (input) => {
    set({ isSubmitting: true });
    try {
      const user = await apiLogin(input);
      set({ user, isSubmitting: false });
    } catch (error) {
      set({ isSubmitting: false });
      throw error;
    }
  },

  register: async (input) => {
    set({ isSubmitting: true });
    try {
      const user = await apiRegister(input);
      set({ user, isSubmitting: false });
    } catch (error) {
      set({ isSubmitting: false });
      throw error;
    }
  },

  logout: async () => {
    await apiLogout();
    set({ user: null });
  },
}));

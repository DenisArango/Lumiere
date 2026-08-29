import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

/**
 * Cliente HTTP central. `withCredentials: true` es obligatorio: la sesion
 * vive en cookies httpOnly (access_token, refresh_token) que el backend
 * setea - ver docs/backend/01-auth.md. En desarrollo, Vite hace proxy de
 * /api hacia el backend (vite.config.ts) para que las cookies compartan
 * origen y no haya problemas de CORS/SameSite.
 */
export const apiClient = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
});

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1];
}

const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);

/**
 * CSRF double-submit: el backend espera el mismo valor de la cookie
 * csrf_token (no httpOnly, por eso JS puede leerla) en el header
 * X-CSRF-Token para cualquier mutacion - ver middleware/csrf.ts del
 * backend y docs/06-seguridad.md.
 */
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = config.method?.toLowerCase();
  if (method && MUTATING_METHODS.has(method)) {
    const csrfToken = getCookie("csrf_token");
    if (csrfToken) {
      config.headers.set("X-CSRF-Token", csrfToken);
    }
  }
  return config;
});

let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  const csrfToken = getCookie("csrf_token");
  await axios.post(
    "/api/v1/auth/refresh",
    {},
    { withCredentials: true, headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {} },
  );
}

/**
 * Si un access token expira a mitad de sesion, el backend responde 401.
 * Se intenta refrescar la sesion UNA vez y reintentar la request original
 * - si el refresh tambien falla, se deja que el 401 se propague (la app
 * redirige a login). Ver secuencia completa en docs/05-diagramas-uml.md.
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    const isAuthEndpoint = originalRequest?.url?.includes("/auth/login") || originalRequest?.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && originalRequest && !originalRequest._retried && !isAuthEndpoint) {
      originalRequest._retried = true;
      try {
        refreshPromise ??= refreshSession();
        await refreshPromise;
        refreshPromise = null;
        return apiClient(originalRequest);
      } catch (refreshError) {
        refreshPromise = null;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export interface ApiErrorBody {
  error: { message: string; details?: unknown };
}

export function getApiErrorMessage(error: unknown, fallback = "Algo salió mal, intenta de nuevo"): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    return body?.error?.message ?? fallback;
  }
  return fallback;
}

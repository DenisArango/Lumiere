import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { RootLayout } from "@/components/layout/root-layout";
import { HomePage } from "@/pages/home";
import { MovieDetailPage } from "@/pages/movie-detail";
import { ShowtimesPage } from "@/pages/showtimes";
import { SeatSelectionPage } from "@/pages/seat-selection";
import { CheckoutPage } from "@/pages/checkout";
import { ConfirmationPage } from "@/pages/confirmation";
import { MyOrdersPage } from "@/pages/my-orders";
import { CinemasPage } from "@/pages/cinemas";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
import { WipPage } from "@/pages/wip";
import { useAuthStore } from "@/features/auth/auth.store";

/**
 * El panel de administracion (incluye recharts, un chunk pesado) se separa
 * en su propio bundle - un cliente comun jamas visita /admin, no tiene
 * sentido que pague ese peso de descarga.
 */
const AdminLayout = lazy(() => import("@/components/layout/admin-layout").then((m) => ({ default: m.AdminLayout })));
const ReportsDashboardPage = lazy(() =>
  import("@/pages/admin/reports-dashboard").then((m) => ({ default: m.ReportsDashboardPage })),
);
const MoviesListPage = lazy(() => import("@/pages/admin/movies-list").then((m) => ({ default: m.MoviesListPage })));
const MovieFormPage = lazy(() => import("@/pages/admin/movie-form").then((m) => ({ default: m.MovieFormPage })));

function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const location = useLocation();

  if (isInitializing) return null;
  if (!user) return <Navigate to="/iniciar-sesion" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function AdminFallback() {
  return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-ink-muted sm:px-6">Cargando panel…</div>;
}

export function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path="peliculas/:id" element={<MovieDetailPage />} />
        <Route path="peliculas/:id/funciones" element={<ShowtimesPage />} />
        <Route path="cines" element={<CinemasPage />} />
        <Route path="iniciar-sesion" element={<LoginPage />} />
        <Route path="registro" element={<RegisterPage />} />
        <Route path="funciones/:id/asientos" element={<SeatSelectionPage />} />
        <Route
          path="checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="confirmacion"
          element={
            <ProtectedRoute>
              <ConfirmationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mis-ordenes"
          element={
            <ProtectedRoute>
              <MyOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin"
          element={
            <Suspense fallback={<AdminFallback />}>
              <AdminLayout />
            </Suspense>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={<AdminFallback />}>
                <ReportsDashboardPage />
              </Suspense>
            }
          />
          <Route
            path="peliculas"
            element={
              <Suspense fallback={<AdminFallback />}>
                <MoviesListPage />
              </Suspense>
            }
          />
          <Route
            path="peliculas/nueva"
            element={
              <Suspense fallback={<AdminFallback />}>
                <MovieFormPage />
              </Suspense>
            }
          />
          <Route
            path="peliculas/:id/editar"
            element={
              <Suspense fallback={<AdminFallback />}>
                <MovieFormPage />
              </Suspense>
            }
          />
          <Route path="cines" element={<WipPage title="Gestión de cines" />} />
          <Route path="promociones" element={<WipPage title="Gestión de promociones" />} />
        </Route>
        <Route path="*" element={<WipPage title="Página no encontrada" />} />
      </Route>
    </Routes>
  );
}

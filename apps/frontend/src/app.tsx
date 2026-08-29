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
 * sentido que pague ese peso de descarga. Un unico Suspense en la ruta
 * padre ("admin") cubre todas las rutas hijas, que se renderizan dentro
 * de su <Outlet />.
 */
const AdminLayout = lazy(() => import("@/components/layout/admin-layout").then((m) => ({ default: m.AdminLayout })));
const ReportsDashboardPage = lazy(() =>
  import("@/pages/admin/reports-dashboard").then((m) => ({ default: m.ReportsDashboardPage })),
);
const MoviesListPage = lazy(() => import("@/pages/admin/movies-list").then((m) => ({ default: m.MoviesListPage })));
const MovieFormPage = lazy(() => import("@/pages/admin/movie-form").then((m) => ({ default: m.MovieFormPage })));
const CinemasListPage = lazy(() =>
  import("@/pages/admin/cinemas-list").then((m) => ({ default: m.CinemasListPage })),
);
const CinemaFormPage = lazy(() => import("@/pages/admin/cinema-form").then((m) => ({ default: m.CinemaFormPage })));
const CinemaDetailPage = lazy(() =>
  import("@/pages/admin/cinema-detail").then((m) => ({ default: m.CinemaDetailPage })),
);
const ShowtimesListPage = lazy(() =>
  import("@/pages/admin/showtimes-list").then((m) => ({ default: m.ShowtimesListPage })),
);
const ShowtimeFormPage = lazy(() =>
  import("@/pages/admin/showtime-form").then((m) => ({ default: m.ShowtimeFormPage })),
);
const PromotionsListPage = lazy(() =>
  import("@/pages/admin/promotions-list").then((m) => ({ default: m.PromotionsListPage })),
);
const PromotionFormPage = lazy(() =>
  import("@/pages/admin/promotion-form").then((m) => ({ default: m.PromotionFormPage })),
);
const ProductsListPage = lazy(() =>
  import("@/pages/admin/products-list").then((m) => ({ default: m.ProductsListPage })),
);
const ProductFormPage = lazy(() =>
  import("@/pages/admin/product-form").then((m) => ({ default: m.ProductFormPage })),
);

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
          <Route index element={<ReportsDashboardPage />} />
          <Route path="peliculas" element={<MoviesListPage />} />
          <Route path="peliculas/nueva" element={<MovieFormPage />} />
          <Route path="peliculas/:id/editar" element={<MovieFormPage />} />
          <Route path="cines" element={<CinemasListPage />} />
          <Route path="cines/nuevo" element={<CinemaFormPage />} />
          <Route path="cines/:id" element={<CinemaDetailPage />} />
          <Route path="funciones" element={<ShowtimesListPage />} />
          <Route path="funciones/nueva" element={<ShowtimeFormPage />} />
          <Route path="promociones" element={<PromotionsListPage />} />
          <Route path="promociones/nueva" element={<PromotionFormPage />} />
          <Route path="productos" element={<ProductsListPage />} />
          <Route path="productos/nuevo" element={<ProductFormPage />} />
        </Route>
        <Route path="*" element={<WipPage title="Página no encontrada" />} />
      </Route>
    </Routes>
  );
}

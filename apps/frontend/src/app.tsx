import { useEffect, type ReactNode } from "react";
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

function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const location = useLocation();

  if (isInitializing) return null;
  if (!user) return <Navigate to="/iniciar-sesion" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
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
          path="admin/*"
          element={
            <ProtectedRoute>
              <WipPage title="Panel de gestión" />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<WipPage title="Página no encontrada" />} />
      </Route>
    </Routes>
  );
}

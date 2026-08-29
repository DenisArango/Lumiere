import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { BarChart3, Building2, CalendarClock, Clapperboard, Popcorn, Tag } from "lucide-react";
import { useAuthStore } from "@/features/auth/auth.store";
import { cn } from "@/lib/utils";

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "CINEMA_MANAGER"]);

const NAV = [
  { to: "/admin", label: "Reportería", icon: BarChart3, end: true },
  { to: "/admin/peliculas", label: "Películas", icon: Clapperboard },
  { to: "/admin/cines", label: "Cines", icon: Building2 },
  { to: "/admin/funciones", label: "Funciones", icon: CalendarClock },
  { to: "/admin/promociones", label: "Promociones", icon: Tag },
  { to: "/admin/productos", label: "Dulcería", icon: Popcorn },
];

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const location = useLocation();

  if (isInitializing) return null;
  if (!user) return <Navigate to="/iniciar-sesion" state={{ from: location.pathname }} replace />;
  if (!ADMIN_ROLES.has(user.role)) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[200px_1fr]">
      <aside>
        <p className="eyebrow">Panel de gestión</p>
        <nav className="mt-4 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 border-l-2 px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "border-gold text-ink"
                    : "border-transparent text-ink-muted hover:border-hairline hover:text-ink",
                )
              }
            >
              <Icon className="size-4" /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}

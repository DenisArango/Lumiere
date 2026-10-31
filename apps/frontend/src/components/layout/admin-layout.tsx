import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Building2,
  CalendarClock,
  Clapperboard,
  Contact,
  History,
  MessageSquare,
  Popcorn,
  Receipt,
  Tag,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/features/auth/auth.store";
import type { Role } from "@/features/auth/auth.types";
import { cn } from "@/lib/utils";

const ADMIN_ROLES = new Set<Role>(["SUPER_ADMIN", "CINEMA_MANAGER"]);

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  roles?: Role[];
}

/** Agrupado por la pregunta que responde cada seccion, no por orden de construccion. */
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Resumen",
    items: [{ to: "/admin", label: "Reportería", icon: BarChart3, end: true }],
  },
  {
    title: "Programación",
    items: [
      { to: "/admin/peliculas", label: "Películas", icon: Clapperboard },
      { to: "/admin/funciones", label: "Funciones", icon: CalendarClock },
      { to: "/admin/cines", label: "Cines y salas", icon: Building2 },
    ],
  },
  {
    title: "Ventas",
    items: [
      { to: "/admin/ordenes", label: "Órdenes", icon: Receipt },
      { to: "/admin/promociones", label: "Promociones", icon: Tag },
      { to: "/admin/productos", label: "Dulcería", icon: Popcorn },
    ],
  },
  {
    title: "Comunidad",
    items: [
      { to: "/admin/resenas", label: "Reseñas", icon: MessageSquare },
      { to: "/admin/catalogo", label: "Personas y géneros", icon: Contact },
      { to: "/admin/usuarios", label: "Usuarios", icon: UserCog, roles: ["SUPER_ADMIN"] },
    ],
  },
  {
    title: "Sistema",
    items: [{ to: "/admin/auditoria", label: "Auditoría", icon: History, roles: ["SUPER_ADMIN"] }],
  },
];

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const location = useLocation();

  if (isInitializing) return null;
  if (!user) return <Navigate to="/iniciar-sesion" state={{ from: location.pathname }} replace />;
  if (!ADMIN_ROLES.has(user.role)) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[210px_1fr]">
      <aside className="md:sticky md:top-6 md:self-start">
        <div className="border-b border-hairline pb-4">
          <p className="eyebrow">Panel de gestión</p>
          <p className="mt-1 font-display text-lg italic text-ink">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-ink-muted">{user.role === "SUPER_ADMIN" ? "Super admin" : "Gerente de cine"}</p>
        </div>

        <nav aria-label="Secciones del panel" className="mt-4 flex flex-col gap-5 overflow-x-auto md:overflow-visible">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.roles || item.roles.includes(user.role));
            if (items.length === 0) return null;
            return (
              <div key={group.title}>
                <p className="px-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  {group.title}
                </p>
                <div className="mt-1 flex flex-col">
                  {items.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 border-l-2 px-3 py-1.5 text-sm transition-colors",
                          isActive
                            ? "border-gold text-ink"
                            : "border-transparent text-ink-muted hover:border-hairline hover:text-ink",
                        )
                      }
                    >
                      <Icon className="size-4 shrink-0" /> {label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}

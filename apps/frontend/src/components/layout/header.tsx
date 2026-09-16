import { Link, NavLink } from "react-router-dom";
import { LogOut, Ticket, User as UserIcon } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/auth.store";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/", label: "Cartelera", end: true },
  { to: "/cines", label: "Cines" },
];

/**
 * Masthead editorial, no barra flotante translucida de SaaS: linea solida
 * con un hairline dorado fino en el borde inferior (evoca el borde de una
 * marquesina) en vez de backdrop-blur - ver memoria sobre composicion.
 */
export function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="relative border-b border-hairline bg-base">
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--lumiere-accent-gold) 50%, transparent)" }}
      />
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  "group relative py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted transition-colors hover:text-ink",
                  isActive && "text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {link.label}
                  <span
                    className={cn(
                      "absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-gold transition-transform duration-300 group-hover:scale-x-100",
                      isActive && "scale-x-100",
                    )}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {user ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex size-9 items-center justify-center border border-hairline text-ink transition-colors hover:border-gold hover:text-gold">
                  <UserIcon className="size-4" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={10}
                  className="z-50 min-w-56 border border-hairline bg-elevated p-1.5 shadow-xl"
                >
                  <div className="px-2.5 py-2 text-sm">
                    <p className="font-medium text-ink">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="truncate text-xs text-ink-muted">{user.email}</p>
                  </div>
                  <DropdownMenu.Separator className="my-1 h-px bg-hairline" />
                  <DropdownMenu.Item asChild>
                    <Link
                      to="/mis-ordenes"
                      className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm text-ink outline-none hover:bg-surface"
                    >
                      <Ticket className="size-4" /> Mis boletos
                    </Link>
                  </DropdownMenu.Item>
                  {(user.role === "SUPER_ADMIN" || user.role === "CINEMA_MANAGER") && (
                    <DropdownMenu.Item asChild>
                      <Link
                        to="/admin"
                        className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm text-ink outline-none hover:bg-surface"
                      >
                        Panel de gestión
                      </Link>
                    </DropdownMenu.Item>
                  )}
                  {user.role === "BOX_OFFICE" && (
                    <DropdownMenu.Item asChild>
                      <Link
                        to="/taquilla"
                        className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm text-ink outline-none hover:bg-surface"
                      >
                        Taquilla
                      </Link>
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Separator className="my-1 h-px bg-hairline" />
                  <DropdownMenu.Item
                    onSelect={() => void logout()}
                    className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm text-danger outline-none hover:bg-surface"
                  >
                    <LogOut className="size-4" /> Cerrar sesión
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/iniciar-sesion">Iniciar sesión</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/registro">Crear cuenta</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

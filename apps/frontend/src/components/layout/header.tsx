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
  { to: "/estrenos", label: "Próximamente" },
  { to: "/cines", label: "Cines" },
];

export function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-base/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    "text-sm font-medium text-ink-muted transition-colors hover:text-ink",
                    isActive && "text-gold",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex size-9 items-center justify-center rounded-full bg-surface text-ink transition-colors hover:bg-elevated">
                  <UserIcon className="size-4" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-56 rounded-md border border-hairline bg-elevated p-1.5 shadow-lg"
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
                      className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-sm text-ink outline-none hover:bg-surface"
                    >
                      <Ticket className="size-4" /> Mis boletos
                    </Link>
                  </DropdownMenu.Item>
                  {user.role !== "CUSTOMER" && (
                    <DropdownMenu.Item asChild>
                      <Link
                        to="/admin"
                        className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-sm text-ink outline-none hover:bg-surface"
                      >
                        Panel de gestión
                      </Link>
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Separator className="my-1 h-px bg-hairline" />
                  <DropdownMenu.Item
                    onSelect={() => void logout()}
                    className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-sm text-danger outline-none hover:bg-surface"
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

import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-base text-ink">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1000] focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-black"
      >
        Saltar al contenido
      </a>
      <Header />
      <main id="contenido" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "var(--lumiere-bg-elevated)",
            color: "var(--lumiere-text-primary)",
            border: "1px solid var(--lumiere-border)",
          },
        }}
      />
    </div>
  );
}

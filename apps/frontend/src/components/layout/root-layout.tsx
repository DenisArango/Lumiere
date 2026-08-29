import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-base text-ink">
      <Header />
      <main className="flex-1">
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

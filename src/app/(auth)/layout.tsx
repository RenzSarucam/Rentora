import { Wordmark } from "@/components/app/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-5">
        <Wordmark />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-[400px] rounded-2xl border border-border bg-background p-6 sm:p-8">{children}</div>
      </main>
      <footer className="pb-6 text-center text-xs text-muted-foreground">Rentora · Boarding house management for the Philippines</footer>
    </div>
  );
}

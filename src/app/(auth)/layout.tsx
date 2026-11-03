import { Wordmark } from "@/components/app/brand";
import { BoardingHouseIllustration } from "@/features/auth/boarding-house-illustration";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-ground px-4 sm:px-8">
      <header className="mx-auto flex h-16 w-full max-w-[1120px] shrink-0 items-center justify-between gap-4">
        <Wordmark className="text-lg [&_svg]:size-7" />
        <p className="hidden text-xs text-muted-foreground sm:block">Boarding house management, made simple.</p>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-[1120px] flex-1 items-center py-4">
        <div className="grid w-full overflow-hidden rounded-2xl border border-border bg-background lg:grid-cols-[1.08fr_1fr]">
          <section aria-labelledby="auth-intro" className="hidden min-w-0 flex-col justify-between border-r border-border bg-ground/60 p-8 lg:flex xl:px-10">
            <div>
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">A place for everything</p>
              <h2 id="auth-intro" className="mt-3 text-[38px] leading-[1.15] font-medium tracking-[-0.035em]">
                Less to manage.<br />More room to live.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                From monthly rent to everyday requests, keep your boarding house in good order.
              </p>
            </div>
            <BoardingHouseIllustration />
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <span>Rooms &amp; beds</span>
              <span>Rent &amp; payments</span>
              <span>Everyday updates</span>
            </div>
          </section>
          <div className="flex min-w-0 items-center px-6 py-8 sm:px-10 lg:px-12">
            <div className="mx-auto w-full max-w-[360px]">{children}</div>
          </div>
        </div>
      </main>
      <footer className="mx-auto w-full max-w-[1120px] shrink-0 pt-3 pb-5 text-center text-xs text-muted-foreground sm:text-left">
        Made for boarding houses in the Philippines.
      </footer>
    </div>
  );
}

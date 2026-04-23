import { env } from "@/lib/env"
import { HomeClient } from "@/components/HomeClient"
import { Header } from "@/components/Header"

export const dynamic = "force-dynamic"

export default function Home() {
  let maxUploadMb = 2048
  try {
    maxUploadMb = env().MAX_UPLOAD_MB
  } catch {}
  return (
    <>
      <Header />
      <main className="flex-1 py-10 sm:py-16">
        <div className="mx-auto w-full max-w-2xl px-6">
          <HomeClient maxUploadMb={maxUploadMb} />
        </div>
      </main>
      <footer className="border-t border-border/60 py-6">
        <div className="mx-auto max-w-3xl px-6 text-center text-xs text-muted-foreground">
          AssemblyAI → OpenAI · транскрипция и главы автоматически
        </div>
      </footer>
    </>
  )
}

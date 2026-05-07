import { Header } from '@/components/layout/Header'
import { NavTabs } from '@/components/layout/NavTabs'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <NavTabs />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}

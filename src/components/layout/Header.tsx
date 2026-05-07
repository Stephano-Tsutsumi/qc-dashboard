import Link from 'next/link'
import { UserMenu } from './UserMenu'

export function Header() {
  return (
    <header className="border-b border-border bg-surface shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/dashboard" className="font-semibold text-text">
          AVA QC Dashboard
        </Link>
        <UserMenu />
      </div>
    </header>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/dashboard', label: 'Review Queue' },
  { href: '/dashboard/tracker', label: 'Ticket Tracker' },
  { href: '/dashboard/import', label: 'Import CSV' },
] as const

export function NavTabs() {
  const pathname = usePathname()
  return (
    <nav className="border-b border-border bg-surface-2 px-4">
      <div className="mx-auto flex max-w-6xl gap-1">
        {tabs.map(({ href, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                active
                  ? 'border-accent text-text'
                  : 'border-transparent text-text-secondary hover:text-text'
              )}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

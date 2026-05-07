import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  const { id } = context.params
  const supabase = createClient(cookies())
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('weekly_snapshots').delete().eq('id', id)

  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}

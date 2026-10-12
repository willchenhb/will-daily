'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import WeeklyPlan from '@/components/WeeklyPlan'
import Loading from '@/components/Loading'
import { getWeekStart, getWeekEnd, getWeekNumber, getNextWeekStart, isFridayOrLater } from '@/lib/dates'

interface Plan {
  id: number
  weekStart: string
  title: string | null
  content: string | null
  todos: { id: number; text: string; completed: boolean; note: string | null; order: number }[]
}

function weekLabel(weekStart: string): string {
  const weekNum = getWeekNumber(weekStart)
  const end = getWeekEnd(weekStart)
  const s = weekStart.slice(5).replace('-', '/')
  const e = end.slice(5).replace('-', '/')
  return `第${weekNum}周 · ${s} - ${e}`
}

export default function WeeklyPage() {
  return (
    <Suspense>
      <WeeklyList />
    </Suspense>
  )
}

function WeeklyList() {
  // ?week=YYYY-MM-DD (from search) shows just that week
  const weekFilter = useSearchParams().get('week')
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const currentWeekStart = getWeekStart()
  const nextWeekStart = getNextWeekStart()
  const showNextWeek = isFridayOrLater()
  const currentExists = plans.some(p => p.weekStart === currentWeekStart)
  const nextExists = plans.some(p => p.weekStart === nextWeekStart)

  const fetchPlans = useCallback(async () => {
    const res = await fetch(weekFilter ? `/api/weekly?weekStart=${weekFilter}` : '/api/weekly')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setPlans(data.plans)
    setLoading(false)
  }, [weekFilter])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  // Called by autosave: no refetch, which would remount the plan being edited
  const handleSave = async (data: { id?: number; weekStart: string; content?: string }): Promise<number> => {
    const res = data.id
      ? await fetch(`/api/weekly/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: data.content }),
        })
      : await fetch('/api/weekly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weekStart: data.weekStart, content: data.content }),
        })
    if (!res.ok) throw new Error('保存失败')
    const plan = await res.json()
    return plan.id
  }

  if (loading) return <div className="max-w-3xl mx-auto px-8 py-6"><Loading /></div>

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">

      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-800">周记</h1>
        {weekFilter && (
          <Link href="/weekly" className="text-[12px] text-gray-400 hover:text-gray-600">← 全部周记</Link>
        )}
      </div>

      {/* Next week placeholder (shown from Friday onwards) */}
      {!weekFilter && showNextWeek && !nextExists && (
        <>
          <WeeklyPlan
            weekStart={nextWeekStart}
            weekLabel={weekLabel(nextWeekStart)}
            content=""
            todos={[]}
            isCurrent={false}
            isNext
            onSave={handleSave}
            onRefresh={fetchPlans}
          />
          <div className="border-t border-gray-100 mb-6" />
        </>
      )}

      {/* Current week placeholder */}
      {!weekFilter && !currentExists && (
        <>
          <WeeklyPlan
            weekStart={currentWeekStart}
            weekLabel={weekLabel(currentWeekStart)}
            content=""
            todos={[]}
            isCurrent
            onSave={handleSave}
            onRefresh={fetchPlans}
          />
          <div className="border-t border-gray-100 mb-6" />
        </>
      )}

      {plans.map(plan => (
        <div key={plan.id}>
          <WeeklyPlan
            id={plan.id}
            weekStart={plan.weekStart}
            weekLabel={weekLabel(plan.weekStart)}
            content={plan.content || ''}
            todos={plan.todos}
            isCurrent={plan.weekStart === currentWeekStart}
            isNext={plan.weekStart === nextWeekStart}
            onSave={handleSave}
            onRefresh={fetchPlans}
          />
          <div className="border-t border-gray-100 mb-6" />
        </div>
      ))}
    </div>
  )
}

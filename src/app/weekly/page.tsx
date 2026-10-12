'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import WeeklyPlan, { type SavedPlan } from '@/components/WeeklyPlan'
import { saveDoc, type SaveFlags } from '@/lib/save-doc'
import Loading from '@/components/Loading'
import { getWeekStart, getWeekEnd, getWeekNumber, getNextWeekStart, isFridayOrLater } from '@/lib/dates'

interface Plan {
  id: number
  weekStart: string
  title: string | null
  content: string | null
  updatedAt: string
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

const PAGE_SIZE = 10
const API_MAX_SIZE = 100

function WeeklyList() {
  // ?week=YYYY-MM-DD (from search) shows just that week
  const weekFilter = useSearchParams().get('week')
  const [plans, setPlans] = useState<Plan[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(PAGE_SIZE) // weeks loaded so far ("加载更多" adds a page)
  const [loading, setLoading] = useState(true)
  const currentWeekStart = getWeekStart()
  const nextWeekStart = getNextWeekStart()
  const showNextWeek = isFridayOrLater()
  const currentExists = plans.some(p => p.weekStart === currentWeekStart)
  const nextExists = plans.some(p => p.weekStart === nextWeekStart)

  // Reloads everything shown so far, so refreshes keep older pages
  const fetchPlans = useCallback(async () => {
    if (weekFilter) {
      const res = await fetch(`/api/weekly?weekStart=${weekFilter}`)
      if (res.ok) setPlans((await res.json()).plans)
    } else {
      const loaded: Plan[] = []
      let count = 0
      for (let page = 1; page <= Math.ceil(limit / API_MAX_SIZE); page++) {
        const res = await fetch(`/api/weekly?page=${page}&size=${API_MAX_SIZE}`)
        if (!res.ok) break
        const data = await res.json()
        loaded.push(...data.plans)
        count = data.total
        if (data.plans.length < API_MAX_SIZE) break
      }
      setPlans(loaded.slice(0, limit))
      setTotal(count)
    }
    setLoading(false)
  }, [weekFilter, limit])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  // Called by autosave: no refetch, which would remount the plan being edited
  const handleSave = ({ id, weekStart, ...rest }: { id?: number; weekStart: string; content?: string } & SaveFlags): Promise<SavedPlan> =>
    id
      ? saveDoc<SavedPlan>(`/api/weekly/${id}`, rest)
      : saveDoc<SavedPlan>('/api/weekly', { weekStart, content: rest.content }, 'POST')

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
            updatedAt={plan.updatedAt}
            todos={plan.todos}
            isCurrent={plan.weekStart === currentWeekStart}
            isNext={plan.weekStart === nextWeekStart}
            onSave={handleSave}
            onRefresh={fetchPlans}
          />
          <div className="border-t border-gray-100 mb-6" />
        </div>
      ))}

      {!weekFilter && plans.length < total && (
        <div className="text-center">
          <button
            onClick={() => setLimit(l => l + PAGE_SIZE)}
            className="text-[12px] text-gray-500 border border-gray-200 rounded px-4 py-1.5 hover:bg-gray-50"
          >
            加载更多（还有 {total - plans.length} 周）
          </button>
        </div>
      )}
    </div>
  )
}

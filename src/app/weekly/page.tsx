'use client'

import { useState, useEffect, useCallback } from 'react'
import WeeklyPlan from '@/components/WeeklyPlan'
import Toast from '@/components/Toast'
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
  const [plans, setPlans] = useState<Plan[]>([])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const currentWeekStart = getWeekStart()
  const nextWeekStart = getNextWeekStart()
  const showNextWeek = isFridayOrLater()
  const currentExists = plans.some(p => p.weekStart === currentWeekStart)
  const nextExists = plans.some(p => p.weekStart === nextWeekStart)

  const fetchPlans = useCallback(async () => {
    const res = await fetch('/api/weekly')
    const data = await res.json()
    setPlans(data.plans)
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  const handleSave = async (data: { id?: number; weekStart: string; content?: string }): Promise<number | undefined> => {
    try {
      if (data.id) {
        const res = await fetch(`/api/weekly/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: data.content }),
        })
        const plan = await res.json()
        setToast({ message: '已保存', type: 'success' })
        fetchPlans()
        return plan.id
      } else {
        const res = await fetch('/api/weekly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weekStart: data.weekStart, content: data.content }),
        })
        const plan = await res.json()
        setToast({ message: '已创建', type: 'success' })
        fetchPlans()
        return plan.id
      }
    } catch {
      setToast({ message: '保存失败', type: 'error' })
      return undefined
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Next week placeholder (shown from Friday onwards) */}
      {showNextWeek && !nextExists && (
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
      {!currentExists && (
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

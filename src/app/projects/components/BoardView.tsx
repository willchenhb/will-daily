'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  PRIORITY_OPTIONS,
  computeHealth, healthDot, formatDate,
  type Project,
} from '../constants'

const STATUS_COLUMNS: { value: Project['status']; label: string }[] = [
  { value: 'planning', label: '规划中' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'paused', label: '已暂停' },
]

function priorityTag(p: Project['priority']) {
  const opt = PRIORITY_OPTIONS.find(o => o.value === p)
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-500',
    medium: 'bg-blue-50 text-blue-600',
    high: 'bg-amber-50 text-amber-600',
    critical: 'bg-red-50 text-red-600',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[p] ?? ''}`}>
      {opt?.label ?? p}
    </span>
  )
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const health = computeHealth(project)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: project.id.toString() })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={e => { if (!isDragging) onClick() }}
      className="bg-white rounded-lg border border-gray-100 p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow touch-none"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[13px] font-medium text-gray-700 leading-tight">{project.name}</span>
        {healthDot(health)}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-gray-400">{project.owner}</span>
        {priorityTag(project.priority)}
        {project.targetEndDate && (
          <span className="text-[11px] text-gray-400">{formatDate(project.targetEndDate)}</span>
        )}
      </div>
    </div>
  )
}

function CardOverlay({ project }: { project: Project }) {
  const health = computeHealth(project)
  return (
    <div className="bg-white rounded-lg border border-[#3a7a4f] shadow-lg p-3 w-[260px] cursor-grabbing">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[13px] font-medium text-gray-700 leading-tight">{project.name}</span>
        {healthDot(health)}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-gray-400">{project.owner}</span>
        {priorityTag(project.priority)}
      </div>
    </div>
  )
}

interface BoardViewProps {
  projects: Project[]
  onSelectProject: (project: Project) => void
  onStatusChange: (projectId: number, newStatus: Project['status']) => void
}

export default function BoardView({ projects, onSelectProject, onStatusChange }: BoardViewProps) {
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const proj = projects.find(p => p.id.toString() === event.active.id.toString())
    setActiveProject(proj ?? null)
  }

  const handleDragOver = (event: DragEndEvent) => {
    const { over } = event
    if (!over) { setOverColumn(null); return }
    const overId = over.id.toString()
    // Check if over a column directly
    const col = STATUS_COLUMNS.find(c => c.value === overId)
    setOverColumn(col ? col.value : null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveProject(null)
    setOverColumn(null)
    const { active, over } = event
    if (!over) return

    const projectId = parseInt(active.id.toString())
    const overId = over.id.toString()

    // Check if dropped on a column
    const targetStatus = STATUS_COLUMNS.find(c => c.value === overId)?.value
    if (targetStatus) {
      const proj = projects.find(p => p.id === projectId)
      if (proj && proj.status !== targetStatus) {
        onStatusChange(projectId, targetStatus)
      }
      return
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map(col => {
          const colProjects = projects.filter(p => p.status === col.value)
          return (
            <Column
              key={col.value}
              status={col.value}
              label={col.label}
              projects={colProjects}
              onSelectProject={onSelectProject}
              isOver={overColumn === col.value}
            />
          )
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeProject ? <CardOverlay project={activeProject} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function Column({
  status,
  label,
  projects,
  onSelectProject,
  isOver,
}: {
  status: string
  label: string
  projects: Project[]
  onSelectProject: (project: Project) => void
  isOver: boolean
}) {
  const { setNodeRef, isOver: droppableIsOver } = useDroppable({ id: status })
  const highlighted = isOver || droppableIsOver

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-3 min-h-[200px] transition-colors ${highlighted ? 'bg-[#e8f5e9] border-2 border-dashed border-[#3a7a4f]' : 'bg-gray-50'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-medium text-gray-600">{label}</h3>
        <span className="text-[11px] text-gray-400 bg-white px-2 py-0.5 rounded-full">{projects.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {projects.map(p => (
          <ProjectCard
            key={p.id}
            project={p}
            onClick={() => onSelectProject(p)}
          />
        ))}
        {projects.length === 0 && (
          <div className="text-center text-[12px] text-gray-300 py-8">
            {highlighted ? '放置到此列' : '无项目'}
          </div>
        )}
      </div>
    </div>
  )
}

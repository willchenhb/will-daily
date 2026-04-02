// ─── OKR Options (顶层 + 中层) ────────────────────────────────────────────────
export const OKR_OPTIONS = [
  { group: '陈海彪（中心负责人）', items: [
    { id: 'CHB-O1', text: '围绕金山生态体系构筑领域根据地，法律审查产品力达到行业领先' },
    { id: 'CHB-O2', text: '以原子产品为核心竞争力，走通公私双域商业化模式' },
    { id: 'CHB-O3', text: '构建以"MiMo模型 + 上下文工程"为双核的大模型生态基座' },
    { id: 'CHB-O4', text: '构建"AI Native"的独立作战组织，打破产研边界' },
  ]},
  { group: '王亚洲（产品部）', items: [
    { id: 'WYZ-O1', text: '依托WPS与生态体系，打造法律审查产品商业化标杆' },
    { id: 'WYZ-O2', text: '核心产品力与系统稳定性全面超越头部竞品' },
    { id: 'WYZ-O3', text: '联合顶尖法律实验室完成前沿业务共创' },
  ]},
  { group: '袁小龙（商业化部）', items: [
    { id: 'YXL-O1', text: '打造WPS"合同审查"标杆产品，验证商业模式' },
    { id: 'YXL-O2', text: '实现"公平竞争审查"产品商业化破局' },
    { id: 'YXL-O3', text: '成功打造"法律调解"行业标杆产品' },
  ]},
  { group: '张帅（瀚海平台部）', items: [
    { id: 'ZS-O1', text: '【上云】走通原子产品带动公有云Token模式' },
    { id: 'ZS-O2', text: '【内部赋能】通过瀚海平台支撑集团与子公司使用' },
    { id: 'ZS-O3', text: '【服务闭环】建立运维体系化管理标准和能力' },
    { id: 'ZS-O4', text: '【私有云】走通核心原子产品私有化轻交付落地模式' },
    { id: 'ZS-O5', text: '【内部创新】人人都有创新，孵化探索方向' },
  ]},
  { group: '周一新（模型技术部）', items: [
    { id: 'ZYX-O1', text: '构建以MiMo为核心的1+N模型底座能力' },
    { id: 'ZYX-O2', text: '推动通用Deep Research从研发走向规模化落地' },
    { id: 'ZYX-O3', text: '结合先进个人助理Agent框架，探索易用"AI个人助理"' },
    { id: 'ZYX-O4', text: '打造"轻舟智汇"AI Native标杆，实现部门效能跃迁' },
  ]},
  { group: '陈斌（应用技术部）', items: [
    { id: 'CB-O1', text: '完成上下文工程中枢搭建，沉淀"最强知识管线"' },
    { id: 'CB-O2', text: '打造AI原生研发模式，实现研发效能倍数级突破' },
    { id: 'CB-O3', text: '构建敏捷研发协同矩阵，保障高质交付与人才储备' },
  ]},
  { group: '陈凯（创新技术部）', items: [
    { id: 'CK-O1', text: '游戏AI：树立标杆，知识库+AI运营生产提效' },
    { id: 'CK-O2', text: '构建AI团队技术影响力' },
  ]},
  { group: '张坤（业务管理部）', items: [
    { id: 'ZK-O1', text: '深度配合COE，保障HR核心项目高效落地' },
    { id: 'ZK-O2', text: '聚焦业务AI提效项目需求，提供精准人才支撑' },
    { id: 'ZK-O3', text: '以PE和业务管理深度参与项目，助力业务管理效能' },
  ]},
]

export const OKR_MEMBERS = ['陈海彪', '王亚洲', '袁小龙', '张帅', '周一新', '陈斌', '陈凯', '袁伟', '张坤']

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: number
  name: string
}

export interface Milestone {
  id: number
  title: string
  dueDate: string | null
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed'
}

export interface Risk {
  id: number
  description: string
  probability: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
}

export interface Project {
  id: number
  name: string
  code: string | null
  description: string | null
  category: string
  owner: string
  status: 'planning' | 'in_progress' | 'paused' | 'completed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  startDate: string | null
  targetEndDate: string | null
  okrObjectiveId: string | null
  milestones?: Milestone[]
  risks?: Risk[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const CATEGORIES = ['产品交付', '商业化', '平台建设', '技术攻关', '组织管理']

export const STATUS_OPTIONS = [
  { value: 'planning', label: '规划中' },
  { value: 'in_progress', label: '进行中' },
  { value: 'paused', label: '已暂停' },
  { value: 'completed', label: '已完成' },
]

export const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
]

export const MILESTONE_STATUS_OPTIONS = [
  { value: 'not_started', label: '未开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'delayed', label: '已延误' },
]

export const RISK_LEVEL_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
]

export const CSV_COLUMN_MAP: Record<string, string> = {
  '项目名称': 'name', '名称': 'name', 'name': 'name',
  '类别': 'category', '分类': 'category', 'category': 'category',
  '负责人': 'owner', 'owner': 'owner',
  '状态': 'status', 'status': 'status',
  '优先级': 'priority', 'priority': 'priority',
  '开始日期': 'startDate', '开始时间': 'startDate',
  '截止日期': 'targetEndDate', '结束日期': 'targetEndDate', '截止时间': 'targetEndDate',
  'OKR': 'okrObjectiveId', 'okr': 'okrObjectiveId',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function statusLabel(status: Project['status']): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.label ?? status
}

export function riskColor(level: 'low' | 'medium' | 'high'): string {
  if (level === 'low') return 'bg-green-50 text-green-700'
  if (level === 'medium') return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}

export function riskLabel(level: 'low' | 'medium' | 'high'): string {
  if (level === 'low') return '低'
  if (level === 'medium') return '中'
  return '高'
}

export function computeHealth(project: Project): 'green' | 'yellow' | 'red' {
  const risks = project.risks ?? []
  const milestones = project.milestones ?? []
  const hasHighRisk = risks.some(r => r.probability === 'high' && r.impact === 'high')
  const delayedCount = milestones.filter(m => m.status === 'delayed').length
  if (hasHighRisk || delayedCount >= 2) return 'red'
  if (delayedCount >= 1 || risks.some(r => r.probability === 'high' || r.impact === 'high')) return 'yellow'
  return 'green'
}

export function healthDot(h: 'green' | 'yellow' | 'red') {
  const cls = h === 'green' ? 'bg-green-500' : h === 'yellow' ? 'bg-amber-400' : 'bg-red-500'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />
}

export function progressPercent(project: Project): number {
  const ms = project.milestones ?? []
  if (ms.length === 0) return 0
  return Math.round((ms.filter(m => m.status === 'completed').length / ms.length) * 100)
}

export function milestoneStatusDot(status: Milestone['status']) {
  if (status === 'completed') return <span className="w-3 h-3 rounded-full bg-[#3a7a4f] flex-shrink-0 inline-block" />
  if (status === 'in_progress') return <span className="w-3 h-3 rounded-full border-2 border-[#3a7a4f] flex-shrink-0 inline-block" />
  if (status === 'delayed') return <span className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0 inline-block" />
  return <span className="w-3 h-3 rounded-full border-2 border-gray-300 flex-shrink-0 inline-block" />
}

export function formatDate(d: string | null): string {
  if (!d) return '-'
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

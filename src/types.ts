export type JobStatus = string
export type Priority = '高' | '中' | '低'

export interface FlowTemplate {
  id: string
  name: string
  statuses: string[]
}

export interface JobPosition {
  id: string
  company: string
  title: string
  direction: string
  city: string
  employmentType: string
  source: string
  status: JobStatus
  priority: Priority
  jobUrl: string
  processUrl: string
  appliedAt?: string
  deadlineAt?: string
  nextAction: string
  nextActionDeadline?: string
  jdContent: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  flowId?: string
}

export interface ProcessEvent {
  id: string
  jobId: string
  fromStatus?: JobStatus
  toStatus: JobStatus
  note: string
  eventTime: string
}

export interface Task {
  id: string
  title: string
  jobId?: string
  dueAt: string
  completedAt?: string
  priority: Priority
  note: string
  createdAt: string
  updatedAt: string
}

export interface CalendarEvent {
  id: string
  title: string
  type: string
  jobId?: string
  startAt: string
  endAt?: string
  reminderMinutes?: number
  location: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  content: string
  jobId?: string
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export const STATUSES: JobStatus[] = ['了解中', '待投递', '已投递', '笔试', '一面', '二面', 'HR面', 'Offer', '已拒绝', '已结束']

export const DEFAULT_FLOW_TEMPLATES: FlowTemplate[] = [
  { id: 'flow-general', name: '通用流程', statuses: [...STATUSES] },
  { id: 'flow-engineering', name: '研发流程', statuses: ['了解中', '待投递', '已投递', '笔试', '技术一面', '技术二面', 'HR面', 'Offer', '已拒绝', '已结束'] },
  { id: 'flow-product', name: '产品流程', statuses: ['了解中', '待投递', '已投递', '业务面', '终面', 'HR面', 'Offer', '已拒绝', '已结束'] },
]

export const STATUS_META: Record<JobStatus, { tone: string; short: string }> = {
  了解中: { tone: 'slate', short: '了解' },
  待投递: { tone: 'amber', short: '待投' },
  已投递: { tone: 'blue', short: '已投' },
  笔试: { tone: 'violet', short: '笔试' },
  一面: { tone: 'coral', short: '一面' },
  二面: { tone: 'orange', short: '二面' },
  HR面: { tone: 'pink', short: 'HR' },
  Offer: { tone: 'green', short: 'Offer' },
  已拒绝: { tone: 'red', short: '拒绝' },
  已结束: { tone: 'dark', short: '结束' },
}

export function getStatusMeta(status: string) {
  return STATUS_META[status] ?? { tone: 'slate', short: status.slice(0, 4) }
}

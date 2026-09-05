export type JobStatus = '了解中' | '待投递' | '已投递' | '笔试' | '一面' | '二面' | 'HR面' | 'Offer' | '已拒绝' | '已结束'
export type Priority = '高' | '中' | '低'

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
}

export interface ProcessEvent {
  id: string
  jobId: string
  fromStatus?: JobStatus
  toStatus: JobStatus
  note: string
  eventTime: string
}

export const STATUSES: JobStatus[] = ['了解中', '待投递', '已投递', '笔试', '一面', '二面', 'HR面', 'Offer', '已拒绝', '已结束']

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

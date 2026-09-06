import { DEFAULT_FLOW_TEMPLATES, type CalendarEvent, type FlowTemplate, type JobPosition, type Note, type ProcessEvent, type Task } from './types'
import { invoke } from '@tauri-apps/api/core'

const JOBS_KEY = 'worremember.jobs.v1'
const EVENTS_KEY = 'worremember.process-events.v1'
const FLOWS_KEY = 'worremember.flow-templates.v1'
const TASKS_KEY = 'worremember.tasks.v1'
const CALENDAR_KEY = 'worremember.calendar-events.v1'
const NOTES_KEY = 'worremember.notes.v1'
const today = new Date().toISOString().slice(0, 10)

function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function mapDesktopJob(record: Record<string, unknown>): JobPosition {
  return {
    id: String(record.id || ''), company: String(record.company || ''), title: String(record.title || ''),
    direction: String(record.direction || ''), city: String(record.city || ''),
    employmentType: String(record.employment_type ?? record.employmentType ?? ''), source: String(record.source || ''),
    status: String(record.status || '了解中'), priority: record.priority as JobPosition['priority'] || '中',
    jobUrl: String(record.job_url ?? record.jobUrl ?? ''), processUrl: String(record.process_url ?? record.processUrl ?? ''),
    appliedAt: String(record.applied_at ?? record.appliedAt ?? '') || undefined,
    deadlineAt: String(record.deadline_at ?? record.deadlineAt ?? '') || undefined,
    nextAction: String(record.next_action ?? record.nextAction ?? ''),
    nextActionDeadline: String(record.next_action_deadline ?? record.nextActionDeadline ?? '') || undefined,
    jdContent: String(record.jd_content ?? record.jdContent ?? ''), createdAt: String(record.created_at ?? record.createdAt ?? today),
    updatedAt: String(record.updated_at ?? record.updatedAt ?? today), deletedAt: String(record.deleted_at ?? record.deletedAt ?? '') || undefined,
    flowId: String(record.flow_id ?? record.flowId ?? 'flow-general'), tags: Array.isArray(record.tags) ? record.tags as string[] : [],
  }
}

const seedJobs: JobPosition[] = [
  {
    id: 'seed-1', company: '远景智能', title: '产品经理（校招）', direction: '产品', city: '上海',
    employmentType: '校招', source: '官网', status: '已投递', priority: '高',
    jobUrl: 'https://example.com/job/1', processUrl: '', appliedAt: '2026-09-02',
    deadlineAt: '2026-09-10', nextAction: '准备笔试', nextActionDeadline: '2026-09-08',
    jdContent: '负责智能制造产品的规划与落地。', createdAt: '2026-09-01', updatedAt: '2026-09-05',
  },
  {
    id: 'seed-2', company: '北辰科技', title: '前端开发工程师', direction: '开发', city: '北京',
    employmentType: '全职', source: '内推', status: '笔试', priority: '高',
    jobUrl: 'https://example.com/job/2', processUrl: 'https://example.com/process/2', appliedAt: '2026-08-27',
    nextAction: '完成笔试复盘', nextActionDeadline: '2026-09-06', jdContent: '', createdAt: '2026-08-25', updatedAt: '2026-09-04',
  },
  {
    id: 'seed-3', company: '青禾工作室', title: '用户研究实习生', direction: '研究', city: '杭州',
    employmentType: '实习', source: '招聘平台', status: '待投递', priority: '中',
    jobUrl: '', processUrl: '', deadlineAt: '2026-09-12', nextAction: '补充项目经历',
    jdContent: '参与用户访谈、问卷设计与体验分析。', createdAt: '2026-09-03', updatedAt: '2026-09-03',
  },
  {
    id: 'seed-4', company: '星河数据', title: '数据分析师', direction: '数据', city: '深圳',
    employmentType: '校招', source: '官网', status: '已投递', priority: '中',
    jobUrl: 'https://example.com/job/4', processUrl: '', appliedAt: '2026-09-04',
    nextAction: '关注笔试通知', jdContent: '', createdAt: '2026-09-04', updatedAt: '2026-09-05',
  },
  {
    id: 'seed-5', company: '蓝岸科技', title: '后端开发工程师', direction: '开发', city: '上海',
    employmentType: '全职', source: '内推', status: '已投递', priority: '高',
    jobUrl: 'https://example.com/job/5', processUrl: '', appliedAt: '2026-09-05',
    nextAction: '准备技术面', jdContent: '', createdAt: '2026-09-05', updatedAt: '2026-09-05',
  },
]

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

export function loadJobs(): JobPosition[] {
  return read(JOBS_KEY, seedJobs)
}

export function loadDeletedJobs(): JobPosition[] {
  return read(`${JOBS_KEY}.trash`, [])
}

export function saveJobs(jobs: JobPosition[]) {
  if (isDesktopRuntime()) return
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs))
}

export function saveDeletedJobs(jobs: JobPosition[]) {
  if (isDesktopRuntime()) return
  localStorage.setItem(`${JOBS_KEY}.trash`, JSON.stringify(jobs))
}

export function loadProcessEvents(): ProcessEvent[] {
  return read(EVENTS_KEY, [])
}

export function saveProcessEvents(events: ProcessEvent[]) {
  if (isDesktopRuntime()) return
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
}

export function loadFlowTemplates(): FlowTemplate[] {
  return read(FLOWS_KEY, DEFAULT_FLOW_TEMPLATES)
}

export function saveFlowTemplates(flows: FlowTemplate[]) {
  if (isDesktopRuntime()) return
  localStorage.setItem(FLOWS_KEY, JSON.stringify(flows))
}

export function loadTasks(): Task[] { return read(TASKS_KEY, []) }
export function saveTasks(tasks: Task[]) { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)) }
export function loadCalendarEvents(): CalendarEvent[] { return read(CALENDAR_KEY, []) }
export function saveCalendarEvents(events: CalendarEvent[]) { localStorage.setItem(CALENDAR_KEY, JSON.stringify(events)) }
export function loadNotes(): Note[] { return read(NOTES_KEY, []) }
export function saveNotes(notes: Note[]) { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)) }

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function backupDesktopDatabase(): Promise<string | null> {
  try { return await invoke<string>('backup_database') } catch { return null }
}

export async function loadDesktopJobs(): Promise<JobPosition[] | null> {
  try {
    const jobs = await invoke<Record<string, unknown>[]>('list_jobs')
    return jobs.map(mapDesktopJob)
  } catch {
    return null
  }
}

export async function loadDesktopDeletedJobs(): Promise<JobPosition[] | null> {
  try {
    const jobs = await invoke<Record<string, unknown>[]>('list_deleted_jobs')
    return jobs.map(mapDesktopJob)
  } catch {
    return null
  }
}

export async function persistDesktopJob(job: JobPosition): Promise<void> {
  try {
    await invoke('upsert_job', {
      job: {
        id: job.id,
        company: job.company,
        title: job.title,
        direction: job.direction,
        city: job.city,
        employment_type: job.employmentType,
        source: job.source,
        status: job.status,
        priority: job.priority,
        job_url: job.jobUrl,
        process_url: job.processUrl,
        applied_at: job.appliedAt ?? null,
        deadline_at: job.deadlineAt ?? null,
        next_action: job.nextAction,
        next_action_deadline: job.nextActionDeadline ?? null,
        jd_content: job.jdContent,
        created_at: job.createdAt,
        updated_at: job.updatedAt,
        deleted_at: job.deletedAt ?? null,
        flow_id: job.flowId ?? 'flow-general',
      },
    })
  } catch {
    // Browser preview keeps using localStorage until the Tauri runtime is available.
  }
}

export async function deleteDesktopJob(jobId: string): Promise<void> {
  try { await invoke('delete_job', { jobId }) } catch { /* Browser preview uses localStorage. */ }
}

export async function restoreDesktopJob(jobId: string): Promise<void> {
  try { await invoke('restore_job', { jobId }) } catch { /* Browser preview uses localStorage. */ }
}

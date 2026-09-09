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

export { isDesktopRuntime }

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

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

export function loadJobs(): JobPosition[] {
  // 不再内置示例岗位：新装启动就是空看板，避免示例数据和真实记录混在一起。
  return read(JOBS_KEY, [])
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

// 桌面端没有 SQLite 之外的第二份流程历史，这里必须照常写入，否则阶段变更记录重启即丢。
export function saveProcessEvents(events: ProcessEvent[]) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
}

export function loadFlowTemplates(): FlowTemplate[] {
  return read(FLOWS_KEY, DEFAULT_FLOW_TEMPLATES)
}

// 流程模板同样只有这一份存储，桌面端跳过会导致自定义流程重启即丢失。
export function saveFlowTemplates(flows: FlowTemplate[]) {
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

export async function persistDesktopJob(job: JobPosition): Promise<boolean> {
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
        tags: job.tags ?? [],
      },
    })
    return true
  } catch (error) {
    // 写入失败必须留下痕迹，否则数据会静默丢失，用户只会看到"重启后回到旧状态"。
    console.error('[WORREMEMBER] 岗位写入 SQLite 失败', job.id, error)
    return false
  }
}

export async function persistDesktopJobs(jobs: JobPosition[]): Promise<number> {
  if (!isDesktopRuntime()) return 0
  const results = await Promise.all(jobs.map((job) => persistDesktopJob(job)))
  return results.filter(Boolean).length
}

export async function loadDesktopProcessEvents(): Promise<ProcessEvent[] | null> {
  try {
    const events = await invoke<Record<string, unknown>[]>('list_process_events')
    return events.map((record) => ({
      id: String(record.id || ''),
      jobId: String(record.job_id ?? record.jobId ?? ''),
      fromStatus: String(record.from_status ?? record.fromStatus ?? '') || undefined,
      toStatus: String(record.to_status ?? record.toStatus ?? ''),
      note: String(record.note || ''),
      eventTime: String(record.event_time ?? record.eventTime ?? today),
    }))
  } catch {
    return null
  }
}

export async function persistDesktopProcessEvent(event: ProcessEvent): Promise<boolean> {
  try {
    await invoke('upsert_process_event', {
      event: {
        id: event.id,
        job_id: event.jobId,
        from_status: event.fromStatus ?? null,
        to_status: event.toStatus,
        note: event.note,
        event_time: event.eventTime,
      },
    })
    return true
  } catch (error) {
    console.error('[WORREMEMBER] 流程历史写入 SQLite 失败', event.id, error)
    return false
  }
}

export async function deleteDesktopJob(jobId: string): Promise<boolean> {
  try {
    await invoke('delete_job', { jobId })
    return true
  } catch (error) {
    console.error('[WORREMEMBER] 岗位删除失败', jobId, error)
    return false
  }
}

export async function restoreDesktopJob(jobId: string): Promise<boolean> {
  try {
    await invoke('restore_job', { jobId })
    return true
  } catch (error) {
    console.error('[WORREMEMBER] 岗位恢复失败', jobId, error)
    return false
  }
}

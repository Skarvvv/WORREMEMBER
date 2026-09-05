import type { JobPosition, ProcessEvent } from './types'
import { invoke } from '@tauri-apps/api/core'

const JOBS_KEY = 'worremember.jobs.v1'
const EVENTS_KEY = 'worremember.process-events.v1'

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

export function saveJobs(jobs: JobPosition[]) {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs))
}

export function loadProcessEvents(): ProcessEvent[] {
  return read(EVENTS_KEY, [])
}

export function saveProcessEvents(events: ProcessEvent[]) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
}

export async function loadDesktopJobs(): Promise<JobPosition[] | null> {
  try {
    const jobs = await invoke<JobPosition[]>('list_jobs')
    return jobs
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
      },
    })
  } catch {
    // Browser preview keeps using localStorage until the Tauri runtime is available.
  }
}

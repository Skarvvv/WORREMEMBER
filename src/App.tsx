import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, Check, ChevronDown, CircleAlert, ClipboardList, ExternalLink, FileText, LayoutDashboard, Plus, Search, Settings2, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import type { DragEvent, FormEvent } from 'react'
import { loadDesktopJobs, loadJobs, loadProcessEvents, persistDesktopJob, saveJobs, saveProcessEvents } from './storage'
import { JobStatus, Priority, STATUSES, STATUS_META, type JobPosition, type ProcessEvent } from './types'

const today = new Date().toISOString().slice(0, 10)

function makeJob(form: HTMLFormElement): JobPosition {
  const data = new FormData(form)
  return {
    id: crypto.randomUUID(), company: String(data.get('company') || ''), title: String(data.get('title') || ''),
    direction: String(data.get('direction') || '其他'), city: String(data.get('city') || ''),
    employmentType: String(data.get('employmentType') || '校招'), source: String(data.get('source') || ''),
    status: '了解中', priority: data.get('priority') as Priority || '中', jobUrl: String(data.get('jobUrl') || ''),
    processUrl: String(data.get('processUrl') || ''), nextAction: String(data.get('nextAction') || ''),
    deadlineAt: String(data.get('deadlineAt') || '') || undefined, nextActionDeadline: String(data.get('nextActionDeadline') || '') || undefined,
    jdContent: '', createdAt: today, updatedAt: today,
  }
}

export function App() {
  const [jobs, setJobs] = useState<JobPosition[]>(loadJobs)
  const [events, setEvents] = useState<ProcessEvent[]>(loadProcessEvents)
  const [activeNav, setActiveNav] = useState('看板')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadDesktopJobs().then((desktopJobs) => {
      if (!cancelled && desktopJobs && desktopJobs.length) {
        setJobs(desktopJobs)
        saveJobs(desktopJobs)
      }
    })
    return () => { cancelled = true }
  }, [])

  const selectedJob = jobs.find((job) => job.id === selectedId) ?? null
  const filteredJobs = useMemo(() => jobs.filter((job) => [job.company, job.title, job.direction, job.city, job.nextAction].join(' ').toLowerCase().includes(query.toLowerCase())), [jobs, query])
  const urgentJobs = jobs.filter((job) => job.nextActionDeadline && job.nextActionDeadline <= today && job.status !== '已结束' && job.status !== '已拒绝')
  const activeJobs = jobs.filter((job) => !['已结束', '已拒绝'].includes(job.status))

  function updateJobs(next: JobPosition[]) {
    setJobs(next)
    saveJobs(next)
    const changedJob = next.find((job) => job.updatedAt === today)
    if (changedJob) void persistDesktopJob(changedJob)
  }

  function updateStatus(jobId: string, status: JobStatus) {
    const current = jobs.find((job) => job.id === jobId)
    if (!current || current.status === status) return
    const nextJobs = jobs.map((job) => job.id === jobId ? { ...job, status, updatedAt: today, appliedAt: status === '已投递' && !job.appliedAt ? today : job.appliedAt } : job)
    const nextEvents = [...events, { id: crypto.randomUUID(), jobId, fromStatus: current.status, toStatus: status, note: '', eventTime: today }]
    updateJobs(nextJobs)
    setEvents(nextEvents)
    saveProcessEvents(nextEvents)
  }

  function handleDrop(status: JobStatus) {
    if (draggedId) updateStatus(draggedId, status)
    setDraggedId(null)
  }

  function submitNewJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const job = makeJob(event.currentTarget)
    updateJobs([job, ...jobs])
    setShowAdd(false)
    setSelectedId(job.id)
  }

  function updateSelected(patch: Partial<JobPosition>) {
    if (!selectedJob) return
    updateJobs(jobs.map((job) => job.id === selectedJob.id ? { ...job, ...patch, updatedAt: today } : job))
  }

  const navItems = [
    { label: '总览', icon: LayoutDashboard }, { label: '看板', icon: BriefcaseBusiness },
    { label: '日程', icon: CalendarDays }, { label: '备忘录', icon: FileText },
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">W</div><div><strong>WORREMEMBER</strong><span>秋招作战台</span></div></div>
        <div className="workspace-label">我的工作台</div>
        <nav>{navItems.map(({ label, icon: Icon }) => <button key={label} className={activeNav === label ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav(label)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === '看板' && <span className="nav-count">{activeJobs.length}</span>}</button>)}</nav>
        <div className="sidebar-divider" />
        <button className="nav-item muted" onClick={() => setActiveNav('设置')}><Settings2 size={18} strokeWidth={1.8} /><span>设置</span></button>
        <div className="sidebar-footer"><div className="sync-dot" /><span>本地数据已保存</span></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div><div className="breadcrumb">秋招作战台 <span>/</span> {activeNav}</div><h1>{activeNav === '看板' ? '投递看板' : activeNav}</h1></div><div className="top-actions"><div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司、岗位或行动" /><kbd>⌘ K</kbd></div><button className="icon-button" title="筛选"><SlidersHorizontal size={18} /></button><button className="primary-button" onClick={() => setShowAdd(true)}><Plus size={18} /> 新增岗位</button></div></header>
        <section className="summary-row"><div className="summary-intro"><Sparkles size={18} /><span>今天是 {today.replaceAll('-', '.')}，继续保持推进。</span></div><div className="summary-metrics"><span><b>{activeJobs.length}</b> 个进行中</span><span className={urgentJobs.length ? 'metric-alert' : ''}><b>{urgentJobs.length}</b> 个待处理</span><span><b>{jobs.filter((job) => job.status === 'Offer').length}</b> 个 Offer</span></div></section>
        <div className="board-toolbar"><div className="view-tabs"><button className="view-tab active">全部岗位 <span>{jobs.length}</span></button><button className="view-tab">高优先级 <span>{jobs.filter((job) => job.priority === '高').length}</span></button><button className="view-tab">本周更新</button></div><button className="sort-button">最近更新 <ChevronDown size={15} /></button></div>
        <section className="board">{STATUSES.map((status) => <div className="column" key={status} onDragOver={(event) => event.preventDefault()} onDrop={() => handleDrop(status)}><div className="column-head"><div className={`status-dot ${STATUS_META[status].tone}`} /><h2>{status}</h2><span className="column-count">{filteredJobs.filter((job) => job.status === status).length}</span><button className="column-more">···</button></div><div className="column-cards">{filteredJobs.filter((job) => job.status === status).map((job) => <JobCard key={job.id} job={job} onClick={() => setSelectedId(job.id)} onDragStart={() => setDraggedId(job.id)} />)}<button className="add-card" onClick={() => setShowAdd(true)}><Plus size={15} /> 添加岗位</button></div></div>)}</section>
      </main>
      {selectedJob && <DetailDrawer job={selectedJob} events={events.filter((event) => event.jobId === selectedJob.id)} onClose={() => setSelectedId(null)} onUpdate={updateSelected} onStatusChange={(status) => updateStatus(selectedJob.id, status)} />}
      {showAdd && <AddJobModal onClose={() => setShowAdd(false)} onSubmit={submitNewJob} />}
    </div>
  )
}

function JobCard({ job, onClick, onDragStart }: { job: JobPosition; onClick: () => void; onDragStart: () => void }) {
  const missing = !job.jobUrl || !job.processUrl
  return <article className="job-card" draggable onDragStart={onDragStart} onClick={onClick}><div className="card-top"><span className={`priority priority-${job.priority}`}>{job.priority}优先</span>{missing && <span className="missing-info"><CircleAlert size={13} />待补充</span>}<button className="card-arrow"><ArrowUpRight size={16} /></button></div><h3>{job.title}</h3><div className="company-line"><span className="company-avatar">{job.company.slice(0, 1)}</span><span>{job.company}</span></div><div className="card-meta"><span>{job.city || '地点待定'}</span><span>{job.direction}</span></div>{job.nextAction && <div className="next-action"><ClipboardList size={14} /><span>{job.nextAction}</span>{job.nextActionDeadline && <time>{job.nextActionDeadline.slice(5).replace('-', '/')}</time>}</div>}</article>
}

function DetailDrawer({ job, events, onClose, onUpdate, onStatusChange }: { job: JobPosition; events: ProcessEvent[]; onClose: () => void; onUpdate: (patch: Partial<JobPosition>) => void; onStatusChange: (status: JobStatus) => void }) {
  return <div className="drawer-backdrop" onClick={onClose}><aside className="detail-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><span>岗位详情</span><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="drawer-body"><div className="detail-title"><div className="large-avatar">{job.company.slice(0, 1)}</div><div><span>{job.company}</span><h2>{job.title}</h2><p>{job.city || '地点待定'} · {job.employmentType} · {job.direction}</p></div></div><div className="detail-status"><label>当前阶段</label><select value={job.status} onChange={(event) => onStatusChange(event.target.value as JobStatus)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div><div className="detail-grid"><DetailField label="优先级"><select value={job.priority} onChange={(event) => onUpdate({ priority: event.target.value as Priority })}><option>高</option><option>中</option><option>低</option></select></DetailField><DetailField label="投递日期"><input type="date" value={job.appliedAt || ''} onChange={(event) => onUpdate({ appliedAt: event.target.value })} /></DetailField><DetailField label="截止日期"><input type="date" value={job.deadlineAt || ''} onChange={(event) => onUpdate({ deadlineAt: event.target.value })} /></DetailField><DetailField label="下一步截止"><input type="date" value={job.nextActionDeadline || ''} onChange={(event) => onUpdate({ nextActionDeadline: event.target.value })} /></DetailField></div><div className="detail-section"><div className="section-title"><h3>下一步行动</h3><span>行动先于焦虑</span></div><input className="wide-input" value={job.nextAction} onChange={(event) => onUpdate({ nextAction: event.target.value })} placeholder="例如：准备笔试、跟进 HR" /></div><div className="detail-section"><div className="section-title"><h3>相关链接</h3><span>{job.jobUrl && job.processUrl ? '信息完整' : '还有信息待补充'}</span></div><LinkRow label="岗位链接" url={job.jobUrl} onChange={(url) => onUpdate({ jobUrl: url })} /><LinkRow label="流程链接" url={job.processUrl} onChange={(url) => onUpdate({ processUrl: url })} /></div><div className="detail-section"><div className="section-title"><h3>流程历史</h3><span>{events.length} 次变更</span></div><div className="timeline">{events.length ? events.slice().reverse().map((event) => <div className="timeline-item" key={event.id}><div className="timeline-dot" /><div><strong>{event.fromStatus || '新建'} → {event.toStatus}</strong><time>{event.eventTime}</time></div></div>) : <div className="empty-timeline">状态变更会记录在这里</div>}</div></div><div className="detail-section"><div className="section-title"><h3>JD 摘要</h3><span>Markdown 备忘录将在 V0.2 加入</span></div><textarea className="jd-input" value={job.jdContent} onChange={(event) => onUpdate({ jdContent: event.target.value })} placeholder="粘贴岗位 JD，方便后续搜索和准备..." /></div></div><div className="drawer-footer"><button className="secondary-button"><ExternalLink size={16} /> 打开岗位链接</button><button className="primary-button" onClick={onClose}><Check size={16} /> 完成编辑</button></div></aside></div>
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="detail-field"><span>{label}</span>{children}</label> }
function LinkRow({ label, url, onChange }: { label: string; url: string; onChange: (value: string) => void }) { return <label className="link-row"><span>{label}</span><input value={url} onChange={(event) => onChange(event.target.value)} placeholder="粘贴链接" />{url && <a href={url} target="_blank" rel="noreferrer" title="在浏览器打开"><ExternalLink size={15} /></a>}</label> }
function AddJobModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <div className="modal-backdrop" onClick={onClose}><form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={onSubmit}><div className="modal-head"><div><span className="eyebrow">新建记录</span><h2>添加一个新岗位</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="form-grid"><label><span>公司名称 *</span><input name="company" required placeholder="例如：远景智能" /></label><label><span>岗位名称 *</span><input name="title" required placeholder="例如：产品经理（校招）" /></label><label><span>岗位方向</span><input name="direction" placeholder="产品、开发、运营..." /></label><label><span>工作城市</span><input name="city" placeholder="例如：上海" /></label><label><span>工作类型</span><select name="employmentType"><option>校招</option><option>全职</option><option>实习</option></select></label><label><span>优先级</span><select name="priority"><option>高</option><option selected>中</option><option>低</option></select></label><label><span>岗位来源</span><input name="source" placeholder="官网、内推、招聘平台..." /></label><label><span>截止日期</span><input name="deadlineAt" type="date" /></label><label className="form-wide"><span>岗位链接</span><input name="jobUrl" type="url" placeholder="https://" /></label><label className="form-wide"><span>下一步行动</span><input name="nextAction" placeholder="例如：准备笔试" /></label><label><span>行动截止</span><input name="nextActionDeadline" type="date" /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button"><Plus size={17} /> 创建岗位</button></div></form></div> }

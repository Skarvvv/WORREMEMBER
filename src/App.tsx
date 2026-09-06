import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, Check, ChevronDown, CircleAlert, ClipboardList, ExternalLink, FileText, LayoutDashboard, Plus, RotateCcw, Search, Settings2, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react'
import type { DragEvent, FormEvent } from 'react'
import { backupDesktopDatabase, deleteDesktopJob, downloadFile, loadCalendarEvents, loadDeletedJobs, loadDesktopDeletedJobs, loadDesktopJobs, loadFlowTemplates, loadJobs, loadNotes, loadProcessEvents, loadTasks, persistDesktopJob, restoreDesktopJob, saveCalendarEvents, saveDeletedJobs, saveFlowTemplates, saveJobs, saveNotes, saveProcessEvents, saveTasks } from './storage'
import { getStatusMeta, JobStatus, Priority, STATUSES, type CalendarEvent, type FlowTemplate, type JobPosition, type Note, type ProcessEvent, type Task } from './types'

const today = new Date().toISOString().slice(0, 10)

function normalizeJobFlow(job: JobPosition): JobPosition {
  if (job.flowId) return job
  if (job.direction.includes('产品')) return { ...job, flowId: 'flow-product' }
  if (['开发', '前端', '后端', '算法', '研发', '测试'].some((keyword) => job.direction.includes(keyword))) return { ...job, flowId: 'flow-engineering' }
  return { ...job, flowId: 'flow-general' }
}

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
  const [jobs, setJobs] = useState<JobPosition[]>(() => loadJobs().map(normalizeJobFlow))
  const [deletedJobs, setDeletedJobs] = useState<JobPosition[]>(loadDeletedJobs)
  const [events, setEvents] = useState<ProcessEvent[]>(loadProcessEvents)
  const [flowTemplates, setFlowTemplates] = useState<FlowTemplate[]>(loadFlowTemplates)
  const [activeFlowId, setActiveFlowId] = useState('flow-general')
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(loadCalendarEvents)
  const [notes, setNotes] = useState<Note[]>(loadNotes)
  const [activeNav, setActiveNav] = useState('看板')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadDesktopJobs().then((desktopJobs) => {
      if (!cancelled && desktopJobs && desktopJobs.length) {
        const normalizedJobs = desktopJobs.map(normalizeJobFlow)
        setJobs(normalizedJobs)
        saveJobs(normalizedJobs)
        normalizedJobs.forEach((job) => { void persistDesktopJob(job) })
      }
    })
    loadDesktopDeletedJobs().then((desktopJobs) => {
      if (!cancelled && desktopJobs) setDeletedJobs(desktopJobs)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const handleDeleteRequest = (event: Event) => {
      const job = jobs.find((item) => item.id === (event as CustomEvent<string>).detail)
      if (job) deleteJob(job)
    }
    window.addEventListener('worremember:delete-job', handleDeleteRequest)
    return () => window.removeEventListener('worremember:delete-job', handleDeleteRequest)
  }, [jobs, deletedJobs])

  const selectedJob = jobs.find((job) => job.id === selectedId) ?? null
  const filteredJobs = useMemo(() => jobs.filter((job) => [job.company, job.title, job.direction, job.city, job.nextAction, job.jdContent].join(' ').toLowerCase().includes(query.toLowerCase())), [jobs, query])
  const urgentJobs = jobs.filter((job) => job.nextActionDeadline && job.nextActionDeadline <= today && job.status !== '已结束' && job.status !== '已拒绝')
  const activeJobs = jobs.filter((job) => !['已结束', '已拒绝'].includes(job.status))
  const pendingTasks = tasks.filter((task) => !task.completedAt)
  const activeFlow = flowTemplates.find((flow) => flow.id === activeFlowId) ?? flowTemplates[0]
  const selectedFlow = flowTemplates.find((flow) => flow.id === (selectedJob?.flowId || 'flow-general')) ?? activeFlow
  const flowJobs = filteredJobs.filter((job) => (job.flowId || 'flow-general') === activeFlow?.id)

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
    const form = event.currentTarget
    const job = { ...makeJob(form), flowId: String(new FormData(form).get('flowId') || flowTemplates[0]?.id) }
    updateJobs([job, ...jobs])
    setShowAdd(false)
    setSelectedId(job.id)
  }

  function updateSelected(patch: Partial<JobPosition>) {
    if (!selectedJob) return
    updateJobs(jobs.map((job) => job.id === selectedJob.id ? { ...job, ...patch, updatedAt: today } : job))
  }

  function deleteJob(job: JobPosition) {
    if (!window.confirm(`确定要删除「${job.company} · ${job.title}」吗？岗位会进入回收站。`)) return
    const nextJobs = jobs.filter((item) => item.id !== job.id)
    const deletedJob = { ...job, deletedAt: new Date().toISOString() }
    const nextDeletedJobs = [deletedJob, ...deletedJobs]
    setJobs(nextJobs)
    setDeletedJobs(nextDeletedJobs)
    saveJobs(nextJobs)
    saveDeletedJobs(nextDeletedJobs)
    void deleteDesktopJob(job.id)
    setSelectedId(null)
  }

  function restoreJob(job: JobPosition) {
    const nextDeletedJobs = deletedJobs.filter((item) => item.id !== job.id)
    const restoredJob = { ...job, deletedAt: undefined, updatedAt: today }
    const nextJobs = [restoredJob, ...jobs]
    setDeletedJobs(nextDeletedJobs)
    setJobs(nextJobs)
    saveDeletedJobs(nextDeletedJobs)
    saveJobs(nextJobs)
    void restoreDesktopJob(job.id)
  }

  function updateFlowTemplates(next: FlowTemplate[]) {
    setFlowTemplates(next)
    saveFlowTemplates(next)
    if (!next.some((flow) => flow.id === activeFlowId)) setActiveFlowId(next[0]?.id || '')
  }

  function createFlow() {
    const flow = { id: crypto.randomUUID(), name: `新流程 ${flowTemplates.length + 1}`, statuses: [...STATUSES] }
    updateFlowTemplates([...flowTemplates, flow])
    setActiveFlowId(flow.id)
  }

  function deleteFlow(flowId: string) {
    if (flowTemplates.length <= 1) return
    const flow = flowTemplates.find((item) => item.id === flowId)
    if (!flow || !window.confirm(`确定删除“${flow.name}”吗？其中的岗位会转移到其他流程。`)) return
    const replacement = flowTemplates.find((item) => item.id !== flowId)
    const nextJobs = jobs.map((job) => (job.flowId || 'flow-general') === flowId ? { ...job, flowId: replacement?.id, updatedAt: today } : job)
    updateJobs(nextJobs)
    updateFlowTemplates(flowTemplates.filter((item) => item.id !== flowId))
  }

  function assignJobFlow(jobId: string, flowId: string) {
    updateJobs(jobs.map((job) => job.id === jobId ? { ...job, flowId, updatedAt: today } : job))
  }

  function updateTasks(next: Task[]) { setTasks(next); saveTasks(next) }
  function updateCalendarEvents(next: CalendarEvent[]) { setCalendarEvents(next); saveCalendarEvents(next) }
  function updateNotes(next: Note[]) { setNotes(next); saveNotes(next) }

  function importData(data: { jobs: JobPosition[]; deletedJobs: JobPosition[]; tasks: Task[]; events: CalendarEvent[]; notes: Note[]; flows: FlowTemplate[] }) {
    setJobs(data.jobs); setDeletedJobs(data.deletedJobs); setTasks(data.tasks); setCalendarEvents(data.events); setNotes(data.notes); setFlowTemplates(data.flows)
    saveJobs(data.jobs); saveDeletedJobs(data.deletedJobs); saveTasks(data.tasks); saveCalendarEvents(data.events); saveNotes(data.notes); saveFlowTemplates(data.flows)
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
        <button className={activeNav === '回收站' ? 'nav-item active' : 'nav-item muted'} onClick={() => setActiveNav('回收站')}><Trash2 size={18} strokeWidth={1.8} /><span>回收站</span>{deletedJobs.length > 0 && <span className="nav-count">{deletedJobs.length}</span>}</button>
        <button className="nav-item muted" onClick={() => setActiveNav('设置')}><Settings2 size={18} strokeWidth={1.8} /><span>设置</span></button>
        <div className="sidebar-footer"><div className="sync-dot" /><span>本地数据已保存</span></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div><div className="breadcrumb">秋招作战台 <span>/</span> {activeNav}</div><h1>{activeNav === '看板' ? '投递看板' : activeNav}</h1></div><div className="top-actions"><div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司、岗位或行动" /><kbd>⌘ K</kbd></div><button className="icon-button" title="筛选"><SlidersHorizontal size={18} /></button><button className="primary-button" onClick={() => setShowAdd(true)}><Plus size={18} /> 新增岗位</button></div></header>
        <section className="summary-row"><div className="summary-intro"><Sparkles size={18} /><span>今天是 {today.replaceAll('-', '.')}，继续保持推进。</span></div><div className="summary-metrics"><span><b>{activeJobs.length}</b> 个进行中</span><span className={urgentJobs.length ? 'metric-alert' : ''}><b>{urgentJobs.length}</b> 个待处理</span><span><b>{jobs.filter((job) => job.status === 'Offer').length}</b> 个 Offer</span></div></section>
        {activeNav === '总览' ? <OverviewView jobs={jobs} tasks={tasks} events={calendarEvents} notes={notes} onCompleteTask={(task) => updateTasks(tasks.map((item) => item.id === task.id ? { ...item, completedAt: today, updatedAt: today } : item))} /> : activeNav === '日程' ? <CalendarView events={calendarEvents} jobs={jobs} onChange={updateCalendarEvents} /> : activeNav === '备忘录' ? <NotesView notes={notes} jobs={jobs} onChange={updateNotes} /> : activeNav === '回收站' ? <TrashView jobs={deletedJobs} onRestore={restoreJob} /> : activeNav === '设置' ? <FlowSettings flows={flowTemplates} onChange={updateFlowTemplates} onCreate={createFlow} onDelete={deleteFlow} onAssign={assignJobFlow} onImport={importData} jobs={jobs} deletedJobs={deletedJobs} tasks={tasks} events={calendarEvents} notes={notes} /> : <><div className="board-toolbar"><div className="view-tabs">{flowTemplates.map((flow) => <button key={flow.id} className={activeFlow?.id === flow.id ? 'view-tab active' : 'view-tab'} onClick={() => setActiveFlowId(flow.id)}>{flow.name} <span>{jobs.filter((job) => (job.flowId || 'flow-general') === flow.id).length}</span></button>)}<button className="view-tab">高优先级 <span>{flowJobs.filter((job) => job.priority === '高').length}</span></button><button className="view-tab">本周更新</button></div><button className="sort-button">最近更新 <ChevronDown size={15} /></button></div><section className="board">{(activeFlow?.statuses || STATUSES).map((status) => <div className="column" key={status} onDragOver={(event) => event.preventDefault()} onDrop={() => handleDrop(status)}><div className="column-head"><div className={`status-dot ${getStatusMeta(status).tone}`} /><h2>{status}</h2><span className="column-count">{flowJobs.filter((job) => job.status === status).length}</span><button className="column-more">···</button></div><div className="column-cards">{flowJobs.filter((job) => job.status === status).map((job) => <JobCard key={job.id} job={job} onClick={() => setSelectedId(job.id)} onDragStart={() => setDraggedId(job.id)} />)}<button className="add-card" onClick={() => setShowAdd(true)}><Plus size={15} /> 添加岗位</button></div></div>)}</section></>}
      </main>
      {selectedJob && <DetailDrawer job={selectedJob} events={events.filter((event) => event.jobId === selectedJob.id)} statuses={selectedFlow?.statuses || STATUSES} onClose={() => setSelectedId(null)} onUpdate={updateSelected} onStatusChange={(status) => updateStatus(selectedJob.id, status)} onDelete={() => deleteJob(selectedJob)} />}
      {showAdd && <AddJobModal onClose={() => setShowAdd(false)} onSubmit={submitNewJob} />}
    </div>
  )
}

function JobCard({ job, onClick, onDragStart }: { job: JobPosition; onClick: () => void; onDragStart: () => void }) {
  const missing = !job.jobUrl || !job.processUrl
  return <article className="job-card" draggable onDragStart={onDragStart} onClick={onClick}><div className="card-top"><span className={`priority priority-${job.priority}`}>{job.priority}优先</span>{missing && <span className="missing-info"><CircleAlert size={13} />待补充</span>}<button className="card-delete" onClick={(event) => { event.stopPropagation(); window.dispatchEvent(new CustomEvent('worremember:delete-job', { detail: job.id })) }} title="删除岗位"><Trash2 size={14} /></button><button className="card-arrow"><ArrowUpRight size={16} /></button></div><h3>{job.title}</h3><div className="company-line"><span className="company-avatar">{job.company.slice(0, 1)}</span><span>{job.company}</span></div><div className="card-meta"><span>{job.city || '地点待定'}</span><span>{job.direction}</span></div>{job.nextAction && <div className="next-action"><ClipboardList size={14} /><span>{job.nextAction}</span>{job.nextActionDeadline && <time>{job.nextActionDeadline.slice(5).replace('-', '/')}</time>}</div>}</article>
}

function DetailDrawer({ job, events, statuses, onClose, onUpdate, onStatusChange, onDelete }: { job: JobPosition; events: ProcessEvent[]; statuses: string[]; onClose: () => void; onUpdate: (patch: Partial<JobPosition>) => void; onStatusChange: (status: JobStatus) => void; onDelete: () => void }) {
  return <div className="drawer-backdrop" onClick={onClose}><aside className="detail-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><span>岗位详情</span><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="drawer-body"><div className="detail-title"><div className="large-avatar">{job.company.slice(0, 1)}</div><div><span>{job.company}</span><h2>{job.title}</h2><p>{job.city || '地点待定'} · {job.employmentType} · {job.direction}</p></div></div><div className="detail-status"><label>当前阶段</label><select value={job.status} onChange={(event) => onStatusChange(event.target.value as JobStatus)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div><div className="detail-grid"><DetailField label="优先级"><select value={job.priority} onChange={(event) => onUpdate({ priority: event.target.value as Priority })}><option>高</option><option>中</option><option>低</option></select></DetailField><DetailField label="投递日期"><input type="date" value={job.appliedAt || ''} onChange={(event) => onUpdate({ appliedAt: event.target.value })} /></DetailField><DetailField label="截止日期"><input type="date" value={job.deadlineAt || ''} onChange={(event) => onUpdate({ deadlineAt: event.target.value })} /></DetailField><DetailField label="下一步截止"><input type="date" value={job.nextActionDeadline || ''} onChange={(event) => onUpdate({ nextActionDeadline: event.target.value })} /></DetailField></div><div className="detail-section"><div className="section-title"><h3>下一步行动</h3><span>行动先于焦虑</span></div><input className="wide-input" value={job.nextAction} onChange={(event) => onUpdate({ nextAction: event.target.value })} placeholder="例如：准备笔试、跟进 HR" /></div><div className="detail-section"><div className="section-title"><h3>相关链接</h3><span>{job.jobUrl && job.processUrl ? '信息完整' : '还有信息待补充'}</span></div><LinkRow label="岗位链接" url={job.jobUrl} onChange={(url) => onUpdate({ jobUrl: url })} /><LinkRow label="流程链接" url={job.processUrl} onChange={(url) => onUpdate({ processUrl: url })} /></div><div className="detail-section"><div className="section-title"><h3>流程历史</h3><span>{events.length} 次变更</span></div><div className="timeline">{events.length ? events.slice().reverse().map((event) => <div className="timeline-item" key={event.id}><div className="timeline-dot" /><div><strong>{event.fromStatus || '新建'} → {event.toStatus}</strong><time>{event.eventTime}</time></div></div>) : <div className="empty-timeline">状态变更会记录在这里</div>}</div></div><div className="detail-section"><div className="section-title"><h3>JD 摘要</h3><span>Markdown 备忘录将在 V0.2 加入</span></div><textarea className="jd-input" value={job.jdContent} onChange={(event) => onUpdate({ jdContent: event.target.value })} placeholder="粘贴岗位 JD，方便后续搜索和准备..." /></div></div><div className="drawer-footer"><button className="secondary-button"><ExternalLink size={16} /> 打开岗位链接</button><button className="primary-button" onClick={onClose}><Check size={16} /> 完成编辑</button></div></aside></div>
}

function OverviewView({ jobs, tasks, events, notes, onCompleteTask }: { jobs: JobPosition[]; tasks: Task[]; events: CalendarEvent[]; notes: Note[]; onCompleteTask: (task: Task) => void }) {
  const upcomingJobs = jobs.filter((job) => job.deadlineAt && job.deadlineAt >= today).sort((a, b) => (a.deadlineAt || '').localeCompare(b.deadlineAt || '')).slice(0, 5)
  const upcomingEvents = events.filter((event) => event.startAt >= today).sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 5)
  const openTasks = tasks.filter((task) => !task.completedAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 5)
  return <section className="overview-view"><div className="overview-heading"><div><span className="eyebrow">工作台摘要</span><h2>今天要推进什么？</h2><p>把下一步行动放在眼前，减少在多个页面之间来回寻找。</p></div><div className="overview-count"><strong>{jobs.filter((job) => !['已结束', '已拒绝'].includes(job.status)).length}</strong><span>进行中岗位</span></div></div><div className="overview-grid"><section className="overview-panel task-panel"><div className="panel-heading"><h3>今日待办</h3><span>{openTasks.length} 项</span></div>{openTasks.length === 0 ? <div className="panel-empty">暂无待办</div> : openTasks.map((task) => <label className="task-row" key={task.id}><input type="checkbox" onChange={() => onCompleteTask(task)} /><span><strong>{task.title}</strong><small>{task.dueAt} · {task.priority}优先</small></span></label>)}</section><section className="overview-panel"><div className="panel-heading"><h3>即将到期</h3><span>岗位截止</span></div>{upcomingJobs.length === 0 ? <div className="panel-empty">暂无截止日期</div> : upcomingJobs.map((job) => <div className="overview-row" key={job.id}><span><strong>{job.company}</strong><small>{job.title}</small></span><time>{job.deadlineAt}</time></div>)}</section><section className="overview-panel"><div className="panel-heading"><h3>近期日程</h3><span>{upcomingEvents.length} 项</span></div>{upcomingEvents.length === 0 ? <div className="panel-empty">暂无日程</div> : upcomingEvents.map((event) => <div className="overview-row" key={event.id}><span><strong>{event.title}</strong><small>{event.type}</small></span><time>{event.startAt.replace('T', ' ')}</time></div>)}</section><section className="overview-panel"><div className="panel-heading"><h3>最近备忘录</h3><span>{notes.length} 篇</span></div>{notes.length === 0 ? <div className="panel-empty">还没有备忘录</div> : notes.slice(0, 4).map((note) => <div className="overview-row" key={note.id}><span><strong>{note.title}</strong><small>{note.tags.join(' · ') || '未分类'}</small></span><time>{note.updatedAt}</time></div>)}</section></div></section>
}

function CalendarView({ events, jobs, onChange }: { events: CalendarEvent[]; jobs: JobPosition[]; onChange: (events: CalendarEvent[]) => void }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('面试')
  const [startAt, setStartAt] = useState('')
  const [jobId, setJobId] = useState('')
  function addEvent(event: FormEvent) {
    event.preventDefault()
    if (!title || !startAt) return
    const next = { id: crypto.randomUUID(), title, type, startAt, jobId: jobId || undefined, location: '', note: '', createdAt: today, updatedAt: today }
    onChange([next, ...events])
    setTitle(''); setStartAt(''); setJobId('')
  }
  return <section className="page-view calendar-view"><div className="page-heading"><div><span className="eyebrow">时间安排</span><h2>日程</h2><p>把笔试、面试和准备任务集中到一个时间线上。</p></div></div><form className="inline-form" onSubmit={addEvent}><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="事件名称，例如：远景智能一面" required /><select value={type} onChange={(event) => setType(event.target.value)}><option>面试</option><option>笔试</option><option>投递截止</option><option>准备任务</option><option>自定义</option></select><input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required /><select value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">不关联岗位</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.title}</option>)}</select><button className="primary-button" type="submit"><Plus size={16} /> 添加日程</button></form><div className="event-list">{events.length === 0 ? <div className="panel-empty">还没有日程安排</div> : events.sort((a, b) => a.startAt.localeCompare(b.startAt)).map((event) => <article className="event-row" key={event.id}><div className="event-date"><strong>{event.startAt.slice(5, 10).replace('-', '/')}</strong><span>{event.startAt.slice(11, 16)}</span></div><div><strong>{event.title}</strong><small>{event.type}{event.jobId ? ` · ${jobs.find((job) => job.id === event.jobId)?.company || ''}` : ''}</small></div><button className="icon-button" onClick={() => onChange(events.filter((item) => item.id !== event.id))} title="删除日程"><Trash2 size={15} /></button></article>)}</div></section>
}

function NotesView({ notes, jobs, onChange }: { notes: Note[]; jobs: JobPosition[]; onChange: (notes: Note[]) => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [jobId, setJobId] = useState('')
  function addNote(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    const note: Note = { id: crypto.randomUUID(), title: title.trim(), content, jobId: jobId || undefined, tags: [], pinned: false, createdAt: today, updatedAt: today }
    onChange([note, ...notes]); setTitle(''); setContent(''); setJobId('')
  }
  function togglePinned(note: Note) { onChange(notes.map((item) => item.id === note.id ? { ...item, pinned: !item.pinned, updatedAt: today } : item)) }
  return <section className="page-view notes-view"><div className="page-heading"><div><span className="eyebrow">知识整理</span><h2>备忘录</h2><p>记录岗位分析、公司研究和面试复盘，随时回到具体岗位。</p></div></div><form className="note-form" onSubmit={addNote}><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="备忘录标题" required /><select value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">不关联岗位</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.title}</option>)}</select><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="写下岗位分析、面试问题或复盘内容..." rows={4} /><button className="primary-button" type="submit"><Plus size={16} /> 新建备忘录</button></form><div className="note-list">{notes.length === 0 ? <div className="panel-empty">还没有备忘录</div> : notes.map((note) => <article className={note.pinned ? 'note-card pinned' : 'note-card'} key={note.id}><div className="note-card-head"><div><h3>{note.title}</h3><small>{note.jobId ? jobs.find((job) => job.id === note.jobId)?.company : '独立笔记'} · {note.updatedAt}</small></div><div><button className="icon-button" onClick={() => togglePinned(note)} title={note.pinned ? '取消置顶' : '置顶'}><Check size={15} /></button><button className="icon-button" onClick={() => onChange(notes.filter((item) => item.id !== note.id))} title="删除备忘录"><Trash2 size={15} /></button></div></div><p>{note.content || '暂无内容'}</p></article>)}</div></section>
}

function FlowSettings({ flows, onChange, onCreate, onDelete, onAssign, onImport, jobs, deletedJobs, tasks, events, notes }: { flows: FlowTemplate[]; onChange: (flows: FlowTemplate[]) => void; onCreate: () => void; onDelete: (flowId: string) => void; onAssign: (jobId: string, flowId: string) => void; onImport: (data: { jobs: JobPosition[]; deletedJobs: JobPosition[]; tasks: Task[]; events: CalendarEvent[]; notes: Note[]; flows: FlowTemplate[] }) => void; jobs: JobPosition[]; deletedJobs: JobPosition[]; tasks: Task[]; events: CalendarEvent[]; notes: Note[] }) {
  function exportJson() {
    downloadFile(`worremember-backup-${today}.json`, JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), jobs, deletedJobs, tasks, events, notes, flows }, null, 2), 'application/json')
  }

  function exportCsv() {
    const columns = ['公司', '岗位', '方向', '城市', '阶段', '优先级', '投递日期', '截止日期', '下一步行动']
    const rows = jobs.map((job) => [job.company, job.title, job.direction, job.city, job.status, job.priority, job.appliedAt || '', job.deadlineAt || '', job.nextAction])
    const csv = [columns, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    downloadFile(`worremember-jobs-${today}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8')
  }

  async function backupDatabase() {
    const path = await backupDesktopDatabase()
    window.alert(path ? `数据库备份已生成：${path}` : '当前环境暂不支持直接备份数据库，请使用 JSON 导出。')
  }

  function importJson(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !window.confirm('导入将覆盖当前岗位、日程、备忘录和流程模板，确定继续吗？')) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Partial<Record<'jobs' | 'deletedJobs' | 'tasks' | 'events' | 'notes' | 'flows', unknown>>
        const keys = ['jobs', 'deletedJobs', 'tasks', 'events', 'notes', 'flows'] as const
        if (!keys.every((key) => Array.isArray(data[key]))) throw new Error('文件结构不完整')
        onImport(data as { jobs: JobPosition[]; deletedJobs: JobPosition[]; tasks: Task[]; events: CalendarEvent[]; notes: Note[]; flows: FlowTemplate[] })
        window.alert('数据导入成功。')
      } catch (error) {
        window.alert(`导入失败：${error instanceof Error ? error.message : 'JSON 格式无效'}`)
      }
    }
    reader.readAsText(file)
  }
  function updateFlow(flowId: string, patch: Partial<FlowTemplate>) {
    onChange(flows.map((flow) => flow.id === flowId ? { ...flow, ...patch } : flow))
  }

  function updateStage(flow: FlowTemplate, index: number, value: string) {
    const statuses = flow.statuses.map((status, stageIndex) => stageIndex === index ? value : status).filter(Boolean)
    updateFlow(flow.id, { statuses })
  }

  function addStage(flow: FlowTemplate) {
    updateFlow(flow.id, { statuses: [...flow.statuses, '新阶段'] })
  }

  function removeStage(flow: FlowTemplate, index: number) {
    if (flow.statuses.length <= 2) return
    updateFlow(flow.id, { statuses: flow.statuses.filter((_, stageIndex) => stageIndex !== index) })
  }

  return <section className="settings-view"><div className="settings-heading"><span className="eyebrow">流程管理</span><h2>流程模板</h2><p>为研发、产品、运营、设计等不同方向维护独立的招聘流程。</p></div><div className="data-tools"><div><strong>流程类别</strong><span>新增类别后，可以为岗位分配不同的招聘流程。</span></div><div className="data-tool-actions"><button className="secondary-button" onClick={onCreate}><Plus size={15} /> 新增流程类别</button></div></div><div className="flow-settings-list">{flows.map((flow) => <article className="flow-setting" key={flow.id}><div className="flow-setting-title"><input className="flow-name-input" value={flow.name} onChange={(event) => updateFlow(flow.id, { name: event.target.value })} /><button className="icon-button danger-button" onClick={() => onDelete(flow.id)} title="删除流程类别"><Trash2 size={15} /></button></div><label className="flow-assignment"><span>岗位归属</span><select value="" onChange={(event) => event.target.value && onAssign(event.target.value, flow.id)}><option value="">选择岗位加入此流程</option>{jobs.filter((job) => (job.flowId || 'flow-general') !== flow.id).map((job) => <option key={job.id} value={job.id}>{job.company} · {job.title}</option>)}</select></label><div className="flow-stage-list">{flow.statuses.map((status, index) => <div className="flow-stage" key={`${flow.id}-${index}`}><span>{index + 1}</span><input value={status} onChange={(event) => updateStage(flow, index, event.target.value)} /><button className="icon-button" onClick={() => removeStage(flow, index)} title="删除阶段"><X size={15} /></button></div>)}</div><button className="secondary-button" onClick={() => addStage(flow)}><Plus size={15} /> 添加阶段</button></article>)}</div></section>
}

function TrashView({ jobs, onRestore }: { jobs: JobPosition[]; onRestore: (job: JobPosition) => void }) {
  return <section className="trash-view"><div className="trash-heading"><div><span className="eyebrow">已移除岗位</span><h2>回收站</h2></div><span>{jobs.length} 个岗位</span></div>{jobs.length === 0 ? <div className="empty-state"><Trash2 size={24} /><p>回收站是空的</p></div> : <div className="trash-list">{jobs.map((job) => <article className="trash-item" key={job.id}><div><strong>{job.title}</strong><span>{job.company} · 原阶段：{job.status}</span></div><button className="secondary-button" onClick={() => onRestore(job)}><RotateCcw size={15} /> 恢复</button></article>)}</div>}</section>
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="detail-field"><span>{label}</span>{children}</label> }
function LinkRow({ label, url, onChange }: { label: string; url: string; onChange: (value: string) => void }) { return <label className="link-row"><span>{label}</span><input value={url} onChange={(event) => onChange(event.target.value)} placeholder="粘贴链接" />{url && <a href={url} target="_blank" rel="noreferrer" title="在浏览器打开"><ExternalLink size={15} /></a>}</label> }
function AddJobModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <div className="modal-backdrop" onClick={onClose}><form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={onSubmit}><div className="modal-head"><div><span className="eyebrow">新建记录</span><h2>添加一个新岗位</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="form-grid"><label><span>公司名称 *</span><input name="company" required placeholder="例如：远景智能" /></label><label><span>岗位名称 *</span><input name="title" required placeholder="例如：产品经理（校招）" /></label><label><span>岗位方向</span><input name="direction" placeholder="产品、开发、运营..." /></label><label><span>工作城市</span><input name="city" placeholder="例如：上海" /></label><label><span>工作类型</span><select name="employmentType"><option>校招</option><option>全职</option><option>实习</option></select></label><label><span>优先级</span><select name="priority"><option>高</option><option selected>中</option><option>低</option></select></label><label><span>岗位来源</span><input name="source" placeholder="官网、内推、招聘平台..." /></label><label><span>截止日期</span><input name="deadlineAt" type="date" /></label><label className="form-wide"><span>岗位链接</span><input name="jobUrl" type="url" placeholder="https://" /></label><label className="form-wide"><span>下一步行动</span><input name="nextAction" placeholder="例如：准备笔试" /></label><label><span>行动截止</span><input name="nextActionDeadline" type="date" /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button"><Plus size={17} /> 创建岗位</button></div></form></div> }

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, Check, ChevronDown, CircleAlert, ClipboardList, ExternalLink, FileText, LayoutDashboard, Pencil, Pin, Plus, RotateCcw, Search, Settings2, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react'
import type { DragEvent, FormEvent, MouseEvent } from 'react'
import { backupDesktopDatabase, deleteDesktopJob, downloadFile, isDesktopRuntime, loadCalendarEvents, loadDeletedJobs, loadDesktopDeletedJobs, loadDesktopJobs, loadDesktopProcessEvents, loadFlowTemplates, loadJobs, loadNotes, loadProcessEvents, loadTasks, persistDesktopJob, persistDesktopJobs, persistDesktopProcessEvent, purgeDesktopDeletedJobs, purgeDesktopJob, restoreDesktopJob, saveCalendarEvents, saveDeletedJobs, saveFlowTemplates, saveJobs, saveNotes, saveProcessEvents, saveTasks } from './storage'
import { getStatusMeta, JobStatus, Priority, STATUSES, type CalendarEvent, type FlowTemplate, type JobPosition, type Note, type ProcessEvent, type Task } from './types'

const today = new Date().toISOString().slice(0, 10)

function normalizeJobFlow(job: JobPosition): JobPosition {
  const tags = job.tags?.length ? job.tags : job.direction ? [job.direction] : []
  if (job.flowId) return { ...job, tags }
  if (job.direction.includes('产品')) return { ...job, flowId: 'flow-product', tags }
  if (['开发', '前端', '后端', '算法', '研发', '测试'].some((keyword) => job.direction.includes(keyword))) return { ...job, flowId: 'flow-engineering', tags }
  return { ...job, flowId: 'flow-general', tags }
}

function makeJob(form: HTMLFormElement): JobPosition {
  const data = new FormData(form)
  return {
    id: crypto.randomUUID(), company: String(data.get('company') || ''), title: String(data.get('title') || ''),
    direction: String(data.get('direction') || '其他'), city: String(data.get('city') || ''),
    employmentType: String(data.get('employmentType') || '校招'), source: String(data.get('source') || ''),
    status: '了解中', priority: data.get('priority') as Priority || '中', jobUrl: String(data.get('jobUrl') || ''),
    processUrl: String(data.get('processUrl') || ''), nextAction: String(data.get('nextAction') || ''),
    tags: String(data.get('tags') || '').split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
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
  const [showFilters, setShowFilters] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<Priority | '全部'>('全部')
  const [directionFilter, setDirectionFilter] = useState('全部')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [sortBy, setSortBy] = useState<'updated' | 'deadline'>('updated')
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadDesktopJobs().then((desktopJobs) => {
      // 桌面端以 SQLite 为唯一数据源：即使返回空数组也要覆盖，否则会停留在旧数据或示例数据上。
      if (cancelled || !desktopJobs) return
      const normalizedJobs = desktopJobs.map(normalizeJobFlow)
      setJobs(normalizedJobs)
      saveJobs(normalizedJobs)
      normalizedJobs.forEach((job) => { void persistDesktopJob(job) })
    })
    loadDesktopDeletedJobs().then((desktopJobs) => {
      if (!cancelled && desktopJobs) setDeletedJobs(desktopJobs)
    })
    loadDesktopProcessEvents().then((desktopEvents) => {
      if (!cancelled && desktopEvents) {
        setEvents(desktopEvents)
        saveProcessEvents(desktopEvents)
      }
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
  const filteredJobs = useMemo(() => jobs.filter((job) => [job.company, job.title, job.direction, job.city, job.nextAction, job.jdContent, ...(job.tags || [])].join(' ').toLowerCase().includes(query.toLowerCase())), [jobs, query])
  const urgentJobs = jobs.filter((job) => job.nextActionDeadline && job.nextActionDeadline <= today && job.status !== '已结束' && job.status !== '已拒绝')
  const activeJobs = jobs.filter((job) => !['已结束', '已拒绝'].includes(job.status))
  const pendingTasks = tasks.filter((task) => !task.completedAt)
  const activeFlow = flowTemplates.find((flow) => flow.id === activeFlowId) ?? flowTemplates[0]
  const selectedFlow = flowTemplates.find((flow) => flow.id === (selectedJob?.flowId || 'flow-general')) ?? activeFlow
  const directions = [...new Set(jobs.map((job) => job.direction).filter(Boolean))]
  const flowJobs = filteredJobs
    .filter((job) => (job.flowId || 'flow-general') === activeFlow?.id)
    .filter((job) => priorityFilter === '全部' || job.priority === priorityFilter)
    .filter((job) => directionFilter === '全部' || job.direction === directionFilter)
    .filter((job) => statusFilter === '全部' || job.status === statusFilter)
    .sort((a, b) => sortBy === 'deadline' ? (a.deadlineAt || '9999-99-99').localeCompare(b.deadlineAt || '9999-99-99') : b.updatedAt.localeCompare(a.updatedAt))

  // changedIds 必须由调用方显式给出：靠日期去"猜"改动对象会在同一天改过多个岗位时写错行。
  function updateJobs(next: JobPosition[], changedIds: string[] = []) {
    setJobs(next)
    saveJobs(next)
    changedIds.forEach((id) => {
      const changedJob = next.find((job) => job.id === id)
      if (changedJob) void persistDesktopJob(changedJob)
    })
  }

  function updateStatus(jobId: string, status: JobStatus) {
    const current = jobs.find((job) => job.id === jobId)
    if (!current || current.status === status) return
    const nextJobs = jobs.map((job) => job.id === jobId ? { ...job, status, updatedAt: today, appliedAt: status === '已投递' && !job.appliedAt ? today : job.appliedAt } : job)
    const nextEvent = { id: crypto.randomUUID(), jobId, fromStatus: current.status, toStatus: status, note: '', eventTime: today }
    const nextEvents = [...events, nextEvent]
    updateJobs(nextJobs, [jobId])
    setEvents(nextEvents)
    saveProcessEvents(nextEvents)
    void persistDesktopProcessEvent(nextEvent)
  }

  function handleDrop(status: JobStatus) {
    if (draggedId) updateStatus(draggedId, status)
    setDraggedId(null)
  }

  function submitNewJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const job = { ...makeJob(form), flowId: String(new FormData(form).get('flowId') || flowTemplates[0]?.id) }
    updateJobs([job, ...jobs], [job.id])
    setShowAdd(false)
    setSelectedId(job.id)
  }

  function updateSelected(patch: Partial<JobPosition>) {
    if (!selectedJob) return
    updateJobs(jobs.map((job) => job.id === selectedJob.id ? { ...job, ...patch, updatedAt: today } : job), [selectedJob.id])
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
    void deleteDesktopJob(job.id).then((ok) => {
      if (isDesktopRuntime() && !ok) window.alert('岗位已从界面移除，但没能同步到本地数据库，重启后会重新出现。请检查程序目录是否可写。')
    })
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
    void restoreDesktopJob(job.id).then(() => persistDesktopJob(restoredJob))
  }

  function purgeJob(job: JobPosition) {
    if (!window.confirm(`彻底删除「${job.company} · ${job.title}」？该岗位将被永久移除，无法恢复。`)) return
    const nextDeletedJobs = deletedJobs.filter((item) => item.id !== job.id)
    setDeletedJobs(nextDeletedJobs)
    saveDeletedJobs(nextDeletedJobs)
    void purgeDesktopJob(job.id).then((ok) => {
      if (isDesktopRuntime() && !ok) window.alert('彻底删除没能同步到本地数据库，请检查程序目录是否可写。')
    })
  }

  function purgeAllDeleted() {
    if (deletedJobs.length === 0) return
    if (!window.confirm(`确定清空回收站吗？${deletedJobs.length} 个岗位将被永久删除，无法恢复。`)) return
    setDeletedJobs([])
    saveDeletedJobs([])
    void purgeDesktopDeletedJobs().then((ok) => {
      if (isDesktopRuntime() && !ok) window.alert('清空回收站没能同步到本地数据库，请检查程序目录是否可写。')
    })
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
    const movedIds = jobs.filter((job) => (job.flowId || 'flow-general') === flowId).map((job) => job.id)
    const nextJobs = jobs.map((job) => (job.flowId || 'flow-general') === flowId ? { ...job, flowId: replacement?.id, updatedAt: today } : job)
    updateJobs(nextJobs, movedIds)
    updateFlowTemplates(flowTemplates.filter((item) => item.id !== flowId))
  }

  function assignJobFlow(jobId: string, flowId: string) {
    updateJobs(jobs.map((job) => job.id === jobId ? { ...job, flowId, updatedAt: today } : job), [jobId])
  }

  function updateTasks(next: Task[]) { setTasks(next); saveTasks(next) }
  function updateCalendarEvents(next: CalendarEvent[]) { setCalendarEvents(next); saveCalendarEvents(next) }
  function updateNotes(next: Note[]) { setNotes(next); saveNotes(next) }

  function importData(data: { jobs: JobPosition[]; deletedJobs: JobPosition[]; tasks: Task[]; events: CalendarEvent[]; notes: Note[]; flows: FlowTemplate[] }) {
    setJobs(data.jobs); setDeletedJobs(data.deletedJobs); setTasks(data.tasks); setCalendarEvents(data.events); setNotes(data.notes); setFlowTemplates(data.flows)
    saveJobs(data.jobs); saveDeletedJobs(data.deletedJobs); saveTasks(data.tasks); saveCalendarEvents(data.events); saveNotes(data.notes); saveFlowTemplates(data.flows)
    // 桌面端必须同步写回 SQLite，否则导入只停留在内存里，重启后回到旧数据。
    const restored = [...data.jobs, ...data.deletedJobs]
    void persistDesktopJobs(restored).then((saved) => {
      if (isDesktopRuntime() && restored.length > 0 && saved === 0) window.alert('导入的数据未能写入本地数据库，请检查程序目录是否可写。')
    })
  }

  const navItems = [
    { label: '总览', icon: LayoutDashboard }, { label: '看板', icon: BriefcaseBusiness },
    { label: '日程', icon: CalendarDays }, { label: '备忘录', icon: FileText },
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">W</div><div><strong>WORREMEMBER</strong></div></div>
        <div className="workspace-label">我的工作台</div>
        <nav>{navItems.map(({ label, icon: Icon }) => <button key={label} className={activeNav === label ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav(label)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === '看板' && <span className="nav-count">{activeJobs.length}</span>}</button>)}</nav>
        <div className="sidebar-divider" />
        <button className={activeNav === '回收站' ? 'nav-item active' : 'nav-item muted'} onClick={() => setActiveNav('回收站')}><Trash2 size={18} strokeWidth={1.8} /><span>回收站</span>{deletedJobs.length > 0 && <span className="nav-count">{deletedJobs.length}</span>}</button>
        <button className="nav-item muted" onClick={() => setActiveNav('设置')}><Settings2 size={18} strokeWidth={1.8} /><span>设置</span></button>
        <div className="sidebar-footer"><div className="sync-dot" /><span>本地数据已保存</span></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div><h1>{activeNav === '看板' ? '投递看板' : activeNav}</h1></div><div className="top-actions"><div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司、岗位或行动" /><kbd>⌘ K</kbd></div><button className={showFilters ? 'icon-button active' : 'icon-button'} title="筛选" onClick={() => setShowFilters((visible) => !visible)}><SlidersHorizontal size={18} /></button><button className="primary-button" onClick={() => setShowAdd(true)}><Plus size={18} /> 新增岗位</button></div></header>
          {showFilters && <FilterPanel priority={priorityFilter} direction={directionFilter} status={statusFilter} sortBy={sortBy} directions={directions} statuses={activeFlow?.statuses || STATUSES} onPriorityChange={setPriorityFilter} onDirectionChange={setDirectionFilter} onStatusChange={setStatusFilter} onSortChange={setSortBy} />}
        <section className="summary-row"><div className="summary-intro"><Sparkles size={18} /><span>今天是 {today.replaceAll('-', '.')}，继续保持推进。</span></div><div className="summary-metrics"><span><b>{activeJobs.length}</b> 个进行中</span><span className={urgentJobs.length ? 'metric-alert' : ''}><b>{urgentJobs.length}</b> 个待处理</span><span><b>{jobs.filter((job) => job.status === 'Offer').length}</b> 个 Offer</span></div></section>
        {activeNav === '总览' ? <OverviewView jobs={jobs} tasks={tasks} events={calendarEvents} notes={notes} onCompleteTask={(task) => updateTasks(tasks.map((item) => item.id === task.id ? { ...item, completedAt: today, updatedAt: today } : item))} /> : activeNav === '日程' ? <CalendarView events={calendarEvents} jobs={jobs} onChange={updateCalendarEvents} /> : activeNav === '备忘录' ? <NotesView notes={notes} jobs={jobs} onChange={updateNotes} /> : activeNav === '回收站' ? <TrashView jobs={deletedJobs} onRestore={restoreJob} onPurge={purgeJob} onPurgeAll={purgeAllDeleted} /> : activeNav === '设置' ? <FlowSettings flows={flowTemplates} onChange={updateFlowTemplates} onCreate={createFlow} onDelete={deleteFlow} onAssign={assignJobFlow} onImport={importData} jobs={jobs} deletedJobs={deletedJobs} tasks={tasks} events={calendarEvents} notes={notes} /> : <>{jobs.length === 0 && <BoardEmpty onCreate={() => setShowAdd(true)} />}<div className="board-toolbar"><div className="view-tabs">{flowTemplates.map((flow) => <button key={flow.id} className={activeFlow?.id === flow.id ? 'view-tab active' : 'view-tab'} onClick={() => setActiveFlowId(flow.id)}>{flow.name} <span>{jobs.filter((job) => (job.flowId || 'flow-general') === flow.id).length}</span></button>)}<button className="view-tab">高优先级 <span>{flowJobs.filter((job) => job.priority === '高').length}</span></button><button className="view-tab">本周更新</button></div><button className="sort-button">最近更新 <ChevronDown size={15} /></button></div><section className="board">{(activeFlow?.statuses || STATUSES).map((status) => <div className="column" key={status} onDragOver={(event) => event.preventDefault()} onDrop={() => handleDrop(status)}><div className="column-head"><div className={`status-dot ${getStatusMeta(status).tone}`} /><h2>{status}</h2><span className="column-count">{flowJobs.filter((job) => job.status === status).length}</span><button className="column-more">···</button></div><div className="column-cards">{flowJobs.filter((job) => job.status === status).map((job) => <JobCard key={job.id} job={job} onClick={() => setSelectedId(job.id)} onDragStart={() => setDraggedId(job.id)} />)}<button className="add-card" onClick={() => setShowAdd(true)}><Plus size={15} /> 添加岗位</button></div></div>)}</section></>}
      </main>
      {selectedJob && <DetailDrawer job={selectedJob} events={events.filter((event) => event.jobId === selectedJob.id)} statuses={selectedFlow?.statuses || STATUSES} onClose={() => setSelectedId(null)} onUpdate={updateSelected} onStatusChange={(status) => updateStatus(selectedJob.id, status)} onDelete={() => deleteJob(selectedJob)} />}
      {selectedJob && <TagsQuickEditor tags={selectedJob.tags || []} onChange={(tags) => updateSelected({ tags })} />}
      {showAdd && <AddJobModal onClose={() => setShowAdd(false)} onSubmit={submitNewJob} />}
    </div>
  )
}

function BoardEmpty({ onCreate }: { onCreate: () => void }) {
  return <div className="board-empty"><BriefcaseBusiness size={22} /><div><strong>还没有岗位记录</strong><span>添加第一个岗位，开始跟踪它的投递进度。</span></div><button className="primary-button" onClick={onCreate}><Plus size={16} /> 新增岗位</button></div>
}

function JobCard({ job, onClick, onDragStart }: { job: JobPosition; onClick: () => void; onDragStart: () => void }) {
  const missing = !job.jobUrl || !job.processUrl
  return <article className="job-card" draggable onDragStart={onDragStart} onClick={onClick}><div className="card-top"><span className={`priority priority-${job.priority}`}>{job.priority}优先</span>{missing && <span className="missing-info"><CircleAlert size={13} />待补充</span>}<button className="card-delete" onClick={(event) => { event.stopPropagation(); window.dispatchEvent(new CustomEvent('worremember:delete-job', { detail: job.id })) }} title="删除岗位"><Trash2 size={14} /></button><button className="card-arrow"><ArrowUpRight size={16} /></button></div><h3>{job.title}</h3><div className="company-line"><span className="company-avatar">{job.company.slice(0, 1)}</span><span>{job.company}</span></div><div className="card-meta"><span>{job.city || '地点待定'}</span><span>{job.direction}</span></div>{job.tags && job.tags.length > 0 && <div className="card-tags">{job.tags.slice(0, 3).map((tag) => <span className="card-tag" key={tag}>{tag}</span>)}</div>}{job.nextAction && <div className="next-action"><ClipboardList size={14} /><span>{job.nextAction}</span>{job.nextActionDeadline && <time>{job.nextActionDeadline.slice(5).replace('-', '/')}</time>}</div>}</article>
}

function DetailDrawer({ job, events, statuses, onClose, onUpdate, onStatusChange, onDelete }: { job: JobPosition; events: ProcessEvent[]; statuses: string[]; onClose: () => void; onUpdate: (patch: Partial<JobPosition>) => void; onStatusChange: (status: JobStatus) => void; onDelete: () => void }) {
  // 必须渲染岗位所属流程的阶段；用全局默认阶段会让"技术一面"这类阶段无处可选，改完卡片就从看板消失。
  const stageOptions = statuses.includes(job.status) ? statuses : [...statuses, job.status]
  return <div className="drawer-backdrop" onClick={onClose}><aside className="detail-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><span>岗位详情</span><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="drawer-body"><div className="detail-title"><div className="large-avatar">{job.company.slice(0, 1)}</div><div><span>{job.company}</span><h2>{job.title}</h2><p>{job.city || '地点待定'} · {job.employmentType} · {job.direction}</p></div></div><div className="detail-status"><label>当前阶段</label><select value={job.status} onChange={(event) => onStatusChange(event.target.value as JobStatus)}>{stageOptions.map((status) => <option key={status}>{status}</option>)}</select></div><div className="detail-grid"><DetailField label="优先级"><select value={job.priority} onChange={(event) => onUpdate({ priority: event.target.value as Priority })}><option>高</option><option>中</option><option>低</option></select></DetailField><DetailField label="投递日期"><input type="date" value={job.appliedAt || ''} onChange={(event) => onUpdate({ appliedAt: event.target.value })} /></DetailField><DetailField label="截止日期"><input type="date" value={job.deadlineAt || ''} onChange={(event) => onUpdate({ deadlineAt: event.target.value })} /></DetailField><DetailField label="下一步截止"><input type="date" value={job.nextActionDeadline || ''} onChange={(event) => onUpdate({ nextActionDeadline: event.target.value })} /></DetailField></div><div className="detail-section"><div className="section-title"><h3>下一步行动</h3><span>行动先于焦虑</span></div><input className="wide-input" value={job.nextAction} onChange={(event) => onUpdate({ nextAction: event.target.value })} placeholder="例如：准备笔试、跟进 HR" /></div><div className="detail-section"><div className="section-title"><h3>相关链接</h3><span>{job.jobUrl && job.processUrl ? '信息完整' : '还有信息待补充'}</span></div><LinkRow label="岗位链接" url={job.jobUrl} onChange={(url) => onUpdate({ jobUrl: url })} /><LinkRow label="流程链接" url={job.processUrl} onChange={(url) => onUpdate({ processUrl: url })} /></div><div className="detail-section"><div className="section-title"><h3>流程历史</h3><span>{events.length} 次变更</span></div><div className="timeline">{events.length ? events.slice().reverse().map((event) => <div className="timeline-item" key={event.id}><div className="timeline-dot" /><div><strong>{event.fromStatus || '新建'} → {event.toStatus}</strong><time>{event.eventTime}</time></div></div>) : <div className="empty-timeline">状态变更会记录在这里</div>}</div></div><div className="detail-section"><div className="section-title"><h3>JD 摘要</h3><span>Markdown 备忘录将在 V0.2 加入</span></div><textarea className="jd-input" value={job.jdContent} onChange={(event) => onUpdate({ jdContent: event.target.value })} placeholder="粘贴岗位 JD，方便后续搜索和准备..." /></div></div><div className="drawer-footer"><button className="secondary-button"><ExternalLink size={16} /> 打开岗位链接</button><button className="primary-button" onClick={onClose}><Check size={16} /> 完成编辑</button></div></aside></div>
}

function FilterPanel({ priority, direction, status, sortBy, directions, statuses, onPriorityChange, onDirectionChange, onStatusChange, onSortChange }: { priority: Priority | '全部'; direction: string; status: string; sortBy: 'updated' | 'deadline'; directions: string[]; statuses: string[]; onPriorityChange: (value: Priority | '全部') => void; onDirectionChange: (value: string) => void; onStatusChange: (value: string) => void; onSortChange: (value: 'updated' | 'deadline') => void }) {
  return <div className="filter-panel"><label>优先级<select value={priority} onChange={(event) => onPriorityChange(event.target.value as Priority | '全部')}><option>全部</option><option>高</option><option>中</option><option>低</option></select></label><label>方向<select value={direction} onChange={(event) => onDirectionChange(event.target.value)}><option>全部</option>{directions.map((item) => <option key={item}>{item}</option>)}</select></label><label>阶段<select value={status} onChange={(event) => onStatusChange(event.target.value)}><option>全部</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label><label>排序<select value={sortBy} onChange={(event) => onSortChange(event.target.value as 'updated' | 'deadline')}><option value="updated">最近更新</option><option value="deadline">截止日期</option></select></label></div>
}

function TagsQuickEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [value, setValue] = useState('')
  function addTag(event: FormEvent) {
    event.preventDefault()
    const next = value.trim()
    if (!next || tags.includes(next)) return
    onChange([...tags, next])
    setValue('')
  }
  return <div className="tags-editor"><div className="tags-editor-title">岗位标签</div><div className="tag-list">{tags.length === 0 ? <span className="tag-empty">暂无标签</span> : tags.map((tag) => <button key={tag} className="tag-chip" onClick={() => onChange(tags.filter((item) => item !== tag))}>{tag}<X size={11} /></button>)}</div><form onSubmit={addTag}><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="输入标签并回车" /><button type="submit" className="secondary-button"><Plus size={14} /> 添加</button></form></div>
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
  const [editingId, setEditingId] = useState<string | null>(null)
  function resetForm() {
    setTitle(''); setType('面试'); setStartAt(''); setJobId(''); setEditingId(null)
  }
  function submitEvent(event: FormEvent) {
    event.preventDefault()
    if (!title || !startAt) return
    if (editingId) {
      onChange(events.map((item) => item.id === editingId ? { ...item, title, type, startAt, jobId: jobId || undefined, updatedAt: today } : item))
    } else {
      onChange([{ id: crypto.randomUUID(), title, type, startAt, jobId: jobId || undefined, location: '', note: '', createdAt: today, updatedAt: today }, ...events])
    }
    resetForm()
  }
  function startEdit(item: CalendarEvent) {
    setEditingId(item.id); setTitle(item.title); setType(item.type); setStartAt(item.startAt); setJobId(item.jobId || '')
  }
  return (
    <section className="page-view calendar-view">
      <form className="inline-form" onSubmit={submitEvent}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="事件名称，例如：某某科技一面" required />
        <select value={type} onChange={(event) => setType(event.target.value)}><option>面试</option><option>笔试</option><option>投递截止</option><option>准备任务</option><option>自定义</option></select>
        <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required />
        <select value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">不关联岗位</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.title}</option>)}</select>
        <button className="primary-button" type="submit"><Plus size={16} /> {editingId ? '保存修改' : '添加日程'}</button>
        {editingId && <button className="secondary-button" type="button" onClick={resetForm}>取消编辑</button>}
      </form>
      <div className="event-list">{events.length === 0 ? <div className="panel-empty">还没有日程安排</div> : events.slice().sort((a, b) => a.startAt.localeCompare(b.startAt)).map((event) => <article className={editingId === event.id ? 'event-row editing' : 'event-row'} key={event.id}><div className="event-date"><strong>{event.startAt.slice(5, 10).replace('-', '/')}</strong><span>{event.startAt.slice(11, 16)}</span></div><div><strong>{event.title}</strong><small>{event.type}{event.jobId ? ` · ${jobs.find((job) => job.id === event.jobId)?.company || ''}` : ''}</small></div><div className="row-actions"><button className="icon-button" onClick={() => startEdit(event)} title="编辑日程"><Pencil size={15} /></button><button className="icon-button" onClick={() => { if (editingId === event.id) resetForm(); onChange(events.filter((item) => item.id !== event.id)) }} title="删除日程"><Trash2 size={15} /></button></div></article>)}</div>
    </section>
  )
}

function NotesView({ notes, jobs, onChange }: { notes: Note[]; jobs: JobPosition[]; onChange: (notes: Note[]) => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [jobId, setJobId] = useState('')
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const openNotes = notes.filter((note) => !note.completed).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
  const doneNotes = notes.filter((note) => note.completed).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  function addNote(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    const note: Note = { id: crypto.randomUUID(), title: title.trim(), content, jobId: jobId || undefined, tags: [], pinned: false, completed: false, createdAt: today, updatedAt: today }
    onChange([note, ...notes]); setTitle(''); setContent(''); setJobId('')
  }
  function togglePinned(note: Note) { onChange(notes.map((item) => item.id === note.id ? { ...item, pinned: !item.pinned, updatedAt: today } : item)) }
  function toggleCompleted(note: Note) { onChange(notes.map((item) => item.id === note.id ? { ...item, completed: !item.completed, updatedAt: today } : item)) }
  function removeNote(note: Note) { if (editingNote?.id === note.id) setEditingNote(null); onChange(notes.filter((item) => item.id !== note.id)) }
  function saveNote(patch: Partial<Note>) {
    if (!editingNote) return
    onChange(notes.map((item) => item.id === editingNote.id ? { ...item, ...patch, updatedAt: today } : item))
    setEditingNote(null)
  }
  return (
    <section className="page-view notes-view">
      <form className="note-form" onSubmit={addNote}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="备忘录标题" required />
        <select value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">不关联岗位</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.title}</option>)}</select>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="写下岗位分析、面试问题或复盘内容..." rows={4} />
        <button className="primary-button" type="submit"><Plus size={16} /> 新建备忘录</button>
      </form>
      <div className="note-board">
        <div className="note-section">
          <div className="note-section-title"><h3>进行中</h3><span>{openNotes.length} 篇</span></div>
          {openNotes.length === 0 ? <div className="panel-empty">还没有进行中的笔记</div> : <div className="note-grid">{openNotes.map((note) => <NoteTile key={note.id} note={note} company={jobs.find((job) => job.id === note.jobId)?.company} onToggle={() => toggleCompleted(note)} onPin={() => togglePinned(note)} onDelete={() => removeNote(note)} onEdit={() => setEditingNote(note)} />)}</div>}
        </div>
        <div className="note-section">
          <div className="note-section-title"><h3>已完成</h3><span>{doneNotes.length} 篇</span></div>
          {doneNotes.length === 0 ? <div className="panel-empty">标记完成后，笔记会自动移到这里</div> : <div className="note-grid">{doneNotes.map((note) => <NoteTile key={note.id} note={note} company={jobs.find((job) => job.id === note.jobId)?.company} onToggle={() => toggleCompleted(note)} onPin={() => togglePinned(note)} onDelete={() => removeNote(note)} onEdit={() => setEditingNote(note)} />)}</div>}
        </div>
      </div>
      {editingNote && <NoteEditorModal note={editingNote} jobs={jobs} onClose={() => setEditingNote(null)} onSave={saveNote} />}
    </section>
  )
}

function NoteTile({ note, company, onEdit, onToggle, onPin, onDelete }: { note: Note; company?: string; onEdit: () => void; onToggle: () => void; onPin: () => void; onDelete: () => void }) {
  const className = ['note-tile', note.completed ? 'done' : '', note.pinned ? 'pinned' : ''].filter(Boolean).join(' ')
  function run(action: () => void) {
    return (event: MouseEvent) => { event.stopPropagation(); action() }
  }
  return (
    <article className={className} onClick={onEdit} title="点击编辑笔记">
      <h4>{note.title}</h4>
      {note.content && <p>{note.content}</p>}
      <small>{company || '独立笔记'} · {note.updatedAt}</small>
      <div className="note-tile-actions">
        <button className="icon-button" onClick={run(onToggle)} title={note.completed ? '标记为未完成' : '标记为完成'}>{note.completed ? <RotateCcw size={13} /> : <Check size={13} />}</button>
        <button className={note.pinned ? 'icon-button active' : 'icon-button'} onClick={run(onPin)} title={note.pinned ? '取消置顶' : '置顶'}><Pin size={13} /></button>
        <button className="icon-button" onClick={run(onDelete)} title="删除备忘录"><Trash2 size={13} /></button>
      </div>
    </article>
  )
}

function NoteEditorModal({ note, jobs, onClose, onSave }: { note: Note; jobs: JobPosition[]; onClose: () => void; onSave: (patch: Partial<Note>) => void }) {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [jobId, setJobId] = useState(note.jobId || '')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    onSave({ title: title.trim(), content, jobId: jobId || undefined })
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <div><span className="eyebrow">编辑备忘录</span><h2>{note.title}</h2></div>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="form-grid">
          <label className="form-wide"><span>标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
          <label className="form-wide"><span>关联岗位</span><select value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">不关联岗位</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.company} · {job.title}</option>)}</select></label>
          <label className="form-wide"><span>内容</span><textarea value={content} onChange={(event) => setContent(event.target.value)} rows={9} placeholder="写下岗位分析、面试问题或复盘内容..." /></label>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>取消</button>
          <button type="submit" className="primary-button"><Check size={16} /> 保存修改</button>
        </div>
      </form>
    </div>
  )
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

function TrashView({ jobs, onRestore, onPurge, onPurgeAll }: { jobs: JobPosition[]; onRestore: (job: JobPosition) => void; onPurge: (job: JobPosition) => void; onPurgeAll: () => void }) {
  return (
    <section className="trash-view">
      <div className="view-count">{jobs.length} 个岗位</div>
      {jobs.length === 0 ? <div className="empty-state"><Trash2 size={24} /><p>回收站是空的</p></div> : (
        <>
          <div className="trash-toolbar">
            <span>回收站里的岗位不会被搜索和统计，恢复后回到原流程。</span>
            <button className="secondary-button btn-danger" onClick={onPurgeAll}><Trash2 size={15} /> 清空回收站</button>
          </div>
          <div className="trash-list">{jobs.map((job) => <article className="trash-item" key={job.id}><div><strong>{job.title}</strong><span>{job.company} · 原阶段：{job.status}</span></div><div className="row-actions"><button className="secondary-button" onClick={() => onRestore(job)}><RotateCcw size={15} /> 恢复</button><button className="secondary-button btn-danger" onClick={() => onPurge(job)} title="彻底删除"><Trash2 size={15} /> 彻底删除</button></div></article>)}</div>
        </>
      )}
    </section>
  )
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="detail-field"><span>{label}</span>{children}</label> }
function LinkRow({ label, url, onChange }: { label: string; url: string; onChange: (value: string) => void }) { return <label className="link-row"><span>{label}</span><input value={url} onChange={(event) => onChange(event.target.value)} placeholder="粘贴链接" />{url && <a href={url} target="_blank" rel="noreferrer" title="在浏览器打开"><ExternalLink size={15} /></a>}</label> }
function AddJobModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <div className="modal-backdrop" onClick={onClose}><form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={onSubmit}><div className="modal-head"><div><span className="eyebrow">新建记录</span><h2>添加一个新岗位</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="form-grid"><label><span>公司名称 *</span><input name="company" required placeholder="例如：某某科技" /></label><label><span>岗位名称 *</span><input name="title" required placeholder="例如：产品经理（校招）" /></label><label><span>岗位方向</span><input name="direction" placeholder="产品、开发、运营..." /></label><label><span>标签</span><input name="tags" placeholder="重点、内推、待跟进，用逗号分隔" /></label><label><span>工作城市</span><input name="city" placeholder="例如：上海" /></label><label><span>工作类型</span><select name="employmentType"><option>校招</option><option>全职</option><option>实习</option></select></label><label><span>优先级</span><select name="priority"><option>高</option><option selected>中</option><option>低</option></select></label><label><span>岗位来源</span><input name="source" placeholder="官网、内推、招聘平台..." /></label><label><span>截止日期</span><input name="deadlineAt" type="date" /></label><label className="form-wide"><span>岗位链接</span><input name="jobUrl" type="url" placeholder="https://" /></label><label className="form-wide"><span>下一步行动</span><input name="nextAction" placeholder="例如：准备笔试" /></label><label><span>行动截止</span><input name="nextActionDeadline" type="date" /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button"><Plus size={17} /> 创建岗位</button></div></form></div> }

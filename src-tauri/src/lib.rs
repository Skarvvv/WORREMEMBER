use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::{Manager, State};
use std::sync::Mutex;

struct Database(Mutex<Connection>);

fn startup_log(message: &str) {
    if let Ok(executable) = env::current_exe() {
        if let Some(directory) = executable.parent() {
            let directory = directory.join("data");
            let _ = fs::create_dir_all(&directory);
            let _ = fs::write(directory.join("startup.log"), format!("{message}\n"));
        }
    }
}

// serde(default)：前端漏传任何字段时回退默认值，而不是让整次写入因 missing field 失败并静默丢数据。
#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(default)]
struct JobRecord {
    id: String,
    company: String,
    title: String,
    direction: String,
    city: String,
    employment_type: String,
    source: String,
    status: String,
    priority: String,
    job_url: String,
    process_url: String,
    applied_at: Option<String>,
    deadline_at: Option<String>,
    next_action: String,
    next_action_deadline: Option<String>,
    jd_content: String,
    created_at: String,
    updated_at: String,
    deleted_at: Option<String>,
    flow_id: Option<String>,
    tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(default)]
struct ProcessEventRecord {
    id: String,
    job_id: String,
    from_status: Option<String>,
    to_status: String,
    note: String,
    event_time: String,
}

fn database_path() -> Result<PathBuf, String> {
    let executable = env::current_exe().map_err(|error| error.to_string())?;
    let directory = executable
        .parent()
        .ok_or_else(|| "无法确定程序所在目录".to_string())?
        .join("data");
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("data.sqlite"))
}

fn initialize_database(connection: &Connection) -> Result<(), rusqlite::Error> {
    connection.execute_batch(
        "PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY NOT NULL,
          company TEXT NOT NULL,
          title TEXT NOT NULL,
          direction TEXT NOT NULL DEFAULT '',
          city TEXT NOT NULL DEFAULT '',
          employment_type TEXT NOT NULL DEFAULT '校招',
          source TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT '了解中',
          priority TEXT NOT NULL DEFAULT '中',
          job_url TEXT NOT NULL DEFAULT '',
          process_url TEXT NOT NULL DEFAULT '',
          applied_at TEXT,
          deadline_at TEXT,
          next_action TEXT NOT NULL DEFAULT '',
          next_action_deadline TEXT,
          jd_content TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
          ,deleted_at TEXT,
          flow_id TEXT NOT NULL DEFAULT 'flow-general',
          tags TEXT NOT NULL DEFAULT '[]'
        );
        CREATE TABLE IF NOT EXISTS process_events (
          id TEXT PRIMARY KEY NOT NULL,
          job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
          from_status TEXT,
          to_status TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          event_time TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
        CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at);
        CREATE INDEX IF NOT EXISTS idx_process_events_job_id ON process_events(job_id);",
    )
    .and_then(|_| connection.execute("ALTER TABLE jobs ADD COLUMN deleted_at TEXT", []))
    .or_else(|error| if error.to_string().contains("duplicate column name") { Ok(0) } else { Err(error) })?;
    connection.execute("ALTER TABLE jobs ADD COLUMN flow_id TEXT NOT NULL DEFAULT 'flow-general'", []).or_else(|error| if error.to_string().contains("duplicate column name") { Ok(0) } else { Err(error) })?;
    connection.execute("ALTER TABLE jobs ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'", []).or_else(|error| if error.to_string().contains("duplicate column name") { Ok(0) } else { Err(error) })?;
    connection.execute_batch(
        "INSERT OR IGNORE INTO jobs (id, company, title, direction, city, employment_type, source, status, priority, job_url, process_url, applied_at, next_action, jd_content, created_at, updated_at) VALUES
        ('seed-4', '星河数据', '数据分析师', '数据', '深圳', '校招', '官网', '已投递', '中', 'https://example.com/job/4', '', '2026-09-04', '关注笔试通知', '', '2026-09-04', '2026-09-05'),
        ('seed-5', '蓝岸科技', '后端开发工程师', '开发', '上海', '全职', '内推', '已投递', '高', 'https://example.com/job/5', '', '2026-09-05', '准备技术面', '', '2026-09-05', '2026-09-05');",
    )?;
    Ok(())
}

#[tauri::command]
fn list_jobs(database: State<'_, Database>) -> Result<Vec<JobRecord>, String> {
    let connection = database.0.lock().map_err(|_| "数据库锁定失败".to_string())?;
    let mut statement = connection.prepare("SELECT id, company, title, direction, city, employment_type, source, status, priority, job_url, process_url, applied_at, deadline_at, next_action, next_action_deadline, jd_content, created_at, updated_at, deleted_at, flow_id, tags FROM jobs WHERE deleted_at IS NULL ORDER BY updated_at DESC").map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| Ok(JobRecord {
        id: row.get(0)?, company: row.get(1)?, title: row.get(2)?, direction: row.get(3)?, city: row.get(4)?, employment_type: row.get(5)?, source: row.get(6)?, status: row.get(7)?, priority: row.get(8)?, job_url: row.get(9)?, process_url: row.get(10)?, applied_at: row.get(11)?, deadline_at: row.get(12)?, next_action: row.get(13)?, next_action_deadline: row.get(14)?, jd_content: row.get(15)?, created_at: row.get(16)?, updated_at: row.get(17)?, deleted_at: row.get(18)?, flow_id: row.get(19)?, tags: serde_json::from_str(&row.get::<_, String>(20)?).unwrap_or_default(),
    })).map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn list_deleted_jobs(database: State<'_, Database>) -> Result<Vec<JobRecord>, String> {
    let connection = database.0.lock().map_err(|_| "数据库锁定失败".to_string())?;
    let mut statement = connection.prepare("SELECT id, company, title, direction, city, employment_type, source, status, priority, job_url, process_url, applied_at, deadline_at, next_action, next_action_deadline, jd_content, created_at, updated_at, deleted_at, flow_id, tags FROM jobs WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| Ok(JobRecord {
        id: row.get(0)?, company: row.get(1)?, title: row.get(2)?, direction: row.get(3)?, city: row.get(4)?, employment_type: row.get(5)?, source: row.get(6)?, status: row.get(7)?, priority: row.get(8)?, job_url: row.get(9)?, process_url: row.get(10)?, applied_at: row.get(11)?, deadline_at: row.get(12)?, next_action: row.get(13)?, next_action_deadline: row.get(14)?, jd_content: row.get(15)?, created_at: row.get(16)?, updated_at: row.get(17)?, deleted_at: row.get(18)?, flow_id: row.get(19)?, tags: serde_json::from_str(&row.get::<_, String>(20)?).unwrap_or_default(),
    })).map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn upsert_job(database: State<'_, Database>, job: JobRecord) -> Result<(), String> {
    let connection = database.0.lock().map_err(|_| "数据库锁定失败".to_string())?;
    connection.execute("INSERT INTO jobs (id, company, title, direction, city, employment_type, source, status, priority, job_url, process_url, applied_at, deadline_at, next_action, next_action_deadline, jd_content, created_at, updated_at, deleted_at, flow_id, tags) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21) ON CONFLICT(id) DO UPDATE SET company=excluded.company, title=excluded.title, direction=excluded.direction, city=excluded.city, employment_type=excluded.employment_type, source=excluded.source, status=excluded.status, priority=excluded.priority, job_url=excluded.job_url, process_url=excluded.process_url, applied_at=excluded.applied_at, deadline_at=excluded.deadline_at, next_action=excluded.next_action, next_action_deadline=excluded.next_action_deadline, jd_content=excluded.jd_content, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, flow_id=excluded.flow_id, tags=excluded.tags", params![job.id, job.company, job.title, job.direction, job.city, job.employment_type, job.source, job.status, job.priority, job.job_url, job.process_url, job.applied_at, job.deadline_at, job.next_action, job.next_action_deadline, job.jd_content, job.created_at, job.updated_at, job.deleted_at, job.flow_id, serde_json::to_string(&job.tags).map_err(|error| error.to_string())?]).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_job(database: State<'_, Database>, job_id: String) -> Result<(), String> {
    let connection = database.0.lock().map_err(|_| "数据库锁定失败".to_string())?;
    connection.execute("UPDATE jobs SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1", params![job_id]).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn restore_job(database: State<'_, Database>, job_id: String) -> Result<(), String> {
    let connection = database.0.lock().map_err(|_| "数据库锁定失败".to_string())?;
    connection.execute("UPDATE jobs SET deleted_at = NULL WHERE id = ?1", params![job_id]).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_process_events(database: State<'_, Database>) -> Result<Vec<ProcessEventRecord>, String> {
    let connection = database.0.lock().map_err(|_| "数据库锁定失败".to_string())?;
    let mut statement = connection
        .prepare("SELECT id, job_id, from_status, to_status, note, event_time FROM process_events ORDER BY event_time ASC")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(ProcessEventRecord {
                id: row.get(0)?,
                job_id: row.get(1)?,
                from_status: row.get(2)?,
                to_status: row.get(3)?,
                note: row.get(4)?,
                event_time: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn upsert_process_event(database: State<'_, Database>, event: ProcessEventRecord) -> Result<(), String> {
    let connection = database.0.lock().map_err(|_| "数据库锁定失败".to_string())?;
    connection
        .execute(
            "INSERT INTO process_events (id, job_id, from_status, to_status, note, event_time) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET from_status=excluded.from_status, to_status=excluded.to_status, note=excluded.note, event_time=excluded.event_time",
            params![event.id, event.job_id, event.from_status, event.to_status, event.note, event.event_time],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn backup_database() -> Result<String, String> {
    let source = database_path()?;
    let backups = source
        .parent()
        .ok_or_else(|| "无法确定数据目录".to_string())?
        .join("backups");
    fs::create_dir_all(&backups).map_err(|error| error.to_string())?;
    let target = backups.join(format!("backup-{}.sqlite", chrono_like_timestamp()));
    fs::copy(source, &target).map_err(|error| error.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // 回归保护：前端曾经漏传 tags，导致整次写入因 missing field 失败且被静默吞掉，表现为"重启后数据回到旧状态"。
    #[test]
    fn job_record_without_tags_still_deserializes() {
        let payload = r#"{"id":"seed-1","company":"远景智能","title":"产品经理","employment_type":"校招","status":"已投递","flow_id":"flow-general"}"#;
        let record: JobRecord = serde_json::from_str(payload).unwrap();
        assert_eq!(record.id, "seed-1");
        assert!(record.tags.is_empty());
    }

    #[test]
    fn process_event_record_without_optional_fields_still_deserializes() {
        let payload = r#"{"id":"evt-1","job_id":"seed-1","to_status":"已投递"}"#;
        let record: ProcessEventRecord = serde_json::from_str(payload).unwrap();
        assert_eq!(record.job_id, "seed-1");
        assert!(record.from_status.is_none());
    }
}

fn chrono_like_timestamp() -> String {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|duration| duration.as_secs().to_string()).unwrap_or_else(|_| "unknown".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            startup_log("setup:start");
            let path = database_path()?;
            startup_log(&format!("setup:database_path={}", path.display()));
            let connection = Connection::open(path)?;
            startup_log("setup:connection_opened");
            initialize_database(&connection)?;
            startup_log("setup:database_initialized");
            app.manage(Database(Mutex::new(connection)));
            startup_log("setup:complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_jobs, list_deleted_jobs, upsert_job, delete_job, restore_job, list_process_events, upsert_process_event, backup_database])
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| {
            startup_log(&format!("run:error={error}"));
            panic!("error while running WORREMEMBER: {error}");
        });
}

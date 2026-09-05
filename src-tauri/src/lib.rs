use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};
use std::sync::Mutex;

struct Database(Mutex<Connection>);

#[derive(Debug, Serialize, Deserialize)]
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
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
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
}

#[tauri::command]
fn list_jobs(database: State<'_, Database>) -> Result<Vec<JobRecord>, String> {
    let connection = database.0.lock().map_err(|_| "数据库锁定失败".to_string())?;
    let mut statement = connection.prepare("SELECT id, company, title, direction, city, employment_type, source, status, priority, job_url, process_url, applied_at, deadline_at, next_action, next_action_deadline, jd_content, created_at, updated_at FROM jobs ORDER BY updated_at DESC").map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| Ok(JobRecord {
        id: row.get(0)?, company: row.get(1)?, title: row.get(2)?, direction: row.get(3)?, city: row.get(4)?, employment_type: row.get(5)?, source: row.get(6)?, status: row.get(7)?, priority: row.get(8)?, job_url: row.get(9)?, process_url: row.get(10)?, applied_at: row.get(11)?, deadline_at: row.get(12)?, next_action: row.get(13)?, next_action_deadline: row.get(14)?, jd_content: row.get(15)?, created_at: row.get(16)?, updated_at: row.get(17)?,
    })).map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn upsert_job(database: State<'_, Database>, job: JobRecord) -> Result<(), String> {
    let connection = database.0.lock().map_err(|_| "数据库锁定失败".to_string())?;
    connection.execute("INSERT INTO jobs (id, company, title, direction, city, employment_type, source, status, priority, job_url, process_url, applied_at, deadline_at, next_action, next_action_deadline, jd_content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18) ON CONFLICT(id) DO UPDATE SET company=excluded.company, title=excluded.title, direction=excluded.direction, city=excluded.city, employment_type=excluded.employment_type, source=excluded.source, status=excluded.status, priority=excluded.priority, job_url=excluded.job_url, process_url=excluded.process_url, applied_at=excluded.applied_at, deadline_at=excluded.deadline_at, next_action=excluded.next_action, next_action_deadline=excluded.next_action_deadline, jd_content=excluded.jd_content, updated_at=excluded.updated_at", params![job.id, job.company, job.title, job.direction, job.city, job.employment_type, job.source, job.status, job.priority, job.job_url, job.process_url, job.applied_at, job.deadline_at, job.next_action, job.next_action_deadline, job.jd_content, job.created_at, job.updated_at]).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn backup_database(app: AppHandle) -> Result<String, String> {
    let source = database_path(&app)?;
    let backups = app.path().app_data_dir().map_err(|error| error.to_string())?.join("backups");
    fs::create_dir_all(&backups).map_err(|error| error.to_string())?;
    let target = backups.join(format!("backup-{}.sqlite", chrono_like_timestamp()));
    fs::copy(source, &target).map_err(|error| error.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

fn chrono_like_timestamp() -> String {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|duration| duration.as_secs().to_string()).unwrap_or_else(|_| "unknown".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let path = database_path(app.handle())?;
            let connection = Connection::open(path)?;
            initialize_database(&connection)?;
            app.manage(Database(Mutex::new(connection)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_jobs, upsert_job, backup_database])
        .run(tauri::generate_context!())
        .expect("error while running WORREMEMBER");
}

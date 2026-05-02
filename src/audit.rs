use serde::{Deserialize, Serialize};
use std::fs::{OpenOptions, File};
use std::io::{Write, BufReader, BufRead};
use std::path::Path;
use chrono::{DateTime, Utc};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditEntry {
    pub timestamp: DateTime<Utc>,
    pub action: String,
    pub details: String,
    pub ip_address: Option<String>,
}

pub struct AuditLogger {
    log_path: String,
    log_path_old: String,
    file_mutex: Mutex<()>,
}

const MAX_LOG_SIZE: u64 = 10 * 1024 * 1024; // 10MB

impl AuditLogger {
    pub fn new(index_path: &str) -> Self {
        let base_path = Path::new(index_path)
            .parent()
            .unwrap_or_else(|| Path::new("."));
        
        let log_path = base_path.join("audit.log").to_string_lossy().to_string();
        let log_path_old = base_path.join("audit.log.old").to_string_lossy().to_string();

        Self {
            log_path,
            log_path_old,
            file_mutex: Mutex::new(()),
        }
    }

    pub fn log(&self, action: &str, details: &str, ip: Option<String>) {
        let entry = AuditEntry {
            timestamp: Utc::now(),
            action: action.to_string(),
            details: details.to_string(),
            ip_address: ip,
        };

        if let Ok(json) = serde_json::to_string(&entry) {
            let _lock = self.file_mutex.lock().unwrap();
            
            // Check for rotation
            if let Ok(metadata) = std::fs::metadata(&self.log_path) {
                if metadata.len() >= MAX_LOG_SIZE {
                    let _ = std::fs::rename(&self.log_path, &self.log_path_old);
                }
            }

            if let Ok(mut file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&self.log_path)
            {
                let _ = writeln!(file, "{}", json);
            }
        }
    }

    pub fn get_log_path(&self) -> String {
        self.log_path.clone()
    }

    pub fn get_last_entries(&self, count: usize) -> Vec<AuditEntry> {
        let _lock = self.file_mutex.lock().unwrap();
        let file = match File::open(&self.log_path) {
            Ok(f) => f,
            Err(_) => return Vec::new(),
        };

        let reader = BufReader::new(file);
        let mut entries: Vec<AuditEntry> = reader
            .lines()
            .filter_map(|line| line.ok())
            .filter_map(|line| serde_json::from_str(&line).ok())
            .collect();

        entries.reverse();
        entries.into_iter().take(count).collect()
    }
}

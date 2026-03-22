mod card;
mod parser;
mod index;
mod csv_parser;

use axum::{
    extract::{Multipart, Query, Path, State, DefaultBodyLimit},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, RwLock};
use tower_http::services::ServeDir;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use rayon::prelude::*;
use crate::parser::CardParser;
use crate::csv_parser::OpenCaselistParser;
use crate::index::TantivyIndex;
use crate::card::Card;
use serde::Serialize;
use std::collections::HashMap;

#[derive(Clone, Serialize)]
struct JobProgress {
    status: String,
    total_files: usize,
    processed_files: usize,
    cards_indexed: usize,
    cards_uploaded: usize,
    error: Option<String>,
}

#[derive(Clone)]
struct AppState {
    index: Arc<TantivyIndex>,
    jobs: Arc<RwLock<HashMap<String, Arc<RwLock<JobProgress>>>>>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();

    let index_path = std::env::var("TANTIVY_PATH").unwrap_or_else(|_| "debate_index".to_string());

    let state = AppState {
        index: Arc::new(TantivyIndex::new(&index_path).expect("Failed to initialize Tantivy index")),
        jobs: Arc::new(RwLock::new(HashMap::new())),
    };

    let api_router = Router::new()
        .route("/upload", post(upload))
        .route("/query", get(query))
        .route("/card/:id", get(get_card))
        .route("/progress/:id", get(get_progress))
        .route("/stats", get(get_stats))
        .layer(DefaultBodyLimit::disable());

    let app = Router::new()
        .nest("/api", api_router)
        .fallback_service(ServeDir::new("public"))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

use tokio_util::io::StreamReader;
use futures::TryStreamExt;
use std::io::BufReader;

async fn get_progress(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let jobs = state.jobs.read().unwrap();
    if let Some(job_lock) = jobs.get(&id) {
        let job = job_lock.read().unwrap();
        (StatusCode::OK, Json(job.clone())).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Job not found").into_response()
    }
}

#[axum::debug_handler]
async fn upload(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Response {
    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();
        let file_name = field.file_name().unwrap_or("unknown").to_string();
        
        if name == "file" {
            let job_id = uuid::Uuid::new_v4().to_string();
            let temp_path = std::env::temp_dir().join(format!("upload_{}.tmp", job_id));
            let mut file = match tokio::fs::File::create(&temp_path).await {
                Ok(f) => f,
                Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create temp file: {}", e)).into_response(),
            };

            let mut stream = StreamReader::new(
                field.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
            );

            if let Err(e) = tokio::io::copy(&mut stream, &mut file).await {
                let _ = tokio::fs::remove_file(&temp_path).await;
                return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to stream upload: {}", e)).into_response();
            }

            let initial_progress = Arc::new(RwLock::new(JobProgress {
                status: "Queued for processing...".to_string(),
                total_files: 1,
                processed_files: 0,
                cards_indexed: 0,
                cards_uploaded: 0,
                error: None,
            }));

            state.jobs.write().unwrap().insert(job_id.clone(), initial_progress.clone());
            let job_progress_clone = initial_progress.clone();
            let state_clone = state.clone();
            let file_name_clone = file_name.clone();

            tokio::spawn(async move {
                if file_name_clone.ends_with(".docx") {
                    // For docx, we still read into memory for now as docx-rs needs the full buffer usually
                    // but we read it from the temp file we just saved
                    match tokio::fs::read(&temp_path).await {
                        Ok(data) => {
                            job_progress_clone.write().unwrap().status = "Parsing docx...".to_string();
                            let parser = CardParser::new(file_name_clone, data);
                            match parser.parse() {
                                Ok(cards) => {
                                    job_progress_clone.write().unwrap().processed_files = 1;
                                    job_progress_clone.write().unwrap().cards_indexed = cards.len();
                                    job_progress_clone.write().unwrap().status = "Indexing...".to_string();
                                    
                                    match state_clone.index.add_cards(&cards) {
                                        Ok(_) => {
                                            job_progress_clone.write().unwrap().cards_uploaded = cards.len();
                                            job_progress_clone.write().unwrap().status = "Completed".to_string();
                                        },
                                        Err(e) => job_progress_clone.write().unwrap().error = Some(format!("Indexing error: {}", e)),
                                    }
                                }
                                Err(e) => job_progress_clone.write().unwrap().error = Some(format!("Parser error: {}", e)),
                            }
                        }
                        Err(e) => job_progress_clone.write().unwrap().error = Some(format!("Failed to read temp file: {}", e)),
                    }
                } else if file_name_clone.ends_with(".csv") {
                    job_progress_clone.write().unwrap().status = "Streaming CSV...".to_string();
                    
                    let file = match std::fs::File::open(&temp_path) {
                        Ok(f) => f,
                        Err(e) => {
                            job_progress_clone.write().unwrap().error = Some(format!("Failed to open temp file: {}", e));
                            return;
                        }
                    };

                    let parser = OpenCaselistParser::new(BufReader::new(file));
                    let mut writer = match state_clone.index.create_writer(100_000_000) { // 100MB heap
                        Ok(w) => w,
                        Err(e) => {
                            job_progress_clone.write().unwrap().error = Some(format!("Failed to create Tantivy writer: {}", e));
                            return;
                        }
                    };

                    let mut batch = Vec::new();
                    let mut total_indexed = 0;
                    
                    for card_result in parser.parse_records() {
                        match card_result {
                            Ok(card) => {
                                batch.push(card);
                                if batch.len() >= 5000 {
                                    total_indexed += batch.len();
                                    if let Err(e) = state_clone.index.add_cards_to_writer(&mut writer, &batch) {
                                        job_progress_clone.write().unwrap().error = Some(format!("Batch indexing error: {}", e));
                                        return;
                                    }
                                    if let Err(e) = writer.commit() {
                                        job_progress_clone.write().unwrap().error = Some(format!("Batch commit error: {}", e));
                                        return;
                                    }
                                    batch.clear();
                                    let mut prog = job_progress_clone.write().unwrap();
                                    prog.cards_indexed = total_indexed;
                                    prog.status = format!("Indexing... ({} cards)", total_indexed);
                                }
                            }
                            Err(e) => {
                                job_progress_clone.write().unwrap().error = Some(format!("CSV Parser error: {}", e));
                                return;
                            }
                        }
                    }

                    if !batch.is_empty() {
                        total_indexed += batch.len();
                        let _ = state_clone.index.add_cards_to_writer(&mut writer, &batch);
                    }

                    if let Err(e) = writer.commit() {
                        job_progress_clone.write().unwrap().error = Some(format!("Commit error: {}", e));
                    } else {
                        let mut prog = job_progress_clone.write().unwrap();
                        prog.cards_indexed = total_indexed;
                        prog.cards_uploaded = total_indexed;
                        prog.status = "Completed".to_string();
                    }
                } else if file_name_clone.ends_with(".zip") {
                    // ZIP still needs memory for now due to library constraints, but we read from temp file
                    match tokio::fs::read(&temp_path).await {
                        Ok(data) => {
                            let cursor = std::io::Cursor::new(data);
                            let mut archive = match zip::ZipArchive::new(cursor) {
                                Ok(a) => a,
                                Err(e) => {
                                    job_progress_clone.write().unwrap().error = Some(format!("Failed to read ZIP: {}", e));
                                    return;
                                }
                            };

                            job_progress_clone.write().unwrap().status = "Unzipping Archive...".to_string();
                            let mut files_to_parse = Vec::new();
                            for i in 0..archive.len() {
                                if let Ok(mut file) = archive.by_index(i) {
                                    let entry_name = file.name().to_string();
                                    if entry_name.ends_with(".docx") && !entry_name.contains("__MACOSX") {
                                        let mut buf = Vec::new();
                                        let _ = std::io::Read::read_to_end(&mut file, &mut buf);
                                        files_to_parse.push((entry_name, buf));
                                    }
                                }
                            }

                            let file_count = files_to_parse.len();
                            job_progress_clone.write().unwrap().total_files = file_count;
                            job_progress_clone.write().unwrap().status = "Parsing docx files...".to_string();

                            let processed_count = Arc::new(AtomicUsize::new(0));
                            let progress_for_thread = job_progress_clone.clone();
                            let files_to_parse_shared = Arc::new(files_to_parse);
                            let processed_ref = processed_count.clone();
                            
                            let all_cards: Vec<Card> = tokio::task::spawn_blocking(move || {
                                files_to_parse_shared.par_iter()
                                    .filter_map(|(name, buf)| {
                                        let parser = CardParser::new(name.clone(), buf.clone());
                                        let parsed = parser.parse().ok();
                                        let done = processed_ref.fetch_add(1, Ordering::Relaxed) + 1;
                                        if done % 10 == 0 || done == file_count {
                                            progress_for_thread.write().unwrap().processed_files = done;
                                        }
                                        parsed
                                    })
                                    .flatten()
                                    .collect()
                            }).await.unwrap();

                            job_progress_clone.write().unwrap().processed_files = file_count;
                            let total_cards = all_cards.len();
                            job_progress_clone.write().unwrap().cards_indexed = total_cards;

                            if !all_cards.is_empty() {
                                job_progress_clone.write().unwrap().status = "Indexing...".to_string();
                                match state_clone.index.add_cards(&all_cards) {
                                    Ok(_) => {
                                        job_progress_clone.write().unwrap().cards_uploaded = total_cards;
                                        job_progress_clone.write().unwrap().status = "Completed".to_string();
                                    },
                                    Err(e) => job_progress_clone.write().unwrap().error = Some(format!("Indexing error: {}", e)),
                                }
                            } else {
                                job_progress_clone.write().unwrap().error = Some("No valid .docx files found in the ZIP".to_string());
                            }
                        }
                        Err(e) => job_progress_clone.write().unwrap().error = Some(format!("Failed to read temp file: {}", e)),
                    }
                }
                let _ = tokio::fs::remove_file(&temp_path).await;
            });

            return (StatusCode::OK, Json(serde_json::json!({ "job_id": job_id }))).into_response();
        }
    }
    (StatusCode::BAD_REQUEST, "No valid .docx, .csv or .zip file found in request").into_response()
}

#[derive(Deserialize)]
struct QueryParams {
    q: String,
    #[serde(default = "default_size")]
    size: usize,
}

fn default_size() -> usize { 40 }

async fn query(
    State(state): State<AppState>,
    Query(params): Query<QueryParams>,
) -> Response {
    match state.index.search(&params.q, params.size) {
        Ok(results) => (StatusCode::OK, Json(results)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Search error: {}", e)).into_response(),
    }
}

async fn get_card(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Response {
    match state.index.get_card(&id) {
        Ok(Some(doc)) => (StatusCode::OK, Json(doc)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "Document not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)).into_response(),
    }
}

async fn get_stats(
    State(state): State<AppState>,
) -> Response {
    let mut stats = match state.index.get_stats() {
        Ok(s) => s,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, format!("Stats error: {}", e)).into_response(),
    };

    // Calculate pending cards from active jobs
    let mut pending_cards = 0;
    if let Ok(jobs) = state.jobs.read() {
        for job in jobs.values() {
            if let Ok(progress) = job.read() {
                if progress.status != "Completed" && progress.error.is_none() {
                    let pending = progress.cards_indexed.saturating_sub(progress.cards_uploaded);
                    pending_cards += pending;
                }
            }
        }
    }

    if let Some(obj) = stats.as_object_mut() {
        obj.insert("pending_cards".to_string(), serde_json::json!(pending_cards));
    }

    (StatusCode::OK, Json(stats)).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    #[test]
    fn test_zip_extraction() {
        let path = Path::new("test-docs/test.zip");
        if !path.exists() {
            println!("test-docs/test.zip not found, skipping zip test");
            return;
        }

        let content = fs::read(path).expect("Failed to read test zip");
        let cursor = std::io::Cursor::new(content);
        let mut archive = zip::ZipArchive::new(cursor).expect("Failed to initialize zip archive");
        
        let mut docx_count = 0;
        for i in 0..archive.len() {
            if let Ok(mut file) = archive.by_index(i) {
                let entry_name = file.name().to_string();
                if entry_name.ends_with(".docx") && !entry_name.contains("__MACOSX") {
                    docx_count += 1;
                    
                    let mut buf = Vec::new();
                    std::io::Read::read_to_end(&mut file, &mut buf).expect("Failed to read inside zip");
                    
                    let parser = CardParser::new(entry_name, buf);
                    let res = parser.parse();
                    assert!(res.is_ok(), "Should parse docx inside zip");
                }
            }
        }
        assert!(docx_count > 0, "Zip file should contain at least one valid docx file");
    }
}

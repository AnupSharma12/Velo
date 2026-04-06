mod auth;

use auth::{AuthSession, AuthUser, SupabaseAuth};
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "ogg", "aac", "m4a", "wma", "opus", "webm",
];

#[derive(Serialize)]
struct AudioFileInfo {
    path: String,
    name: String,
}

pub struct AppState {
    supabase: SupabaseAuth,
    session: Mutex<Option<AuthSession>>,
}

// ── Audio Commands ──────────────────────────────────────

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Velo.", name)
}

#[tauri::command]
fn scan_audio_files(path: String) -> Vec<AudioFileInfo> {
    let root = Path::new(&path);
    let mut results = Vec::new();
    collect_audio_files(root, &mut results);
    results
}

fn collect_audio_files(dir: &Path, out: &mut Vec<AudioFileInfo>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            collect_audio_files(&p, out);
        } else if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
            if AUDIO_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()) {
                if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                    out.push(AudioFileInfo {
                        path: p.to_string_lossy().into_owned(),
                        name: name.to_string(),
                    });
                }
            }
        }
    }
}

// ── Auth Commands ───────────────────────────────────────

#[tauri::command]
async fn auth_sign_up(
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<AuthSession, String> {
    let session = state.supabase.sign_up(&email, &password).await?;
    {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        *guard = Some(session.clone());
    }
    Ok(session)
}

#[tauri::command]
async fn auth_sign_in(
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<AuthSession, String> {
    let session = state.supabase.sign_in(&email, &password).await?;
    {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        *guard = Some(session.clone());
    }
    Ok(session)
}

#[tauri::command]
async fn auth_get_user(state: State<'_, AppState>) -> Result<AuthUser, String> {
    let token = {
        let guard = state.session.lock().map_err(|e| e.to_string())?;
        guard
            .as_ref()
            .ok_or_else(|| "Not logged in".to_string())?
            .access_token
            .clone()
    };
    state.supabase.get_user(&token).await
}

#[tauri::command]
async fn auth_sign_out(state: State<'_, AppState>) -> Result<(), String> {
    let token = {
        let guard = state.session.lock().map_err(|e| e.to_string())?;
        guard.as_ref().map(|s| s.access_token.clone())
    };
    if let Some(token) = token {
        let _ = state.supabase.sign_out(&token).await;
    }
    {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        *guard = None;
    }
    Ok(())
}

#[tauri::command]
async fn auth_get_session(state: State<'_, AppState>) -> Result<Option<AuthSession>, String> {
    let session = {
        let guard = state.session.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };
    Ok(session)
}

// ── App Entry ───────────────────────────────────────────

pub fn run() {
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .manage(AppState {
            supabase: SupabaseAuth::new(),
            session: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            scan_audio_files,
            auth_sign_up,
            auth_sign_in,
            auth_get_user,
            auth_sign_out,
            auth_get_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Velo");
}

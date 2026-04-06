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
    auth::save_session(&session)?;
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
    auth::save_session(&session)?;
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
    auth::clear_session();
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

#[tauri::command]
async fn auth_refresh_session(state: State<'_, AppState>) -> Result<AuthSession, String> {
    let refresh_token = {
        let guard = state.session.lock().map_err(|e| e.to_string())?;
        guard
            .as_ref()
            .ok_or_else(|| "No session to refresh".to_string())?
            .refresh_token
            .clone()
    };
    let session = state.supabase.refresh(&refresh_token).await?;
    {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        *guard = Some(session.clone());
    }
    auth::save_session(&session)?;
    Ok(session)
}

#[tauri::command]
async fn auth_oauth_sign_in(
    provider: String,
    state: State<'_, AppState>,
) -> Result<AuthSession, String> {
    use tokio::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_url = format!("http://localhost:{}/callback", port);

    let (code_verifier, code_challenge) = auth::generate_pkce();

    let auth_url = state
        .supabase
        .get_oauth_url(&provider, &code_challenge, &redirect_url);
    open::that(&auth_url).map_err(|e| e.to_string())?;

    let code = tokio::time::timeout(
        std::time::Duration::from_secs(300),
        auth::wait_for_oauth_callback(listener),
    )
    .await
    .map_err(|_| "OAuth timed out \u{2014} try again".to_string())??;

    let session = state
        .supabase
        .exchange_code(&code, &code_verifier)
        .await?;

    {
        let mut guard = state.session.lock().map_err(|e| e.to_string())?;
        *guard = Some(session.clone());
    }
    auth::save_session(&session)?;

    Ok(session)
}

// ── App Entry ───────────────────────────────────────────

pub fn run() {
    dotenvy::dotenv().ok();

    let initial_session = auth::load_session();

    tauri::Builder::default()
        .manage(AppState {
            supabase: SupabaseAuth::new(),
            session: Mutex::new(initial_session),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            scan_audio_files,
            auth_sign_up,
            auth_sign_in,
            auth_get_user,
            auth_sign_out,
            auth_get_session,
            auth_refresh_session,
            auth_oauth_sign_in,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Velo");
}

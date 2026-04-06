use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

// ── Types ───────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthUser {
    pub id: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthSession {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
    pub user: AuthUser,
}

#[derive(Serialize)]
struct Credentials {
    email: String,
    password: String,
}

#[derive(Serialize)]
struct RefreshRequest {
    refresh_token: String,
}

#[derive(Serialize)]
struct PkceExchange {
    auth_code: String,
    code_verifier: String,
}

// ── PKCE ────────────────────────────────────────────────

pub fn generate_pkce() -> (String, String) {
    let mut rng = rand::thread_rng();
    let charset = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let code_verifier: String = (0..64)
        .map(|_| charset[rng.gen_range(0..charset.len())] as char)
        .collect();
    let hash = Sha256::digest(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(hash);
    (code_verifier, code_challenge)
}

// ── OAuth Callback Server ───────────────────────────────

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

pub async fn wait_for_oauth_callback(listener: TcpListener) -> Result<String, String> {
    let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;

    let mut buf = vec![0u8; 4096];
    let n = stream.read(&mut buf).await.map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buf[..n]);

    let query = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|path| path.split('?').nth(1))
        .unwrap_or("");

    let params: std::collections::HashMap<&str, &str> = query
        .split('&')
        .filter_map(|p| {
            let mut parts = p.splitn(2, '=');
            Some((parts.next()?, parts.next()?))
        })
        .collect();

    if let Some(&error) = params.get("error") {
        let desc = params.get("error_description").unwrap_or(&error);
        let safe = escape_html(desc);
        let html = format!(
            "<html><body style=\"font-family:system-ui;text-align:center;padding:60px\">\
             <h2>Authentication failed</h2><p>{safe}</p></body></html>"
        );
        send_response(&mut stream, &html).await;
        return Err(desc.replace("%20", " ").replace('+', " "));
    }

    let code = params
        .get("code")
        .ok_or_else(|| "No auth code in callback".to_string())?
        .to_string();

    let html = "<html><body style=\"font-family:system-ui;text-align:center;padding:60px\">\
                <h2>Authentication successful!</h2>\
                <p>You can close this tab and return to Velo.</p></body></html>";
    send_response(&mut stream, html).await;

    Ok(code)
}

async fn send_response(stream: &mut tokio::net::TcpStream, html: &str) {
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
         Content-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    );
    stream.write_all(response.as_bytes()).await.ok();
}

// ── Session Persistence ─────────────────────────────────

fn session_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("com.velo.player");
    fs::create_dir_all(&path).ok();
    path.push("session.json");
    path
}

pub fn save_session(session: &AuthSession) -> Result<(), String> {
    let json = serde_json::to_string(session).map_err(|e| e.to_string())?;
    fs::write(session_path(), json).map_err(|e| e.to_string())
}

pub fn load_session() -> Option<AuthSession> {
    let data = fs::read_to_string(session_path()).ok()?;
    serde_json::from_str(&data).ok()
}

pub fn clear_session() {
    fs::remove_file(session_path()).ok();
}

// ── Error Parsing ───────────────────────────────────────

fn parse_supabase_error(body: &str) -> String {
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(msg) = v.get("msg").and_then(|m| m.as_str()) {
            return msg.to_string();
        }
        if let Some(msg) = v.get("error_description").and_then(|m| m.as_str()) {
            return msg.to_string();
        }
        if let Some(msg) = v.get("message").and_then(|m| m.as_str()) {
            return msg.to_string();
        }
    }
    body.to_string()
}

// ── Supabase Auth Client ────────────────────────────────

pub struct SupabaseAuth {
    url: String,
    anon_key: String,
    client: Client,
}

impl SupabaseAuth {
    pub fn new() -> Self {
        let url = env::var("SUPABASE_URL").expect("SUPABASE_URL must be set in .env");
        let anon_key =
            env::var("SUPABASE_ANON_KEY").expect("SUPABASE_ANON_KEY must be set in .env");
        Self {
            url,
            anon_key,
            client: Client::new(),
        }
    }

    pub async fn sign_up(&self, email: &str, password: &str) -> Result<AuthSession, String> {
        let resp = self
            .client
            .post(format!("{}/auth/v1/signup", self.url))
            .header("apikey", &self.anon_key)
            .header("Content-Type", "application/json")
            .json(&Credentials {
                email: email.to_string(),
                password: password.to_string(),
            })
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(parse_supabase_error(&body));
        }

        let body = resp.text().await.map_err(|e| e.to_string())?;

        // Check if we got a full session (auto-confirm enabled)
        if let Some(token) = serde_json::from_str::<serde_json::Value>(&body)
            .ok()
            .and_then(|v| v.get("access_token")?.as_str().map(String::from))
        {
            if !token.is_empty() {
                return serde_json::from_str::<AuthSession>(&body).map_err(|e| e.to_string());
            }
        }

        // No session — email confirmation required
        Err("Check your email to confirm your account, then log in.".to_string())
    }

    pub async fn sign_in(&self, email: &str, password: &str) -> Result<AuthSession, String> {
        let resp = self
            .client
            .post(format!("{}/auth/v1/token?grant_type=password", self.url))
            .header("apikey", &self.anon_key)
            .header("Content-Type", "application/json")
            .json(&Credentials {
                email: email.to_string(),
                password: password.to_string(),
            })
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(parse_supabase_error(&body));
        }

        resp.json::<AuthSession>().await.map_err(|e| e.to_string())
    }

    pub async fn get_user(&self, access_token: &str) -> Result<AuthUser, String> {
        let resp = self
            .client
            .get(format!("{}/auth/v1/user", self.url))
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(parse_supabase_error(&body));
        }

        resp.json::<AuthUser>().await.map_err(|e| e.to_string())
    }

    pub async fn sign_out(&self, access_token: &str) -> Result<(), String> {
        let _ = self
            .client
            .post(format!("{}/auth/v1/logout", self.url))
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", access_token))
            .send()
            .await;
        Ok(())
    }

    pub async fn refresh(&self, token: &str) -> Result<AuthSession, String> {
        let resp = self
            .client
            .post(format!(
                "{}/auth/v1/token?grant_type=refresh_token",
                self.url
            ))
            .header("apikey", &self.anon_key)
            .header("Content-Type", "application/json")
            .json(&RefreshRequest {
                refresh_token: token.to_string(),
            })
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(parse_supabase_error(&body));
        }

        resp.json::<AuthSession>().await.map_err(|e| e.to_string())
    }

    pub fn get_oauth_url(
        &self,
        provider: &str,
        code_challenge: &str,
        redirect_to: &str,
    ) -> String {
        let mut url = reqwest::Url::parse(&format!("{}/auth/v1/authorize", self.url))
            .expect("Invalid Supabase URL");
        url.query_pairs_mut()
            .append_pair("provider", provider)
            .append_pair("code_challenge", code_challenge)
            .append_pair("code_challenge_method", "S256")
            .append_pair("redirect_to", redirect_to);
        url.to_string()
    }

    pub async fn exchange_code(
        &self,
        code: &str,
        code_verifier: &str,
    ) -> Result<AuthSession, String> {
        let resp = self
            .client
            .post(format!("{}/auth/v1/token?grant_type=pkce", self.url))
            .header("apikey", &self.anon_key)
            .header("Content-Type", "application/json")
            .json(&PkceExchange {
                auth_code: code.to_string(),
                code_verifier: code_verifier.to_string(),
            })
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(parse_supabase_error(&body));
        }

        resp.json::<AuthSession>().await.map_err(|e| e.to_string())
    }
}

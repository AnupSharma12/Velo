use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

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
#[allow(dead_code)]
struct RefreshRequest {
    refresh_token: String,
}

// ── Supabase Auth Client ────────────────────────────────

pub struct SupabaseAuth {
    url: String,
    anon_key: String,
    client: Client,
}

impl SupabaseAuth {
    pub fn new() -> Self {
        let url = env::var("SUPABASE_URL")
            .expect("SUPABASE_URL must be set in .env");
        let anon_key = env::var("SUPABASE_ANON_KEY")
            .expect("SUPABASE_ANON_KEY must be set in .env");
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
            return Err(body);
        }

        resp.json::<AuthSession>().await.map_err(|e| e.to_string())
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
            return Err(body);
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
            return Err(body);
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

    #[allow(dead_code)]
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
            return Err(body);
        }

        resp.json::<AuthSession>().await.map_err(|e| e.to_string())
    }
}

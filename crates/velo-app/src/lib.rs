use serde::Serialize;
use std::path::Path;

const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "ogg", "aac", "m4a", "wma", "opus", "webm",
];

#[derive(Serialize)]
struct AudioFileInfo {
    path: String,
    name: String,
}

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

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, scan_audio_files])
        .run(tauri::generate_context!())
        .expect("error while running Velo");
}

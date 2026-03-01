use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};

use crate::utils::get_env_path;

/// Read all configuration from .env file
#[tauri::command]
pub async fn get_config() -> Result<HashMap<String, String>, String> {
    let env_path = get_env_path().map_err(|e| e.to_string())?;

    let file = fs::File::open(&env_path)
        .map_err(|e| format!("Failed to open .env file: {}", e))?;

    let reader = BufReader::new(file);
    let mut config = HashMap::new();

    for line in reader.lines() {
        if let Ok(line) = line {
            let line = line.trim();
            // Skip empty lines and comments
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            // Parse KEY=VALUE
            if let Some((key, value)) = line.split_once('=') {
                config.insert(key.trim().to_string(), value.trim().to_string());
            }
        }
    }

    Ok(config)
}

/// Update a single configuration value in .env file
#[tauri::command]
pub async fn update_config(key: String, value: String) -> Result<(), String> {
    let env_path = get_env_path().map_err(|e| e.to_string())?;

    // Read existing content
    let content = fs::read_to_string(&env_path)
        .map_err(|e| format!("Failed to read .env file: {}", e))?;

    let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
    let mut found = false;

    // Update existing key or mark for insertion
    for line in lines.iter_mut() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || trimmed.is_empty() {
            continue;
        }
        if let Some((existing_key, _)) = trimmed.split_once('=') {
            if existing_key.trim() == key {
                *line = format!("{}={}", key, value);
                found = true;
                break;
            }
        }
    }

    // If key not found, append it
    if !found {
        lines.push(format!("{}={}", key, value));
    }

    // Write back
    let mut file = fs::File::create(&env_path)
        .map_err(|e| format!("Failed to create .env file: {}", e))?;

    for line in lines {
        writeln!(file, "{}", line)
            .map_err(|e| format!("Failed to write .env file: {}", e))?;
    }

    Ok(())
}

/// Reset configuration to defaults by creating a new .env from template
#[tauri::command]
pub async fn reset_config() -> Result<(), String> {
    let env_path = get_env_path().map_err(|e| e.to_string())?;
    let vats_root = crate::utils::get_vats_root().map_err(|e| e.to_string())?;
    let template_path = vats_root.join(".env.example");

    // Check if template exists
    if template_path.exists() {
        fs::copy(&template_path, &env_path)
            .map_err(|e| format!("Failed to copy template: {}", e))?;
    } else {
        // Create a minimal default config
        let defaults = r#"# VATS Configuration
AI_MODEL=ollama
WHISPER_MODEL=small
WHISPER_LANGUAGE=en
PERFORMANCE_PROFILE=balanced
GPU_MEMORY_FRACTION=0.9
ENABLE_DIARIZATION=true
ENABLE_SUMMARIZATION=true
MAX_CONCURRENT_FILES=3
"#;
        fs::write(&env_path, defaults)
            .map_err(|e| format!("Failed to write default config: {}", e))?;
    }

    Ok(())
}

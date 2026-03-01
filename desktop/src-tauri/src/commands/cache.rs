use serde_json::Value;

use crate::process::{execute_vats_json, execute_vats_raw};

/// Get cache statistics
#[tauri::command]
pub async fn cache_stats() -> Result<Value, String> {
    let args = vec![
        "-m".to_string(),
        "vats".to_string(),
        "cache".to_string(),
        "stats".to_string(),
    ];

    execute_vats_json(args).await
}

/// Clear cache with optional force flag
#[tauri::command]
pub async fn cache_cleanup(force: bool) -> Result<String, String> {
    let mut args = vec![
        "-m".to_string(),
        "vats".to_string(),
        "cache".to_string(),
        "cleanup".to_string(),
    ];

    if force {
        args.push("--force".to_string());
    }

    execute_vats_raw(args).await
}

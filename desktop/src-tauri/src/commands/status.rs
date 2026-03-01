use serde_json::Value;

use crate::process::execute_vats_json;

/// Get system status including GPU info and configuration summary
#[tauri::command]
pub async fn get_system_status() -> Result<Value, String> {
    let args = vec![
        "-m".to_string(),
        "vats".to_string(),
        "status".to_string(),
        "--json".to_string(),
    ];

    execute_vats_json(args).await
}

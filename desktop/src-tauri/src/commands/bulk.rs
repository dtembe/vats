use tauri::{AppHandle, Runtime};

use crate::process::execute_vats_command;

/// Bulk process multiple files concurrently
#[tauri::command]
pub async fn bulk_process<R: Runtime>(
    app_handle: AppHandle<R>,
    files: Vec<String>,
    max_concurrent: Option<usize>,
) -> Result<(), String> {
    let mut args = vec!["-m".to_string(), "vats".to_string(), "bulk".to_string()];

    for file in files {
        args.push(file);
    }

    if let Some(max) = max_concurrent {
        args.push("--max-concurrent".to_string());
        args.push(max.to_string());
    }

    execute_vats_command(app_handle, "bulk-output", args).await?;

    Ok(())
}

/// High-speed queue processing for all media files in a directory
#[tauri::command]
pub async fn speed_queue<R: Runtime>(
    app_handle: AppHandle<R>,
    directory: String,
) -> Result<(), String> {
    let mut args = vec![
        "-m".to_string(),
        "vats".to_string(),
        "bulk".to_string(),
        "--profile".to_string(),
        "speed".to_string(),
        "--no-summary".to_string(),
    ];

    args.push(directory);

    execute_vats_command(app_handle, "bulk-output", args).await?;

    Ok(())
}

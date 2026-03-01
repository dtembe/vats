use tauri::{AppHandle, Runtime};

use crate::process::execute_vats_command;

/// Process a single audio/video file with optional transcription only mode
#[tauri::command]
pub async fn process_file_stream<R: Runtime>(
    app_handle: AppHandle<R>,
    file: String,
    no_summary: bool,
    profile: Option<String>,
) -> Result<(), String> {
    let mut args = vec!["-m".to_string(), "vats".to_string(), "process".to_string()];

    args.push(file);

    if no_summary {
        args.push("--no-summary".to_string());
    }

    if let Some(p) = profile {
        args.push("--profile".to_string());
        args.push(p);
    }

    execute_vats_command(app_handle, "process-output", args).await?;

    Ok(())
}

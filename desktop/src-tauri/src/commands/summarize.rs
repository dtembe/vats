use tauri::{AppHandle, Runtime};

use crate::process::execute_vats_command;

/// Summarize a document (PDF, DOCX, TXT, MD)
#[tauri::command]
pub async fn summarize_document<R: Runtime>(
    app_handle: AppHandle<R>,
    file: String,
) -> Result<(), String> {
    let args = vec![
        "-m".to_string(),
        "vats".to_string(),
        "summarize".to_string(),
        file,
    ];

    execute_vats_command(app_handle, "summarize-output", args).await?;

    Ok(())
}

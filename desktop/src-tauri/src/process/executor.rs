use std::process::Stdio;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;

use crate::utils::{find_python, get_vats_root};

/// Terminal output event payload
#[derive(Debug, Clone, Serialize)]
pub struct TerminalOutput {
    pub line_type: String, // "stdout" | "stderr" | "system"
    pub line: String,
    pub timestamp: u64,
}

/// Process execution result
#[derive(Debug)]
pub struct ProcessResult {
    pub success: bool,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

/// Execute a VATS command with streaming output
pub async fn execute_vats_command<R: Runtime>(
    app_handle: AppHandle<R>,
    event_name: &str,
    args: Vec<String>,
) -> Result<ProcessResult, String> {
    let python = find_python()?;
    let vats_root = get_vats_root().map_err(|e| e.to_string())?;

    // Emit system message about starting
    let _ = app_handle.emit(
        event_name,
        TerminalOutput {
            line_type: "system".to_string(),
            line: format!("Starting: {} {}", python.display(), args.join(" ")),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        },
    );

    #[cfg(target_os = "windows")]
    let mut child = TokioCommand::new(&python)
        .args(&args)
        .current_dir(&vats_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {}", e))?;

    #[cfg(not(target_os = "windows"))]
    let mut child = TokioCommand::new(&python)
        .args(&args)
        .current_dir(&vats_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);

    let event_name_stdout = event_name.to_string();
    let event_name_stderr = event_name.to_string();
    let app_handle_stdout = app_handle.clone();
    let app_handle_stderr = app_handle.clone();

    // Spawn tasks to read stdout and stderr using async
    let stdout_task = tokio::spawn(async move {
        let mut lines = stdout_reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_handle_stdout.emit(
                &event_name_stdout,
                TerminalOutput {
                    line_type: "stdout".to_string(),
                    line,
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                },
            );
        }
    });

    let stderr_task = tokio::spawn(async move {
        let mut lines = stderr_reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_handle_stderr.emit(
                &event_name_stderr,
                TerminalOutput {
                    line_type: "stderr".to_string(),
                    line,
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as u64,
                },
            );
        }
    });

    // Wait for the process to complete
    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for process: {}", e))?;

    // Wait for output tasks to complete
    let _ = tokio::try_join!(stdout_task, stderr_task);

    // Emit completion message
    let _ = app_handle.emit(
        event_name,
        TerminalOutput {
            line_type: "system".to_string(),
            line: format!(
                "Process completed with exit code: {}",
                status.code().unwrap_or(-1)
            ),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        },
    );

    Ok(ProcessResult {
        success: status.success(),
        exit_code: status.code(),
        stdout: String::new(),
        stderr: String::new(),
    })
}

/// Execute a VATS command and capture output as JSON
pub async fn execute_vats_json<T: serde::de::DeserializeOwned>(
    args: Vec<String>,
) -> Result<T, String> {
    let python = find_python()?;
    let vats_root = get_vats_root().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let output = TokioCommand::new(&python)
        .args(&args)
        .current_dir(&vats_root)
        .creation_flags(0x08000000)
        .output()
        .await
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    #[cfg(not(target_os = "windows"))]
    let output = TokioCommand::new(&python)
        .args(&args)
        .current_dir(&vats_root)
        .output()
        .await
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Command failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse JSON: {}", e))
}

/// Execute a VATS command and return raw output
pub async fn execute_vats_raw(args: Vec<String>) -> Result<String, String> {
    let python = find_python()?;
    let vats_root = get_vats_root().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let output = TokioCommand::new(&python)
        .args(&args)
        .current_dir(&vats_root)
        .creation_flags(0x08000000)
        .output()
        .await
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    #[cfg(not(target_os = "windows"))]
    let output = TokioCommand::new(&python)
        .args(&args)
        .current_dir(&vats_root)
        .output()
        .await
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Command failed: {}", stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

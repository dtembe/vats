use std::path::PathBuf;
use std::process::Command;

use crate::utils::paths::get_venv_path;

/// Find the Python executable, preferring the virtual environment
pub fn find_python() -> Result<PathBuf, String> {
    // First, check for virtual environment
    let venv = get_venv_path();

    #[cfg(target_os = "windows")]
    let venv_python = venv.join("Scripts").join("python.exe");

    #[cfg(not(target_os = "windows"))]
    let venv_python = venv.join("bin").join("python");

    if venv_python.exists() {
        return Ok(venv_python);
    }

    // Fallback to system Python
    #[cfg(target_os = "windows")]
    {
        // Try python.exe first
        if let Ok(output) = Command::new("where").arg("python.exe").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout);
                let path = path.lines().next().unwrap_or("").trim();
                if !path.is_empty() {
                    return Ok(PathBuf::from(path));
                }
            }
        }

        // Try python3.exe
        if let Ok(output) = Command::new("where").arg("python3.exe").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout);
                let path = path.lines().next().unwrap_or("").trim();
                if !path.is_empty() {
                    return Ok(PathBuf::from(path));
                }
            }
        }

        Err("Python not found. Please install Python 3.10+ or activate the virtual environment.".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        // Try python3 first (common on Unix)
        if let Ok(output) = Command::new("which").arg("python3").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout);
                let path = path.lines().next().unwrap_or("").trim();
                if !path.is_empty() {
                    return Ok(PathBuf::from(path));
                }
            }
        }

        // Try python
        if let Ok(output) = Command::new("which").arg("python").output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout);
                let path = path.lines().next().unwrap_or("").trim();
                if !path.is_empty() {
                    return Ok(PathBuf::from(path));
                }
            }
        }

        Err("Python not found. Please install Python 3.10+.".to_string())
    }
}

/// Verify Python is available and return version string
pub fn get_python_version() -> Result<String, String> {
    let python = find_python()?;
    let output = Command::new(&python)
        .args(["--version"])
        .output()
        .map_err(|e| format!("Failed to execute python --version: {}", e))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout);
        Ok(version.trim().to_string())
    } else {
        Err("Failed to get Python version".to_string())
    }
}

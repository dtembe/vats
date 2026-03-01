use std::path::{Path, PathBuf};
use std::env;

/// Get the VATS installation root directory
/// This is typically the parent of the desktop directory
pub fn get_vats_root() -> Result<PathBuf, String> {
    let exe_path = env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;

    // Navigate from exe: desktop/src-tauri/target/debug/ -> desktop/src-tauri/ -> desktop/ -> ../
    let mut current = exe_path.as_path();

    // In development, we're in src-tauri/target/debug or similar
    // In production, we're in the installation directory

    // Try to find the desktop directory first
    let mut desktop_root = None;

    for ancestor in exe_path.ancestors() {
        if ancestor.file_name().and_then(|n| n.to_str()) == Some("desktop") {
            desktop_root = Some(ancestor.parent().ok_or("No parent directory")?);
            break;
        }
    }

    // If we found desktop, its parent is vats root
    if let Some(root) = desktop_root {
        return Ok(root.to_path_buf());
    }

    // Fallback: assume we're in development and the parent of desktop is vats root
    // Try going up from the exe directory
    if let Some(parent) = exe_path.parent() {
        // Check if we're in src-tauri/target/...
        for ancestor in exe_path.ancestors() {
            if ancestor.join("desktop").exists() {
                // We're at a level where desktop sibling exists
                return Ok(ancestor.to_path_buf());
            }
        }
    }

    // Final fallback: use current directory's parent if we're in desktop
    let cwd = env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;

    for ancestor in cwd.ancestors() {
        if ancestor.file_name().and_then(|n| n.to_str()) == Some("desktop") {
            if let Some(parent) = ancestor.parent() {
                return Ok(parent.to_path_buf());
            }
        }
    }

    Err("Could not determine VATS root directory".to_string())
}

/// Get the path to the .env file
pub fn get_env_path() -> Result<PathBuf, String> {
    let root = get_vats_root()?;
    let env_path = root.join(".env");

    if env_path.exists() {
        Ok(env_path)
    } else {
        Err(format!(".env file not found at {:?}", env_path))
    }
}

/// Check if a path is an audio/video file based on extension
pub fn is_media_file(path: &Path) -> bool {
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        matches!(ext.to_lowercase().as_str(),
            "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" | "opus" |
            "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" | "m4v" |
            "mpg" | "mpeg" | "3gp" | "ts" | "m2ts" | "webm"
        )
    } else {
        false
    }
}

/// Check if a path is a document file for summarization
pub fn is_document_file(path: &Path) -> bool {
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        matches!(ext.to_lowercase().as_str(),
            "txt" | "md" | "pdf" | "docx" | "doc"
        )
    } else {
        false
    }
}

/// Get the path to the virtual environment directory
pub fn get_venv_path() -> PathBuf {
    // Try to get VATS root first
    if let Ok(root) = get_vats_root() {
        let venv = root.join(".venv");
        if venv.exists() {
            return venv;
        }
    }

    // Fallback: assume venv is in current working directory's parent
    if let Ok(cwd) = env::current_dir() {
        // If we're in desktop/src-tauri, go up to root
        for ancestor in cwd.ancestors() {
            let venv = ancestor.join(".venv");
            if venv.exists() {
                return venv;
            }
        }
    }

    // Final fallback: return a path that likely won't exist
    PathBuf::from(".venv")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_media_file_detection() {
        assert!(is_media_file(Path::new("test.mp3")));
        assert!(is_media_file(Path::new("video.MP4")));
        assert!(is_media_file(Path::new("audio.wav")));
        assert!(!is_media_file(Path::new("document.txt")));
        assert!(!is_media_file(Path::new("image.jpg")));
    }

    #[test]
    fn test_document_file_detection() {
        assert!(is_document_file(Path::new("doc.txt")));
        assert!(is_document_file(Path::new("notes.md")));
        assert!(is_document_file(Path::new("report.pdf")));
        assert!(!is_document_file(Path::new("audio.mp3")));
    }
}

# VATS Desktop UI

A cross-platform Tauri 2.x + React + TypeScript desktop application for VATS (Versatile Audio Transcription & Summarization).

## Quick Start

### Start the Application

```bash
cd C:\tools\vats\desktop
npm run tauri:dev
```

This will:
1. Start the Vite dev server (frontend with hot-reload)
2. Compile and launch the Rust backend
3. Open the application window automatically

### Stop the Application

**Option 1:** Close the application window (click X)

**Option 2:** Press `Ctrl+C` in the terminal running `npm run tauri:dev`

**Option 3:** Kill the process manually:
```bash
# Windows
taskkill /F /IM vats-desktop.exe
taskkill /F /IM node.exe  # Also kills Vite dev server

# macOS/Linux
pkill -f vats-desktop
```

### Restart the Application

```bash
# Kill existing processes
taskkill /F /IM vats-desktop.exe 2>/dev/null
taskkill /F /IM node.exe 2>/dev/null

# Wait a moment
sleep 2

# Start fresh
cd C:\tools\vats\desktop
npm run tauri:dev
```

### Production Build

```bash
cd C:\tools\vats\desktop
npm run tauri:build
```

Creates installers in `src-tauri/target/release/bundle/`.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+H` | Go to Home |
| `Ctrl+,` | Open Configuration |
| `Ctrl+Q` | Quit application |
| `Esc` | Go back / Close modal |

---

## Troubleshooting

### Port 5173 Already in Use

```bash
# Kill processes using the port
taskkill /F /IM node.exe
# Or find and kill specific process
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Rust Compilation Errors

```bash
# Ensure Visual Studio Build Tools are installed
# Check for MSVC in: C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\

# Clean and rebuild
cd C:\tools\vats\desktop\src-tauri
cargo clean
cargo check
```

### Permission Denied Errors

The app needs these permissions (configured in `capabilities/default.json`):
- `dialog:allow-open` - File picker dialogs
- `shell:allow-open` - Open external URLs
- `shell:allow-execute` - Run Python commands

### Application Window Doesn't Open

1. Check if process is running: `tasklist | findstr vats`
2. Check terminal output for errors
3. Try running directly: `cd src-tauri && cargo run`

---

## Project Structure

```
C:\tools\vats\desktop\
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── commands/    # Tauri command handlers
│   │   ├── process/     # Python process executor
│   │   └── utils/       # Path/Python detection
│   ├── capabilities/    # Permission config
│   └── tauri.conf.json  # Tauri configuration
│
├── src/                 # React frontend
│   ├── features/        # Feature modules
│   ├── services/        # VATS service layer
│   ├── store/           # Zustand state
│   └── components/      # Shared UI components
│
└── package.json         # Dependencies
```

---

## Configuration

The UI reads from and writes to `C:\tools\vats\.env`. All changes are auto-saved.

### Key Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_MODEL` | AI provider (ollama, zai, gemini, etc.) | `ollama` |
| `WHISPER_MODEL` | Whisper model size | `small` |
| `PERFORMANCE_PROFILE` | Speed/balanced/quality | `balanced` |
| `GPU_MEMORY_FRACTION` | GPU VRAM allocation | `0.9` |

---

## Development

### Frontend Only (No Rust rebuild)

```bash
npm run dev
# Opens at http://localhost:5173
```

### Backend Only

```bash
cd src-tauri
cargo run
```

### Build Icons

```bash
# Icons are in src-tauri/icons/
# Required: 32x32.png, 128x128.png, 128x128@2x.png, icon.ico, icon.icns
```

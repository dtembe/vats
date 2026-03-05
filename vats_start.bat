@echo off
setlocal enabledelayedexpansion

REM VATS - Versatile Audio Transcription & Summarization
REM Windows Launcher with Interactive Menu
REM Author: Dan Tembe, Dallas, TX
REM Email: dtembe@yahoo.com

echo.
echo ========================================
echo    VATS - Versatile Audio Transcription
echo    ^& Summarization
echo    Local Processing Priority
echo    High-Performance Bulk Processing
echo ========================================
echo.

REM Set the script directory (strip trailing backslash to avoid quote escaping issues)
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set VATS_CLI=%SCRIPT_DIR%\src\vats\cli.py
set VENV_DIR=%SCRIPT_DIR%\.venv

REM Suppress harmless library warnings (torchcodec, pyannote, etc.)
set PYTHONWARNINGS=ignore
set KMP_DUPLICATE_LIB_OK=TRUE

REM ---- Auto-activate venv if it exists ----
if exist "%VENV_DIR%\Scripts\activate.bat" (
    call "%VENV_DIR%\Scripts\activate.bat"
    echo [venv] Activated VATS virtual environment
)

REM Auto-detect Python
set PYTHON_CMD=
where python >nul 2>&1
if not errorlevel 1 set PYTHON_CMD=python

REM Verify Python is available
if not defined PYTHON_CMD (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.10 or higher
    pause
    exit /b 1
)

REM Quick version check
for /f "tokens=2 delims= " %%v in ('%PYTHON_CMD% --version 2^>^&1') do set PYVER=%%v
echo [INFO] Python %PYVER%

REM Check if VATS CLI exists
if not exist "%VATS_CLI%" (
    echo ERROR: VATS CLI not found at %VATS_CLI%
    echo Please ensure the VATS project is properly installed
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist "%SCRIPT_DIR%.env" (
    echo WARNING: .env file not found
    if exist "%SCRIPT_DIR%.env.example" (
        copy "%SCRIPT_DIR%.env.example" "%SCRIPT_DIR%.env" >nul
        echo Created .env from .env.example with default settings.
        echo Please edit .env to configure your API keys and preferences.
        echo.
    ) else (
        echo Copy .env.example to .env and configure your settings.
        echo.
    )
)

:main_menu
cls
echo.
echo ========================================
echo    VATS - Main Menu
echo ========================================
echo.
echo  1. Setup / Create VATS Python Environment
echo  2. Process Single File (Optimized)
echo  3. Transcribe Only (No Summary)
echo  4. Process Multiple Files (Bulk Mode)
echo  5. High-Speed Processing Queue
echo  6. Transcribe Multiple Files (No Summary)
echo  7. Summarize Text/PDF/DOCX File
echo  8. System Status ^& Performance
echo  9. Cache Management
echo 10. Advanced Options
echo 11. Help ^& Documentation
echo 12. Activate / Deactivate VATS Environment
echo 13. Exit
echo.
set /p choice="Select an option (1-13): "

if "%choice%"=="1" goto setup_env
if "%choice%"=="2" goto single_file
if "%choice%"=="3" goto transcribe_single
if "%choice%"=="4" goto bulk_files
if "%choice%"=="5" goto speed_queue
if "%choice%"=="6" goto transcribe_bulk
if "%choice%"=="7" goto summarize_text
if "%choice%"=="8" goto system_status
if "%choice%"=="9" goto cache_management
if "%choice%"=="10" goto advanced_options
if "%choice%"=="11" goto help_docs
if "%choice%"=="12" goto env_management
if "%choice%"=="13" goto exit_script

echo Invalid choice. Please try again.
pause
goto main_menu

REM ---------------------------------------------------------------
REM 1. Setup / Create VATS Python Environment
REM ---------------------------------------------------------------
:setup_env
cls
echo.
echo ========================================
echo    Setup / Create VATS Environment
echo ========================================
echo.

REM Check if venv already exists
if exist "%VENV_DIR%\Scripts\activate.bat" (
    echo [OK] VATS virtual environment already exists at %VENV_DIR%
    echo Activating...
    call "%VENV_DIR%\Scripts\activate.bat"
    echo.
    echo Updating dependencies...
    %PYTHON_CMD% -m pip install --upgrade pip
    %PYTHON_CMD% -m pip install -e "%SCRIPT_DIR%"
    if errorlevel 1 (
        echo.
        echo Editable install failed. Falling back to requirements.txt...
        %PYTHON_CMD% -m pip install -r "%SCRIPT_DIR%requirements.txt"
    )
) else (
    echo Creating new VATS virtual environment...
    echo.
    %PYTHON_CMD% -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment.
        echo Make sure Python 3.10+ is installed with venv support.
        pause
        goto main_menu
    )
    echo [OK] Virtual environment created at %VENV_DIR%
    echo Activating...
    call "%VENV_DIR%\Scripts\activate.bat"
    echo.
    echo Installing dependencies...
    python -m pip install --upgrade pip
    python -m pip install -e "%SCRIPT_DIR%"
    if errorlevel 1 (
        echo.
        echo Editable install failed. Falling back to requirements.txt...
        python -m pip install -r "%SCRIPT_DIR%requirements.txt"
    )
)
echo.
echo Verifying installation...
%PYTHON_CMD% -m vats --help
echo.
echo ========================================
echo  VATS Environment is ready!
echo  Python: %VENV_DIR%\Scripts\python.exe
echo ========================================
echo.
pause
goto main_menu

REM ---------------------------------------------------------------
REM 2. Process Single File
REM ---------------------------------------------------------------
:single_file
cls
echo.
echo ========================================
echo    Single File Processing (Optimized)
echo ========================================
echo.
echo Features: GPU acceleration, adaptive segmentation,
echo           parallel processing, enhanced caching.
echo.
set /p file_path="Enter path to audio/video file: "

if "%file_path%"=="" (
    echo No file specified.
    pause
    goto main_menu
)

REM Strip surrounding quotes the user may have pasted
for /f "delims=" %%i in ("%file_path%") do set file_path=%%~i

if not exist "%file_path%" (
    echo ERROR: File not found: %file_path%
    pause
    goto single_file
)

echo.
echo Starting optimized processing...
echo.
%PYTHON_CMD% -m vats --verbose process "%file_path%"
echo.
pause
goto main_menu

REM ---------------------------------------------------------------
REM 3. Transcribe Only
REM ---------------------------------------------------------------
:transcribe_single
cls
echo.
echo ========================================
echo    Transcribe Only (No Summary)
echo ========================================
echo.
echo Transcribes and diarizes your audio/video without AI summary.
echo.
set /p file_path="Enter path to audio/video file: "

if "%file_path%"=="" (
    echo No file specified.
    pause
    goto main_menu
)

for /f "delims=" %%i in ("%file_path%") do set file_path=%%~i

if not exist "%file_path%" (
    echo ERROR: File not found: %file_path%
    pause
    goto transcribe_single
)

echo.
echo Starting transcription-only processing...
echo.
%PYTHON_CMD% -m vats --verbose process "%file_path%" --no-summary
echo.
pause
goto main_menu

REM ---------------------------------------------------------------
REM 4. Bulk Files
REM ---------------------------------------------------------------
:bulk_files
cls
echo.
echo ========================================
echo    Bulk File Processing
echo ========================================
echo.
echo Process multiple files concurrently with multi-GPU support.
echo.
echo  1. Enter file paths manually
echo  2. Use a directory
echo  3. Use a text file with file list
echo.
set /p bulk_choice="Choose option (1-3): "

if "%bulk_choice%"=="1" goto manual_files
if "%bulk_choice%"=="2" goto directory_files
if "%bulk_choice%"=="3" goto list_files
goto bulk_files

:manual_files
echo.
echo Enter file paths (one per line). Press Enter on blank line to finish:
set file_count=0
:manual_input
set "next_file="
set /p "next_file=File %file_count%: "
if not defined next_file goto process_manual_files
for /f "delims=" %%i in ("!next_file!") do set next_file=%%~i
if exist "!next_file!" (
    set "files[%file_count%]=!next_file!"
    set /a file_count+=1
) else (
    echo File not found: !next_file!
)
goto manual_input

:process_manual_files
if %file_count%==0 (
    echo No valid files specified.
    pause
    goto bulk_files
)

set cmd_args=%PYTHON_CMD% -m vats --verbose bulk
set /a i=0
:build_cmd
if %i% geq %file_count% goto run_manual_cmd
set cmd_args=%cmd_args% "!files[%i%]!"
set /a i+=1
goto build_cmd

:run_manual_cmd
echo.
echo Processing %file_count% files with bulk optimization...
echo.
%cmd_args%
echo.
pause
goto main_menu

:directory_files
echo.
set /p dir_path="Enter directory path: "
if "%dir_path%"=="" goto bulk_files
for /f "delims=" %%i in ("%dir_path%") do set dir_path=%%~i

if not exist "%dir_path%" (
    echo Directory not found: %dir_path%
    pause
    goto directory_files
)

echo.
set /p file_pattern="Enter file pattern (e.g., *.mp4, *.mp3, *.wav): "
if "%file_pattern%"=="" set file_pattern=*.mp4

echo.
echo Searching for %file_pattern% in %dir_path%...
set cmd_args=%PYTHON_CMD% -m vats --verbose bulk
set file_count=0

for %%f in ("%dir_path%\%file_pattern%") do (
    set cmd_args=!cmd_args! "%%f"
    set /a file_count+=1
)

if %file_count%==0 (
    echo No files found matching pattern.
    pause
    goto bulk_files
)

echo Found %file_count% files. Starting bulk processing...
echo.
%cmd_args%
echo.
pause
goto main_menu

:list_files
echo.
set /p list_file="Enter path to text file with file list: "
if "%list_file%"=="" goto bulk_files
for /f "delims=" %%i in ("%list_file%") do set list_file=%%~i
if not exist "%list_file%" (
    echo File not found: %list_file%
    pause
    goto list_files
)

echo.
echo Reading file list and starting bulk processing...
set cmd_args=%PYTHON_CMD% -m vats --verbose bulk
for /f "usebackq tokens=* delims=" %%f in ("%list_file%") do (
    set cmd_args=!cmd_args! "%%f"
)
%cmd_args%
echo.
pause
goto main_menu

REM ---------------------------------------------------------------
REM 5. High-Speed Queue
REM ---------------------------------------------------------------
:speed_queue
cls
echo.
echo ========================================
echo    High-Speed Processing Queue
echo ========================================
echo.
echo Uses "speed" profile (tiny Whisper model, aggressive
echo parallelization). Ideal for quick drafts or large batches.
echo.
set /p queue_dir="Enter directory with files to process: "
if "%queue_dir%"=="" goto main_menu
for /f "delims=" %%i in ("%queue_dir%") do set queue_dir=%%~i
if not exist "%queue_dir%" (
    echo Directory not found: %queue_dir%
    pause
    goto speed_queue
)

echo.
echo Starting high-speed processing queue...
echo.
%PYTHON_CMD% -m vats --verbose bulk "%queue_dir%\*.mp4" "%queue_dir%\*.mp3" "%queue_dir%\*.wav"
echo.
pause
goto main_menu

REM ---------------------------------------------------------------
REM 6. Transcribe Multiple (No Summary)
REM ---------------------------------------------------------------
:transcribe_bulk
cls
echo.
echo ========================================
echo    Transcribe Multiple Files (No Summary)
echo ========================================
echo.
echo  1. Enter file paths manually
echo  2. Use a directory
echo.
set /p transcribe_choice="Choose option (1-2): "

if "%transcribe_choice%"=="1" goto transcribe_manual_files
if "%transcribe_choice%"=="2" goto transcribe_directory_files
goto transcribe_bulk

:transcribe_manual_files
echo.
echo Enter file paths (one per line). Press Enter on blank line to finish:
set file_count=0
:transcribe_manual_input
set "next_file="
set /p "next_file=File %file_count%: "
if not defined next_file goto transcribe_process_manual_files
for /f "delims=" %%i in ("!next_file!") do set next_file=%%~i
if exist "!next_file!" (
    set "transcribe_files[%file_count%]=!next_file!"
    set /a file_count+=1
) else (
    echo File not found: !next_file!
)
goto transcribe_manual_input

:transcribe_process_manual_files
if %file_count%==0 (
    echo No valid files specified.
    pause
    goto transcribe_bulk
)

echo.
echo Transcribing %file_count% files (no summary)...
echo.
set /a i=0
:transcribe_run_cmd
if %i% geq %file_count% goto transcribe_manual_done
%PYTHON_CMD% -m vats --verbose process "!transcribe_files[%i%]!" --no-summary
set /a i+=1
goto transcribe_run_cmd

:transcribe_manual_done
echo.
echo Transcription-only processing complete!
pause
goto main_menu

:transcribe_directory_files
echo.
set /p dir_path="Enter directory path: "
if "%dir_path%"=="" goto transcribe_bulk
for /f "delims=" %%i in ("%dir_path%") do set dir_path=%%~i
if not exist "%dir_path%" (
    echo Directory not found: %dir_path%
    pause
    goto transcribe_directory_files
)

echo.
set /p file_pattern="Enter file pattern (e.g., *.mp4, *.mp3, *.wav): "
if "%file_pattern%"=="" set file_pattern=*.mp4

echo.
set file_count=0
for %%f in ("%dir_path%\%file_pattern%") do (
    echo Transcribing: %%f
    %PYTHON_CMD% -m vats --verbose process "%%f" --no-summary
    set /a file_count+=1
)

if %file_count%==0 (
    echo No files found matching pattern.
) else (
    echo.
    echo Transcription complete! Processed %file_count% files.
)
echo.
pause
goto main_menu

REM ---------------------------------------------------------------
REM 7. Summarize Document
REM ---------------------------------------------------------------
:summarize_text
cls
echo.
echo ========================================
echo    Summarize Text/PDF/DOCX Files
echo ========================================
echo.
echo Supports: TXT, MD, PDF, DOCX files
echo.
set /p text_file="Enter path to document: "

if "%text_file%"=="" (
    echo No file specified.
    pause
    goto main_menu
)
for /f "delims=" %%i in ("%text_file%") do set text_file=%%~i
if not exist "%text_file%" (
    echo ERROR: File not found: %text_file%
    pause
    goto summarize_text
)

echo.
echo Starting document summarization...
echo.
%PYTHON_CMD% -m vats summarize "%text_file%"
echo.
pause
goto main_menu

REM ---------------------------------------------------------------
REM 8. System Status
REM ---------------------------------------------------------------
:system_status
cls
echo.
echo ========================================
echo    System Status ^& Performance
echo ========================================
echo.
%PYTHON_CMD% -m vats --verbose status
echo.
pause
goto main_menu

REM ---------------------------------------------------------------
REM 9. Cache Management
REM ---------------------------------------------------------------
:cache_management
cls
echo.
echo ========================================
echo    Cache Management
echo ========================================
echo.
echo  1. Show Cache Statistics
echo  2. Cleanup Expired Entries
echo  3. Force Clear All Caches
echo  4. Back to Main Menu
echo.
set /p cache_choice="Select option (1-4): "

if "%cache_choice%"=="1" (
    echo.
    %PYTHON_CMD% -m vats --verbose cache stats
    pause
    goto cache_management
)
if "%cache_choice%"=="2" (
    echo.
    %PYTHON_CMD% -m vats --verbose cache cleanup
    pause
    goto cache_management
)
if "%cache_choice%"=="3" (
    echo.
    echo WARNING: This will clear all cached data
    set /p confirm="Are you sure? (y/N): "
    if /i "!confirm!"=="y" (
        %PYTHON_CMD% -m vats --verbose cache cleanup --force
    ) else (
        echo Operation cancelled.
    )
    pause
    goto cache_management
)
if "%cache_choice%"=="4" goto main_menu
goto cache_management

REM ---------------------------------------------------------------
REM 10. Advanced Options
REM ---------------------------------------------------------------
:advanced_options
cls
echo.
echo ========================================
echo    Advanced Options
echo ========================================
echo.
echo  1. Configure Performance Profile
echo  2. GPU Settings
echo  3. Memory Management
echo  4. Set Output Directory
echo  5. Configuration Check
echo  6. Reset to Defaults
echo  7. Back to Main Menu
echo.
set /p adv_choice="Select option (1-7): "

if "%adv_choice%"=="1" goto profile_config
if "%adv_choice%"=="2" goto gpu_settings
if "%adv_choice%"=="3" goto memory_settings
if "%adv_choice%"=="4" goto output_config
if "%adv_choice%"=="5" goto config_check
if "%adv_choice%"=="6" goto reset_defaults
if "%adv_choice%"=="7" goto main_menu
goto advanced_options

:profile_config
echo.
echo Performance Profiles:
echo  1. Speed    - Maximum processing speed (tiny model)
echo  2. Balanced - Good balance of speed and quality (small model)
echo  3. Quality  - Highest quality, slower processing (medium model)
echo.
set /p profile_choice="Select profile (1-3): "

if "%profile_choice%"=="1" (
    powershell -Command "(Get-Content '%SCRIPT_DIR%.env') -replace 'PERFORMANCE_PROFILE=.*', 'PERFORMANCE_PROFILE=speed' | Set-Content '%SCRIPT_DIR%.env'"
    echo Set to Speed profile.
)
if "%profile_choice%"=="2" (
    powershell -Command "(Get-Content '%SCRIPT_DIR%.env') -replace 'PERFORMANCE_PROFILE=.*', 'PERFORMANCE_PROFILE=balanced' | Set-Content '%SCRIPT_DIR%.env'"
    echo Set to Balanced profile.
)
if "%profile_choice%"=="3" (
    powershell -Command "(Get-Content '%SCRIPT_DIR%.env') -replace 'PERFORMANCE_PROFILE=.*', 'PERFORMANCE_PROFILE=quality' | Set-Content '%SCRIPT_DIR%.env'"
    echo Set to Quality profile.
)
pause
goto advanced_options

:gpu_settings
echo.
echo GPU Memory Configuration:
echo  1. Aggressive (95%% memory usage)
echo  2. Balanced  (90%% memory usage)
echo  3. Conservative (80%% memory usage)
echo  4. Custom percentage
echo.
set /p gpu_choice="Select option (1-4): "

if "%gpu_choice%"=="1" (
    powershell -Command "(Get-Content '%SCRIPT_DIR%.env') -replace 'GPU_MEMORY_FRACTION=.*', 'GPU_MEMORY_FRACTION=0.95' | Set-Content '%SCRIPT_DIR%.env'"
    echo Set to Aggressive GPU memory usage.
)
if "%gpu_choice%"=="2" (
    powershell -Command "(Get-Content '%SCRIPT_DIR%.env') -replace 'GPU_MEMORY_FRACTION=.*', 'GPU_MEMORY_FRACTION=0.90' | Set-Content '%SCRIPT_DIR%.env'"
    echo Set to Balanced GPU memory usage.
)
if "%gpu_choice%"=="3" (
    powershell -Command "(Get-Content '%SCRIPT_DIR%.env') -replace 'GPU_MEMORY_FRACTION=.*', 'GPU_MEMORY_FRACTION=0.80' | Set-Content '%SCRIPT_DIR%.env'"
    echo Set to Conservative GPU memory usage.
)
if "%gpu_choice%"=="4" (
    set /p custom_percent="Enter memory percentage (10-95): "
    if defined custom_percent (
        powershell -Command "$v=[math]::Round(!custom_percent!/100,2); (Get-Content '%SCRIPT_DIR%.env') -replace 'GPU_MEMORY_FRACTION=.*', \"GPU_MEMORY_FRACTION=$v\" | Set-Content '%SCRIPT_DIR%.env'"
        echo Set GPU memory usage to !custom_percent!%%.
    )
)
pause
goto advanced_options

:memory_settings
echo.
echo Memory Management:
echo  1. Enable model caching (recommended)
echo  2. Disable model caching (saves memory)
echo  3. Clear all caches now
echo.
set /p memory_choice="Select option (1-3): "

if "%memory_choice%"=="1" (
    powershell -Command "(Get-Content '%SCRIPT_DIR%.env') -replace 'USE_MODEL_CACHING=.*', 'USE_MODEL_CACHING=true' | Set-Content '%SCRIPT_DIR%.env'"
    echo Model caching enabled.
)
if "%memory_choice%"=="2" (
    powershell -Command "(Get-Content '%SCRIPT_DIR%.env') -replace 'USE_MODEL_CACHING=.*', 'USE_MODEL_CACHING=false' | Set-Content '%SCRIPT_DIR%.env'"
    echo Model caching disabled.
)
if "%memory_choice%"=="3" (
    %PYTHON_CMD% -m vats --verbose cache cleanup --force
    echo All caches cleared.
)
pause
goto advanced_options

:output_config
echo.
echo Current output directory: ./output (default)
set /p output_dir="Enter new output directory (leave blank to keep current): "
if not "%output_dir%"=="" (
    for /f "delims=" %%i in ("%output_dir%") do set output_dir=%%~i
    if not exist "%output_dir%" mkdir "%output_dir%"
    powershell -Command "(Get-Content '%SCRIPT_DIR%.env') -replace 'DEFAULT_OUTPUT_DIR=.*', 'DEFAULT_OUTPUT_DIR=%output_dir%' | Set-Content '%SCRIPT_DIR%.env'"
    echo Output directory set to: %output_dir%
)
pause
goto advanced_options

:config_check
cls
echo.
echo ========================================
echo    Configuration Check
echo ========================================
echo.

if exist "%SCRIPT_DIR%.env" (
    echo [OK] .env file found
    echo.
    echo Key settings:
    findstr /C:"WHISPER_MODEL" /C:"PERFORMANCE_PROFILE" /C:"AI_MODEL" /C:"GPU_MEMORY_FRACTION" /C:"MAX_CONCURRENT_FILES" "%SCRIPT_DIR%.env"
    echo.
) else (
    echo [MISSING] .env file not found
)

echo Checking GPU availability...
%PYTHON_CMD% -c "import torch; print(f'[OK] CUDA: {torch.cuda.is_available()}, devices: {torch.cuda.device_count()}' if torch.cuda.is_available() else '[INFO] No CUDA devices')" 2>nul
if errorlevel 1 echo [WARN] PyTorch not installed or unavailable

echo.
echo Checking Ollama...
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo [INFO] Ollama not running
) else (
    echo [OK] Ollama is running
)

echo.
pause
goto advanced_options

:reset_defaults
echo.
echo WARNING: This will reset all settings to defaults.
set /p confirm_reset="Are you sure? (y/N): "
if /i "!confirm_reset!"=="y" (
    if exist "%SCRIPT_DIR%.env.example" (
        copy "%SCRIPT_DIR%.env.example" "%SCRIPT_DIR%.env" >nul
        echo Settings reset to defaults.
    ) else (
        echo .env.example not found.
    )
)
pause
goto advanced_options

REM ---------------------------------------------------------------
REM 11. Help
REM ---------------------------------------------------------------
:help_docs
cls
echo.
echo ========================================
echo    Help ^& Documentation
echo ========================================
echo.
echo VATS - Versatile Audio Transcription ^& Summarization
echo.
echo Processing Modes:
echo   Single File  - Optimized single-file pipeline
echo   Bulk Mode    - Concurrent multi-file processing
echo   Speed Queue  - Maximum speed, minimal quality trade-off
echo   Transcribe   - Audio-to-text without AI summary
echo   Summarize    - Summarize existing documents (TXT/PDF/DOCX)
echo.
echo Performance Profiles:
echo   speed    - Tiny Whisper model, max parallelism
echo   balanced - Small model, good speed/quality balance
echo   quality  - Medium model, highest accuracy
echo.
echo AI Providers (set AI_MODEL in .env):
echo   ollama     - Local LLM (no API key required)
echo   gemini     - Google Gemini
echo   deepseek   - DeepSeek Chat
echo   openrouter - Claude, GPT-4, etc. via OpenRouter
echo   zai        - Z.ai GLM model
echo.
echo Cache Management:
echo   Model cache  - Persistent storage for Whisper models
echo   Result cache - Stores transcription results for reuse
echo.
echo CLI Usage:
echo   python -m vats process file.mp4
echo   python -m vats bulk *.mp4
echo   python -m vats summarize doc.pdf
echo   python -m vats status
echo   python -m vats cache stats
echo.
echo Environment:
echo   Option 1  - Create / setup VATS virtual environment
echo   Option 12 - Activate / deactivate / recreate venv
echo   Direct:   .venv\Scripts\activate.bat
echo.
echo Configuration: Edit .env file for all settings.
echo See README.md for full documentation.
echo.
pause
goto main_menu

REM ---------------------------------------------------------------
REM 12. Activate / Deactivate Environment
REM ---------------------------------------------------------------
:env_management
cls
echo.
echo ========================================
echo    VATS Environment Management
echo ========================================
echo.

if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo [WARN] No VATS virtual environment found.
    echo Use option 1 "Setup / Create VATS Python Environment" first.
    echo.
    pause
    goto main_menu
)

echo  1. Activate VATS Environment (drop into shell)
echo  2. Deactivate VATS Environment
echo  3. Recreate Environment (delete and rebuild)
echo  4. Show Environment Info
echo  5. Back to Main Menu
echo.
set /p env_choice="Select option (1-5): "

if "%env_choice%"=="1" (
    echo.
    echo Activating VATS environment...
    echo Type 'exit' to return to VATS menu.
    echo.
    call "%VENV_DIR%\Scripts\activate.bat"
    cmd
    goto env_management
)
if "%env_choice%"=="2" (
    echo.
    echo Deactivating VATS environment...
    call deactivate 2>nul
    echo [OK] Environment deactivated.
    pause
    goto env_management
)
if "%env_choice%"=="3" (
    echo.
    echo WARNING: This will delete and recreate the virtual environment.
    set /p confirm_env="Are you sure? (y/N): "
    if /i "!confirm_env!"=="y" (
        echo Removing existing environment...
        rmdir /s /q "%VENV_DIR%"
        echo Creating fresh environment...
        %PYTHON_CMD% -m venv "%VENV_DIR%"
        call "%VENV_DIR%\Scripts\activate.bat"
        python -m pip install --upgrade pip
        python -m pip install -e "%SCRIPT_DIR%"
        echo.
        echo [OK] Environment recreated and dependencies installed.
    ) else (
        echo Operation cancelled.
    )
    pause
    goto env_management
)
if "%env_choice%"=="4" (
    echo.
    echo VATS Environment Details:
    echo   Location: %VENV_DIR%
    if exist "%VENV_DIR%\Scripts\python.exe" (
        echo   Python:
        "%VENV_DIR%\Scripts\python.exe" --version
        echo   Installed packages:
        "%VENV_DIR%\Scripts\pip.exe" list 2>nul | findstr /i "whisper torch vats pyannote faster-whisper"
    )
    echo.
    pause
    goto env_management
)
if "%env_choice%"=="5" goto main_menu
goto env_management

REM ---------------------------------------------------------------
REM 13. Exit
REM ---------------------------------------------------------------
:exit_script
cls
echo.
echo Thank you for using VATS!
echo.
echo Active optimizations:
echo   - Multi-GPU acceleration
echo   - Concurrent bulk processing
echo   - Adaptive audio segmentation
echo   - Enhanced caching
echo.
echo Press any key to exit...
pause >nul
cls
exit /b 0

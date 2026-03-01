#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Process commands
            vats_desktop_lib::commands::process::process_file_stream,
            // Bulk commands
            vats_desktop_lib::commands::bulk::bulk_process,
            vats_desktop_lib::commands::bulk::speed_queue,
            // Summarize commands
            vats_desktop_lib::commands::summarize::summarize_document,
            // Status commands
            vats_desktop_lib::commands::status::get_system_status,
            // Cache commands
            vats_desktop_lib::commands::cache::cache_stats,
            vats_desktop_lib::commands::cache::cache_cleanup,
            // Config commands
            vats_desktop_lib::commands::config::get_config,
            vats_desktop_lib::commands::config::update_config,
            vats_desktop_lib::commands::config::reset_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

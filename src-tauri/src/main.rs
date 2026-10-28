#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod repository;
mod automation;
mod transfer;

#[tauri::command]
fn print_page(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![print_page,transfer::export_backup_file,transfer::restore_backup,repository::load_repository,repository::save_repository,automation::automation_diagnostics,automation::start_automation,automation::automation_status,automation::finish_login])
        .run(tauri::generate_context!())
        .expect("アプリを起動できませんでした");
}

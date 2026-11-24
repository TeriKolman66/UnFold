// #TeriKolman66
use serde::Serialize;
use std::{fs, io::Read, process::{Command, Stdio}, thread, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PythonResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
    timed_out: bool,
}

#[tauri::command]
fn run_python(code: String) -> Result<PythonResult, String> {
    if code.len() > 65_536 { return Err("Python file is too large to run (64 KB limit).".into()); }
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_nanos();
    let folder = std::env::temp_dir().join(format!("unfold-python-{}-{nonce}", std::process::id()));
    fs::create_dir(&folder).map_err(|error| error.to_string())?;
    let script = folder.join("script.py");
    let output = folder.join("stdout.txt");
    let errors = folder.join("stderr.txt");
    let result = (|| {
        fs::write(&script, code).map_err(|error| error.to_string())?;
        let start = |program: &str, launcher: bool| -> Result<std::process::Child, std::io::Error> {
            let mut command = Command::new(program);
            if launcher { command.arg("-3"); }
            command.args(["-I", "-S", "-B"]).arg(&script).current_dir(&folder)
                .stdin(Stdio::null())
                .stdout(Stdio::from(fs::File::create(&output)?))
                .stderr(Stdio::from(fs::File::create(&errors)?));
            #[cfg(windows)] {
                use std::os::windows::process::CommandExt;
                command.creation_flags(0x08000000);
            }
            command.spawn()
        };
        let mut child = start("py", true).or_else(|_| start("python", false))
            .map_err(|_| "Python 3 was not found. Install Python, then try again.".to_string())?;
        let deadline = Instant::now() + Duration::from_secs(5);
        let (status, timed_out) = loop {
            if let Some(status) = child.try_wait().map_err(|error| error.to_string())? { break (status, false); }
            if Instant::now() >= deadline {
                let _ = child.kill();
                break (child.wait().map_err(|error| error.to_string())?, true);
            }
            thread::sleep(Duration::from_millis(30));
        };
        let read_limited = |path: &std::path::Path| -> Result<String, String> {
            let mut bytes = Vec::new();
            fs::File::open(path).map_err(|error| error.to_string())?.take(32_769)
                .read_to_end(&mut bytes).map_err(|error| error.to_string())?;
            let truncated = bytes.len() > 32_768;
            bytes.truncate(32_768);
            Ok(format!("{}{}", String::from_utf8_lossy(&bytes), if truncated { "\n…output truncated" } else { "" }))
        };
        Ok(PythonResult { stdout: read_limited(&output)?, stderr: read_limited(&errors)?, exit_code: status.code(), timed_out })
    })();
    let _ = fs::remove_dir_all(&folder);
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![run_python])
        .run(tauri::generate_context!())
        .expect("error while running Unfold");
}

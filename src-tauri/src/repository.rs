use serde_json::{json, Value};
use std::{ffi::{CString,CStr,c_char,c_void,c_int},path::PathBuf,ptr};
use tauri::Manager;
#[link(name="winsqlite3")]
extern "C" {
 fn sqlite3_open_v2(name:*const c_char,db:*mut *mut c_void,flags:c_int,vfs:*const c_char)->c_int;
 fn sqlite3_exec(db:*mut c_void,sql:*const c_char,callback:Option<unsafe extern "C" fn(*mut c_void,c_int,*mut *mut c_char,*mut *mut c_char)->c_int>,data:*mut c_void,error:*mut *mut c_char)->c_int;
 fn sqlite3_close(db:*mut c_void)->c_int;
 fn sqlite3_free(p:*mut c_void);
}
pub struct Db(*mut c_void);
impl Drop for Db {fn drop(&mut self){unsafe{sqlite3_close(self.0);}}}
pub fn data_dir(app:&tauri::AppHandle)->Result<PathBuf,String>{let p=app.path().app_data_dir().map_err(|_|"保存先を取得できません")?;std::fs::create_dir_all(&p).map_err(|_|"保存先を作成できません")?;Ok(p)}
pub fn db_path(app:&tauri::AppHandle)->Result<PathBuf,String>{Ok(data_dir(app)?.join("shikomi.sqlite3"))}
impl Db{
 pub fn open(path:&std::path::Path)->Result<Self,String>{let path=CString::new(path.to_string_lossy().as_bytes()).map_err(|_|"保存先が不正です")?;let mut handle=ptr::null_mut();if unsafe{sqlite3_open_v2(path.as_ptr(),&mut handle,6|0x10000,ptr::null())}!=0{if !handle.is_null(){unsafe{sqlite3_close(handle);}}return Err("SQLiteを開けません".into());}let db=Self(handle);db.exec("PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS app_state(id INTEGER PRIMARY KEY,revision INTEGER NOT NULL,payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS board_reservations(id TEXT PRIMARY KEY,day TEXT NOT NULL,payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS board_day ON board_reservations(day); CREATE TABLE IF NOT EXISTS sync_meta(id INTEGER PRIMARY KEY,payload TEXT NOT NULL);")?;Ok(db)}
 pub fn exec(&self,sql:&str)->Result<(),String>{self.query(sql).map(|_|())}
 pub fn query(&self,sql:&str)->Result<Vec<String>,String>{unsafe extern "C" fn collect(data:*mut c_void,n:c_int,values:*mut *mut c_char,_names:*mut *mut c_char)->c_int{if n>0&&!values.is_null(){let value=*values;if !value.is_null(){(*(data as *mut Vec<String>)).push(CStr::from_ptr(value).to_string_lossy().into_owned());}}0}let sql=CString::new(sql).map_err(|_|"不正なデータです")?;let mut rows:Vec<String>=Vec::new();let mut error=ptr::null_mut();let code=unsafe{sqlite3_exec(self.0,sql.as_ptr(),Some(collect),&mut rows as *mut _ as *mut c_void,&mut error)};if !error.is_null(){unsafe{sqlite3_free(error as *mut c_void);}}if code!=0{return Err("データの読み書きに失敗しました。別の処理が終了してから再試行してください".into());}Ok(rows)}
}
pub fn quoted(v:&str)->String{format!("'{}'",v.replace('\'',"''"))}
pub fn clean_booking(value:&Value)->Value{let mut result=json!({});for key in ["id","date","source","table","servingSplit","time","people","kind","courseId","courseText","memo","pot","overrides","amountOverrides","decisions","hidden"]{if let Some(v)=value.get(key){result[key]=v.clone();}}if let Some(id)=value.get("id").and_then(Value::as_str){let suffix:String=id.chars().rev().take(5).collect::<String>().chars().rev().collect();result["name"]=json!(format!("予約 {}",suffix));}result}
#[tauri::command]
pub fn load_repository(app:tauri::AppHandle)->Result<Value,String>{let db=Db::open(&db_path(&app)?)?;let state=db.query("SELECT payload FROM app_state WHERE id=1")?.first().map(|v|serde_json::from_str::<Value>(v).map_err(|_|"保存データが破損しています")).transpose()?.unwrap_or(Value::Null);let revision=db.query("SELECT revision FROM app_state WHERE id=1")?.first().and_then(|s|s.parse::<u64>().ok()).unwrap_or(0);let board=db.query("SELECT payload FROM board_reservations ORDER BY day,id")?.iter().map(|s|serde_json::from_str::<Value>(s).map_err(|_|"予約データが破損しています")).collect::<Result<Vec<_>,_>>()?;let status=db.query("SELECT payload FROM sync_meta WHERE id=1")?.first().and_then(|s|serde_json::from_str::<Value>(s).ok()).unwrap_or(json!({"state":"未接続"}));Ok(json!({"state":state,"revision":revision,"board":board,"syncStatus":status}))}
#[tauri::command]
pub fn save_repository(app:tauri::AppHandle,state:Value,expected_revision:u64)->Result<u64,String>{let clean=clean_state(&state)?;
 let db=Db::open(&db_path(&app)?)?;db.exec("BEGIN IMMEDIATE")?;let actual=db.query("SELECT revision FROM app_state WHERE id=1")?.first().and_then(|s|s.parse::<u64>().ok()).unwrap_or(0);if actual!=expected_revision{let _=db.exec("ROLLBACK");return Err("別のウィンドウで更新されました。再起動して最新データを読み込んでください".into());}let next=actual+1;let payload=quoted(&clean.to_string());db.exec(&format!("INSERT OR REPLACE INTO app_state(id,revision,payload) VALUES(1,{},{}); COMMIT;",next,payload))?;Ok(next)}
#[cfg(test)]
mod tests {
 use super::*;
 #[test] fn sqlite_roundtrip_and_rollback(){let path=std::env::temp_dir().join(format!("shikomi-test-{}.sqlite3",std::process::id()));let db=Db::open(&path).unwrap();db.exec("CREATE TABLE IF NOT EXISTS test_values(v TEXT)").unwrap();let value="日本語メモ ' 引用";db.exec(&format!("INSERT INTO test_values VALUES({})",quoted(value))).unwrap();assert_eq!(db.query("SELECT v FROM test_values").unwrap()[0],value);db.exec("BEGIN IMMEDIATE;DELETE FROM test_values;ROLLBACK;").unwrap();assert_eq!(db.query("SELECT count(*) FROM test_values").unwrap()[0],"1");drop(db);std::fs::remove_file(path).unwrap();}
 #[test] fn excludes_customer_fields(){let v=clean_booking(&json!({"id":"abc123","name":"顧客氏名","table":"11","servingSplit":[{"size":2,"count":1}],"phone":"090","email":"a@example.com","memo":"鍋の希望"}));assert_eq!(v["table"],"11");assert_eq!(v["servingSplit"][0]["size"],2);assert!(v.get("phone").is_none());assert!(v.get("email").is_none());assert_ne!(v["name"],"顧客氏名");assert_eq!(v["memo"],"鍋の希望");}
}

pub fn clean_state(state:&Value)->Result<Value,String>{let mut clean=json!({});for key in ["settings","ingredients","recipes","sync"]{if let Some(v)=state.get(key){clean[key]=v.clone();}}if let Some(sync)=clean.get_mut("sync").and_then(Value::as_object_mut){for key in ["enabled","nearDays","farDays","nearMinutes","farHours"]{sync.remove(key);}}clean["manual"]=json!(state.get("manual").and_then(Value::as_array).ok_or("保存形式が不正です")?.iter().map(clean_booking).collect::<Vec<_>>());let mut adjustments=json!({});if let Some(rows)=state.get("adjustments").and_then(Value::as_object){for(key,v)in rows{adjustments[key]=clean_booking(v);}}clean["adjustments"]=adjustments;Ok(clean)}

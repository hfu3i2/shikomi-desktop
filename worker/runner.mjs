import {launchBoardBrowser} from './browser.mjs';
import {exportBoardCSV} from './restaurant-board.mjs';
import {selectStore,assertStore,requestKey,findNotice} from './flow.mjs';
import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile,unlink,open,mkdir,stat,rename} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {safeBoardRows,applySnapshot,validConfig,errorText} from './lib.mjs';
const args=Object.fromEntries(process.argv.slice(2).reduce((all,v,i,a)=>{if(v.startsWith('--'))all.push([v.slice(2),a[i+1]]);return all;},[]));
if(args.action==='scheduled')process.exit(0);
if(!args.db||!['login','sync'].includes(args.action))process.exit(2);
const folder=dirname(args.db);await mkdir(folder,{recursive:true});const jobPath=join(folder,'job.json'),lockPath=join(folder,'sync.lock'),authPath=join(folder,'auth.json'),confirmPath=join(folder,'login-confirm');
let lock,db,lastStage;
try{try{lock=await open(lockPath,'wx');await lock.writeFile(String(process.pid));}catch{let active=true;try{const pid=Number(await readFile(lockPath,'utf8'));process.kill(pid,0);}catch{active=false;}if(active)throw Error('ALREADY_RUNNING');await unlink(lockPath).catch(()=>{});lock=await open(lockPath,'wx');await lock.writeFile(String(process.pid));}
 db=new DatabaseSync(args.db);db.exec('PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS board_reservations(id TEXT PRIMARY KEY,day TEXT NOT NULL,payload TEXT NOT NULL);CREATE TABLE IF NOT EXISTS sync_meta(id INTEGER PRIMARY KEY,payload TEXT NOT NULL);');
 const stateRow=db.prepare('SELECT payload FROM app_state WHERE id=1').get();const config=stateRow?JSON.parse(stateRow.payload).sync:null;const metaRow=db.prepare('SELECT payload FROM sync_meta WHERE id=1').get();const meta=metaRow?JSON.parse(metaRow.payload):{};
 const status=async(value)=>{if(value.message)lastStage=value.message;const temp=jobPath+'.'+process.pid+'.tmp';await writeFile(temp,JSON.stringify({...value,action:args.action,requestId:args.request,workerPid:process.pid,at:new Date().toISOString()}));try{await rename(temp,jobPath);}catch{await writeFile(jobPath,await readFile(temp));await unlink(temp).catch(()=>{});}};
 await status({state:'running',phase:'initializing',message:'起動用ファイルを読み込んでいます…',action:args.action,startedAt:new Date().toISOString()});
 let chromium;try{({chromium}=await import('playwright'));}catch{throw Error('NOT_INSTALLED');}
 await status({state:'running',phase:'starting_browser',message:'ブラウザーを起動しています…'});let browser;try{browser=await launchBoardBrowser(chromium,config,args.action==='login');}catch(e){throw Error(e.message==='BROWSER_NOT_INSTALLED'?'BROWSER_NOT_INSTALLED':'BROWSER_LAUNCH_FAILED');}let context;
 try{
 if(args.action==='login'){
  await unlink(confirmPath).catch(()=>{});context=await browser.newContext();const page=await context.newPage();await status({state:'running',phase:'login',message:'ブラウザーを開きました。ブラウザーでログインしてください。'});await page.goto(config?.url||'https://restaurant-board.com/',{waitUntil:'domcontentloaded',timeout:60000});let confirmed=false;
  for(let i=0;i<600;i++){if(await stat(confirmPath).then(()=>true).catch(()=>false)){confirmed=true;break;}await new Promise(r=>setTimeout(r,1000));}if(!confirmed)throw Error('LOGIN_TIMEOUT');if(config?.readySelector)await page.locator(config.readySelector).waitFor({state:'visible',timeout:15000});await context.storageState({path:authPath});await unlink(confirmPath).catch(()=>{});await status({state:'success',message:config?.readySelector?'ログイン状態を保存しました。':'ログイン状態を保存しました。接続確認は未実施です。'});
 }else{
  validConfig(config);if(!await stat(authPath).then(()=>true).catch(()=>false))throw Error('NEED_LOGIN');context=await browser.newContext({storageState:authPath,acceptDownloads:true,viewport:{width:1920,height:1080}});const page=await context.newPage();
  const ranges=[{start:args.start,end:args.end,kind:'manual'}];
  let count=0;for(const range of ranges){if(!/^\d{4}-\d{2}-\d{2}$/.test(range.start)||!/^\d{4}-\d{2}-\d{2}$/.test(range.end)||range.start>range.end)throw Error('WRONG_RANGE');let csv='',createdRequest='';if(config.mode==='restaurantBoard'){csv=await exportBoardCSV(page,config,range,status);}else{await page.goto(config.url,{waitUntil:'domcontentloaded',timeout:60000});await page.locator(config.readySelector).waitFor({state:'visible',timeout:30000});
   const expand=s=>(s??'').replaceAll('{start}',range.start).replaceAll('{end}',range.end);
   for(const step of config.steps){const timeout=Math.min(600000,Math.max(1000,step.timeout??60000));if(step.action==='selectStore'){await selectStore(page,config);continue;}if(step.action==='rememberRequest'){await page.locator(expand(step.selector)).waitFor({state:'visible',timeout});createdRequest=await requestKey(page.locator(expand(step.selector)),step.attribute);continue;}if(step.action==='downloadNotice'){const locator=await findNotice(page,config,createdRequest,timeout);const downloadPromise=page.waitForEvent('download',{timeout});await locator.click({timeout});const download=await downloadPromise;try{const stream=await download.createReadStream();if(!stream)throw Error('INVALID_CSV');const chunks=[];let length=0;for await(const chunk of stream){length+=chunk.length;if(length>20*1024*1024)throw Error('INVALID_CSV');chunks.push(chunk);}const bytes=Buffer.concat(chunks);csv=new TextDecoder('utf-8').decode(bytes);if(csv.includes('\uFFFD'))csv=new TextDecoder('shift-jis').decode(bytes);}finally{await download.delete();}continue;}const locator=page.locator(expand(step.selector));if(step.action==='createCSV'){await assertStore(page,config);await locator.click({timeout});}else if(step.action==='click')await locator.click({timeout});else if(step.action==='fill')await locator.fill(expand(step.value),{timeout});else if(step.action==='wait')await locator.waitFor({state:'visible',timeout});}

   }
   const rows=safeBoardRows(csv,range.start,range.end,config.storeName);applySnapshot(db,rows,range.start,range.end);count+=rows.length;meta.lastRange=range;meta.lastAt=new Date().toISOString();meta.state='success';db.prepare('INSERT OR REPLACE INTO sync_meta(id,payload) VALUES(1,?)').run(JSON.stringify(meta));
  }await status({state:'success',message:`予約データを更新しました（${count}件）。`,count});
 }
 }finally{if(context)await context.close().catch(()=>{});await browser.close().catch(()=>{});}
}catch(error){if(error.noticeDiagnostic)await writeFile(join(folder,'notice-debug.json'),JSON.stringify(error.noticeDiagnostic)).catch(()=>{});if(error.calendarDiagnostic)await writeFile(join(folder,'calendar-debug.json'),JSON.stringify(error.calendarDiagnostic)).catch(()=>{});const code=error?.message;if(code!=='SKIP'){await writeFile(jobPath,JSON.stringify({state:'error',action:args.action,requestId:args.request,workerPid:process.pid,stage:lastStage,code,message:errorText[code]||'予約情報を取得できませんでした。ログイン状態・接続設定・通信を確認してください。',at:new Date().toISOString()})).catch(()=>{});process.exitCode=1;}
}finally{db?.close();if(lock){await lock.close();await unlink(lockPath).catch(()=>{});}}

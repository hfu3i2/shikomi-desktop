const {writeFileSync,renameSync,unlinkSync}=require('node:fs');const {join}=require('node:path');const {pathToFileURL}=require('node:url');
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
if(args.action==='scheduled')process.exit(0);
if(!args.db||!['login','sync'].includes(args.action))process.exit(2);
function readFileSyncSafe(path){return require('node:fs').readFileSync(path);}
function fail(error){const code=['ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND'].includes(error?.code)?'STARTUP_FILES_MISSING':['EACCES','EPERM'].includes(error?.code)?'DATA_ACCESS_DENIED':'STARTUP_FAILED';const message=code==='STARTUP_FILES_MISSING'?'起動に必要なファイルがありません。修正版インストーラーで入れ直してください。':code==='DATA_ACCESS_DENIED'?'保存先にアクセスできません。アプリの保存先とWindowsの保護履歴を確認してください。':'起動処理が途中で終了しました。「起動環境を確認」の結果を確認してください。';
 try{const path=join(require('node:path').dirname(args.db),'job.json');const temp=path+'.'+process.pid+'.tmp';writeFileSync(temp,JSON.stringify({state:'error',action:args.action,code,message,requestId:args.request,workerPid:process.pid,at:new Date().toISOString()}));try{renameSync(temp,path);}catch{writeFileSync(path,readFileSyncSafe(temp));try{unlinkSync(temp);}catch{}};}catch{}process.exitCode=1;
}
process.on('uncaughtException',fail);process.on('unhandledRejection',fail);
import(pathToFileURL(join(__dirname,'runner.mjs')).href).catch(fail);

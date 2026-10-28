import {access} from 'node:fs/promises';
import {join} from 'node:path';
export async function findInstalledBrowser(channel,env=process.env,exists=async p=>access(p).then(()=>true,()=>false)){
 const relative=channel==='chrome'?['Google','Chrome','Application','chrome.exe']:['Microsoft','Edge','Application','msedge.exe'];
 const drive=env.SystemDrive||'C:';const roots=[env.ProgramW6432,env.ProgramFiles,env['ProgramFiles(x86)'],env.LOCALAPPDATA,join(drive,'Program Files'),join(drive,'Program Files (x86)')].filter(Boolean);
 for(const root of [...new Set(roots)]){const file=join(root,...relative);if(await exists(file))return file;}
}
export async function launchBoardBrowser(chromium,config,login,find=findInstalledBrowser){
 const channels=config?.channel==='chromium'?[undefined]:config?.channel==='chrome'?['chrome','msedge']:['msedge','chrome'];
 for(const channel of channels){const file=channel?await find(channel):undefined;try{return await chromium.launch({headless:!login,timeout:20000,...(file?{executablePath:file}:channel?{channel}:{})});}catch(error){if(!/distribution.*not found|executable doesn't exist|not found at|not installed/i.test(String(error?.message)))throw error;}}
 throw Error('BROWSER_NOT_INSTALLED');
}

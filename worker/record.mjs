import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(join(root,'.reference'),{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--start-maximized']});
try{
 const context=await browser.newContext({viewport:null,storageState:join(process.env.APPDATA,'dev.portfolio.shikomi.demo','auth.json'),acceptDownloads:true});
 if(typeof context._showRecorder!=='function')throw Error('This Playwright version does not provide the recorder interface.');
 await context._showRecorder({language:'playwright-test',mode:'recording',outputFile:join(root,'.reference','board-recording.js'),launchOptions:{channel:'chrome',headless:false},contextOptions:{},handleSIGINT:false});
 const page=await context.newPage();
 await page.goto('https://restaurant-board.com/CLP/view/reserveListWeb/',{waitUntil:'domcontentloaded'});
 console.log('Recording. Resize the Chrome window normally. Close Chrome when finished.');
 await new Promise(r=>browser.once('disconnected',r));
}catch(e){console.error(String(e.message).split('\n')[0]);await browser.close().catch(()=>{});process.exitCode=1;}


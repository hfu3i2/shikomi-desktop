import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {initialWorkspace,cleanReservation,localDate} from '../src/workspace.ts';
import {blankReservation} from '../src/domain.ts';
import {safeBoardRows} from '../worker/lib.mjs';
import {launchBoardBrowser} from '../worker/browser.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
const {chromium}=createRequire(resolve(root,'worker/package.json'))('playwright');
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const p=resolve(dist,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!p.startsWith(dist+sep))throw Error('outside');res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(await readFile(p));}catch{res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await launchBoardBrowser(chromium,{channel:'chrome'},false);
 const page=await browser.newPage();const state=initialWorkspace();state.sync.autoFetch=false;
 const date=localDate();const board=safeBoardRows(`来店日,人数,ステータス,来店時刻,コース名,コース金額,予約依頼番号\n${date},3,来店待ち,1830,3500円コース,3500,test-time`,date,date);
 await page.addInitScript(({state,board})=>{
  window.__TAURI_INTERNALS__={invoke:async(name,args)=>{
   if(name==='load_repository')return {state,board,revision:0,syncStatus:{}};
   if(name==='save_repository')return 1;
   if(name==='automation_status')return {state:'idle'};
   throw Error('Unexpected command '+name);
  }};
 },{state,board});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.getByRole('button',{name:'仕込み表',exact:true}).click();
 const item=page.locator('.reservation-item').first();await item.click();
 assert.match(await item.innerText(),/18:30/);assert.doesNotMatch(await item.innerText(),/時間未入力/);
 assert.equal(await page.getByLabel('時間',{exact:true}).inputValue(),'18:30');
 console.log('Imported compact arrival time survives board conversion and appears as 18:30 in reservation list and time field');await page.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}

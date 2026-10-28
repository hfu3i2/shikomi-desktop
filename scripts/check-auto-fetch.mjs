import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {initialWorkspace,cleanReservation,localDate} from '../src/workspace.ts';
import {blankReservation} from '../src/domain.ts';
import {launchBoardBrowser} from '../worker/browser.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
const {chromium}=createRequire(resolve(root,'worker/package.json'))('playwright');
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const p=resolve(dist,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!p.startsWith(dist+sep))throw Error('outside');res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(await readFile(p));}catch{res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await launchBoardBrowser(chromium,{channel:'chrome'},false);
 const page=await browser.newPage();
 const state=initialWorkspace();state.sync.storeName='テスト店舗';
 await page.clock.install();
 await page.addInitScript(s=>{
  window.testState=s;window.testJob={state:'idle'};window.testCalls=[];
  window.__TAURI_INTERNALS__={invoke:async(name,args)=>{
   if(name==='load_repository')return {state:window.testState,revision:0,board:[],syncStatus:{}};
   if(name==='save_repository'){window.testState=args.state;return 1;}
   if(name==='automation_status')return window.testJob;
   if(name==='start_automation'){window.testCalls.push(args);window.testJob={state:'running',action:args.action};return;}
   throw Error('Unexpected command '+name);
  }};
 },state);
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>window.testCalls.length===1);
 assert.equal(await page.evaluate(()=>window.testCalls[0].action),'sync');
 await page.clock.fastForward(31*60_000);assert.equal(await page.evaluate(()=>window.testCalls.length),1);
 await page.evaluate(()=>window.testJob={state:'success'});await page.clock.runFor(10000);
 await page.waitForFunction(()=>window.testCalls.length===2);
 await page.evaluate(()=>window.testJob={state:'error',message:'ログインが必要',at:1});await page.clock.runFor(10000);
 await page.clock.fastForward(31*60_000);assert.equal(await page.evaluate(()=>window.testCalls.length),2);
 await page.getByRole('button',{name:'取得設定',exact:true}).click();
 assert.equal(await page.getByLabel('アプリを開いている間、自動取得する').isChecked(),true);
 assert.equal(await page.getByRole('button',{name:'ログイン画面を開く',exact:true}).count(),0);
 await page.getByRole('button',{name:'接続設定を開く',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'ログイン画面を開く',exact:true}).count(),1);
 assert.equal(await page.getByLabel('アプリを開いている間、自動取得する').count(),0);
 await page.getByRole('button',{name:'取得設定',exact:true}).click();
 await page.getByLabel('アプリを開いている間、自動取得する').uncheck();
 await page.getByLabel('自動取得の間隔（分）',{exact:true}).fill('15');await page.clock.runFor(1000);
 assert.equal(await page.evaluate(()=>window.testState.sync.autoFetch),false);
 assert.equal(await page.evaluate(()=>window.testState.sync.autoFetchMinutes),15);
 console.log('Auto fetch startup, interval, busy/error guards and settings passed');await page.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}

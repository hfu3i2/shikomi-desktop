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
 const page=await browser.newPage({viewport:{width:1360,height:920}});
 await page.clock.install({time:new Date('2026-08-15T12:00:00+09:00')});
 await page.addInitScript(s=>{if(!localStorage.getItem('portfolio.shikomi.workspace.v1'))localStorage.setItem('portfolio.shikomi.workspace.v1',JSON.stringify(s));},initialWorkspace());
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.getByRole('button',{name:'カレンダー',exact:true}).click();
 for(const size of [{width:900,height:650},{width:1024,height:768},{width:1360,height:920}]){
  await page.setViewportSize(size);
  for(const month of [0,1]){
   const result=await page.locator('.calendar-content').evaluate(el=>({overflow:el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1,cells:[...el.querySelectorAll('.calendar-grid>button')].length,inside:[...el.querySelectorAll('.calendar-grid>button')].every(b=>{const r=b.getBoundingClientRect();return r.bottom<=innerHeight+1&&r.right<=innerWidth+1&&r.height>=30;})}));
   assert.equal(result.overflow,false);assert.equal(result.inside,true);assert.equal(result.cells,month===0?31:30);
   if(month===0)await page.getByRole('button',{name:'翌月',exact:true}).click();
  }
  await page.getByRole('button',{name:'前月',exact:true}).click();
 }
 await page.setViewportSize({width:900,height:650});await page.screenshot({path:resolve(root,'calendar-v22.png')});
 await page.getByRole('button',{name:'仕込み表',exact:true}).click();
 await page.getByRole('button',{name:'サンプルで試す',exact:true}).click();
 assert.equal(await page.locator('.workflow-steps button').count(),3);
 assert.equal(await page.locator('.toolbar h1').innerText(),'予約入力・確認');
 await page.getByLabel('メモ',{exact:true}).fill('水炊き、いかの造り追加');
 await page.getByRole('button',{name:'反映',exact:true}).click();
 assert.match(await page.locator('.detail-inner').innerText(),/いかの造り/);
 await page.getByRole('button',{name:'卓・台数を確認',exact:true}).click();
 assert.equal(await page.locator('.toolbar h1').innerText(),'卓・台数確認');
 await page.getByRole('button',{name:'戻る',exact:true}).click();
 assert.equal(await page.getByLabel('メモ',{exact:true}).inputValue(),'水炊き、いかの造り追加');
 await page.getByRole('button',{name:'卓・台数を確認',exact:true}).click();
 await page.getByRole('button',{name:'印刷へ',exact:true}).click();
 assert.equal(await page.locator('.legacy-sheet').count(),1);
 console.log('Calendar fits 900x650, 1024x768, 1360x920 including six weeks; merged input/review, memo, confirmation, back and print passed');
 await page.close();
}finally{await browser?.close();await new Promise(r=>server.close(r));}

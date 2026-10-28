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
const cartePrep=process.argv.includes('--carte');
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const p=resolve(dist,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!p.startsWith(dist+sep))throw Error('outside');res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(await readFile(p));}catch{res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await launchBoardBrowser(chromium,{channel:'chrome'},false);
 for(const count of [24,60]){
  const state=initialWorkspace();for(let i=0;i<12;i++)state.settings.dishes.push({id:'test-dish-'+i,name:['いかの造り（姿造り）','若鶏の唐揚げ盛り合わせ','季節野菜と魚介の天ぷら','国産牛もつ鍋'][i%4],category:['刺し場','揚げ場','焼き場'][i%3],portions:{},calculation:{mode:i%2?'perPerson':'serving',quantity:i%2?150:1,unit:i%2?'g':'台'}});
  state.settings.courses.forEach(c=>c.dishIds=state.settings.dishes.map(d=>d.id));state.manual=Array.from({length:count},(_,i)=>cleanReservation({...blankReservation(state.settings),id:'test-'+i,people:i%3===0?5:4,courseId:state.settings.courses[i%3].id,table:String(11+i),memo:'もつ鍋'},localDate()));
  if(cartePrep){state.settings.carteRecipe=Object.fromEntries(state.settings.dishes.filter(d=>d.calculation?.mode==='perPerson').map(d=>[d.id,{tiers:[{minPeople:1,quantity:75},{minPeople:20,quantity:150}],unit:d.calculation.unit}]));state.manual.forEach((r,i)=>{if(i%4===0){r.kind='carte';r.courseId='__carte__';}});}
  const page=await browser.newPage({viewport:{width:1360,height:1000}});await page.addInitScript(s=>localStorage.setItem('portfolio.shikomi.workspace.v1',JSON.stringify(s)),state);await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'仕込み表',exact:true}).click();await page.getByRole('button',{name:'卓・台数を確認',exact:true}).click();await page.getByRole('button',{name:'印刷へ',exact:true}).click();await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  for(const media of ['screen','print']){await page.emulateMedia({media});const result=await page.locator('.legacy-sheet').evaluate(el=>({font:el.style.fontSize,overflow:[el,...el.querySelectorAll('.measure-box')].filter(x=>x.scrollWidth>x.clientWidth+1||x.scrollHeight>x.clientHeight+1).length,wrappedNames:[...el.querySelectorAll('h4')].filter(x=>x.getBoundingClientRect().height>parseFloat(getComputedStyle(x).lineHeight)+1).length,splitBookings:[...el.querySelectorAll('.legacy-reservation-line')].filter(x=>getComputedStyle(x).flexWrap!=='nowrap').length}));assert.equal(result.overflow,0);assert.equal(result.wrappedNames,0);assert.equal(result.splitBookings,0);console.log(JSON.stringify({bookings:count,cartePrep,media,...result}));}
  await page.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}

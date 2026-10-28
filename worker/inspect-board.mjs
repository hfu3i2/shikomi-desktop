import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let stage='Launch Chrome';
const result={};
const save=async()=>{await mkdir(join(root,'.reference'),{recursive:true});await writeFile(join(root,'.reference','board-controls.json'),JSON.stringify({...result,stage},null,2));};
const browser=await chromium.launch({channel:'chrome',headless:false,args:['--start-maximized']});
try{
 const context=await browser.newContext({viewport:null,storageState:join(process.env.APPDATA,'dev.portfolio.shikomi.demo','auth.json')});
 const page=await context.newPage();
 stage='Open reservation list';console.log(stage);
 await page.goto('https://restaurant-board.com/CLP/view/reserveListWeb/',{waitUntil:'domcontentloaded'});
 stage='Open CSV export';console.log(stage);
 await page.getByRole('button',{name:'CSV出力',exact:true}).click();
 await page.getByRole('button',{name:'CSVファイルを出力する',exact:true}).waitFor({state:'visible',timeout:30000});
 const stores=await page.locator('.checkbox.col').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height>0).map(e=>({checkbox:e.outerHTML,parent:e.parentElement?.outerHTML})));
 result.stores=stores;await save();
 stage='Open date picker';console.log(stage);
 const picker=page.locator('.date-range-picker-wrap:visible .date-range-label').last();
 await picker.click();
 await page.getByRole('button',{name:'\u7d5e\u308a\u8fbc\u3080',exact:true}).last().waitFor({state:'visible'});
 result.dateControls=await page.locator('input,select,button,[role=gridcell],[role=columnheader]').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height>0).map(e=>({tag:e.tagName,id:e.id,class:e.className,type:e.getAttribute('type'),placeholder:e.getAttribute('placeholder'),label:e.getAttribute('aria-label'),text:e.tagName==='BUTTON'?e.innerText:null})));
 result.dateNumbers=await page.locator('span,td,div,button').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height>0&&/^\d{1,4}(?:[\u5e74\u6708\u65e5])?$/.test(e.textContent.trim())&&e.childElementCount<2).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.trim(),attrs:[...e.attributes].filter(a=>/date|day|aria-label/.test(a.name)).map(a=>[a.name,a.value]),parentClass:e.parentElement?.className,parentTag:e.parentElement?.tagName})).slice(0,250));
 const dates=await page.locator('.date-range-picker-wrap').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height>0).map(e=>e.outerHTML));
 result.dates=dates;result.calendars=await page.locator('[class*=calendar]').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height>0&&!e.parentElement?.closest('[class*=calendar]')).map(e=>e.outerHTML));await save();
 stage='Open messages';console.log(stage);
 // Navigate away without requesting a CSV or changing the selected stores.
 await page.goto('https://restaurant-board.com/CLP/view/reserveListWeb/',{waitUntil:'domcontentloaded'});
 await page.getByRole('link',{name:'メッセージ'}).click();
 stage='Open system notifications';console.log(stage);
 await page.getByText(/^システム通知/).click({timeout:30000});
 await page.getByRole('button',{name:'ダウンロードする',exact:true}).first().waitFor({state:'visible',timeout:30000});
 stage='Read completed CSV notifications';console.log(stage);
 const notices=await page.locator('[id^="msg-"]').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height>0).map(e=>({id:e.id,html:e.outerHTML})).slice(0,8));
 result.notices=notices;stage='Complete';await save();
 console.log('Saved: .reference/board-controls.json');
}catch(e){console.error('Stopped at: '+stage);console.error(e.message);await save().catch(()=>{});process.exitCode=1;}finally{await browser.close();}

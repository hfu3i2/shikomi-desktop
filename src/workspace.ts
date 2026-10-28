import {cartePrep,isCarteReservation,type CalculatedDish,blankReservation,calculated,carteName,defaults,normalizeSettings,type Reservation,type Settings} from './domain.ts';
export type DatedReservation=Reservation&{date:string;source:'manual'|'board'};
export type BoardRow={id:string;date:string;time:string;people:number;courseText:string;coursePrice:number;memo:string;table:string};
export type Ingredient={id:string;name:string;unit:string;stock:number;packSize:number;buffer:number};
export type Recipe={dishId:string;ingredientId:string;amount:number;basis:'dishUnit'|'person'};
export type SyncConfig={autoFetch:boolean;autoFetchMinutes:number;mode:'restaurantBoard'|'custom';noticeWaitMinutes:number;storeName:string;storeRowsSelector:string;storeNameSelector:string;storeCheckboxSelector:string;notificationRowsSelector:string;notificationKeySelector:string;notificationKeyAttribute:string;notificationDownloadSelector:string;fetchDays:number;url:string;readySelector:string;steps:SyncStep[];channel:'chrome'|'msedge'|'chromium'};
export type SyncStep={action:'click'|'fill'|'wait'|'selectStore'|'createCSV'|'rememberRequest'|'downloadNotice';selector:string;value?:string;timeout?:number;attribute?:string};
export type Workspace={settings:Settings;manual:DatedReservation[];adjustments:Record<string,Partial<DatedReservation>&{hidden?:boolean}>;ingredients:Ingredient[];recipes:Recipe[];sync:SyncConfig};
export const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function addDays(day:string,days:number){const d=new Date(`${day}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function initialWorkspace(settings=defaults):Workspace{return {settings:normalizeSettings(structuredClone(settings)),manual:[],adjustments:{},ingredients:[],recipes:[],sync:{autoFetch:false,autoFetchMinutes:30,mode:'restaurantBoard',noticeWaitMinutes:10,storeName:'',storeRowsSelector:'',storeNameSelector:'',storeCheckboxSelector:'input[type="checkbox"]',notificationRowsSelector:'',notificationKeySelector:'',notificationKeyAttribute:'',notificationDownloadSelector:'',fetchDays:30,url:'https://restaurant-board.com/CLP/view/reserveListWeb/',readySelector:'',steps:[],channel:'chrome'}};}
export function cleanReservation(r:Reservation&{date?:string;source?:string},fallback:string):DatedReservation{
 return {id:r.id,date:r.date||fallback,source:r.source==='board'?'board':'manual',name:`予約 ${r.id.slice(-5)}`,table:r.table??'',servingSplit:r.servingSplit,time:r.time,people:r.people,kind:r.kind,courseId:r.courseId,courseText:r.courseText,memo:r.memo,pot:r.pot,overrides:r.overrides??{},amountOverrides:r.amountOverrides??{},decisions:r.decisions??{}};
}
export function boardReservation(row:BoardRow,s:Settings):DatedReservation{
 const exact=s.courses.find(c=>c.name===row.courseText),partial=s.courses.find(c=>row.courseText.includes(c.name)),byPrice=s.courses.filter(c=>row.coursePrice>0&&c.price===row.coursePrice);const course=exact??partial??(byPrice.length===1?byPrice[0]:undefined),carte=!course||carteName(row.courseText);
 return {...blankReservation(s),id:`board-${row.id}`,date:row.date,source:'board',name:`予約 ${row.id.slice(-5)}`,time:row.time,people:row.people,table:row.table,courseText:row.courseText,courseId:carte?'__carte__':course.id,kind:carte?'carte':'course',memo:row.memo};
}
export function combinedReservations(state:Workspace,board:BoardRow[]):DatedReservation[]{return [...state.manual.map(r=>cleanReservation(r,r.date)),...board.map(b=>{const base=boardReservation(b,state.settings);const a=state.adjustments[base.id];return a?.hidden?null:cleanReservation({...base,...a,id:base.id,date:base.date,source:'board'},base.date);}).filter((r):r is DatedReservation=>!!r)].sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));}
export function updateDay(state:Workspace,board:BoardRow[],day:string,next:Reservation[]):Workspace{
 const old=combinedReservations(state,board).filter(r=>r.date===day),adjustments={...state.adjustments};const clean=next.map(r=>cleanReservation(r,day));
 for(const r of old.filter(r=>r.source==='board'))if(!clean.some(x=>x.id===r.id))adjustments[r.id]={hidden:true};
 for(const r of clean.filter(r=>r.source==='board')){const previous=old.find(x=>x.id===r.id);const a={...adjustments[r.id],hidden:false};for(const key of ['table','servingSplit','time','people','kind','courseId','courseText','memo','pot','overrides','amountOverrides','decisions'] as const){if(!previous||JSON.stringify(r[key])!==JSON.stringify(previous[key]))Object.assign(a,{[key]:r[key]});}adjustments[r.id]=a;}
 return {...state,manual:[...state.manual.filter(r=>r.date!==day),...clean.filter(r=>r.source==='manual')],adjustments};
}
export function ingredientNeeds(rows:DatedReservation[],state:Workspace,start:string,end:string){
 const totals=new Map<string,number>();const missing=new Set<string>();
 const add=(dish:CalculatedDish,people:number)=>{const recipes=state.recipes.filter(x=>x.dishId===dish.id);if(!recipes.length)missing.add(dish.name);for(const recipe of recipes){if(!state.ingredients.some(i=>i.id===recipe.ingredientId))continue;const basis=recipe.basis==='person'?people:dish.total;totals.set(recipe.ingredientId,(totals.get(recipe.ingredientId)??0)+basis*recipe.amount);}};
 const carteByDay=new Map<string,number>();
 for(const r of rows.filter(r=>r.date>=start&&r.date<=end)){if(isCarteReservation(r,state.settings))carteByDay.set(r.date,(carteByDay.get(r.date)??0)+r.people);else for(const dish of calculated(r,state.settings).rows)add(dish,r.people);}
 for(const people of carteByDay.values())for(const dish of cartePrep(people,state.settings))add(dish,people);
 const items=state.ingredients.map(i=>{const required=Math.round((totals.get(i.id)??0)*1000)/1000;const shortage=Math.max(0,Math.round((required+(required>0?i.buffer:0)-i.stock)*1000)/1000);return {...i,required,shortage,packs:shortage>0?Math.ceil((shortage-1e-9)/i.packSize):0};}).filter(i=>i.required>0);
 return {items,missing:[...missing]};
}

export function normalizeSyncConfig(value:unknown):SyncConfig{const base=initialWorkspace().sync;const source=value&&typeof value==='object'?value as Record<string,unknown>:{};const result={...base};for(const key of Object.keys(base) as (keyof SyncConfig)[])if(source[key]!==undefined)Object.assign(result,{[key]:source[key]});if(!Number.isInteger(result.fetchDays)||result.fetchDays<1||result.fetchDays>366)result.fetchDays=base.fetchDays;if(typeof result.autoFetch!=='boolean')result.autoFetch=base.autoFetch;if(!Number.isInteger(result.autoFetchMinutes)||result.autoFetchMinutes<5||result.autoFetchMinutes>1440)result.autoFetchMinutes=base.autoFetchMinutes;return result;}

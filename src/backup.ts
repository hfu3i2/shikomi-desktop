import {settingsValid,normalizeSettings,validateQuantities,validateTables,type Reservation} from './domain.ts';
import {initialWorkspace,normalizeSyncConfig,cleanReservation,type Workspace,type BoardRow} from './workspace.ts';
export type Backup={format:'shikomi-backup';version:1;createdAt:number|string;state:Workspace;board:BoardRow[]};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const day=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
function validBooking(r:Record<string,unknown>):boolean{
 for(const k of ['table','time','kind','courseId','courseText','memo','pot'])if(r[k]!==undefined&&typeof r[k]!=='string')return false;
 if(r.people!==undefined&&(!Number.isInteger(r.people)||Number(r.people)<1||Number(r.people)>999))return false;
 const portions=(v:unknown)=>Array.isArray(v)&&v.every(p=>object(p)&&Number.isInteger(p.size)&&Number(p.size)>0&&Number.isInteger(p.count)&&Number(p.count)>0);
 if(r.servingSplit!==undefined&&!portions(r.servingSplit))return false;
 if(r.overrides!==undefined&&(!object(r.overrides)||!Object.values(r.overrides).every(portions)))return false;
 if(r.amountOverrides!==undefined&&(!object(r.amountOverrides)||!Object.values(r.amountOverrides).every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)))return false;
 if(r.decisions!==undefined&&(!object(r.decisions)||!Object.values(r.decisions).every(v=>typeof v==='boolean')))return false;
 if(r.hidden!==undefined&&typeof r.hidden!=='boolean')return false;return true;
}
export function parseBackup(raw:unknown):Backup{
 if(!object(raw)||raw.format!=='shikomi-backup'||raw.version!==1||!object(raw.state)||!Array.isArray(raw.board))throw Error('対応していないバックアップ形式です');
 const value=raw.state;if(!settingsValid(value.settings)||!Array.isArray(value.manual)||!Array.isArray(value.ingredients)||!Array.isArray(value.recipes)||!object(value.adjustments))throw Error('バックアップの設定が不正です');
 const settings=normalizeSettings(value.settings);const validation=validateQuantities(settings)||validateTables(settings.tables??[]);if(validation)throw Error(validation);
 for(const r of value.manual){if(!object(r)||typeof r.id!=='string'||!day(r.date)||!Number.isInteger(r.people)||Number(r.people)<1||Number(r.people)>999||typeof r.memo!=='string'||typeof r.time!=='string'||!validBooking(r))throw Error('手入力予約の形式を確認してください');}
 for(const x of value.ingredients){if(!object(x)||typeof x.id!=='string'||typeof x.name!=='string'||typeof x.unit!=='string'||![x.stock,x.buffer,x.packSize].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)||Number(x.packSize)<=0)throw Error('食材・在庫の形式を確認してください');}
 for(const x of value.recipes){if(!object(x)||typeof x.dishId!=='string'||typeof x.ingredientId!=='string'||typeof x.amount!=='number'||!Number.isFinite(x.amount)||x.amount<0||!['person','dishUnit'].includes(String(x.basis)))throw Error('発注設定の形式を確認してください');}
 const ids=new Set<string>();const board=raw.board.map(r=>{if(!object(r)||typeof r.id!=='string'||!r.id||ids.has(r.id)||!day(r.date)||!Number.isInteger(r.people)||Number(r.people)<1||Number(r.people)>999||!['time','courseText','memo','table'].every(k=>typeof r[k]==='string')||typeof r.coursePrice!=='number'||!Number.isFinite(r.coursePrice))throw Error('取得予約の形式・重複を確認してください');ids.add(r.id);return {id:r.id,date:r.date,time:r.time,people:r.people,courseText:r.courseText,coursePrice:r.coursePrice,memo:r.memo,table:r.table} as BoardRow;});
 const sync=normalizeSyncConfig(value.sync);const safeSync={...initialWorkspace().sync,autoFetch:sync.autoFetch,autoFetchMinutes:sync.autoFetchMinutes,storeName:sync.storeName,fetchDays:sync.fetchDays,noticeWaitMinutes:sync.noticeWaitMinutes,channel:sync.channel==='chrome'?'chrome' as const:'msedge' as const};
 const adjustments:Workspace['adjustments']={};for(const [id,r] of Object.entries(value.adjustments)){if(!object(r)||!validBooking(r))throw Error('手動変更の形式が不正です');const clean:Record<string,unknown>={};for(const key of ['table','servingSplit','time','people','kind','courseId','courseText','memo','pot','overrides','amountOverrides','decisions','hidden'])if(r[key]!==undefined)clean[key]=r[key];adjustments[id]=clean;}
 return {format:'shikomi-backup',version:1,createdAt:typeof raw.createdAt==='string'||typeof raw.createdAt==='number'?raw.createdAt:'',state:{...initialWorkspace(settings),manual:(value.manual as (Reservation&{date:string})[]).map(r=>cleanReservation(r,r.date)),ingredients:value.ingredients as Workspace['ingredients'],recipes:value.recipes as Workspace['recipes'],adjustments,sync:safeSync},board};
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAutoFetch} from './autoFetch.ts';
import {normalizeSyncConfig} from './workspace.ts';

test('起動時・指定間隔のみ取得し、OFF・店舗未設定・実行中・エラー中は取得しない',async()=>{
 const scheduler=createAutoFetch(),options={enabled:true,minutes:30,storeName:'店舗',blocked:false};let calls=0;
 const run=async()=>{calls++;};
 await scheduler.tick(0,{...options,storeName:''},run);
 await scheduler.tick(0,{...options,blocked:true},run);assert.equal(calls,0);
 await scheduler.tick(0,options,run);assert.equal(calls,1);
 await scheduler.tick(29*60_000,options,run);assert.equal(calls,1);
 await scheduler.tick(30*60_000,options,run);assert.equal(calls,2);
 await scheduler.tick(60*60_000,{...options,enabled:false},run);assert.equal(calls,2);
 await scheduler.tick(60*60_000,options,run);assert.equal(calls,3);
});
test('非同期取得の開始待ち中も重複実行しない',async()=>{
 const scheduler=createAutoFetch(),options={enabled:true,minutes:5,storeName:'店舗',blocked:false};let calls=0,finish!:()=>void;
 const first=scheduler.tick(0,options,async()=>{calls++;await new Promise<void>(resolve=>finish=resolve);});
 await scheduler.tick(600_000,options,async()=>{calls++;});assert.equal(calls,1);finish();await first;
 await scheduler.tick(600_000,options,async()=>{calls++;});assert.equal(calls,2);
});
test('自動取得設定の移行・保存往復と不正な間隔の補正',()=>{
 assert.equal(normalizeSyncConfig({}).autoFetch,false);
 const s=normalizeSyncConfig(JSON.parse(JSON.stringify({autoFetch:false,autoFetchMinutes:15})));
 assert.equal(s.autoFetch,false);assert.equal(s.autoFetchMinutes,15);
 for(const v of [0,4,1441,1.5,'10'])assert.equal(normalizeSyncConfig({autoFetchMinutes:v}).autoFetchMinutes,30);
});


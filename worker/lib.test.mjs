import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseReservationTime,reservationTime} from './reservation-time.mjs';

test('予約時間のコロン・全角・数字・日時・日本語表記を取り込む',()=>{
 for(const [raw,time] of [['18:00','18:00'],['9:05:00','09:05'],['１８：３０','18:30'],['1800','18:00'],['905','09:05'],['0000','00:00'],['2026/10/22 18:45','18:45'],['18時30分','18:30'],['18時半','18:30']])assert.equal(parseReservationTime(raw),time);
 for(const raw of ['',null,'未定','20261022','25:00','18:90','18000'])assert.equal(parseReservationTime(raw),'');
 assert.equal(reservationTime({'開始時間':'','来店時刻':'１９：００'}),'19:00');
 assert.equal(reservationTime({' 予約 時間 ':'1900'}),'19:00');
});

test('自動取得の時間列の違い・数字表記を扱い、既存予約の識別子を変更しない',()=>{
 for(const header of ['開始時間','予約時間','来店時間','来店時刻','予約日時']){
  const csv=`来店日,人数,ステータス,${header},テーブル,コース名\n20261022,3,来店待ち,1830,11,4000円コース`;
  const [row]=safeBoardRows(csv,'2026-10-22','2026-10-22');assert.equal(row.time,'18:30');
  assert.equal(row.id,createHash('sha256').update('2026-10-22||11|4000円コース|0').digest('hex'));
 }
 const [row]=safeBoardRows('来店日,人数,ステータス,開始時間,予約依頼番号\n20261022,3,来店待ち,18:30,booking-1','2026-10-22','2026-10-22');
 assert.equal(row.id,createHash('sha256').update('booking-1|0').digest('hex'));assert.equal(row.time,'18:30');
});
import {DatabaseSync} from 'node:sqlite';
import {safeBoardRows,applySnapshot,validConfig} from './lib.mjs';
test('顧客項目を破棄し、メモと要望を残す',()=>{const r=safeBoardRows('来店日,人数,ステータス,予約者名,電話番号,メール,メモ,要望\n2026/10/19,5,来店待ち,秘密,09000000000,a@example.com,もつ,追加料理','2026-10-19','2026-10-19');assert.equal(r.length,1);const text=JSON.stringify(r);assert(!text.includes('秘密'));assert(!text.includes('09000000000'));assert(!text.includes('example.com'));assert(text.includes('もつ'));assert(text.includes('追加料理'));});
test('取得範囲の取消を反映し範囲外を保持、書込失敗はロールバック',()=>{const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE board_reservations(id TEXT PRIMARY KEY,day TEXT,payload TEXT)');applySnapshot(db,[{id:'a',date:'2026-10-19'},{id:'b',date:'2026-10-20'}],'2026-10-19','2026-10-20');assert.throws(()=>applySnapshot(db,[{id:'b',date:'2026-10-19'}],'2026-10-19','2026-10-19'));assert.equal(db.prepare('SELECT count(*) as n FROM board_reservations').get().n,2);applySnapshot(db,[],'2026-10-19','2026-10-19');assert.equal(db.prepare('SELECT count(*) as n FROM board_reservations').get().n,1);db.close();});
test('不正CSVや期間不一致、未設定の取得手順を拒否',()=>{assert.throws(()=>safeBoardRows('人数\n3','2026-10-19','2026-10-19'));assert.throws(()=>safeBoardRows('来店日,人数,ステータス\n2026/10/20,3,来店待ち','2026-10-19','2026-10-19'));assert.throws(()=>validConfig({url:'https://example.com'}));});
test('Restaurant Board compact YYYYMMDD dates are supported and validated',async()=>{const {parseBoardDate}=await import('./lib.mjs');assert.equal(parseBoardDate('20261019'),'2026-10-19');assert.equal(parseBoardDate('2026/10/19'),'2026-10-19');assert.equal(parseBoardDate('2026-10-19'),'2026-10-19');assert.throws(()=>parseBoardDate('20260230'),/INVALID_DATE/);assert.throws(()=>parseBoardDate('20261301'),/INVALID_DATE/);assert.throws(()=>parseBoardDate(''),/INVALID_DATE/);const rows=safeBoardRows('来店日,人数,ステータス\n20261019,5,来店待ち','2026-10-19','2026-10-19');assert.equal(rows[0].date,'2026-10-19');assert.throws(()=>safeBoardRows('来店日,人数,ステータス\n20261020,5,来店待ち','2026-10-19','2026-10-19'),/WRONG_RANGE/);});

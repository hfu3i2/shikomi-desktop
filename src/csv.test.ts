import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importCSV} from './csv.ts';
import {defaults} from './domain.ts';

test('時間列の別名と数字・全角・日時を手動CSVでも自動取得と同じ形で取り込む',async()=>{
 for(const [header,raw,expected] of [['来店時刻','1830','18:30'],['開始時間','９：０５','09:05'],['予約日時','2026/10/22 19:00','19:00']]){
  const text=`人数,コース名,${header}\n3,3500円コース,${raw}`;
  const {rows}=await importCSV(new File([text],'time.csv'),defaults,'2026-10-22');assert.equal(rows[0].time,expected);
 }
 const {rows}=await importCSV(new File(['人数,開始時間,予約時間\n3,,1800'],'time.csv'),defaults);assert.equal(rows[0].time,'18:00');
});
test('旧アプリ互換：来店待ちのみ、コース金額で照合、予約名がなくても取り込める',async()=>{
 const text='ステータス,人数,コース名,コース金額,メモ\n来店待ち,5,選べる鍋プラン,4000,水炊き\nキャンセル,3,選べる鍋プラン,4000,\n';
 const result=await importCSV(new File([text],'test.csv'),defaults);
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].courseId,'4000');assert.equal(result.rows[0].people,5);assert.equal(result.rows[0].memo,'水炊き');assert.equal(result.warnings.length,1);
});
test('コース名のカンマ・改行・引用符と予約メモを保ったまま取り込む',async()=>{
 const text='予約名,人数,コース名,メモ\n予約A,4,4000円コース,"いかの造り追加,\n水炊き"';
 const result=await importCSV(new File([text],'test.csv'),defaults);
 assert.equal(result.rows[0].memo,'いかの造り追加,\n水炊き');assert.equal(result.rows[0].courseId,'4000');
});
test('席のみ・コース空欄・未登録のコース名をすべてカルトにする',async()=>{
 const text='人数,コース名\n3,お席のみ\n4,\n5,新しい6000円コース';
 const result=await importCSV(new File([text],'test.csv'),defaults);assert.equal(result.rows[0].kind,'carte');assert.equal(result.rows[1].kind,'carte');assert.equal(result.rows[2].kind,'carte');assert.equal(result.rows[2].courseId,'__carte__');assert.equal(result.rows[2].courseText,'新しい6000円コース');assert.equal(result.warnings.length,0);
});

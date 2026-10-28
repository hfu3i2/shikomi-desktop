import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankReservation,defaults,normalizeSettings,validateQuantities} from './domain.ts';
import {initialWorkspace} from './workspace.ts';
import {parseBackup} from './backup.ts';
import {buildPrintModel} from './printModel.ts';

test('鍋設定・メモ判定・表示文字を保存復元しても人数と台数を維持する',()=>{
 const s=normalizeSettings(structuredClone(defaults));
 s.courses[0].potType='choice';s.potLabels={motsu:'M',mizutaki:'W',choice:'OR',none:'なし'};
 const backup=parseBackup(JSON.parse(JSON.stringify({format:'shikomi-backup',version:1,createdAt:0,state:initialWorkspace(s),board:[]})));
 assert.deepEqual(backup.state.settings.potLabels,s.potLabels);
 const saved=backup.state.settings;
 for(const [memo,mark] of [['もつ鍋で','M'],['水炊き希望','W'],['','OR'],['お祝い','OR'],['もつ鍋か水炊き','OR']]){
  const model=buildPrintModel([{...blankReservation(saved),people:5,memo}],saved),group=model.courseGroups[0];
  assert.equal(group.reservations[0].mark,mark);assert.equal(group.people,5);
  assert.deepEqual(group.reservations[0].servings,[{size:2,count:1},{size:3,count:1}]);
 }
 for(const [type,mark] of [['motsu','M'],['mizutaki','W'],['none','なし']] as const){saved.courses[0].potType=type;assert.equal(buildPrintModel([{...blankReservation(saved),memo:'もつ鍋と水炊き'}],saved).courseGroups[0].reservations[0].mark,mark);}
 saved.potLabels!.choice=' ';assert.ok(validateQuantities(saved));
});

test('旧コース設定から鍋種別を補完し表示文字を初期化する',()=>{
 const s=structuredClone(defaults);s.courses=[{id:'m',name:'もつ鍋',dishIds:['pot']},{id:'w',name:'水炊き',dishIds:['pot']},{id:'or',name:'もつ鍋or水炊き',dishIds:['pot']},{id:'no',name:'鍋なし',dishIds:['starter']}];
 const migrated=normalizeSettings(s);assert.deepEqual(migrated.courses.map(c=>c.potType),['motsu','mizutaki','choice','none']);assert.deepEqual(migrated.potLabels,{motsu:'もつ',mizutaki:'水',choice:'or',none:'×'});
});
test('前の表と同じ金額別コース・鍋印・盛り分け・ポジション集計になる',()=>{
 const s=structuredClone(defaults);const r1={...blankReservation(s),id:'a',courseId:'4000',people:5,memo:'水炊き'};const r2={...blankReservation(s),id:'b',courseId:'4000',people:4,pot:'もつ鍋'};
 const m=buildPrintModel([r1,r2],s),c=m.courseGroups.find(c=>c.price===4000)!;
 assert.equal(c.people,9);assert.equal(c.reservations[0].mark,'水');assert.deepEqual(c.reservations[0].servings,[{size:2,count:1},{size:3,count:1}]);
 assert.equal(m.categories.find(c=>c.name==='前菜')?.items[0].total,3);
 const pots=m.categories.find(c=>c.name==='鍋')!.items;assert.equal(pots.length,2);assert.equal(pots.find(p=>p.name==='水炊き')?.total,2);assert.equal(pots.find(p=>p.name==='もつ鍋')?.total,1);
 assert.equal(m.courseGroups.find(c=>c.price===3500)?.people,0);
});
test('同じ価格のコースは上段でまとめ、料理の単位と1人分量は混同しない',()=>{
 const s=structuredClone(defaults);s.dishes.push({id:'meat',name:'肉',category:'焼き場',portions:{},calculation:{mode:'perPerson',quantity:80,unit:'g'}});
 s.courses[1].dishIds.push('meat');s.courses.push({id:'4000-alt',name:'別4000コース',price:4000,dishIds:['meat'],recipe:{meat:{mode:'perPerson',quantity:60,unit:'g'}}});
 const r1={...blankReservation(s),id:'a',courseId:'4000',people:5};const r2={...blankReservation(s),id:'b',courseId:'4000-alt',people:3};
 const m=buildPrintModel([r1,r2],s),meat=m.categories.find(c=>c.name==='焼き場')!.items[0];assert.equal(m.courseGroups.filter(c=>c.price===4000).length,1);assert.equal(m.courseGroups.find(c=>c.price===4000)?.people,8);assert.equal(meat.total,580);assert.equal(meat.details.length,2);assert.equal(meat.unit,'g');
});
test('未定・鍋なしの印と手動数量をそのまま引き継ぐ',()=>{
 const s=structuredClone(defaults);s.courses.push({id:'no-pot',name:'鍋なし',price:4500,dishIds:['starter']});
 const r1={...blankReservation(s),id:'a',people:5};const r2={...blankReservation(s),id:'b',courseId:'no-pot',people:4,overrides:{starter:[{size:4,count:2}]}};
 const m=buildPrintModel([r1,r2],s);assert.equal(m.courseGroups.find(c=>c.price===3500)?.reservations[0].mark,'or');assert.equal(m.courseGroups.find(c=>c.price===4500)?.reservations[0].mark,'×');assert.equal(m.categories.find(c=>c.name==='前菜')?.items[0].total,4);
});
test('カルトは合計人数のみ。コース欄・盛り付け・キーワード仕込みに入れない',()=>{
 const s=structuredClone(defaults);const course={...blankReservation(s),id:'course',courseId:'4000',people:5,pot:'水炊き'};
 const carte={...blankReservation(s),id:'carte',kind:'carte' as const,courseId:'__carte__',people:7,memo:'いかの造り追加',decisions:{'squid-add':true},overrides:{squid:[{size:7,count:1}]}};
 const second={...carte,id:'carte2',people:3};const m=buildPrintModel([course,carte,second],s);
 assert.equal(m.cartePeople,10);assert.equal(m.totalPeople,15);assert.equal(m.courseGroups.reduce((n,c)=>n+c.people,0),5);assert.equal(m.categories.find(c=>c.name==='前菜')?.items[0].total,2);assert.equal(m.categories.some(c=>c.items.some(i=>i.id==='squid')),false);
});
test('旧設定のカルトコースも上段に独立したコース枠を作らない',()=>{
 const s=structuredClone(defaults);s.courses.push({id:'carte',name:'カルト',price:1800,dishIds:['starter']});
 const m=buildPrintModel([{...blankReservation(s),courseId:'carte',people:8}],s);assert.equal(m.cartePeople,8);assert.equal(m.categories.length,0);assert.equal(m.courseGroups.some(c=>c.price===1800),false);
});
test('登録から外れたコースや不明なコースはカルト人数にまとめる',()=>{
 const s=structuredClone(defaults);const r={...blankReservation(s),courseId:'unregistered',kind:'course' as const,courseText:'未登録6000円コース',people:6,memo:'いかの造り追加',decisions:{'squid-add':true}};
 const m=buildPrintModel([r],s);assert.equal(m.cartePeople,6);assert.equal(m.categories.length,0);assert.equal(m.courseGroups.some(c=>c.label.includes('6000')),false);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,normalizeSettings,settingsPotTypes,validateQuantities,blankReservation,calculated,potMark,settingsValid} from './domain.ts';
import {buildPrintModel} from './printModel.ts';
import {initialWorkspace,cleanReservation} from './workspace.ts';
import {parseBackup} from './backup.ts';

function custom(){
 const s=normalizeSettings(structuredClone(defaults));
 s.potTypes!.push({id:'yose',name:'寄せ鍋',kind:'pot',keywords:['寄せ鍋','よせ鍋']});
 s.potLabels!.yose='寄';s.courses[0].potType='yose';return s;
}
test('追加した鍋名・表示文字をコースと印刷に反映し、盛り分けと数量を維持する',()=>{
 const s=custom(),r={...blankReservation(s),people:5,servingSplit:[{size:5,count:1}]};
 assert.equal(validateQuantities(s),undefined);
 const model=buildPrintModel([r],s);assert.equal(model.courseGroups[0].reservations[0].mark,'寄');
 assert.deepEqual(model.courseGroups[0].reservations[0].servings,[{size:5,count:1}]);
 assert.equal(model.categories.find(c=>c.name==='鍋')!.items[0].name,'寄せ鍋');
 assert.equal(model.categories.find(c=>c.name==='鍋')!.items[0].total,1);
 s.potLabels!.yose='寄せ';assert.equal(potMark(calculated(r,s),s),'寄せ');
});
test('追加鍋を選択式の候補にし、片方のみ・両方・不明を判定する',()=>{
 const s=custom();s.courses[0].potType='choice';s.potTypes!.find(t=>t.id==='choice')!.choices=['motsu','yose'];
 for(const [memo,mark] of [['よせ鍋希望','寄'],['もつ鍋で','もつ'],['もつ鍋と寄せ鍋','or'],['水炊き','or'],['','or']])assert.equal(potMark(calculated({...blankReservation(s),memo},s),s),mark);
});
test('予約の手動指定は識別子で保持し、鍋の名前を変えても同じ種類と表示文字を使う',()=>{
 const s=custom();s.courses[0].potType='choice';const r={...blankReservation(s),pot:'yose',memo:'もつ鍋'};
 s.potTypes!.find(t=>t.id==='yose')!.name='海鮮寄せ鍋';
 const result=calculated(r,s);assert.equal(result.pot,'海鮮寄せ鍋');assert.equal(result.unresolved,false);assert.equal(potMark(result,s),'寄');
 s.potTypes!.find(t=>t.id==='motsu')!.name='国産もつ鍋';assert.equal(calculated({...r,pot:'もつ鍋'},s).pot,'国産もつ鍋');
});
test('旧表示文字を引き継ぎ、追加鍋と予約の手動指定をバックアップ往復で保持する',()=>{
 const s=custom();s.potLabels!.motsu='も';const state=initialWorkspace(s);
 state.manual=[cleanReservation({...blankReservation(s),pot:'yose'},'2026-10-21')];
 const restored=parseBackup(JSON.parse(JSON.stringify({format:'shikomi-backup',version:1,createdAt:0,state,board:[]})));
 assert.equal(settingsPotTypes(restored.state.settings).length,5);assert.equal(restored.state.settings.potLabels!.motsu,'も');
 assert.equal(potMark(calculated(restored.state.manual[0],restored.state.settings),restored.state.settings),'寄');
});
test('空欄・重複・不正な候補・未知の鍋参照・不正なバックアップを拒否する',()=>{
 for(const edit of [(s:ReturnType<typeof custom>)=>s.potLabels!.yose='',(s:ReturnType<typeof custom>)=>s.potTypes![4].name='もつ鍋',(s:ReturnType<typeof custom>)=>s.potTypes![4].id='motsu',(s:ReturnType<typeof custom>)=>s.courses[0].potType='missing',(s:ReturnType<typeof custom>)=>s.potTypes![2].choices=['yose']]){const s=custom();edit(s);assert.ok(validateQuantities(s));}
 const s=custom();(s.potTypes![4] as any).keywords='invalid';assert.equal(settingsValid(s),false);
});

test('新規の選択式鍋の候補・表示文字・未定判定を保存して使う',()=>{
 const s=custom();s.potTypes!.push({id:'new-or',name:'寄せ鍋or水炊き',kind:'choice',keywords:[],choices:['yose','mizutaki']});s.potLabels!['new-or']='選';s.courses[0].potType='new-or';
 assert.equal(validateQuantities(s),undefined);
 for(const [memo,expected] of [['よせ鍋','寄'],['水炊き','水'],['寄せ鍋と水炊き','選'],['もつ鍋','選'],['','選']])assert.equal(potMark(calculated({...blankReservation(s),memo},s),s),expected);
 const saved=normalizeSettings(JSON.parse(JSON.stringify(s)));assert.deepEqual(saved.potTypes!.find(t=>t.id==='new-or')!.choices,['yose','mizutaki']);assert.equal(potMark(calculated(blankReservation(saved),saved),saved),'選');
});

test('同じコースの鍋あり・鍋なしで料理と数量を切り替え、同じ金額枠に集計する',()=>{
 const s=normalizeSettings(structuredClone(defaults)),c=s.courses[1];
 c.noPot={dishIds:['starter','squid'],recipe:{starter:{mode:'perPerson',quantity:2,unit:'個'},squid:{mode:'perPerson',quantity:3,unit:'貫'}}};
 const withPot={...blankReservation(s),courseId:c.id,id:'with',people:3,pot:'motsu'};
 const withoutPot={...withPot,id:'without',people:5,pot:'none',overrides:{pot:[{size:5,count:3}]}};
 const a=calculated(withPot,s),b=calculated(withoutPot,s);
 assert.equal(a.rows.find(d=>d.id==='pot')?.total,1);assert.equal(a.rows.some(d=>d.id==='squid'),false);
 assert.equal(b.rows.some(d=>d.id==='pot'),false);assert.equal(b.rows.find(d=>d.id==='starter')?.total,10);assert.equal(b.rows.find(d=>d.id==='squid')?.total,15);
 const group=buildPrintModel([withPot,withoutPot],s).courseGroups.find(g=>g.price===4000)!;
 assert.equal(group.people,8);assert.deepEqual(group.reservations.map(r=>r.mark),['もつ','×']);assert.deepEqual(group.reservations[1].servings,[{size:2,count:1},{size:3,count:1}]);
 assert.equal(s.courses.filter(c=>c.price===4000).length,1);
});

test('鍋なしの取得メモ・コース名を自動反映し、手動指定を優先する',()=>{
 const s=normalizeSettings(structuredClone(defaults));s.courses[0].noPot={dishIds:['squid']};
 const r={...blankReservation(s),memo:'鍋なし希望'};
 assert.deepEqual(calculated(r,s).rows.map(d=>d.id),['squid']);
 assert.equal(calculated({...r,pot:'motsu'},s).rows.some(d=>d.id==='pot'),true);
 assert.equal(calculated({...r,memo:'鍋ありと鍋なしを確認中'},s).rows.some(d=>d.id==='pot'),true);
 assert.deepEqual(calculated({...r,memo:'',courseText:'3500円コース（鍋無し）'},s).rows.map(d=>d.id),['squid']);
});

test('鍋なし構成と予約選択をバックアップで保持し、不正な数量を拒否する',()=>{
 const s=custom();s.courses[0].noPot={dishIds:['squid'],recipe:{squid:{mode:'perPerson',quantity:2,unit:'個'}}};
 const state=initialWorkspace(s);state.manual=[cleanReservation({...blankReservation(s),pot:'none'},'2026-10-22')];
 const restored=parseBackup(JSON.parse(JSON.stringify({format:'shikomi-backup',version:1,createdAt:0,state,board:[]})));
 assert.deepEqual(restored.state.settings.courses[0].noPot,s.courses[0].noPot);assert.equal(calculated(restored.state.manual[0],restored.state.settings).rows[0].id,'squid');
 s.courses[0].noPot.recipe!.squid.quantity=0;assert.ok(validateQuantities(s));
 const bad=custom();bad.courses[0].noPot={dishIds:['pot']};assert.ok(validateQuantities(bad));
});

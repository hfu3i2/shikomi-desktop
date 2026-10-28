import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,portionsFor,parsePortions,calculated,blankReservation,normalizeSettings,validateQuantities} from './domain.ts';
test('5人は2名盛りと3名盛り。個別ルールは共通ルールを上書きする',()=>{assert.deepEqual(portionsFor(5,defaults),[{size:2,count:1},{size:3,count:1}]);assert.deepEqual(portionsFor(5,defaults,{id:'x',name:'x',portions:{'5':[{size:5,count:1}]}}),[{size:5,count:1}]);});
test('1〜200人で均等分割後の合計人数と最大盛り数が保たれる',()=>{for(let n=1;n<=200;n++){const ps=portionsFor(n,defaults);assert.equal(ps.reduce((sum,p)=>sum+p.size*p.count,0),n);assert.ok(ps.every(p=>p.size<=4&&p.size>0&&p.count>0));}});
test('曖昧なコースより確定したメモの鍋を優先。両方なら未確定',()=>{const r={...blankReservation(defaults),courseId:'4000',courseText:'もつ or 水炊き',memo:'水炊きで'};assert.equal(calculated(r,defaults).pot,'水炊き');assert.equal(calculated({...r,memo:''},defaults).unresolved,true);const withPot={...r,courseId:'4000',memo:'もつ or 水炊き'};assert.equal(calculated(withPot,defaults).unresolved,true);});
test('確認式の追加料理は承認後のみ出る。再計算しても重複しない',()=>{const r={...blankReservation(defaults),memo:'いかの造り追加',people:5};assert.equal(calculated(r,defaults).pending.length,1);assert.equal(calculated(r,defaults).rows.some(x=>x.id==='squid'),false);const result=calculated({...r,decisions:{'squid-add':true}},defaults);assert.equal(result.rows.filter(x=>x.id==='squid').length,1);assert.deepEqual(result.rows.find(x=>x.id==='squid')?.portions,[{size:2,count:1},{size:3,count:1}]);});
test('盛り付けの不正入力を拒否する',()=>{assert.deepEqual(parsePortions('２×１ + ３×１'),[{size:2,count:1},{size:3,count:1}]);assert.throws(()=>parsePortions('0×1'));assert.throws(()=>parsePortions('abc'));});
test('コースごとの個数・g数と、前菜の台数が別々に計算される',()=>{
 const s=structuredClone(defaults);
 s.dishes.push({id:'fried',name:'唐揚げ',portions:{},calculation:{mode:'perPerson',quantity:1,unit:'個'}},{id:'meat',name:'肉',portions:{},calculation:{mode:'perPerson',quantity:50,unit:'g'}});
 const c=s.courses.find(c=>c.id==='4000')!;c.dishIds.push('fried','meat');c.recipe={fried:{mode:'perPerson',quantity:2,unit:'個'},meat:{mode:'perPerson',quantity:80,unit:'g'}};
 const r={...blankReservation(s),courseId:'4000',people:5};const rows=calculated(r,s).rows;
 assert.equal(rows.find(d=>d.id==='fried')?.total,10);assert.equal(rows.find(d=>d.id==='meat')?.total,400);assert.equal(rows.find(d=>d.id==='starter')?.total,2);
 assert.equal(calculated({...r,amountOverrides:{meat:380}},s).rows.find(d=>d.id==='meat')?.total,380);
 assert.equal(calculated({...r,people:6},s).rows.find(d=>d.id==='meat')?.total,480);
});
test('小数のg数、コース別数量、台数の倍率、旧設定を扱える',()=>{
 const s=normalizeSettings(structuredClone(defaults));const c=s.courses[0];c.recipe={starter:{mode:'serving',quantity:2,unit:'皿'},pot:{mode:'perPerson',quantity:0.1,unit:'g'}};
 const rows=calculated({...blankReservation(s),people:5},s).rows;assert.equal(rows.find(d=>d.id==='starter')?.total,4);assert.equal(rows.find(d=>d.id==='pot')?.total,0.5);assert.equal(validateQuantities(s),undefined);
 c.recipe.pot.quantity=-1;assert.ok(validateQuantities(s));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,normalizeSettings,blankReservation,calculated,cartePrep,validateQuantities,settingsValid} from './domain.ts';
import {buildPrintModel} from './printModel.ts';
import {initialWorkspace,cleanReservation,ingredientNeeds} from './workspace.ts';
import {parseBackup} from './backup.ts';

function sample(){
 const s=normalizeSettings(structuredClone(defaults));
 s.dishes.push({id:'meat',name:'肉',category:'焼き物',portions:{},calculation:{mode:'perPerson',quantity:50,unit:'g'}});
 s.courses[1].dishIds.push('meat');s.carteRecipe={meat:{tiers:[{minPeople:10,quantity:100},{minPeople:20,quantity:150}],unit:'g'},squid:{tiers:[{minPeople:20,quantity:8},{minPeople:10,quantity:5}],unit:'個'}};
 const course={...blankReservation(s),id:'course',courseId:'4000',people:3};
 const carte={...blankReservation(s),id:'carte',kind:'carte' as const,courseId:'__carte__',people:6,memo:'いかの造り追加',decisions:{'squid-add':true},overrides:{squid:[{size:6,count:9}]}};
 return {s,course,carte};
}
test('人数段階の境界を判定し、最高の段階だけを固定量として加算する',()=>{
 const {s}=sample();for(const [people,quantity] of [[0,0],[9,0],[10,5],[19,5],[20,8],[99,8]])assert.equal(cartePrep(people,s).find(d=>d.id==='squid')?.total??0,quantity);
 s.carteRecipe!.squid.tiers![0].quantity=0;assert.equal(cartePrep(20,s).some(d=>d.id==='squid'),false);
});
test('予約単位でなく合計人数で1回だけ追加し、コース分と合算する',()=>{
 const {s,course,carte}=sample();const m=buildPrintModel([course,carte,{...carte,id:'carte2',people:4}],s);
 const meat=m.categories.flatMap(c=>c.items).find(i=>i.id==='meat')!,squid=m.categories.flatMap(c=>c.items).find(i=>i.id==='squid')!;
 assert.equal(meat.total,250);assert.equal(meat.carteTotal,100);assert.equal(meat.carteMinPeople,10);assert.equal(squid.total,5);
 assert.equal(m.cartePeople,10);assert.equal(m.totalPeople,13);assert.equal(m.courseGroups.find(g=>g.price===4000)?.people,3);assert.equal(calculated(carte,s).rows.length,0);
 const one=buildPrintModel([course,{...carte,people:10}],s);assert.deepEqual(one.categories,m.categories);
});
test('未設定・閾値未満は追加せず、異なる単位を混ぜない',()=>{
 const {s,course,carte}=sample();assert.equal(buildPrintModel([],s).categories.length,0);assert.deepEqual(calculated(carte,defaults).rows,[]);
 assert.equal(buildPrintModel([carte],s).categories.length,0);
 s.carteRecipe!.meat.unit='個';const meats=buildPrintModel([course,{...carte,people:10}],s).categories.flatMap(c=>c.items).filter(i=>i.id==='meat');
 assert.equal(meats.length,2);assert.equal(meats.find(i=>i.unit==='g')?.total,150);assert.equal(meats.find(i=>i.unit==='個')?.total,100);
});
test('発注は日別のカルト合計で判定し、期間全体や予約ごとに誤判定しない',()=>{
 const {s,course,carte}=sample(),state=initialWorkspace(s);
 state.ingredients=[{id:'stock-meat',name:'肉',unit:'g',stock:10,buffer:0,packSize:100}];state.recipes=[{dishId:'meat',ingredientId:'stock-meat',amount:1,basis:'dishUnit'}];
 const rows=[cleanReservation(course,'2026-10-22'),cleanReservation(carte,'2026-10-22'),cleanReservation({...carte,id:'second',people:4},'2026-10-22'),cleanReservation({...carte,id:'tomorrow',people:20},'2026-10-23'),cleanReservation({...carte,id:'outside',people:50},'2026-10-24')];
 const item=ingredientNeeds(rows,state,'2026-10-22','2026-10-23').items[0];assert.equal(item.required,400);assert.equal(item.shortage,390);assert.equal(item.packs,4);
});
test('人数段階を保存・バックアップ往復し、不正な人数・量・重複を拒否する',()=>{
 const {s}=sample(),state=initialWorkspace(s);const restored=parseBackup(JSON.parse(JSON.stringify({format:'shikomi-backup',version:1,createdAt:0,state,board:[]})));assert.deepEqual(restored.state.settings.carteRecipe,s.carteRecipe);
 for(const edit of [(x:typeof s)=>x.carteRecipe!.meat.tiers![0].minPeople=0,(x:typeof s)=>x.carteRecipe!.meat.tiers![0].minPeople=1.5,(x:typeof s)=>x.carteRecipe!.meat.tiers![1].minPeople=10,(x:typeof s)=>x.carteRecipe!.meat.tiers![0].quantity=-1,(x:typeof s)=>x.carteRecipe!.meat.unit=' ',(x:typeof s)=>x.carteRecipe!.meat.tiers=[]]){const next=structuredClone(s);edit(next);assert.ok(validateQuantities(next));}
 const bad=structuredClone(s);(bad as any).carteRecipe.meat.tiers='invalid';assert.equal(settingsValid(bad),false);
});
test('旧1人あたり設定を保持するが、人数段階として勝手に解釈・加算しない',()=>{
 const s=normalizeSettings(structuredClone(defaults));s.carteRecipe={squid:{quantity:2,unit:'個'}};
 assert.deepEqual(normalizeSettings(s).carteRecipe,s.carteRecipe);assert.deepEqual(cartePrep(20,s),[]);assert.equal(validateQuantities(s),undefined);
 const restored=parseBackup({format:'shikomi-backup',version:1,createdAt:0,state:initialWorkspace(s),board:[]});assert.deepEqual(restored.state.settings.carteRecipe,s.carteRecipe);
});

test('5人未満と8人以下の境界・上限超過・0人を正しく判定する',()=>{
 const {s}=sample();s.carteRecipe!.squid.tiers=[{minPeople:8,comparison:'lte',quantity:5},{minPeople:5,comparison:'lt',quantity:3}];
 for(const [people,quantity] of [[0,0],[1,3],[4,3],[5,5],[8,5],[9,0]])assert.equal(cartePrep(people,s).find(d=>d.id==='squid')?.total??0,quantity);
 assert.equal(cartePrep(4,s).find(d=>d.id==='squid')?.condition,'5名未満');assert.equal(cartePrep(5,s).find(d=>d.id==='squid')?.condition,'8名以下');
 s.carteRecipe!.squid.tiers.push({minPeople:9,comparison:'gte',quantity:8});assert.equal(cartePrep(9,s).find(d=>d.id==='squid')?.total,8);assert.equal(cartePrep(4,s).find(d=>d.id==='squid')?.total,3);
});

test('未満・以下の条件を保存復元し、同じ整数上限になる重複を拒否する',()=>{
 const {s}=sample();s.carteRecipe!.squid.tiers=[{minPeople:5,comparison:'lt',quantity:3},{minPeople:8,comparison:'lte',quantity:5}];
 const restored=parseBackup(JSON.parse(JSON.stringify({format:'shikomi-backup',version:1,createdAt:0,state:initialWorkspace(s),board:[]})));
 assert.equal(cartePrep(5,restored.state.settings).find(d=>d.id==='squid')?.condition,'8名以下');
 s.carteRecipe!.squid.tiers.push({minPeople:4,comparison:'lte',quantity:2});assert.ok(validateQuantities(s));
});

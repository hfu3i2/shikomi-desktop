export type Portion = {size:number; count:number};
export type QuantityRule = {mode:'perPerson'|'serving';quantity:number;unit:string};
export type Dish = {id:string;name:string; portions:Record<string,Portion[]>;calculation?:QuantityRule;category?:string};
export type PotType=string;
export type PotDefinition={id:string;name:string;kind:'pot'|'choice'|'none';keywords:string[];choices?:string[]};
export const defaultPotLabels:Record<PotType,string>={motsu:'もつ',mizutaki:'水',choice:'or',none:'×'};
export const defaultPotTypes:PotDefinition[]=[
 {id:'motsu',name:'もつ鍋',kind:'pot',keywords:['もつ','もつ鍋']},
 {id:'mizutaki',name:'水炊き',kind:'pot',keywords:['水炊き','水炊']},
 {id:'choice',name:'もつ鍋or水炊き',kind:'choice',keywords:[],choices:['motsu','mizutaki']},
 {id:'none',name:'鍋なし',kind:'none',keywords:[]},
];
export type CourseMenu={dishIds:string[];recipe?:Record<string,QuantityRule>};
export type CarteTier={minPeople:number;quantity:number;comparison?:'lt'|'lte'|'gte'};
export type CartePrepRule={tiers?:CarteTier[];unit:string;quantity?:number};
export type Course = CourseMenu&{id:string;name:string;price?:number;potType?:PotType;noPot?:CourseMenu};
export type Rule = {id:string;keyword:string;source:'both'|'course'|'memo';dishId:string;action:'add'|'pot';confirm:boolean};
export type TableSetting = {number:string;capacity:number};
export const inheritedTables:TableSetting[] = [{number:"A1",capacity:4},{number:"A2",capacity:4},{number:"B1",capacity:6}];
export type Settings = {carteRecipe?:Record<string,CartePrepRule>;potTypes?:PotDefinition[];potLabels?:Record<PotType,string>;tables?:TableSetting[];categories?:string[];dishes:Dish[];courses:Course[];rules:Rule[];portions:Record<string,Portion[]>;maxSize:number};
export type Reservation = {table?:string;servingSplit?:Portion[];id:string;time:string;name:string;people:number;kind?:'course'|'carte';courseId:string;courseText:string;memo:string;pot:string;overrides:Record<string,Portion[]>;amountOverrides?:Record<string,number>;decisions:Record<string,boolean>};
export const uid=()=>crypto.randomUUID();
export const defaultCategories=['前菜','サラダ','刺身','焼き物','揚げ物','鍋','〆','デザート','その他'];
export const categoryForDish=(d:Dish)=>d.category?.trim()||(d.id==='starter'?'前菜':d.id==='pot'?'鍋':d.id==='squid'?'刺身':'その他');
export function settingsCategories(s:Settings):string[]{return [...new Set([...(s.categories??defaultCategories),...s.dishes.map(categoryForDish),'その他'].map(v=>v.trim()).filter(Boolean))];}
export function addCategory(s:Settings,name:string):Settings{const n=name.trim();if(!n)throw Error('ジャンル名を入力してください');if(settingsCategories(s).includes(n))throw Error('同じ名前のジャンルがあります');return {...s,categories:[...settingsCategories(s),n]};}
export function renameCategory(s:Settings,old:string,name:string):Settings{const n=name.trim();if(old==='その他')throw Error('その他は共通の移動先として残します');if(!n)throw Error('ジャンル名を入力してください');if(n!==old&&settingsCategories(s).includes(n))throw Error('同じ名前のジャンルがあります');return {...s,categories:settingsCategories(s).map(c=>c===old?n:c),dishes:s.dishes.map(d=>categoryForDish(d)===old?{...d,category:n}:d)};}
export function removeCategory(s:Settings,name:string):Settings{if(name==='その他')throw Error('その他は共通の移動先として残します');return {...s,categories:settingsCategories(s).filter(c=>c!==name),dishes:s.dishes.map(d=>categoryForDish(d)===name?{...d,category:'その他'}:d)};}
export const defaults:Settings={maxSize:4,portions:{'5':[{size:2,count:1},{size:3,count:1}]},dishes:[{id:'starter',name:'前菜',portions:{}},{id:'pot',name:'鍋',portions:{}},{id:'squid',name:'いかの造り',portions:{}}],courses:[{id:'3500',name:'3500円コース',price:3500,dishIds:['starter','pot'],recipe:{}},{id:'4000',name:'4000円コース',price:4000,dishIds:['starter','pot'],recipe:{}},{id:'5000',name:'5000円コース',price:5000,dishIds:['starter','pot'],recipe:{}}],rules:[{id:'motsu',keyword:'もつ',source:'both',dishId:'pot',action:'pot',confirm:false},{id:'mizutaki',keyword:'水炊き',source:'both',dishId:'pot',action:'pot',confirm:false},{id:'squid-add',keyword:'いかの造り',source:'memo',dishId:'squid',action:'add',confirm:true}]};
export function portionsFor(people:number,s:Settings,d?:Dish):Portion[]{
 const custom=d?.portions[String(people)]??s.portions[String(people)];
 if(custom)return custom.map(p=>({...p}));
 const tables=Math.ceil(people/s.maxSize), base=Math.floor(people/tables),extra=people%tables;
 return [{size:base,count:tables-extra},...(extra?[{size:base+1,count:extra}]:[])].filter(p=>p.count>0);
}
export const portionText=(ps:Portion[])=>ps.map(p=>`${p.size}名盛り × ${p.count}`).join(' ＋ ');
export type CalculatedDish={id:string;name:string;portions:Portion[];mode:'perPerson'|'serving';quantity:number;unit:string;total:number;manual:boolean};
export function dishRule(d:Dish,c?:Course):QuantityRule{return c?.recipe?.[d.id]??d.calculation??{mode:'serving',quantity:1,unit:'台'};}
export const formatAmount=(n:number)=>new Intl.NumberFormat('ja-JP',{maximumFractionDigits:3}).format(n);
export const rowText=(d:CalculatedDish)=>d.mode==='perPerson'?`${formatAmount(d.total)}${d.unit}${d.manual?'（手動）':`（1人 ${formatAmount(d.quantity)}${d.unit}）`}`:portionText(d.portions);
export function parsePortions(text:string):Portion[]{
 const parts=text.normalize('NFKC').split(/[+,＋、]/).map(v=>v.trim()).filter(Boolean);
 if(!parts.length)throw new Error('盛り付けを入力してください');
 return parts.map(v=>{const m=v.match(/^(\d+)\s*(?:名盛り)?\s*[x×*]\s*(\d+)$/i);if(!m||+m[1]<1||+m[2]<1)throw new Error('「2×1 + 3×1」の形式で入力してください');return {size:+m[1],count:+m[2]};});
}
export function matchedRules(r:Reservation,s:Settings){return s.rules.filter(rule=>{const course=`${s.courses.find(c=>c.id===r.courseId)?.name??''} ${r.courseText}`;const text=rule.source==='memo'?r.memo:rule.source==='course'?course:`${course} ${r.memo}`;return !!rule.keyword&&text.normalize('NFKC').includes(rule.keyword.normalize('NFKC'));});}
export const carteName=(name:string)=>/カルト|アラカルト|席のみ|席だけ|単品/.test(name.normalize('NFKC').replace(/\s/g,''));
export function coursePotType(c:Course):PotType{if(c.potType)return c.potType;if(!c.dishIds.includes('pot'))return 'none';const motsu=/もつ/.test(c.name),water=/水炊/.test(c.name);return motsu!==water?(motsu?'motsu':'mizutaki'):'choice';}
export const settingsPotTypes=(s:Settings):PotDefinition[]=>s.potTypes??defaultPotTypes;
export function potLabel(s:Settings,id:string):string{return s.potLabels?.[id]??defaultPotLabels[id]??settingsPotTypes(s).find(t=>t.id===id)?.name??'or';}
function namedPot(s:Settings,value:string):PotDefinition|undefined{const types=settingsPotTypes(s);return types.find(t=>t.id===value)??types.find(t=>t.kind==='pot'&&(t.name===value||t.keywords.includes(value)));}
export function potMark(result:ReturnType<typeof calculated>,s:Settings):string{return potLabel(s,result.potType);}
export function isCarteReservation(r:Reservation,s:Settings):boolean{const course=s.courses.find(c=>c.id===r.courseId);return !course||r.kind==='carte'||r.courseId==='__carte__'||carteName(course.name);}
export function usesNoPot(c:Course,r:Reservation):boolean{const text=`${r.courseText} ${r.memo}`.normalize('NFKC');return !!c.noPot&&(r.pot==='none'||(!r.pot&&/鍋(?:なし|無し)/.test(text)&&!/鍋(?:あり|有り)/.test(text)));}
export function reservationCourse(c:Course,r:Reservation):Course{return usesNoPot(c,r)?{...c,...c.noPot!,potType:'none'}:c;}
export function carteTierLabel(t:CarteTier):string{return `${t.minPeople}名${t.comparison==='lt'?'未満':t.comparison==='lte'?'以下':'以上'}`;}
export function carteTier(people:number,rule:CartePrepRule):CarteTier|undefined{
 if(people<=0)return undefined;
 const upper=(rule.tiers??[]).filter(t=>t.comparison==='lt'?people<t.minPeople:t.comparison==='lte'?people<=t.minPeople:false).sort((a,b)=>(a.minPeople-(a.comparison==='lt'?1:0))-(b.minPeople-(b.comparison==='lt'?1:0)));
 return upper[0]??(rule.tiers??[]).filter(t=>(t.comparison??'gte')==='gte'&&people>=t.minPeople).sort((a,b)=>b.minPeople-a.minPeople)[0];
}
export function cartePrep(people:number,s:Settings):(CalculatedDish&{minPeople:number;condition:string})[]{return s.dishes.flatMap(d=>{const rule=s.carteRecipe?.[d.id],tier=rule?carteTier(people,rule):undefined;return rule&&tier&&tier.quantity>0?[{id:d.id,name:d.name,mode:'perPerson' as const,quantity:tier.quantity,unit:rule.unit,total:Math.round(tier.quantity*1000)/1000,minPeople:tier.minPeople,condition:carteTierLabel(tier),portions:[],manual:false}]:[];});}
export function calculated(r:Reservation,s:Settings){
 if(isCarteReservation(r,s))return {rows:[] as CalculatedDish[],pending:[] as Rule[],pot:'',potType:'none',unresolved:false};
 const matched=matchedRules(r,s), pending=matched.filter(x=>x.confirm&&r.decisions[x.id]===undefined);
 const active=matched.filter(x=>!x.confirm||r.decisions[x.id]===true);
 const baseCourse=s.courses.find(c=>c.id===r.courseId);
 const course=baseCourse?reservationCourse(baseCourse,r):undefined;
 const ids=new Set(course?.dishIds??[]);
 active.filter(x=>x.action==='add').forEach(x=>ids.add(x.dishId));
 const configuredDishes=new Set([...(baseCourse?.dishIds??[]),...(baseCourse?.noPot?.dishIds??[])]);
 Object.keys(r.overrides).filter(id=>!baseCourse?.noPot||ids.has(id)||!configuredDishes.has(id)).forEach(id=>ids.add(id));
 // The memo overrides an ambiguous course only if the memo identifies one pot.
 let pot=r.pot;
 if(!pot){const memoPots=active.filter(x=>x.action==='pot'&&r.memo.includes(x.keyword));const pots=memoPots.length?memoPots:active.filter(x=>x.action==='pot');const values=[...new Set(pots.map(x=>x.keyword.includes('水炊き')?'水炊き':x.keyword.includes('もつ')?'もつ鍋':x.keyword))];if(values.length===1)pot=values[0];}
 const configured=settingsPotTypes(s).find(t=>t.id===course?.potType);
 if(configured){
  if(configured.kind==='none'){ids.delete('pot');pot='';}
  else{ids.add('pot');if(!r.pot){if(configured.kind==='choice'){
   const memo=r.memo.normalize('NFKC');const matches=settingsPotTypes(s).filter(t=>t.kind==='pot'&&configured.choices?.includes(t.id)&&[t.name,...t.keywords].some(word=>word.trim()&&memo.includes(word.trim().normalize('NFKC'))));
   pot=matches.length===1?matches[0].id:'';
  }else pot=configured.id;}}
 }
 if(r.pot==='none'){ids.delete('pot');pot='';}
 const resolved=namedPot(s,pot);if(pot&&resolved)pot=resolved.name;
 const potType=!ids.has('pot')?'none':resolved?.id??(configured?.kind==='choice'?configured.id:'choice');
 const unresolved=ids.has('pot')&&!pot;
 const rows:CalculatedDish[]=s.dishes.filter(d=>ids.has(d.id)).map(d=>{const rule=dishRule(d,course);const ps=(r.overrides[d.id]??reservationPortions(r,s,d).map(p=>({...p,count:p.count*rule.quantity})));return {id:d.id,name:d.id==='pot'?(pot||(configured?.kind==='choice'?configured.name:'もつ or 水炊き')):d.name,portions:ps,...rule,total:rule.mode==='perPerson'?(r.amountOverrides?.[d.id]??Math.round(r.people*rule.quantity*1000)/1000):ps.reduce((n,p)=>n+p.count,0),manual:rule.mode==='perPerson'?r.amountOverrides?.[d.id]!==undefined:!!r.overrides[d.id]};});
 return {rows,pending,pot,potType,unresolved};
}
export function blankReservation(s:Settings):Reservation{return {id:uid(),time:'18:00',name:'',people:2,courseId:s.courses[0]?.id??'',courseText:'',memo:'',pot:'',overrides:{},decisions:{}};}
export function settingsValid(value:unknown):value is Settings{
 try{
  const s=value as Settings;
  const potsValid=s.potTypes===undefined||(Array.isArray(s.potTypes)&&s.potTypes.every(t=>t&&typeof t.id==='string'&&typeof t.name==='string'&&['pot','choice','none'].includes(t.kind)&&Array.isArray(t.keywords)&&t.keywords.every(w=>typeof w==='string')&&(t.choices===undefined||(Array.isArray(t.choices)&&t.choices.every(id=>typeof id==='string')))));
  return (s.carteRecipe===undefined||(!!s.carteRecipe&&typeof s.carteRecipe==='object'&&!Array.isArray(s.carteRecipe)&&Object.values(s.carteRecipe).every(q=>q&&typeof q.unit==='string'&&(q.tiers===undefined?typeof q.quantity==='number':Array.isArray(q.tiers)&&q.tiers.every(t=>t&&typeof t.minPeople==='number'&&typeof t.quantity==='number'&&(t.comparison===undefined||['lt','lte','gte'].includes(t.comparison)))))))&&potsValid&&Number.isInteger(s.maxSize)&&s.maxSize>0&&s.maxSize<=20&&Array.isArray(s.dishes)&&s.dishes.every(d=>typeof d.id==='string'&&typeof d.name==='string'&&!!d.portions)&&Array.isArray(s.courses)&&s.courses.every(c=>typeof c.name==='string'&&Array.isArray(c.dishIds)&&(c.noPot===undefined||(!!c.noPot&&Array.isArray(c.noPot.dishIds)&&c.noPot.dishIds.every(id=>typeof id==='string'))))&&Array.isArray(s.rules)&&s.rules.every(r=>typeof r.keyword==='string'&&['both','course','memo'].includes(r.source)&&['add','pot'].includes(r.action))&&!!s.portions;
 }catch{return false;}
}

// Keep existing user settings; older settings used serving counts for every dish.
export function normalizeSettings(s:Settings):Settings{return {...s,carteRecipe:Object.fromEntries(Object.entries(s.carteRecipe??{}).map(([id,rule])=>[id,{...rule,...(rule.tiers?{tiers:rule.tiers.map(t=>({...t}))}:{})}])),potTypes:settingsPotTypes(s).map(t=>({...t,keywords:[...t.keywords],choices:t.choices?[...t.choices]:undefined})),potLabels:{...defaultPotLabels,...s.potLabels},tables:(s.tables??inheritedTables).map(t=>({...t})),categories:settingsCategories(s),dishes:s.dishes.map(d=>({...d,category:categoryForDish(d),calculation:d.calculation??{mode:'serving',quantity:1,unit:'台'}})),courses:s.courses.map(c=>({...c,potType:coursePotType(c),price:c.price??Number(c.name.match(/(\d[\d,]*)\s*円/)?.[1]?.replace(/,/g,'')||0),recipe:c.recipe??{},noPot:c.noPot?{dishIds:[...c.noPot.dishIds],recipe:{...c.noPot.recipe}}:undefined}))};}
export function validateQuantities(s:Settings):string|undefined{
 for(const [id,q] of Object.entries(s.carteRecipe??{})){
  if(!s.dishes.some(d=>d.id===id)||!q.unit.trim())return 'カルト仕込みの料理・単位を確認してください';
  if(q.tiers===undefined){if(!Number.isFinite(q.quantity)||Number(q.quantity)<=0)return 'カルト仕込みの設定を確認してください';continue;}
  const limits=new Set<string>();if(!q.tiers.length)return 'カルト仕込みの人数段階を1つ以上登録してください';
  for(const t of q.tiers){const limit=(t.comparison==='lt'||t.comparison==='lte')?`upper:${t.minPeople-(t.comparison==='lt'?1:0)}`:`lower:${t.minPeople}`;if(!Number.isInteger(t.minPeople)||t.minPeople<1||limits.has(limit)||!['lt','lte','gte'].includes(t.comparison??'gte')||!Number.isFinite(t.quantity)||t.quantity<0)return 'カルト仕込みは人数を1以上・同じ条件の重複なし、量を0以上で設定してください';limits.add(limit);}
 }
 const types=settingsPotTypes(s),ids=new Set<string>(),names=new Set<string>();
 for(const t of types){
  if(!t.id.trim()||ids.has(t.id))return '鍋の種類の識別情報が重複しています';ids.add(t.id);
  const name=t.name.normalize('NFKC').trim();if(!name||names.has(name))return '鍋の種類の名前を空欄・重複なしで入力してください';names.add(name);
  if(!['pot','choice','none'].includes(t.kind)||!Array.isArray(t.keywords)||t.keywords.some(w=>typeof w!=='string'||!w.trim()))return '鍋の種類・メモ判定の言葉を確認してください';
  if(typeof (s.potLabels?.[t.id]??defaultPotLabels[t.id])!=='string'||!(s.potLabels?.[t.id]??defaultPotLabels[t.id]).trim())return '鍋の表示文字を入力してください';
 }
 for(const base of defaultPotTypes)if(!types.some(t=>t.id===base.id&&t.kind===base.kind))return '基本の鍋の種類を残してください';
 for(const t of types.filter(t=>t.kind==='choice'))if(!t.choices||new Set(t.choices).size<2||t.choices.some(id=>!types.some(p=>p.id===id&&p.kind==='pot')))return '選択式の鍋は候補を2種類以上選択してください';
 if(s.courses.some(c=>c.potType!==undefined&&!ids.has(c.potType)))return '鍋種別を選択してください';
 for(const c of s.courses){if(c.noPot&&(c.noPot.dishIds.includes('pot')||coursePotType(c)==='none'))return '鍋ありの鍋種別を選び、鍋なしの料理から鍋を外してください';if(c.price!==undefined&&(!Number.isFinite(c.price)||c.price<0))return 'コース料金は0以上の数値にしてください';}
 for(const q of [...s.dishes.map(d=>d.calculation),...s.courses.flatMap(c=>[...Object.values(c.recipe??{}),...Object.values(c.noPot?.recipe??{})])]){if(!q)continue;if(!['perPerson','serving'].includes(q.mode)||!Number.isFinite(q.quantity)||q.quantity<=0||!q.unit.trim())return '数量は0より大きい数、単位は空欄にせず設定してください';if(q.mode==='serving'&&!Number.isInteger(q.quantity))return '台数の倍率は整数で設定してください';}
 return undefined;
}

export function validateTables(tables:TableSetting[]):string|undefined{
 const names=new Set<string>();for(const t of tables){const name=t.number.trim();if(!name)return '卓番号・卓名を入力してください';if(names.has(name))return '同じ卓番号・卓名が重複しています';names.add(name);if(!Number.isInteger(t.capacity)||t.capacity<1||t.capacity>999)return '定員は1〜999の整数にしてください';}return undefined;
}

export function validServingSplit(ps:Portion[]|undefined,people:number):boolean{return !!ps?.length&&ps.every(p=>Number.isInteger(p.size)&&p.size>0&&Number.isInteger(p.count)&&p.count>0)&&ps.reduce((n,p)=>n+p.size*p.count,0)===people;}
export function reservationPortions(r:Reservation,s:Settings,d?:Dish):Portion[]{return validServingSplit(r.servingSplit,r.people)?r.servingSplit!.map(p=>({...p})):portionsFor(r.people,s,d);}
export function setServingSplit(r:Reservation,text:string):Reservation{const ps=parsePortions(text);if(!validServingSplit(ps,r.people))throw Error('分け方の合計人数を予約人数に合わせてください');return {...r,servingSplit:ps};}

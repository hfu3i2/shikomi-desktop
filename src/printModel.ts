import {cartePrep,potMark,calculated,reservationPortions,settingsCategories,categoryForDish,portionsFor,carteName,isCarteReservation,type Settings,type Reservation,type Portion} from './domain.ts';
export const categoryOrder=['前菜','サラダ','刺し場','焼き場','揚げ場','鍋','〆','デザート','その他'];
export function dishCategory(id:string,s:Settings):string{const d=s.dishes.find(x=>x.id===id);return d?categoryForDish(d):'その他';}
export type PrepItem={key:string;id:string;name:string;category:string;unit:string;mode:'serving'|'perPerson';total:number;carteTotal:number;carteMinPeople?:number;carteCondition?:string;servings:Record<string,number>;details:{quantity:number;courseLabels:string[];manual:boolean}[]};
export function buildPrintModel(reservations:Reservation[],s:Settings){
 const courseGroups=new Map<string,{key:string;label:string;price:number;people:number;reservations:{id:string;people:number;servings:Portion[];mark:string}[]}>();
 const courseKey=(id:string,text='')=>{const c=s.courses.find(x=>x.id===id);return c?.price?`price:${c.price}`:`course:${id||text}`;};
 for(const c of s.courses){if(carteName(c.name))continue;const key=courseKey(c.id);if(!courseGroups.has(key))courseGroups.set(key,{key,label:c.price?`${c.price}円コース`:c.name,price:c.price??0,people:0,reservations:[]});}
 const prep=new Map<string,PrepItem>();
 let cartePeople=0;
 for(const r of reservations){const isCarte=isCarteReservation(r,s),c=s.courses.find(x=>x.id===r.courseId),result=calculated(r,s);
 if(isCarte)cartePeople+=r.people;
 else{const key=courseKey(r.courseId,r.courseText);let group=courseGroups.get(key);if(!group){group={key,label:r.courseText||'コース未選択',price:0,people:0,reservations:[]};courseGroups.set(key,group);}group.people+=r.people;group.reservations.push({id:r.id,people:r.people,servings:reservationPortions(r,s),mark:potMark(result,s)});}
 for(const row of result.rows){const category=dishCategory(row.id,s);const k=JSON.stringify([row.id,row.name,row.mode,row.unit]);let item=prep.get(k);if(!item){item={key:k,id:row.id,name:row.name,category,unit:row.unit,mode:row.mode,total:0,carteTotal:0,servings:{},details:[]};prep.set(k,item);}item.total=Math.round((item.total+row.total)*1000)/1000;
 
 if(row.mode==='serving'){for(const p of row.portions)item.servings[p.size]=(item.servings[p.size]??0)+p.count;}else{const label=c?.price?String(c.price%100===0?c.price/100:c.price):c?.name??r.courseText;let detail=item.details.find(d=>d.quantity===row.quantity&&d.manual===row.manual);if(!detail){detail={quantity:row.quantity,courseLabels:[],manual:row.manual};item.details.push(detail);}if(label&&!detail.courseLabels.includes(label))detail.courseLabels.push(label);}
 }
 }
 // Apply one tier to the day's combined carte headcount, never once per booking.
 for(const row of cartePrep(cartePeople,s)){
  const key=JSON.stringify([row.id,row.name,row.mode,row.unit]);let item=prep.get(key);
  if(!item){item={key,id:row.id,name:row.name,category:dishCategory(row.id,s),unit:row.unit,mode:row.mode,total:0,carteTotal:0,servings:{},details:[]};prep.set(key,item);}
  item.total=Math.round((item.total+row.total)*1000)/1000;item.carteTotal=row.total;item.carteMinPeople=row.minPeople;item.carteCondition=row.condition;
 }
 const categories=[...new Set([...prep.values()].map(x=>x.category))].sort((a,b)=>{const order=settingsCategories(s);const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'ja');}).map(category=>({name:category,items:[...prep.values()].filter(x=>x.category===category).sort((a,b)=>a.name.localeCompare(b.name,'ja'))}));
 return {courseGroups:[...courseGroups.values()].sort((a,b)=>a.price-b.price||a.label.localeCompare(b.label,'ja')),categories,cartePeople,totalPeople:reservations.reduce((n,r)=>n+r.people,0)};
}

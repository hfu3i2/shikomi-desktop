import Papa from 'papaparse';
import {reservationTime} from '../worker/reservation-time.mjs';
import {blankReservation,carteName,type Settings,type Reservation} from './domain.ts';
const aliases={name:['予約名','予約者名','氏名','お名前','顧客名','名前'],people:['人数','予約人数','大人人数','来店人数'],course:['コース','コース名','プラン','プラン名'],memo:['メモ','備考','予約メモ','要望','お客様からのご要望']};
export async function importCSV(file:File,s:Settings,date?:string):Promise<{rows:Reservation[];warnings:string[]}>{
 const bytes=await file.arrayBuffer();let text=new TextDecoder('utf-8').decode(bytes);if(text.includes('\uFFFD'))text=new TextDecoder('shift-jis').decode(bytes);
 const parsed=Papa.parse<Record<string,string>>(text.replace(/^\uFEFF/,''),{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.trim()});
 if(parsed.errors.length)throw new Error(`CSV形式を確認してください：${parsed.errors[0].message}`);
 const fields=parsed.meta.fields??[];
 const find=(key:keyof typeof aliases)=>aliases[key].find(a=>fields.includes(a));
 const keys={name:find('name'),people:find('people'),course:find('course'),memo:find('memo')};
 if(!keys.people)throw new Error(`人数の列が見つかりません。対応する列名：人数、予約人数。検出した列：${fields.join('、')}`);
 const warnings:string[]=[];
 const statusKey=['ステータス','予約ステータス'].find(k=>fields.includes(k));
 const priceKey=['コース金額','金額','コース料金'].find(k=>fields.includes(k));
 const eligible=parsed.data.map((row,index)=>({row,index})).filter(({row})=>!statusKey||row[statusKey]?.trim()==='来店待ち');
 if(eligible.length<parsed.data.length)warnings.push(`来店待ち以外の${parsed.data.length-eligible.length}件を除外しました。`);
 const rows=eligible.map(({row,index})=>{
  const count=Number(row[keys.people!]?.normalize('NFKC').replace(/[^\d.]/g,''));if(!Number.isInteger(count)||count<1||count>999)throw new Error(`${index+2}行目の人数を確認してください`);
  const rawCourse=keys.course?row[keys.course]??'':'';const price=Number((priceKey?row[priceKey]??'':'').normalize('NFKC').replace(/[^\d.]/g,''));const priceMatches=price>0?s.courses.filter(c=>c.price===price):[];const course=s.courses.find(c=>c.name===rawCourse)||s.courses.find(c=>rawCourse.includes(c.name))||(priceMatches.length===1?priceMatches[0]:undefined);
  const carte=!course||carteName(rawCourse);
  const time=reservationTime(row);
  return {...blankReservation(s),name:`予約${index+1}`,date:(()=>{const m=row['来店日']?.normalize('NFKC').match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);if(!m)return date;const d=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const check=new Date(`${d}T12:00:00`);if(!Number.isFinite(check.getTime())||check.getMonth()+1!==+m[2]||check.getDate()!==+m[3])throw Error('来店日を確認してください');return d;})(),people:count,time,table:(row['卓']??row['卓番号']??row['卓名']??row['テーブル']??row['テーブル名']??row['テーブル番号']??row['席名']??'').trim(),kind:carte?'carte' as const:'course' as const,courseId:carte?'__carte__':course?.id??'',courseText:rawCourse,memo:[keys.memo?row[keys.memo]??'':'',keys.memo!=='要望'&&row['要望']?`要望：${row['要望']}`:''].filter(Boolean).join('\n')};
 });
 if(!rows.length)throw new Error('予約データがありません');return {rows,warnings};
}

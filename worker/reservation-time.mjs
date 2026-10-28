const headers=['開始時間','予約時間','来店時間','時間','開始時刻','予約時刻','来店時刻','予約開始時間','予約開始時刻','来店予定時間','来店予定時刻','来店日時','予約日時','開始日時','予約開始日時','来店予定日時'];
const key=value=>String(value??'').normalize('NFKC').replace(/\s/g,'');

export function parseReservationTime(value){
 const text=String(value??'').normalize('NFKC').trim();
 let match=text.match(/(?:^|[^\d])(\d{1,2})\s*:\s*(\d{2})(?!\d)/);
 if(!match){
  const japanese=text.match(/(?:^|[^\d])(\d{1,2})時(?:\s*(\d{1,2})分?|\s*(半))?(?!\d)/);
  if(japanese)match=[japanese[0],japanese[1],japanese[3]?'30':japanese[2]??'00'];
 }
 if(!match){const compact=text.match(/^(\d{1,2})(\d{2})$/);if(compact)match=compact;}
 if(!match||Number(match[1])>23||Number(match[2])>59)return '';
 return `${match[1].padStart(2,'0')}:${match[2].padStart(2,'0')}`;
}

export function reservationTime(row){
 const values=new Map(Object.entries(row).map(([header,value])=>[key(header),value]));
 for(const header of headers){const time=parseReservationTime(values.get(header));if(time)return time;}
 return '';
}

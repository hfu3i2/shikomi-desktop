// One scheduler per open application; no operating-system scheduled task.
export function createAutoFetch(){
 let inFlight=false,next=0;
 return {async tick(now:number,options:{enabled:boolean;minutes:number;storeName:string;blocked:boolean},run:()=>Promise<void>){
  if(!options.enabled){next=0;return;}
  if(inFlight||options.blocked||!options.storeName.trim()||now<next)return;
  inFlight=true;next=now+options.minutes*60_000;
  try{await run();}finally{inFlight=false;}
 }};
}

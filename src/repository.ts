import type {Workspace,BoardRow} from './workspace';
type Loaded={state:Workspace|null;revision:number;board:BoardRow[];syncStatus:Record<string,unknown>};
const desktop=()=> '__TAURI_INTERNALS__'in window;
export async function command<T>(name:string,args:Record<string,unknown>={}):Promise<T>{if(!desktop())throw Error('この操作はWindowsソフト版で利用できます');const{invoke}=await import('@tauri-apps/api/core');return invoke<T>(name,args);}
export async function loadRepository():Promise<Loaded>{if(desktop())return command('load_repository');const saved=localStorage.getItem('portfolio.shikomi.workspace.v1');return {state:saved?JSON.parse(saved):null,revision:0,board:[],syncStatus:{state:'未接続'}};}
export async function saveRepository(state:Workspace,revision:number):Promise<number>{if(desktop())return command('save_repository',{state,expectedRevision:revision});localStorage.setItem('portfolio.shikomi.workspace.v1',JSON.stringify(state));return revision+1;}

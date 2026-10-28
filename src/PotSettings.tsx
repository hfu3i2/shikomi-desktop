import {Plus} from 'lucide-react';
import {settingsPotTypes,potLabel,uid,type Settings,type PotDefinition} from './domain';

export default function PotSettings({draft,setDraft}:{draft:Settings;setDraft:(s:Settings)=>void}){
 const types=settingsPotTypes(draft);
 const update=(id:string,change:Partial<PotDefinition>)=>setDraft({...draft,potTypes:types.map(t=>t.id===id?{...t,...change}:t)});
 const add=(kind:'pot'|'choice')=>{const id=uid();setDraft({...draft,potTypes:[...types,{id,name:kind==='choice'?'新しい選択式鍋':'新しい鍋',kind,keywords:[],...(kind==='choice'?{choices:types.filter(t=>t.kind==='pot').slice(0,2).map(t=>t.id)}:{})}],potLabels:{...draft.potLabels,[id]:kind==='choice'?'or':'鍋'}});};
 return <>
  <h3>鍋の種類と表示文字</h3>
  <p className="helper">鍋を追加し、コースに割り当てられます。「台数の横の文字」は、仕込み表の「3×1」の横に表示します。最後に「保存」を押してください。</p>
  {types.map(t=><section className="course-config pot-config" key={t.id}>
   <div className="input-grid">
    <label>鍋の名前<input aria-label={`${t.name}の鍋名`} value={t.name} onChange={e=>update(t.id,{name:e.target.value})}/></label>
    <label>台数の横の文字<input aria-label={`${t.name}の表示文字`} placeholder="例：もつ、水、寄" value={potLabel(draft,t.id)} onChange={e=>setDraft({...draft,potLabels:{...draft.potLabels,[t.id]:e.target.value}})}/></label>
   </div>
   <p className="pot-preview">表示例：<strong>3×1{potLabel(draft,t.id)}</strong></p>
   {t.kind==='pot'&&<label className="pot-keywords">メモで判定する言葉（読点で区切る）<input aria-label={`${t.name}の判定キーワード`} value={t.keywords.join('、')} placeholder="例：寄せ鍋、よせ鍋" onChange={e=>update(t.id,{keywords:e.target.value?e.target.value.split(/[、,，]/):[]})}/></label>}
   {t.kind==='choice'&&<><p className="helper">選択式の候補を2種類以上選んでください。予約メモに候補が1種類だけ書かれている場合、その鍋の表示文字に切り替えます。</p><div className="pot-choices">{types.filter(p=>p.kind==='pot').map(p=><label key={p.id}><input type="checkbox" aria-label={`${t.name}の候補・${p.name}`} checked={t.choices?.includes(p.id)??false} onChange={e=>update(t.id,{choices:e.target.checked?[...(t.choices??[]),p.id]:t.choices?.filter(id=>id!==p.id)})}/>{p.name}</label>)}</div></>}
  </section>)}
  <div className="inline-actions"><button className="text-button" onClick={()=>add('pot')}><Plus size={16}/>鍋の種類を追加</button><button className="text-button" onClick={()=>add('choice')}><Plus size={16}/>選択式（or）を追加</button></div>
 </>;
}

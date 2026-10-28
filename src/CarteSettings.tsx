import {useState} from 'react';
import {Plus,Trash2} from 'lucide-react';
import {categoryForDish,formatAmount,carteTierLabel,carteTier,type CarteTier,type Settings} from './domain';

export default function CarteSettings({draft,setDraft}:{draft:Settings;setDraft:(s:Settings)=>void}){
 const [people,setPeople]=useState(10),rules=draft.carteRecipe??{};
 return <>
  <h3>カルトの合計人数で仕込みを追加</h3>
  <p className="helper">「5人未満なら3個、8人以下なら5個」のように登録します。その日のカルト合計で判定し、該当する最も小さい上限の量だけを加算します。未満はその人数を含まず、以下は含みます。上限に該当しない場合は「以上」の設定を使い、どの条件にも該当しなければ追加しません。0名の日は追加しません。</p>
  <label className="setting-row"><span>表示例のカルト合計人数</span><div className="value-unit"><input aria-label="カルト仕込みの表示例人数" type="number" min="0" max="9999" value={people} onChange={e=>{const n=+e.target.value;if(Number.isInteger(n)&&n>=0&&n<=9999)setPeople(n);}}/>名</div></label>
  <div className="carte-dish-list">{draft.dishes.map(d=>{
   const q=rules[d.id],tiers=q?.tiers??[],matched=q?carteTier(people,q):undefined;
   const setTiers=(next:CarteTier[])=>setDraft({...draft,carteRecipe:{...rules,[d.id]:{unit:q!.unit,tiers:next}}});
   return <section className="course-config" key={d.id}>
    <label className="course-dish-check"><input type="checkbox" aria-label={`${d.name}をカルト仕込みに追加`} checked={!!q} onChange={e=>{const next={...rules};if(e.target.checked)next[d.id]={tiers:[{minPeople:5,comparison:'lt',quantity:1}],unit:d.calculation?.mode==='perPerson'?d.calculation.unit:'個'};else delete next[d.id];setDraft({...draft,carteRecipe:next});}}/>{d.name}<small className="dish-genre-label">{categoryForDish(d)}</small></label>
    {q&&<>
     {q.tiers===undefined&&<p className="inline-warning">以前の「1人あたり」の設定では加算しません。人数段階を登録してください。</p>}
     <label className="carte-unit">単位<input aria-label={`${d.name}のカルト単位`} value={q.unit} placeholder="個・gなど" onChange={e=>setDraft({...draft,carteRecipe:{...rules,[d.id]:{...q,unit:e.target.value}}})}/></label>
     {tiers.map((t,i)=><div className="carte-tier" key={i}>
      <label>人数<input aria-label={`${d.name}の段階${i+1}の人数`} type="number" min="1" step="1" value={t.minPeople} onChange={e=>setTiers(tiers.map((x,j)=>j===i?{...x,minPeople:+e.target.value}:x))}/></label>
      <label>条件<select aria-label={`${d.name}の段階${i+1}の条件`} value={t.comparison??'gte'} onChange={e=>setTiers(tiers.map((x,j)=>j===i?{...x,comparison:e.target.value as CarteTier['comparison']}:x))}><option value="lt">人未満なら</option><option value="lte">人以下なら</option><option value="gte">人以上なら</option></select></label><label>追加する量<input aria-label={`${d.name}の段階${i+1}の量`} type="number" min="0" step="any" value={t.quantity} onChange={e=>setTiers(tiers.map((x,j)=>j===i?{...x,quantity:e.target.value===''?0:+e.target.value}:x))}/></label><span>{q.unit}</span>
      <button aria-label={`${d.name}の段階${i+1}を削除`} onClick={()=>setTiers(tiers.filter((_,j)=>j!==i))}><Trash2 size={15}/></button>
     </div>)}
     <button className="text-button" aria-label={`${d.name}の人数段階を追加`} onClick={()=>setTiers([...tiers,{minPeople:tiers.length?Math.max(...tiers.map(t=>t.minPeople))+(tiers[tiers.length-1].comparison==='lt'||tiers[tiers.length-1].comparison==='lte'?3:10):5,quantity:1,comparison:tiers.length?(tiers[tiers.length-1].comparison==='gte'||!tiers[tiers.length-1].comparison?'gte':'lte'):'lt'}])}><Plus size={15}/>人数段階を追加</button>
     <p className="pot-preview">カルト合計{people}名なら：<strong>＋{formatAmount(matched?.quantity??0)}{q.unit}</strong>{matched&&<small>（{carteTierLabel(matched)}の設定）</small>}</p>
    </>}
   </section>;
  })}</div>
  <p className="helper">「保存」で反映します。仕込み表にはカルト分と合計を表示し、食材・発注も日ごとのカルト合計で計算します。</p>
 </>;
}

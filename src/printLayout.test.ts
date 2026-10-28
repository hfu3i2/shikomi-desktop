import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packPrintColumns,largestPrintFont} from './printLayout.ts';
test('背の高い分類に他の枠をそろえず、空いている列へ詰める',()=>{
 const heights=[100,10,10,100,10,10];const layout=packPrintColumns(heights);assert.equal(layout.height,110);assert.ok(layout.height<200);
 for(let c=0;c<3;c++){let bottom=0;layout.placements.forEach((p,i)=>{if(p.column===c){assert.equal(p.top,bottom);bottom+=heights[i];}});assert.equal(bottom,layout.heights[c]);}
});
test('分類が少ない場合や空の場合でも欠落・重複しない',()=>{assert.equal(packPrintColumns([]).height,0);assert.deepEqual(packPrintColumns([40]).placements,[{column:0,top:0}]);assert.equal(packPrintColumns([20,10,30,40]).placements.length,4);});
test('収まる最大の文字サイズを0.25px単位で選び、上限・下限を守る',()=>{assert.equal(largestPrintFont(n=>n<=17.37),17.25);assert.equal(largestPrintFont(()=>true),28);assert.equal(largestPrintFont(()=>false),4);});

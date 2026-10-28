/** Place whole category blocks in the shortest column; never split a block. */
export function packPrintColumns(heights:number[],columns=3){
 const totals=Array.from({length:Math.max(1,Math.floor(columns))},()=>0);
 const placements=heights.map(height=>{const column=totals.indexOf(Math.min(...totals));const top=totals[column];totals[column]+=Math.max(0,Number.isFinite(height)?height:0);return {column,top};});
 return {placements,heights:totals,height:Math.max(...totals)};
}
/** Greatest quarter-pixel font size that fits, or the minimum when none fits. */
export function largestPrintFont(fits:(size:number)=>boolean,min=4,max=28):number{
 let lo=Math.ceil(min*4),hi=Math.floor(max*4),best=lo;
 while(lo<=hi){const mid=Math.floor((lo+hi)/2);if(fits(mid/4)){best=mid;lo=mid+1;}else hi=mid-1;}
 return best/4;
}

import { commanderSelectTool } from '@wuji/dsh-wuji-host';
const result=await commanderSelectTool.execute({domain:'visual',difficulty:'mid',candidates:[{name:'low-worker',tier:'low'},{name:'visual-mid',tier:'mid'}]});
if(result.selected.name!=='visual-mid'||result.alternatives.length!==1)process.exit(1);
console.log('commander select test OK',JSON.stringify(result));

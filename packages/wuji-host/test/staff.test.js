import { staffPlanTool } from '@wuji/dsh-wuji-host';
const events=[];
const session={append(type,data){events.push({type,data})}};
const value=await staffPlanTool.execute({objective:'完成PPT',tasks:[{taskId:'t1',deps:[],assignedTo:'视觉主帅',requirement:'生成PPT',input:'表格',output:'pptx',returnFormat:'json',failurePolicy:'retry'}]},{agent:{session}});
if(value.taskCount!==1||events.length!==2||events[0].type!=='wuji/task/change'||events[1].type!=='wuji/task/activate')process.exit(1);
console.log('staff plan test OK',JSON.stringify(value));

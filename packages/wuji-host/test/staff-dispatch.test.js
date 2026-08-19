import { staffDispatchTool } from '@wuji/dsh-wuji-host';
const events=[]; const session={append(type,data){events.push({type,data})}};
const parent={session,ctx:{get(name){if(name==='subagents')return {async start(provider,request){if(provider!=='test-provider')throw new Error('bad provider');return {childId:'child-1',request}}}}}};
const result=await staffDispatchTool.execute({task:{taskId:'t1'},provider:'test-provider',prompt:'只执行一个原子任务'}, {agent:parent,signal:new AbortController().signal});
if(result.status!=='success'||result.childId!=='child-1'||events.length!==2||events[0].data.status!=='running'||events[1].data.status!=='success')process.exit(1);
console.log('staff dispatch test OK',JSON.stringify(result));

import { staffDispatchTool } from '@wuji/dsh-wuji-host';
const events=[]; const session={append(type,data){events.push({type,data})}};
const parent={session,ctx:{get(name){if(name==='subagents')return {async start(provider,request){if(provider!=='test-provider')throw new Error('bad provider');return {childId:'child-1',request}}}}}};
const result=await staffDispatchTool.execute({task:{taskId:'t1'},provider:'test-provider',prompt:'只执行一个原子任务'}, {agent:parent,signal:new AbortController().signal});
if(result.status!=='dispatched'||result.childId!=='child-1'||events.length!==1||events[0].data.status!=='running')process.exit(1);
const completionEvents=[]; const completionSession={append(type,data){completionEvents.push({type,data})}};
const completion=await (await import('@wuji/dsh-wuji-host')).staffCompletionTool.execute({taskId:'t1',status:'success',artifact:'out/result.json',evidence:'hash verified'},{agent:{session:completionSession}});
if(completion.status!=='success'||completion.recorded!==true||completionEvents[0].data.evidence!=='artifact:out/result.json; hash verified')process.exit(1);
console.log('staff dispatch/completion test OK',JSON.stringify({result,completion}));

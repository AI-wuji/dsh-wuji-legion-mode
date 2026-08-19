// J-Space 原子蒸馏：只纳入互补能力，不安装第二套插件/记忆系统。
// 复用现有 wuji.task / wuji.memory / wujiStaff，不新增全局入口。
export function focusTask(task, maxActive=2){
  const active=Array.isArray(task?.nodes)?task.nodes.filter(n=>n.status==='running'||n.status==='pending'):[];
  return {active:active.slice(0,maxActive).map(n=>n.taskId),overflow:Math.max(0,active.length-maxActive),rule:'只把当前任务节点带入工作上下文'};
}
export function bridgeContract(task){
  return {taskId:task?.taskId||null,intermediate:task?.output||'',acceptance:task?.returnFormat||'',rule:'先形成中间产出，再进入最终结论'};
}
export function monitorTask(task){
  const status=task?.status||'unknown';
  return {status,degenerate:status==='failed',next:status==='failed'?(task.failurePolicy||'report'):'continue'};
}
export const jspaceDistill={focusTask,bridgeContract,monitorTask,source:'J-Space Cognition Suite',installed:false,uses:['wuji.task','wuji.memory','wujiStaff']};

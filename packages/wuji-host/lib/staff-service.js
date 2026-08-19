// Wuji Legion · 参谋部 Host 服务（P1）
// 只接受结构化计划/派发请求；不创建第二 agent-loop，不缓存跨 Session 任务状态。

function validateDag(tasks) {
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 32) throw new Error('任务节点必须为 1-32 个');
  const ids = new Set();
  for (const task of tasks) {
    if (!task?.taskId || ids.has(task.taskId)) throw new Error('taskId 必须唯一且非空');
    ids.add(task.taskId);
    if (!Array.isArray(task.deps) || task.deps.some(dep => dep === task.taskId || !tasks.some(t => t.taskId === dep))) throw new Error(`任务 ${task.taskId} 的依赖无效`);
    for (const key of ['assignedTo', 'requirement', 'input', 'output', 'returnFormat', 'failurePolicy']) if (typeof task[key] !== 'string' || !task[key]) throw new Error(`任务 ${task.taskId} 缺少 ${key}`);
    if (!['retry', 'reangle', 'report'].includes(task.failurePolicy)) throw new Error(`任务 ${task.taskId} 的失败策略无效`);
  }
  const visiting = new Set(); const visited = new Set();
  function visit(id) { if (visiting.has(id)) throw new Error('任务依赖图存在环'); if (visited.has(id)) return; visiting.add(id); const task=tasks.find(x=>x.taskId===id); for(const dep of task.deps) visit(dep); visiting.delete(id); visited.add(id); }
  for (const task of tasks) visit(task.taskId);
  return [...ids];
}

export function createWujiStaffService() {
  return {
    validatePlan(request) {
      if (!request?.objective || typeof request.objective !== 'string') throw new Error('参谋部计划缺少 objective');
      const taskIds = validateDag(request.tasks);
      return { objective: request.objective, taskIds, taskCount: taskIds.length };
    },
    async plan(request, session) {
      const summary = this.validatePlan(request);
      for (const task of request.tasks) session.append('wuji/task/change', { taskId: task.taskId, patch: { ...task, status: 'pending', evidence: null } });
      const activeTaskId = request.tasks.find(x => x.deps.length === 0)?.taskId || request.tasks[0].taskId;
      session.append('wuji/task/activate', { taskId: activeTaskId });
      return { ...summary, activeTaskId };
    },
    readyTasks(tasks) {
      const done = new Set(tasks.filter(t => t.status === 'success').map(t => t.taskId));
      return tasks.filter(t => t.status === 'pending' && t.deps.every(dep => done.has(dep)));
    },
  };
}

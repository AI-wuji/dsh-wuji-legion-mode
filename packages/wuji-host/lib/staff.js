// Wuji Legion · 参谋部最小调度工具（P1）
// 参谋部只做全局任务分配与契约写入，不亲自执行、不创建第二套 agent-loop。

export const staffPlanTool = {
  name: 'wuji_staff_plan',
  description: '参谋部：把已确认需求转换为有依赖、负责人、输入输出和失败策略的任务分配表，并写入 wuji.task 投影。',
  parameters: {
    type: 'object',
    properties: {
      objective: { type: 'string', description: '已确认的总目标。' },
      tasks: {
        type: 'array',
        description: '结构化任务节点；每个节点必须包含完整执行契约。',
        items: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            deps: { type: 'array', items: { type: 'string' } },
            assignedTo: { type: 'string' },
            requirement: { type: 'string' },
            input: { type: 'string' },
            output: { type: 'string' },
            returnFormat: { type: 'string' },
            failurePolicy: { type: 'string', enum: ['retry', 'reangle', 'report'] },
          },
          required: ['taskId', 'deps', 'assignedTo', 'requirement', 'input', 'output', 'returnFormat', 'failurePolicy'],
        },
      },
    },
    required: ['objective', 'tasks'],
  },
  output: {
    schema: {
      type: 'object',
      properties: {
        objective: { type: 'string' },
        taskCount: { type: 'number' },
        taskIds: { type: 'array', items: { type: 'string' } },
        activeTaskId: { oneOf: [{ type: 'string' }, { type: 'null' }] },
        dependenciesValid: { type: 'boolean' },
      },
      required: ['objective', 'taskCount', 'taskIds', 'activeTaskId', 'dependenciesValid'],
    },
    render(_args, value) {
      return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
    },
  },
  isConcurrencySafe() { return false; },
  async execute(args, exec) {
    const tasks = Array.isArray(args.tasks) ? args.tasks : [];
    const ids = new Set(tasks.map(task => task.taskId));
    const dependenciesValid = tasks.every(task => task.deps.every(dep => ids.has(dep) || dep === ''));
    if (!args.objective || tasks.length === 0) throw new Error('参谋部任务表需要 objective 和至少一个完整任务节点');
    if (!dependenciesValid) throw new Error('任务依赖必须指向同一任务表中的 taskId');
    const session = exec.agent?.session;
    if (!session) throw new Error('参谋部工具必须在一个有归属 Session 的 Agent 中运行');
    for (const task of tasks) {
      session.append('wuji/task/change', {
        taskId: task.taskId,
        patch: {
          deps: task.deps,
          assignedTo: task.assignedTo,
          requirement: task.requirement,
          input: task.input,
          output: task.output,
          returnFormat: task.returnFormat,
          failurePolicy: task.failurePolicy,
          status: 'pending',
          evidence: null,
        },
      });
    }
    const activeTaskId = tasks.find(task => task.deps.length === 0)?.taskId || tasks[0].taskId;
    session.append('wuji/task/activate', { taskId: activeTaskId });
    return { objective: args.objective, taskCount: tasks.length, taskIds: [...ids], activeTaskId, dependenciesValid };
  },
};

export const staffDispatchTool = {
  name: 'wuji_staff_dispatch',
  description: '参谋部：将一个已规划且依赖已满足的任务节点派发给指定 subagent provider；参谋部不亲自执行。',
  parameters: {
    type: 'object',
    properties: {
      task: { type: 'object', description: '完整任务节点（来自 wuji.task 表）。' },
      provider: { type: 'string', description: '已注册的 subagents provider 名称。' },
      prompt: { type: 'string', description: '给执行 agent 的最小任务契约。' },
    },
    required: ['task', 'provider', 'prompt'],
  },
  output: {
    schema: { type: 'object', properties: { taskId: { type: 'string' }, status: { type: 'string' }, childId: { oneOf: [{ type: 'string' }, { type: 'null' }] } }, required: ['taskId', 'status', 'childId'] },
    render(_args, value) { return [{ type: 'text', text: JSON.stringify(value, null, 2) }]; },
  },
  isConcurrencySafe() { return false; },
  async execute(args, exec) {
    const task = args.task || {};
    const parent = exec.agent;
    if (!parent?.session) throw new Error('参谋部派发必须归属于当前 Agent Session');
    if (!task.taskId || !args.provider || !args.prompt) throw new Error('派发需要 taskId、provider、prompt');
    const subagents = exec.agent.ctx.get('subagents');
    if (!subagents) throw new Error('subagents 服务未挂载');
    parent.session.append('wuji/task/status', { taskId: task.taskId, status: 'running', evidence: null });
    try {
      const run = await subagents.start(args.provider, {
        label: `wuji-${task.taskId}`,
        prompt: args.prompt,
        parent,
        signal: exec.signal,
      });
      parent.session.append('wuji/task/status', { taskId: task.taskId, status: 'success', evidence: `subagent:${run.childId || run.id || task.taskId}` });
      return { taskId: task.taskId, status: 'success', childId: run.childId || run.id || null };
    } catch (error) {
      parent.session.append('wuji/task/status', { taskId: task.taskId, status: 'failed', evidence: error?.message || String(error) });
      throw error;
    }
  },
};

export default staffPlanTool;

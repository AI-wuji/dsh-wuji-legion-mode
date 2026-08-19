// Wuji Legion · 独立官员 MoE（P3）
const OFFICERS=new Set(['qa','audit','compliance','root-cause','performance','composite']);
// 阿极已内置客观独立判断；独立官员不再提供 white-hat 职权。
export const officerAdviseTool={
  name:'wuji_officer_advise',
  description:'独立官员 MoE：一次激活一个官员职权，只提交建议与证据；零修改、零派发、零否决、零完成权。',
  parameters:{type:'object',properties:{officer:{type:'string'},adviceId:{type:'string'},content:{type:'string'},evidence:{type:'string'},affectedRequirement:{oneOf:[{type:'string'},{type:'null'}]}},required:['officer','adviceId','content','evidence']},
  output:{schema:{type:'object',properties:{adviceId:{type:'string'},officer:{type:'string'},status:{type:'string'}},required:['adviceId','officer','status']},render(_a,v){return[{type:'text',text:JSON.stringify(v,null,2)}]}},
  isConcurrencySafe(){return true},
  async execute(args,exec){
    if(!OFFICERS.has(args.officer))throw new Error(`未知独立官员职权：${args.officer}`);
    const session=exec.agent?.session;if(!session)throw new Error('官员建议必须归属于当前 Session');
    session.append('wuji/officer-advice/change',{adviceId:args.adviceId,patch:{officer:args.officer,content:args.content,evidence:args.evidence,userDecision:'pending',affectedRequirement:args.affectedRequirement??null}});
    session.append('wuji/officer-advice/activate',{adviceId:args.adviceId});
    return{adviceId:args.adviceId,officer:args.officer,status:'pending-user-decision'};
  }
};
export const councilPlanTool={
  name:'wuji_council_plan',
  description:'显式会审规划：仅在用户明确要求会审/多方独立审查时，生成相互隔离的官员审查合同；不自动启动、不汇改产物。',
  parameters:{type:'object',properties:{explicitUserRequest:{type:'boolean'},officers:{type:'array',items:{type:'string'}},artifact:{type:'string'}},required:['explicitUserRequest','officers','artifact']},
  output:{schema:{type:'object',properties:{mode:{type:'string'},contracts:{type:'array'}},required:['mode','contracts']},render(_a,v){return[{type:'text',text:JSON.stringify(v,null,2)}]}},
  isConcurrencySafe(){return true;},
  async execute(args){
    if(args.explicitUserRequest!==true)throw new Error('会审模式必须由用户明确请求，日常模式只激活一个官员职权');
    const officers=[...new Set(args.officers||[])];
    if(officers.length<2)throw new Error('显式会审至少需要两个不同官员职权');
    for(const officer of officers)if(!OFFICERS.has(officer)||officer==='composite')throw new Error(`会审职权无效：${officer}`);
    return{mode:'isolated-council',contracts:officers.map(officer=>({officer,artifact:args.artifact,canModify:false,canDispatch:false,canVeto:false,return:'advice+evidence only'}))};
  }
};
export default officerAdviseTool;

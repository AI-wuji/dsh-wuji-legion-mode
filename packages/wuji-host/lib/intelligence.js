// Wuji Legion · 情报官原生搜索工具
// 只负责搜集 DSH web provider 的结果；不做分析、不替参谋部下结论。
export const intelligenceSearchTool={
  name:'wuji_intelligence_search',
  description:'情报官：通过 DSH 原生 web Service 搜集多源资料；只返回来源和原始摘要，不负责分析结论。',
  parameters:{type:'object',properties:{query:{type:'string',description:'检索问题或关键词。'},maxResults:{type:'integer',description:'最多返回来源数，范围 1-20。'}},required:['query']},
  output:{schema:{type:'object',properties:{query:{type:'string'},content:{type:'string'},sources:{type:'array'},truncated:{type:'boolean'}},required:['query','content','sources','truncated']},render(_a,v){return[{type:'text',text:JSON.stringify(v,null,2)}]}},
  isConcurrencySafe(){return true},
  async execute(args,exec){
    if(typeof args.query!=='string'||!args.query.trim())throw new Error('情报查询不能为空');
    const web=exec.agent?.ctx?.get('web');
    if(!web)throw new Error('DSH web Service 未挂载，情报官无法执行搜索');
    const result=await web.search({query:args.query.trim(),maxResults:Math.min(20,Math.max(1,args.maxResults||10))},exec.signal);
    return{query:args.query.trim(),content:result.content||'',sources:result.sources||[],truncated:Boolean(result.truncated)};
  }
};
export default intelligenceSearchTool;

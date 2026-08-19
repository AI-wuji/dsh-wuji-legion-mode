import { requirementProjection, taskProjection, officerAdviceProjection } from '@wuji/dsh-wuji-host';
let pass=0, fail=0;
function check(name, value){if(value){pass++;console.log('✅ '+name)}else{fail++;console.log('❌ '+name)}}
let r=requirementProjection.apply(requirementProjection.init(),{type:'wuji/requirement/change',data:{unitId:'u1',patch:{goal:'PPT',dont:'',constraints:[],acceptance:'可打开',status:'draft',sourceMsgId:'m1'}}});
r=requirementProjection.apply(r,{type:'wuji/requirement/activate',data:{unitId:'u1'}});
const rv=requirementProjection.view(r); check('需求稀疏 view',rv.frame.length===1&&rv.active?.id==='u1'&&!('units' in rv)); check('需求 view schema',requirementProjection.schema.safeParse(rv).success);
let t=taskProjection.apply(taskProjection.init(),{type:'wuji/task/change',data:{taskId:'t1',patch:{deps:[],assignedTo:'视觉主帅',requirement:'PPT',input:'数据',output:'pptx',returnFormat:'json',failurePolicy:'reangle',status:'pending',evidence:null}}});
t=taskProjection.apply(t,{type:'wuji/task/activate',data:{taskId:'t1'}}); const tv=taskProjection.view(t); check('任务稀疏 view',tv.frame.length===1&&tv.active?.taskId==='t1'&&!('nodes' in tv)); check('任务 view schema',taskProjection.schema.safeParse(tv).success);
let o=officerAdviceProjection.apply(officerAdviceProjection.init(),{type:'wuji/officer-advice/change',data:{adviceId:'a1',patch:{officer:'qa',content:'风险',evidence:'e1',userDecision:'pending',affectedRequirement:'u1'}}});
o=officerAdviceProjection.apply(o,{type:'wuji/officer-advice/activate',data:{adviceId:'a1'}}); const ov=officerAdviceProjection.view(o); check('建议稀疏 view',ov.frame.length===1&&ov.active?.adviceId==='a1'&&!('advices' in ov)); check('建议 view schema',officerAdviceProjection.schema.safeParse(ov).success);
console.log(`结果: ${pass} 通过, ${fail} 失败`); process.exit(fail?1:0);

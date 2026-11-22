'use strict';

const deskProfile = globalThis.studentDeskProfile ?? {
  projects: [
    {id:'fpga', name:'数字逻辑实验', group:'课程项目', courses:[1,2], about:'课程示例 · 整理实验记录与报告', resources:[]},
    {id:'seminar', name:'数据结构研讨', group:'课程项目', courses:[3], about:'课程示例 · 准备研讨材料', resources:[]},
    {id:'english', name:'学术英语写作', group:'课程项目', courses:[10], about:'课程示例 · 从提纲到论文', resources:[]},
    {id:'course-demo', name:'课程展示', group:'课程项目', courses:[9], about:'课程示例 · 项目演示与总结', resources:[]}
  ],
  pins:['fpga','seminar','english'],
  home:[],
  courseLinks:[['同济 OJ','https://oj.tongji.edu.cn/']]
};
const projectCatalog = deskProfile.projects;
const scheduleExamples = deskProfile.examples ?? [
  {id:'trees', title:'二叉树遍历练习', courses:[3], type:'deadline', date:'2026-11-21', time:'23:59', source:'Canvas', brief:'实现三种遍历，附测试输入与输出。', tools:['测试脚本生成器','GitHub']},
  {id:'logic', title:'触发器实验报告', courses:[2], project:'fpga', type:'deadline', date:'2026-11-22', time:'17:00', source:'学习通', brief:'整理状态表、仿真波形和实验小结，标出时钟边沿。', tools:['进制转换','LaTeX 工具']},
  {id:'writing', title:'文献综述提纲', courses:[10], project:'english', type:'deadline', date:'2026-11-24', time:'18:00', source:'Canvas', brief:'列出综述提纲与每个分论点拟引用的文献。', tools:['Google Scholar','Overleaf']},
  {id:'jade', title:'玉石鉴赏章节测验', courses:[7], type:'quiz', date:null, source:'智慧树', brief:'复习矿物特征与鉴别方法；开放与截止时间待公告。'},
  {id:'prob', title:'条件概率练习', courses:[8], type:'deadline', date:'2026-11-25', source:'学习通', brief:'条件概率与全概率公式练习。公告仅给出日期。'},
  {id:'quiz-class', title:'离散数学课堂小测', courses:[4], type:'attendance', kind:'课堂小测', date:'2026-11-21', time:'10:00', endTime:'10:30', place:'教学楼 A201（示例）', source:'课堂通知', brief:'范围：命题逻辑、真值表与等值演算。'},
  {id:'seminar-demo', title:'数据结构课堂研讨', courses:[3], project:'seminar', type:'attendance', kind:'课堂研讨', date:'2026-11-21', time:'14:00', endTime:'15:30', place:'研讨教室（示例）', source:'课程公告', brief:'准备方案说明与复杂度分析，带上研讨报告参加讨论。'},
  {id:'course-show', title:'课程项目展示', courses:[7], project:'course-demo', type:'attendance', kind:'课堂展示', date:'2026-11-26', time:'13:30', endTime:'14:00', source:'课程公告', brief:'介绍方案与实现过程。'},
  {id:'course-report', title:'课程项目报告', courses:[9], project:'course-demo', type:'deadline', date:'2026-12-02', source:'课程公告', brief:'整理网站方案、演示地址与验证材料。'},
  {id:'quiz-window', title:'概率论线上小测', courses:[8], type:'quiz', openDate:'2026-11-28', openTime:'08:00', date:'2026-12-02', time:'20:00', duration:30, source:'学习通', brief:'范围：随机变量与分布。作答前确认网络，一次完成。'}
];

const semesterTerm = {name:'2026 秋季学期', start:'2026-09-14', weeks:16};
const solarHolidays = {
  '01-01':'元旦', '02-14':'情人节', '03-08':'妇女节', '05-01':'劳动节',
  '05-04':'青年节', '06-01':'儿童节', '09-10':'教师节', '10-01':'国庆节',
  '10-31':'万圣夜', '12-24':'平安夜', '12-25':'圣诞节'
};
const datedHolidays = {
  '2026-09-25':'中秋节', '2026-10-18':'重阳节', '2026-12-22':'冬至',
  '2027-02-06':'除夕', '2027-02-07':'春节', '2027-02-21':'元宵节'
};


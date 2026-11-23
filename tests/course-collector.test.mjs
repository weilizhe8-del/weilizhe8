import test from 'node:test';
import assert from 'node:assert/strict';
import { readList } from '../course-collector/extract.js';
import { platformFor, subscriptionAddress } from '../course-collector/platforms.js';
import { automaticLists, readSummary } from '../course-collector/automatic.js';

const address='https://course.example/assignments';
test('automatic cross-course import distinguishes an empty list, an unreadable list and expired login',()=>{
  const {url,kind}=automaticLists[0];
  globalThis.location=new URL(url);
  globalThis.document={body:{innerText:''},querySelector:()=>null};
  assert.match(readSummary(kind,url).error,/未显示列表/);
  document.body.innerText='暂无作业';
  assert.deepEqual(readSummary(kind,url).rows,[]);
  globalThis.location=new URL('https://example.org/login');
  assert.match(readSummary(kind,url).error,/登录/);
});
test('summary uses course metadata, skips closed exams and takes the end of a timed exam window',()=>{
  const {url,kind}=automaticLists[1];
  globalThis.location=new URL(url);
  function card(title,status,meta) {
    const dl={querySelector:s=>({textContent:s==='dt'?title:meta})};
    return {getAttribute:()=>'/exam?taskrefId=x&courseId=y&classId=z',
      querySelector:s=>s==='dl'?dl:s==='.ks_state'?{textContent:status}:null};
  }
  const list={querySelectorAll:()=>[card('测试甲','未开始','2026/11/01 00:00 – 2026/11/28 19:35'),card('测试乙','已过期','')]};
  globalThis.document={body:{innerText:'考试'},querySelector:s=>s==='ul.ks_list'?list:null};
  const result=readSummary(kind,url);
  assert.equal(result.skipped,1);
  assert.equal(result.rows.length,1);
  assert.equal(result.rows[0].date,'2026-11-28');
  assert.equal(result.rows[0].time,'19:35');
  assert.equal(result.rows[0].courseId,'y');
});
test('course subscriptions survive renewed URLs and keep courses, classes and sections distinct',()=>{
  const shell='https://mooc2-ans.chaoxing.com/mooc2-ans/mycourse/stu';
  const work=shell+'?courseid=one&clazzid=a&pageHeader=8';
  assert.equal(platformFor(work),'work');
  assert.equal(platformFor(work.replace('=8','=9')),'exam');
  assert.equal(subscriptionAddress(work),subscriptionAddress(work+'&t=renewed&enc=example'));
  for(const other of [work.replace('one','two'),work.replace('=a','=b'),work.replace('=8','=9')])
    assert.notEqual(subscriptionAddress(work),subscriptionAddress(other));
  assert.equal(platformFor('https://hike-teaching-center.polymas.com/stu-hike/studyTask'),'polymas');
  assert.equal(platformFor('https://hike-teaching-center.polymas.com/stu-hike/other'),undefined);
  assert.equal(platformFor(shell+'?pageHeader=7'),undefined);
  assert.equal(subscriptionAddress(address),address);
});
test('an unrecognized exam row does not discard a valid exam, or confirm an empty account',()=>{
  const {url,kind}=automaticLists[1];
  globalThis.location=new URL(url);
  const unreadable={textContent:'另一种考试卡片',querySelector:()=>null};
  const known={querySelector:k=>k==='dl'?{querySelector:s=>({textContent:s==='dt'?'测验':'2026-12-05 14:00'})}:null,getAttribute:()=>null};
  let cards=[unreadable,known];
  globalThis.document={body:{innerText:''},querySelector:s=>s==='ul.ks_list'?{querySelectorAll:()=>cards}:null};
  assert.equal(readSummary(kind,url).rows.length,1);
  assert.equal(readSummary(kind,url).unreadable,1);
  cards=[unreadable];assert.match(readSummary(kind,url).error,/1 行尚未识别/);
});
test('reads desktop exam table and keeps answer status separate from the exam window',()=>{
  const {url,kind}=automaticLists[1];
  globalThis.location=new URL(url);
  const cells=['1','课程考试','2026/11/12 08:00 - 2026/11/30 12:00','60分钟','已结束','已完成'];
  const row={querySelectorAll:()=>cells.map(textContent=>({textContent})),querySelector:()=>null,getAttribute:()=>null};
  globalThis.document={body:{innerText:''},querySelector:s=>s==='table.dataTable'?{querySelectorAll:()=>[row]}:null};
  const [result]=readSummary(kind,url).rows;assert.equal(result.title,'课程考试');assert.equal(result.completed,true);
  cells[4]='进行中';cells[5]='未答';assert.equal(readSummary(kind,url).rows[0].time,'12:00');
});
function listPage(tableRows,login=false) {
  const visible=()=>[{}];
  const rows=tableRows.map(values=>({getClientRects:visible,querySelectorAll:()=>values.map(innerText=>({innerText}))}));
  globalThis.location={href:address};
  globalThis.document={querySelector:()=>login?{}:null,querySelectorAll:selector=>
    selector.startsWith('table')?[{getClientRects:visible,querySelectorAll:()=>rows}]:[]};
}
test('extracts deadlines with exact dates, keeps date-only tasks and reports unparseable dates',()=>{
  listPage([['作业名称','课程名称','开放时间','截止时间'],['第一次作业','示例课','2026-10-01','2026年11月26日 9:05'],
    ['随堂测试','示例课','','2026-11-30'],['日期待定','示例课','','待通知'],['日期错误','示例课','','2026-02-31']]);
  assert.deepEqual(readList(address),{rows:[
    {title:'第一次作业',course:'示例课',date:'2026-11-26',time:'09:05',type:'deadline'},
    {title:'随堂测试',course:'示例课',date:'2026-11-30',time:'',type:'quiz'}],incomplete:2});
});
test('distinguishes login, changed URLs, unrecognized pages and a recognizable empty list',()=>{
  listPage([],true);assert.match(readList(address).error,/登录/);
  listPage([]);assert.match(readList(address+'/other').error,/地址/);
  listPage([['课程名称','上课时间']]);assert.match(readList(address).error,/未识别/);
  listPage([['任务名称','截止时间']]);assert.deepEqual(readList(address),{rows:[],incomplete:0});
});

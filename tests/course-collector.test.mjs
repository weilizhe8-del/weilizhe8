import test from 'node:test';
import assert from 'node:assert/strict';
import { readList } from '../course-collector/extract.js';
import { platformFor, subscriptionAddress } from '../course-collector/platforms.js';

const address='https://course.example/assignments';
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

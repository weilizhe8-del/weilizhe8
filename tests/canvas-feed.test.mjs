import test from 'node:test';
import assert from 'node:assert/strict';
import {feedUrl,parseFeed,applyEvents} from '../worker/canvas.js';

const url='https://canvas.tongji.edu.cn/feeds/calendars/user_fixture.ics';
const calendar=(day='20261123')=>[
  'BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT','UID:event-assignment-123','SUMMARY:实验报告',
  'URL:https://canvas.tongji.edu.cn/courses/1/assignments/123','DTSTART:'+day+'T160000Z','END:VEVENT',
  'BEGIN:VEVENT','UID:event-2','SUMMARY:课程讨论','DTSTART;VALUE=DATE:20261128','END:VEVENT','END:VCALENDAR'
].join('\r\n');
test('accepts only the Tongji feed endpoint and normalizes webcal',()=>{
  assert.equal(feedUrl(url.replace('https:','webcal:')),url);
  for(const bad of [url.replace('.edu.cn','.example.org'),url.replace('/feeds/calendars/','/courses/'),url+'?token=abc',url.replace('https://','https://u@')])assert.throws(()=>feedUrl(bad));
});
test('imports Shanghai dates, all-day events and assignment links; updates in place',async()=>{
  const {items,skipped}=await parseFeed(calendar());
  assert.equal(skipped,0);assert.equal(items[0].date,'2026-11-24');assert.equal(items[0].time,'00:00');
  assert.equal(items[0].type,'deadline');assert.equal(items[1].time,'');assert.equal(items[1].type,'attendance');
  const first=applyEvents(null,items,{}), id=items[0].id;
  first.data.notes=[[id,'保留']];first.data.done=[id];
  assert.equal(applyEvents(first.data,items,first.signatures).changed,false);
  const updated=applyEvents(first.data,(await parseFeed(calendar('20261125'))).items,first.signatures);
  assert.equal(updated.data.plans.length,2);assert.equal(updated.data.plans[0].date,'2026-11-26');
  assert.deepEqual(updated.data.done,[id]);assert.deepEqual(updated.data.notes,first.data.notes);
  assert.equal(updated.data.links[0][1],'https://canvas.tongji.edu.cn/courses/1/assignments/123');
  assert.deepEqual(applyEvents(updated.data,[],updated.signatures).data,updated.data);
});
test('does not treat login HTML as an empty feed',async()=>{
  await assert.rejects(parseFeed('<html>login</html>'));
});

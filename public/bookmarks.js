'use strict';

const platforms=[
  ['Canvas','https://canvas.tongji.edu.cn/','同济课程与作业'],
  ['学习通','https://e-learning.tongji.edu.cn/entry/','同济超星平台'],
  ['智慧树','https://www.zhihuishu.com/','在线课程与测验'],
  ['同济云课堂','https://courses.tongji.edu.cn/','课程视频与回看']
];
const colabUrl='https://colab.research.google.com/';
const initialPlatforms=[colabUrl,...deskProfile.home,...platforms.map(([,url])=>url)];
const shelfLinks=[
  ...platforms.map(([name,url,description])=>({name,url,description,category:'课程平台'})),
  ...deskProfile.courseLinks.map(([name,url])=>({name,url,category:'课程作业'})),
  ...projectCatalog.filter(p=>p.group==='课程项目').flatMap(p=>p.resources.filter(([,url])=>httpUrl(url))
    .map(([name,url])=>({name:p.name+' · '+name,url,category:'课程作业'}))),
  ...[
    ['Google Colab',colabUrl],
    ['Google Flow','https://flow.google.com/'],
    ['NotebookLM','https://notebooklm.google.com/']
  ].map(([name,url])=>({name,url,category:'AI 与实验'})),
  ...tools
];
const shelfCategories=['AI 与实验','课程平台','课程作业','我的收藏','旧站课程工具','学习资源','实用工具','其他资源'];
function assignmentSites() {
  const sites=[];
  for(const t of list()) {
    for(const [map,label] of [[taskLinks,'提交'],[requirementLinks,'要求']]) {
      const url=httpUrl(map.get(t.id));
      if(url) sites.push({name:t.title+' · '+label,url,category:'课程作业'});
    }
  }
  return sites;
}
function shelfSites() {
  const sites=new Map();
  // Personal entries stay editable when a task later points to the same address.
  for(const site of [...bookmarks,...shelfLinks,...assignmentSites()]) {
    const url=httpUrl(site.url);
    if(url && !sites.has(url)) sites.set(url,site);
  }
  return sites;
}
function renderBookmarks() {
  const groups=new Map();
  for(const site of shelfSites().values()) {
    if(!groups.has(site.category)) groups.set(site.category,[]);
    groups.get(site.category).push(site);
  }
  const categories=new Set([...shelfCategories,...groups.keys()]);
  $('bookmark-categories').replaceChildren(...Array.from(categories,c=>new Option(c)));
  const grid=$('tool-grid');
  grid.replaceChildren();
  for(const category of categories) {
    if(!groups.has(category)) continue;
    const section=node('section',null,'tool-group');
    const group=node('div',null,'tools-list');
    for(const site of groups.get(category)) {
      const a=link(site.name,site.url);
      if(!bookmarks.includes(site)) {group.append(a);continue;}
      const pair=node('span',null,'bookmark-pair');
      const edit=button('编辑',()=>openBookmark(site),'text-button');
      edit.setAttribute('aria-label','编辑网站：'+site.name);
      pair.append(a,edit);group.append(pair);
    }
    section.append(node('h2',category),group);grid.append(section);
  }
}
const phoneOverview=matchMedia('(max-width:660px)');
const platformSection=$('platform-links').closest('section');
let showAllPlatforms=false;
function updatePlatformList() {
  const links=$('platform-links').querySelectorAll('a');
  const compact=phoneOverview.matches && links.length>2;
  links.forEach((a,i)=>{a.hidden=compact && !showAllPlatforms && i>=2;});
  const toggle=$('more-platforms');
  toggle.hidden=!compact;
  toggle.setAttribute('aria-expanded',String(!compact || showAllPlatforms));
  toggle.textContent=showAllPlatforms?'收起其余平台':'展开其余 '+Math.max(0,links.length-2)+' 个平台';
}
function positionPlatforms() {
  const panels=$('overview').querySelector('.overview-grid');
  if(phoneOverview.matches) panels.before(platformSection);
  else panels.after(platformSection);
  updatePlatformList();
}
phoneOverview.addEventListener('change',positionPlatforms);
positionPlatforms();
$('more-platforms').onclick=()=>{showAllPlatforms=!showAllPlatforms;updatePlatformList();};
function renderHomePlatforms() {
  const sites=shelfSites();
  const cards=[];
  for(const url of homePlatforms ?? initialPlatforms) {
    const site=sites.get(url);
    if(!site) continue;
    const a=link(site.name,url);
    a.className='';
    a.replaceChildren(node('strong',site.name),node('span',site.description || site.category));
    cards.push(a);
  }
  $('platform-links').replaceChildren(...(cards.length?cards:[node('p','点「自定义」添加常用网站。','empty')]));
  updatePlatformList();
}
let pendingPlatforms=[];
function openPlatformSettings() {
  const sites=shelfSites();
  pendingPlatforms=(homePlatforms ?? initialPlatforms).filter(url=>sites.has(url));
  $('platform-error').textContent='';
  renderPlatformSettings(sites);
  $('platform-dialog').showModal();
}
function renderPlatformSettings(sites=shelfSites()) {
  const picker=$('platform-picker');
  const groups=new Map();
  for(const [url,site] of sites) {
    if(pendingPlatforms.includes(url)) continue;
    if(!groups.has(site.category)) {
      const group=node('optgroup');group.label=site.category;groups.set(site.category,group);
    }
    groups.get(site.category).append(new Option(site.name,url));
  }
  picker.replaceChildren(new Option(groups.size?'选择网站…':'网站均已加入首页',''),...groups.values());
  $('pin-platform').disabled=true;
  picker.disabled=!groups.size;
  const order=$('platform-order');
  order.replaceChildren();
  for(const [i,url] of pendingPlatforms.entries()) {
    const name=sites.get(url).name;
    const row=node('li');
    row.append(node('span',name));
    for(const [action,offset] of [['上移',-1],['下移',1],['移除',0]]) {
      const control=button(action,()=>{
        pendingPlatforms.splice(i,1);
        if(offset) pendingPlatforms.splice(i+offset,0,url);
        renderPlatformSettings(sites);
        const index=Math.min(i+offset,pendingPlatforms.length-1);
        const next=$('platform-order').children[index];
        (next?.querySelector('button[data-action="'+action+'"]:not(:disabled)') || next?.querySelector('button:not(:disabled)') || picker).focus();
      },'text-button');
      control.dataset.action=action;
      control.setAttribute('aria-label',action+' '+name);
      control.disabled=i+offset<0 || i+offset>=pendingPlatforms.length;
      row.append(control);
    }
    order.append(row);
  }
}
$('manage-home-platforms').onclick=openPlatformSettings;
$('manage-tool-platforms').onclick=openPlatformSettings;
$('platform-picker').onchange=e=>{$('pin-platform').disabled=!e.target.value;};
$('pin-platform').onclick=()=>{
  const url=$('platform-picker').value;
  if(!url || pendingPlatforms.includes(url)) return;
  pendingPlatforms.push(url);renderPlatformSettings();$('platform-picker').focus();
};
$('save-platforms').onclick=()=>{
  try {installPersonalData({...personalData(),homePlatforms:[...pendingPlatforms]});}
  catch(error) {$('platform-error').textContent='保存失败：'+error.message;return;}
  $('platform-dialog').close();renderHomePlatforms();
};
let editingBookmark=null;
function openBookmark(site=null) {
  editingBookmark=site;
  $('bookmark-heading').textContent=site?'编辑网站':'添加网站';
  $('bookmark-name').value=site?.name || '';
  $('bookmark-url').value=site?.url || '';
  $('bookmark-category').value=site?.category || '我的收藏';
  $('remove-bookmark').hidden=!site;
  $('bookmark-error').textContent='';
  $('bookmark-dialog').showModal();
  $('bookmark-name').focus();
}
function saveBookmarks(next,replacement=null) {
  const data={...personalData(),bookmarks:next};
  if(editingBookmark && homePlatforms?.includes(editingBookmark.url)) {
    data.homePlatforms=homePlatforms.flatMap(url=>url===editingBookmark.url?(replacement?[replacement.url]:[]):[url]);
  }
  try {installPersonalData(data);}
  catch(error) {$('bookmark-error').textContent='保存失败：'+error.message;return;}
  $('bookmark-dialog').close();
  renderBookmarks();
}
$('add-bookmark').onclick=()=>openBookmark();
$('bookmark-form').onsubmit=e=>{
  e.preventDefault();
  const name=$('bookmark-name').value.trim();
  const url=httpUrl($('bookmark-url').value.trim());
  const category=$('bookmark-category').value.trim();
  if(!name || !url || !category) {
    $('bookmark-error').textContent='请填写名称、分类和有效的 HTTP 或 HTTPS 网址。';return;
  }
  if(url!==editingBookmark?.url && [...bookmarks,...shelfLinks,...assignmentSites()].some(site=>httpUrl(site.url)===url)) {
    $('bookmark-error').textContent='工具架已经收录了这个网址。';return;
  }
  const site={name,url,category};
  saveBookmarks(editingBookmark?bookmarks.map(b=>b===editingBookmark?site:b):[...bookmarks,site],site);
};
$('remove-bookmark').onclick=()=>{
  if(editingBookmark && confirm('删除收藏「'+editingBookmark.name+'」？')) saveBookmarks(bookmarks.filter(b=>b!==editingBookmark));
};

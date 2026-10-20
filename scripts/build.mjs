import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const pagesOutput = path.join(root, 'docs');
const source = path.join(root, 'content/posts');
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const pad = value => String(value).padStart(2, '0');
const slug = value => value.trim().toLowerCase().replace(/[^\w\u4e00-\u9fff\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'section';
const textContent = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const encodePath = value => value.split('/').map(encodeURIComponent).join('/');
const relativeUrl = (from, to) => encodePath(path.posix.relative(path.posix.dirname(from), to));

function readPost(filename) {
  const document = fs.readFileSync(path.join(source, filename), 'utf8').replace(/\r/g, '');
  const match = document.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: 缺少文章元数据。`);
  const metadata = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const field = line.match(/^([a-zA-Z]+):\s*(.+)$/);
    if (!field) throw new Error(`${filename}: 无法解析 ${line}`);
    metadata[field[1]] = /^["\[]/.test(field[2]) ? JSON.parse(field[2]) : field[2].trim();
  }
  for (const field of ['title', 'date', 'category']) {
    if (typeof metadata[field] !== 'string' || !metadata[field]) throw new Error(`${filename}: 缺少 ${field}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)) throw new Error(`${filename}: 日期须为 YYYY-MM-DD。`);
  const localPath = decodeURIComponent(metadata.path || `${metadata.category}/${metadata.date.replaceAll('-', '/')}/${metadata.title}.html`).replace(/^\/+/, '');
  if (!localPath.endsWith('.html') || localPath.includes('\\') || localPath.split('/').includes('..')) throw new Error(`${filename}: 非法文章路径。`);
  const toc = [];
  const counts = new Map();
  const body = marked.parse(match[2].trimStart().replace(/^# .+(?:\n|$)/, '')).replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
    const title = textContent(inner);
    const base = slug(title);
    const count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    const id = metadata.headingIds?.[toc.length] || (count===1 ? base : `${base}-${count}`);
    toc.push({id, level:Number(level), title});
    return `<h${level} id="${escape(id)}">${inner}</h${level}>`;
  });
  if (metadata.headingIds && metadata.headingIds.length!==toc.length) throw new Error(`${filename}: 目录变化后请更新或移除 headingIds。`);
  return {...metadata, localPath, href:encodePath(localPath), body, toc, text:textContent(body)};
}

const posts = fs.readdirSync(source).filter(name => name.endsWith('.md')).map(readPost).sort((a,b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
const paths = new Set();
posts.forEach((post, index) => {
  if (paths.has(post.localPath)) throw new Error(`文章路径重复：${post.localPath}`);
  paths.add(post.localPath);
  post.number = index+1;
});
const newestFirst = [...posts].reverse();
fs.rmSync(output, {recursive:true, force:true});
fs.mkdirSync(output, {recursive:true});
fs.cpSync(path.join(root, 'src/assets'), path.join(output, 'assets'), {recursive:true});

function write(filename, content) {
  const target = path.resolve(output, filename);
  if (!target.startsWith(output+path.sep)) throw new Error('输出路径超出 dist。');
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, content);
}
function fill(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`未定义模板字段：${key}`);
    return values[key];
  });
}
const searchData = newestFirst.map(({title,category,date,dateLabel,number,href,text}) => ({title,category,date,dateLabel,number,href,text}));
write('assets/data.js', 'window.BLOG_POSTS = '+JSON.stringify(searchData).replace(/</g, '\\u003c')+';\n');
const indexTemplate = fs.readFileSync(path.join(root, 'src/templates/index.html'), 'utf8');
for (const file of ['index.html', 'directory/index.html']) {
  const prefix = file.includes('/') ? '../' : '';
  const filters = ['全部',...new Set(newestFirst.map(post => post.category))].map(category => `<button class="filter${category==='全部'?' active':''}" type="button" data-filter="${escape(category)}" aria-pressed="${category==='全部'}"><span>${escape(category==='不知道'?'其他':category)}</span><span class="filter-count">${pad(category==='全部'?posts.length:posts.filter(post => post.category===category).length)}</span></button>`).join('');
  const rows = newestFirst.map(post => `<a class="post-row" href="${escape(prefix+post.href)}"><span class="post-number">${pad(post.number)}</span><div class="post-copy"><span class="post-category">${escape(post.category)}</span><h2>${escape(post.title)}</h2></div><div class="post-tail"><time datetime="${post.date}">${escape(post.dateLabel || post.date.replaceAll('-','.'))}</time><span class="post-arrow" aria-hidden="true">↗</span></div></a>`).join('\n');
  write(file, fill(indexTemplate, {ROOT:prefix,COUNT:pad(posts.length),FILTERS:filters,POSTS:rows}));
}
const articleTemplate = fs.readFileSync(path.join(root, 'src/templates/article.html'), 'utf8');
posts.forEach((post,index) => {
  const item = (target,label,rel) => target ? `<a href="${escape(relativeUrl(post.localPath,target.localPath))}" rel="${rel}"><span class="nav-label">${label}</span><span class="nav-title">${escape(target.title)}</span></a>` : `<span class="nav-disabled" aria-disabled="true">没有${rel==='prev'?'上一篇':'下一篇'}</span>`;
  const navigation = item(posts[index-1],'← 上一篇','prev')+item(posts[index+1],'下一篇 →','next');
  const toc = post.toc.map(heading => `<a class="toc-link" data-level="${heading.level}" href="#${escape(heading.id)}">${escape(heading.title)}</a>`).join('\n') || '<p class="toc-empty">暂无目录</p>';
  write(post.localPath, fill(articleTemplate, {TITLE:escape(post.title),TITLE_ID:escape(slug(post.title)),CATEGORY:escape(post.category),DATE:post.date,DATE_LABEL:escape(post.dateLabel||post.date.replaceAll('-','.')),NUMBER:pad(post.number),HOME:escape(relativeUrl(post.localPath,'index.html')),ASSETS:escape(relativeUrl(post.localPath,'assets')+'/'),BODY:post.body,NAVIGATION:navigation,TOC:toc}));
});
write('.nojekyll', '');
fs.rmSync(pagesOutput, {recursive:true, force:true});
fs.cpSync(output, pagesOutput, {recursive:true});
console.log(`已构建 ${posts.length} 篇文章，输出 dist/ 和 docs/。`);

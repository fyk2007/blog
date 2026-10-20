import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const failures = [];
const expectedCount = fs.readdirSync(path.join(root,'../content/posts')).filter(file=>file.endsWith('.md')).length;
const documents = new Map();
const origin = 'https://local.invalid';
const insideRoot = file => file === root || file.startsWith(root + path.sep);
const fail = message => failures.push(message);
const relative = file => path.relative(root, file).split(path.sep).join('/');

function decodeEntities(value) {
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos));/gi, (match, decimal, hex, named) => {
    if (decimal || hex) {
      const point = parseInt(decimal ?? hex, decimal ? 10 : 16);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named.toLowerCase()];
  });
}

function attributes(tag) {
  const result = {};
  const expression = /([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(expression)) {
    result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4]);
  }
  return result;
}

function tags(html) {
  return [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<[a-z][^>]*>/gi)].map(match => ({
    text: match[0],
    attributes: attributes(match[0]),
  }));
}

function hasClass(value, name) {
  return (value ?? '').split(/\s+/).includes(name);
}

function list(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return list(file);
    if (entry.isFile()) return [file];
    fail(`产物中存在非常规文件：${relative(file)}`);
    return [];
  });
}

let files;
try {
  files = list(root);
} catch (error) {
  console.error('无法读取 dist/，请先运行 npm run build。');
  process.exit(1);
}

for (const file of files.filter(file => path.extname(file).toLowerCase() === '.html')) {
  const html = fs.readFileSync(file, 'utf8');
  const parsedTags = tags(html);
  const ids = new Set();
  for (const tag of parsedTags) {
    if (tag.attributes.id === undefined) continue;
    if (ids.has(tag.attributes.id)) fail(`${relative(file)}：重复 id "${tag.attributes.id}"`);
    ids.add(tag.attributes.id);
  }
  documents.set(file, { html, tags: parsedTags, ids });
}

function resolveLocal(from, value, label) {
  if (/^(?:https?:|mailto:|tel:|data:|\/\/)/i.test(value)) return null;
  let url;
  let file;
  try {
    const fromPath = relative(from).split('/').map(encodeURIComponent).join('/');
    url = new URL(value, origin + '/' + fromPath);
    if (url.origin !== origin) throw new Error('Unsupported URL scheme');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\0') || pathname.includes('\\')) throw new Error('Invalid path');
    file = path.resolve(root, '.' + pathname);
    if (!insideRoot(file)) throw new Error('Path escapes dist');
    const stat = fs.statSync(file);
    if (stat.isDirectory()) file = path.join(file, 'index.html');
    if (!fs.statSync(file).isFile()) throw new Error('Not a file');
  } catch {
    fail(`${relative(from)}：${label} 无法访问 "${value}"`);
    return null;
  }
  let fragment = '';
  try {
    fragment = decodeURIComponent(url.hash.slice(1));
  } catch {
    fail(`${relative(from)}：无效的锚点 "${value}"`);
  }
  if (fragment && documents.has(file) && !documents.get(file).ids.has(fragment)) {
    fail(`${relative(from)}：${label} 的锚点不存在 "${value}"`);
  }
  return file;
}

let references = 0;
for (const [file, document] of documents) {
  for (const tag of document.tags) {
    for (const name of ['href', 'src']) {
      if (tag.attributes[name] === undefined) continue;
      references++;
      resolveLocal(file, tag.attributes[name], name);
    }
  }
}

for (const file of files.filter(file => path.extname(file).toLowerCase() === '.css')) {
  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const resources = [
    ...[...css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/gi)].map(match => match[1] ?? match[2] ?? match[3]),
    ...[...css.matchAll(/@import\s+["']([^"']+)["']/gi)].map(match => match[1]),
  ];
  for (const resource of resources) {
    if (!resource || resource.startsWith('#')) continue;
    references++;
    resolveLocal(file, resource, 'CSS 资源');
  }
}

const index = documents.get(path.join(root, 'index.html'));
if (!index) fail('缺少 index.html。');
else {
  const numbers = [...index.html.matchAll(/<[^>]*class=["'][^"']*\bpost-number\b[^"']*["'][^>]*>\s*(\d+)\s*</gi)].map(match => Number(match[1]));
  if (numbers.join(',') !== Array.from({length:expectedCount},(_,i)=>expectedCount-i).join(',')) {
    fail(`首页文章序号应从最新到最早递减，实际为：${numbers.join(', ') || '无'}`);
  }
}

const articles = [];
for (const [file, document] of documents) {
  if (!document.tags.some(tag => /^<body\b/i.test(tag.text) && hasClass(tag.attributes.class, 'article-page'))) continue;
  const number = document.html.match(/<[^>]*class=["'][^"']*\barticle-number\b[^"']*["'][^>]*>\s*(\d+)\s*</i);
  if (!number) {
    fail(`${relative(file)}：缺少文章序号。`);
    continue;
  }
  articles.push({ file, document, number: Number(number[1]) });
}
articles.sort((a, b) => a.number - b.number);
if (articles.map(article => article.number).join(',') !== Array.from({length:expectedCount},(_,i)=>i+1).join(',')) {
  fail(`应生成 ${expectedCount} 篇独立文章，且文章序号完整、不重复。`);
}

for (let index = 0; index < articles.length; index++) {
  const article = articles[index];
  const navigation = article.document.html.match(/<nav\b[^>]*class=["'][^"']*\barticle-pagination\b[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i);
  if (!navigation) {
    fail(`${relative(article.file)}：缺少正文底部翻页导航。`);
    continue;
  }
  const links = tags(navigation[1]).filter(tag => /^<a\b/i.test(tag.text));
  for (const [rel, expected] of [['prev', articles[index - 1]], ['next', articles[index + 1]]]) {
    const matches = links.filter(link => (link.attributes.rel ?? '').split(/\s+/).includes(rel));
    if (!expected) {
      if (matches.length) fail(`${relative(article.file)}：首尾文章不应存在 ${rel} 链接。`);
      continue;
    }
    if (matches.length !== 1 || !matches[0].attributes.href) {
      fail(`${relative(article.file)}：应有一个 ${rel} 文章链接。`);
      continue;
    }
    const target = resolveLocal(article.file, matches[0].attributes.href, rel);
    if (target !== expected.file) fail(`${relative(article.file)}：${rel} 未指向相邻文章。`);
  }
}

if (failures.length) {
  console.error(`静态产物检查失败（${failures.length} 项）：\n` + failures.map(message => `- ${message}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`检查通过：${documents.size} 个 HTML、${references} 处资源与链接、${expectedCount} 篇文章的目录锚点及前后篇导航。`);
}

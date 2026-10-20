(() => {
  'use strict';
  const posts = window.BLOG_POSTS || [];
  const root = document.body.dataset.root || '';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const container = document.getElementById('posts');
  const filters = document.getElementById('filters');
  const search = document.getElementById('search');
  const count = document.querySelector('[data-result-count]');
  let category = '全部';
  function render() {
    const query = search.value.trim().toLowerCase();
    const visible = posts.filter(p => (category === '全部' || p.category === category) && (!query || (p.title + p.category + p.text).toLowerCase().includes(query)));
    container.innerHTML = visible.map(p => `<a class="post-row" href="${escape(root+p.href)}"><span class="post-number">${String(p.number).padStart(2,'0')}</span><div class="post-copy"><span class="post-category">${escape(p.category)}</span><h2>${escape(p.title)}</h2></div><div class="post-tail"><time datetime="${p.date}">${p.dateLabel||p.date.replaceAll('-','.')}</time><span class="post-arrow" aria-hidden="true">↗</span></div></a>`).join('') || '<p class="empty-state" role="status">没有找到相关文章。</p>';
    count.textContent = String(visible.length).padStart(2, '0');
  }
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    category = button.dataset.filter;
    filters.querySelectorAll('button').forEach(b => { b.classList.toggle('active', b===button); b.setAttribute('aria-pressed', String(b===button)); });
    render();
  });
  search.addEventListener('input', render);
  window.addEventListener('pageshow', render);
  render();
})();

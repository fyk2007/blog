(function () {
  'use strict';

  function initializeArticle() {
    var details = document.querySelector('.article-toc');
    var toc = document.getElementById('article-toc');
    if (!toc) return;

    if (details && window.matchMedia('(max-width: 700px)').matches && !window.location.hash) {
      details.open = false;
    }

    var entries = Array.prototype.map.call(toc.querySelectorAll('a[href^="#"]'), function (link) {
      var id;
      try {
        id = decodeURIComponent(link.getAttribute('href').slice(1));
      } catch (error) {
        id = link.getAttribute('href').slice(1);
      }
      return { link: link, heading: document.getElementById(id) };
    }).filter(function (entry) {
      return entry.heading;
    });

    if (!entries.length) return;

    var scheduled = false;
    var activeLink = null;

    function updateCurrentSection() {
      scheduled = false;
      var current = entries[0];
      var threshold = Math.min(140, window.innerHeight * 0.2);

      entries.forEach(function (entry) {
        if (entry.heading.getBoundingClientRect().top <= threshold) current = entry;
      });

      // At the end of a short final section, its heading may never reach the top.
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 3) {
        current = entries[entries.length - 1];
      }

      if (activeLink === current.link) return;
      entries.forEach(function (entry) {
        var isCurrent = entry === current;
        entry.link.classList.toggle('active', isCurrent);
        if (isCurrent) entry.link.setAttribute('aria-current', 'location');
        else entry.link.removeAttribute('aria-current');
      });
      activeLink = current.link;
    }

    function scheduleUpdate() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(updateCurrentSection);
    }

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    window.addEventListener('hashchange', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    window.addEventListener('load', scheduleUpdate);
    updateCurrentSection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeArticle);
  } else {
    initializeArticle();
  }
}());

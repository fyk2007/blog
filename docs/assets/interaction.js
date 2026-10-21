(() => {
  'use strict';
  const messages = ['快来用鼠标痛击fyk', '很遗憾你没有击中，因为fyk反应快（fyk）'];
  document.querySelectorAll('[data-fyk-game]').forEach(game => {
    const target = game.querySelector('[data-fyk-target]');
    const message = game.querySelector('[data-fyk-message]');
    let current = 0;
    target.addEventListener('click', () => {
      current = (current + 1) % messages.length;
      message.textContent = messages[current];
    });
  });
})();

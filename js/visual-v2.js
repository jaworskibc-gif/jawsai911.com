(() => {
  'use strict';
  const workflows = {
    insurance: {
      caption: 'Your scripts. Your requirements. Your team.',
      steps: [['Conversation', 'Capture the information needed for enrollment.'], ['Agent guidance', 'Keep the workflow and relevant context together.'], ['Configured checkpoints', 'Meet the agency’s required conditions before proceeding.'], ['Review & follow-up', 'Give the team visibility for the next step.']],
      description: 'CCM connects enrollment, agent guidance, and configurable compliance checkpoints. Workflow controls support agency oversight.',
      url: '/ccm-demo/', label: 'Explore CCM'
    },
    business: {
      caption: 'Your public site. Your operating system.',
      steps: [['Visitor arrives', 'Make services and contact paths easy to find.'], ['Inquiry captured', 'Bring the conversation into a shared lead pipeline.'], ['Team follows up', 'Coordinate the next action and appointment.'], ['Relationship grows', 'Connect content, reviews, and ongoing follow-up.']],
      description: 'A Shark SuperSite connects the experience your customers see with the workspace your team uses behind the scenes.',
      url: 'supersite.html', label: 'Explore SuperSites'
    },
    custom: {
      caption: 'Your process. Connected tools. Purpose-built software.',
      steps: [['Map the task', 'Identify the inputs, handoffs, and desired outcome.'], ['Connect the tools', 'Bring the relevant systems and data into the workflow.'], ['Apply the rules', 'Use defined logic and review points for the task.'], ['Deliver the work', 'Return the result to the team or the next system.']],
      description: 'Custom AI development combines agents, integrations, and full-stack applications around a specific operational need.',
      url: 'solutions.html', label: 'Explore AI development'
    }
  };
  const tabs = [...document.querySelectorAll('[data-workflow]')];
  const panel = document.querySelector('#vx-workflow-panel');
  const flow = document.querySelector('.vx-flow');
  const activate = tab => {
    const data = workflows[tab.dataset.workflow];
    tabs.forEach(item => { const active = item === tab; item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; });
    panel.setAttribute('aria-labelledby', tab.id);
    panel.querySelector('.vx-flow-caption').textContent = data.caption;
    [...flow.children].forEach((item, index) => { item.querySelector('h3').textContent = data.steps[index][0]; item.querySelector('p').textContent = data.steps[index][1]; });
    panel.querySelector('[data-flow-description]').textContent = data.description;
    const link = panel.querySelector('[data-flow-link]');
    link.href = data.url;
    link.replaceChildren(document.createTextNode(data.label + ' '));
    const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗'; link.append(arrow);
    flow.classList.remove('is-switching');
    void flow.offsetWidth;
    flow.classList.add('is-switching');
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target === undefined) return;
      event.preventDefault(); tabs[target].focus(); activate(tabs[target]);
    });
  });
  const dialog = document.querySelector('.vx-film-dialog');
  const opener = document.querySelector('[data-open-film]');
  const movie = dialog?.querySelector('video');
  if (dialog && typeof dialog.showModal === 'function') {
    opener?.addEventListener('click', event => {
      event.preventDefault(); dialog.showModal(); document.body.classList.add('vx-dialog-open');
      movie.play().then(() => { if (!dialog.open) movie.pause(); }).catch(() => {});
    });
    dialog.querySelector('.vx-dialog-close').addEventListener('click', () => { movie.pause(); dialog.close(); });
    dialog.addEventListener('cancel', () => movie.pause());
    dialog.addEventListener('close', () => { movie.pause(); document.body.classList.remove('vx-dialog-open'); opener?.focus({ preventScroll: true }); });
    dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
  }
})();

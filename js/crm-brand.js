(()=>{
const brand='<span class="jaws-wordmark">JAWS<span>AI</span>911</span><span class="jaws-tagline">AI SYSTEMS &amp; AUTOMATION</span>';
const original=document.querySelector('.topbar .brand,.header .brand');
if(original){const name=document.title.replace(/^JAWSAI911\s*/,'');original.innerHTML='<a class="jaws-brand-link" href="/dashboard.html" aria-label="JAWSAI911 dashboard">'+brand+'</a><span class="jaws-page-name"></span>';original.querySelector('.jaws-page-name').textContent=name;}
const routes=[['Overview','/dashboard.html'],['Sales Console','/toolkit/Sales_Console.html'],['Pipeline','/toolkit/JAWSAI911_Pipeline_CRM.html'],['Lead Detail','/toolkit/Lead_Detail.html'],['Dialer','/toolkit/JAWSAI911_Power_Dialer.html'],['Build Demo','/toolkit/JAWSAI911_Site_Builder.html'],['Documents','/toolkit/Sales_Documents.html']];
const more=[['Reporting','JAWSAI911_Dashboard.html'],['Call Tracker','JAWSAI911_Call_Tracker.html'],['Invoicing','JAWSAI911_Invoicing.html'],['Proposals','Proposal_Generator.html'],['Workflows','JAWSAI911_Workflow_Builder.html'],['Forms','JAWSAI911_Form_Builder.html'],['Reputation','JAWSAI911_Reputation_Manager.html'],['Content Planner','JAWSAI911_Content_Planner.html'],['Telegram Console','Telegram_Grok_Console.html']];
const nav=document.createElement('nav');nav.className='jaws-nav';nav.setAttribute('aria-label','CRM navigation');
for(const [label,href] of routes){const a=document.createElement('a');a.textContent=label;a.href=href;if(location.pathname===href)a.setAttribute('aria-current','page');nav.append(a);}
const details=document.createElement('details');details.className='jaws-more';const summary=document.createElement('summary');summary.textContent='More tools';details.append(summary);const menu=document.createElement('div');for(const [label,file] of more){const a=document.createElement('a');a.textContent=label;a.href='/toolkit/'+file;if(location.pathname===a.pathname)a.setAttribute('aria-current','page');menu.append(a);}details.append(menu);nav.append(details);
const top=document.querySelector('.topbar,.header');if(top)top.after(nav);
document.addEventListener('click',e=>{if(!details.contains(e.target))details.open=false});document.addEventListener('keydown',e=>{if(e.key==='Escape'){details.open=false;}});
if(window.self!==window.top){document.body.classList.add('jaws-embedded');}
})();

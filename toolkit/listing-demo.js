(function (root) {
  'use strict';
  const templates = {
    commercial: {label:'Commercial maintenance',theme:'navy',match:/commercial|facility|facilities|property maintenance/i,services:['Facility maintenance','Service requests','Project coordination']},
    construction: {label:'Construction',theme:'slate',match:/construction|contractor|remodel|roofing|builder/i,services:['Project consultation','Construction services','Project estimates']},
    hvac: {label:'HVAC',theme:'ocean',match:/hvac|air conditioning|heating|cooling/i,services:['Heating and cooling','System maintenance','Service appointments']},
    plumbing: {label:'Plumbing',theme:'ocean',match:/plumb|drain|sewer/i,services:['Plumbing services','Maintenance','Service appointments']},
    landscaping: {label:'Landscaping',theme:'forest',match:/landscap|lawn|tree service|garden/i,services:['Landscape care','Property maintenance','Project consultation']},
    beauty: {label:'Salon and beauty',theme:'slate',match:/salon|barber|beauty|nails|hair studio/i,services:['Services and appointments','Consultations','Personal care']},
    insurance: {label:'Insurance agency',theme:'navy',match:/insurance|medicare|benefits agency/i,services:['Coverage consultation','Plan questions','Appointment scheduling']},
    general: {label:'Local business',theme:'ocean',match:/$^/,services:['Our services','Consultations','Appointments']}
  };
  function parseListing(input, selected) {
    const text=String(input || '').trim();
    if (!text || text.length>50000) throw new Error('Drop or paste listing text (up to 50,000 characters).');
    if (/^https?:\/\/\S+$/i.test(text)) throw new Error('This drop contains only a link. Copy the business name, category, address and phone from the listing and paste them here.');
    let obj={};
    if (text.startsWith('{')) {
      try { obj=JSON.parse(text); } catch (_) { throw new Error('The listing JSON is invalid. Paste the listing text instead.'); }
    }
    const lines=text.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    const labeled=(label)=>{const m=text.match(new RegExp('(?:^|\\n)'+label+'\\s*:\\s*([^\\n]+)','i'));return m?m[1].trim():''};
    const string=(v)=>typeof v==='string'?v.trim():'';
    const name=string(obj.name)||string(obj.business_name)||labeled('(?:business name|name)')||lines.find(v=>!/^https?:|^(?:phone|category|address|city|rating|reviews)\s*:/i.test(v));
    if (!name || name.length>200) throw new Error('Include a business name on the first line or as “Name:”.');
    const niche=selected && selected!=='auto'?selected:(Object.keys(templates).find(k=>templates[k].match.test(text))||'general');
    if (!templates[niche]) throw new Error('Select an available niche.');
    const preset=templates[niche];
    const phoneMatch=text.match(/(?:\+?1[ .-]?)?\(?[2-9]\d{2}\)?[ .-]?\d{3}[ .-]?\d{4}\b/);
    const city=string(obj.city)||string(obj.address && obj.address.addressLocality)||labeled('(?:city|area)');
    return {niche,theme:preset.theme,bizName:name,city,phone:string(obj.telephone)||string(obj.phone)||(phoneMatch?phoneMatch[0]:''),headline:name+' — '+preset.label,subhead:'Explore services and contact '+name+' to discuss your needs.',services:preset.services.map(name=>({name,desc:'Contact the business for availability and details.'})),reviews:[],galleryImages:[],rating:0,reviewCount:0,quote:''};
  }
  root.JAWSListingDemo={templates,parseListing};
})(typeof window === 'undefined' ? globalThis : window);

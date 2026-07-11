(function () {
  const STORAGE_KEY = 'jaw_referral_hub_v1';
  const SCAN_WINDOW_MS = 30 * 60 * 1000;

  function nowIso() {
    return new Date().toISOString();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return normalizeState(parsed);
      }
    } catch (error) {
      console.warn('Failed to read referral state', error);
    }
    return normalizeState({});
  }

  function normalizeState(state) {
    const normalized = state && typeof state === 'object' ? state : {};
    normalized.version = 1;
    normalized.reps = normalized.reps || {
      aaron: {
        id: 'aaron',
        name: 'Aaron Elrod',
        publicPath: '/aaron',
        agentPath: '/aaron-agent',
        publicDiscountPercent: 10
      }
    };
    normalized.scans = Array.isArray(normalized.scans) ? normalized.scans : [];
    normalized.leads = Array.isArray(normalized.leads) ? normalized.leads : [];
    return normalized;
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
  }

  function createId(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
  }

  function trackScan(repId, sourceType) {
    const state = loadState();
    const throttleKey = 'jaw_scan_' + repId + '_' + sourceType;
    const lastTracked = Number(localStorage.getItem(throttleKey) || 0);
    const now = Date.now();
    if (now - lastTracked < SCAN_WINDOW_MS) {
      return false;
    }
    state.scans.push({
      id: createId('scan'),
      repId: repId,
      sourceType: sourceType,
      createdAt: nowIso(),
      path: location.pathname
    });
    saveState(state);
    localStorage.setItem(throttleKey, String(now));
    return true;
  }

  function createLead(input) {
    const state = loadState();
    const lead = {
      id: createId('lead'),
      repId: input.repId,
      repName: state.reps[input.repId] ? state.reps[input.repId].name : input.repId,
      sourceType: input.sourceType,
      discountApplied: Boolean(input.discountApplied),
      discountPercent: input.discountApplied ? 10 : 0,
      clientName: input.clientName,
      phone: input.phone,
      businessName: input.businessName,
      email: input.email,
      createdAt: nowIso(),
      status: 'new',
      closedSale: false,
      commissionOwed: 0,
      notes: ''
    };
    state.leads.unshift(lead);
    saveState(state);
    return lead;
  }

  function updateLead(id, updates) {
    const state = loadState();
    const lead = state.leads.find(function (entry) {
      return entry.id === id;
    });
    if (!lead) return null;
    Object.assign(lead, updates);
    saveState(state);
    return lead;
  }

  function summarizeRep(repId) {
    const state = loadState();
    const leads = state.leads.filter(function (lead) {
      return lead.repId === repId;
    });
    const scans = state.scans.filter(function (scan) {
      return scan.repId === repId && scan.sourceType === 'public';
    });
    const clientDiscountLeads = leads.filter(function (lead) {
      return lead.sourceType === 'public';
    });
    const selfEnteredLeads = leads.filter(function (lead) {
      return lead.sourceType === 'agent';
    });
    const closedSales = leads.filter(function (lead) {
      return Boolean(lead.closedSale);
    });
    const commissionOwed = leads.reduce(function (sum, lead) {
      return sum + (Number(lead.commissionOwed) || 0);
    }, 0);
    return {
      rep: state.reps[repId],
      scans: scans.length,
      completedForms: leads.length,
      clientDiscountLeads: clientDiscountLeads.length,
      selfEnteredLeads: selfEnteredLeads.length,
      closedSales: closedSales.length,
      commissionOwed: commissionOwed,
      leads: leads,
      scansData: scans
    };
  }

  function exportCsv(repId) {
    const summary = summarizeRep(repId);
    const header = [
      'Lead ID',
      'Created At',
      'Rep',
      'Source',
      'Discount Applied',
      'Discount Percent',
      'Client Name',
      'Phone',
      'Business Name',
      'Email',
      'Status',
      'Closed Sale',
      'Commission Owed',
      'Notes'
    ];
    const rows = summary.leads.map(function (lead) {
      return [
        lead.id,
        lead.createdAt,
        lead.repName,
        lead.sourceType,
        lead.discountApplied ? 'Yes' : 'No',
        lead.discountPercent,
        lead.clientName,
        lead.phone,
        lead.businessName,
        lead.email,
        lead.status,
        lead.closedSale ? 'Yes' : 'No',
        Number(lead.commissionOwed || 0).toFixed(2),
        lead.notes || ''
      ];
    });
    const lines = [header].concat(rows).map(function (row) {
      return row.map(csvCell).join(',');
    });
    return lines.join('\n');
  }

  function csvCell(value) {
    const text = String(value == null ? '' : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function downloadCsv(repId, filename) {
    const blob = new Blob([exportCsv(repId)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  window.JAWSReferrals = {
    STORAGE_KEY: STORAGE_KEY,
    loadState: loadState,
    saveState: saveState,
    trackScan: trackScan,
    createLead: createLead,
    updateLead: updateLead,
    summarizeRep: summarizeRep,
    exportCsv: exportCsv,
    downloadCsv: downloadCsv
  };
})();

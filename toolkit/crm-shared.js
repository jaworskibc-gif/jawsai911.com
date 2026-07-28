window.JAWSCRM = (function () {
  const CRM_STATUS_BY_OUTCOME = {
    no_answer: "contacted",
    voicemail: "contacted",
    spoke: "warm",
    scheduled: "booked",
    not_interested: "closed_lost",
    won: "closed_won"
  };

  function normalizePhone(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function defaultFollowUpDate(outcome, baseDate) {
    const base = baseDate || todayStr();
    switch (outcome) {
      case "no_answer":
      case "voicemail":
        return addDays(base, 1);
      case "spoke":
        return addDays(base, 2);
      case "scheduled":
        return base;
      default:
        return null;
    }
  }

  function buildCrmTask(outcome, leadName, notes, dueAt) {
    if (!dueAt) return null;
    if (outcome === "won" || outcome === "not_interested") return null;

    const titleMap = {
      no_answer: "Call back after no answer",
      voicemail: "Send voicemail follow-up text",
      spoke: "Follow up from recent call",
      scheduled: "Confirm scheduled call"
    };
    const taskTypeMap = {
      no_answer: "call",
      voicemail: "text",
      spoke: "call",
      scheduled: "call"
    };

    return {
      title: titleMap[outcome] || ("Follow up with " + leadName),
      due_at: dueAt,
      task_type: taskTypeMap[outcome] || "call",
      notes: notes || ""
    };
  }

  function mergeNotes(existingNotes, newNotes) {
    const oldValue = String(existingNotes || "").trim();
    const appendValue = String(newNotes || "").trim();
    if (!oldValue) return appendValue || null;
    if (!appendValue) return oldValue;
    return oldValue + "\n" + appendValue;
  }

  async function listCrmLeads(supabaseClient, clientId, options) {
    if (!clientId) return [];
    const filters = options || {};
    let query = supabaseClient
      .from("crm_leads")
      .select("*")
      .eq("client_id", String(clientId));

    if (filters.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.openOnly) query = query.in("status", ["new", "contacted", "warm", "booked", "showed", "nurture"]);

    query = query.order("next_follow_up_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function getCrmLeadById(supabaseClient, leadId) {
    if (!leadId) return null;
    const { data, error } = await supabaseClient
      .from("crm_leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function upsertCrmLead(supabaseClient, clientId, lead) {
    const name = String(lead.full_name || lead.name || "").trim();
    const phone = String(lead.phone || "").trim();
    if (!clientId || !name) throw new Error("clientId and lead.full_name are required");

    const phoneDigits = normalizePhone(phone);
    let existing = null;

    if (phoneDigits) {
      const { data, error } = await supabaseClient
        .from("crm_leads")
        .select("*")
        .eq("client_id", String(clientId))
        .eq("phone", phone);
      if (error) throw error;
      existing = (data || [])[0] || null;
    }

    if (!existing) {
      const { data, error } = await supabaseClient
        .from("crm_leads")
        .select("*")
        .eq("client_id", String(clientId))
        .eq("full_name", name);
      if (error) throw error;
      existing = (data || []).find(function (row) {
        return phoneDigits ? normalizePhone(row.phone) === phoneDigits : true;
      }) || null;
    }

    const payload = {
      full_name: name,
      phone: phone || null,
      email: lead.email || null,
      company: lead.company || lead.name || null,
      city: lead.city || null,
      state: lead.state || "FL",
      status: lead.status || "new",
      source: lead.source || null,
      assigned_to: lead.assigned_to || null,
      client_id: String(clientId),
      last_call_at: lead.last_call_at || null,
      last_call_outcome: lead.last_call_outcome || null,
      call_attempts: Number(lead.call_attempts || 0),
      next_follow_up_at: lead.next_follow_up_at || null,
      notes: lead.notes || null,
      tags: Array.isArray(lead.tags) ? lead.tags : [],
      custom_fields: lead.custom_fields || {}
    };

    if (existing) {
      const updatePayload = {
        phone: payload.phone || existing.phone || null,
        email: payload.email || existing.email || null,
        company: payload.company || existing.company || null,
        city: payload.city || existing.city || null,
        state: payload.state || existing.state || "FL",
        status: payload.status || existing.status || "new",
        source: existing.source || payload.source,
        assigned_to: payload.assigned_to || existing.assigned_to || null,
        last_call_at: payload.last_call_at || existing.last_call_at || null,
        last_call_outcome: payload.last_call_outcome || existing.last_call_outcome || null,
        call_attempts: Math.max(Number(existing.call_attempts || 0), Number(payload.call_attempts || 0)),
        next_follow_up_at: payload.next_follow_up_at || existing.next_follow_up_at || null,
        notes: mergeNotes(existing.notes, payload.notes),
        tags: (existing.tags && existing.tags.length) ? existing.tags : payload.tags,
        custom_fields: Object.assign({}, existing.custom_fields || {}, payload.custom_fields || {})
      };
      const { data, error } = await supabaseClient
        .from("crm_leads")
        .update(updatePayload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    }

    const { data: inserted, error: insertError } = await supabaseClient
      .from("crm_leads")
      .insert(payload)
      .select("*")
      .single();
    if (insertError) throw insertError;
    return inserted;
  }

  async function getCrmTasks(supabaseClient, clientId, options) {
    if (!clientId) return [];
    const filters = options || {};
    let query = supabaseClient
      .from("crm_tasks")
      .select("*, crm_leads!inner(full_name, phone, client_id)")
      .eq("crm_leads.client_id", String(clientId));

    if (filters.status) query = query.eq("status", filters.status);
    query = query.order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function countCrmCalls(supabaseClient, clientId) {
    if (!clientId) return 0;
    const leads = await listCrmLeads(supabaseClient, clientId);
    const leadIds = leads.map(function (lead) { return lead.id; }).filter(Boolean);
    if (!leadIds.length) return 0;

    const { count, error } = await supabaseClient
      .from("crm_calls")
      .select("*", { count: "exact", head: true })
      .in("lead_id", leadIds);
    if (error) throw error;
    return count || 0;
  }

  function leadPriorityScore(lead) {
    const statusWeight = {
      new: 0,
      contacted: 1,
      warm: 2,
      booked: 3,
      showed: 4,
      nurture: 5,
      closed_won: 9,
      closed_lost: 9
    };
    const nextFollowUp = lead.next_follow_up_at ? new Date(lead.next_follow_up_at).getTime() : Number.MAX_SAFE_INTEGER;
    const statusRank = statusWeight[lead.status] == null ? 8 : statusWeight[lead.status];
    const lastCall = lead.last_call_at ? new Date(lead.last_call_at).getTime() : 0;
    return { nextFollowUp: nextFollowUp, statusRank: statusRank, lastCall: lastCall };
  }

  function getNextCrmLead(leads, currentLeadId) {
    const openLeads = (leads || []).filter(function (lead) {
      return ["new", "contacted", "warm", "booked", "showed", "nurture"].includes(lead.status);
    });
    if (!openLeads.length) return null;

    const sorted = openLeads.slice().sort(function (a, b) {
      const left = leadPriorityScore(a);
      const right = leadPriorityScore(b);
      if (left.nextFollowUp !== right.nextFollowUp) return left.nextFollowUp - right.nextFollowUp;
      if (left.statusRank !== right.statusRank) return left.statusRank - right.statusRank;
      if (left.lastCall !== right.lastCall) return left.lastCall - right.lastCall;
      return String(a.full_name || a.company || "").localeCompare(String(b.full_name || b.company || ""));
    });

    if (!currentLeadId) return sorted[0];
    return sorted.find(function (lead) { return lead.id !== currentLeadId; }) || sorted[0];
  }

  async function completeCrmTask(supabaseClient, taskId, nextStatus) {
    if (!taskId) throw new Error("taskId is required");
    const payload = { status: nextStatus || "done" };
    const { data, error } = await supabaseClient
      .from("crm_tasks")
      .update(payload)
      .eq("id", taskId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function logCrmCall(supabaseClient, payload) {
    const dueAt = payload.followUpAt || (defaultFollowUpDate(payload.outcome) ? defaultFollowUpDate(payload.outcome) + "T09:00:00.000Z" : null);
    const status = payload.status || CRM_STATUS_BY_OUTCOME[payload.outcome] || "contacted";
    const lead = payload.leadId
      ? await getCrmLeadById(supabaseClient, payload.leadId)
      : await upsertCrmLead(supabaseClient, payload.clientId, {
          full_name: payload.full_name || payload.leadName,
          phone: payload.phone,
          email: payload.email,
          company: payload.company,
          city: payload.city,
          state: payload.state,
          status: status,
          source: payload.source || "sales_console",
          assigned_to: payload.assigned_to,
          notes: payload.notes,
          custom_fields: payload.custom_fields || {}
        });

    if (!lead) throw new Error("Unable to resolve crm lead");

    const nextAttempts = Number(lead.call_attempts || 0) + 1;
    const mergedNotes = mergeNotes(lead.notes, payload.notes);
    const now = new Date().toISOString();

    const [{ data: callRow, error: callError }, { data: updatedLead, error: leadError }] = await Promise.all([
      supabaseClient
        .from("crm_calls")
        .insert({
          lead_id: lead.id,
          outcome: payload.outcome,
          notes: payload.notes || null,
          duration_seconds: payload.duration_seconds || null,
          called_at: payload.called_at || now,
          called_by: payload.called_by || null
        })
        .select("*")
        .single(),
      supabaseClient
        .from("crm_leads")
        .update({
          status: status,
          last_call_at: payload.called_at || now,
          last_call_outcome: payload.outcome,
          call_attempts: nextAttempts,
          next_follow_up_at: dueAt,
          assigned_to: payload.assigned_to || lead.assigned_to || null,
          notes: mergedNotes
        })
        .eq("id", lead.id)
        .select("*")
        .single()
    ]);
    if (callError) throw callError;
    if (leadError) throw leadError;

    let taskRow = null;
    const nextTask = buildCrmTask(payload.outcome, updatedLead.full_name || updatedLead.company || "Lead", payload.notes, dueAt);
    if (nextTask) {
      const { data, error } = await supabaseClient
        .from("crm_tasks")
        .insert({
          lead_id: updatedLead.id,
          title: nextTask.title,
          due_at: nextTask.due_at,
          status: "open",
          task_type: nextTask.task_type
        })
        .select("*")
        .single();
      if (error) throw error;
      taskRow = data;
    }

    return {
      lead: updatedLead,
      call: callRow,
      task: taskRow,
      followUpAt: dueAt
    };
  }

  async function upsertDialQueueLead(supabaseClient, clientId, lead) {
    const phoneDigits = normalizePhone(lead.phone);
    const { data, error } = await supabaseClient
      .from("dial_queue")
      .select("*")
      .eq("client_id", clientId)
      .eq("name", lead.name);
    if (error) throw error;

    const existing = (data || []).find(function (row) {
      return phoneDigits && normalizePhone(row.phone) === phoneDigits;
    }) || (data || [])[0];

    if (existing) {
      return existing;
    }

    const { count } = await supabaseClient
      .from("dial_queue")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);

    const { data: inserted, error: insertError } = await supabaseClient
      .from("dial_queue")
      .insert({
        client_id: clientId,
        name: lead.name,
        phone: lead.phone || "",
        position: count || 0
      })
      .select("*")
      .single();
    if (insertError) throw insertError;
    return inserted;
  }

  return {
    normalizePhone: normalizePhone,
    todayStr: todayStr,
    defaultFollowUpDate: defaultFollowUpDate,
    listCrmLeads: listCrmLeads,
    getCrmLeadById: getCrmLeadById,
    upsertCrmLead: upsertCrmLead,
    getCrmTasks: getCrmTasks,
    countCrmCalls: countCrmCalls,
    getNextCrmLead: getNextCrmLead,
    completeCrmTask: completeCrmTask,
    logCrmCall: logCrmCall,
    upsertDialQueueLead: upsertDialQueueLead
  };
}());

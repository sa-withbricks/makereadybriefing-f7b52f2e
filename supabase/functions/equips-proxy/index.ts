const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EQUIPS_BASE = 'https://api.equips.com';

async function equipsFetch(path: string, apiKey: string, options?: RequestInit) {
  const res = await fetch(`${EQUIPS_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EQUIPS ${path} returned ${res.status}: ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('EQUIPS_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'EQUIPS_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse optional filters from request body
    let searchBody: Record<string, unknown> = {};
    if (req.method === 'POST') {
      try {
        searchBody = await req.json();
      } catch {
        // empty body is fine
      }
    }

    // Fetch all data in parallel
    const [serviceRequests, locations, statuses, workflows, workflowStatuses] = await Promise.all([
      equipsFetch('/public/serviceRequest/search', apiKey, {
        method: 'POST',
        body: JSON.stringify(searchBody),
      }),
      equipsFetch('/public/location', apiKey),
      equipsFetch('/public/serviceStatus', apiKey),
      equipsFetch('/public/serviceWorkflow', apiKey),
      equipsFetch('/public/serviceWorkflowToServiceStatus', apiKey),
    ]);

    // Build lookup maps
    const locationMap: Record<string, string> = {};
    const locationArr = Array.isArray(locations) ? locations : locations?.data || [];
    for (const loc of locationArr) {
      if (loc.locationId && loc.name) {
        locationMap[loc.locationId] = loc.name;
      }
    }

    const statusMap: Record<string, string> = {};
    const statusArr = Array.isArray(statuses) ? statuses : statuses?.data || [];
    for (const s of statusArr) {
      if (s.serviceStatusId && s.name) {
        statusMap[s.serviceStatusId] = s.name;
      }
    }

    const workflowMap: Record<string, string> = {};
    const workflowArr = Array.isArray(workflows) ? workflows : workflows?.data || [];
    for (const w of workflowArr) {
      if (w.serviceWorkflowId && w.name) {
        workflowMap[w.serviceWorkflowId] = w.name;
      }
    }

    // Build workflow-to-status lookup
    const wfStatusMap: Record<string, { statusName: string; workflowName: string }> = {};
    const wfStatusArr = Array.isArray(workflowStatuses) ? workflowStatuses : workflowStatuses?.data || [];
    for (const wfs of wfStatusArr) {
      if (wfs.serviceWorkflowToServiceStatusId) {
        wfStatusMap[wfs.serviceWorkflowToServiceStatusId] = {
          statusName: statusMap[wfs.serviceStatusId] || wfs.serviceStatusId || '',
          workflowName: workflowMap[wfs.serviceWorkflowId] || wfs.serviceWorkflowId || '',
        };
      }
    }

    // Enrich service requests
    const srArr = Array.isArray(serviceRequests) ? serviceRequests : serviceRequests?.data || [];
    const enriched = srArr.map((sr: Record<string, unknown>) => {
      const locationName = sr.locationId ? locationMap[sr.locationId as string] || '' : '';
      
      // Resolve status from workflowToServiceStatus mapping
      let statusName = sr.requestStatus as string || '';
      let workflowName = '';
      if (sr.serviceWorkflowToServiceStatusId) {
        const wfStatus = wfStatusMap[sr.serviceWorkflowToServiceStatusId as string];
        if (wfStatus) {
          statusName = wfStatus.statusName || statusName;
          workflowName = wfStatus.workflowName;
        }
      }

      // Convert epoch dueDate to ISO date string (YYYY-MM-DD)
      let dueDateStr = '';
      if (sr.dueDate && typeof sr.dueDate === 'number') {
        const d = new Date(sr.dueDate);
        dueDateStr = d.toISOString().split('T')[0];
      }

      return {
        ...sr,
        locationName,
        statusName,
        workflowName,
        dueDateFormatted: dueDateStr,
      };
    });

    return new Response(JSON.stringify({ data: enriched }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('equips-proxy error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

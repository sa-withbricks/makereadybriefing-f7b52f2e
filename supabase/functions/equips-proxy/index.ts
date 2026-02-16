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
      'Authorization': `api-key ${apiKey}`,
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

    // Fetch all service requests with pagination (EQUIPS uses `take`/`skip`)
    let allServiceRequests: Record<string, unknown>[] = [];
    let page = 0;
    const pageSize = 500;
    let hasMore = true;

    while (hasMore) {
      const result = await equipsFetch('/public/serviceRequest/search', apiKey, {
        method: 'POST',
        body: JSON.stringify({ ...searchBody, take: pageSize, skip: page * pageSize }),
      });

      const items = Array.isArray(result) ? result : result?.data || [];
      allServiceRequests = allServiceRequests.concat(items);
      
      console.log(`Page ${page}: fetched ${items.length} records (total so far: ${allServiceRequests.length})`);
      
      if (items.length < pageSize || allServiceRequests.length >= 10000) {
        hasMore = false;
      }
      page++;
    }

    console.log(`Total service requests fetched: ${allServiceRequests.length}`);

    // Fetch lookup data (optional - don't fail if these endpoints aren't available)
    const safeGet = async (path: string) => {
      try {
        return await equipsFetch(path, apiKey);
      } catch (err) {
        console.warn(`Optional endpoint ${path} failed:`, err.message);
        // Try POST with search suffix
        try {
          return await equipsFetch(`${path}/search`, apiKey, {
            method: 'POST',
            body: JSON.stringify({}),
          });
        } catch (err2) {
          console.warn(`Optional endpoint ${path}/search also failed:`, err2.message);
          return [];
        }
      }
    };

    const [locations, statuses, workflows, workflowStatuses] = await Promise.all([
      safeGet('/public/location'),
      safeGet('/public/serviceStatus'),
      safeGet('/public/serviceWorkflow'),
      safeGet('/public/serviceWorkflowToServiceStatus'),
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

    // Enrich service requests — only include those with serviceWorkflowToServiceStatusId
    const relevant = allServiceRequests.filter((sr) => sr.serviceWorkflowToServiceStatusId);
    console.log(`Filtered to ${relevant.length} records with serviceWorkflowToServiceStatusId`);
    const enriched = relevant.map((sr: Record<string, unknown>) => {
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

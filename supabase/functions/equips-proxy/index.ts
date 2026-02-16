const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EQUIPS_BASE = 'https://api.equips.com';

// Custom field key mapping: snake_case API keys → camelCase report fields
const CUSTOM_FIELD_MAP: Record<string, string> = {
  cp_walk_date: 'cpWalkDate',
  evs: 'evs',
  key_release: 'keyRelease',
  hhg: 'hhg',
  move_in: 'moveIn',
  ntv: 'ntv',
  vacate: 'vacate',
  kti: 'kti',
};

// requestStatus enum → human-readable display
const STATUS_DISPLAY: Record<string, string> = {
  proposed: 'Proposed',
  internalDispatch: 'Internal Dispatch',
  equipsDispatch: 'Equips Dispatch',
  providerDispatch: 'Provider Dispatch',
  serviceComplete: 'Service Complete',
  closed: 'Closed',
  canceled: 'Canceled',
  invoiced: 'Invoiced',
  followUp: 'Follow Up',
  awaitingPayment: 'Awaiting Payment',
  inProgress: 'In Progress',
  onHold: 'On Hold',
};

function formatEpoch(value: unknown): string {
  if (typeof value === 'number' && value > 1_000_000_000) {
    const d = new Date(value);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (typeof value === 'string' && value.trim()) return value;
  return '';
}

function formatStatus(requestStatus: string): string {
  return STATUS_DISPLAY[requestStatus] || requestStatus.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

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

    // Fetch all service requests with pagination
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

    // Filter to only SRs with serviceWorkflowToServiceStatusId
    const relevant = allServiceRequests.filter((sr) => sr.serviceWorkflowToServiceStatusId);
    console.log(`Filtered to ${relevant.length} records with serviceWorkflowToServiceStatusId`);

    // Collect unique serviceWorkflowToServiceStatusId values and resolve them
    const uniqueStatusIds = [...new Set(relevant.map(sr => sr.serviceWorkflowToServiceStatusId as string))];
    console.log(`Resolving ${uniqueStatusIds.length} unique serviceWorkflowToServiceStatus IDs`);

    // Fetch each serviceWorkflowToServiceStatus to get the embedded serviceStatus.name
    const statusNameMap: Record<string, string> = {};

    // Batch: fetch all SWTS in parallel (limited concurrency)
    const BATCH_SIZE = 10;
    for (let i = 0; i < uniqueStatusIds.length; i += BATCH_SIZE) {
      const batch = uniqueStatusIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (swtsId) => {
          const swts = await equipsFetch(`/public/serviceWorkflowToServiceStatus/${swtsId}`, apiKey);
          const name = swts?.serviceStatus?.name || swts?.name || '';
          return { swtsId, name };
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled') {
          statusNameMap[result.value.swtsId] = result.value.name;
        }
      }
    }
    console.log(`Resolved ${Object.values(statusNameMap).filter(Boolean).length} status names`);

    // Enrich service requests
    const enriched = relevant.map((sr: Record<string, unknown>) => {
      // Resolve status name from serviceStatus via serviceWorkflowToServiceStatusId
      const swtsId = sr.serviceWorkflowToServiceStatusId as string;
      const resolvedStatusName = statusNameMap[swtsId] || '';
      // Fallback to formatted requestStatus if resolution failed
      const statusName = resolvedStatusName || (sr.requestStatus ? formatStatus(sr.requestStatus as string) : 'Unknown');

      // Convert epoch dueDate to ISO date string (YYYY-MM-DD)
      let dueDateStr = '';
      if (sr.dueDate && typeof sr.dueDate === 'number') {
        const d = new Date(sr.dueDate);
        dueDateStr = d.toISOString().split('T')[0];
      }

      // Flatten customFields into top-level camelCase fields with formatted dates
      const flatCustomFields: Record<string, string> = {};
      const customFields = sr.customFields as Record<string, unknown> | undefined;
      if (customFields && typeof customFields === 'object') {
        for (const [apiKey, reportKey] of Object.entries(CUSTOM_FIELD_MAP)) {
          if (apiKey in customFields) {
            flatCustomFields[reportKey] = formatEpoch(customFields[apiKey]);
          }
        }
      }

      return {
        ...sr,
        statusName,
        dueDateFormatted: dueDateStr,
        ...flatCustomFields,
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

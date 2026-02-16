
## Replace Metabase with Direct EQUIPS API via Secure Edge Function

### What We're Doing
Replacing the current unreliable Metabase/CORS-proxy approach with direct calls to the EQUIPS API (api.equips.com), routed securely through a backend function so your API key stays protected.

### Architecture

The browser will call a single backend function, which will make server-side calls to these EQUIPS API endpoints:
- `/public/serviceRequest/search` -- main service request data
- `/public/location` -- location details
- `/public/serviceStatus` -- status definitions
- `/public/serviceWorkflow` -- workflow definitions  
- `/public/serviceWorkflowToServiceStatus` -- workflow-to-status mappings

The backend function will combine/enrich the data and return it to the browser in the format the report expects.

### Steps

**Step 1: Store your EQUIPS API key securely**
- Use the Lovable secrets tool to request your `EQUIPS_API_KEY`
- This key will only be accessible server-side, never exposed to the browser

**Step 2: Create the backend function** (`supabase/functions/equips-proxy/index.ts`)
- Accept parameters from the frontend (e.g., search filters, date ranges)
- Read `EQUIPS_API_KEY` from environment variables
- Call the 5 EQUIPS API endpoints at `https://api.equips.com`
- Combine service requests with location names, status names, and workflow info
- Return enriched data to the frontend
- Include proper CORS headers

**Step 3: Update `supabase/config.toml`**
- Add the function configuration with `verify_jwt = false` (no auth on the app currently)

**Step 4: Simplify `src/App.tsx`**
- Remove all 5 CORS proxy strategies
- Remove the retry/proxy-cycling logic
- Replace with a single fetch call to the backend function
- Keep the caching fallback for offline/error scenarios

**Step 5: Update `src/components/ReportGenerator.tsx`**
- Adjust field mapping to match EQUIPS API response fields (e.g., `dueDate`, `title`, `requestStatus`, `locationId`) instead of Metabase column names
- The enriched data from the backend function will include resolved location names and status labels

### Technical Details

The edge function will:
1. Fetch service requests via POST to `/public/serviceRequest/search` with appropriate filters
2. Fetch locations, statuses, workflows, and workflow-to-status mappings in parallel
3. Build lookup maps (locationId to name, status IDs to labels, etc.)
4. Enrich each service request with resolved names
5. Return the combined dataset

The EQUIPS API uses API Key authentication (via `x-api-key` header based on the swagger security scheme).

### What Changes
| File | Change |
|------|--------|
| `supabase/functions/equips-proxy/index.ts` | New -- backend function calling EQUIPS API |
| `supabase/config.toml` | Add function config |
| `src/App.tsx` | Simplify to call the backend function instead of CORS proxies |
| `src/components/ReportGenerator.tsx` | Update field mappings for EQUIPS API response format |

### What Stays the Same
- The visual report layout, timeline slicer, print functionality
- Local caching as a fallback
- Loading messages and error handling UI

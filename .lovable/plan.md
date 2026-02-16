

## Read Custom Fields and Status from EQUIPS API

### What's Happening Now
- The EQUIPS API returns `customFields` as a nested object on each service request (e.g., `{"cp_walk_date": 1740268800000, "evs": 1740614400000, "move_in": ...}`). These contain the make-ready milestone dates.
- The report currently ignores this nested object because it looks for top-level keys like `cpWalkDate`, `evs`, etc.
- The status lookup endpoints (`/public/serviceStatus`, `/public/serviceWorkflowToServiceStatus`, etc.) all return 404, so they're not available. However, each SR already has a `requestStatus` field with readable enum values like `internalDispatch`, `proposed`, `serviceComplete`, `closed`, etc.

### What Changes

**1. Edge Function (`supabase/functions/equips-proxy/index.ts`)**
- Flatten `customFields` into the top level of each enriched SR, converting epoch timestamps to formatted date strings (e.g., `cp_walk_date: 1740268800000` becomes `cpWalkDate: "2025-02-23"`)
- Use `requestStatus` directly for the status (formatted to human-readable: `internalDispatch` becomes `"Internal Dispatch"`)
- Remove the 4 failing lookup endpoint calls (`/public/location`, `/public/serviceStatus`, `/public/serviceWorkflow`, `/public/serviceWorkflowToServiceStatus`) to speed up the response

**2. Report Component (`src/components/ReportGenerator.tsx`)**
- Update `normalizeEntry` to read custom field values from the flattened fields: `cpWalkDate`, `evs`, `keyRelease`, `hhg`, `moveIn`, `ntv`, `vacate`, `kti`
- Use the human-readable `statusName` from the edge function instead of falling back through multiple field names
- Remove legacy Metabase column mapping code that's no longer needed

### Technical Details

Custom field key mapping (from API to report fields):

| API customFields key | Report field | Display label |
|---|---|---|
| `cp_walk_date` | `cpWalkDate` | CP Walk Date |
| `evs` | `evs` | EVS |
| `key_release` | `keyRelease` | Key Release |
| `hhg` | `hhg` | HHG |
| `move_in` | `moveIn` | Move In |
| `ntv` | `ntv` | NTV |
| `vacate` | `vacate` | Vacate |
| `kti` | `kti` | KTI |

Status formatting (camelCase enum to readable):

| API `requestStatus` | Display |
|---|---|
| `proposed` | Proposed |
| `internalDispatch` | Internal Dispatch |
| `equipsDispatch` | Equips Dispatch |
| `providerDispatch` | Provider Dispatch |
| `serviceComplete` | Service Complete |
| `closed` | Closed |
| `canceled` | Canceled |
| `invoiced` | Invoiced |
| `followUp` | Follow Up |
| `awaitingPayment` | Awaiting Payment |
| `inProgress` | In Progress |
| `onHold` | On Hold |

All custom field epoch values will be converted to formatted dates (e.g., "Feb 23, 2025") in the edge function so the frontend just displays them directly.

### What Stays the Same
- Timeline slicer, print functionality, date grouping
- Card layout and visual design
- Caching fallback in App.tsx
- Pagination logic for fetching all SRs


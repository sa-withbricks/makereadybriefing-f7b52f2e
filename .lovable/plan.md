
# Merge Make Ready Briefing into Capital View

## Overview
Bring the Make Ready Briefing tool into the Capital View project as a new page/route, reusing Capital View's existing layout, authentication, and navigation.

## What needs to move

### 1. Edge Function: `equips-proxy`
- Copy `supabase/functions/equips-proxy/index.ts` into the Capital View project
- Add the `[functions.equips-proxy]` config with `verify_jwt = false` to Capital View's `supabase/config.toml`
- The `EQUIPS_API_KEY` secret will need to be configured in the Capital View project's backend as well

### 2. Components
- Copy `src/components/ReportGenerator.tsx` into Capital View as `src/components/MakeReadyReport.tsx` (or keep the same name)
- Copy `src/components/figma/ImageWithFallback.tsx` if used

### 3. New Page
- Create `src/pages/MakeReady.tsx` in Capital View containing the data-fetching logic currently in this project's `App.tsx` (the `fetchData` function, loading states, caching, error handling)
- This page will use the existing `AppLayout` wrapper so it gets the same header/nav as the rest of Capital View

### 4. Routing and Navigation
- Add a `/make-ready` route in Capital View's `App.tsx` inside the protected routes
- Add a "Make Ready" link to the `AppHeader` or navigation component

## Technical details

### Files to create/edit in Capital View

| Action | File | Description |
|--------|------|-------------|
| Create | `supabase/functions/equips-proxy/index.ts` | Full copy of the edge function |
| Edit | `supabase/config.toml` | Add `[functions.equips-proxy]` section |
| Create | `src/pages/MakeReady.tsx` | Page wrapper with fetch logic, loading, caching |
| Create | `src/components/MakeReadyReport.tsx` | Copy of `ReportGenerator.tsx` |
| Edit | `src/App.tsx` | Add `/make-ready` route |
| Edit | `src/components/AppHeader.tsx` (or nav) | Add navigation link |

### Secret configuration
The `EQUIPS_API_KEY` secret is already set in this project's backend. It will need to be added to Capital View's backend separately since secrets don't transfer between projects.

### No database changes needed
This tool doesn't use any database tables -- it's purely an edge function proxy to the EQUIPS API with a React frontend.

## Implementation approach
Since this work needs to happen in the **Capital View** project (not this one), you have two options:

1. **Switch to Capital View** and ask me to implement it there -- I can read the files from this project using cross-project tools and build everything directly
2. **Remix this project** and manually merge -- more manual effort

I recommend option 1: open Capital View and ask me to "bring in the Make Ready Briefing from the makereadybriefing project."

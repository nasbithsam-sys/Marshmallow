# Map View Feature Plan

A new "Map View" section for Admin and Processor users to visualize urgent leads and technicians on an interactive map with 50-mile radius matching.

## 1. Database

New migration adds a `technicians` table:

- `id`, `name` (required), `area` (required), `service`, `notes`
- `latitude`, `longitude` (nullable — geocoded from area)
- `created_by`, `created_at`, `updated_at`

Grants + RLS:
- SELECT/INSERT/UPDATE/DELETE limited to `admin` and `processor` roles via `has_role`
- `service_role` full access

Also add `latitude`, `longitude` nullable columns to `leads` (only used for map caching — existing lead workflow untouched). If already present via prior work, skipped.

Add `map_view` to `ALL_NAV_ITEMS` (constants.ts) and to default nav access for `admin` and `processor` in `src/lib/access.ts`.

## 2. Sidebar entry

`src/components/layout/AppSidebar.tsx`: insert new item "Map View" with `Map` icon from lucide, `navKey: "map_view"`, placed right after "Area Insights". Visibility follows the existing `canAccess("map_view")` pattern — defaults set so only admin/processor see it.

## 3. Route

`src/App.tsx`: lazy-load `MapViewPage` at `/map-view` inside a `PageRoute navItem="map_view"`.

## 4. Map page — `src/pages/MapViewPage.tsx`

Uses existing Leaflet setup (project already uses plain `L.map` per memory — same approach as `AreasPage`). No new map library.

Layout:
- Header: title, filter chips (Show: Urgent / Technicians / Both), technician search, service filter, "+ Add Technician", "Import Technicians"
- Full-width Leaflet map (`h-[calc(100vh-...)]`) with legend overlay (Red = Urgent Lead, Blue = Technician)
- Side panel (desktop) / bottom sheet (mobile) showing selected technician details + urgent leads in range sorted by distance

Data:
- Urgent leads: `useQuery` selecting from `leads` where `status = 'urgent_job'`, with existing coords or address string
- Technicians: `useQuery` from new `technicians` table
- Geocoding: reuse the existing localStorage geocoding cache pattern from `AreasPage`; only geocode addresses missing coordinates; persist resolved lead coords back to `leads.latitude/longitude` (best-effort, does not modify other lead fields)

Markers:
- Red divIcon for urgent leads, blue divIcon for technicians
- Popups with the exact fields spec'd (Customer/Phone/Address/Service/Status/Job ID + View Lead button navigating to `/leads/:id`; Technician: Name/Area/Service/Notes/coverage/in-range count/Edit/Delete)
- 50-mile radius circle rendered only for the currently selected technician using `L.circle` with `radius = 80467` (meters)

Distance: haversine helper in `src/lib/geo.ts` returning miles.

## 5. Add / Edit / Delete Technician

`src/components/technicians/TechnicianDialog.tsx`:
- Fields: Name, Area, Service, Notes
- On save: insert/update row, then geocode Area (Nominatim, same pattern as areas cache) and persist lat/lng
- React Query invalidation for `["technicians"]`
- Delete flow uses shadcn `AlertDialog` for confirmation

## 6. CSV / XLSX Import

`src/components/technicians/ImportTechniciansDialog.tsx`:
- File picker accepting `.csv,.xlsx`
- Parse using `papaparse` for CSV and `xlsx` for Excel (both already in the project — verify; add via bun if missing)
- Validate columns Name, Area, Service, Notes; required Name + Area
- Preview table with valid/invalid counts
- Confirm → bulk insert (chunks of 100), skip rows whose normalized (name+area) match an existing technician
- Toast summary: "N imported, M skipped"

## 7. Matching / Filters

- When a technician marker is clicked: compute distance to every urgent lead, filter ≤50 miles, sort ascending, show in side panel with `service_type` vs technician `service` match badge
- Filter chip "Show only urgent leads within 50 miles" available when a technician is selected
- Global filters: entity toggle (Urgent / Techs / Both), technician service dropdown, technician text search

## 8. Performance & UX

- Marker rendering: reuse a single `L.layerGroup` per entity type; diff on data change instead of full re-init
- Coord cache in localStorage keyed by normalized address (existing pattern) so repeated loads never re-geocode
- Unmapped counts surfaced under the legend: "N urgent leads could not be mapped"
- Responsive: filter row wraps; side panel becomes bottom Sheet on `useIsMobile`

## 9. Scope guard

No changes to: Leads page, dashboard, Analytics, Area Insights, auth flow, existing roles beyond adding `map_view` access, lead assignment logic, existing reports.

## Technical notes

- Files added: `src/pages/MapViewPage.tsx`, `src/components/technicians/TechnicianDialog.tsx`, `src/components/technicians/ImportTechniciansDialog.tsx`, `src/components/technicians/TechnicianSidePanel.tsx`, `src/lib/geo.ts`, `src/lib/geocode.ts` (extracted cache helpers if not already shared)
- Files edited: `src/App.tsx`, `src/components/layout/AppSidebar.tsx`, `src/lib/constants.ts` (ALL_NAV_ITEMS), `src/lib/access.ts` (default nav access for admin+processor)
- Migration: `technicians` table + grants + RLS + `updated_at` trigger; nullable `latitude`/`longitude` on `leads` if not present
- Deps: verify `papaparse`, `xlsx`, `leaflet` present; install if missing

Ready to implement on approval.
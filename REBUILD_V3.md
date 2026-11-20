# School Sports Tracker V3 — clean rebuild

## Decision
Replace the existing Nuxt 4 application implementation rather than patching V2/V3 components. Keep the existing Supabase project, database, data, authentication, storage, policies and credentials intact.

## Safety and release
- Work on `v3-clean-rebuild` until a feature-complete replacement is verified.
- Do not delete or alter Supabase schema, data, RLS policies, functions, storage, or authentication.
- Do not merge a partially functional rebuild to production.
- Inventory existing pages, server routes, permission checks, database queries and scoring rules before replacing their implementations.
- Preserve existing production functionality until the replacement passes verification.
- Use a Pull Request for the rebuild and merge only after review.

## Application architecture
- A new Nuxt 4 application, with clean shared layouts for workspace, public/authentication and student experiences.
- A single responsive workspace shell owns sidebar, topbar, page width, spacing and mobile behaviour.
- Central design tokens govern colours, surfaces, borders, typography and theme.
- Light mode defaults to white page/sidebar/header with light-grey cards; dark mode uses navy surfaces. Sun/moon icon only; persist preference in local storage.
- Feature modules own data access, workflows and their content; individual pages do not define the site shell.
- Reusable tables, forms, dialogs, status badges, page headers and panels.
- Explicit permission-aware navigation and school context; no duplicated sidebar systems.

## Feature parity inventory
- Sign in, account activation, invitations, public and student registration
- Platform administration, schools, school requests, student requests, staff and roles
- School dashboards, students, houses, year rollover and staff
- School and interschool competitions, events, entries, athletics and swimming
- Race-day operation, mobile result entry, scoring, house points, results
- Existing admin email, notification and integration server endpoints
- Reports, records and further competition-management improvements after core parity

## Implementation sequence
1. Document database contract and existing feature behaviour without modifying Supabase.
2. Replace application shell, routing and design system.
3. Implement authentication, school context and authorization.
4. Rebuild administration and school management.
5. Rebuild competitions, registrations, race-day and results.
6. Verify end-to-end functionality, permissions, accessibility and responsive themes.
7. Merge through reviewed PR; switch production only when ready.

## Acceptance criteria
- Every route has an intentional shared layout; no V2 CSS overrides.
- Theme and responsive layout are consistent on every page.
- Existing Supabase data and policies remain unchanged.
- All existing critical workflows are tested against the preserved database contract.
- Production deployment remains on the existing application until replacement is approved.

# Development Roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| 0. Inspect and plan ✅ | Prototype audit, schema/API/security/deployment plan | Plan agreed |
| 1. Foundation ✅ | Repo, frontend and backend scaffolds, config, lint/format, docs | Both apps build, lint, typecheck; backend tests pass; both run locally |
| 2. Database | Supabase project, migrations, RLS, triggers, seed (foods, default plan, snacks, habits) | Migrations apply cleanly; RLS verified with two test users |
| 3. Backend | Auth middleware, then one module at a time: profile/targets → foods → food entries + nutrition → recipes → meal plans → check-ins/progress → habits → workouts → grocery | Each module has unit tests for services and integration tests for routes, including cross-user denial |
| 4. Frontend | Auth screens, app shell (sidebar + mobile tabs), Today, Calculator, Meal planner, Progress, Workouts, Grocery, Profile & Rules | Feature parity with the prototype (minus the demo-data button) |
| 5. Integration | Loading/error/empty states, optimistic updates confirmed by the server, cross-device checks | All journeys in the master prompt §14 pass |
| 6. Deployment | GitHub, Render (backend), Cloudflare (frontend), production env vars, Supabase Auth URLs | Live app passes a smoke test on laptop and phone |

## Prototype → app feature map

| Prototype feature | Target module |
|---|---|
| Rings, remaining kcal/protein, planned totals | Dashboard + `GET /nutrition/daily` |
| Day selector, veg banner and toggle | Dashboard + meal plan days |
| Meal check-off | Creates `food_entries` from the plan meal (snapshot) |
| Inline meal editor, quick-add from food database, copy to day/all days, clear meal | Meal planner |
| Sweet/salty snack picker and editor | Recipes (snack categories) + food entries |
| Quick-add ad-hoc food | Food entries (manual) |
| Steps ± 500, creatine and workout toggles | Check-ins (steps) + habits |
| Reset day checkmarks | Deletes that date's plan-sourced entries and habit logs (with confirmation) |
| Food lookup, meal builder, save to slot/snack | Calculator + recipes |
| BMR/TDEE, goal presets, protein g/kg, apply targets | Calculator + targets |
| Check-in form, 7-day average chart, weekly rate, history | Progress |
| PPL workout logger and history | Workouts (now per-set) |
| Grocery list, progress bar, uncheck all | Grocery (+ real generation from the plan) |
| Profile, rules, supplements, review protocol | Profile & Rules |
| Export/import/reset plan JSON | Meal planner |
| ~~Load sample 10-day trend~~ | **Removed** (fake data; owner approved) |

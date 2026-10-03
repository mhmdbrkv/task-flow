# TaskFlow

A role-aware project task workspace built with React, TypeScript, and Vite.
Project membership roles are read per project from the API; the frontend
capability map only shapes the user experience. The API remains authoritative
for every action.

The interface is in Egyptian Arabic (RTL), with a public landing page before
sign-in and registration.

## Run locally

1. Start the NestJS API on `http://localhost:3000`.
   In the backend `.env`, set `FRONTEND_URL=http://localhost:5173`.
2. Install frontend dependencies with `npm install`.
3. Start the app with `npm run dev`.
4. Open the URL printed by Vite.

The Vite development server proxies `/api` to `http://localhost:3000`, keeping
the refresh-token cookie same-origin in local development. If the backend runs
elsewhere, set `VITE_API_PROXY_TARGET` in the frontend `.env.local` (for example,
`http://localhost:3001`). `VITE_API_BASE_URL` can instead point directly at an
API URL (for example, `https://api.example.com/api`); in that case, set the
backend `FRONTEND_URL` to the exact frontend origin. The backend enables
credentialed CORS only for that configured origin.

The frontend follows the routes currently implemented by the NestJS
controllers. In particular, project task lists and task creation are nested
under `/projects/:projectId/tasks`, while task updates, assignment, status,
priority, and comments use `/tasks/:taskId`. Member promotion and demotion use
`/projects/:projectId/members/:memberId/promote` and `/demote`; owner-only
member removal uses `/projects/:projectId/members/:memberId`, and leaving uses
`/projects/:projectId/leave`. The backend
Swagger document and controller routes are the API contract if an older API
overview describes different paths.

## Included

- Sign-in and account registration against the NestJS `/auth` endpoints.
- Project creation and per-project role badges.
- Role-aware task creation, assignment, task editing, priority, and status
  controls.
- Assignment-specific status actions for members.
- Project members grouped by owner, managers, and members, with owner-only
  manager promotion/demotion, member removal, and ownership transfer.
- Members and managers can leave projects; departing members’ tasks are
  unassigned and returned to To do.
- Owner-only invitations, project settings, and project deletion.
- Workspace invitation inbox with accept/decline actions.
- Account session review, individual session revocation, and sign-out-everywhere.
- Task deletion exposed to owners and managers, enforced again by the API.
- Task comments with own-comment editing/deletion and manager/owner deletion
  controls.
- Refresh-token retry, explicit 401 sign-out, and visible permission/API errors.
- Project names and descriptions are trimmed and validated against the backend
  DTO constraints; clearing an optional project description sends `null`.

Invitations use the API's current contract, which requires the UUID of an
already-registered user; the form explains this rather than suggesting that an
email address alone is sufficient.

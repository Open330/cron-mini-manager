<p align="center">
  <img src="public/favicon.svg" width="112" alt="Cron Mini Manager logo" />
</p>

<h1 align="center">Cron Mini Manager</h1>

<p align="center">
  <strong>Manage your Mac mini cron jobs from a clean local web dashboard.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1.6-000000?logo=next.js&logoColor=white" alt="Next.js 16.1.6" />
  <img src="https://img.shields.io/badge/React-19.2.4-61DAFB?logo=react&logoColor=111827" alt="React 19.2.4" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A524-5FA04E?logo=node.js&logoColor=white" alt="Node.js 24+" />
  <img src="https://img.shields.io/badge/platform-macOS-cron-lightgrey" alt="macOS cron" />
</p>

<p align="center">
  Cron Mini Manager reads your local crontab, keeps unmanaged lines intact, and only mutates jobs inside a dedicated managed block.
</p>

---

## Features

**Managed + External View** - Lists managed jobs and existing external entries together, with external lines clearly marked read-only.

**Create / Update / Delete** - Full CRUD for managed cron jobs with form validation for schedule, name, and command.

**Enable / Disable Toggle** - Flip jobs on or off without deleting them.

**Safe Crontab Merge** - Preserves lines outside the managed block while rewriting only app-owned entries.

**Theme Toggle** - Built-in light/dark mode with saved preference in local storage.

## How It Works

The app owns a dedicated section in your user crontab:

```txt
# BEGIN CRON_MINI_MANAGER
# JOB {"id":"...","name":"...","enabled":true,...}
0 0 * * * /path/to/command
# END CRON_MINI_MANAGER
```

Only this section is parsed and rewritten. Everything before/after the markers remains untouched.

## API Endpoints

| Method | Route           | Purpose |
| ------ | --------------- | ------- |
| `GET`  | `/api/jobs`     | List all managed + external jobs |
| `POST` | `/api/jobs`     | Create a managed job |
| `PUT`  | `/api/jobs/:id` | Replace a managed job |
| `PATCH`  | `/api/jobs/:id` | Toggle enabled status |
| `DELETE` | `/api/jobs/:id` | Remove a managed job |

## Architecture

```txt
cron-mini-manager/
├── src/app/
│   ├── layout.tsx                 # Root metadata + theme bootstrap
│   ├── page.tsx                   # Dashboard UI (form + jobs list)
│   ├── favicon.ico                # App favicon (custom)
│   └── api/jobs/
│       ├── route.ts               # List/create handlers
│       └── [id]/route.ts          # update/toggle/delete handlers
└── src/lib/cron-jobs.ts           # Crontab parsing + persistence logic
```

## Quick Start

```bash
git clone <your-repo-url>
cd cron-mini-manager
npm install
npm run dev
```

Open http://localhost:3000.

## Validation

```bash
npm run lint
npm run build
```

## Security Notes

- Cron commands run with your local user privileges.
- This project has no authentication layer by default.
- Keep it on a trusted local/private network unless you add auth.

---

<p align="center">
  <sub>Built with Next.js, React, and TypeScript for local macOS cron management.</sub>
</p>

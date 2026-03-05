# Cron Mini Manager

Web-based cron manager for this Mac mini, built with Next.js 16 and React 19.

## Stack

- Next.js 16 (`next@16.1.6`)
- React 19 (`react@19.2.4`)
- Node.js 24+
- TypeScript + App Router

## Features

- View all cron jobs managed by this app
- Create cron jobs with name/schedule/command
- Edit existing jobs
- Enable/disable jobs without deleting
- Delete jobs
- Keeps non-managed crontab lines untouched

## How it works

This app manages a dedicated block in your user crontab:

```txt
# BEGIN CRON_MINI_MANAGER
# JOB {"id":"...","name":"...","enabled":true,...}
0 0 * * * /path/to/command
# END CRON_MINI_MANAGER
```

Only lines inside that block are read/written by the app.

## Prerequisites

- Node.js 24+
- macOS with `crontab` available

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Validation

```bash
npm run lint
npm run build
```

## Security notes

- Commands run by cron execute with your local user privileges.
- Keep this app local/private unless you add authentication and access controls.

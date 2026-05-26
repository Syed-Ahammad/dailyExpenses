# Deployment Guide

How to deploy Multi-Currency to production. The app deploys to Vercel and uses
MongoDB Atlas for the database.

## Overview

```
GitHub repo  ──push──>  Vercel  ──connects to──>  MongoDB Atlas
                          │
                          └── calls Anthropic API at runtime
```

Vercel builds and hosts the Next.js app. Atlas hosts the database.
A push to the main branch triggers a production deploy.

## Prerequisites

- A GitHub repository containing the project.
- A Vercel account.
- A MongoDB Atlas account.
- An Anthropic API key.
- A Sentry account (recommended).

## Step 1: Set up MongoDB Atlas

1. Create a free cluster in MongoDB Atlas.
2. Create a database user with a username and password.
3. Under Network Access, allow connections from anywhere (or from
   Vercel's IP ranges).
4. Copy the connection string. It looks like
   `mongodb+srv://user:password@cluster.mongodb.net/Multi-Currency`.

## Step 2: Connect the repository to Vercel

1. In Vercel, create a new project and import the GitHub repository.
2. Vercel detects Next.js automatically; no build configuration is
   needed.

## Step 3: Configure environment variables

In the Vercel project settings, add these variables for the
Production environment:

| Variable            | Value                                     |
|---------------------|-------------------------------------------|
| `MONGODB_URI`       | The Atlas connection string               |
| `ANTHROPIC_API_KEY` | The Anthropic API key                     |
| `NEXTAUTH_SECRET`   | A long random string (phase 2)            |
| `NEXTAUTH_URL`      | The production URL (phase 2)              |
| `SENTRY_DSN`        | The Sentry project DSN                    |

Never commit these values. They live only in Vercel and in local
`.env.local`.

## Step 4: Deploy

1. Push to the main branch.
2. Vercel builds and deploys automatically.
3. Visit the deployment URL and confirm the dashboard loads.

## Environments

- Production: the main branch, the live site.
- Preview: every other branch and pull request gets its own preview
  URL automatically.
- Local: `npm run dev` with values from `.env.local`.

Use a separate Atlas database for preview/staging so test data never
mixes with production data.

## Custom domain

1. In Vercel project settings, add the domain.
2. Update the domain's DNS records as Vercel instructs.
3. Vercel provisions an HTTPS certificate automatically.

## Post-deployment checklist

- The dashboard loads and shows totals.
- Creating a transaction works and updates totals.
- API routes return data, not errors.
- Environment variables are set for Production.
- Error tracking receives events.
- A database backup schedule is configured in Atlas.

## Rollback

If a deploy breaks production, use Vercel's deployments list to
promote the previous working deployment back to production.

## Monitoring

- Vercel provides build logs and runtime function logs.
- Atlas provides database metrics and alerts.
- Sentry reports application errors.

Review these after each significant release.

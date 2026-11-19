# aaskAI News

Static news site for GitHub Pages. There is no build step for the site itself; a scheduled GitHub Actions workflow fetches the latest headlines and republishes the data files.

## How news stays fresh

1. `.github/workflows/refresh.yml` runs every 5 minutes (and on every push, and on demand).
2. It runs `scripts/build-data.mjs`, which pulls public RSS feeds and writes `public/data/*.json`, newest first. If a source is down, the previous published file is kept.
3. The result is deployed to GitHub Pages. Data files are not committed, so the repo history stays clean.
4. The page loads cached data from the browser instantly, fetches every category in parallel, and re-checks for new data every 3 minutes. New stories appear at the top (or via a "New stories available" button if you have scrolled down).

GitHub's own `schedule` trigger is best-effort and heavily throttled: in practice a `*/5` cron may run only once every few hours. For a dependable 5-minute refresh, trigger the workflow from an external cron service instead (see below). The built-in schedule stays as a fallback. GitHub also pauses scheduled workflows after 60 days without repo activity.

## Reliable 5-minute refresh (external trigger)

1. Create a fine-grained personal access token at github.com/settings/personal-access-tokens: repository access **only** `aaskAI_News`, permission **Actions: Read and write**.
2. At cron-job.org (free) create a job that runs every 5 minutes:
   - URL: `https://api.github.com/repos/Kanakgupta/aaskAI_News/actions/workflows/refresh.yml/dispatches`
   - Method: `POST`
   - Headers: `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `Content-Type: application/json`
   - Body: `{"ref":"main"}`
3. A successful call returns HTTP 204 and a new run appears in the Actions tab within seconds.

Keep the token only in the cron service; never commit it.

## One-time setup

In the repo: **Settings > Pages > Build and deployment > Source: GitHub Actions**. Then run **Actions > refresh-news-and-deploy > Run workflow**.

## Local preview

Requires Node.js 18+.

```
npm run data    # fetch feeds into public/data
npm run serve   # http://localhost:8788
```

## Customize

- Feeds and categories: `src/config.js`
- Technology (wireless) queries and filters: `src/tech.js`
- Refresh interval: the `cron line in `.github/workflows/refresh.yml`

Headlines link to the original publishers. Check each publisher's feed terms before commercial use; Google News RSS is licensed for personal use.

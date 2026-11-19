# aaskAI News

Static news site for GitHub Pages. There is no build step for the site itself; a scheduled GitHub Actions workflow fetches the latest headlines and republishes the data files.

## How news stays fresh

1. `.github/workflows/refresh.yml` has two jobs. `deploy` runs `scripts/build-data.mjs`, which pulls the public RSS feeds and writes `public/data/*.json` (newest first, previous file kept if a source is down), then publishes to GitHub Pages. Data files are not committed.
2. `next` waits 4 minutes and then starts the workflow again with the built-in `GITHUB_TOKEN`, so the cycle repeats about every 5 minutes without any external service or personal token.
3. GitHub's own cron is throttled, so a 15-minute `schedule` trigger only acts as a safety net that restarts the chain if it ever breaks. Only one chain can exist at a time.
4. The page paints cached data instantly, then re-checks for new data every 2 minutes. New stories appear at the top (or behind a "New stories available" button if you have scrolled down).

This keeps one runner busy around the clock. It is free for public repositories, but if GitHub ever limits it, host the same site on Cloudflare (a Worker with a cron trigger) for a native scheduler.
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

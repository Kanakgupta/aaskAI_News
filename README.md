# aaskAI News

Static news site for GitHub Pages. There is no build step for the site itself; a scheduled GitHub Actions workflow fetches the latest headlines and republishes the data files.

## How news stays fresh

1. `.github/workflows/refresh.yml` runs every 10 minutes (and on every push, and on demand).
2. It runs `scripts/build-data.mjs`, which pulls public RSS feeds and writes `public/data/*.json`, newest first. If a source is down, the previous published file is kept.
3. The result is deployed to GitHub Pages. Data files are not committed, so the repo history stays clean.
4. The page loads cached data from the browser instantly, fetches every category in parallel, and re-checks for new data every 3 minutes. New stories appear at the top (or via a "New stories available" button if you have scrolled down).

GitHub schedules are best-effort; runs may be delayed by several minutes. GitHub also pauses scheduled workflows after 60 days without repo activity — re-enable them under the Actions tab if that happens.

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
- Refresh interval: the `cron` line in `.github/workflows/refresh.yml`

Headlines link to the original publishers. Check each publisher's feed terms before commercial use; Google News RSS is licensed for personal use.

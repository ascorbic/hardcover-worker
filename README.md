# Hardcover Rated Books Worker

Cloudflare Worker that fetches your rated books from Hardcover and displays them as markdown grouped by year.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ascorbic/hardcover-worker)

## Deploy

Click the button above to deploy to your Cloudflare account. You'll need to set the `HARDCOVER_TOKEN` secret after deployment:

```bash
wrangler secret put HARDCOVER_TOKEN
```

Get your Hardcover API token from your [Hardcover account settings](https://hardcover.app/settings).

## Local Development

1. Install dependencies:
```bash
pnpm install
```

2. Create `.dev.vars` with your Hardcover API token:
```
HARDCOVER_TOKEN=your_token_here
```

3. Run locally:
```bash
pnpm dev
```

## Usage

Visit your worker URL. Results are cached for 1 hour.

Add `?purge` to refresh the cache:
```
https://your-worker.workers.dev?purge
```

## Output

Books grouped by year (from `last_read_date`), sorted newest first:

```markdown
# My Rated Books

210 rated book(s)

## 2025

- **Blue Skies** by T.C. Boyle ⭐⭐⭐⭐⭐ (5/5) - Read: 2025-12-07
- **Beyond the Reach of Earth** by Ken MacLeod ⭐⭐⭐⭐ (4/5) - Read: 2025-11-30

## 2024

- **Alien Clay** by Adrian Tchaikovsky ⭐⭐⭐⭐⭐ (5/5) - Read: 2024-12-28

## Undated

- **The Martian** by Andy Weir ⭐⭐⭐⭐ (4/5)
```

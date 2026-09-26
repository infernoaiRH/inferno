# Deploying Inferno

Inferno deploys two ways:

- **Vercel (recommended, and how it runs in production).** Vercel runs many short-lived instances with no disk, so the relay keeps its state in Redis (Upstash) and the credits ledger lives in Postgres (Neon). See "Vercel" below.
- **One Docker server** (Railway, Fly, Render or your own box). The relay can stay in that server's memory and the ledger can be PGlite (Postgres in WebAssembly) on a persistent `/data` disk, so it needs no outside services. Production is then exactly one long-running instance. Set `REDIS_URL` and `DATABASE_URL` too and it can run more than one.

The `Dockerfile` in the repo root builds that server (`output: "standalone"`, which is switched off on Vercel). The image starts as root only to hand `/data` to the unprivileged `node` user, because hosts mount volumes owned by root; the app itself runs as `node`.

## Settings every host needs

**Build time.** `NEXT_PUBLIC_*` values are compiled into the JavaScript during `next build`. Pass them as Docker build args, and redeploy (rebuild) after changing one.

| Build arg | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your public URL, such as `https://inferno.example` |
| `NEXT_PUBLIC_RPC_URL` | A provider RPC URL for Robinhood Chain (see the checklist) |
| `NEXT_PUBLIC_CHAIN` | Leave unset for mainnet (4663) |

Leave a variable unset rather than empty: an empty `NEXT_PUBLIC_RPC_URL` replaces the default RPC with nothing.

**Run time.**

| Variable | Value |
|---|---|
| `TRUST_PROXY` | `1` (automatic on Vercel). Every host below puts a proxy in front of the app; this lets the relay read each visitor's IP from `X-Forwarded-For` for its per-IP limits. Without it, all visitors share one set of limits (20 open streams in total). |
| `CLIENT_IP_HEADER` | Fly only: `fly-client-ip` (see the Fly section). |
| Credits, sign-in and admin secrets | Listed in `.env.example`. Set them as the host's secrets, never as build args. |
| `RPC_URL` | A provider RPC URL for the server alone: the deposit indexer and sign-in checks use it, and its key never reaches browsers. Unset, the server uses `NEXT_PUBLIC_RPC_URL`. |
| `INFERNO_DB_INIT` | `1` for the very first start only (see "Credits" below). |
| `DATABASE_URL` | Optional on these hosts: a Postgres server for the ledger. Unset, the ledger is PGlite on the `/data` volume. Required on Vercel. |
| `CRON_SECRET` | Lets a scheduler call `/api/cron/deposits` (see "Credits"). |

**Health check.** `GET /api/health` answers 200 with `{"ok":true,"relay":{"nodes":0,"streams":0},"chainId":4663}`. `relay` is `null` when the relay is off or Redis can't be reached.

## Railway

1. New project, Deploy from GitHub repo. Railway builds the root `Dockerfile`.
2. Variables: add `TRUST_PROXY=1`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_RPC_URL` and the secrets from `.env.example`. Railway passes a variable to the build only when the Dockerfile declares it with `ARG`, which it does for the `NEXT_PUBLIC_*` ones.
3. Add a volume (Command palette `⌘K`, or right-click the canvas), attach it to the service, and set the mount path to `/data`.
4. Service settings, Deploy: healthcheck path `/api/health`. Keep one replica; Railway doesn't allow replicas with a volume anyway, and each redeploy has a few seconds of downtime because only one deployment can mount the volume.

## Fly.io

```bash
fly launch --no-deploy        # uses the existing Dockerfile
fly volumes create inferno_data --size 1 --region <your region>
fly secrets set NAME=value …  # the secrets from .env.example
```

Put this in `fly.toml` (keep the `app` and `primary_region` lines `fly launch` wrote):

```toml
[build.args]
  NEXT_PUBLIC_SITE_URL = "https://inferno.example"
  NEXT_PUBLIC_RPC_URL = "https://your-provider-url"

[env]
  TRUST_PROXY = "1"
  CLIENT_IP_HEADER = "fly-client-ip"

[mounts]
  source = "inferno_data"
  destination = "/data"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "off"
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    grace_period = "20s"
    interval = "30s"
    method = "GET"
    path = "/api/health"
    timeout = "5s"
```

Then `fly deploy`, and check `fly scale show` lists one machine.

- `CLIENT_IP_HEADER`: Fly's proxy appends to whatever `X-Forwarded-For` the visitor sent, so its first entry can be forged; `Fly-Client-IP` is set by Fly alone.
- `auto_stop_machines = "off"`: a stopped machine drops every stream and forgets which lenders are online.

## Render

1. New, Web Service, from the repo. Language: Docker.
2. Pick a paid instance type (disks need one) and add a disk: mount path `/data`, 1 GB.
3. Environment: `TRUST_PROXY=1`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_RPC_URL` and the secrets from `.env.example`. Render passes environment variables to the Docker build as build args; the Dockerfile only reads the `NEXT_PUBLIC_*` ones.
4. Settings: health check path `/api/health`.
5. A service with a disk runs one instance and redeploys with a short downtime. Leave it at one.

## A server with Docker

Any Linux server with Docker, ports 80 and 443 open, and a DNS record pointing at it.

```bash
git clone <your repo> inferno && cd inferno
docker build -t inferno \
  --build-arg NEXT_PUBLIC_SITE_URL=https://inferno.example \
  --build-arg NEXT_PUBLIC_RPC_URL=https://your-provider-url .
docker volume create inferno-data
docker run -d --name inferno --restart unless-stopped \
  -p 127.0.0.1:3000:3000 -v inferno-data:/data \
  -e TRUST_PROXY=1 --env-file /etc/inferno.env inferno
```

`/etc/inferno.env` holds the secrets from `.env.example`; make it readable by root only. Docker runs the same health check on `/api/health` (`docker ps` shows `healthy`).

Put [Caddy](https://caddyserver.com) in front for HTTPS. It gets the certificate, streams server-sent events without buffering, and sets `X-Forwarded-For` to the visitor's address, replacing anything the visitor sent. `/etc/caddy/Caddyfile`:

```
inferno.example {
	reverse_proxy 127.0.0.1:3000
}
```

With nginx instead, use `proxy_set_header X-Forwarded-For $remote_addr;`, not `$proxy_add_x_forwarded_for`, which keeps a forged first entry. The stream response already turns nginx buffering off (`X-Accel-Buffering: no`) and pings every 15 seconds.

To update: `git pull`, rebuild, then `docker rm -f inferno` and the same `docker run`.

## Domain

Add the domain on the host and create the DNS records it shows:

- Railway: service settings, Networking, Custom Domain (a CNAME).
- Fly: `fly certs add inferno.example`, then the A/AAAA or CNAME records it prints.
- Render: settings, Custom Domains (a CNAME, or an A record for a root domain).
- Your own server: an A record to the server; Caddy fetches the certificate on the first request.

Then set `NEXT_PUBLIC_SITE_URL=https://inferno.example` and redeploy: it is baked in at build time and feeds metadata and share images. Check with `curl https://inferno.example/api/health`.

## Credits

- **The ledger.** Postgres: the server at `DATABASE_URL` when it's set (Neon on Vercel), otherwise PGlite in `INFERNO_DB_PATH` (`/data/ledger` in the image, `.data/ledger` in development). Every balance change runs in one transaction holding that wallet's lock, so any number of instances can share one database.
- **First start.** In production the server never creates a new ledger by itself: an empty database usually means the wrong `DATABASE_URL`, an unmounted `/data` volume or a second copy, and a fresh ledger would credit every past deposit again. Payments then stay off, and the log says `No ledger in /data/ledger. Check it's the right database (on Docker, that the /data volume is mounted), or set INFERNO_DB_INIT=1 once to create it.` On the first deploy, set `INFERNO_DB_INIT=1`, check that `/api/credits/config` answers `"enabled":true`, then remove it and redeploy.
- **Crediting deposits.** Nothing runs in the background. Opening the credits page (`GET /api/credits/me`) runs the deposit indexer for up to about 8 seconds, at most once every 10 seconds across all instances, and the next run resumes where it stopped. `GET /api/cron/deposits` does the same every 5 minutes, and first samples $INFERNOAI's price. It answers only `Authorization: Bearer <CRON_SECRET>`, which Vercel Cron sends by itself; on your own server, call it from cron, for example every minute with `curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://inferno.example/api/cron/deposits`.
- **Bittensor answers.** Each answer holds its worst case from the wallet and settles when it ends, in the same function run (an answer is cut off at 4 minutes; the route asks Vercel for 300 seconds). If a run dies first, the next credits read, Bittensor request or cron run settles the hold once it's 6 minutes old: the wallet pays what the answer had used (saved every 5 seconds) and gets the rest back. A wallet has one answer at a time.
- **Shared treasury.** The treasury Safe also takes USDG from another product's owners. A transfer from a wallet in `ADMIN_ADDRESSES` is recorded as treasury funding and credits nobody, so list every wallet that funds the Safe there. Being listed also lets a wallet download earnings and record payouts.
- **Server RPC.** Set `RPC_URL` to a provider endpoint only the server knows. The deposit indexer and sign-in checks use it.
- **$INFERNOAI's live price.** On mainnet, credits also take $INFERNOAI. Every cron run reads the ETH/INFERNOAI Uniswap v4 pool Pons launched it in (pinned by its pool id: anyone can open another pool at any price, so no other is read) and Chainlink's ETH/USD feed, and stores the price. A coin deposit credits at the lowest price stored in the last 30 minutes, less 10%, so a pump shorter than that can't be cashed in and nobody sets the price by hand. There's no price, and coin deposits wait (they're credited once there is one), while the stored prices cover less than 20 minutes, the newest is more than 10 minutes old, the pool has less than 2 ETH in range, or the ETH/USD answer is more than 25 hours old. So without the cron running every 5 minutes, coin deposits never credit.
- **Manual prices.** Only USDG and $INFERNOAI are accepted unless `ALLOW_MANUAL_PRICES=1`, which credits TAO and another coin (`COIN_ADDRESS`, such as one on testnet) at the prices you set. If a price is above market, someone can buy the token cheap, deposit it, spend the credits on network answers from a lender wallet they also run, and get paid out in USDG. The per-transfer and daily caps (`MAX_CREDIT_USD_PER_DEPOSIT`, `MAX_CREDIT_USD_PER_DAY`) limit the damage. Before every payout, check the `askers` column of `/api/admin/earnings.csv`: a lender paid by only one or two wallets needs a look first.

## Vercel

This is the same setup as the team's other projects: a private GitHub repo that Vercel deploys on every push to `main`. `vercel.json` pins the functions to `iad1` (US East) and adds the deposit cron.

1. **Import the repo.** In Vercel, Add New, Project, import `hoodLMdev/inferno`. The framework is detected (Next.js); change nothing in the build settings. Inferno takes payments, so use a team on the Pro plan: Hobby is for non-commercial use.
2. **Add storage** from the project's Storage tab, both in AWS us-east-1 next to the functions:
   - **Upstash for Redis**, for the relay. It sets `KV_URL` (and `REDIS_URL`), which the relay reads. Without it the relay answers 503 on Vercel, because per-instance memory would split it.
   - **Neon** (Postgres), for the credits ledger, kept for the ledger alone. It sets `DATABASE_URL`, the pooled connection string. Payments won't switch on without it.
   - Scope both to the Production environment, so preview deployments never touch the live relay or ledger.
3. **Environment variables** (Settings, Environment Variables):

   | Variable | Environment | Value |
   |---|---|---|
   | `PAYMENTS_ENABLED` | Production | `1` |
   | `SESSION_SECRET` | Production | `openssl rand -hex 32`, generated by you |
   | `CRON_SECRET` | Production | another `openssl rand -hex 32` |
   | `CHUTES_API_KEY` | Production | your Chutes key, for Bittensor answers paid with credits |
   | `TREASURY_ADDRESS` | Production | the treasury Safe on Robinhood Chain |
   | `ADMIN_ADDRESSES` | Production | comma-separated wallets that can download earnings and record payouts. Deposits from these wallets are treated as treasury funding and never credited, so list every wallet that funds a shared Safe. |
   | `DEPOSIT_START_BLOCK` | Production | the finalized block just before launch, so no older transfer to the treasury is ever credited |
   | `RPC_URL` | All | a provider RPC URL, server only. `ROBINHOOD_RPC_URL` works too, so a Vercel shared variable can serve several projects. |
   | `INFERNO_DB_INIT` | Production | `1` for the first deploy only (step 4) |

   `NEXT_PUBLIC_SITE_URL` can stay unset: the site and sign-in use the production domain Vercel reports (`VERCEL_PROJECT_PRODUCTION_URL`), including a custom domain once you add one. `TRUST_PROXY` isn't needed: Vercel overwrites `X-Forwarded-For` with the visitor's address, and the relay trusts it there.
4. **First deploy.** Deploy with `INFERNO_DB_INIT=1`, check that `https://<your domain>/api/credits/config` answers `"enabled":true` and `/api/health` shows a `relay` object, then delete `INFERNO_DB_INIT` and redeploy.
5. **Cron.** `vercel.json` calls `/api/cron/deposits` every 5 minutes, which needs Vercel Pro (Hobby allows once a day). It keeps $INFERNOAI priced; on Hobby, set the schedule to `0 5 * * *` and the coin never gets a price, so coin deposits wait. USDG deposits are credited as soon as their sender opens the credits page either way.

What to know about running it there:

- **Relay state in Redis.** Each key's inbox is a Redis Stream, so a stream that hits the 300-second function limit reconnects and resumes from the last event with nothing lost. Keys: `offer:{key}`, `nodes`, `online:{key}`, `inbox:{key}`, `chal:{id}`, and `streams` / `streams:ip:{ip}` / `streams:key:{key}` for the caps.
- **Rate limits are per instance** on Vercel (in-memory token buckets). The stream caps (20 per IP, 4 per key, 1,000 in total) are shared through Redis. For a hard limit across instances, add a Vercel Firewall rate-limit rule on `/api/relay/*` and `/api/health`.
- **Cost.** Upstash bills per command, about $0.20 per 100K (check current pricing). One lender online all day uses about 1.5M commands a month (about $3). Each streamed answer costs about 4 commands per quarter second of streaming. Every open stream holds one Redis connection and keeps a function instance alive, which Vercel bills as memory time. Check the Upstash plan's connection limit against your expected number of open streams.
- **Ledger in Neon.** Every balance change runs in one transaction under that wallet's lock, so any number of instances share one ledger safely. Backups: Neon's restore window plus a regular `pg_dump` over the unpooled connection string.

## Production checklist

- [ ] Vercel: Upstash Redis and Neon connected (Production), money variables set for Production only, `INFERNO_DB_INIT` removed after the first deploy.
- [ ] Docker server without Redis: one instance. No replicas, autoscaling or second region: each extra instance splits the relay.
- [ ] Docker server: a persistent volume mounted at `/data` (the ledger lives there unless `DATABASE_URL` is set).
- [ ] `TRUST_PROXY=1` on Docker hosts (plus `CLIENT_IP_HEADER=fly-client-ip` on Fly). Automatic on Vercel.
- [ ] Docker hosts: `NEXT_PUBLIC_SITE_URL` set to the real domain, then rebuilt. On Vercel it can stay unset.
- [ ] `NEXT_PUBLIC_RPC_URL` set to a provider endpoint (Alchemy, QuickNode or similar) with Robinhood Chain mainnet. The public RPC is rate-limited. The URL ships to browsers, so restrict its key to your domain.
- [ ] Secrets from `.env.example` set as runtime secrets, not build args, and not committed. `.dockerignore` keeps local `.env*` files out of the image.
- [ ] `RPC_URL` set to a server-only provider endpoint. `INFERNO_DB_INIT=1` on the first deploy only, removed once the log says payments are on.
- [ ] Before each lender payout, the `askers` column of the earnings CSV checked (see "Credits").
- [ ] The host's health check points at `/api/health`.
- [ ] Backups of the ledger, with an off-host copy. With `DATABASE_URL`, use the provider's backups (Neon keeps a restore window) plus a regular `pg_dump` over the direct, unpooled connection string. With PGlite on `/data`, turn on the host's volume snapshots or backups. On your own server, a consistent copy takes a short stop:

  ```bash
  docker stop inferno
  docker run --rm -v inferno-data:/data -v "$PWD":/backup node:22-slim tar czf /backup/inferno-$(date +%F).tgz -C /data ledger
  docker start inferno
  ```
- [ ] Docker server without Redis: deploy at quiet times. A restart clears the relay's memory: lenders' tabs reconnect and re-announce within about half a minute, and answers in progress are lost.

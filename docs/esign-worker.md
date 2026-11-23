# E-sign worker

The stocks API produces jobs. Only the separate worker consumes `alankit-esign`.
Start both processes; starting only the API will leave e-sign jobs waiting.
Both need the same Redis connection, database, Alankit and storage configuration.
The worker has no HTTP listener and does not import the application's scheduler.

## Local development

Run in separate terminals from the repository root:

```sh
pnpm --filter stocks-service dev
pnpm --filter stocks-service dev:esign-worker
```

For compiled code:

```sh
pnpm --filter stocks-service build
pnpm --filter stocks-service start:esign-worker
```

## Same-server Docker deployment

The staging Compose file runs the same stocks-service image with a different
command for `esign-worker`. No public port or fixed container name is needed.

```sh
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build stocks-service esign-worker
docker compose --env-file .env.staging -f docker-compose.staging.yml logs -f esign-worker
```

`ESIGN_CONCURRENCY` defaults to **1** and accepts integers from 1 to 32.
`ESIGN_WORKER_MEMORY` defaults to **768m** in Compose. This is a starting container
budget, not measured memory usage; ensure the host has spare capacity first.
Chromium uses memory outside the Node heap. Check total usage with `docker stats`.

One replica at concurrency 1 consumes at most one queued job at a time.
Replicas multiply concurrency, so increase them only after measuring resources
and confirming Alankit's quota. Each worker logs queue wait, processing duration,
and Node RSS (which excludes Chromium child processes).

```sh
docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --scale esign-worker=2 esign-worker
```

The custom `scripts/cd/staging.sh` deployment uses `docker run`, not Compose, and
does not automatically deploy this new worker. When using that deployment path,
run a separate container from the same released image, on the same Docker network,
with the same environment file and command `node dist/esign-worker.js`; manage it
alongside API releases. Do not run an additional Compose API alongside that API.
Allow at least 120 seconds for graceful worker shutdown rather than force removal.

Deploy the worker and API together, and drain the old embedded consumers during
the first rollout. The HTTP endpoints still wait for their queued result.
Alankit's account quotas and shared rate-limit policy are not documented yet.

## Request deduplication

Both generation endpoints now require `x-idempotency-key` (16–128 letters,
digits, underscores or hyphens; UUIDs are accepted). Updated web and shared API
clients supply this automatically. Deploy the clients with the API change;
older clients without the header receive HTTP 400.

Use one key for one logical signing attempt. The server scopes it to the
authenticated user and atomically enqueues one Bull job for that key. Requests
with a reused key and different purchase details receive HTTP 409. Concurrent
requests and later retries replay the same job/result. Completed and failed jobs
are retained for at least 24 hours (Bull age cleanup runs when jobs finish).
Do not rely on a key after that retention window or delete its Redis job to retry.

The clients reuse their key after a network failure and clear it on success, so
a subsequent purchase gets a new key. Automatic key retention is in memory and
does not survive a reload; callers needing retry continuity across reloads must
retain and pass the optional `requestId` argument. Separate tabs/new keys are
distinct attempts, even when purchase details match.

Generation no longer bypasses Redis on an outage. A worker claims an execution
atomically before calling the provider, and stores its successful result before
acknowledging Bull completion. Stalled delivery replays a saved result or fails
closed if the provider outcome is unknown. It does not repeat a potentially
successful provider POST. Generation failures are retained and require support
reconciliation rather than automatic recreation; archive jobs retain their
existing retry behavior. This prevents duplicate execution per retained request
key, but cannot guarantee exactly-once provider behavior after Redis data loss.

Source-document upload is awaited before a generation result becomes reusable.
Alankit transaction calls have 60-second abort signals; a timeout is treated as
an uncertain outcome, not permission to create another session. Before the
provider migration, drain or reconcile outstanding jobs from the legacy
`digitap-esign` queue; the new worker consumes only `alankit-esign`.

Alankit request quotas have not been confirmed. Keep concurrency at 1 until the
provider confirms its limits and production behavior.

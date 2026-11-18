# Backend CI/CD v1

## Scope

This document is the authoritative backend staging deployment flow for v1.

Included:
- GitHub Actions backend CI
- GitHub Actions staging deployment from `staging`
- GHCR image build and push
- EC2 runtime deployment
- Per-service blue/green-style rollout for backend services
- Application rollback during failed rollout
- Migration safety policy as governance

Excluded from v1:
- Automated database rollback
- Schema rollback automation
- Frontend CI/CD
- Full-stack blue/green deployment

## Deployment Model

The staging backend deployment path is:

1. Push backend changes to `staging`
2. GitHub Actions detects which backend services changed
3. GitHub Actions validates only the affected backend services
4. GitHub Actions builds immutable Docker images for the affected services
5. GitHub Actions pushes those images to GHCR
6. The deploy job waits on the `staging` environment approval gate
7. After approval, GitHub Actions SSHes to EC2 and runs the staging deploy script
8. EC2 pulls the image, starts a candidate container for one service, waits for health, switches Nginx, runs a smoke check, and removes the old container

## Repository Assets

The v1 backend CI/CD implementation is driven by these files:

- `.github/workflows/backend-ci.yml`
- `.github/workflows/backend-staging-deploy.yml`
- `scripts/ci/detect-backend-changes.sh`
- `scripts/ci/run-backend-service-checks.sh`
- `scripts/ci/build-backend-image.sh`
- `scripts/deploy/staging.sh`
- `deploy/staging/nginx.staging.template.conf`

## Branch Rules

- Pull requests and backend pushes run `Backend CI`
- Pushes to `staging` run `Backend Staging Deploy`
- Staging deploys are serialized with workflow concurrency so only one staging deploy runs at a time
- Staging deploy requires manual approval through the GitHub environment named `staging`

## Changed-Service Detection

Changed-service detection fans shared package changes out to the affected services.

High-level rules:

- `apps/auth-service/**` affects `auth-service`
- `apps/payments-service/**` affects `payments-service`
- `apps/stocks-service/**` affects `stocks-service`
- `apps/ticketing-service/**` affects `ticketing-service`
- `packages/db-unlistedstock/**`, `packages/cookie-crypto/**`, `packages/typescript-config/**`, root workspace files, and deploy assets affect all backend services
- `packages/db-ticketing/**`, `packages/shared-types/**`, and `packages/stats-types/**` affect `ticketing-service`
- `packages/redis-service/**` affects `auth-service` and `stocks-service`
- `packages/email-service/**` affects `payments-service`, `stocks-service`, and `ticketing-service`

## CI Validation

The CI workflow validates changed backend services with deterministic service-specific checks.

Validation currently includes:

1. Prisma client generation for the required DB packages
2. Shared package builds needed by the target service
3. Service build

The validation script is intentionally explicit rather than relying on the older local shell scripts.
Backend lint is not a blocking gate in v1 because the current codebase still has substantial
pre-existing lint debt that is separate from deployment readiness.
Backend unit tests are also not a blocking gate in v1 because parts of the current backend
test suite are not green and would prevent rollout automation for reasons unrelated to the
staging deployment path itself.

## Image Build Strategy

Images are built in GitHub Actions, not on EC2.

Current image behavior:

1. Each changed service is built from its existing Dockerfile
2. Images are pushed to GHCR with two tags:
   - immutable commit SHA tag
   - mutable `staging-latest` tag
3. Build-time Prisma generation still requires database connection strings as build args

Current image naming pattern:

- `ghcr.io/<owner>/smc-auth-service:<sha>`
- `ghcr.io/<owner>/smc-payments-service:<sha>`
- `ghcr.io/<owner>/smc-stocks-service:<sha>`
- `ghcr.io/<owner>/smc-ticketing-service:<sha>`

## EC2 Runtime Strategy

The EC2 host is runtime-only.

Key constraints and design choices:

1. No Docker image builds happen on EC2
2. Only one backend service is rolled out at a time
3. Each service has a stable slot and a candidate slot
4. Nginx upstreams are regenerated from a template and reloaded after cutover
5. The previous service container stays in place until the Nginx smoke check succeeds

The deploy script keeps state in `deploy/staging/.state/`.

Tracked state includes:

- active slot per service
- current image per service
- previous image per service

## Legacy Bootstrap Behavior

The first v1 deployment may encounter legacy container names from the previous manual Docker Compose flow.

The deploy script handles that by:

1. creating the dedicated Docker network `smc-staging-network`
2. adopting legacy backend containers into blue-slot names when slot state does not yet exist
3. generating the new Nginx config from the template
4. reloading or starting the managed Nginx container

This allows the rollout path to move off the old manual model without reusing the old deployment script as the new authority.

## Required GitHub Secrets

The deploy workflow expects these secrets:

- `STAGING_DATABASE_URL`
- `STAGING_ADMIN_DATABASE_URL`
- `STAGING_TICKETING_DATABASE_URL`
- `STAGING_EC2_HOST`
- `STAGING_EC2_USER`
- `STAGING_EC2_SSH_KEY`
- `STAGING_GHCR_USERNAME`
- `STAGING_GHCR_TOKEN`

Notes:

1. `STAGING_EC2_SSH_KEY` is the private key used for SSH access to the EC2 host
2. `STAGING_GHCR_TOKEN` must be able to pull packages from GHCR on the EC2 host
3. Manual approval is configured through the GitHub environment named `staging`, not via a repository secret

## Required EC2 Prerequisites

The target EC2 host must have:

1. Docker installed and running
2. A checked-out copy of this repository at `~/smc-unlisted-stox`
3. A populated `.env.staging` file at the repository root on the EC2 host
4. Network access to Supabase, Redis, and other external services required by the backend
5. Port 80 available for the managed Nginx container

## Rollout Sequence

For one changed service, the deploy script does the following:

1. Pull the target image from GHCR
2. Determine the active slot and choose the opposite slot as the candidate
3. Start the candidate container with the current staging environment
4. Wait for the candidate container health check to become healthy
5. Update Nginx upstreams to point that service to the candidate slot
6. Reload Nginx
7. Run a smoke check through Nginx for the switched service route
8. If successful, update deployment state and remove the old container

## Rollback Behavior

V1 includes application rollback during a failed rollout, but not DB rollback automation.

If the candidate container fails before cutover:

1. the candidate is removed
2. traffic stays on the stable container
3. the deployment fails

If the candidate fails after Nginx cutover or the smoke check fails:

1. the service slot is reverted in state
2. Nginx is rendered again for the stable slot
3. Nginx is reloaded back to the stable service container
4. the candidate is removed
5. the deployment fails

## Migration Policy For v1

Migration governance is included, but migration rollback automation is not.

V1 rules:

1. Prefer additive migrations
2. Transitional migrations require review
3. Destructive migrations are out of normal v1 deploy flow
4. Application rollback must not assume schema rollback
5. Expand-contract is the rule for schema changes that need compatibility across releases

Until the application deployment path is stable, keep database migration execution conservative and reviewed.

## First Rollout Recommendation

For the first activation of this renamed workflow path, deploy all backend services together from `staging` so the EC2 host fully transitions to the managed slot-based runtime layout under the new branch naming.

After that, normal changed-service deploy behavior is the expected path.

## Operational Notes

1. The deploy script retains the current and immediately previous image reference per service and prunes older pulled tags for that service
2. Stocks uploads are mounted from the repository path on EC2 so redeploys do not discard local upload data written under `/app/uploads`
3. The workflow depends on GitHub environment approval to gate staging deployment
4. The older manual deployment shell scripts remain reference-only and are not the authoritative deployment path

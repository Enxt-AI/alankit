# Signed deal sheet downloads

Users can open an order from Dashboard > Orders and select **Download signed
deal sheet**. The authenticated `GET /api/orders/:id/deal-sheet` endpoint checks
order ownership before reading the private `signed-deal-sheets` bucket.
Incomplete documents return a retry message.

The original signed PDF is archived without modification. The object key is
derived from the provider's document identifier: Alankit `ReferenceNo` for new
sessions, or the Digitap document ID for legacy sessions. No database migration
is needed. The generic storage service blocks public access to archived PDFs.

Deployment:

- Deploy stocks-service, the Alankit eSign worker, and web together.
- The stocks-service MinIO credentials need permission to create private
  `signed-deal-sheets` and `alankit-esign-source-documents` buckets and read/write
  their objects. Keep the buckets private, persistent, and backed up.
- Configure the Alankit environment and reachable S3-compatible endpoint as
  documented in [alankit-esign.md](./alankit-esign.md).
- Set `ALANKIT_ESIGN_DOCUMENT_HOSTS` to exact HTTPS hostnames only if Alankit's
  authenticated file endpoint returns a download URL.
- Keep the Redis/Bull eSign worker running. Alankit callbacks trigger a
  fresh authenticated file lookup with retry/backoff; monitor failed
  `archive-signed-document` jobs and retry after resolving outages.
- The legacy `POST /api/orders/esign-webhook` handler and Digitap document
  recovery remain for documents created before migration. Configure
  `DIGITAP_DOCUMENT_HOSTS` only if those legacy documents still need recovery.

Callback-supplied URLs and signer claims are not trusted. Alankit documents are
retrieved through its authenticated file endpoint and validated as PDFs before
archival. A real signed-document smoke test is required in the deployed
environment to verify the subscription, environment-matched endpoints, public
source-PDF reachability, and provider response format.

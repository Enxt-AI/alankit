# Signed deal sheet downloads

Users can open an order from Dashboard > Orders and select **Download signed deal sheet**. This is available for orders with an e-sign document ID, independently of payment or settlement. Incomplete documents return a retry message.

The original signed PDF is archived, without modification, in the private `signed-deal-sheets` MinIO bucket. Object keys are derived from the Digitap document ID, so documents signed before order creation remain available when the order is linked. No database migration is needed. The authenticated `GET /orders/:id/deal-sheet` endpoint checks order ownership before reading storage. The generic storage service blocks public access and uploads to this bucket.

Deployment:

- Deploy stocks-service, storage-service, and web together.
- The stocks-service MinIO credentials need permission to create the private bucket and read/write its objects. Keep its bucket policy private and its data persistent/backed up; do not apply public-read policies or expiry lifecycle rules.
- Set `DIGITAP_DOCUMENT_HOSTS` to the exact HTTPS download hostname(s) returned by your Digitap environment. The default matches the production hostname in the supplied documentation.
- Register the externally reachable `POST /api/orders/esign-webhook` URL with Digitap. The repository cannot confirm whether the enterprise subscription is enabled in Digitap's account settings.
- Keep the existing Redis/Bull worker running. Webhooks queue a fresh authenticated Digitap lookup, with eight attempts and exponential backoff. Monitor failed `archive-signed-document` jobs and retry after resolving outages.

Signing verification also archives PDFs. Webhooks supply only an identifier: their URL and signer claims are never trusted. Older orders without an archive are recovered on download by requesting a fresh provider URL. Recovery depends on Digitap retaining the document; an expired old link is never reused. A real signed-document smoke test is required in the deployed environment to verify account subscription, provider hostname, and storage permissions.

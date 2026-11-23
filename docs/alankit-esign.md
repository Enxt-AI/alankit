# Alankit eSign workflow

The stocks service uses Alankit for new eSign sessions. Both
`POST /api/orders/generate-esign-session` and
`POST /api/orders/:id/generate-esign` generate the current deal-sheet PDF, store
it in a private S3-compatible bucket, and send a six-hour presigned URL to
Alankit as `SourcePdfUrl`.

Alankit returns a `ReferenceNo`. The API returns that reference as `docId` and
an Alankit browser redirect as `eSignUrl`. After signing, Alankit calls
`GET /api/orders/esign/success?resp=...`. The callback is treated only as a
trigger: the service checks the reference against a known Alankit attempt, then
the worker fetches the signed file from Alankit's authenticated
`POST /esign/getesignfile` endpoint. The callback's `purl` is not fetched.
Retrieved files must be valid PDFs; URL payloads are fetched only from hosts in
`ALANKIT_ESIGN_DOCUMENT_HOSTS`.

## Required configuration

Configure these values on both the stocks API and eSign worker. Do not commit
the subscription key or export it in a shared Postman collection.

```text
ALANKIT_ESIGN_SUBSCRIPTION_KEY=<Alankit-issued key>
ALANKIT_ESIGN_BASE_URL=<HTTPS API host for the selected environment>
ALANKIT_ESIGN_REDIRECT_URL=<HTTPS browser redirect for the same environment>
ALANKIT_ESIGN_CALLBACK_URL=<public HTTPS URL ending in /api/orders/esign/success>
ALANKIT_ESIGN_PUBLIC_STORAGE_ENDPOINT=<provider-reachable HTTPS S3-compatible endpoint>
```

`ALANKIT_ESIGN_REQUEST_REASON` is optional and defaults to `DEMAT ESIGN`.
`ALANKIT_ESIGN_DOCUMENT_HOSTS` is a comma-separated exact-host allowlist and is
required if `getesignfile` returns a document URL rather than Base64 content.
Use Alankit-confirmed matching API and redirect endpoints for UAT or production;
do not mix environments. The storage endpoint must reach the same private
MinIO/S3 bucket and path used by the stocks service so Alankit can download the
presigned source file.

The `alankit-esign-source-documents` bucket is private. Callback completion
deletes the temporary source PDF, and the stocks API removes remaining source
objects older than seven days. The provider API's file response formats and
document hosts must be confirmed with Alankit before enabling URL responses.

## Identity gate and rollout limitation

The supplied collection documents a success code, transaction reference, and
signed-file payload, but does not document an authenticated signer-identity
result. Therefore an Alankit callback can mark the document signed, but
`verify-esign-identity` returns `INSUFFICIENT_DATA`. A sign-first session cannot
be linked to an order without `esignValidationVerdict = MATCH`; order-first
checkout may create a pending reservation, but payment remains blocked until
that same match exists. Keep this gate in place until Alankit supplies a trusted
signer-identity API/webhook specification and that verification is implemented.

Existing Digitap document lookup and callback handling remain for in-flight
legacy documents. New generation requests use the `alankit-esign` Bull queue;
drain or reconcile jobs in the old `digitap-esign` queue before deploying the
new worker.

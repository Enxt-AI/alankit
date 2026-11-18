# Company document downloads

The public GET `/api/stocks/company/:cin/documents?docId=...` returns PDF bytes
with `Content-Disposition: attachment`. The `/documents/attachments` variant
returns JSON attachment metadata; `/documents/attachment` also requires
`attachmentName` and returns the selected attachment. Missing query parameters
remain HTTP 400.

Probe42 transport failures now return 502, exhausted timeouts return 504, and a
missing server API key returns 503. Upstream HTTP failures return 502 rather than
being reported as invalid client input. The document service retries once on
transport failure or upstream 500/502/503/504, with a 500 ms pause and a 20 second
deadline per attempt (including reading the body). Other upstream HTTP statuses,
including 401/404/429, are not retried. Concurrent requests for the same CIN and
document share one download; buffers are not cached after completion.

The website uses a native download link rather than fetching a blob and clicking
a synthetic link later. Attachments load only when the user selects View
attachments, avoiding downloading and parsing every displayed PDF on page load.
Attachment failures offer an explicit retry instead of silently hiding the list.

## Memory configuration

The staging stocks service defaults to a 512 MB old-space heap and a 1 GB
container limit, configurable with STOCKS_HEAP_MB and STOCKS_MEMORY. Keep room
outside the heap for PDF buffers, native allocations and the runtime. These
changes mitigate the observed 200 MB heap exhaustion; they do not establish the
absence of a leak or prove which request caused the historical crashes.

## Validation

From apps/stocks-service:

```sh
node node_modules/jest/bin/jest.js --runInBand src/stocks/probe42.service.spec.ts
```

The tests run the real service's native fetch against a local HTTP fixture:
binary response and encoding, socket failure/recovery, temporary 503, persistent
failure, non-retryable statuses, concurrent request sharing and a hanging server.
The fixture uses a dummy key and PROBE42_REPORTS_BASE_URL; production defaults to
the existing Probe42 reports URL. No live provider documents are fetched.

Before declaring the iPhone issue resolved, deploy the web and stocks changes,
then use Safari on the affected iPhone to open Company Documents, download a PDF,
expand attachments and download an attachment. Check that merely opening the
section makes no attachment requests, retries remain usable, and the container
restart count and memory usage remain stable while exercising several documents.
Native device behavior and live provider reliability require this separate check.

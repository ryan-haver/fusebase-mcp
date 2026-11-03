# Upload Lifecycle

This reference is the canonical source for the Fusebase file upload lifecycle.
Use the same terminology everywhere: `tempStoredFileName`, `storedFileUUID`, `readUrl`, `relative url`, and `file descriptor`.

## Canonical Flow

1. Create a temp file and capture `tempStoredFileName`.
2. Create a stored file from `tempStoredFileName` and capture `storedFileUUID`.
3. Build or read the display URL:
   - `readUrl` is an absolute URL returned by Gate completion flows.
   - `relative url` is a stored file path that must be prefixed before display.
4. Pass a file descriptor to the next layer.

<!-- CUSTOM:SKILL:BEGIN -->
## App attachment storage (non-negotiable)

- After upload, apps persist **`storedFileUUID` + `readUrl`** (and small metadata) in dashboards or isolated SQL — **never** the file bytes.
- Do **not** store base64/`bytea`/data URLs in isolated SQL as an MVP. The ordinary SQL write path is only reliable around ~100–150 KB; the 64MiB figure applies only to `importIsolatedStoreSqlRows` (CSV/TSV seeds).
- **Visitor / public apps:** call Gate file ops from the **feature backend** with `FBS_FEATURE_TOKEN` (`files.write`), not from a visitor browser token. Return refs to the client.
<!-- CUSTOM:SKILL:END -->



## Flow Selection

Three upload flows. Pick by what the file is for:

1. **Presigned single PUT** — Gate `createTempStoredFileUpload`, then one `PUT` carrying the whole file.
   The default for app uploads. Send the bytes as the body and exactly the headers the operation returns
   in `headers` — `content-type` alone — and nothing else. The URL signs `host`, so `content-type` rides
   unsigned, but it is still required: it is the media type the stored object keeps.
2. **Multipart** — Gate `startMultipartFileUpload`, one `PUT` per part, then `completeMultipartFileUpload`.
   Only when the file is too large for a single request.
3. **Note attachments** — app-api `web-editor/file/v2-upload`, then `bucket-files/create-relative`.
   Only for files attached to a note. When a note needs a readable image/file URL after upload, keep it
   on this flow and use the file descriptor or URL that flow returns.

Both Gate flows give you a `tempStoredFileName`. To put the file in the organization file list, hand
that name to `createBucketAttachment`, which creates the stored-file record itself — so on flow 2 finish
with `saveStoredFile: false` and let the attachment do it. Flow 1 never creates a stored file on its own.

## App attachment storage (non-negotiable)

- After upload, apps persist **`storedFileUUID` + `readUrl`** (and small metadata) in dashboards or isolated SQL — **never** the file bytes.
- For every bucket attachment, persist its `globalId`. A public file may also keep its `url`, but do not count on removing the file to take that link back. For a **private** file never persist the `url`: it expires (see [Private files](#private-files)).
- Do **not** store base64/`bytea`/data URLs in isolated SQL as an MVP. The ordinary SQL write path is only reliable around ~100–150 KB; the 64MiB figure applies only to `importIsolatedStoreSqlRows` (CSV/TSV seeds).
- **Visitor / public apps:** call Gate file ops from the **feature backend** with `FBS_FEATURE_TOKEN` (`files.write`), not from a visitor browser token. Return refs to the client.

## Presigned PUT Headers

The `headers` the upload operation returns are authoritative: send exactly those, and never a header it did not return.

- `createTempStoredFileUpload` returns `{"content-type": "..."}`. Send it:

  ```typescript
  await fetch(uploadUrl, { method: "PUT", headers, body: bytes });
  ```

  The signature covers `host` only, so `content-type` is unsigned and does not break it. Dropping it stores the file under the wrong media type, and the type cannot be recovered afterwards.

- When an operation returns no headers — the multipart `uploadUrl` and `partsUrls`, signed as `X-Amz-SignedHeaders=host` — send a bare `PUT`:

  ```typescript
  await fetch(uploadUrl, { method: "PUT", body: bytes });
  ```

- Never add storage-provider headers or anything else that is neither returned by the upload API nor listed in `X-Amz-SignedHeaders`.
- In browser code, pass `ArrayBuffer`/raw bytes for the body rather than a typed `Blob`, so the browser sends only the `content-type` you set. The bucket CORS rules allow `content-type`; any other header fails the `PUT` as a generic network error before the response is visible.
- A cross-origin browser `PUT` can still preflight because `PUT` is not a CORS simple method. The important rule is to keep the requested headers aligned with the presigned URL and bucket CORS policy.

## Create A Temp File

For files smaller than 50 MB, send multipart/form-data to:

`POST https://app-api.thefusebase.com/v3/api/web-editor/file/v2-upload`

Required fields:

- `file`: the file bytes
- `folder`: `apps`

Response:

```json
{
  "name": "notes/119/1766749985-f5Ai3b/file.docx",
  "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "filename": "file.docx",
  "size": 16511
}
```

The response includes `name`; treat it as `tempStoredFileName`.
Use that value for the stored-file step.

For files 50 MB or larger, use multipart upload against the same endpoint:

1. Start with `action=start`, `folder=apps`, `name`, `type`, and `size`.
2. Upload each chunk to the returned part URL with `PUT`.
3. Finish with `action=finish`, uploaded `parts`, `uploadingId`, and `tempStoredFileName`.

Start request fields:

- `action`: `start`
- `folder`: `apps`
- `name`: original file name
- `type`: MIME type
- `size`: file size in bytes

Start response:

```json
{
  "id": "rTuydPY3YaUR5rZ1kk3",
  "partsUrls": [
    "https://s3-bucket.s3-eu-central-1.amazonaws.com/notes/119/1766750238-wqXiUD/recording.mov?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=..."
  ],
  "partSize": 52428800,
  "tempStoredfileName": "notes/119/1766750238-wqXiUD/recording.mov"
}
```

API quirk: some legacy responses/fields spell this as `tempStoredfileName` with a lowercase `f`. Treat that value as canonical `tempStoredFileName` in guidance and handoffs, but send the exact field name required by the endpoint or SDK schema you are calling.

Finish request fields:

- `action`: `finish`
- `parts`: JSON array of uploaded parts, each with `etag` and `partNumber`
- `uploadingId`: `id` from the start response
- `tempStoredfileName`: temp name from the start response, if this endpoint expects the legacy casing

Each chunk should be retried up to 3 times before failing the upload.

Example large-file helper:

```typescript
const UPLOAD_URL =
  "https://app-api.thefusebase.com/v3/api/web-editor/file/v2-upload";
const CHUNK_RETRIES = 3;

async function uploadLargeFile(
  file: File,
  appToken: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<{ tempStoredFileName: string } | null> {
  const startForm = new FormData();
  startForm.append("action", "start");
  startForm.append("folder", "apps");
  startForm.append("name", file.name);
  startForm.append("type", file.type);
  startForm.append("size", String(file.size));

  const startRes = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { "x-app-feature-token": appToken },
    body: startForm,
  });
  if (!startRes.ok) return null;
  const { id, partsUrls, partSize, tempStoredfileName } =
    await startRes.json();

  const progress = new Array(partsUrls.length).fill(0);

  const uploadChunk = async (
    url: string,
    index: number,
  ): Promise<{ etag: string; partNumber: number }> => {
    const chunk = file.slice(index * partSize, (index + 1) * partSize);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < CHUNK_RETRIES; attempt++) {
      try {
        const res = await fetch(url, { method: "PUT", body: chunk });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const etag = JSON.parse(res.headers.get("etag") ?? '""');
        if (!etag) throw new Error("Missing etag");

        if (onProgress) {
          progress[index] = chunk.size;
          onProgress(
            progress.reduce((a, b) => a + b, 0),
            file.size,
          );
        }

        return { etag, partNumber: index + 1 };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw new Error(
      `Chunk ${index} failed after ${CHUNK_RETRIES} attempts: ${lastError?.message}`,
    );
  };

  const parts = await Promise.all(
    partsUrls.map((url: string, index: number) => uploadChunk(url, index)),
  );

  const finishForm = new FormData();
  finishForm.append("action", "finish");
  finishForm.append("parts", JSON.stringify(parts));
  finishForm.append("uploadingId", id);
  finishForm.append("tempStoredfileName", tempStoredfileName);

  const finishRes = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { "x-app-feature-token": appToken },
    body: finishForm,
  });
  if (!finishRes.ok) return null;

  const result = await finishRes.json();
  return {
    tempStoredFileName: result.tempStoredFileName ?? result.tempStoredfileName,
  };
}
```

## Create A Stored File

After temp upload, create the stored file:

`POST https://app-api.thefusebase.com/v4/api/bucket-files/create-relative`

JSON body:

```json
{
  "tempStoredFileName": "NAME_FROM_TEMP_STEP",
  "folder": "apps"
}
```

The response includes `attachment.storedFileUUID` and file metadata. Use `storedFileUUID` as the stored file id in downstream APIs.

Gate note: file-service stored-file JSON uses `uuid`; Gate file operations expose that same value as `storedFileUUID` and may also return `fileId` as an alias. In guidance and handoffs, prefer `storedFileUUID`.

Stored-file response shape:

```json
{
  "bucket": {
    "globalId": "string",
    "userId": 0,
    "workspaceId": "string",
    "target": "string",
    "targetId": "string",
    "groupId": "string",
    "activeItems": 0,
    "clock": 0,
    "deleted": false
  },
  "attachment": {
    "globalId": "string",
    "bucketId": "string",
    "userId": 0,
    "workspaceId": "string",
    "filename": "string",
    "storedFileUUID": "string",
    "kind": "file",
    "type": "string",
    "size": 0,
    "extra": {},
    "clock": 0,
    "deleted": false,
    "updatedAt": 0,
    "createdAt": 0,
    "noteServiceAttachment": true
  },
  "file": {
    "globalId": "string",
    "bucketId": "string",
    "target": "task",
    "targetId": "string",
    "portalId": "string",
    "orgId": "string",
    "workspaceId": "string",
    "filename": "string",
    "type": "image",
    "format": "string",
    "userId": 0,
    "size": 0,
    "createdAt": 0,
    "deleted": false,
    "url": "string",
    "extra": {}
  }
}
```

## Bucket Attachments

A file manager style app reaches the organization's files through Gate, which forwards to bucket-service.
App uploads land in the organization `app` bucket next to the note and portal files.

- `createBucketAttachment` — `{tempStoredFileName, attributes?, accessPrincipals?, folder?, private?}`. Creates the
  stored-file record and the attachment; `private: true` makes it a [private file](#private-files). Needs an app token: the app backend calls it with
  `FBS_FEATURE_TOKEN`, and the app frontend can call it directly through the app-api Gate proxy,
  which forwards the app's scopes. On the frontend path the recorded uploader is the signed-in
  user rather than the backend service user.
- `updateBucketAttachment` — `{filename?, attributes?, accessPrincipals?}`. Works on any file of the
  organization; `accessPrincipals` only on `app` files. `attributes` replaces the whole object when present,
  `accessPrincipals: null` clears every restriction, and omitted fields stay as they are. Only the uploader
  or an organization manager or owner may change `attributes` or `accessPrincipals` (others get 403).
- `removeBucketAttachment` — `path: { orgId, globalId }`. Removes any file of the organization, whatever its
  source, and returns the removed attachment. Same rule: only the uploader or an organization manager or owner.
- `listBucketAttachments` — returns `{items, total}` across every source. Narrow it with `targets`
  (`app`, `note`, portal targets), `sizeFrom`, `createdFrom` and `createdTo` (date added, see below),
  `uploaderId` (only that user's uploads), `kinds` (`image`, `video`, `audio`, `doc`, `archive`, `file`)
  and `attributes`; `attachmentIds` (up to 100 `globalId`s) returns only those files and `urlExpiresIn`
  sets the lifetime of private links; page it with `limit` (max 100) and `offset`. A bad `uploaderId`, an unknown kind or
  `createdFrom` greater than `createdTo` is a 400.

Each item carries `target` (the source), `userId` (the uploader), `kind`, `size`, `attributes`,
`accessPrincipals`, `private`, `url`, `urlExpiresAt` and, for organization members, the bucket `permissions`. `type` holds the same value
as `kind` and is deprecated; read `kind`. Resolve the uploader email and role from
`userId` with the Gate org-users operations; bucket-service stores only the id.

### Attributes

Free string-to-string metadata, at most 50 keys, 255 characters per key and per value. Record at least:

| Key | Value |
|-----|-------|
| `source` | where the file came from, for example the app name |
| `uploaderEmail` | resolved from `userId` at upload time |
| `uploaderRole` | the uploader's organization role at upload time |

### Filtering by attributes

`listBucketAttachments` takes an `attributes` filter: a JSON object of strings, sent as a string.
Every pair must match the file exactly, and `total` counts the same filtered set. A malformed
string is a 400.

```typescript
// Files whose `source` attribute is exactly "app".
const filesApi = new FilesApi(createClient({ baseUrl, auth: { token } }));
const { items, total } = await filesApi.listBucketAttachments({
  path: { orgId },
  query: { attributes: JSON.stringify({ source: "app" }), limit: 50 },
});
```

### Filtering by date added

`createdFrom` and `createdTo` are unix seconds, the same unit as each item `createdAt`. Both bounds are
inclusive and either one can be sent alone. There are no server-side presets: compute Today, Last 7 days
or Last 30 days in the app from the user's local time and send the two numbers.

```typescript
// Files added in the last 7 days, counted from the start of today in the user's time zone.
const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);
const createdFrom = Math.floor(startOfToday.getTime() / 1000) - 6 * 24 * 60 * 60;
const createdTo = Math.floor(Date.now() / 1000);
const { items, total } = await filesApi.listBucketAttachments({
  path: { orgId },
  query: { createdFrom, createdTo, limit: 50 },
});
```

### Access principals

`accessPrincipals` is `{roles?, userIds?, groupIds?}` and only applies to `app` files. Note and portal files
keep their own bucket permissions. Gate filters the listing for the caller, so a client never sees a
file its access principals exclude, and the uploader always sees their own file.

| Visibility | `accessPrincipals` |
|------------|--------------|
| Team only | `{roles: ["owner", "manager", "member", "guest"]}` |
| All clients and team | omit it, or send `null` |
| Specific clients and groups, plus team | `{roles: ["owner", "manager", "member", "guest"], userIds: [...], groupIds: [...]}` |

Organization roles are `owner`, `manager`, `member` and `guest` for the team, and `client` for portal
clients. Leaving `guest` out of a team role list hides the file from guests. Listing every role,
`client` included, is the same as sending no access principals at all.

### Private files

By default an app file is public: its `url` does not expire (`urlExpiresAt` is `null`) and opens it for
anyone. `accessPrincipals` only hide it from the listing. Removing the file stops a link to the attachment
(it then gives 404), but older public links can keep opening the file after removal. So do not count on
removal to take back a public link saved in other places (dashboard `files` cells, notes, emails).
Send `private: true` to `createBucketAttachment` for files that only people who may see them should open,
or that must stop opening later (contracts, invoices, personal documents). Keep files public when visitors
who are not signed in must open them freely, or when the link is saved into other places, because a
private link expires.

- Tell a private file by its `private` field, not by the shape of its `url`.
- A private file's `url` is a signed link that opens the file for anyone holding it, signed in or not,
  until `urlExpiresAt` (unix seconds, at most 1 day). Hand it only to people who may see the file.
- Store the file's `globalId` in app data, never its `url`.
- To show files, use `url` from `listBucketAttachments`. For ids the app stored, call it with
  `attachmentIds` and fetch again before `urlExpiresAt`; `urlExpiresIn` (60 to 86400 seconds, default
  86400) gives shorter links.
- After the link expires it still opens for a signed-in Fusebase user who sees the file in the listing.
  Do not rely on that inside the app: browsers that block third-party cookies do not send the session.
  A visitor who is not signed in opens a private file only through a valid link.

```typescript
// Fresh links for files the app stored by globalId.
const { items } = await filesApi.listBucketAttachments({
  path: { orgId },
  query: { attachmentIds: storedIds, urlExpiresIn: 3600 },
});
const hrefById = new Map(items.map((item) => [item.globalId, item.url]));
```

## Display URLs

Every bucket attachment `url` is absolute, public or private: use it as is. Do not build it, do not prefix it,
and do not read ids out of it.

The host prefix below is only for a `relative url` (the note flow) and for old saved file descriptors. If the
upload API returns a `relative url` or a `file.url` that starts with `/` (a `/box/file` tail), prepend:

`https://app.thefusebase.com/box/file`

Never put a relative stored-file URL directly into an `<a href>`, image `src`, or persisted downstream `file descriptor.url`. Browsers resolve `/uuid/name.ext` against the current app host, which can point at the wrong service and return 404.

Example:

```typescript
function buildFileHref(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `https://app.thefusebase.com/box/file${url}`;
}
```

If Gate returns `readUrl`, use it as-is for reads, links, or image `src`. The same goes for every bucket
attachment `url`: never prefix it with a host or a proxy path.

## File Descriptor

A file descriptor is the object passed to downstream apps after upload. Include fields returned by the stored-file response when available:

- `name`
- `url`
- `type`
- `size`
- `globalId`
- `bucketId`
- `userId`
- `workspaceId`
- `storedFileUUID`
- `kind`

A private file's `url` expires, so do not hand it on in a file descriptor that is saved for later; pass its
`globalId` and let the reader fetch a fresh link. For `url`, store a display-ready URL. If the stored-file response gives a relative `file.url`, normalize it with `buildFileHref` before saving a new descriptor, and also apply the same helper when rendering already-saved descriptors so legacy relative URLs still open correctly.

The dashboard adapter uses this descriptor inside a `files` column value. Gate adapters may also expose `fileId`, `publicFileName`, and `readUrl`; those are Gate operation outputs, not a separate lifecycle.

## Handoffs

- Dashboard `files` column: use `fusebase-dashboards`; pass the file descriptor to `batchPutDashboardData`.
- Gate MCP/SDK upload operations: use `fusebase-gate`; it owns `createTempStoredFileUpload`, `startMultipartFileUpload`, `completeMultipartFileUpload`, `deleteFile`, `createBucketAttachment`, `updateBucketAttachment`, `removeBucketAttachment`, `listBucketAttachments`, and their auth/scope rules.

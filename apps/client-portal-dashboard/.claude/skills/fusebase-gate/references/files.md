---
version: "1.17.1"
mcp_prompt: files
last_synced: "2026-10-21"
title: "Fusebase Gate Files Flows"
category: specialized
---
# Fusebase Gate Files Flows

> **MARKER**: `mcp-files-loaded` — When this marker is present in context, MCP prompts for this topic may skip conceptual sections and use API reference only.

> **VERSION CHECK**: If operations fail unexpectedly, load MCP prompt `files` for latest content.

---
## Fusebase Gate Files Flows

This reference covers only Gate file operations and their auth/scope behavior. For the canonical low-level upload lifecycle, shared terminology, relative display URL normalization, and file descriptor construction, use `file-upload/references/upload-lifecycle.md`.

## Relevant Operations

- createTempStoredFileUpload: presign one PUT that uploads a whole file. Use it for anything small enough to send in a single request; use the multipart pair only when the file needs parts.
- startMultipartFileUpload: start a public file-service multipart upload and return direct PUT metadata.
- completeMultipartFileUpload: finish the file-service multipart upload from ETags and create the stored-file record. Gate maps file-service `storedFile.uuid` to response `storedFileUUID`; `fileId` is the same stored-file id alias. Use `storedFileUUID` for notes attachments. The returned `readUrl` is the public file URL.
- createBucketAttachment: turn an uploaded temp stored file into a bucket-service attachment in the organization's `app` bucket, so the file shows up in the organization file listing next to note and portal files. Needs an app token, from an app backend or from an app frontend through the app-api gate proxy. `private: true` keeps the file off public links.
- updateBucketAttachment: rename a bucket attachment or replace its `attributes` and `accessPrincipals`.
- removeBucketAttachment: remove a file of the organization, whatever its source. Only the uploader or an organization manager or owner may remove it.
- listBucketAttachments: list the organization's files from every source in one list — app uploads, note attachments and portal files — with their source, uploader, size, attributes and access. With `attachmentIds` it returns only those files, which is how an app gets fresh links for private files.

## Working Rules

- `createTempStoredFileUpload` requires only `name`. Send the bytes with one PUT to `uploadUrl`, using exactly the headers it returns in `headers` (`content-type` alone) and nothing else. The returned `tempStoredFileName` is then the input for whatever creates the record, for example `createBucketAttachment`.
- Upload a file into the app's own storage in two steps: `createTempStoredFileUpload` (or the multipart pair with `saveStoredFile: false`), then `createBucketAttachment` with the returned `tempStoredFileName`. Gate creates the attachment id, reads the app from the token, and puts the file in the organization `app` bucket.
- `attributes` is free key/value metadata on the file (max 50 keys, 255 chars per key and value), for example the uploader email or a category. `accessPrincipals` is who may see the file: `{roles, userIds, groupIds}`, where `groupIds` are organization group global ids (`listOrgGroups`). Leave `accessPrincipals` out to show the file to everyone who can see the organization bucket.
- `updateBucketAttachment` works on any file of the organization, but `accessPrincipals` only on app files. It replaces the whole `attributes` object when it is present, and `accessPrincipals: null` clears every restriction. Fields you do not send stay as they are. Only the uploader or an organization manager or owner may change `attributes` or `accessPrincipals`.
- `listBucketAttachments` returns `{items, total}`. Each item carries `target` (the source bucket), `userId` (the uploader — resolve the email and role with the org-users operations), `size` in bytes, `attributes`, `accessPrincipals` and, for organization members, the bucket `permissions`. Narrow it with `targets` (for example `app` or `note`), `sizeFrom`, `createdFrom` and `createdTo` (the date added, unix seconds like each item `createdAt`, both inclusive, either alone; the app turns presets like Last 7 days into these two numbers in the time zone of the user), `uploaderId` (only the files that user uploaded), `kinds` (`image`, `video`, `audio`, `doc`, `archive` or `file`, matched against each item `kind`) and `attributes`, page it with `limit` (max 100) and `offset`. `attributes` is a JSON object of strings sent as a string, for example `attributes: '{"source": "file-manager"}'`; every pair must match the file exactly, and `total` follows the same filter. A malformed one is a 400. Gate resolves the caller's organization role and groups itself, so an app token and a user session for the same person see the same files, and a client only sees what its access principals allow.
- **Private files**: send `private: true` to `createBucketAttachment` when only people who may see the file should open it (contracts, invoices, personal documents). Without it the file is public: its `url` does not expire (`urlExpiresAt` is null) and opens for anyone. Removing the file stops a link to the attachment (it then gives 404), but older public links can keep opening the file after removal. So do not count on removal to take back a public link saved in other places (dashboard cells, notes, emails): when a file must stop opening later, make it private. A private file's `url` is a signed link that opens the file for anyone holding it, signed in or not, until `urlExpiresAt` (unix seconds, at most 1 day): hand it only to people who may see the file.
- Every app file `url` is absolute, public or private. Use it as is: do not build it, do not prefix it with a host or a proxy path, and do not read ids out of it. Tell a private file by its `private` field, not by its `url`.
- For a private file, store its `globalId`, never its `url`. Before showing it, or before `urlExpiresAt`, get fresh links with `listBucketAttachments` and `attachmentIds` (up to 100 ids); `urlExpiresIn` sets their lifetime, 60 to 86400 seconds, default 86400.
- After a private link expires, it still opens for a signed-in Fusebase user who may see the file in the listing; visitors who are not signed in to Fusebase can open a private file only with a valid link. Do not rely on the signed-in fallback inside the app, because browsers that block third-party cookies do not send the session: refresh links instead.
- `completeMultipartFileUpload` accepts `saveStoredFile: false` to finish the upload without creating the stored-file record. The response then has `storedFileCreated: false`, null `fileId`/`storedFileUUID`, and `tempStoredFileName` to hand on.
- `startMultipartFileUpload` requires `filename` and byte `size`; `contentType` defaults to `application/octet-stream`, and `folder` defaults to `apps`.
- Gate never handles upload bytes. PUT the file bytes directly to the returned `uploadUrl` using the returned `method`.
- **Presigned URL headers rule**: the `headers` the upload operation returns are authoritative — send exactly those and nothing else. `createTempStoredFileUpload` returns `content-type`: the URL signs `host` alone, so that header is unsigned but still required, and it is what the stored object ends up with. When an operation returns no headers (multipart `uploadUrl` / `partsUrls` signed as `X-Amz-SignedHeaders=host`), send a bare PUT and add nothing that is not listed in `X-Amz-SignedHeaders`.
- In browser code, do not let the browser add `Content-Type` on its own: send an `ArrayBuffer`/raw bytes body rather than a typed `Blob`, and set the header only when the operation returned it. The bucket CORS policy allows `content-type` in the preflight; any other header fails the PUT as an opaque network error.
- A cross-origin browser `PUT` can still preflight because `PUT` is not a CORS simple method. Keep requested headers aligned with the presigned URL and bucket CORS policy.
- Capture the direct PUT response ETag, strip wrapping quotes if present, and send it to `completeMultipartFileUpload` as `parts: [{ etag, partNumber: 1 }]` for one-part uploads.
- Treat the temp upload name as `tempStoredFileName` in guidance and handoffs. Follow `tools_describe`/SDK schema for the exact request field name required by the current Gate contract.
- `completeMultipartFileUpload` creates the stored-file record after file-service finish succeeds unless `saveStoredFile` is false. Persist `storedFileUUID` as the canonical stored-file id, plus `publicFileName` and `readUrl`.
- Use the returned Gate `readUrl` for reads or image `src`. If another upload flow returns a relative `file.url` such as `/uuid/name.ext`, do not render or persist it as a browser href directly; normalize it through the file-upload display URL rule before saving descriptors or rendering existing descriptors.
- Use the returned `storedFileUUID` with notes `addWorkspaceNoteAttachment` to attach the file to a note.
- Do not send block ids, storage-provider-specific headers, a `Content-Type` the upload operation did not return, visibility, public URL, or read access mode fields.
- Do not describe dashboard `files` column payloads here; after Gate completion, hand off the file descriptor or `readUrl` to the owning skill.

## Access Model

- Upload and multipart flows require `files.write` and org access.
- An organization client holds `files.write`: it may upload and create bucket attachments, and may rename, change or remove only the files it uploaded (bucket-service answers 403 for anyone else's).
- Gate delegates upload URLs to file-service and returns `readUrl` from the completion flow; actual bytes never flow through Gate.

## Hard rules (attachments / app storage)

- **Never** store file bytes in isolated SQL (base64/`bytea`/data URL) as an alternative to this flow. SQL holds only `storedFileUUID` + `readUrl` (+ small metadata). No MVP exception — see MCP prompt **`isolatedSql`**.
- Needing **`files.write`** is **not** a reason to put attachments in the database. Sync permissions (`fusebase app update <appId> --sync-gate-permissions`) instead of changing storage architecture.
- **Visitor / anonymous / public-link apps:** browser visitor tokens usually **cannot** call `files.write` (org access). Broker the upload on the **app feature backend** with `process.env.FBS_FEATURE_TOKEN` (service token that already has `files.write`), then return `storedFileUUID` / `readUrl` to the client. Do not invent SQL blob storage because the skill looked browser-only.
---

## Version

- **Version**: 1.17.1
- **Category**: specialized
- **Last synced**: 2026-10-21
- **Priority rule**: If the MCP prompt has a higher version, follow the prompt's API Reference as source of truth.

/**
 * Files API
 *
 * Generated from contract introspection
 * Domain: files
 */

import type { Client } from "../runtime/transport";
import type {
  CompleteMultipartFileUploadRequestContract,
  CompleteMultipartFileUploadResponseContract,
  DeleteFileRequestContract,
  DeleteFileResponseContract,
  MultipartUploadIdInPathRequired,
  orgIdInPathRequired,
  StartMultipartFileUploadRequestContract,
  StartMultipartFileUploadResponseContract,
} from "../types";

export class FilesApi {
  constructor(private client: Client) {}

  /**
   * Complete multipart file upload
   * Finishes a public file-service multipart upload, then creates the stored-file record that downstream note attachment flows use. The response includes a stable public readUrl suitable for image src usage.
   */
  async completeMultipartFileUpload(params: {
    path: {
      orgId: orgIdInPathRequired;
      uploadId: MultipartUploadIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: CompleteMultipartFileUploadRequestContract;
  }): Promise<CompleteMultipartFileUploadResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/files/uploads/:uploadId/complete",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "completeMultipartFileUpload",
      expectedContentType: "application/json",
    });
  }

  /**
   * Delete file
   * Deletes a file-service stored file by stored-file UUID. Gate never handles the file bytes.
   */
  async deleteFile(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: DeleteFileRequestContract;
  }): Promise<DeleteFileResponseContract> {
    return this.client.request({
      method: "DELETE",
      path: "/:orgId/files",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "deleteFile",
      expectedContentType: "application/json",
    });
  }

  /**
   * Start multipart file upload
   * Starts a file-service multipart upload and returns direct PUT URLs. Clients upload each part to the returned URLs, keep each response ETag, and pass those ETags to completeMultipartFileUpload.
   */
  async startMultipartFileUpload(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: StartMultipartFileUploadRequestContract;
  }): Promise<StartMultipartFileUploadResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/files/uploads/start",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "startMultipartFileUpload",
      expectedContentType: "application/json",
    });
  }
}

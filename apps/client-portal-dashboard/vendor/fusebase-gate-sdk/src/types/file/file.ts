export type FileIdInPathRequired = string;
export type MultipartUploadIdInPathRequired = string;
export type FileUploadMethodContract = "PUT";

export interface StartMultipartFileUploadRequestContract {
  filename: string;
  size: number;
  contentType?: string | null;
  folder?: string | null;
}

export interface DeleteFileRequestContract {
  fileId: string;
}

export type FileUploadHeadersContract = Record<string, string>;

export interface DeleteFileResponseContract {
  fileId: string;
  deleted: boolean;
}

export interface StartMultipartFileUploadResponseContract {
  /**
   * File-service multipart upload id. Treat as opaque and send it back unchanged.
   */
  uploadId: string;
  fileId: string;
  /**
   * @format uri
   */
  uploadUrl: string;
  /**
   * @format uri
   */
  partsUrls: string[];
  partSize: number;
  method: FileUploadMethodContract;
  /**
   * Optional headers for the direct PUT request. For AWS presigned URLs, do not
   * add headers unless they are explicitly allowed by X-Amz-SignedHeaders.
   * If the URL has X-Amz-SignedHeaders=host, send no custom headers.
   */
  headers: FileUploadHeadersContract;
  tempStoredfileName: string;
  partNumber: number;
}

export interface CompleteMultipartFileUploadPartContract {
  etag: string;
  partNumber: number;
}

export interface CompleteMultipartFileUploadRequestContract {
  tempStoredfileName: string;
  parts: CompleteMultipartFileUploadPartContract[];
  contentType?: string | null;
  folder?: string | null;
}

export interface CompleteMultipartFileUploadResponseContract {
  fileId: string;
  storedFileUUID: string;
  /**
   * File-service public object name returned by finish multipart upload.
   */
  publicFileName: string;
  /**
   * Public URL built from the file-service public object name.
   * @format uri
   */
  readUrl: string;
  committed: boolean;
  partCount: number;
  filename: string;
  contentType: string;
  size: number;
  kind: string;
}

export const FileUploadMethodContract = {
  Put: "PUT"
} as const;

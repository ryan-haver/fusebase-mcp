import { schema } from "@fusebase-platform/contracts";
import type {
  CompleteMultipartFileUploadPartContract as CompleteMultipartFileUploadPartContractType,
  CompleteMultipartFileUploadRequestContract as CompleteMultipartFileUploadRequestContractType,
  CompleteMultipartFileUploadResponseContract as CompleteMultipartFileUploadResponseContractType,
  DeleteFileRequestContract as DeleteFileRequestContractType,
  DeleteFileResponseContract as DeleteFileResponseContractType,
  FileIdInPathRequired as FileIdInPathRequiredType,
  FileUploadHeadersContract as FileUploadHeadersContractType,
  FileUploadMethodContract as FileUploadMethodContractType,
  MultipartUploadIdInPathRequired as MultipartUploadIdInPathRequiredType,
  StartMultipartFileUploadRequestContract as StartMultipartFileUploadRequestContractType,
  StartMultipartFileUploadResponseContract as StartMultipartFileUploadResponseContractType,
} from "./file";

const FileIdInPathRequiredSchema = schema<FileIdInPathRequiredType>(
  "FileIdInPathRequired",
);
const MultipartUploadIdInPathRequiredSchema =
  schema<MultipartUploadIdInPathRequiredType>(
    "MultipartUploadIdInPathRequired",
  );
const FileUploadMethodContractSchema =
  schema<FileUploadMethodContractType>("FileUploadMethod");
const DeleteFileRequestContractSchema =
  schema<DeleteFileRequestContractType>("DeleteFileRequest");
const FileUploadHeadersContractSchema =
  schema<FileUploadHeadersContractType>("FileUploadHeaders");
const StartMultipartFileUploadRequestContractSchema =
  schema<StartMultipartFileUploadRequestContractType>(
    "StartMultipartFileUploadRequest",
  );
const StartMultipartFileUploadResponseContractSchema =
  schema<StartMultipartFileUploadResponseContractType>(
    "StartMultipartFileUploadResponse",
  );
const CompleteMultipartFileUploadRequestContractSchema =
  schema<CompleteMultipartFileUploadRequestContractType>(
    "CompleteMultipartFileUploadRequest",
  );
const CompleteMultipartFileUploadPartContractSchema =
  schema<CompleteMultipartFileUploadPartContractType>(
    "CompleteMultipartFileUploadPart",
  );
const CompleteMultipartFileUploadResponseContractSchema =
  schema<CompleteMultipartFileUploadResponseContractType>(
    "CompleteMultipartFileUploadResponse",
  );
const DeleteFileResponseContractSchema =
  schema<DeleteFileResponseContractType>("DeleteFileResponse");

export const FileSchemas = {
  FileIdInPathRequired: FileIdInPathRequiredSchema,
  MultipartUploadIdInPathRequired: MultipartUploadIdInPathRequiredSchema,
  FileUploadMethodContract: FileUploadMethodContractSchema,
  DeleteFileRequestContract: DeleteFileRequestContractSchema,
  FileUploadHeadersContract: FileUploadHeadersContractSchema,
  StartMultipartFileUploadRequestContract:
    StartMultipartFileUploadRequestContractSchema,
  StartMultipartFileUploadResponseContract:
    StartMultipartFileUploadResponseContractSchema,
  CompleteMultipartFileUploadRequestContract:
    CompleteMultipartFileUploadRequestContractSchema,
  CompleteMultipartFileUploadPartContract:
    CompleteMultipartFileUploadPartContractSchema,
  CompleteMultipartFileUploadResponseContract:
    CompleteMultipartFileUploadResponseContractSchema,
  DeleteFileResponseContract: DeleteFileResponseContractSchema,
} as const;

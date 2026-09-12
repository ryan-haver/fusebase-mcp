import { schema } from "@fusebase-platform/contracts";
import type {
  AddWorkspaceNoteAttachmentRequestContract as AddWorkspaceNoteAttachmentRequestContractType,
  AddWorkspaceNoteAttachmentResponseContract as AddWorkspaceNoteAttachmentResponseContractType,
  CreateWorkspaceNoteFolderRequestContract as CreateWorkspaceNoteFolderRequestContractType,
  CreateWorkspaceNoteFolderResponseContract as CreateWorkspaceNoteFolderResponseContractType,
  CreateWorkspaceNoteRequestContract as CreateWorkspaceNoteRequestContractType,
  CreateWorkspaceNoteResponseContract as CreateWorkspaceNoteResponseContractType,
  WorkspaceIdInPathRequired as WorkspaceIdInPathRequiredType,
  WorkspaceNoteAttachmentContract as WorkspaceNoteAttachmentContractType,
  WorkspaceNoteContentContract as WorkspaceNoteContentContractType,
  WorkspaceNoteContentFormatContract as WorkspaceNoteContentFormatContractType,
  WorkspaceNoteContentResponseContract as WorkspaceNoteContentResponseContractType,
  WorkspaceNoteFolderListResponseContract as WorkspaceNoteFolderListResponseContractType,
  WorkspaceNoteIdInPathRequired as WorkspaceNoteIdInPathRequiredType,
  WorkspaceNoteListResponseContract as WorkspaceNoteListResponseContractType,
  WorkspaceNoteParentIdInQueryOptional as WorkspaceNoteParentIdInQueryOptionalType,
  WorkspaceNoteSummaryContract as WorkspaceNoteSummaryContractType,
} from "./note";

const WorkspaceIdInPathRequiredSchema = schema<WorkspaceIdInPathRequiredType>(
  "WorkspaceIdInPathRequired",
);
const WorkspaceNoteIdInPathRequiredSchema =
  schema<WorkspaceNoteIdInPathRequiredType>("WorkspaceNoteIdInPathRequired");
const WorkspaceNoteParentIdInQueryOptionalSchema =
  schema<WorkspaceNoteParentIdInQueryOptionalType>(
    "WorkspaceNoteParentIdInQueryOptional",
  );
const WorkspaceNoteContentFormatContractSchema =
  schema<WorkspaceNoteContentFormatContractType>("WorkspaceNoteContentFormat");
const WorkspaceNoteSummaryContractSchema =
  schema<WorkspaceNoteSummaryContractType>("WorkspaceNoteSummary");
const WorkspaceNoteContentContractSchema =
  schema<WorkspaceNoteContentContractType>("WorkspaceNoteContent");
const WorkspaceNoteFolderListResponseContractSchema =
  schema<WorkspaceNoteFolderListResponseContractType>(
    "WorkspaceNoteFolderListResponse",
  );
const WorkspaceNoteListResponseContractSchema =
  schema<WorkspaceNoteListResponseContractType>("WorkspaceNoteListResponse");
const WorkspaceNoteContentResponseContractSchema =
  schema<WorkspaceNoteContentResponseContractType>(
    "WorkspaceNoteContentResponse",
  );
const CreateWorkspaceNoteFolderRequestContractSchema =
  schema<CreateWorkspaceNoteFolderRequestContractType>(
    "CreateWorkspaceNoteFolderRequest",
  );
const CreateWorkspaceNoteFolderResponseContractSchema =
  schema<CreateWorkspaceNoteFolderResponseContractType>(
    "CreateWorkspaceNoteFolderResponse",
  );
const CreateWorkspaceNoteRequestContractSchema =
  schema<CreateWorkspaceNoteRequestContractType>("CreateWorkspaceNoteRequest");
const CreateWorkspaceNoteResponseContractSchema =
  schema<CreateWorkspaceNoteResponseContractType>(
    "CreateWorkspaceNoteResponse",
  );
const AddWorkspaceNoteAttachmentRequestContractSchema =
  schema<AddWorkspaceNoteAttachmentRequestContractType>(
    "AddWorkspaceNoteAttachmentRequest",
  );
const WorkspaceNoteAttachmentContractSchema =
  schema<WorkspaceNoteAttachmentContractType>("WorkspaceNoteAttachment");
const AddWorkspaceNoteAttachmentResponseContractSchema =
  schema<AddWorkspaceNoteAttachmentResponseContractType>(
    "AddWorkspaceNoteAttachmentResponse",
  );

export const NoteSchemas = {
  WorkspaceIdInPathRequired: WorkspaceIdInPathRequiredSchema,
  WorkspaceNoteIdInPathRequired: WorkspaceNoteIdInPathRequiredSchema,
  WorkspaceNoteParentIdInQueryOptional:
    WorkspaceNoteParentIdInQueryOptionalSchema,
  WorkspaceNoteContentFormatContract: WorkspaceNoteContentFormatContractSchema,
  WorkspaceNoteSummaryContract: WorkspaceNoteSummaryContractSchema,
  WorkspaceNoteContentContract: WorkspaceNoteContentContractSchema,
  WorkspaceNoteFolderListResponseContract:
    WorkspaceNoteFolderListResponseContractSchema,
  WorkspaceNoteListResponseContract: WorkspaceNoteListResponseContractSchema,
  WorkspaceNoteContentResponseContract:
    WorkspaceNoteContentResponseContractSchema,
  CreateWorkspaceNoteFolderRequestContract:
    CreateWorkspaceNoteFolderRequestContractSchema,
  CreateWorkspaceNoteFolderResponseContract:
    CreateWorkspaceNoteFolderResponseContractSchema,
  CreateWorkspaceNoteRequestContract: CreateWorkspaceNoteRequestContractSchema,
  CreateWorkspaceNoteResponseContract:
    CreateWorkspaceNoteResponseContractSchema,
  AddWorkspaceNoteAttachmentRequestContract:
    AddWorkspaceNoteAttachmentRequestContractSchema,
  WorkspaceNoteAttachmentContract: WorkspaceNoteAttachmentContractSchema,
  AddWorkspaceNoteAttachmentResponseContract:
    AddWorkspaceNoteAttachmentResponseContractSchema,
} as const;

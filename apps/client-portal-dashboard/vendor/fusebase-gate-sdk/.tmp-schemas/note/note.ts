export type WorkspaceIdInPathRequired = string;
export type WorkspaceNoteIdInPathRequired = string;

export interface WorkspaceNoteSummaryContract {
  globalId: string;
  title?: string | null;
  parentId?: string | null;
}

export interface WorkspaceNoteContentContract extends WorkspaceNoteSummaryContract {
  md: string;
}

export interface WorkspaceNoteFolderListResponseContract {
  folders: WorkspaceNoteSummaryContract[];
}

export interface WorkspaceNoteListResponseContract {
  notes: WorkspaceNoteSummaryContract[];
}

export interface WorkspaceNoteContentResponseContract {
  note: WorkspaceNoteContentContract;
}

export type WorkspaceNoteParentIdInQueryOptional = string | null;
export type WorkspaceNoteContentFormatContract = "text" | "html";

export interface WorkspaceNoteListQueryContract {
  /**
   * Folder global id to list notes from. When omitted, gate defaults to `default`.
   */
  parentId?: WorkspaceNoteParentIdInQueryOptional;
}

export interface CreateWorkspaceNoteFolderRequestContract {
  title: string;
  /**
   * Parent folder global id. Defaults to `default`.
   */
  parentId?: string | null;
}

export interface CreateWorkspaceNoteFolderResponseContract {
  folder: WorkspaceNoteSummaryContract;
}

export interface CreateWorkspaceNoteRequestContract {
  title: string;
  /**
   * Parent folder global id. Defaults to `default`.
   */
  parentId?: string | null;
  /**
   * Optional initial text or html appended to the note after creation.
   */
  content?: string | null;
  /**
   * Content format used with `content`. Defaults to `text`.
   */
  format?: WorkspaceNoteContentFormatContract | null;
}

export interface CreateWorkspaceNoteResponseContract {
  note: WorkspaceNoteSummaryContract;
}

export interface AddWorkspaceNoteAttachmentRequestContract {
  /**
   * Stored-file UUID returned by completeMultipartFileUpload.
   */
  storedFileUUID: string;
}

export interface WorkspaceNoteAttachmentContract {
  globalId: string;
  displayName: string;
  mime?: string | null;
  type: string;
  storedFileUUID: string;
  size: number;
  inList: boolean;
}

export interface AddWorkspaceNoteAttachmentResponseContract {
  attachment: WorkspaceNoteAttachmentContract;
}

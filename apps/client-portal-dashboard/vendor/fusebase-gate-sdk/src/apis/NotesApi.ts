/**
 * Notes API
 *
 * Generated from contract introspection
 * Domain: notes
 */

import type { Client } from "../runtime/transport";
import type {
  AddWorkspaceNoteAttachmentRequestContract,
  AddWorkspaceNoteAttachmentResponseContract,
  CreateWorkspaceNoteFolderRequestContract,
  CreateWorkspaceNoteFolderResponseContract,
  CreateWorkspaceNoteRequestContract,
  CreateWorkspaceNoteResponseContract,
  orgIdInPathRequired,
  WorkspaceIdInPathRequired,
  WorkspaceNoteContentResponseContract,
  WorkspaceNoteFolderListResponseContract,
  WorkspaceNoteIdInPathRequired,
  WorkspaceNoteListResponseContract,
  WorkspaceNoteParentIdInQueryOptional,
} from "../types";

export class NotesApi {
  constructor(private client: Client) {}

  /**
   * Add workspace note attachment
   * Attaches a stored-file UUID from the files upload flow to a workspace note, then appends an image blot for image attachments or a file blot for all other attachment types. Prefer a real workspace id; when the path workspaceId is `default`, gate resolves it to the organization's default workspace before calling note-service and editor-server.
   */
  async addWorkspaceNoteAttachment(params: {
    path: {
      orgId: orgIdInPathRequired;
      workspaceId: WorkspaceIdInPathRequired;
      noteId: WorkspaceNoteIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: AddWorkspaceNoteAttachmentRequestContract;
  }): Promise<AddWorkspaceNoteAttachmentResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/workspaces/:workspaceId/notes/:noteId/attachments",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "addWorkspaceNoteAttachment",
      expectedContentType: "application/json",
    });
  }

  /**
   * Create workspace note
   * Creates a note in the requested workspace. Prefer a real workspace id; when the path workspaceId is `default`, gate resolves it to the organization's default workspace before calling note-service and editor-server. When parentId is omitted, gate uses `default`. Optional initial text or html can be appended after creation.
   */
  async createWorkspaceNote(params: {
    path: {
      orgId: orgIdInPathRequired;
      workspaceId: WorkspaceIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: CreateWorkspaceNoteRequestContract;
  }): Promise<CreateWorkspaceNoteResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/workspaces/:workspaceId/notes",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "createWorkspaceNote",
      expectedContentType: "application/json",
    });
  }

  /**
   * Create workspace note folder
   * Creates a folder in the requested workspace. Prefer a real workspace id; when the path workspaceId is `default`, gate resolves it to the organization's default workspace before calling note-service. When parentId is omitted, gate uses `default`.
   */
  async createWorkspaceNoteFolder(params: {
    path: {
      orgId: orgIdInPathRequired;
      workspaceId: WorkspaceIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: CreateWorkspaceNoteFolderRequestContract;
  }): Promise<CreateWorkspaceNoteFolderResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/workspaces/:workspaceId/notes/folders",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "createWorkspaceNoteFolder",
      expectedContentType: "application/json",
    });
  }

  /**
   * Read workspace note
   * Returns the note title, parent metadata, and md content for the requested workspace note. Prefer a real workspace id; when the path workspaceId is `default`, gate resolves it to the organization's default workspace before calling note-service and editor-server.
   */
  async getWorkspaceNote(params: {
    path: {
      orgId: orgIdInPathRequired;
      workspaceId: WorkspaceIdInPathRequired;
      noteId: WorkspaceNoteIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<WorkspaceNoteContentResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/workspaces/:workspaceId/notes/:noteId",
      pathParams: params.path,
      headers: params.headers,
      opId: "getWorkspaceNote",
      expectedContentType: "application/json",
    });
  }

  /**
   * List workspace note folders
   * Returns non-portal note folders for the requested workspace. Prefer a real workspace id; when the path workspaceId is `default`, gate resolves it to the organization's default workspace before calling note-service.
   */
  async listWorkspaceNoteFolders(params: {
    path: {
      orgId: orgIdInPathRequired;
      workspaceId: WorkspaceIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<WorkspaceNoteFolderListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/workspaces/:workspaceId/notes/folders",
      pathParams: params.path,
      headers: params.headers,
      opId: "listWorkspaceNoteFolders",
      expectedContentType: "application/json",
    });
  }

  /**
   * List workspace notes
   * Returns non-portal notes for the requested workspace and parent folder. Prefer a real workspace id; when the path workspaceId is `default`, gate resolves it to the organization's default workspace before calling note-service. When parentId is omitted, gate defaults to the workspace default folder id `default`.
   */
  async listWorkspaceNotes(params: {
    path: {
      orgId: orgIdInPathRequired;
      workspaceId: WorkspaceIdInPathRequired;
    };
    query?: {
      parentId?: WorkspaceNoteParentIdInQueryOptional;
    };
    headers?: Record<string, string>;
  }): Promise<WorkspaceNoteListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/workspaces/:workspaceId/notes",
      pathParams: params.path,
      query: params.query,
      headers: params.headers,
      opId: "listWorkspaceNotes",
      expectedContentType: "application/json",
    });
  }
}

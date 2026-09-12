/**
 * Portals API
 *
 * Generated from contract introspection
 * Domain: portals
 */

import type { Client } from "../runtime/transport";
import type {
  CreatePortalRequestContract,
  CreatePortalResponseContract,
  DuplicatePortalRequestContract,
  globalIdInPathRequired,
  InviteToPortalRequestContract,
  InviteToPortalResponseContract,
  ListPortalContentResponseContract,
  orgIdInPathRequired,
  OrgPortalListResponseContract,
  PortalDetailContract,
} from "../types";

export class PortalsApi {
  constructor(private client: Client) {}

  /**
   * Create a new portal
   * Creates a new portal under the given org and workspace. Returns portal details and one-time admin credentials for the portal customizer. Requires org.write and org access.
   */
  async createPortal(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: CreatePortalRequestContract;
  }): Promise<CreatePortalResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/portals",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "createPortal",
      expectedContentType: "application/json",
    });
  }

  /**
   * Duplicate an existing portal
   * Creates a new portal as a full copy of an existing portal: settings, theme, menu structure, pages, and content blocks are all copied. Returns portal details. Status is 'ready' immediately for P_SUB domains; 'pending' for custom/CNAME domains or if content copy is still in progress. Requires org.write access.
   */
  async duplicatePortal(params: {
    path: {
      orgId: orgIdInPathRequired;
      portalId: globalIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: DuplicatePortalRequestContract;
  }): Promise<CreatePortalResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/portals/:portalId/duplicate",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "duplicatePortal",
      expectedContentType: "application/json",
    });
  }

  /**
   * Get portal details
   * Returns detailed information for a single portal by ID. Requires portals.read access.
   */
  async getPortal(params: {
    path: {
      orgId: orgIdInPathRequired;
      globalId: globalIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<PortalDetailContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/portals/:globalId",
      pathParams: params.path,
      headers: params.headers,
      opId: "getPortal",
      expectedContentType: "application/json",
    });
  }

  /**
   * Invite a user to a portal
   * Invites a user (client, member, or manager) to a portal via a magic link. For orgRole='client' (default): isFullAccess controls access to private pages (default true). For orgRole='member' or 'manager': always full access, isFullAccess is ignored. Returns a magic link for direct portal access without email confirmation. Invarian — before calling this operation for a client invite (orgRole='client' or unspecified): ALWAYS ask the user 'Full access (all pages) or Shared only (public pages)?' and wait for their answer before proceeding. Do NOT silently assume a default.
   */
  async inviteToPortal(params: {
    path: {
      orgId: orgIdInPathRequired;
      portalId: globalIdInPathRequired;
    };
    headers?: Record<string, string>;
    body: InviteToPortalRequestContract;
  }): Promise<InviteToPortalResponseContract> {
    return this.client.request({
      method: "POST",
      path: "/:orgId/portals/:portalId/invite",
      pathParams: params.path,
      headers: params.headers,
      body: params.body,
      opId: "inviteToPortal",
      expectedContentType: "application/json",
    });
  }

  /**
   * List portal content (folders and pages)
   * Returns the menu tree of a portal: folders, note pages, portal pages, and system items. Use this operation to discover existing content before creating new folders or pages. Item types match portal-service values: notesFolder, note, portalPage, home, link, etc. For items of type 'note', the noteId field contains the Fusebase note id. Requires portals.read access.
   */
  async listPortalContent(params: {
    path: {
      orgId: orgIdInPathRequired;
      portalId: globalIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<ListPortalContentResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/portals/:portalId/content",
      pathParams: params.path,
      headers: params.headers,
      opId: "listPortalContent",
      expectedContentType: "application/json",
    });
  }

  /**
   * List organization portals
   * Returns portals visible for the caller in the organization. Requires portals.read and org access.
   */
  async listPortals(params: {
    path: {
      orgId: orgIdInPathRequired;
    };
    headers?: Record<string, string>;
  }): Promise<OrgPortalListResponseContract> {
    return this.client.request({
      method: "GET",
      path: "/:orgId/portals",
      pathParams: params.path,
      headers: params.headers,
      opId: "listPortals",
      expectedContentType: "application/json",
    });
  }
}

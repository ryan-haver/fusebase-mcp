/**
 * Fusebase API type definitions derived from HAR analysis
 */

// === Core Entities ===

export interface FusebaseWorkspace {
  orgId: string;
  workspaceId: string;
  color: string;
  title: string;
}

export interface FusebaseNote {
  globalId: string;
  parentId: string;
  createdAt: number;
  dateAdded: number;
  dateUpdated: number;
  updatedAt: number;
  type: "note" | "folder";
  role: string;
  title: string;
  url: string;
  shared: boolean;
  isSharedForPortal: boolean;
  favorite: boolean;
  lastChangeBy: number;
  cntNotes: number;
  size: number;
  editnote: boolean;
  isEncrypted: boolean;
  isCompleted: boolean;
  workspaceId: string;
  isImported: boolean;
  isFullwidth: boolean;
  userId: number;
  isReady: boolean;
  outliner: boolean;
  emoji: string;
  isPortalShare: boolean;
  id?: number;
}

export interface FusebaseFolder {
  type: string;
  id: string;
  parentId: string;
  hasChildren: boolean;
  name: string;
  icon: string;
  createdAt: number;
  updatedAt: number;
  isShared: boolean;
  children: FusebaseFolder[];
  index: number;
}

export interface FusebaseAttachment {
  id: number;
  globalId: string;
  displayName: string;
  mime: string;
  dateAdded: number;
  dateUpdated: number;
  noteGlobalId: string;
  type: string;
  role: string;
  extra: Record<string, unknown>;
  isScreenshot: boolean;
  size: number;
  inList: boolean;
  storedFileUUID: string;
  isEncrypted: boolean;
  workspaceId: string;
  userId: number;
  state: string;
}

export interface FusebaseFile {
  globalId: string;
  bucketId: string;
  target: string;
  targetId: string;
  workspaceId: string;
  filename: string;
  userId: number;
  size: number;
  deleted: boolean;
  format: string;
  createdAt: number;
  url: string;
  breadcrumbs: unknown;
  visible: boolean;
  type: string;
  extra: Record<string, unknown>;
}

export interface FusebaseMember {
  globalId: string;
  addedByUserId: number;
  userId: number;
  createdAt: number;
  updatedAt: number;
  workspaceId: string;
  type: string;
  role: string;
  encryptRole: string;
  privileges: string[];
  orgId: string;
}

export interface FusebaseOrgMember {
  globalId: string;
  orgId: string;
  userId: number;
  createdAt: number;
  updatedAt: number;
  role: string;
  user: {
    id: number;
    username: string;
    displayName: string;
    email: string;
    firstname: string;
    lastname: string;
  };
}

export interface FusebaseTag {
  workspaceId: string;
  tags: string[];
}

export interface FusebaseLabel {
  globalId: string;
  userId: number;
  workspaceId: string;
  title: string;
  color: string;
  style: string;
  createdAt: number;
  updatedAt: number;
  clock: number;
  deleted: boolean;
  kind: string;
}

export interface FusebaseTaskSearchResult {
  filters: Record<string, unknown>;
  offset: number;
  limit: number;
  total: number;
  tasks: FusebaseTask[];
  taskLists: unknown[];
  boards: unknown[];
  assigneeUserInfos: Record<string, unknown>;
  labelInfos: Record<string, unknown>;
  noteInfos: Record<string, unknown>;
}

export interface FusebaseTask {
  [key: string]: unknown;
}

export interface FusebaseCommentThread {
  threadId: string;
  noteId: string;
  resolved: boolean;
  comments: unknown[];
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

export interface FusebaseTaskList {
  globalId: string;
  workspaceId: string;
  noteId?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

export interface FusebaseCreateTaskPayload {
  title: string;
  taskListId: string;
  description?: string;
  assigneeIds?: number[];
  dueDate?: number;
  priority?: string;
  labelIds?: string[];
  [key: string]: unknown;
}

export interface FusebaseAgent {
  globalId: string;
  title: string;
  description?: string;
  type: string;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

export interface FusebaseMentionEntity {
  id: string;
  type: string;
  title: string;
  [key: string]: unknown;
}

export interface FusebaseNavMenuItem {
  type: string;
  id: string;
  parentId: string;
  hasChildren: boolean;
  name: string;
  icon?: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface FusebaseActivityItem {
  notes: unknown[];
  comments: unknown[];
  mentions: unknown[];
  users: Record<string, unknown>;
  avatars: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FusebaseTaskUsage {
  deadlineDates: unknown[];
  reminders: unknown[];
  [key: string]: unknown;
}

export interface FusebaseWorkspaceDetail {
  id: number;
  globalId: string;
  orgId: string;
  userId: number;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

export interface FusebaseWorkspaceInfo {
  orgId: string;
  quotaResetDate: string;
  dateNextQuotaReset: string;
  [key: string]: unknown;
}

export interface FusebaseWorkspaceEmail {
  workspaceId: string;
  notesEmail: string;
  userId: number;
  [key: string]: unknown;
}

export interface FusebaseOrgPermissions {
  workspaceMembers: unknown[];
  permissions: Record<string, unknown>;
  users: Record<string, unknown>;
  avatars: Record<string, unknown>;
  usage: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FusebaseOrgLimits {
  membersPerOrg: number;
  workspaces: number;
  storage: number;
  traffic: number;
  ai: number;
  transcribe: number;
  clients: number;
  guests: number;
  [key: string]: unknown;
}

export interface FusebaseUsageSummary {
  current: number;
  max: number;
  currentStorage: number;
  maxStorage: number;
  currentBlots: number;
  maxBlots: number;
  [key: string]: unknown;
}

export interface FusebaseOrgFeature {
  id: number;
  orgId: string;
  feature: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

export interface FusebasePortal {
  [key: string]: unknown;
}

export interface FusebasePortalPage {
  [key: string]: unknown;
}

export interface FusebaseDatabaseViewData {
  data: unknown[];
  meta: Record<string, unknown>;
  [key: string]: unknown;
}

// === API Response Wrappers ===

export interface NotesListResponse {
  items: FusebaseNote[];
  total: number;
}

export interface RecentNotesResponse {
  notes: FusebaseNote[];
  count: number;
}

export interface CreateNoteRequest {
  workspaceId: string;
  noteId: string;
  note: {
    textVersion: number;
    title: string;
    parentId: string;
    is_portal_share: boolean;
  };
}

export interface OrgUsageResponse {
  traffic: { current: number; max: number };
  storage: { current: number; max: number };
  workspaces: { current: number; max: number };
  members: { current: number; max: number; maxHard: number };
  guests: { current: number; max: number };
  clients: { current: number; max: number };
  ai: { current: number; max: number };
}

// === Config ===

export interface FusebaseConfig {
  host: string;
  orgId: string;
  cookie: string;
  autoRefresh?: boolean;
}

CREATE TABLE public.tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  portal_id TEXT,
  workspace_id TEXT,
  project_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tasks_org_id_idx ON public.tasks (org_id);
CREATE INDEX tasks_user_id_idx ON public.tasks (user_id);
CREATE INDEX tasks_portal_id_idx ON public.tasks (portal_id);
CREATE INDEX tasks_workspace_id_idx ON public.tasks (workspace_id);
CREATE INDEX tasks_project_id_idx ON public.tasks (project_id);

CREATE TABLE public.audit_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_org_id_idx ON public.audit_events (org_id);
CREATE INDEX audit_events_user_id_idx ON public.audit_events (user_id);

CREATE TABLE public.schema_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

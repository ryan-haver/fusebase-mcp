ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

CREATE POLICY tasks_read_scope ON public.tasks
  FOR SELECT
  USING (
    org_id = NULLIF(current_setting('app.org_id', true), '')
    AND (
      user_id = NULLIF(current_setting('app.user_id', true), '')
      OR portal_id = NULLIF(current_setting('app.portal_id', true), '')
      OR workspace_id = NULLIF(current_setting('app.workspace_id', true), '')
      OR project_id = NULLIF(current_setting('app.project_id', true), '')
    )
  );

CREATE POLICY tasks_write_scope ON public.tasks
  FOR ALL
  USING (
    org_id = NULLIF(current_setting('app.org_id', true), '')
    AND user_id = NULLIF(current_setting('app.user_id', true), '')
  )
  WITH CHECK (
    org_id = NULLIF(current_setting('app.org_id', true), '')
    AND user_id = NULLIF(current_setting('app.user_id', true), '')
  );

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_events_read_tenant ON public.audit_events
  FOR SELECT
  USING (org_id = NULLIF(current_setting('app.org_id', true), ''));

CREATE POLICY audit_events_insert_self ON public.audit_events
  FOR INSERT
  WITH CHECK (
    org_id = NULLIF(current_setting('app.org_id', true), '')
    AND user_id = NULLIF(current_setting('app.user_id', true), '')
  );

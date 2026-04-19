-- Requester gate before POST /verify (AI): executor submits → DB awaits approval → submitted → verify
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'task_status'
      AND e.enumlabel = 'awaiting_requester_review'
  ) THEN
    ALTER TYPE public.task_status ADD VALUE 'awaiting_requester_review';
  END IF;
END $$;

alter table public.tasks
  add column if not exists evidence_approved_at timestamptz;

comment on column public.tasks.evidence_approved_at is 'Set when requester approves evidence (REQUESTER_APPROVAL_BEFORE_VERIFY path); then status becomes submitted';

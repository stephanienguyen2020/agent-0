-- Execution Market — core schema (see docs/07-database-schema.md)

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "cube";
create extension if not exists "earthdistance" cascade;

-- Enums
create type category as enum (
  'physical_presence',
  'knowledge_access',
  'human_authority',
  'simple_action',
  'digital_physical'
);

create type task_status as enum (
  'published',
  'accepted',
  'in_progress',
  'submitted',
  'verifying',
  'verified',
  'completed',
  'disputed',
  'rejected',
  'expired',
  'cancelled',
  'refunded'
);

create type executor_type as enum ('human', 'ai_agent', 'robot');
create type verification_level as enum ('none', 'device', 'orb');
create type verifier_level as enum ('l1_auto', 'l2_ai', 'l3_agent', 'l4_arbitration');
create type dispute_status as enum ('open', 'under_review', 'resolved_executor', 'resolved_requester', 'withdrawn');
create type bid_status as enum ('active', 'accepted', 'rejected', 'withdrawn', 'expired');

-- Tables
create table agents (
  id                   uuid primary key default uuid_generate_v4(),
  erc8004_agent_id     numeric(78,0) unique not null,
  wallet               text not null,
  display_name         text,
  type                 executor_type not null default 'ai_agent',
  agent_metadata_uri   text,
  agent_metadata       jsonb,
  callback_url         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_agents_wallet on agents(wallet);
create index idx_agents_type on agents(type);

create table executors (
  id                   uuid primary key default uuid_generate_v4(),
  erc8004_agent_id     numeric(78,0) unique not null,
  type                 executor_type not null,
  wallet               text not null,
  display_name         text,
  regions              text[] not null default '{}',
  languages            text[] not null default '{}',
  specialties          category[] not null default '{}',
  verification_level   verification_level not null default 'none',
  score                bigint not null default 0,
  rating_bps           int not null default 0,
  tasks_completed      bigint not null default 0,
  tasks_disputed       bigint not null default 0,
  dispute_losses       bigint not null default 0,
  total_earned_micros  numeric(78,0) not null default 0,
  agent_metadata_uri   text,
  agent_metadata       jsonb,
  endpoint_url         text,
  capabilities         text[],
  service_area_lat     double precision,
  service_area_lng     double precision,
  service_area_radius_m int,
  active               boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_executors_type on executors(type);
create index idx_executors_wallet on executors(wallet);
create index idx_executors_regions on executors using gin(regions);
create index idx_executors_specialties on executors using gin(specialties);
create index idx_executors_score_desc on executors(score desc);

create table tasks (
  task_id              text primary key,
  agent_id             uuid not null references agents(id),
  executor_id          uuid references executors(id),
  category             category not null,
  title                text not null,
  instructions         text not null,
  bounty_micros        numeric(78,0) not null check (bounty_micros > 0),
  fee_micros           numeric(78,0) not null default 0,
  token                text not null default 'USDC',
  status               task_status not null default 'published',
  location_lat         double precision,
  location_lng         double precision,
  location_radius_m    int,
  deadline_at          timestamptz not null,
  accepted_at          timestamptz,
  submitted_at         timestamptz,
  verified_at          timestamptz,
  settled_at           timestamptz,
  evidence_schema      jsonb not null,
  executor_requirements jsonb not null,
  metadata             jsonb not null default '{}',
  escrow_address       text,
  on_chain_task_id     text,
  on_chain_tx_publish  text,
  on_chain_tx_accept   text,
  on_chain_tx_submit   text,
  on_chain_tx_release  text,
  on_chain_tx_refund   text,
  irc_channel          text,
  irc_synced_at        timestamptz,
  executor_types_allowed executor_type[] not null default '{human}',
  min_reputation_bps   int not null default 0,
  min_world_id_level   verification_level not null default 'none',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_tasks_status on tasks(status);
create index idx_tasks_category on tasks(category);
create index idx_tasks_agent on tasks(agent_id);
create index idx_tasks_executor on tasks(executor_id);
create index idx_tasks_deadline on tasks(deadline_at) where status in ('published','accepted','submitted');
create index idx_tasks_created_at on tasks(created_at desc);
create index idx_tasks_bounty_desc on tasks(bounty_micros desc) where status = 'published';
create index idx_tasks_title_trgm on tasks using gin(title gin_trgm_ops);

create table task_bids (
  id                  uuid primary key default uuid_generate_v4(),
  task_id             text not null references tasks(task_id) on delete cascade,
  executor_id         uuid not null references executors(id),
  executor_erc8004_id numeric(78,0) not null,
  rate_micros         numeric(78,0) not null,
  eta_minutes         int not null,
  credentials         text[] not null default '{}',
  message             text,
  status              bid_status not null default 'active',
  created_at          timestamptz not null default now(),
  unique(task_id, executor_id)
);

create index idx_bids_task on task_bids(task_id);
create index idx_bids_executor on task_bids(executor_id);
create index idx_bids_status on task_bids(status);

create table evidence (
  id                  uuid primary key default uuid_generate_v4(),
  task_id             text not null references tasks(task_id) on delete cascade,
  executor_id         uuid not null references executors(id),
  submission_index    int not null default 0,
  aggregate_sha256    text not null,
  greenfield_bucket   text not null,
  on_chain_tx_submit  text,
  submitted_at        timestamptz not null default now(),
  unique(task_id, submission_index)
);

create index idx_evidence_task on evidence(task_id);
create index idx_evidence_executor on evidence(executor_id);

create table evidence_items (
  id                  uuid primary key default uuid_generate_v4(),
  evidence_id         uuid not null references evidence(id) on delete cascade,
  item_index          int not null,
  filename            text not null,
  content_type        text not null,
  size_bytes          bigint not null,
  sha256              text not null,
  greenfield_url      text not null,
  perceptual_hash     text,
  exif_gps_lat        double precision,
  exif_gps_lng        double precision,
  exif_timestamp      timestamptz,
  exif_camera         text,
  unique(evidence_id, item_index)
);

create index idx_items_evidence on evidence_items(evidence_id);
create index idx_items_phash on evidence_items(perceptual_hash);
create index idx_items_sha256 on evidence_items(sha256);

create table verifications (
  id                  uuid primary key default uuid_generate_v4(),
  task_id             text not null references tasks(task_id) on delete cascade,
  evidence_id         uuid references evidence(id) on delete set null,
  level               verifier_level not null,
  passed              boolean not null,
  confidence          double precision,
  reason              text,
  raw                 jsonb not null default '{}',
  verifier_identity   text,
  gemini_tokens_used  int,
  cost_usd            double precision,
  created_at          timestamptz not null default now()
);

create index idx_verifications_task on verifications(task_id);
create index idx_verifications_level on verifications(level);
create index idx_verifications_passed on verifications(passed);

create table disputes (
  id                  uuid primary key default uuid_generate_v4(),
  task_id             text not null references tasks(task_id) on delete cascade,
  raised_by           text not null,
  raised_by_wallet    text not null,
  reason              text not null,
  status              dispute_status not null default 'open',
  arbitration_case_id text,
  resolution          text,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index idx_disputes_task on disputes(task_id);
create index idx_disputes_status on disputes(status);

create table reputation_events (
  id                  uuid primary key default uuid_generate_v4(),
  executor_id         uuid not null references executors(id),
  erc8004_agent_id    numeric(78,0) not null,
  event_type          text not null,
  delta_score         int not null,
  source_task_id      text references tasks(task_id),
  source_category     category,
  earned_micros       numeric(78,0),
  on_chain_tx         text,
  created_at          timestamptz not null default now()
);

create index idx_repevents_executor on reputation_events(executor_id);
create index idx_repevents_created on reputation_events(created_at desc);

create table world_id_proofs (
  id                  uuid primary key default uuid_generate_v4(),
  wallet              text not null unique,
  nullifier_hash      text not null unique,
  merkle_root         text not null,
  verification_level  verification_level not null,
  action              text not null,
  verified_at         timestamptz not null default now()
);

create index idx_worldid_nullifier on world_id_proofs(nullifier_hash);
create index idx_worldid_wallet on world_id_proofs(wallet);

create table agent_transactions (
  id                  uuid primary key default uuid_generate_v4(),
  agent_id            text not null,
  transaction_type    text not null,
  category            text not null,
  amount              numeric(18,6) not null default 0,
  tx_hash             text,
  contract_address    text,
  function_name       text,
  details             jsonb,
  created_at          timestamptz not null default now()
);

create index idx_agent_tx_agent on agent_transactions(agent_id, created_at desc);
create index idx_agent_tx_type on agent_transactions(transaction_type);

create table irc_bot_state (
  bot_nick            text primary key,
  server              text not null,
  last_message_id     text,
  last_synced_at      timestamptz,
  channels            text[] not null default '{}',
  metadata            jsonb default '{}'
);

create table idempotency_keys (
  key                 text primary key,
  wallet              text not null,
  method              text not null,
  path                text not null,
  body_sha256         text not null,
  response_status     int,
  response_body       jsonb,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '24 hours')
);

create index idx_idemp_expires on idempotency_keys(expires_at);

-- Triggers
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

create trigger trg_tasks_updated before update on tasks
  for each row execute function touch_updated_at();
create trigger trg_agents_updated before update on agents
  for each row execute function touch_updated_at();
create trigger trg_executors_updated before update on executors
  for each row execute function touch_updated_at();

create or replace function apply_reputation_event() returns trigger as $$
begin
  update executors
    set
      score = score + new.delta_score,
      tasks_completed = tasks_completed + case when new.event_type = 'completion' then 1 else 0 end,
      tasks_disputed = tasks_disputed + case when new.event_type in ('dispute_win','dispute_loss') then 1 else 0 end,
      dispute_losses = dispute_losses + case when new.event_type = 'dispute_loss' then 1 else 0 end,
      total_earned_micros = total_earned_micros + coalesce(new.earned_micros, 0),
      updated_at = now()
    where id = new.executor_id;
  return new;
end $$ language plpgsql;

create trigger trg_reputation_apply after insert on reputation_events
  for each row execute function apply_reputation_event();

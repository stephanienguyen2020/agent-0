-- Agent executor onboarding: wallet-signed challenges (alternative to World ID for ai_agent / robot).

alter table executors
  add column if not exists wallet_proof_verified_at timestamptz;

comment on column executors.wallet_proof_verified_at is
  'Set when executor completes POST /api/v1/executors/agent-verify (non-human lane).';

create table if not exists agent_executor_challenges (
  id                   uuid primary key default gen_random_uuid(),
  wallet               text not null,
  erc8004_agent_id     numeric(78,0) not null,
  nonce                text not null unique,
  expires_at           timestamptz not null,
  created_at           timestamptz not null default now()
);

create index if not exists idx_agent_exec_challenges_wallet on agent_executor_challenges(wallet);
create index if not exists idx_agent_exec_challenges_expires on agent_executor_challenges(expires_at);

alter table agent_executor_challenges enable row level security;

-- Audit trail for successful wallet proofs (service role inserts).
create table if not exists agent_wallet_proofs (
  id                   uuid primary key default gen_random_uuid(),
  wallet               text not null,
  erc8004_agent_id     numeric(78,0) not null,
  nonce                text not null,
  message_hash         text not null,
  signature            text not null,
  verified_at          timestamptz not null default now()
);

create index if not exists idx_agent_wallet_proofs_wallet on agent_wallet_proofs(wallet);

alter table agent_wallet_proofs enable row level security;

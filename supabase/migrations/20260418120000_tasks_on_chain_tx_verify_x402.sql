-- Persist markVerified tx and x402 EIP-3009 settle for GET /tasks and UI.
alter table public.tasks
  add column if not exists on_chain_tx_verify text,
  add column if not exists on_chain_tx_x402_settle text;

comment on column public.tasks.on_chain_tx_verify is 'EMEscrow.markVerified tx hash';
comment on column public.tasks.on_chain_tx_x402_settle is 'x402 EIP-3009 settle to escrow tx (before publishTaskX402)';

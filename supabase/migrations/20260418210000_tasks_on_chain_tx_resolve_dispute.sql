-- EMEscrow.resolveDispute(taskId, executorWins) tx hash (operator resolution path)
alter table public.tasks
  add column if not exists on_chain_tx_resolve_dispute text;

comment on column public.tasks.on_chain_tx_resolve_dispute is 'EMEscrow.resolveDispute(taskId, executorWins) tx hash';

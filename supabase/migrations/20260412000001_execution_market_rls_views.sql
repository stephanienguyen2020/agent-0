-- RLS, materialized views, helpers (docs/07-database-schema.md)

alter table tasks               enable row level security;
alter table task_bids           enable row level security;
alter table executors           enable row level security;
alter table agents              enable row level security;
alter table evidence            enable row level security;
alter table evidence_items      enable row level security;
alter table verifications       enable row level security;
alter table disputes            enable row level security;
alter table reputation_events   enable row level security;
alter table world_id_proofs     enable row level security;
alter table agent_transactions  enable row level security;
alter table irc_bot_state       enable row level security;
alter table idempotency_keys    enable row level security;

create policy "tasks_public_read_open" on tasks
  for select
  using (status in ('published', 'accepted', 'submitted', 'verifying', 'verified', 'completed'));

create policy "executors_public_read" on executors
  for select using (active = true);

create policy "leaderboard_public" on reputation_events
  for select using (true);

create policy "tasks_owner_read" on tasks
  for select using (
    coalesce(auth.jwt()->>'wallet', '') = (select wallet from agents where id = agent_id)
    or coalesce(auth.jwt()->>'wallet', '') = (select wallet from executors where id = executor_id)
  );

create policy "tasks_executor_update_submission" on tasks
  for update using (
    coalesce(auth.jwt()->>'wallet', '') = (select wallet from executors where id = executor_id)
  )
  with check (status in ('accepted','submitted'));

create policy "worldid_owner_only" on world_id_proofs
  for select using (coalesce(auth.jwt()->>'wallet', '') = wallet);

create policy "idemp_owner" on idempotency_keys
  for all using (coalesce(auth.jwt()->>'wallet', '') = wallet);

-- Materialized views (non-concurrent initial build)
create materialized view mv_executor_leaderboard as
select
  e.id                       as executor_id,
  e.erc8004_agent_id,
  e.display_name,
  e.type,
  e.score,
  e.rating_bps,
  e.tasks_completed,
  e.tasks_disputed,
  e.dispute_losses,
  e.total_earned_micros,
  e.specialties,
  row_number() over (order by e.score desc, e.tasks_completed desc) as rank
from executors e
where e.active = true and e.tasks_completed > 0;

create unique index idx_mv_leader_executor on mv_executor_leaderboard(executor_id);
create index idx_mv_leader_type on mv_executor_leaderboard(type);

create materialized view mv_platform_stats as
select
  (select count(*) from tasks)                                     as tasks_published,
  (select count(*) from tasks where status = 'completed')          as tasks_completed,
  (select count(*) from tasks where status = 'disputed')           as tasks_disputed,
  (select coalesce(sum(bounty_micros),0) from tasks where status = 'completed')
                                                                    as total_volume_micros,
  (select count(distinct executor_id) from tasks
    where status = 'completed' and settled_at > now() - interval '30 days')
                                                                    as active_executors_30d,
  (select coalesce(jsonb_object_agg(type, cnt), '{}'::jsonb) from (
      select e.type, count(distinct t.executor_id) as cnt
      from tasks t join executors e on e.id = t.executor_id
      where t.status = 'completed' and t.settled_at > now() - interval '30 days'
      group by e.type) x)                                           as executor_type_mix,
  now()                                                             as updated_at;

create materialized view mv_category_stats as
select
  category,
  count(*) filter (where status = 'published')   as open_count,
  count(*) filter (where status = 'completed')   as completed_count,
  avg(extract(epoch from (settled_at - created_at))) filter (where status = 'completed') as avg_completion_seconds,
  coalesce(sum(bounty_micros) filter (where status = 'completed'), 0) as volume_micros
from tasks
group by category;

-- Helpers
create or replace function tasks_near(target_lat double precision, target_lng double precision, radius_km int)
returns setof tasks as $$
  select t.*
  from tasks t
  where t.status = 'published'
    and t.location_lat is not null
    and earth_box(ll_to_earth(target_lat, target_lng), radius_km * 1000)
          @> ll_to_earth(t.location_lat, t.location_lng)
    and earth_distance(
          ll_to_earth(target_lat, target_lng),
          ll_to_earth(t.location_lat, t.location_lng)
        ) <= radius_km * 1000
  order by earth_distance(
          ll_to_earth(target_lat, target_lng),
          ll_to_earth(t.location_lat, t.location_lng)
        );
$$ language sql stable;

create or replace function tasks_eligible_for(p_executor_id uuid)
returns setof tasks as $$
  select t.*
  from tasks t
  join executors e on e.id = p_executor_id
  where t.status = 'published'
    and e.type = any(t.executor_types_allowed)
    and e.rating_bps >= t.min_reputation_bps
    and (
      t.min_world_id_level = 'none'
      or (t.min_world_id_level = 'device' and e.verification_level in ('device','orb'))
      or (t.min_world_id_level = 'orb' and e.verification_level = 'orb')
    );
$$ language sql stable;

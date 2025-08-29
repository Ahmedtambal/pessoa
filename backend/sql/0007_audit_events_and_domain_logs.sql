-- Unified audit and domain logs

create table if not exists audit_events (
    id uuid primary key default gen_random_uuid(),
    occurred_at timestamptz not null default now(),
    action_type text not null,
    status text not null default 'SUCCESS',
    actor_user_id uuid,
    actor_email_snapshot text,
    actor_org_id_snapshot uuid,
    actor_org_name_snapshot text,
    target_type text,
    target_id text,
    ip_address inet,
    user_agent text,
    metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_audit_events_time on audit_events(occurred_at desc);
create index if not exists idx_audit_events_action on audit_events(action_type);
create index if not exists idx_audit_events_actor on audit_events(actor_user_id);
create index if not exists idx_audit_events_org on audit_events(actor_org_id_snapshot);

-- Domain logs referencing audit_events
create table if not exists jd_generations (
    id uuid primary key default gen_random_uuid(),
    event_id uuid references audit_events(id) on delete cascade,
    model text,
    input_len int,
    output_len int,
    prompt_hash text,
    duration_ms int,
    status text,
    error text
);

create table if not exists resume_events (
    id uuid primary key default gen_random_uuid(),
    event_id uuid references audit_events(id) on delete cascade,
    action text not null check (action in ('UPLOAD','DELETE')),
    resume_id uuid,
    file_name text,
    file_size int,
    storage_path text,
    status text,
    error text
);

create table if not exists cv_compare_runs (
    id uuid primary key default gen_random_uuid(),
    event_id uuid references audit_events(id) on delete cascade,
    jd_len int,
    num_files int,
    files jsonb,
    model text,
    output_len int,
    duration_ms int,
    status text,
    error text
);

-- Cookie consent enrichments
alter table if exists cookie_consent_log
    add column if not exists actor_email_snapshot text,
    add column if not exists actor_org_name_snapshot text;



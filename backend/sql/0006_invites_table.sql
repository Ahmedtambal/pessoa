-- Invites (whitelist-based) table
-- Stores one-time invite codes that are approved by an admin

create table if not exists invites (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    email text not null,
    organization_name text,
    organization_id uuid,
    role text default 'MEMBER' check (role in ('ADMIN','MEMBER')),
    status text default 'PENDING' check (status in ('PENDING','REDEEMED','REVOKED','EXPIRED')),
    created_by uuid,
    created_at timestamptz default now(),
    expires_at timestamptz,
    used_by uuid,
    used_at timestamptz
);

create index if not exists idx_invites_email on invites(email);
create index if not exists idx_invites_code on invites(code);
create index if not exists idx_invites_status on invites(status);



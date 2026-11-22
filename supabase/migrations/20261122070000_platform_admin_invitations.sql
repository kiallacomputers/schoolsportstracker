create table if not exists public.platform_admin_invitations(
 id uuid primary key default gen_random_uuid(),
 email text not null,
 token_hash text not null unique,
 expires_at timestamptz not null,
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.platform_admin_invitations enable row level security;
drop policy if exists platform_admin_invites_read on public.platform_admin_invitations;
create policy platform_admin_invites_read on public.platform_admin_invitations for select to authenticated using (public.is_platform_admin());
grant select on public.platform_admin_invitations to authenticated;
create or replace function public.issue_platform_admin_invitation(p_email text) returns text
language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(trim(p_email));v_token text;
begin
 if not public.is_platform_admin() then raise exception 'Platform Administrator required'; end if;
 if length(v_email)>254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email'; end if;
 if exists(select 1 from public.platform_admins pa join auth.users u on u.id=pa.user_id where lower(u.email)=v_email) then raise exception 'This user is already a Platform Administrator'; end if;
 update public.platform_admin_invitations set revoked_at=now() where email=v_email and accepted_at is null and revoked_at is null;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.platform_admin_invitations(email,token_hash,expires_at,created_by)
 values(v_email,encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '7 days',auth.uid());
 return v_token;
end $$;
create or replace function public.accept_platform_admin_invitation(p_token text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_inv public.platform_admin_invitations%rowtype;v_email text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if v_email is null then raise exception 'Confirm your email before accepting the invitation'; end if;
 select * into v_inv from public.platform_admin_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at<=now() then raise exception 'Invitation is invalid or expired'; end if;
 if v_inv.email<>v_email then raise exception 'Sign in using the invited email address'; end if;
 insert into public.platform_admins(user_id) values(auth.uid()) on conflict do nothing;
 update public.platform_admin_invitations set accepted_at=now() where id=v_inv.id;
 return true;
end $$;
revoke all on function public.issue_platform_admin_invitation(text),public.accept_platform_admin_invitation(text) from public,anon;
grant execute on function public.issue_platform_admin_invitation(text),public.accept_platform_admin_invitation(text) to authenticated;
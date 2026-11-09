-- ============================================================
-- UPDATE for an EXISTING database (you already ran schema.sql before).
-- Run this ONCE in Supabase -> SQL Editor -> New query. Do NOT re-run schema.sql.
-- Adds: 3 contact details, saved contact settings, account deletion.
-- ============================================================

-- 1. contact details (profile defaults + per-report contacts)
alter table public.profiles add column if not exists contact_1 text not null default '';
alter table public.profiles add column if not exists contact_2 text not null default '';
alter table public.profiles add column if not exists contact_3 text not null default '';
alter table public.items    add column if not exists contact_2 text not null default '';
alter table public.items    add column if not exists contact_3 text not null default '';

revoke update on public.profiles from authenticated, anon;
grant update (full_name, contact_1, contact_2, contact_3) on public.profiles to authenticated;

-- 2. deleting an account also deletes that person's reports and claims
alter table public.items  drop constraint if exists items_reported_by_fkey;
alter table public.items  add constraint items_reported_by_fkey
  foreign key (reported_by) references public.profiles(id) on delete cascade;
alter table public.claims drop constraint if exists claims_claimant_id_fkey;
alter table public.claims add constraint claims_claimant_id_fkey
  foreign key (claimant_id) references public.profiles(id) on delete cascade;

-- allow removing photos: own folder, or any folder for admins (account cleanup)
drop policy if exists "photos delete own" on storage.objects;
create policy "photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos admin delete" on storage.objects;
create policy "photos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and coalesce(public.app_role(), '') = 'admin');

-- ACCOUNT DELETION ---------------------------------------------
-- Internal helper: removes the login (auth.users). The profile, that person's reports
-- and claims go with it (ON DELETE CASCADE). Not callable from the website directly.
create or replace function public.purge_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- items waiting on this person's claim go back to "found" so they are not stuck on "pending"
  update public.items i set status = 'found'
  where i.status = 'pending'
    and exists (select 1 from public.claims c where c.item_id = i.id and c.claimant_id = p_user and c.status = 'pending')
    and not exists (select 1 from public.claims c where c.item_id = i.id and c.claimant_id <> p_user and c.status = 'pending');
  delete from auth.users where id = p_user;
end $$;
revoke all on function public.purge_user(uuid) from public, anon, authenticated;

-- A signed-in person deletes their own account
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if public.app_role() = 'admin'
     and not exists (select 1 from public.profiles where role = 'admin' and id <> auth.uid()) then
    raise exception 'You are the only admin. Make someone else an admin before deleting your account.';
  end if;
  perform public.purge_user(auth.uid());
end $$;

-- An admin deletes someone else's account
create or replace function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.app_role(), '') <> 'admin' then raise exception 'Not allowed'; end if;
  if p_user = auth.uid() then raise exception 'Use the Profile page to delete your own account'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'User not found'; end if;
  perform public.purge_user(p_user);
end $$;

revoke all on function public.delete_my_account(), public.admin_delete_user(uuid) from public, anon;
grant execute on function public.delete_my_account(), public.admin_delete_user(uuid) to authenticated;

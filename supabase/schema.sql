-- ============================================================
-- Campus Lost & Found — run ONCE in Supabase → SQL Editor → New query
-- 3 roles: user (student/faculty/staff), staff (verifies claims), admin (everything)
-- ============================================================
create extension if not exists pg_trgm with schema extensions;

-- PROFILES ---------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  contact_1 text not null default '',
  contact_2 text not null default '',
  contact_3 text not null default '',
  role text not null default 'user' check (role in ('user','staff','admin')),
  created_at timestamptz not null default now()
);

create function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
create policy "read own or staff" on public.profiles for select to authenticated
  using (id = auth.uid() or coalesce(public.app_role(), '') in ('staff','admin'));
create policy "update own row" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- users may only ever change their own name, never their role
revoke update on public.profiles from authenticated, anon;
grant update (full_name, contact_1, contact_2, contact_3) on public.profiles to authenticated;

-- ITEMS ------------------------------------------------------
create table public.items (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null,
  status text not null check (status in ('lost','found','pending','recovered')),
  location text not null,
  item_date date not null default current_date,
  description text not null,
  contact text not null,
  contact_2 text not null default '',
  contact_3 text not null default '',
  image_url text,
  reported_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reporter_name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.items enable row level security;
create policy "signed-in can read" on public.items for select to authenticated using (true);
create policy "report own item" on public.items for insert to authenticated
  with check (reported_by = auth.uid() and status in ('lost','found'));
create policy "staff update" on public.items for update to authenticated
  using (coalesce(public.app_role(), '') in ('staff','admin'));
create policy "admin delete" on public.items for delete to authenticated
  using (coalesce(public.app_role(), '') = 'admin');

-- CLAIMS -----------------------------------------------------
create table public.claims (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.items(id) on delete cascade,
  claimant_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  claimant_name text not null,
  contact text not null,
  notes text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  match_score int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.claims enable row level security;
create policy "own or staff read" on public.claims for select to authenticated
  using (claimant_id = auth.uid() or coalesce(public.app_role(), '') in ('staff','admin'));
-- no insert/update policies: claims are only changed through the functions below

-- ACTIVITY FEED ---------------------------------------------
create table public.activity (
  id bigint generated always as identity primary key,
  action text not null, item_name text not null, color text not null,
  created_at timestamptz not null default now()
);
alter table public.activity enable row level security;
create policy "signed-in can read" on public.activity for select to authenticated using (true);

create function public.log_activity(p_action text, p_item text, p_color text) returns void
language sql security definer set search_path = public as $$
  insert into public.activity (action, item_name, color) values (p_action, p_item, p_color);
$$;
revoke all on function public.log_activity(text, text, text) from public, anon, authenticated;

create function public.on_item_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.log_activity(
    case when new.status = 'lost' then 'New lost item reported' else 'New found item reported' end,
    new.name,
    case when new.status = 'lost' then 'bg-red-500' else 'bg-emerald-500' end);
  return new;
end $$;
create trigger items_after_insert after insert on public.items
  for each row execute function public.on_item_insert();

-- STORAGE (item photos) --------------------------------------
insert into storage.buckets (id, name, public) values ('item-images', 'item-images', true)
  on conflict (id) do nothing;
create policy "photos public read" on storage.objects for select
  using (bucket_id = 'item-images');
create policy "photos upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- FUNCTIONS (business rules enforced on the server) -----------
-- Someone found an item that was reported lost
create function public.mark_found(p_item_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.items set status = 'found'
    where id = p_item_id and status = 'lost' and reported_by <> auth.uid()
    returning name into v_name;
  if not found then raise exception 'This item cannot be marked as found'; end if;
  perform public.log_activity('Item marked as found', v_name, 'bg-emerald-500');
end $$;

-- Ownership claim; match_score = how closely the proof text matches the report (advisory only)
create function public.submit_claim(p_item_id bigint, p_name text, p_contact text, p_notes text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare it public.items; v_score int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into it from public.items where id = p_item_id for update;
  if it.id is null or it.status <> 'found' then raise exception 'Item is not available for claim'; end if;
  if it.reported_by = auth.uid() then raise exception 'You cannot claim an item you reported'; end if;
  v_score := round(100 * word_similarity(lower(p_notes), lower(it.name || ' ' || it.description)));
  insert into public.claims (item_id, claimant_name, contact, notes, match_score)
    values (p_item_id, p_name, p_contact, p_notes, v_score);
  update public.items set status = 'pending' where id = p_item_id;
  perform public.log_activity('Claim submitted for', it.name, 'bg-yellow-500');
end $$;

-- Staff/admin approve or reject a claim
create function public.resolve_claim(p_claim_id bigint, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c public.claims; v_name text;
begin
  if coalesce(public.app_role(), '') not in ('staff','admin') then raise exception 'Not allowed'; end if;
  select * into c from public.claims where id = p_claim_id and status = 'pending' for update;
  if c.id is null then raise exception 'Claim not found or already handled'; end if;
  select name into v_name from public.items where id = c.item_id;
  if p_approve then
    update public.claims set status = 'approved' where id = c.id;
    update public.claims set status = 'rejected' where item_id = c.item_id and id <> c.id and status = 'pending';
    update public.items set status = 'recovered' where id = c.item_id;
    perform public.log_activity('Item successfully recovered', v_name, 'bg-indigo-500');
  else
    update public.claims set status = 'rejected' where id = c.id;
    if not exists (select 1 from public.claims where item_id = c.item_id and status = 'pending') then
      update public.items set status = 'found' where id = c.item_id;
    end if;
    perform public.log_activity('Claim rejected for', v_name, 'bg-red-500');
  end if;
end $$;

-- Admin changes someone's role
create function public.set_user_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.app_role(), '') <> 'admin' then raise exception 'Not allowed'; end if;
  if p_role not in ('user','staff','admin') then raise exception 'Invalid role'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own role'; end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

-- Intelligent matching: ranks opposite-type reports by category, location,
-- date closeness and text similarity (pg_trgm). Suggestion only — staff still verify.
create function public.suggest_matches(p_item_id bigint)
returns table (id bigint, name text, status text, location text, score int)
language sql stable security definer set search_path = public, extensions as $$
  select m.id, m.name, m.status, m.location, m.score from (
    select o.id, o.name, o.status, o.location,
      least(100, (
        (case when o.category = i.category then 30 else 0 end)
        + (case when o.location = i.location then 20 else 0 end)
        + round(10 * greatest(0, 1 - abs(o.item_date - i.item_date) / 14.0))
        + round(40 * similarity(lower(o.name || ' ' || o.description), lower(i.name || ' ' || i.description)))
      ))::int as score
    from public.items i
    join public.items o on o.id <> i.id
      and o.status = case i.status when 'lost' then 'found' when 'found' then 'lost' end
    where i.id = p_item_id and auth.uid() is not null
  ) m
  where m.score >= 30 order by m.score desc limit 5;
$$;

revoke all on function public.mark_found(bigint), public.submit_claim(bigint, text, text, text),
  public.resolve_claim(bigint, boolean), public.set_user_role(uuid, text),
  public.suggest_matches(bigint) from public, anon;
grant execute on function public.mark_found(bigint), public.submit_claim(bigint, text, text, text),
  public.resolve_claim(bigint, boolean), public.set_user_role(uuid, text),
  public.suggest_matches(bigint) to authenticated;

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

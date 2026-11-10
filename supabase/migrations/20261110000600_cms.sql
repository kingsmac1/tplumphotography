-- =====================================================================
-- Website CMS: one document per page (home, portfolio, about, contact, the-tplum-signature,
-- faq, coming-soon) plus "site" (header, footer, pop-out menu, contact details, social links).
-- The layout is fixed in code; documents only hold content (text, links, images, lists).
--   draft      what the editor is working on (only admins can read it)
--   published  what the live site shows (anyone can read it)
-- Every publish is kept in cms_revisions so any earlier version can be restored.
-- =====================================================================
create table if not exists public.cms_documents (
  key text primary key check (key ~ '^[a-z0-9-]+$'),
  draft jsonb not null default '{}'::jsonb,
  published jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  draft_updated_at timestamptz not null default now(),
  draft_updated_by uuid references auth.users(id) on delete set null
);
create table if not exists public.cms_revisions (
  id uuid primary key default gen_random_uuid(),
  key text not null references public.cms_documents(key) on delete cascade,
  content jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  note text not null default ''
);
create index if not exists cms_revisions_key_idx on public.cms_revisions (key, created_at desc);

alter table public.cms_documents enable row level security;
alter table public.cms_revisions enable row level security;
-- The public can only ever see published content (through the view below), never drafts.
revoke all on public.cms_documents from anon;
drop policy if exists "cms admin all" on public.cms_documents;
create policy "cms admin all" on public.cms_documents for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "cms revisions admin" on public.cms_revisions;
create policy "cms revisions admin" on public.cms_revisions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace view public.cms_published with (security_invoker = false) as
  select key, published as content, published_at from public.cms_documents;
revoke all on public.cms_published from public;
grant select on public.cms_published to anon, authenticated;

-- Save the editor's work (draft only — the live site doesn't change).
create or replace function public.cms_save_draft(p_key text, p_content jsonb) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare t timestamptz := now();
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.cms_documents (key, draft, draft_updated_at, draft_updated_by) values (p_key, p_content, t, auth.uid())
  on conflict (key) do update set draft = excluded.draft, draft_updated_at = t, draft_updated_by = auth.uid();
  return t;
end $$;

-- Publish: the draft goes live, and the version is kept for "restore".
create or replace function public.cms_publish(p_key text, p_note text default '') returns timestamptz
language plpgsql security definer set search_path = public as $$
declare t timestamptz := now(); d jsonb;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select draft into d from public.cms_documents where key = p_key for update;
  if d is null then raise exception 'Nothing to publish.'; end if;
  update public.cms_documents set published = d, published_at = t, published_by = auth.uid() where key = p_key;
  insert into public.cms_revisions (key, content, created_by, note) values (p_key, d, auth.uid(), coalesce(p_note, ''));
  -- keep the last 50 versions per page
  delete from public.cms_revisions where key = p_key and id not in (select id from public.cms_revisions where key = p_key order by created_at desc limit 50);
  return t;
end $$;

-- Undo unpublished changes: the draft goes back to what is live.
create or replace function public.cms_discard_draft(p_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.cms_documents set draft = published, draft_updated_at = now(), draft_updated_by = auth.uid() where key = p_key;
end $$;

-- Restore an earlier version into the draft (then preview and publish it).
create or replace function public.cms_restore(p_revision uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.cms_revisions;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into r from public.cms_revisions where id = p_revision;
  if not found then raise exception 'Version not found.'; end if;
  update public.cms_documents set draft = r.content, draft_updated_at = now(), draft_updated_by = auth.uid() where key = r.key;
end $$;

revoke all on function public.cms_save_draft(text, jsonb), public.cms_publish(text, text), public.cms_discard_draft(text), public.cms_restore(uuid) from public, anon;
grant execute on function public.cms_save_draft(text, jsonb), public.cms_publish(text, text), public.cms_discard_draft(text), public.cms_restore(uuid) to authenticated;

-- ---------- Supabase Storage: site images (public read, admin write). Separate from the R2 client galleries. ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images', 'site-images', true, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml', 'image/x-icon'])
on conflict (id) do update set public = true, file_size_limit = 15728640;
drop policy if exists "site images admin write" on storage.objects;
create policy "site images admin write" on storage.objects for insert to authenticated with check (bucket_id = 'site-images' and (select public.is_admin()));
drop policy if exists "site images admin update" on storage.objects;
create policy "site images admin update" on storage.objects for update to authenticated using (bucket_id = 'site-images' and (select public.is_admin()));
drop policy if exists "site images admin delete" on storage.objects;
create policy "site images admin delete" on storage.objects for delete to authenticated using (bucket_id = 'site-images' and (select public.is_admin()));
-- (Public bucket: files are served by URL without a select policy; listing stays admin-only.)
drop policy if exists "site images admin list" on storage.objects;
create policy "site images admin list" on storage.objects for select to authenticated using (bucket_id = 'site-images' and (select public.is_admin()));

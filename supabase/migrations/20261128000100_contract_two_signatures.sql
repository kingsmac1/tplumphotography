-- Contracts are signed by both parties: the photographer (for Tplum Photography) and the client.
-- The studio usually signs first (before sending), so the client sees the studio's signature and signs below it.
--   status 'signed'        = the client has signed, the studio has not yet ("Awaiting studio signature")
--   status 'countersigned' = signed by both
-- The text is frozen once either party has signed; the signatures can't change once both have signed.
create or replace function public.contracts_lock_signed() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.status in ('signed', 'countersigned') and (new.body is distinct from old.body or new.signature_data is distinct from old.signature_data
      or new.signer_name is distinct from old.signer_name or new.signed_at is distinct from old.signed_at) then
    raise exception 'A signed contract can''t be changed. Void it and send a new one instead.';
  end if;
  if old.studio_signed_at is not null and new.studio_signed_at is not null and new.body is distinct from old.body then
    raise exception 'The studio has signed this contract. Remove the studio signature to change the text.';
  end if;
  if old.status = 'countersigned' and (new.studio_signature_data is distinct from old.studio_signature_data
      or new.studio_signer_name is distinct from old.studio_signer_name or new.studio_signed_at is distinct from old.studio_signed_at) then
    raise exception 'A contract signed by both parties can''t be changed.';
  end if;
  return new;
end $$;

-- the photographer's saved signature, so later contracts are signed in one click (owner only)
create table if not exists public.contract_settings (
  id smallint primary key default 1 check (id = 1),
  signer_name text not null default '',
  signature_image text,
  updated_at timestamptz not null default now()
);
insert into public.contract_settings (id) values (1) on conflict (id) do nothing;
alter table public.contract_settings enable row level security;
drop policy if exists "contract settings admin all" on public.contract_settings;
create policy "contract settings admin all" on public.contract_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant select, insert, update on public.contract_settings to authenticated;
grant all on public.contract_settings to service_role;

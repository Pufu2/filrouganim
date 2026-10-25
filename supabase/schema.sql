-- Fil Roug'Anim : les comptes (candidats et structures) et les offres.
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Voir docs/COMPTES-SUPABASE.md.
-- Peut être relancé sans danger : les tables existantes sont gardées, les règles sont remplacées.
--
-- Qui voit quoi :
--   - les offres publiées des structures vérifiées : tout le monde (le site, Google) ;
--   - le nom, la ville et le site des structures vérifiées : tout le monde ;
--   - les profils des candidats : leur auteur, et les structures vérifiées seulement ;
--   - chacun modifie et supprime ses propres données, rien d'autre.
-- Une structure est vérifiée à la main (Table Editor > structures > verifiee = true).

-- ------------------------------------------------------------------ tables

create table if not exists public.structures (
  id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nom           text not null check (char_length(nom) between 2 and 120),
  type          text not null check (type in ('accueil-de-loisirs', 'sejours', 'accueil-de-jeunes',
                                              'periscolaire', 'association', 'collectivite', 'autre')),
  ville         text not null check (char_length(ville) between 2 and 80),
  departement   text not null check (departement in ('75', '77', '78', '91', '92', '93', '94', '95')),
  identifiant   text check (char_length(identifiant) <= 40),   -- SIRET, RNA ou n° de déclaration, pour la vérification
  site          text check (site ~ '^https?://[^\s<>"]+$' and char_length(site) <= 200),
  email_contact text not null check (email_contact ~ '^[^@\s<>"]+@[^@\s<>"]+\.[a-zA-Z]{2,}$'),
  presentation  text check (char_length(presentation) <= 1000),
  verifiee      boolean not null default false,
  fondatrice    boolean not null default false,
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now()
);

create table if not exists public.profils (
  id             uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  prenom         text not null check (char_length(prenom) between 1 and 40),
  departement    text not null check (departement in ('75', '77', '78', '91', '92', '93', '94', '95')),
  mobilite       text[] not null default '{}'
                 check (mobilite <@ array['75', '77', '78', '91', '92', '93', '94', '95', 'france']),
  diplomes       text[] not null default '{}'
                 check (diplomes <@ array['stagiaire-bafa', 'bafa', 'stagiaire-bafd', 'bafd', 'psc1',
                                          'surveillant-baignade', 'cqp-ap', 'cpjeps', 'bpjeps', 'dejeps', 'desjeps', 'autre']),
  recherche      text[] not null default '{}'
                 check (recherche <@ array['stage-pratique', 'ete', 'petites-vacances', 'mercredis', 'periscolaire',
                                           'annee', 'direction', 'alternance']),
  disponibilites text check (char_length(disponibilites) <= 300),
  presentation   text check (char_length(presentation) <= 1000),
  email_contact  text not null check (email_contact ~ '^[^@\s<>"]+@[^@\s<>"]+\.[a-zA-Z]{2,}$'),
  seize_ans      boolean not null check (seize_ans),
  publie         boolean not null default true,
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);

create table if not exists public.offres (
  id                   bigint generated always as identity primary key,
  structure_id         uuid not null default auth.uid() references public.structures (id) on delete cascade,
  intitule             text not null check (char_length(intitule) between 5 and 120),
  poste                text not null check (poste in ('animateur', 'animateur-stagiaire', 'directeur-adjoint', 'directeur',
                                                      'surveillant-baignade', 'coordinateur', 'autre')),
  contrat              text not null check (contrat in ('cee', 'cdd', 'cdi', 'stage-pratique', 'apprentissage', 'benevole')),
  ville                text not null check (char_length(ville) between 2 and 80),
  departement          text not null check (departement in ('75', '77', '78', '91', '92', '93', '94', '95')),
  debut                date not null,
  fin                  date check (fin >= debut),
  public               text check (char_length(public) <= 80),
  remuneration_montant numeric(8, 2) check (remuneration_montant >= 0),
  remuneration_unite   text check (remuneration_unite in ('jour', 'mois', 'heure')),
  loge                 boolean not null default false,
  diplomes             text check (char_length(diplomes) <= 200),
  texte                text not null check (char_length(texte) between 30 and 4000),
  candidater           text not null check (char_length(candidater) <= 200 and
                         (candidater ~ '^https?://[^\s<>"]+$' or candidater ~ '^[^@\s<>"]+@[^@\s<>"]+\.[a-zA-Z]{2,}$')),
  expire_le            date not null check (expire_le <= debut + 366),
  publiee              boolean not null default true,
  cree_le              timestamptz not null default now(),
  maj_le               timestamptz not null default now()
);

create index if not exists offres_structure on public.offres (structure_id);

alter table public.structures enable row level security;
alter table public.profils    enable row level security;
alter table public.offres     enable row level security;

-- ------------------------------------------------------------------ fonctions

-- maj_le se met à jour tout seul
create or replace function public.toucher() returns trigger language plpgsql set search_path = '' as $$
begin new.maj_le := now(); return new; end $$;

drop trigger if exists toucher on public.structures;
drop trigger if exists toucher on public.profils;
drop trigger if exists toucher on public.offres;
create trigger toucher before update on public.structures for each row execute function public.toucher();
create trigger toucher before update on public.profils    for each row execute function public.toucher();
create trigger toucher before update on public.offres     for each row execute function public.toucher();

-- un compte est soit candidat, soit structure
create or replace function public.un_seul_role() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'profils' and exists (select 1 from public.structures where id = new.id) then
    raise exception 'Ce compte est déjà celui d''une structure.';
  elsif tg_table_name = 'structures' and exists (select 1 from public.profils where id = new.id) then
    raise exception 'Ce compte est déjà celui d''un candidat.';
  end if;
  return new;
end $$;

drop trigger if exists un_seul_role on public.structures;
drop trigger if exists un_seul_role on public.profils;
create trigger un_seul_role before insert on public.structures for each row execute function public.un_seul_role();
create trigger un_seul_role before insert on public.profils    for each row execute function public.un_seul_role();

-- la structure connectée est-elle vérifiée ? / telle structure est-elle vérifiée ?
create or replace function public.structure_verifiee() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.structures where id = auth.uid() and verifiee) $$;

create or replace function public.est_verifiee(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.structures where id = sid and verifiee) $$;

-- chacun peut supprimer son compte (ses données partent avec : « on delete cascade »)
create or replace function public.supprimer_mon_compte() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid() $$;

revoke all on function public.structure_verifiee(), public.est_verifiee(uuid), public.supprimer_mon_compte(),
                       public.toucher(), public.un_seul_role() from public, anon, authenticated;
grant execute on function public.structure_verifiee(), public.est_verifiee(uuid) to anon, authenticated;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- ------------------------------------------------------------------ droits (colonne par colonne)

revoke all on public.structures, public.profils, public.offres from anon, authenticated;

grant select (id, nom, type, ville, departement, site, presentation) on public.structures to anon;
grant select on public.structures to authenticated;
grant insert (nom, type, ville, departement, identifiant, site, email_contact, presentation) on public.structures to authenticated;
grant update (nom, type, ville, departement, identifiant, site, email_contact, presentation) on public.structures to authenticated;
grant delete on public.structures to authenticated;

grant select, delete on public.profils to authenticated;
grant insert (prenom, departement, mobilite, diplomes, recherche, disponibilites, presentation, email_contact, seize_ans, publie)
  on public.profils to authenticated;
grant update (prenom, departement, mobilite, diplomes, recherche, disponibilites, presentation, email_contact, seize_ans, publie)
  on public.profils to authenticated;

grant select on public.offres to anon, authenticated;
grant insert (intitule, poste, contrat, ville, departement, debut, fin, public, remuneration_montant, remuneration_unite,
              loge, diplomes, texte, candidater, expire_le, publiee) on public.offres to authenticated;
grant update (intitule, poste, contrat, ville, departement, debut, fin, public, remuneration_montant, remuneration_unite,
              loge, diplomes, texte, candidater, expire_le, publiee) on public.offres to authenticated;
grant delete on public.offres to authenticated;

-- ------------------------------------------------------------------ règles d'accès (RLS)

drop policy if exists "structures vérifiées visibles" on public.structures;
drop policy if exists "sa structure : lire"         on public.structures;
drop policy if exists "sa structure : créer"        on public.structures;
drop policy if exists "sa structure : modifier"     on public.structures;
drop policy if exists "sa structure : supprimer"    on public.structures;
create policy "structures vérifiées visibles" on public.structures for select to anon, authenticated using (verifiee);
create policy "sa structure : lire"      on public.structures for select to authenticated using (id = (select auth.uid()));
create policy "sa structure : créer"     on public.structures for insert to authenticated with check (id = (select auth.uid()));
create policy "sa structure : modifier"  on public.structures for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "sa structure : supprimer" on public.structures for delete to authenticated using (id = (select auth.uid()));

drop policy if exists "son profil : lire"                    on public.profils;
drop policy if exists "profils publiés : structures vérifiées" on public.profils;
drop policy if exists "son profil : créer"                   on public.profils;
drop policy if exists "son profil : modifier"                on public.profils;
drop policy if exists "son profil : supprimer"               on public.profils;
create policy "son profil : lire" on public.profils for select to authenticated using (id = (select auth.uid()));
create policy "profils publiés : structures vérifiées" on public.profils for select to authenticated
  using (publie and (select public.structure_verifiee()));
create policy "son profil : créer"     on public.profils for insert to authenticated with check (id = (select auth.uid()));
create policy "son profil : modifier"  on public.profils for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "son profil : supprimer" on public.profils for delete to authenticated using (id = (select auth.uid()));

drop policy if exists "offres en ligne visibles" on public.offres;
drop policy if exists "ses offres : lire"        on public.offres;
drop policy if exists "ses offres : créer"       on public.offres;
drop policy if exists "ses offres : modifier"    on public.offres;
drop policy if exists "ses offres : supprimer"   on public.offres;
create policy "offres en ligne visibles" on public.offres for select to anon, authenticated
  using (publiee and expire_le >= current_date and public.est_verifiee(structure_id));
create policy "ses offres : lire"      on public.offres for select to authenticated using (structure_id = (select auth.uid()));
create policy "ses offres : créer"     on public.offres for insert to authenticated with check (structure_id = (select auth.uid()));
create policy "ses offres : modifier"  on public.offres for update to authenticated
  using (structure_id = (select auth.uid())) with check (structure_id = (select auth.uid()));
create policy "ses offres : supprimer" on public.offres for delete to authenticated using (structure_id = (select auth.uid()));

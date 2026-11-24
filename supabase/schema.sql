-- Fil Roug'Anim : les comptes (candidats et structures) et les offres.
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Voir docs/COMPTES-SUPABASE.md.
-- Peut être relancé sans danger : les tables et les données sont gardées, les règles sont remplacées.
-- Version 2 du 25/10/2026 : candidatures, favoris, profils et offres plus complets, purge des comptes inactifs.
-- Version 3 du 26/10/2026 : pages publiques des structures, alertes e-mail des candidats.
-- Version 4 du 10/11/2026 : CV des candidats, logo et photos des structures (stockage), connexion Google et mot de passe.
-- Version 5 du 10/11/2026 : abonnement des structures (Stripe), centres d'une même structure.
-- Version 6 du 11/11/2026 : l'annuaire inversé (demandes des candidats, envoyées aux structures les plus proches).
-- Version 7 du 11/11/2026 : année de naissance et qualifications (avec date de fin facultative) dans les profils.
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

-- version 2 (25/10/2026, soir) : profils plus complets, offres plus précises
alter table public.profils add column if not exists poste_recherche text check (char_length(poste_recherche) <= 60);
alter table public.profils add column if not exists ville text check (char_length(ville) <= 80);
alter table public.profils add column if not exists permis_b boolean not null default false;
alter table public.profils add column if not exists experiences text[] not null default '{}'
  check (experiences <@ array['petite-enfance', 'enfants', 'ados', 'handicap', 'sejours', 'itinerance', 'etranger',
                              'periscolaire', 'direction', 'baignade']);
alter table public.profils add column if not exists activites text[] not null default '{}'
  check (cardinality(activites) <= 10 and char_length(array_to_string(activites, ',')) <= 320);
alter table public.profils add column if not exists dispo_debut date;
alter table public.profils add column if not exists dispo_fin date;
alter table public.offres add column if not exists nb_postes smallint not null default 1 check (nb_postes between 1 and 50);
alter table public.offres add column if not exists type_accueil text
  check (type_accueil in ('accueil-de-loisirs', 'periscolaire', 'sejour-vacances', 'mini-camp', 'accueil-de-jeunes', 'scoutisme', 'autre'));
alter table public.offres add column if not exists age_min smallint check (age_min between 2 and 17);
alter table public.offres add column if not exists age_max smallint check (age_max between 2 and 17 and age_max >= age_min);

-- version 3 : la page publique de chaque structure vérifiée, qu'elle personnalise
alter table public.structures add column if not exists slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60);
alter table public.structures add column if not exists accroche text check (char_length(accroche) <= 140);
alter table public.structures add column if not exists couleur text not null default 'rouge'
  check (couleur in ('rouge', 'sauge', 'bleu', 'prune', 'ocre', 'nuit'));
alter table public.structures add column if not exists publics text[] not null default '{}'
  check (publics <@ array['3-5', '6-11', '12-14', '15-17', 'handicap', 'familles']);
alter table public.structures add column if not exists activites text[] not null default '{}'
  check (cardinality(activites) <= 12 and char_length(array_to_string(activites, ',')) <= 400);
alter table public.structures add column if not exists lieux text check (char_length(lieux) <= 300);
alter table public.structures add column if not exists projet text check (char_length(projet) <= 2000);
alter table public.structures add column if not exists avantages text check (char_length(avantages) <= 800);
alter table public.structures add column if not exists page_publique boolean not null default true;
alter table public.profils add column if not exists alertes boolean not null default false;
-- jeton du lien « se désabonner » des alertes : il suffit de cliquer, sans se connecter
alter table public.profils add column if not exists jeton_alertes uuid not null default gen_random_uuid();

-- version 3 : toute la France métropolitaine et la Corse (et plus seulement l'Île-de-France)
do $$
declare dep constant text := '^(0[1-9]|1[0-9]|2[1-9AB]|[3-8][0-9]|9[0-5])$';
begin
  alter table public.structures drop constraint if exists structures_departement_check;
  alter table public.profils    drop constraint if exists profils_departement_check;
  alter table public.offres     drop constraint if exists offres_departement_check;
  alter table public.profils    drop constraint if exists profils_mobilite_check;
  execute format('alter table public.structures add constraint structures_departement_check check (departement ~ %L)', dep);
  execute format('alter table public.profils add constraint profils_departement_check check (departement ~ %L)', dep);
  execute format('alter table public.offres add constraint offres_departement_check check (departement ~ %L)', dep);
  alter table public.profils add constraint profils_mobilite_check
    check (array_to_string(mobilite, ',') ~ '^((0[1-9]|1[0-9]|2[1-9AB]|[3-8][0-9]|9[0-5]|france)(,|$))*$');
end $$;

-- candidatures : un candidat postule avec son profil à une offre en ligne
create table if not exists public.candidatures (
  id          bigint generated always as identity primary key,
  offre_id    bigint not null references public.offres (id) on delete cascade,
  candidat_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  message     text check (char_length(message) <= 1000),
  statut      text not null default 'envoyee' check (statut in ('envoyee', 'vue', 'retenue', 'non-retenue')),
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),
  unique (offre_id, candidat_id)
);
create index if not exists candidatures_offre on public.candidatures (offre_id);

-- favoris : les profils qu'une structure vérifiée garde de côté
create table if not exists public.favoris (
  structure_id uuid not null default auth.uid() references public.structures (id) on delete cascade,
  profil_id    uuid not null references public.profils (id) on delete cascade,
  cree_le      timestamptz not null default now(),
  primary key (structure_id, profil_id)
);

alter table public.candidatures enable row level security;
alter table public.favoris      enable row level security;

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
drop trigger if exists toucher on public.candidatures;
create trigger toucher before update on public.candidatures for each row execute function public.toucher();

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

-- l'offre est-elle à la structure connectée ? est-elle en ligne ? tel candidat a-t-il postulé chez elle ?
create or replace function public.est_mon_offre(oid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.offres where id = oid and structure_id = auth.uid()) $$;

create or replace function public.offre_en_ligne(oid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.offres o join public.structures s on s.id = o.structure_id
                 where o.id = oid and o.publiee and o.expire_le >= current_date and s.verifiee) $$;

create or replace function public.a_postule_chez_moi(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.candidatures c join public.offres o on o.id = c.offre_id
                 where c.candidat_id = pid and o.structure_id = auth.uid()) $$;

-- chacun peut supprimer son compte (ses données partent avec : « on delete cascade »)
create or replace function public.supprimer_mon_compte() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid() $$;

revoke all on function public.structure_verifiee(), public.est_verifiee(uuid), public.supprimer_mon_compte(),
                       public.toucher(), public.un_seul_role(), public.est_mon_offre(bigint),
                       public.offre_en_ligne(bigint), public.a_postule_chez_moi(uuid) from public, anon, authenticated;
grant execute on function public.structure_verifiee(), public.est_verifiee(uuid) to anon, authenticated;
grant execute on function public.est_mon_offre(bigint), public.offre_en_ligne(bigint), public.a_postule_chez_moi(uuid) to authenticated;
grant execute on function public.supprimer_mon_compte() to authenticated;

-- ------------------------------------------------------------------ droits (colonne par colonne)

revoke all on public.structures, public.profils, public.offres, public.candidatures, public.favoris from anon, authenticated;

grant select (id, nom, type, ville, departement, site, presentation, fondatrice, slug, accroche, couleur, publics, activites,
              lieux, projet, avantages, page_publique) on public.structures to anon;
grant select on public.structures to authenticated;
grant insert (nom, type, ville, departement, identifiant, site, email_contact, presentation,
         slug, accroche, couleur, publics, activites, lieux, projet, avantages, page_publique) on public.structures to authenticated;
grant update (nom, type, ville, departement, identifiant, site, email_contact, presentation,
         slug, accroche, couleur, publics, activites, lieux, projet, avantages, page_publique) on public.structures to authenticated;
grant delete on public.structures to authenticated;

-- tout sauf le jeton des alertes (lui ne sert qu'au lien de désabonnement envoyé au candidat)
grant delete on public.profils to authenticated;
grant select (id, prenom, departement, mobilite, diplomes, recherche, disponibilites, presentation, email_contact, seize_ans,
              publie, cree_le, maj_le, poste_recherche, ville, permis_b, experiences, activites, dispo_debut, dispo_fin, alertes)
  on public.profils to authenticated;
grant insert (prenom, departement, mobilite, diplomes, recherche, disponibilites, presentation, email_contact, seize_ans, publie,
         poste_recherche, ville, permis_b, experiences, activites, dispo_debut, dispo_fin, alertes)
  on public.profils to authenticated;
grant update (prenom, departement, mobilite, diplomes, recherche, disponibilites, presentation, email_contact, seize_ans, publie,
         poste_recherche, ville, permis_b, experiences, activites, dispo_debut, dispo_fin, alertes)
  on public.profils to authenticated;

grant select on public.offres to anon, authenticated;
grant insert (intitule, poste, contrat, ville, departement, debut, fin, public, remuneration_montant, remuneration_unite,
              loge, diplomes, texte, candidater, expire_le, publiee, nb_postes, type_accueil, age_min, age_max) on public.offres to authenticated;
grant update (intitule, poste, contrat, ville, departement, debut, fin, public, remuneration_montant, remuneration_unite,
              loge, diplomes, texte, candidater, expire_le, publiee, nb_postes, type_accueil, age_min, age_max) on public.offres to authenticated;
grant delete on public.offres to authenticated;

-- le rôle serveur (clé secrète, utilisée seulement par les alertes du lundi sur GitHub) : lecture seule
grant usage on schema public to service_role;
grant select on public.structures, public.profils, public.offres to service_role;

grant select, delete on public.candidatures to authenticated;
grant insert (offre_id, message) on public.candidatures to authenticated;
grant update (statut) on public.candidatures to authenticated;
grant select, delete on public.favoris to authenticated;
grant insert (profil_id) on public.favoris to authenticated;

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

drop policy if exists "profils des candidats à mes offres" on public.profils;
create policy "profils des candidats à mes offres" on public.profils for select to authenticated
  using ((select public.a_postule_chez_moi(id)));

drop policy if exists "mes candidatures : lire"           on public.candidatures;
drop policy if exists "candidatures reçues : lire"        on public.candidatures;
drop policy if exists "mes candidatures : postuler"       on public.candidatures;
drop policy if exists "candidatures reçues : statut"      on public.candidatures;
drop policy if exists "mes candidatures : retirer"        on public.candidatures;
create policy "mes candidatures : lire"     on public.candidatures for select to authenticated using (candidat_id = (select auth.uid()));
create policy "candidatures reçues : lire"  on public.candidatures for select to authenticated using (public.est_mon_offre(offre_id));
create policy "mes candidatures : postuler" on public.candidatures for insert to authenticated
  with check (candidat_id = (select auth.uid()) and public.offre_en_ligne(offre_id));
create policy "candidatures reçues : statut" on public.candidatures for update to authenticated
  using (public.est_mon_offre(offre_id)) with check (public.est_mon_offre(offre_id));
create policy "mes candidatures : retirer"  on public.candidatures for delete to authenticated using (candidat_id = (select auth.uid()));

drop policy if exists "mes favoris : lire"     on public.favoris;
drop policy if exists "mes favoris : ajouter"  on public.favoris;
drop policy if exists "mes favoris : retirer"  on public.favoris;
create policy "mes favoris : lire"    on public.favoris for select to authenticated using (structure_id = (select auth.uid()));
create policy "mes favoris : ajouter" on public.favoris for insert to authenticated
  with check (structure_id = (select auth.uid()) and (select public.structure_verifiee()));
create policy "mes favoris : retirer" on public.favoris for delete to authenticated using (structure_id = (select auth.uid()));

-- ------------------------------------------------------------------ comptes inactifs

-- les comptes sans connexion depuis 2 ans sont supprimés (promis dans la page Confidentialité)
create or replace function public.purger_comptes_inactifs() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from auth.users where coalesce(last_sign_in_at, created_at) < now() - interval '2 years';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purger_comptes_inactifs() from public, anon, authenticated;

-- tous les 1ers du mois à 4 h (heure UTC), si l'extension pg_cron est disponible
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'purger-comptes-inactifs';
  perform cron.schedule('purger-comptes-inactifs', '0 4 1 * *', 'select public.purger_comptes_inactifs()');
exception when others then
  raise notice 'pg_cron indisponible : activer l''extension (Database > Extensions > pg_cron) puis relancer ce fichier';
end $$;

-- ------------------------------------------------------------------ alertes e-mail

-- désabonnement en un clic depuis l'e-mail (le jeton est propre à chaque candidat)
create or replace function public.desabonner_alertes(jeton uuid) returns boolean
language sql security definer set search_path = '' as $$
  update public.profils set alertes = false where jeton_alertes = jeton returning true $$;
revoke all on function public.desabonner_alertes(uuid) from public;
grant execute on function public.desabonner_alertes(uuid) to anon, authenticated;

-- ------------------------------------------------------------------ version 4 (10/11/2026)
-- Le CV des candidats (facultatif), le logo et les photos des structures, rangés dans le stockage de Supabase :
--   - « cv » (privé) : un PDF par candidat, dans son dossier ; lisible par lui, par les structures vérifiées
--     (si le profil est visible) et par les structures à qui il a postulé ;
--   - « structures » (public) : le logo et jusqu'à 5 photos, dans le dossier de la structure.
-- Chacun n'écrit et ne supprime que dans son propre dossier (le nom du dossier est son identifiant).

alter table public.profils add column if not exists cv_nom text check (char_length(cv_nom) <= 120);
alter table public.structures add column if not exists logo text
  check (logo ~ '^[0-9a-f-]{36}/[a-z0-9-]{1,40}\.jpg$');
alter table public.structures add column if not exists photos text[] not null default '{}'
  check (cardinality(photos) <= 5 and array_to_string(photos, ',') ~ '^([0-9a-f-]{36}/[a-z0-9-]{1,40}\.jpg(,|$))*$');

grant select (cv_nom) on public.profils to authenticated;
grant insert (cv_nom), update (cv_nom) on public.profils to authenticated;
grant select (logo, photos) on public.structures to anon;
grant insert (logo, photos), update (logo, photos) on public.structures to authenticated;
grant select (cv_nom) on public.profils to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('cv', 'cv', false, 2097152, array['application/pdf']),
  ('structures', 'structures', true, 2097152, array['image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

-- le CV de ce dossier peut-il être lu par la structure connectée ?
create or replace function public.cv_lisible(dossier text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profils p
                 where p.id::text = dossier
                   and ((p.publie and public.structure_verifiee()) or public.a_postule_chez_moi(p.id))) $$;
revoke all on function public.cv_lisible(text) from public, anon, authenticated;
grant execute on function public.cv_lisible(text) to authenticated;

drop policy if exists "cv : le sien"                    on storage.objects;
drop policy if exists "cv : structures vérifiées"       on storage.objects;
drop policy if exists "photos : les siennes, ajouter"   on storage.objects;
drop policy if exists "photos : les siennes, modifier"  on storage.objects;
drop policy if exists "photos : les siennes, supprimer" on storage.objects;
drop policy if exists "photos : les siennes, lister"    on storage.objects;
create policy "cv : le sien" on storage.objects for all to authenticated
  using (bucket_id = 'cv' and (storage.foldername(name))[1] = (select auth.uid())::text and name = (select auth.uid())::text || '/cv.pdf')
  with check (bucket_id = 'cv' and name = (select auth.uid())::text || '/cv.pdf');
create policy "cv : structures vérifiées" on storage.objects for select to authenticated
  using (bucket_id = 'cv' and public.cv_lisible((storage.foldername(name))[1]));
create policy "photos : les siennes, ajouter" on storage.objects for insert to authenticated
  with check (bucket_id = 'structures' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos : les siennes, modifier" on storage.objects for update to authenticated
  using (bucket_id = 'structures' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'structures' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos : les siennes, supprimer" on storage.objects for delete to authenticated
  using (bucket_id = 'structures' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos : les siennes, lister" on storage.objects for select to authenticated
  using (bucket_id = 'structures' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ------------------------------------------------------------------ version 5 (10/11/2026)
-- L'abonnement des structures (Stripe, compte de l'entreprise de Jeuphorie) et les centres.
--   - Une structure est en ligne (page, offres, accès aux profils) quand elle est vérifiée ET que son abonnement court.
--   - abonnement_fin, abonnement_id, centres_payes et fondatrice sont écrits par le relevé des paiements
--     (outils/abonnements.py, GitHub Actions, rôle serveur) : la structure ne peut pas les modifier elle-même.
--   - Une structure qui gère plusieurs centres : un compte, la page « réseau » de la structure, et une page par centre.
--     centres_payes = nombre de centres payés, la structure comprise (1 = la structure seule).

alter table public.structures add column if not exists abonnement_fin date;
alter table public.structures add column if not exists abonnement_id text check (char_length(abonnement_id) <= 80);
alter table public.structures add column if not exists centres_payes smallint not null default 1 check (centres_payes between 0 and 50);
grant update (abonnement_fin, abonnement_id, centres_payes, fondatrice) on public.structures to service_role;

-- vérifiée ET abonnement en cours
create or replace function public.est_verifiee(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.structures where id = sid and verifiee and abonnement_fin >= current_date) $$;
create or replace function public.structure_verifiee() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.structures where id = auth.uid() and verifiee and abonnement_fin >= current_date) $$;
create or replace function public.offre_en_ligne(oid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.offres o join public.structures s on s.id = o.structure_id
                 where o.id = oid and o.publiee and o.expire_le >= current_date and s.verifiee and s.abonnement_fin >= current_date) $$;
drop policy if exists "structures vérifiées visibles" on public.structures;
create policy "structures vérifiées visibles" on public.structures for select to anon, authenticated
  using (verifiee and abonnement_fin >= current_date);

-- les places fondatrices qui restent (affichées sur le site)
create or replace function public.places_fondatrices() returns integer
language sql stable security definer set search_path = '' as $$
  select greatest(0, 10 - count(*))::integer from public.structures where fondatrice $$;
revoke all on function public.places_fondatrices() from public;
grant execute on function public.places_fondatrices() to anon, authenticated;

-- les centres d'une structure
create table if not exists public.centres (
  id            uuid primary key default gen_random_uuid(),
  structure_id  uuid not null default auth.uid() references public.structures (id) on delete cascade,
  nom           text not null check (char_length(nom) between 2 and 120),
  type          text check (type in ('accueil-de-loisirs', 'sejours', 'accueil-de-jeunes', 'periscolaire', 'association', 'collectivite', 'autre')),
  ville         text not null check (char_length(ville) between 2 and 80),
  departement   text not null check (departement ~ '^(0[1-9]|1[0-9]|2[1-9AB]|[3-8][0-9]|9[0-5])$'),
  slug          text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  accroche      text check (char_length(accroche) <= 140),
  presentation  text check (char_length(presentation) <= 1500),
  publics       text[] not null default '{}' check (publics <@ array['3-5', '6-11', '12-14', '15-17', 'handicap', 'familles']),
  activites     text[] not null default '{}' check (cardinality(activites) <= 12 and char_length(array_to_string(activites, ',')) <= 400),
  photos        text[] not null default '{}'
                check (cardinality(photos) <= 5 and array_to_string(photos, ',') ~ '^([0-9a-f-]{36}/[a-z0-9-]{1,40}\.jpg(,|$))*$'),
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),
  unique (structure_id, slug)
);
create index if not exists centres_structure on public.centres (structure_id);
alter table public.centres enable row level security;
drop trigger if exists toucher on public.centres;
create trigger toucher before update on public.centres for each row execute function public.toucher();

-- un centre est en ligne si sa structure l'est, que sa page est publique, et qu'il fait partie des centres payés
-- (la structure compte pour un : avec centres_payes = 3, les 2 premiers centres créés sont en ligne)
create or replace function public.centre_en_ligne(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.centres c join public.structures s on s.id = c.structure_id
    where c.id = cid and s.verifiee and s.abonnement_fin >= current_date and s.page_publique
      and (select count(*) from public.centres c2 where c2.structure_id = c.structure_id
             and (c2.cree_le, c2.id) <= (c.cree_le, c.id)) < s.centres_payes) $$;
revoke all on function public.centre_en_ligne(uuid) from public;
grant execute on function public.centre_en_ligne(uuid) to anon, authenticated;

revoke all on public.centres from anon, authenticated;
grant select (id, structure_id, nom, type, ville, departement, slug, accroche, presentation, publics, activites, photos)
  on public.centres to anon;
grant select on public.centres to authenticated;
grant insert (nom, type, ville, departement, slug, accroche, presentation, publics, activites, photos),
      update (nom, type, ville, departement, slug, accroche, presentation, publics, activites, photos) on public.centres to authenticated;
grant delete on public.centres to authenticated;
grant select on public.centres to service_role;

drop policy if exists "centres en ligne visibles" on public.centres;
drop policy if exists "ses centres : lire"       on public.centres;
drop policy if exists "ses centres : créer"      on public.centres;
drop policy if exists "ses centres : modifier"   on public.centres;
drop policy if exists "ses centres : supprimer"  on public.centres;
create policy "centres en ligne visibles" on public.centres for select to anon, authenticated using (public.centre_en_ligne(id));
create policy "ses centres : lire"      on public.centres for select to authenticated using (structure_id = (select auth.uid()));
create policy "ses centres : créer"     on public.centres for insert to authenticated with check (structure_id = (select auth.uid()));
create policy "ses centres : modifier"  on public.centres for update to authenticated
  using (structure_id = (select auth.uid())) with check (structure_id = (select auth.uid()));
create policy "ses centres : supprimer" on public.centres for delete to authenticated using (structure_id = (select auth.uid()));

-- une offre peut être rattachée à l'un des centres de la structure
alter table public.offres add column if not exists centre_id uuid references public.centres (id) on delete set null;
grant insert (centre_id), update (centre_id) on public.offres to authenticated;
drop policy if exists "ses offres : créer"    on public.offres;
drop policy if exists "ses offres : modifier" on public.offres;
create policy "ses offres : créer" on public.offres for insert to authenticated
  with check (structure_id = (select auth.uid())
              and (centre_id is null or exists (select 1 from public.centres c where c.id = centre_id and c.structure_id = (select auth.uid()))));
create policy "ses offres : modifier" on public.offres for update to authenticated
  using (structure_id = (select auth.uid()))
  with check (structure_id = (select auth.uid())
              and (centre_id is null or exists (select 1 from public.centres c where c.id = centre_id and c.structure_id = (select auth.uid()))));

-- ------------------------------------------------------------------ version 6 (11/11/2026)
-- L'annuaire inversé : un animateur ou un directeur décrit le poste qu'il cherche, et sa demande part chez
-- les 3 structures en ligne (vérifiées et abonnées) les plus proches de lui. Sans structure dans sa zone,
-- la demande attend (30 jours) et part dès qu'une structure s'inscrit (relayer_demandes, lancé toutes les 15 minutes).
-- Les structures qui la reçoivent la lisent dans leur espace et reçoivent un e-mail ; personne d'autre ne la voit.

create table if not exists public.demandes (
  id             bigint generated always as identity primary key,
  candidat_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prenom         text not null check (char_length(prenom) between 1 and 40),
  poste          text not null check (poste in ('animateur-stagiaire', 'animateur', 'directeur-adjoint', 'directeur', 'surveillant-baignade', 'autre')),
  departement    text not null check (departement ~ '^(0[1-9]|1[0-9]|2[1-9AB]|[3-8][0-9]|9[0-5])$'),
  ville          text check (char_length(ville) <= 80),
  zone           text[] not null check (cardinality(zone) between 1 and 20
                   and array_to_string(zone, ',') ~ '^((0[1-9]|1[0-9]|2[1-9AB]|[3-8][0-9]|9[0-5])(,|$))+$'),
  partout        boolean not null default false,
  periodes       text[] not null default '{}' check (periodes <@ array['ete', 'petites-vacances', 'mercredis', 'periscolaire', 'annee']),
  dispo_debut    date,
  dispo_fin      date check (dispo_fin >= dispo_debut),
  diplomes       text[] not null default '{}' check (diplomes <@ array['stagiaire-bafa', 'bafa', 'stagiaire-bafd', 'bafd', 'psc1',
                   'surveillant-baignade', 'cqp-ap', 'cpjeps', 'bpjeps', 'dejeps', 'desjeps', 'autre']),
  experiences    text[] not null default '{}' check (experiences <@ array['petite-enfance', 'enfants', 'ados', 'handicap', 'sejours',
                   'itinerance', 'etranger', 'periscolaire', 'direction', 'baignade']),
  message        text check (char_length(message) <= 800),
  email_contact  text not null check (email_contact ~ '^[^@\s<>"]+@[^@\s<>"]+\.[a-zA-Z]{2,}$'),
  seize_ans      boolean not null check (seize_ans),
  destinataires  uuid[] not null default '{}',
  notifiees      uuid[] not null default '{}',
  cree_le        timestamptz not null default now()
);
create index if not exists demandes_candidat on public.demandes (candidat_id);
create index if not exists demandes_destinataires on public.demandes using gin (destinataires);
alter table public.demandes enable row level security;

-- les structures en ligne d'une zone : d'abord celles du département du candidat, puis les autres ;
-- une structure compte aussi par ses centres en ligne
create or replace function public.structures_de_la_zone(z text[], dep text, n integer default 3)
returns table (id uuid, nom text, ville text, departement text, slug text, page_publique boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.nom, s.ville, s.departement, s.slug, s.page_publique
  from public.structures s
  where s.verifiee and s.abonnement_fin >= current_date
    and (s.departement = any (z) or exists (select 1 from public.centres c where c.structure_id = s.id
                                            and c.departement = any (z) and public.centre_en_ligne(c.id)))
  order by (s.departement = dep or exists (select 1 from public.centres c where c.structure_id = s.id
                                           and c.departement = dep and public.centre_en_ligne(c.id))) desc,
           s.fondatrice desc, s.cree_le
  limit greatest(1, least(n, 3)) $$;

-- ce que le candidat voit avant d'envoyer : qui recevra sa demande (le nom et la ville, déjà publics)
create or replace function public.destinataires_possibles(z text[], dep text)
returns table (nom text, ville text, departement text, slug text)
language sql stable security definer set search_path = '' as $$
  select nom, ville, departement, case when page_publique then slug end from public.structures_de_la_zone(z, dep, 3) $$;

-- envoyer une demande (connecté) : 3 demandes au plus par 24 heures
create or replace function public.envoyer_demande(d jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  qui uuid := auth.uid();
  z text[] := array(select jsonb_array_elements_text(d -> 'zone'));
  dep text := d ->> 'departement';
  dest uuid[];
begin
  if qui is null then raise exception 'Connectez-vous pour envoyer votre demande.'; end if;
  if (select count(*) from public.demandes where candidat_id = qui and cree_le > now() - interval '24 hours') >= 3 then
    raise exception 'Vous avez déjà envoyé 3 demandes aujourd''hui : réessayez demain.';
  end if;
  if not (dep = any (z)) then z := array_prepend(dep, z); end if;
  dest := array(select s.id from public.structures_de_la_zone(z, dep, 3) s);
  insert into public.demandes (candidat_id, prenom, poste, departement, ville, zone, partout, periodes, dispo_debut, dispo_fin,
                               diplomes, experiences, message, email_contact, seize_ans, destinataires)
  values (qui, d ->> 'prenom', d ->> 'poste', dep, nullif(d ->> 'ville', ''), z, coalesce((d ->> 'partout')::boolean, false),
          array(select jsonb_array_elements_text(coalesce(d -> 'periodes', '[]'))),
          nullif(d ->> 'dispo_debut', '')::date, nullif(d ->> 'dispo_fin', '')::date,
          array(select jsonb_array_elements_text(coalesce(d -> 'diplomes', '[]'))),
          array(select jsonb_array_elements_text(coalesce(d -> 'experiences', '[]'))),
          nullif(d ->> 'message', ''), d ->> 'email_contact', coalesce((d ->> 'seize_ans')::boolean, false), dest);
  return cardinality(dest);
end $$;

-- les demandes en attente (sans structure dans la zone) partent dès qu'une structure s'inscrit : rôle serveur seulement
create or replace function public.relayer_demandes() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer := 0; r record; dest uuid[];
begin
  for r in select id, zone, departement from public.demandes
           where cardinality(destinataires) = 0 and cree_le > now() - interval '30 days' loop
    dest := array(select s.id from public.structures_de_la_zone(r.zone, r.departement, 3) s);
    if cardinality(dest) > 0 then
      update public.demandes set destinataires = dest where id = r.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

revoke all on function public.structures_de_la_zone(text[], text, integer), public.destinataires_possibles(text[], text),
                       public.envoyer_demande(jsonb), public.relayer_demandes() from public, anon, authenticated;
grant execute on function public.destinataires_possibles(text[], text) to anon, authenticated;
grant execute on function public.envoyer_demande(jsonb) to authenticated;
grant execute on function public.relayer_demandes() to service_role;

revoke all on public.demandes from anon, authenticated;
grant select, delete on public.demandes to authenticated;
grant select, update (notifiees) on public.demandes to service_role;
grant select (id, nom, email_contact) on public.structures to service_role;

drop policy if exists "mes demandes : lire"            on public.demandes;
drop policy if exists "mes demandes : retirer"         on public.demandes;
drop policy if exists "demandes reçues : lire"         on public.demandes;
create policy "mes demandes : lire"    on public.demandes for select to authenticated using (candidat_id = (select auth.uid()));
create policy "mes demandes : retirer" on public.demandes for delete to authenticated using (candidat_id = (select auth.uid()));
create policy "demandes reçues : lire" on public.demandes for select to authenticated
  using ((select auth.uid()) = any (destinataires) and (select public.structure_verifiee()));

-- ------------------------------------------------------------------ version 7 (11/11/2026)
-- L'année de naissance (les structures voient l'âge : conduite, nuits en séjour, direction) et les qualifications
-- (BSB, BNSSA, PSC1, PSE1, SST, qualifications d'activités), chacune avec une date de fin facultative.
-- Comme le reste du profil : visibles seulement par les structures vérifiées et celles à qui le candidat écrit.

alter table public.profils add column if not exists annee_naissance smallint check (annee_naissance between 1940 and 2015);
alter table public.profils add column if not exists qualifications jsonb not null default '[]'
  check (jsonb_typeof(qualifications) = 'array' and jsonb_array_length(qualifications) <= 12 and char_length(qualifications::text) <= 1200);
grant select (annee_naissance, qualifications) on public.profils to authenticated, service_role;
grant insert (annee_naissance, qualifications), update (annee_naissance, qualifications) on public.profils to authenticated;

alter table public.demandes add column if not exists annee_naissance smallint check (annee_naissance between 1940 and 2015);

create or replace function public.envoyer_demande(d jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  qui uuid := auth.uid();
  z text[] := array(select jsonb_array_elements_text(d -> 'zone'));
  dep text := d ->> 'departement';
  dest uuid[];
begin
  if qui is null then raise exception 'Connectez-vous pour envoyer votre demande.'; end if;
  if (select count(*) from public.demandes where candidat_id = qui and cree_le > now() - interval '24 hours') >= 3 then
    raise exception 'Vous avez déjà envoyé 3 demandes aujourd''hui : réessayez demain.';
  end if;
  if not (dep = any (z)) then z := array_prepend(dep, z); end if;
  dest := array(select s.id from public.structures_de_la_zone(z, dep, 3) s);
  insert into public.demandes (candidat_id, prenom, annee_naissance, poste, departement, ville, zone, partout, periodes, dispo_debut, dispo_fin,
                               diplomes, experiences, message, email_contact, seize_ans, destinataires)
  values (qui, d ->> 'prenom', nullif(d ->> 'annee_naissance', '')::smallint, d ->> 'poste', dep, nullif(d ->> 'ville', ''), z,
          coalesce((d ->> 'partout')::boolean, false),
          array(select jsonb_array_elements_text(coalesce(d -> 'periodes', '[]'))),
          nullif(d ->> 'dispo_debut', '')::date, nullif(d ->> 'dispo_fin', '')::date,
          array(select jsonb_array_elements_text(coalesce(d -> 'diplomes', '[]'))),
          array(select jsonb_array_elements_text(coalesce(d -> 'experiences', '[]'))),
          nullif(d ->> 'message', ''), d ->> 'email_contact', coalesce((d ->> 'seize_ans')::boolean, false), dest);
  return cardinality(dest);
end $$;
revoke all on function public.envoyer_demande(jsonb) from public, anon, authenticated;
grant execute on function public.envoyer_demande(jsonb) to authenticated;

-- ------------------------------------------------------------------ version 8 (11/11/2026)
-- La liste publique des animateurs : un résumé seulement (prénom, poste, département, diplômes, période),
-- sans ville, âge, présentation, CV ni contact. La fiche complète reste réservée aux structures vérifiées et abonnées.
-- Le candidat peut retirer son résumé de la liste (resume_public).

alter table public.profils add column if not exists resume_public boolean not null default true;
grant select (resume_public) on public.profils to authenticated;
grant insert (resume_public), update (resume_public) on public.profils to authenticated;

create or replace function public.profils_resume(dep text default null, n integer default 60)
returns table (id uuid, prenom text, poste_recherche text, departement text, diplomes text[], recherche text[],
               dispo_debut date, dispo_fin date, cv boolean, qualifs integer, maj_le timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.prenom, p.poste_recherche, p.departement, p.diplomes, p.recherche, p.dispo_debut, p.dispo_fin,
         p.cv_nom is not null, jsonb_array_length(p.qualifications), p.maj_le
  from public.profils p
  where p.publie and p.resume_public
    and (dep is null or dep = '' or p.departement = dep or dep = any (p.mobilite))
  order by p.maj_le desc
  limit greatest(1, least(n, 100)) $$;
revoke all on function public.profils_resume(text, integer) from public, anon, authenticated;
grant execute on function public.profils_resume(text, integer) to anon, authenticated;

-- ------------------------------------------------------------------ version 9 (13/11/2026)
-- Le tableau de bord des structures : les vues de leur page et de leurs offres, et les clics (candidater, site).
-- Rien de personnel : un compteur par structure, par jour, par type (et par offre). Les pages publiques comptent
-- par la fonction compter (une fois par visite et par page, côté navigateur) ; chaque structure lit les siens.

create table if not exists public.stats_jour (
  structure_id uuid not null references public.structures (id) on delete cascade,
  jour         date not null default current_date,
  type         text not null check (type in ('page', 'offre', 'clic_candidater', 'clic_site', 'clic_email')),
  offre_id     bigint not null default 0,
  n            integer not null default 0,
  primary key (structure_id, jour, type, offre_id)
);
alter table public.stats_jour enable row level security;
revoke all on public.stats_jour from anon, authenticated;

create or replace function public.compter(s uuid, t text, o bigint default 0) returns void
language sql security definer set search_path = '' as $$
  insert into public.stats_jour as x (structure_id, jour, type, offre_id, n)
  select s, current_date, t, coalesce(o, 0), 1
  where t in ('page', 'offre', 'clic_candidater', 'clic_site', 'clic_email')
    and exists (select 1 from public.structures where id = s and verifiee and abonnement_fin >= current_date)
  on conflict (structure_id, jour, type, offre_id) do update set n = least(x.n + 1, 100000) $$;

create or replace function public.mes_stats(jours integer default 60)
returns table (jour date, type text, offre_id bigint, n integer)
language sql stable security definer set search_path = '' as $$
  select jour, type, offre_id, n from public.stats_jour
  where structure_id = auth.uid() and jour > current_date - least(greatest(jours, 1), 400)
  order by jour $$;

revoke all on function public.compter(uuid, text, bigint), public.mes_stats(integer) from public, anon, authenticated;
grant execute on function public.compter(uuid, text, bigint) to anon, authenticated;
grant execute on function public.mes_stats(integer) to authenticated;

-- ------------------------------------------------------------------ version 10 (14/11/2026)
-- Les ressources des structures abonnées (guides et conseils pour recruter). Leur texte n'est que dans la base,
-- jamais dans le dépôt ni sur le site public : seul le compte d'une structure à l'abonnement en cours peut les lire.
create table if not exists public.ressources_structures (
  slug text primary key, type text not null check (type in ('guide', 'conseil')), titre text not null,
  court text, resume text, html text not null, ordre integer not null default 9, maj date);
alter table public.ressources_structures enable row level security;
revoke all on public.ressources_structures from anon, authenticated;
grant select on public.ressources_structures to authenticated;
drop policy if exists "structures abonnées : lire" on public.ressources_structures;
create policy "structures abonnées : lire" on public.ressources_structures for select to authenticated
  using (exists (select 1 from public.structures s where s.id = (select auth.uid()) and s.abonnement_fin >= current_date));

-- ------------------------------------------------------------------ version 11 (14/11/2026)
-- L'administration : la table admins, est_admin(), admin_donnees() (tout, pour les statistiques et les listes),
-- admin_modifier(table, clé, champs) (colonnes prévues seulement) et admin_supprimer(table, clé).
-- Voir la migration v11_espace_admin dans Supabase pour le détail ; le compte admin est ajouté dans la base, pas ici.

-- ------------------------------------------------------------------ versions 12 et 13 (14/11/2026)
-- v12 : evenements_admin, remplie par la base à chaque fiche animateur, structure, paiement ou demande ;
--       outils/abonnements.py en envoie le résumé à l'adresse du site toutes les 15 minutes.
-- v13 : structure_payee() ; une structure n'écrit ses offres et ses centres qu'avec un abonnement en cours.

-- v14 (16/11/2026) : structures.statut (association, collectivite, entreprise, autre), structures.accueils text[]
-- (periscolaire, extrascolaire, accueil-de-jeunes, sejours, mini-camps, autre), structures.age_min / age_max (0 à 30),
-- code_commune (code INSEE de la liste officielle) sur structures, centres et profils, public « 18-25 ».
-- Le « type » reste rempli (déduit des accueils) pour les pages et filtres d'avant.

-- v15 (16/11/2026) : chiffres_publics() (security definer, lisible par tous) : pour la page /chiffres/ et l'accueil,
-- les demandes de l'annuaire inversé et les candidatures (poste, département, ville éventuelle, mois, état, source :
-- jamais de nom, de message ni de coordonnées), sans les comptes de l'administration ; et le nombre de structures
-- en ligne par département.

-- v16 (16/11/2026) : l'administration (est_admin()) lit et modifie structures, offres, centres et profils de tous les
-- comptes, et lit candidatures, demandes et favoris (« Ouvrir son espace » depuis l'admin). insert (structure_id) sur
-- offres et centres : les règles des autres comptes imposent toujours leur propre identifiant.

-- v17 (16/11/2026) : demandes.suivi (a_traiter, en_cours, traitee) et demandes.note_admin (QG demandes) ;
-- table admin_audience (audience détaillée écrite par outils/audience.py avec la clé secrète, lisible par l'admin seul) ;
-- admin_modifier accepte demandes (suivi, note_admin, destinataires) ; admin_sante() (e-mails, stockage, base, alertes).

-- v18 (16/11/2026) : profils.provenance et structures.provenance (canal du premier passage, noté à la création) ;
-- table admin_prospects (prospection : organismes, structures, contacts ; statut, étapes, note), réservée à l'admin.

-- ------------------------------------------------------------------ version 19 (16/11/2026)
-- Administration, partie 3 : admin_indexation (état des pages dans Google, rempli par outils/indexation.py),
-- actualites (écrites par l'admin, lues par les membres connectés quand elles sont publiées),
-- admin_posts (posts publiés sur les réseaux), et l'admin peut créer ou supprimer des guides et conseils.
-- Voir la migration v19_indexation_actualites_posts dans Supabase pour le détail.

-- ------------------------------------------------------------------ version 20 (17/11/2026)
-- Nouveau modèle. Organismes : stats_organismes (vues de leur page, clics vers leurs sessions et leur site,
-- via compter_organisme(o, t), appelable par tous) et contacts_organismes (formulaire « Organismes partenaires »,
-- noté dans evenements_admin type 'organisme'). Structures : la page et UNE offre en ligne gratuites dès la
-- vérification (est_verifiee, règle « structures vérifiées visibles », compter) ; peut_publier_offre() refuse une
-- 2e offre publiée sans abonnement. structures_abonnees() (étiquette « Partenaire ») et demandes_du_secteur().
-- L'abonnement garde : les demandes de l'annuaire inversé, les profils complets, les centres, la boîte à outils.
-- Voir les migrations v19b_droits_releve et v20_modele_gratuit_organismes dans Supabase.

-- ------------------------------------------------------------------ version 21 (17/11/2026)
-- Organismes de formation : zones_tarifs (prix de chaque département selon les 15-24 ans INSEE 2025, les sessions et les
-- recherches : 490 / 290 / 190 / 90 € par an ; deux places dans les six plus grands), comptes_organismes (leur fiche,
-- reliée par l'admin à un organisme du site et vérifiée via admin_organisme()), partenariats (réservation -> facture ->
-- actif un an ; une place par département, index unique), zones_disponibles(), reserver_zones() (moitié prix pour les
-- 10 premiers organismes : lancement_ouvert()), annuler_reservation(), admin_partenariat(), partenaires_publics()
-- (lu à la publication). Les factures sont créées et suivies par outils/abonnements.py.
-- Voir les migrations v21a, v21b et v21c dans Supabase.

-- ------------------------------------------------------------------ version 22 (17/11/2026)
-- organismes_inscrits() (page « Les organismes », fiches vérifiées seulement) ; stats_organismes.departement
-- (clics comptés département par département, compter_organisme(o, t, d)).

-- v23 (appliquée par migration) : formule partenaire au clic. secret_interne (sel des empreintes), clics_facturables
-- (une personne = un hachage IP + navigateur + jour + sel ; un clic par personne, par organisme et par jour ; robots exclus ;
-- plus de 5 organismes cliqués dans la journée = plus compté), partenariats.prix_clic / arrete_le, factures_clics (mois échus),
-- mes_clics() (le détail pour l'organisme), arreter_partenariat(), reserver_zones() sans paiement d'avance (actif dès la
-- vérification), admin_organisme() active les départements réservés. v23b : clics_par_jour() pour le relevé (rôle serveur).

-- v24 / v24b / v24c (appliquées par migration) : « Trouver un séjour », semaine 1. Tables sejours, sejours_dates,
-- demandes_sejour (lue seulement par fonctions), alertes_sejour, stats_sejours ; structures.demandes_gratuites_utilisees
-- et banniere ; type d'événement 'sejour'. Fonctions : demander_place() (2 demandes gratuites complètes, puis coordonnées
-- masquées), mes_demandes_sejour(), ouvrir_demandes() (relevé des paiements ou admin), repondre_demande(),
-- creer_alerte() / confirmer_alerte() / desinscrire_alerte(), compter_sejour(), structure_en_ligne(). Stockage « sejours ».

-- v25 (appliquée par migration) : demandes_sejour.famille_prevenue_le / structure_prevenue_le, et demandes_a_prevenir()
-- (rôle serveur) pour les e-mails : accusé de réception à la famille, nouvelle demande à la structure (coordonnées
-- seulement si la demande est ouverte). Envoyés par outils/abonnements.py (demandes_sejours), toutes les 15 minutes.

-- v26 (appliquée par migration) : alertes_sejour.confirmation_envoyee_le ; creer_alerte() ne garde que les critères connus
-- (âge, période, département, envie, type) et freine les envois en masse. Confirmation par e-mail et effacement des
-- alertes non confirmées après 7 jours : outils/abonnements.py (alertes_sejours). Page de lien : /sejours/alerte/.

-- v27 / v27b (appliquées par migration) : structures.rappel_demandes_le (rappel du lundi), stats_sejours.type 'alerte'
-- (envois du jeudi), admin_prospects.type 'organisateur' (prospection des organisateurs de séjours). Les e-mails :
-- outils/abonnements.py (sejours_relances : alertes du jeudi, relance des familles à 5 jours, rappel du lundi).

-- v28 (appliquée par migration) : l'administration peut créer un séjour (et ses photos) dans l'espace d'une structure,
-- pour l'offre « nous publions votre premier séjour pour vous ».

-- v29 (appliquée par migration) : e-mails immédiats. pg_net ; ranger_cle_envoi() (le relevé GitHub dépose la clé Brevo
-- dans le coffre-fort chiffré) ; envoyer_mail() ; déclencheurs prevenir_demande (accusé famille + demande à la structure,
-- coordonnées seulement si la demande est ouverte) et confirmer_alerte_mail. Le relevé reste le filet de sécurité.

-- v29b / v29c (appliquées par migration) : alertes_sejour.vu_le et alerte_vue() (un clic depuis l'e-mail du jeudi garde
-- l'alerte ; sans clic depuis un an, elle est effacée) ; structures.banniere (photo facultative en haut de la page).

-- v30 (appliquée par migration) : profils.verifie ; un profil n'apparaît dans l'annuaire public (profils_resume) qu'une
-- fois vérifié par l'administration (admin_verifier_profil).

-- v31 / v31b / v32 (appliquées par migration) : « Inscrire mon enfant » (adresses /enfants/ dans les e-mails), type
-- accueil_periscolaire ; besoins_familles + besoins_destinataires (l'annuaire inversé des parents : deposer_besoin(),
-- mes_besoins_familles(), repondre_besoin(), e-mails immédiats prevenir_besoin / accuse_besoin), ouvrir_demandes() ouvre
-- aussi les besoins masqués au paiement.

-- v33 (appliquée par migration) : candidatures_sejour (un animateur postule pour encadrer un séjour ou un accueil) :
-- postuler_sejour(), mes_candidatures_sejour() (structure), mes_postulations_sejour() (animateur), repondre_candidature_sejour(),
-- e-mail immédiat à la structure (prevenir_candidature_sejour).

-- v34 (appliquée par migration) : chiffres_publics() ajoute familles (besoins et demandes de place, sans rien sur la personne),
-- fiches_animateurs (vérifiées), structures_verifiees, offres_enfants.

-- v35 (appliquée par migration) : comptes_parents, enfants (prénom, année de naissance), demandes_sejour.parent_id et
-- besoins_familles.parent_id (rattachés par l'adresse e-mail : trigger rattacher_demandes, lier_mes_demandes()),
-- mes_inscriptions(), carnet_sejour (les nouvelles de l'équipe), ecrire_carnet(sid, j, did, titre, texte, auteur)
-- (structure, admin ou lien d'équipe sejours.jeton_carnet), carnet_equipe(j), mon_carnet(), e-mail aux parents
-- dont la demande est acceptée (prevenir_carnet), est_parent().
-- v35b : jeton_carnet privé (select par colonnes sur sejours pour anon/authenticated, sans jeton_carnet),
-- lien_carnet(sid, nouveau) pour la structure ou l'admin.

-- v36 (appliquée par migration) : les structures abonnées ne lisent que les profils publiés ET vérifiés par l'admin ;
-- cv_lisible() : l'admin lit tous les CV, les structures abonnées ceux des profils publiés et vérifiés (et de leurs candidats).
-- v37 (appliquée par migration) : admin_indexation.lien (inspectionResultLink de l'API Search Console : lien direct vers l'inspection).
-- v38 (appliquée par migration) : l'admin lit comptes_parents et enfants ; admin_corriger_demande(t, id, champs) corrige une demande des annuaires inversés (demandes, besoins_familles), colonnes prévues seulement.

-- v39 (21/11/2026) : outils/prospection.py lit et met à jour la liste de prospection avec la clé serveur
grant select, update on public.admin_prospects to service_role;

-- v40 (22/11/2026) : le QG de l'admin traite aussi les besoins des familles (suivi, note, transmission à une structure)
alter table public.besoins_familles add column if not exists suivi text not null default 'a_traiter' check (suivi in ('a_traiter','en_cours','traitee'));
alter table public.besoins_familles add column if not exists note_admin text check (char_length(note_admin) <= 2000);
-- admin_modifier : « besoins_familles » ajouté (suivi, note_admin) ; nouvelle fonction admin_transmettre_besoin(besoin, structure)
-- (texte complet appliqué dans la migration v40_qg_familles)

-- v41 (22/11/2026) : admin_depenses (nom, montant_an, note, ordre), lue et modifiée par l'administration seulement (page Ventes)
-- v43 (23/11/2026) : les paiements Stripe arrivent tout de suite (webhook) au lieu d'attendre le robot de GitHub,
-- que GitHub ne lance que toutes les 4 à 8 heures. Le relais supabase/functions/stripe reçoit l'événement de Stripe,
-- relit le paiement chez Stripe (clé de lecture rangée dans le coffre-fort par outils/abonnements.py) puis appelle
-- stripe_paiement(). Le robot reste en filet de sécurité : il refait les mêmes calculs à chaque passage.

-- la clé de lecture Stripe, rangée par le robot comme la clé Brevo
create or replace function public.ranger_cle_stripe(k text) returns void
language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  if coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role' then raise exception 'Réservé au relevé.'; end if;
  if k is null or char_length(k) < 20 then return; end if;
  select id into sid from vault.secrets where name = 'stripe_abonnements';
  if sid is null then perform vault.create_secret(k, 'stripe_abonnements', 'Clé Stripe en lecture (paiements immédiats)');
  elsif (select decrypted_secret from vault.decrypted_secrets where id = sid) is distinct from k then perform vault.update_secret(sid, k); end if;
end $$;

create or replace function public.cle_stripe() returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role' then raise exception 'Réservé au relais.'; end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = 'stripe_abonnements');
end $$;

-- l'e-mail « paiement reçu » à l'administration, sans attendre le robot (les autres événements restent groupés)
create or replace function public.prevenir_admin_paiements() returns void
language plpgsql security definer set search_path = '' as $$
declare ids bigint[]; lignes text; lignes_html text;
begin
  select array_agg(id order by cree_le), string_agg('- ' || resume, E'\n' order by cree_le),
         string_agg('<li>' || replace(replace(replace(resume, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</li>', '' order by cree_le)
    into ids, lignes, lignes_html
    from public.evenements_admin where type = 'paiement' and not envoye;
  if ids is null then return; end if;
  if public.envoyer_mail('contact@filrouganim.fr', 'Fil Roug''Anim : ' || case when cardinality(ids) > 1 then cardinality(ids) || ' paiements reçus' else 'paiement reçu' end,
       'Paiement reçu :' || E'\n' || lignes || E'\n\nTout voir dans l''espace admin : https://filrouganim.fr/compte/?role=admin',
       '<h3 style="margin:0 0 6px">Paiement reçu</h3><ul style="margin:0;padding-left:18px">' || lignes_html || '</ul>'
       || '<p style="margin-top:20px"><a href="https://filrouganim.fr/compte/?role=admin" style="display:inline-block;background:#d61f35;color:#fff;padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Ouvrir l''espace admin</a></p>') then
    update public.evenements_admin set envoye = true where id = any(ids);
  end if;
end $$;

-- s : la session de paiement (Checkout) relue chez Stripe, ou null ; a : l'abonnement relu chez Stripe, ou null.
-- Mêmes règles que outils/abonnements.py (liens de config.yml : abonnement.liens_stripe et abonnement.lien_pass_mois).
create or replace function public.stripe_paiement(s jsonb, a jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  liens constant text[] := array['plink_1UaMsiKIAmufAQXGfqHfwFYK', 'plink_1UaMzrKIAmufAQXGhXgOnrPD'];
  lien_pass constant text := 'plink_1UcoRtKIAmufAQXGGbhTWC07';
  sid uuid; st public.structures; ref text; marque text; mois int; fin date; t bigint; q int; res text := '';
begin
  if coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') <> 'service_role' then raise exception 'Réservé au relais.'; end if;
  ref := trim(coalesce(s ->> 'client_reference_id', ''));
  if ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then sid := ref::uuid; end if;

  -- 1. le Pass recrutement (paiement unique) : 1 à 5 mois à partir d'aujourd'hui ou de la fin déjà payée
  if s is not null and s ->> 'payment_link' = lien_pass and s ->> 'payment_status' = 'paid' then
    marque := '[' || right(s ->> 'id', 10) || ']';
    select * into st from public.structures where id = sid;
    if st.id is null then
      insert into public.evenements_admin (type, resume) values ('paiement', 'Pass payé sans structure reconnue : à rattacher à la main ' || marque);
    elsif not exists (select 1 from public.evenements_admin where resume like '%' || marque || '%') then
      mois := greatest(1, round(coalesce((s ->> 'amount_total')::numeric, 1500) / 1500));
      fin := (greatest(current_date, coalesce(st.abonnement_fin, current_date)) + make_interval(months => mois))::date;
      update public.structures set abonnement_fin = fin where id = st.id;
      insert into public.evenements_admin (type, resume) values ('paiement', st.nom || ' · Pass ' || mois || ' mois, jusqu''au ' || to_char(fin, 'DD/MM/YYYY') || ' ' || marque);
      res := 'pass ' || mois || ' mois';
    end if;
  end if;

  -- 2. l'abonnement annuel : fin de période (+3 jours de grâce), centres payés, tarif fondateur
  if a is not null and coalesce(a -> 'metadata' ->> 'site', '') = 'filrouganim' then
    if s is null or not (s ->> 'payment_link' = any(liens)) then sid := null; end if;
    if sid is null then select id into sid from public.structures where abonnement_id = a ->> 'id'; end if;
    if sid is null and coalesce(a -> 'metadata' ->> 'structure_id', '') ~ '^[0-9a-f-]{36}$' then sid := (a -> 'metadata' ->> 'structure_id')::uuid; end if;
    select * into st from public.structures where id = sid;
    if st.id is null then
      if s is not null then
        insert into public.evenements_admin (type, resume) values ('paiement', 'Abonnement payé sans structure reconnue : à rattacher à la main [' || right(a ->> 'id', 10) || ']');
      end if;
    else
      t := coalesce((a ->> 'current_period_end')::bigint, (a -> 'items' -> 'data' -> 0 ->> 'current_period_end')::bigint);
      if a ->> 'status' = 'canceled' and a ->> 'ended_at' is not null then t := least(coalesce(t, (a ->> 'ended_at')::bigint), (a ->> 'ended_at')::bigint); end if;
      fin := (to_timestamp(t) at time zone 'UTC')::date;
      if a ->> 'status' in ('active', 'trialing', 'past_due') and fin is not null then fin := fin + 3;
      elsif a ->> 'status' in ('incomplete', 'incomplete_expired', 'unpaid') then fin := null; end if;
      select coalesce(sum((x ->> 'quantity')::int), 0) into q from jsonb_array_elements(coalesce(a -> 'items' -> 'data', '[]')) x;
      q := least(greatest(q, 1), 50);
      -- une structure qui a deux abonnements (un ancien arrêté, un nouveau) : on garde celui qui finit le plus tard
      if st.abonnement_id is not null and st.abonnement_id <> a ->> 'id' and st.abonnement_fin is not null and coalesce(fin, '-infinity') < st.abonnement_fin then
        res := res || ' ancien abonnement ignoré';
      elsif st.abonnement_id is distinct from a ->> 'id' or st.abonnement_fin is distinct from fin or st.centres_payes is distinct from q
            or st.fondatrice is distinct from (a -> 'metadata' ->> 'formule' = 'fondateur') then
        update public.structures set abonnement_id = a ->> 'id', abonnement_fin = fin, centres_payes = q,
               fondatrice = (a -> 'metadata' ->> 'formule' = 'fondateur') where id = st.id;
        res := res || ' abonnement jusqu''au ' || coalesce(fin::text, 'aucun');
      end if;
    end if;
  end if;

  -- 3. ce que l'abonnement ouvre tout de suite : demandes de séjour masquées, demandes d'animateurs en attente
  if st.id is not null and exists (select 1 from public.structures where id = st.id and abonnement_fin >= current_date) then
    begin
      perform public.ouvrir_demandes(st.id);
      perform public.relayer_demandes();
    exception when others then res := res || ' (demandes : ' || sqlerrm || ')';
    end;
  end if;
  perform public.prevenir_admin_paiements();
  return trim(res);
end $$;

revoke all on function public.ranger_cle_stripe(text), public.cle_stripe(), public.prevenir_admin_paiements(), public.stripe_paiement(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ranger_cle_stripe(text), public.cle_stripe(), public.stripe_paiement(jsonb, jsonb) to service_role;

-- v44 (23/11/2026) : l'e-mail « Nouvelle demande » part tout de suite chez chaque structure qui reçoit la demande d'un
-- animateur (à l'envoi, à un relais quand une structure arrive dans la zone, à une transmission par l'admin), au lieu
-- d'attendre le robot de GitHub. Même texte que outils/abonnements.py (demandes), qui reste en filet de sécurité :
-- une structure n'est notée dans « notifiees » que si l'e-mail est vraiment parti.
create or replace function public.prevenir_demande() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid; st record; envoyees uuid[] := coalesce(new.notifiees, '{}'); poste text; quand text; lieu text; sujet text;
  bouton constant text := 'display:inline-block;background:#d61f35;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold';
begin
  poste := case new.poste when 'animateur-stagiaire' then 'Stage pratique BAFA' when 'animateur' then 'Animateur ou animatrice'
    when 'directeur' then 'Direction ou adjoint' when 'surveillant-baignade' then 'Surveillance de baignade'
    when 'directeur-adjoint' then 'Direction adjointe' when 'autre' then 'Autre poste' else new.poste end;
  quand := array_to_string(array(select case p when 'ete' then 'l''été' when 'petites-vacances' then 'les petites vacances'
    when 'mercredis' then 'les mercredis' when 'periscolaire' then 'le périscolaire' when 'annee' then 'toute l''année' else p end
    from unnest(coalesce(new.periodes, '{}')) p), ', ');
  lieu := coalesce(new.ville || ', ', '') || new.departement || case when new.partout then ' · partout en France' else '' end;
  sujet := 'Nouvelle demande : ' || poste || ', ' || lieu;
  foreach sid in array coalesce(new.destinataires, '{}') loop
    continue when sid = any(envoyees);
    select nom, email_contact into st from public.structures where id = sid;
    continue when st.email_contact is null;
    if public.envoyer_mail(st.email_contact, sujet,
         'Bonjour,' || E'\n\n' || coalesce(new.prenom, 'Un animateur') || ' cherche un poste près de chez vous et sa demande vous est arrivée sur Fil Roug''Anim :' || E'\n\n'
         || poste || E'\n' || lieu || case when quand <> '' then ' · ' || quand else '' end || E'\n\n'
         || 'Elle n''est envoyée qu''à 3 structures au plus. Lisez-la et répondez directement depuis votre espace : https://filrouganim.fr/compte/' || E'\n\nL''équipe Fil Roug''Anim',
         '<p>Bonjour,</p><p><b>' || public.html_txt(coalesce(new.prenom, 'Un animateur')) || '</b> cherche un poste près de chez vous et sa demande vous est arrivée sur Fil Roug''Anim :</p>'
         || '<p style="padding:12px 16px;border-left:3px solid #d61f35;background:#fbf8f2"><b>' || public.html_txt(poste) || '</b><br>'
         || public.html_txt(lieu) || case when quand <> '' then ' · ' || public.html_txt(quand) else '' end || '</p>'
         || '<p>Elle n''est envoyée qu''à 3 structures au plus. Lisez-la et répondez directement :</p>'
         || '<p><a href="https://filrouganim.fr/compte/" style="' || bouton || '">Voir la demande</a></p>'
         || '<p style="color:#6b6264;font-size:13px">Fil Roug''Anim · filrouganim.fr</p>') then
      envoyees := array_append(envoyees, sid);
    end if;
  end loop;
  if envoyees is distinct from coalesce(new.notifiees, '{}') then
    update public.demandes set notifiees = envoyees where id = new.id;
  end if;
  return null;
exception when others then return null;   -- un e-mail qui ne part pas ne bloque jamais la demande : le robot réessaiera
end $$;
revoke all on function public.prevenir_demande() from public, anon, authenticated;
drop trigger if exists prevenir_demande on public.demandes;
create trigger prevenir_demande after insert or update of destinataires on public.demandes
  for each row when (cardinality(new.destinataires) > 0) execute function public.prevenir_demande();
-- v45 (23/11/2026) : deux e-mails de plus, envoyés tout de suite par la base.
-- 1. Bienvenue à une structure quand l'administration la vérifie : sa page est en ligne, et les animateurs qui cherchent
--    déjà près de chez elle (demandes de moins de 30 jours, fiches publiées et vérifiées), sans nom de famille ni coordonnées.
-- 2. L'animateur est prévenu quand sa demande, restée en attente, part enfin chez une ou plusieurs structures.
create or replace function public.libelle_poste(p text) returns text
language sql immutable set search_path = '' as $$
  select case p when 'animateur-stagiaire' then 'Stage pratique BAFA' when 'animateur' then 'Animateur ou animatrice'
    when 'directeur' then 'Direction ou adjoint' when 'surveillant-baignade' then 'Surveillance de baignade'
    when 'directeur-adjoint' then 'Direction adjointe' when 'coordinateur' then 'Coordination' when 'autre' then 'Autre poste'
    else coalesce(nullif(p, ''), 'Animation') end $$;

create or replace function public.bienvenue_structure() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  dem text[]; fic text[]; n int; abonnee boolean := new.abonnement_fin >= current_date; t text; h text; sujet text;
  page text := 'https://filrouganim.fr/trouver-un-poste/structures/' || new.slug || '/';
  espace text := 'https://filrouganim.fr/compte/' || case when new.abonnement_fin >= current_date then '' else '?onglet=abonnement' end;
  bouton constant text := 'display:inline-block;background:#d61f35;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold';
begin
  if new.email_contact is null then return null; end if;
  select array_agg(l order by c desc) into dem from (
    select public.libelle_poste(d.poste) || coalesce(' à ' || d.ville, '') || ' (' || d.departement || ')'
           || coalesce(', dès le ' || to_char(d.dispo_debut, 'DD/MM'), '') l, d.cree_le c
    from public.demandes d
    where d.cree_le > now() - interval '30 days' and coalesce(d.suivi, 'a_traiter') <> 'traitee'
      and (d.departement = new.departement or new.departement = any(d.zone) or d.partout)
    order by d.cree_le desc limit 10) x;
  select array_agg(l order by c desc) into fic from (
    select p.prenom || ', ' || lower(public.libelle_poste(p.poste_recherche)) || coalesce(', ' || p.ville, '') || ' (' || p.departement || ')' l, p.cree_le c
    from public.profils p
    where p.publie and p.verifie and (p.departement = new.departement or new.departement = any(coalesce(p.mobilite, '{}')))
    order by p.cree_le desc limit 10) y;
  n := coalesce(cardinality(dem), 0) + coalesce(cardinality(fic), 0);
  sujet := 'Votre structure est vérifiée : votre page est en ligne'
    || case when n > 0 then ' · ' || n || ' animateur' || case when n > 1 then 's' else '' end || ' près de chez vous' else '' end;
  t := 'Bonjour,' || E'\n\n' || 'Bonne nouvelle : ' || new.nom || ' est vérifiée sur Fil Roug''Anim. '
    || case when new.page_publique and new.slug is not null then 'Votre page sera visible dans l''heure : ' || page || E'\n' else E'\n' end
    || 'Vous pouvez publier une offre gratuitement depuis votre espace.';
  h := '<p>Bonjour,</p><p>Bonne nouvelle : <b>' || public.html_txt(new.nom) || '</b> est vérifiée sur Fil Roug''Anim. '
    || case when new.page_publique and new.slug is not null then 'Votre page sera visible dans l''heure : <a href="' || page || '">' || page || '</a>. ' else '' end
    || 'Vous pouvez publier une offre gratuitement depuis votre espace.</p>';
  if dem is not null then
    t := t || E'\n\nPrès de chez vous, des animateurs décrivent le poste qu''ils cherchent :\n- ' || array_to_string(dem, E'\n- ');
    h := h || '<p><b>Près de chez vous, des animateurs décrivent le poste qu''ils cherchent :</b></p><ul>'
      || (select string_agg('<li>' || public.html_txt(x) || '</li>', '') from unnest(dem) x) || '</ul>';
  end if;
  if fic is not null then
    t := t || E'\n\nIls ont publié leur fiche dans votre secteur :\n- ' || array_to_string(fic, E'\n- ');
    h := h || '<p><b>Ils ont publié leur fiche dans votre secteur :</b></p><ul>'
      || (select string_agg('<li>' || public.html_txt(x) || '</li>', '') from unnest(fic) x) || '</ul>';
  end if;
  if n > 0 then
    t := t || E'\n\n' || case when abonnee then 'Leurs fiches complètes et leurs coordonnées sont dans votre espace : écrivez-leur directement.'
      else 'Avec l''abonnement ou le Pass recrutement, leurs demandes arrivent chez vous, vous voyez leurs fiches complètes et vous leur écrivez directement.' end;
    h := h || '<p>' || case when abonnee then 'Leurs fiches complètes et leurs coordonnées sont dans votre espace : écrivez-leur directement.'
      else 'Avec l''abonnement ou le Pass recrutement, leurs demandes arrivent chez vous, vous voyez leurs fiches complètes et vous leur écrivez directement.' end || '</p>';
  end if;
  t := t || E'\n\nVotre espace : ' || espace || E'\n\nL''équipe Fil Roug''Anim';
  h := h || '<p><a href="' || espace || '" style="' || bouton || '">' || case when n > 0 and not abonnee then 'Voir l''abonnement' else 'Ouvrir mon espace' end || '</a></p>'
    || '<p style="color:#6b6264;font-size:13px">Fil Roug''Anim · filrouganim.fr</p>';
  perform public.envoyer_mail(new.email_contact, sujet, t, h);
  return null;
exception when others then return null;   -- un e-mail qui ne part pas ne bloque jamais la vérification
end $$;
revoke all on function public.bienvenue_structure() from public, anon, authenticated;
drop trigger if exists bienvenue_structure on public.structures;
create trigger bienvenue_structure after update of verifiee on public.structures
  for each row when (new.verifiee and not coalesce(old.verifiee, false)) execute function public.bienvenue_structure();

-- prevenir_demande (v44) : en plus, l'animateur est prévenu quand sa demande en attente part enfin chez des structures
create or replace function public.prevenir_demande() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid; st record; envoyees uuid[] := coalesce(new.notifiees, '{}'); poste text; quand text; lieu text; sujet text; noms text;
  bouton constant text := 'display:inline-block;background:#d61f35;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold';
begin
  poste := public.libelle_poste(new.poste);
  quand := array_to_string(array(select case p when 'ete' then 'l''été' when 'petites-vacances' then 'les petites vacances'
    when 'mercredis' then 'les mercredis' when 'periscolaire' then 'le périscolaire' when 'annee' then 'toute l''année' else p end
    from unnest(coalesce(new.periodes, '{}')) p), ', ');
  lieu := coalesce(new.ville || ', ', '') || new.departement || case when new.partout then ' · partout en France' else '' end;
  sujet := 'Nouvelle demande : ' || poste || ', ' || lieu;
  foreach sid in array coalesce(new.destinataires, '{}') loop
    continue when sid = any(envoyees);
    select nom, email_contact into st from public.structures where id = sid;
    continue when st.email_contact is null;
    if public.envoyer_mail(st.email_contact, sujet,
         'Bonjour,' || E'\n\n' || coalesce(new.prenom, 'Un animateur') || ' cherche un poste près de chez vous et sa demande vous est arrivée sur Fil Roug''Anim :' || E'\n\n'
         || poste || E'\n' || lieu || case when quand <> '' then ' · ' || quand else '' end || E'\n\n'
         || 'Elle n''est envoyée qu''à 3 structures au plus. Lisez-la et répondez directement depuis votre espace : https://filrouganim.fr/compte/' || E'\n\nL''équipe Fil Roug''Anim',
         '<p>Bonjour,</p><p><b>' || public.html_txt(coalesce(new.prenom, 'Un animateur')) || '</b> cherche un poste près de chez vous et sa demande vous est arrivée sur Fil Roug''Anim :</p>'
         || '<p style="padding:12px 16px;border-left:3px solid #d61f35;background:#fbf8f2"><b>' || public.html_txt(poste) || '</b><br>'
         || public.html_txt(lieu) || case when quand <> '' then ' · ' || public.html_txt(quand) else '' end || '</p>'
         || '<p>Elle n''est envoyée qu''à 3 structures au plus. Lisez-la et répondez directement :</p>'
         || '<p><a href="https://filrouganim.fr/compte/" style="' || bouton || '">Voir la demande</a></p>'
         || '<p style="color:#6b6264;font-size:13px">Fil Roug''Anim · filrouganim.fr</p>') then
      envoyees := array_append(envoyees, sid);
    end if;
  end loop;
  if envoyees is distinct from coalesce(new.notifiees, '{}') then
    update public.demandes set notifiees = envoyees where id = new.id;
  end if;
  -- la demande attendait (aucune structure à l'envoi) et vient de partir : on le dit à l'animateur
  if tg_op = 'UPDATE' and coalesce(cardinality(old.destinataires), 0) = 0 and new.email_contact is not null then
    select string_agg(s.nom || coalesce(' (' || s.ville || ')', ''), ', ') into noms from public.structures s where s.id = any(new.destinataires);
    perform public.envoyer_mail(new.email_contact, 'Votre demande vient d''arriver chez ' || case when cardinality(new.destinataires) > 1 then cardinality(new.destinataires) || ' structures' else 'une structure' end,
      'Bonjour ' || coalesce(new.prenom, '') || ',' || E'\n\n' || 'Bonne nouvelle : votre demande (' || poste || ', ' || lieu || ') vient d''arriver chez '
      || coalesce(noms, 'une structure de votre secteur') || '.' || E'\n\n'
      || case when cardinality(new.destinataires) > 1 then 'Elles peuvent' else 'Elle peut' end || ' maintenant vous écrire directement : surveillez vos e-mails, et pensez à regarder vos courriers indésirables. Votre espace : https://filrouganim.fr/compte/'
      || E'\n\nL''équipe Fil Roug''Anim',
      '<p>Bonjour ' || public.html_txt(coalesce(new.prenom, '')) || ',</p><p>Bonne nouvelle : votre demande (<b>' || public.html_txt(poste) || '</b>, ' || public.html_txt(lieu)
      || ') vient d''arriver chez <b>' || public.html_txt(coalesce(noms, 'une structure de votre secteur')) || '</b>.</p>'
      || '<p>' || case when cardinality(new.destinataires) > 1 then 'Elles peuvent' else 'Elle peut' end || ' maintenant vous écrire directement : surveillez vos e-mails, et pensez à regarder vos courriers indésirables.</p>'
      || '<p><a href="https://filrouganim.fr/compte/" style="' || bouton || '">Ouvrir mon espace</a></p>'
      || '<p style="color:#6b6264;font-size:13px">Fil Roug''Anim · filrouganim.fr</p>');
  end if;
  return null;
exception when others then return null;   -- un e-mail qui ne part pas ne bloque jamais la demande : le robot réessaiera
end $$;

-- v46 (23/11/2026) : l'e-mail de bienvenue d'une structure vérifiée invite aussi à publier sa première offre et ses séjours
-- (les deux gratuits), avec un lien direct vers l'onglet de son espace.
create or replace function public.bienvenue_structure() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  dem text[]; fic text[]; n int; abonnee boolean := new.abonnement_fin >= current_date; t text; h text; sujet text;
  page text := 'https://filrouganim.fr/trouver-un-poste/structures/' || new.slug || '/';
  espace text := 'https://filrouganim.fr/compte/' || case when new.abonnement_fin >= current_date then '' else '?onglet=abonnement' end;
  bouton constant text := 'display:inline-block;background:#d61f35;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold';
begin
  if new.email_contact is null then return null; end if;
  select array_agg(l order by c desc) into dem from (
    select public.libelle_poste(d.poste) || coalesce(' à ' || d.ville, '') || ' (' || d.departement || ')'
           || coalesce(', dès le ' || to_char(d.dispo_debut, 'DD/MM'), '') l, d.cree_le c
    from public.demandes d
    where d.cree_le > now() - interval '30 days' and coalesce(d.suivi, 'a_traiter') <> 'traitee'
      and (d.departement = new.departement or new.departement = any(d.zone) or d.partout)
    order by d.cree_le desc limit 10) x;
  select array_agg(l order by c desc) into fic from (
    select p.prenom || ', ' || lower(public.libelle_poste(p.poste_recherche)) || coalesce(', ' || p.ville, '') || ' (' || p.departement || ')' l, p.cree_le c
    from public.profils p
    where p.publie and p.verifie and (p.departement = new.departement or new.departement = any(coalesce(p.mobilite, '{}')))
    order by p.cree_le desc limit 10) y;
  n := coalesce(cardinality(dem), 0) + coalesce(cardinality(fic), 0);
  sujet := 'Votre structure est vérifiée : votre page est en ligne'
    || case when n > 0 then ' · ' || n || ' animateur' || case when n > 1 then 's' else '' end || ' près de chez vous' else '' end;
  t := 'Bonjour,' || E'\n\n' || 'Bonne nouvelle : ' || new.nom || ' est vérifiée sur Fil Roug''Anim. '
    || case when new.page_publique and new.slug is not null then 'Votre page sera visible dans l''heure : ' || page || E'\n' else E'\n' end
    || E'\nPour bien démarrer, deux choses gratuites :\n'
    || '- Publiez votre première offre (stage pratique BAFA, job d''été, poste à l''année) : elle paraît sur le site et dans l''alerte des animateurs de votre secteur. ' || 'https://filrouganim.fr/compte/?onglet=offres' || E'\n'
    || '- Vous organisez des séjours ou un accueil de loisirs ? Publiez-les aussi : les familles vous demandent une place directement. ' || 'https://filrouganim.fr/compte/?onglet=sejours';
  h := '<p>Bonjour,</p><p>Bonne nouvelle : <b>' || public.html_txt(new.nom) || '</b> est vérifiée sur Fil Roug''Anim. '
    || case when new.page_publique and new.slug is not null then 'Votre page sera visible dans l''heure : <a href="' || page || '">' || page || '</a>. ' else '' end
    || '</p><p><b>Pour bien démarrer, deux choses gratuites :</b></p><ul>'
    || '<li><a href="https://filrouganim.fr/compte/?onglet=offres">Publiez votre première offre</a> (stage pratique BAFA, job d''été, poste à l''année) : elle paraît sur le site et dans l''alerte des animateurs de votre secteur.</li>'
    || '<li>Vous organisez des séjours ou un accueil de loisirs ? <a href="https://filrouganim.fr/compte/?onglet=sejours">Publiez-les aussi</a> : les familles vous demandent une place directement.</li></ul>';
  if dem is not null then
    t := t || E'\n\nPrès de chez vous, des animateurs décrivent le poste qu''ils cherchent :\n- ' || array_to_string(dem, E'\n- ');
    h := h || '<p><b>Près de chez vous, des animateurs décrivent le poste qu''ils cherchent :</b></p><ul>'
      || (select string_agg('<li>' || public.html_txt(x) || '</li>', '') from unnest(dem) x) || '</ul>';
  end if;
  if fic is not null then
    t := t || E'\n\nIls ont publié leur fiche dans votre secteur :\n- ' || array_to_string(fic, E'\n- ');
    h := h || '<p><b>Ils ont publié leur fiche dans votre secteur :</b></p><ul>'
      || (select string_agg('<li>' || public.html_txt(x) || '</li>', '') from unnest(fic) x) || '</ul>';
  end if;
  if n > 0 then
    t := t || E'\n\n' || case when abonnee then 'Leurs fiches complètes et leurs coordonnées sont dans votre espace : écrivez-leur directement.'
      else 'Avec l''abonnement ou le Pass recrutement, leurs demandes arrivent chez vous, vous voyez leurs fiches complètes et vous leur écrivez directement.' end;
    h := h || '<p>' || case when abonnee then 'Leurs fiches complètes et leurs coordonnées sont dans votre espace : écrivez-leur directement.'
      else 'Avec l''abonnement ou le Pass recrutement, leurs demandes arrivent chez vous, vous voyez leurs fiches complètes et vous leur écrivez directement.' end || '</p>';
  end if;
  t := t || E'\n\nVotre espace : ' || espace || E'\n\nL''équipe Fil Roug''Anim';
  h := h || '<p><a href="' || espace || '" style="' || bouton || '">' || case when n > 0 and not abonnee then 'Voir l''abonnement' else 'Ouvrir mon espace' end || '</a></p>'
    || '<p style="color:#6b6264;font-size:13px">Fil Roug''Anim · filrouganim.fr</p>';
  perform public.envoyer_mail(new.email_contact, sujet, t, h);
  return null;
exception when others then return null;   -- un e-mail qui ne part pas ne bloque jamais la vérification
end $$;

-- v47 (23/11/2026) : supprimer_mon_compte() refuse un compte administrateur ; admins_attente (email) réserve une adresse comme
-- administrateur : le trigger promouvoir_admin_attente (after insert on auth.users) l'ajoute à admins dès que le compte est créé.

-- v48 (24/11/2026) : la fiche structure. « Une journée type » (journee_jour, journee : [{h, t, p}], 8 moments au plus)
-- et « Qui vous accueille » (accueil_prenom, accueil_role, accueil_phrase, accueil_photo ; nb_animateurs, nb_stagiaires, capacite),
-- tous facultatifs : vides, leur bloc ne s'affiche pas. cree_le et maj_le lisibles par anon (« sur le site depuis », « mis à jour »).
alter table public.structures
  add column if not exists journee_jour text check (journee_jour is null or journee_jour in ('mercredi','vacances','sejour','periscolaire')),
  add column if not exists journee jsonb check (journee is null or (jsonb_typeof(journee) = 'array' and jsonb_array_length(journee) <= 8)),
  add column if not exists accueil_prenom text check (accueil_prenom is null or length(accueil_prenom) <= 40),
  add column if not exists accueil_role text check (accueil_role is null or length(accueil_role) <= 80),
  add column if not exists accueil_phrase text check (accueil_phrase is null or length(accueil_phrase) <= 300),
  add column if not exists accueil_photo text check (accueil_photo is null or length(accueil_photo) <= 300),
  add column if not exists nb_animateurs int check (nb_animateurs is null or nb_animateurs between 0 and 2000),
  add column if not exists nb_stagiaires int check (nb_stagiaires is null or nb_stagiaires between 0 and 500),
  add column if not exists capacite int check (capacite is null or capacite between 0 and 10000);
grant select (journee_jour, journee, accueil_prenom, accueil_role, accueil_phrase, accueil_photo, nb_animateurs, nb_stagiaires, capacite, cree_le, maj_le) on public.structures to anon;
grant insert (journee_jour, journee, accueil_prenom, accueil_role, accueil_phrase, accueil_photo, nb_animateurs, nb_stagiaires, capacite),
      update (journee_jour, journee, accueil_prenom, accueil_role, accueil_phrase, accueil_photo, nb_animateurs, nb_stagiaires, capacite) on public.structures to authenticated;

-- v49 (24/11/2026) : la formule gratuite resserrée.
--  * demander_place() et deposer_besoin() : 1 demande de famille complète gratuite (au lieu de 2) ;
--  * prevenir_demande_sejour() : quand la structure ne reçoit pas les coordonnées, l'e-mail à la famille le dit et propose « Décrire mon besoin » ;
--  * limiter_sejours_gratuits (trigger before insert/update of statut on sejours) : sans abonnement, un seul séjour ou accueil publié à la fois ;
--  * structures.demande_offerte : une demande d'animateur offerte, choisie dans demandes_du_secteur_apercu() (sans contact)
--    et ouverte par ouvrir_demande_offerte(did) (la structure est ajoutée aux destinataires) ;
--  * sejour_recoit_demandes(sid) : la fiche séjour prévient la famille avant l'envoi.
-- (fonctions appliquées dans la base : migrations v49_formule_gratuite et v49b_sejour_recoit)

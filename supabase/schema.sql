-- Fil Roug'Anim : les comptes (candidats et structures) et les offres.
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Voir docs/COMPTES-SUPABASE.md.
-- Peut être relancé sans danger : les tables et les données sont gardées, les règles sont remplacées.
-- Version 2 du 25/10/2026 : candidatures, favoris, profils et offres plus complets, purge des comptes inactifs.
-- Version 3 du 26/10/2026 : pages publiques des structures, alertes e-mail des candidats.
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

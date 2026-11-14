/* Fil Roug'Anim : l'espace admin (onglets de « Mon espace » pour les comptes de la table admins).
   Toutes les données viennent de admin_donnees, que la base refuse à tout autre compte ; les modifications passent
   par admin_modifier et admin_supprimer, qui vérifient elles aussi le droit et n'acceptent que les colonnes prévues.
   Les statistiques se calculent ici, dans le navigateur. Ce qui vient des personnes est écrit avec textContent. */
(function () {
  "use strict";
  var E = null, D = null, filtres = {};
  function $(id) { return document.getElementById(id); }
  function el(tag, classe, texte) { var e = document.createElement(tag); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e; }
  var auj = new Date(); auj.setHours(12, 0, 0, 0);
  var AUJ = auj.toISOString().slice(0, 10);
  function jours(n) { var d = new Date(auj); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
  function iso(x) { return (x || "").slice(0, 10); }
  function fr(n) { return Number(n || 0).toLocaleString("fr-FR"); }
  function euros(n) { return Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
  function pct(a, b) { return b ? Math.round(a / b * 100) + " %" : "–"; }
  function compte(liste, f) { return liste.filter(f).length; }
  function lib(liste, v) { try { return E.libelle(liste, v); } catch (e) { return v; } }
  var POSTES_D = { "animateur-stagiaire": "Stage pratique BAFA", "animateur": "Animateur", "directeur": "Direction", "directeur-adjoint": "Direction adjointe", "surveillant-baignade": "Baignade", "autre": "Autre" };
  var PERIODES = { "ete": "Été", "petites-vacances": "Petites vacances", "mercredis": "Mercredis", "periscolaire": "Périscolaire", "annee": "Toute l'année", "stage-pratique": "Stage pratique" };
  var STATUTS = { envoyee: "Nouvelle", vue: "Vue", retenue: "Retenue", "non-retenue": "Non retenue" };
  function paye(s) { return !!(s.abonnement_fin && s.abonnement_fin >= AUJ); }
  function enLigne(o) { return o.publiee && o.expire_le >= AUJ; }

  /* -- briques d'affichage -- */
  function section(conteneur, titre, sous) {
    var s = el("div", "ad-section"); var h = el("h3", null, titre); s.appendChild(h);
    if (sous) s.appendChild(el("p", "petit", sous));
    conteneur.appendChild(s); return s;
  }
  function tuiles(conteneur, liste) {
    var g = el("div", "ad-tuiles");
    liste.forEach(function (t) {
      var b = el("div", "ad-tuile" + (t[3] ? " ad-tuile-" + t[3] : ""));
      b.appendChild(el("b", null, t[0])); b.appendChild(el("span", null, t[1])); if (t[2]) b.appendChild(el("small", null, t[2]));
      g.appendChild(b);
    });
    conteneur.appendChild(g);
  }
  function barres(conteneur, titre, paires, total) {
    var b = el("div", "ad-barres"); b.appendChild(el("p", "tb-l", titre));
    if (!paires.length) { b.appendChild(el("p", "petit", "Pas encore de donnée.")); conteneur.appendChild(b); return; }
    var max = Math.max.apply(null, paires.map(function (p) { return p[1]; })) || 1;
    paires.forEach(function (p) {
      var l = el("div", "ad-barre");
      l.appendChild(el("span", "ad-barre-nom", p[0]));
      var j = el("span", "ad-barre-jauge"); var r = el("i"); r.style.width = Math.max(2, p[1] / max * 100) + "%"; j.appendChild(r); l.appendChild(j);
      l.appendChild(el("b", null, fr(p[1]) + (total ? " · " + pct(p[1], total) : "")));
      b.appendChild(l);
    });
    conteneur.appendChild(b);
  }
  function repartir(liste, cle, nommer, limite) {
    var c = {};
    liste.forEach(function (x) {
      var v = typeof cle === "function" ? cle(x) : x[cle];
      (Array.isArray(v) ? v : [v]).forEach(function (k) { if (k === null || k === undefined || k === "") return; c[k] = (c[k] || 0) + 1; });
    });
    return Object.keys(c).map(function (k) { return [nommer ? nommer(k) : k, c[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, limite || 12);
  }
  function courbe(conteneur, titre, parJour, nbJours, sous) {
    var b = el("div", "ad-courbe"); var t = el("p", "tb-l", titre); if (sous) t.appendChild(el("small", null, " " + sous)); b.appendChild(t);
    var g = el("div", "tb-graphe"), max = 0, tot = 0, i, v;
    for (i = nbJours - 1; i >= 0; i--) { v = parJour[jours(i)] || 0; max = Math.max(max, v); tot += v; }
    for (i = nbJours - 1; i >= 0; i--) {
      v = parJour[jours(i)] || 0;
      var r = el("span", "tb-barre" + (v ? "" : " tb-zero")); r.style.height = (max ? Math.max(3, v / max * 100) : 3) + "%";
      r.title = new Date(jours(i) + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " : " + v; g.appendChild(r);
    }
    b.appendChild(g); b.appendChild(el("p", "petit", fr(tot) + " sur " + nbJours + " jours"));
    conteneur.appendChild(b);
  }
  function parJour(liste, champ) { var c = {}; liste.forEach(function (x) { var j = iso(x[champ]); if (j) c[j] = (c[j] || 0) + 1; }); return c; }
  function entonnoir(conteneur, titre, etapes) {
    var b = el("div", "ad-entonnoir"); b.appendChild(el("p", "tb-l", titre));
    var premier = etapes[0][1] || 0;
    etapes.forEach(function (e, i) {
      var l = el("div", "ad-etape");
      var j = el("span", "ad-etape-jauge"); var r = el("i"); r.style.width = (premier ? Math.max(2, e[1] / premier * 100) : 2) + "%"; j.appendChild(r);
      l.appendChild(el("span", "ad-etape-nom", e[0])); l.appendChild(j);
      l.appendChild(el("b", null, fr(e[1]) + (i ? " · " + pct(e[1], premier) : "")));
      b.appendChild(l);
    });
    conteneur.appendChild(b);
  }
  function grille(conteneur) { var g = el("div", "ad-grille"); conteneur.appendChild(g); return g; }

  /* -- statistiques -- */
  function stats() {
    if (window.FRA_STATS) { window.FRA_STATS.rendre($("ad-stats"), D, E); return; }
    var c = $("ad-stats"); c.textContent = "";
    c.appendChild(el("h2", null, "Statistiques"));
    var p = D.profils, s = D.structures, o = D.offres, d = D.demandes, ca = D.candidatures, u = D.comptes;
    var payees = s.filter(paye), verif = s.filter(function (x) { return x.verifiee; }), actives = s.filter(function (x) { return x.verifiee && paye(x); });
    var revenu = payees.reduce(function (a, x) {
      var base = x.fondatrice ? 39.5 : 79, centres = Math.max(0, (x.centres_payes || 1) - 1);
      return a + base + centres * base / 2;
    }, 0);
    var vues30 = D.vues.filter(function (v) { return v.jour >= jours(29); });
    var sv = function (types) { return vues30.filter(function (v) { return types.indexOf(v.type) >= 0; }).reduce(function (a, v) { return a + v.n; }, 0); };
    var actifs7 = compte(u, function (x) { return iso(x.derniere) >= jours(6); }), actifs30 = compte(u, function (x) { return iso(x.derniere) >= jours(29); });

    var s1 = section(c, "En un coup d'œil");
    tuiles(s1, [
      [fr(u.length), "comptes", "+" + compte(u, function (x) { return iso(x.cree_le) >= jours(6); }) + " en 7 jours · +" + compte(u, function (x) { return iso(x.cree_le) >= jours(29); }) + " en 30 jours"],
      [fr(p.length), "profils d'animateurs", compte(p, function (x) { return x.publie; }) + " visibles · " + compte(p, function (x) { return x.cv_nom; }) + " avec CV"],
      [fr(s.length), "structures", payees.length + " payées · " + verif.length + " vérifiées · " + actives.length + " en ligne"],
      [euros(revenu), "de revenu annuel", "abonnements en cours, centres compris (estimation)", "accent"],
      [fr(compte(o, enLigne)), "offres en ligne", o.length + " offres au total"],
      [fr(ca.length), "candidatures", compte(ca, function (x) { return iso(x.cree_le) >= jours(29); }) + " en 30 jours"],
      [fr(d.length), "demandes (annuaire inversé)", compte(d, function (x) { return !(x.destinataires || []).length; }) + " en attente de structure"],
      [fr(sv(["page", "offre"])), "vues en 30 jours", sv(["page"]) + " pages · " + sv(["offre"]) + " offres · " + sv(["clic_candidater", "clic_email", "clic_site"]) + " clics"],
      [fr(actifs7), "comptes actifs en 7 jours", actifs30 + " en 30 jours"],
      [fr(D.favoris), "favoris posés par les structures", ""]
    ]);

    var s2 = section(c, "Dans le temps");
    var g2 = grille(s2);
    courbe(g2, "Nouveaux comptes", parJour(u, "cree_le"), 90, "90 jours");
    var vj = {}; D.vues.forEach(function (v) { if (v.type === "page" || v.type === "offre") vj[v.jour] = (vj[v.jour] || 0) + v.n; });
    courbe(g2, "Vues des pages et des offres", vj, 90, "90 jours");
    courbe(g2, "Profils créés", parJour(p, "cree_le"), 90, "90 jours");
    courbe(g2, "Structures inscrites", parJour(s, "cree_le"), 90, "90 jours");
    courbe(g2, "Candidatures", parJour(ca, "cree_le"), 90, "90 jours");
    courbe(g2, "Demandes de l'annuaire inversé", parJour(d, "cree_le"), 90, "90 jours");
    var cj = {}; D.vues.forEach(function (v) { if (v.type.indexOf("clic_") === 0) cj[v.jour] = (cj[v.jour] || 0) + v.n; });
    courbe(g2, "Clics (postuler, e-mail, site)", cj, 90, "90 jours");
    courbe(g2, "Offres publiées", parJour(o, "cree_le"), 90, "90 jours");

    var s3 = section(c, "Les parcours", "Où les gens s'arrêtent, de l'inscription à l'action.");
    var g3 = grille(s3);
    var idsProfils = {}; p.forEach(function (x) { idsProfils[x.id] = 1; });
    var ontPostule = {}; ca.forEach(function (x) { ontPostule[x.candidat_id] = 1; });
    var ontDemande = {}; d.forEach(function (x) { ontDemande[x.candidat_id] = 1; });
    entonnoir(g3, "Animateurs", [["Comptes", u.length - s.length], ["Profil créé", p.length], ["Profil visible", compte(p, function (x) { return x.publie; })],
      ["Avec CV", compte(p, function (x) { return x.cv_nom; })], ["Ont postulé", Object.keys(ontPostule).length], ["Ont envoyé une demande", Object.keys(ontDemande).length]]);
    var avecOffre = {}; o.filter(enLigne).forEach(function (x) { avecOffre[x.structure_id] = 1; });
    entonnoir(g3, "Structures", [["Inscrites", s.length], ["Abonnement payé", payees.length], ["Vérifiées", verif.length],
      ["Page publique", compte(s, function (x) { return x.verifiee && paye(x) && x.page_publique && x.slug; })], ["Avec une offre en ligne", Object.keys(avecOffre).length]]);

    var s4 = section(c, "Les animateurs");
    var g4 = grille(s4);
    barres(g4, "Par département (top 12)", repartir(p, "departement", function (k) { return E.nomDep(k) + " (" + k + ")"; }), p.length);
    barres(g4, "Par diplôme", repartir(p, "diplomes", function (k) { return lib("diplomes", k); }), p.length);
    barres(g4, "Par âge", repartir(p, function (x) {
      var a = x.annee_naissance ? auj.getFullYear() - x.annee_naissance : null;
      return a === null ? "Non renseigné" : a < 18 ? "16-17 ans" : a < 21 ? "18-20 ans" : a < 26 ? "21-25 ans" : a < 36 ? "26-35 ans" : "36 ans et plus";
    }), p.length);
    barres(g4, "Ce qu'ils cherchent", repartir(p, "recherche", function (k) { return PERIODES[k] || lib("recherche", k); }), p.length);
    barres(g4, "Qualifications", repartir(p, function (x) { return (x.qualifications || []).map(function (q) { return q.q; }); }, function (k) { return (E.L.qualifs || {})[k] || k; }), p.length);
    barres(g4, "Prêts à bouger", [["Plusieurs départements", compte(p, function (x) { return (x.mobilite || []).length > 0; })], ["Partout en France", compte(p, function (x) { return (x.mobilite || []).indexOf("france") >= 0; })], ["Permis B", compte(p, function (x) { return x.permis_b; })]], p.length);

    var s5 = section(c, "Les structures et les offres");
    var g5 = grille(s5);
    barres(g5, "Structures par type", repartir(s, "type", function (k) { return lib("types", k); }), s.length);
    barres(g5, "Structures par département", repartir(s, "departement", function (k) { return E.nomDep(k) + " (" + k + ")"; }), s.length);
    barres(g5, "Abonnements", [["Tarif fondateur", compte(payees, function (x) { return x.fondatrice; })], ["Tarif normal", compte(payees, function (x) { return !x.fondatrice; })], ["Centres en plus", payees.reduce(function (a, x) { return a + Math.max(0, (x.centres_payes || 1) - 1); }, 0)]]);
    barres(g5, "Offres par contrat", repartir(o, "contrat", function (k) { return lib("contrats", k); }), o.length);
    barres(g5, "Offres par poste", repartir(o, "poste", function (k) { return lib("postes", k); }), o.length);
    var remu = o.filter(function (x) { return x.remuneration_montant && (x.remuneration_unite || "jour") === "jour"; });
    barres(g5, "Rémunération par jour (offres)", remu.length ? [["Moyenne", Math.round(remu.reduce(function (a, x) { return a + Number(x.remuneration_montant); }, 0) / remu.length)], ["Plus basse", Math.min.apply(null, remu.map(function (x) { return Number(x.remuneration_montant); }))], ["Plus haute", Math.max.apply(null, remu.map(function (x) { return Number(x.remuneration_montant); }))]] : []);
    var nomSt = {}; s.forEach(function (x) { nomSt[x.id] = x.nom; });
    var vs = {}; D.vues_structures.forEach(function (v) { if (v.type === "page" || v.type === "offre") vs[v.structure_id] = (vs[v.structure_id] || 0) + v.n; });
    barres(g5, "Structures les plus vues (30 jours)", Object.keys(vs).map(function (k) { return [nomSt[k] || "Structure supprimée", vs[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10));

    var s6 = section(c, "Candidatures et demandes");
    var g6 = grille(s6);
    barres(g6, "Candidatures par statut", repartir(ca, "statut", function (k) { return STATUTS[k] || k; }), ca.length);
    barres(g6, "Demandes par poste", repartir(d, "poste", function (k) { return POSTES_D[k] || k; }), d.length);
    barres(g6, "Demandes par département", repartir(d, "departement", function (k) { return E.nomDep(k) + " (" + k + ")"; }), d.length);
    barres(g6, "Demandes par période", repartir(d, "periodes", function (k) { return PERIODES[k] || k; }), d.length);
    barres(g6, "Ce que reçoivent les demandes", [["Envoyées à au moins une structure", compte(d, function (x) { return (x.destinataires || []).length; })], ["En attente (aucune structure)", compte(d, function (x) { return !(x.destinataires || []).length; })], ["Structures prévenues par e-mail", compte(d, function (x) { return (x.notifiees || []).length; })]], d.length);

    var s7 = section(c, "Les comptes");
    var g7 = grille(s7);
    barres(g7, "Connexion", repartir(u, function (x) { return x.fournisseur === "google" ? "Google" : "E-mail"; }), u.length);
    var idsSt = {}; s.forEach(function (x) { idsSt[x.id] = 1; });
    barres(g7, "Type de compte", repartir(u, function (x) { return idsProfils[x.id] && idsSt[x.id] ? "Animateur et structure" : idsProfils[x.id] ? "Animateur" : idsSt[x.id] ? "Structure" : "Sans profil"; }), u.length);
    barres(g7, "Activité", [["Connectés en 7 jours", actifs7], ["Connectés en 30 jours", actifs30], ["E-mail confirmé", compte(u, function (x) { return x.confirme; })]], u.length);
    var a = el("p", "petit"); a.appendChild(document.createTextNode("Les visites du site et les recherches Google sont sur ")); var l = el("a", null, "la page des chiffres"); l.href = "/chiffres/"; l.target = "_blank"; a.appendChild(l); a.appendChild(document.createTextNode(".")); s7.appendChild(a);
  }

  /* -- à traiter -- */
  function aFaire() {
    var c = $("ad-afaire"); c.textContent = "";
    c.appendChild(el("h2", null, "À traiter"));
    var aVerifier = D.structures.filter(function (x) { return paye(x) && !x.verifiee; });
    var nonPayees = D.structures.filter(function (x) { return !paye(x); });
    var attente = D.demandes.filter(function (x) { return !(x.destinataires || []).length; });
    var expirent = D.offres.filter(function (x) { return enLigne(x) && x.expire_le <= jours(-7); });
    var nouvellesCa = D.candidatures.filter(function (x) { return x.statut === "envoyee" && iso(x.cree_le) <= jours(3); });
    var n = aVerifier.length;
    var p = document.querySelector('[data-pastille-admin="afaire"]'); if (p) { p.hidden = !n; p.textContent = n; }
    function liste(titre, aide, items, ligne) {
      var s = section(c, titre + " (" + items.length + ")", aide);
      if (!items.length) { s.appendChild(el("p", "ad-rien", "Rien à faire ici.")); return; }
      items.forEach(function (x) { s.appendChild(ligne(x)); });
    }
    liste("Structures à vérifier", "Elles ont payé : vérifiez qu'elles existent (SIRET, site, déclaration d'accueil), puis mettez-les en ligne.", aVerifier, function (x) {
      return ligneStructure(x, true);
    });
    liste("Demandes sans structure", "Aucune structure abonnée dans leur zone : elles partiront dès qu'une s'inscrit. Une bonne liste de structures à démarcher.", attente, ligneDemande);
    liste("Inscriptions sans abonnement", "Des structures qui ont rempli leur fiche sans payer : à relancer.", nonPayees, function (x) { return ligneStructure(x, false); });
    liste("Offres qui expirent dans 7 jours", null, expirent, ligneOffre);
    liste("Candidatures sans réponse depuis 3 jours", "La structure n'a pas encore ouvert la candidature.", nouvellesCa, function (x) {
      var o = D.offres.filter(function (y) { return y.id === x.offre_id; })[0];
      var l = el("div", "ad-ligne"); l.appendChild(el("b", null, o ? o.intitule : "Offre supprimée")); l.appendChild(el("span", null, "envoyée le " + E.dateFr(iso(x.cree_le)))); return l;
    });
  }

  /* -- les listes et leurs fiches -- */
  function boutons(l, liste) {
    var b = el("div", "ad-actions");
    liste.forEach(function (a) {
      if (!a) return;
      var x = a[2] ? el("a", "bouton-texte", a[0]) : el("button", "bouton-texte" + (a[3] ? " " + a[3] : ""), a[0]);
      if (a[2]) { x.href = a[2]; x.target = "_blank"; x.rel = "noopener"; } else { x.type = "button"; x.addEventListener("click", a[1]); }
      b.appendChild(x);
    });
    l.appendChild(b);
  }
  function pastilles(l, liste) { var p = el("span", "ad-pastilles"); liste.forEach(function (t) { if (t) p.appendChild(el("i", t[1] || null, t[0])); }); l.appendChild(p); }
  function ligneStructure(x, verifier) {
    var l = el("div", "ad-ligne");
    var t = el("div", "ad-ligne-t"); t.appendChild(el("b", null, x.nom || "(sans nom)"));
    t.appendChild(el("span", null, [lib("types", x.type), (x.ville || "") + (x.departement ? " (" + x.departement + ")" : ""), x.email_contact].filter(Boolean).join(" · ")));
    l.appendChild(t);
    var nbO = compte(D.offres, function (o) { return o.structure_id === x.id && enLigne(o); });
    pastilles(l, [[paye(x) ? "payée jusqu'au " + E.dateFr(x.abonnement_fin) : "non payée", paye(x) ? "ok" : "non"], [x.verifiee ? "vérifiée" : "à vérifier", x.verifiee ? "ok" : "non"],
      x.fondatrice ? ["fondatrice", "neutre"] : null, [nbO + " offre" + (nbO > 1 ? "s" : "") + " en ligne", "neutre"]]);
    boutons(l, [
      [x.verifiee ? "Retirer la vérification" : "Vérifier", function () { modifier("structures", x.id, { verifiee: !x.verifiee }); }, null, x.verifiee ? "" : "ad-fort"],
      ["Modifier", function () { editeur("structures", x); }],
      x.slug && x.page_publique && x.verifiee && paye(x) ? ["Voir la page", null, "/trouver-un-poste/structures/" + x.slug + "/"] : null,
      verifier ? null : ["Supprimer", function () { supprimer("structures", x.id, x.nom); }, null, "bouton-danger"]
    ]);
    return l;
  }
  function ligneProfil(x) {
    var l = el("div", "ad-ligne");
    var t = el("div", "ad-ligne-t"); t.appendChild(el("b", null, (x.prenom || "?") + (x.annee_naissance ? ", " + (auj.getFullYear() - x.annee_naissance) + " ans" : "")));
    t.appendChild(el("span", null, [x.poste_recherche, (x.ville ? x.ville + ", " : "") + E.nomDep(x.departement), x.email_contact].filter(Boolean).join(" · ")));
    l.appendChild(t);
    pastilles(l, [[x.publie ? "visible" : "caché", x.publie ? "ok" : "non"], x.resume_public ? ["résumé public", "neutre"] : null, x.cv_nom ? ["CV", "neutre"] : null,
      [(x.diplomes || []).map(function (d) { return lib("diplomes", d); }).join(", ") || "sans diplôme indiqué", "neutre"]]);
    boutons(l, [["Voir la fiche", function () { E.ouvrirFiche(E.ficheProfil(x, {})); }], ["Modifier", function () { editeur("profils", x); }],
      [x.publie ? "Cacher" : "Rendre visible", function () { modifier("profils", x.id, { publie: !x.publie }); }], ["Supprimer", function () { supprimer("profils", x.id, x.prenom); }, null, "bouton-danger"]]);
    return l;
  }
  function ligneOffre(x) {
    var st = D.structures.filter(function (s) { return s.id === x.structure_id; })[0];
    var l = el("div", "ad-ligne");
    var t = el("div", "ad-ligne-t"); t.appendChild(el("b", null, x.intitule));
    t.appendChild(el("span", null, [st ? st.nom : "", x.ville + " (" + x.departement + ")", "dès le " + E.dateFr(x.debut), lib("contrats", x.contrat)].filter(Boolean).join(" · ")));
    l.appendChild(t);
    pastilles(l, [[enLigne(x) ? "en ligne jusqu'au " + E.dateFr(x.expire_le) : x.publiee ? "expirée" : "brouillon", enLigne(x) ? "ok" : "non"], x.remuneration_montant ? [euros(x.remuneration_montant) + " / " + (x.remuneration_unite || "jour"), "neutre"] : ["sans rémunération", "non"]]);
    boutons(l, [enLigne(x) ? ["Voir l'offre", null, "/trouver-un-poste/offres/" + x.id + "/"] : null, ["Modifier", function () { editeur("offres", x); }],
      [x.publiee ? "Dépublier" : "Publier", function () { modifier("offres", x.id, { publiee: !x.publiee }); }], ["Supprimer", function () { supprimer("offres", x.id, x.intitule); }, null, "bouton-danger"]]);
    return l;
  }
  function ligneDemande(x) {
    var l = el("div", "ad-ligne");
    var t = el("div", "ad-ligne-t"); t.appendChild(el("b", null, (x.prenom || "?") + " · " + (POSTES_D[x.poste] || x.poste)));
    t.appendChild(el("span", null, [(x.ville ? x.ville + ", " : "") + E.nomDep(x.departement), (x.periodes || []).map(function (k) { return PERIODES[k] || k; }).join(", "), x.email_contact, "le " + E.dateFr(iso(x.cree_le))].filter(Boolean).join(" · ")));
    if (x.message) t.appendChild(el("span", "ad-message", "« " + x.message + " »"));
    l.appendChild(t);
    pastilles(l, [[(x.destinataires || []).length + " structure" + ((x.destinataires || []).length > 1 ? "s" : ""), (x.destinataires || []).length ? "ok" : "non"], [(x.notifiees || []).length + " prévenue" + ((x.notifiees || []).length > 1 ? "s" : ""), "neutre"]]);
    boutons(l, [["Supprimer", function () { supprimer("demandes", x.id, "cette demande"); }, null, "bouton-danger"]]);
    return l;
  }
  function ligneCompte(x) {
    var p = D.profils.filter(function (y) { return y.id === x.id; })[0], s = D.structures.filter(function (y) { return y.id === x.id; })[0];
    var l = el("div", "ad-ligne");
    var t = el("div", "ad-ligne-t"); t.appendChild(el("b", null, x.email || "(sans e-mail)"));
    t.appendChild(el("span", null, "créé le " + E.dateFr(iso(x.cree_le)) + (x.derniere ? " · dernière connexion le " + E.dateFr(iso(x.derniere)) : " · jamais connecté")));
    l.appendChild(t);
    pastilles(l, [[x.fournisseur === "google" ? "Google" : "E-mail", "neutre"], p ? ["animateur : " + p.prenom, "ok"] : null, s ? ["structure : " + s.nom, "ok"] : null,
      !p && !s ? ["sans profil", "non"] : null, D.admins.indexOf(x.id) >= 0 ? ["admin", "accent"] : null, x.confirme ? null : ["e-mail non confirmé", "non"]]);
    return l;
  }
  function ligneRessource(x) {
    var l = el("div", "ad-ligne");
    var t = el("div", "ad-ligne-t"); t.appendChild(el("b", null, x.titre)); t.appendChild(el("span", null, x.type === "guide" ? (x.resume || "") : x.html)); l.appendChild(t);
    pastilles(l, [[x.type === "guide" ? "guide" : "conseil", "neutre"], ["ordre " + x.ordre, "neutre"]]);
    boutons(l, [x.type === "guide" ? ["Lire", function () { var a = el("article", "co-guide texte"); a.appendChild(el("h1", null, x.titre)); var d = el("div"); d.innerHTML = x.html; a.appendChild(d); E.ouvrirFiche(a); }] : null,
      ["Modifier", function () { editeur("ressources_structures", x); }]]);
    return l;
  }

  // une liste avec recherche et filtres
  function liste(id, titre, aide, elements, ligne, choix, texte) {
    var c = $(id); c.textContent = "";
    var h = el("div", "ad-tete"); h.appendChild(el("h2", null, titre + " (" + elements.length + ")")); c.appendChild(h);
    if (aide) c.appendChild(el("p", "petit", aide));
    var barre = el("div", "ad-filtres");
    var q = el("input"); q.type = "search"; q.placeholder = "Chercher…"; q.value = (filtres[id] || {}).q || ""; barre.appendChild(q);
    var puces = el("div", "ad-puces"), courant = (filtres[id] || {}).f || choix[0][0];
    choix.forEach(function (ch) {
      var b = el("button", null, ch[1] + " (" + elements.filter(ch[2]).length + ")"); b.type = "button"; b.setAttribute("aria-pressed", ch[0] === courant ? "true" : "false");
      b.addEventListener("click", function () { filtres[id] = { q: q.value, f: ch[0] }; liste(id, titre, aide, elements, ligne, choix, texte); });
      puces.appendChild(b);
    });
    barre.appendChild(puces); c.appendChild(barre);
    var zone = el("div", "ad-liste"); c.appendChild(zone);
    function remplir() {
      zone.textContent = "";
      var f = choix.filter(function (ch) { return ch[0] === courant; })[0][2];
      var m = q.value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      var vus = elements.filter(f).filter(function (x) { return !m || texte(x).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").indexOf(m) >= 0; });
      if (!vus.length) zone.appendChild(el("p", "ad-rien", "Rien ici."));
      vus.slice(0, 300).forEach(function (x) { zone.appendChild(ligne(x)); });
    }
    q.addEventListener("input", function () { filtres[id] = { q: q.value, f: courant }; remplir(); });
    remplir();
  }
  function tout() { return true; }
  function listes() {
    liste("ad-structures", "Structures", "Vérifier, modifier ou supprimer une structure. Une modification paraît sur le site à la prochaine mise à jour (toutes les heures).", D.structures, function (x) { return ligneStructure(x, false); },
      [["toutes", "Toutes", tout], ["averifier", "À vérifier", function (x) { return paye(x) && !x.verifiee; }], ["enligne", "En ligne", function (x) { return paye(x) && x.verifiee; }], ["nonpayees", "Non payées", function (x) { return !paye(x); }], ["fondatrices", "Fondatrices", function (x) { return x.fondatrice; }]],
      function (x) { return [x.nom, x.ville, x.departement, x.email_contact, x.slug].join(" "); });
    liste("ad-animateurs", "Animateurs", null, D.profils, ligneProfil,
      [["tous", "Tous", tout], ["visibles", "Visibles", function (x) { return x.publie; }], ["caches", "Cachés", function (x) { return !x.publie; }], ["cv", "Avec CV", function (x) { return x.cv_nom; }], ["mineurs", "Mineurs", function (x) { return x.annee_naissance && auj.getFullYear() - x.annee_naissance < 18; }]],
      function (x) { return [x.prenom, x.ville, x.departement, x.email_contact, x.poste_recherche].join(" "); });
    liste("ad-offres", "Offres", null, D.offres, ligneOffre,
      [["toutes", "Toutes", tout], ["enligne", "En ligne", enLigne], ["expirees", "Expirées", function (x) { return x.publiee && x.expire_le < AUJ; }], ["brouillons", "Brouillons", function (x) { return !x.publiee; }]],
      function (x) { return [x.intitule, x.ville, x.departement, x.texte].join(" "); });
    liste("ad-demandes", "Demandes de l'annuaire inversé", null, D.demandes, ligneDemande,
      [["toutes", "Toutes", tout], ["attente", "En attente", function (x) { return !(x.destinataires || []).length; }], ["envoyees", "Envoyées", function (x) { return (x.destinataires || []).length; }]],
      function (x) { return [x.prenom, x.ville, x.departement, x.email_contact, x.message].join(" "); });
    liste("ad-comptes", "Comptes", "Tous les comptes du site. Pour supprimer un compte, supprimez sa fiche ici puis le compte dans Supabase (Authentication).", D.comptes, ligneCompte,
      [["tous", "Tous", tout], ["actifs", "Actifs (30 j)", function (x) { return iso(x.derniere) >= jours(29); }], ["sans", "Sans profil", function (x) { return !D.profils.some(function (p) { return p.id === x.id; }) && !D.structures.some(function (s) { return s.id === x.id; }); }]],
      function (x) { return x.email || ""; });
    liste("ad-contenus", "Guides et conseils", "Les ressources des structures abonnées. Elles ne sont que dans la base : modifiez-les ici.", D.ressources, ligneRessource,
      [["tout", "Tout", tout], ["guides", "Guides", function (x) { return x.type === "guide"; }], ["conseils", "Conseils", function (x) { return x.type === "conseil"; }]],
      function (x) { return [x.titre, x.resume, x.html].join(" "); });
  }

  /* -- modifier une fiche -- */
  var CHAMPS = {
    structures: [["nom", "Nom"], ["type", "Type", "types"], ["ville", "Ville"], ["departement", "Département (code)"], ["email_contact", "E-mail de contact"], ["site", "Site"],
      ["accroche", "Accroche"], ["presentation", "Présentation", "texte"], ["projet", "Projet", "texte"], ["avantages", "Avantages", "texte"], ["publics", "Publics (séparés par des virgules)", "liste"],
      ["activites", "Activités (séparées par des virgules)", "liste"], ["slug", "Adresse de la page (slug)"], ["page_publique", "Page publique", "oui"], ["verifiee", "Vérifiée", "oui"],
      ["fondatrice", "Tarif fondateur", "oui"], ["abonnement_fin", "Abonnement payé jusqu'au", "date"], ["centres_payes", "Centres payés", "nombre"]],
    profils: [["prenom", "Prénom"], ["annee_naissance", "Année de naissance", "nombre"], ["ville", "Ville"], ["departement", "Département (code)"], ["poste_recherche", "Poste recherché"],
      ["email_contact", "E-mail de contact"], ["presentation", "Présentation", "texte"], ["diplomes", "Diplômes (codes, séparés par des virgules)", "liste"], ["recherche", "Recherche (codes)", "liste"],
      ["mobilite", "Mobilité (départements)", "liste"], ["dispo_debut", "Disponible du", "date"], ["dispo_fin", "au", "date"], ["publie", "Visible des structures", "oui"], ["resume_public", "Résumé public", "oui"],
      ["alertes", "Alertes du lundi", "oui"], ["permis_b", "Permis B", "oui"]],
    offres: [["intitule", "Intitulé"], ["poste", "Poste (code)"], ["contrat", "Contrat", "contrats"], ["ville", "Ville"], ["departement", "Département (code)"], ["debut", "Début", "date"], ["fin", "Fin", "date"],
      ["expire_le", "En ligne jusqu'au", "date"], ["remuneration_montant", "Rémunération brute", "nombre"], ["remuneration_unite", "Par (jour, mois, heure)"], ["texte", "Texte", "texte"], ["candidater", "Pour candidater"], ["publiee", "Publiée", "oui"]],
    ressources_structures: [["titre", "Titre"], ["court", "Titre court"], ["resume", "Résumé", "texte"], ["html", "Contenu (HTML)", "code"], ["ordre", "Ordre", "nombre"], ["maj", "Mis à jour le", "date"]]
  };
  function editeur(t, x) {
    var f = el("form", "formulaire ad-editeur");
    f.appendChild(el("p", "co-e-sur", "Modifier · " + ({ structures: "structure", profils: "animateur", offres: "offre", ressources_structures: "guide ou conseil" }[t])));
    f.appendChild(el("h1", null, x.nom || x.prenom || x.intitule || x.titre || "Fiche"));
    var g = el("div", "champs-2");
    CHAMPS[t].forEach(function (c) {
      var nom = c[0], type = c[2], v = x[nom];
      var l = el("label", "champ" + (type === "texte" || type === "code" || type === "liste" ? " champ-large" : "")); l.appendChild(el("span", null, c[1]));
      var i;
      if (type === "oui") { l.className = "case-accord"; i = el("input"); i.type = "checkbox"; i.checked = !!v; l.textContent = ""; l.appendChild(i); l.appendChild(document.createTextNode(" " + c[1])); }
      else if (type === "texte" || type === "code") { i = el("textarea"); i.rows = type === "code" ? 16 : 4; i.value = v || ""; if (type === "code") i.className = "ad-code"; }
      else if (type === "types" || type === "contrats") { i = el("select"); (E.L[type] || []).forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; i.appendChild(op); }); i.value = v || ""; }
      else { i = el("input"); i.type = type === "date" ? "date" : type === "nombre" ? "number" : "text"; if (type === "nombre") i.step = "any"; i.value = type === "liste" ? (v || []).join(", ") : (v == null ? "" : String(v).slice(0, type === "date" ? 10 : 9999)); }
      i.name = nom; i.dataset.type = type || "";
      if (type !== "oui") l.appendChild(i);
      g.appendChild(l);
    });
    f.appendChild(g);
    var msg = el("p", "petit"); f.appendChild(msg);
    var b = el("button", "bouton-r", "Enregistrer"); b.type = "submit"; f.appendChild(b);
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      var champs = {};
      Array.prototype.forEach.call(f.querySelectorAll("[name]"), function (i) {
        var type = i.dataset.type, v;
        if (type === "oui") v = i.checked;
        else if (type === "liste") v = i.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        else if (type === "nombre") v = i.value === "" ? null : Number(i.value);
        else if (type === "date") v = i.value || null;
        else v = i.value === "" && type !== "texte" && type !== "code" ? null : i.value;
        // on n'envoie que ce qui a vraiment changé (une case vide et une valeur absente, c'est pareil)
        var avant = x[i.name];
        if (avant === undefined || avant === null) avant = type === "oui" ? false : type === "liste" ? [] : (type === "texte" || type === "code") ? "" : null;
        else if (type === "date") avant = String(avant).slice(0, 10);
        if (JSON.stringify(v) !== JSON.stringify(avant)) champs[i.name] = v;
      });
      if (!Object.keys(champs).length) { msg.textContent = "Rien n'a changé."; return; }
      b.disabled = true; msg.textContent = "Enregistrement…";
      var r = await E.sb.rpc("admin_modifier", { t: t, cle: String(t === "ressources_structures" ? x.slug : x.id), champs: champs });
      b.disabled = false;
      if (r.error) { msg.textContent = E.erreur(r.error); return; }
      E.fermerFiche(); E.message("Enregistré. Sur le site public, la modification paraît à la prochaine mise à jour (toutes les heures).");
      charger();
    });
    E.ouvrirFiche(f);
  }
  async function modifier(t, id, champs) {
    var r = await E.sb.rpc("admin_modifier", { t: t, cle: String(id), champs: champs });
    if (r.error) { E.message(E.erreur(r.error), true); return; }
    E.message("Enregistré."); charger();
  }
  async function supprimer(t, id, nom) {
    if (!window.confirm("Supprimer " + (nom ? "« " + nom + " »" : "cette fiche") + " ? C'est définitif.")) return;
    var r = await E.sb.rpc("admin_supprimer", { t: t, cle: String(id) });
    if (r.error) { E.message(E.erreur(r.error), true); return; }
    E.message("Supprimé."); charger();
  }

  /* -- chargement -- */
  async function charger() {
    E = window.FRA_ESPACE;
    var r = await E.sb.rpc("admin_donnees");
    if (r.error) { $("ad-stats").textContent = E.erreur(r.error); return; }
    D = r.data;
    ["comptes", "structures", "profils", "offres", "centres", "demandes", "candidatures", "vues", "vues_structures", "ressources", "admins"].forEach(function (k) { D[k] = D[k] || []; });
    stats(); aFaire(); listes();
  }
  window.FRA_ADMIN = { charger: charger };
  // l'espace a pu s'ouvrir avant que ce fichier ne soit lu : on charge tout de suite dans ce cas
  if (window.FRA_ESPACE && $("v-admin") && !$("v-admin").hidden) charger();
})();

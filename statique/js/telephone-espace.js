// Téléphone, « Mon espace » (animateur, structure, parent, organisme) : le style du site (fond crème et halos, titres en
// Fraunces, cartes en verre, icônes 3D) et, sur le tableau de bord, toutes les fonctions à portée d'un doigt : un « Bonjour »,
// puis des tuiles à icônes rangées par usage, celles de l'espace (elles ouvrent l'onglet) et celles du site (guides, outils,
// recherches : elles s'ouvrent dans la fenêtre de fiche de l'espace, ou à côté, sans quitter l'espace — compte.js).
// Rien n'est refait : les onglets, les formulaires et les données restent ceux de compte.js, parent.js, organisme.js.
(function () {
  "use strict";
  if (!window.matchMedia("(max-width: 700px)").matches) return;
  var racine = document.documentElement;
  var barre = document.querySelector(".tel-barre");
  var dossier = (barre && barre.dataset.icones) || "/illus/icones/";
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function icone(n, t) { var i = el("img"); i.src = dossier + n + ".png"; i.alt = ""; i.width = t || 40; i.height = t || 40; return i; }

  // o : un onglet de l'espace ; u : une page du site ; f : une fonction (bloc à ouvrir)
  var TUILES = {
    "v-candidat": [
      ["Mon activité", [
        { o: "offres", ic: "offres", t: "Offres pour moi", s: "Près de chez vous" },
        { o: "candidatures", ic: "candidatures", t: "Mes candidatures", s: "Les réponses des structures" },
        { u: "/trouver-un-poste/demande/", ic: "envoi", t: "Décrire ce que je cherche", s: "Les structures viennent à vous" },
        { o: "demandes", ic: "courrier", t: "Mes demandes", s: "Celles envoyées" },
        { o: "profil", ic: "profil", t: "Mon profil", s: "Ce que voient les structures" }
      ]],
      ["Me former", [
        { u: "/se-former/sessions/", ic: "bafa", t: "Trouver une session", s: "BAFA, BAFD, PSC…" },
        { u: "/outils/mon-parcours-bafa/", ic: "agenda", t: "Mon parcours BAFA", s: "Mes dates limites" },
        { u: "/se-former/financer-son-bafa/", ic: "argent", t: "Financer son BAFA", s: "Les aides" }
      ]],
      ["Trouver un poste", [
        { u: "/recruter/structures/", ic: "structure", t: "Les structures", s: "L'annuaire" },
        { u: "/enfants/", ic: "sejours", t: "Encadrer un séjour", s: "Postuler pour encadrer" },
        { u: "/outils/salaire-cee/", ic: "calcul", t: "Mon salaire en CEE", s: "Le calculer" },
        { u: "/trouver-un-poste/trouver-son-stage-pratique/", ic: "guide", t: "Trouver son stage", s: "Le guide" },
        { u: "/trouver-un-poste/preparer-son-entretien/", ic: "bulle", t: "Préparer l'entretien", s: "Le guide" },
        { u: "/trouver-un-poste/contrat-d-engagement-educatif/", ic: "contrat", t: "Le contrat (CEE)", s: "Le guide" }
      ]]
    ],
    "v-structure": [
      ["Recruter", [
        { o: "offres", ic: "annonce", t: "Mes offres", s: "Publier, modifier" },
        { o: "candidats", ic: "candidatures", t: "Candidatures", s: "Ceux qui ont postulé" },
        { o: "demandes", ic: "courrier", t: "Demandes reçues", s: "Les animateurs du secteur" },
        { o: "profils", ic: "profils", t: "Profils du secteur", s: "Leurs CV" },
        { u: "/recruter/animateurs-bafa/", ic: "carte", t: "Recruter par département", s: "Les stagiaires BAFA" }
      ]],
      ["Les familles", [
        { o: "sejours", ic: "sejours", t: "Séjours et accueils", s: "Publier, les dates" },
        { o: "familles", ic: "enfant", t: "Demandes des familles", s: "Les places demandées" },
        { u: "/recruter/remplir-ses-sejours/", ic: "guide", t: "Remplir ses séjours", s: "Le guide" },
        { u: "/outils/taux-d-encadrement/", ic: "calcul", t: "Taux d'encadrement", s: "Combien d'animateurs" },
        { u: "/recruter/declarer-son-accueil/", ic: "fiche", t: "Déclarer son accueil", s: "Le guide ACM" }
      ]],
      ["Ma structure", [
        { o: "page", ic: "maison", t: "Ma page et mes centres", s: "Ce que voient les candidats" },
        { o: "abonnement", ic: "carte-bancaire", t: "Abonnement et factures", s: "Formules, paiements" },
        { o: "outils", ic: "outils", t: "Boîte à outils", s: "Conseils, annonces" },
        { u: "/recruter/structures/", ic: "structure", t: "L'annuaire", s: "Les autres structures" }
      ]]
    ],
    "v-parent": [
      ["Trouver une place", [
        { u: "/enfants/", ic: "chercher", t: "Colos et accueils", s: "Toutes les offres" },
        { u: "/enfants/demande/", ic: "envoi", t: "Décrire mon besoin", s: "Les structures répondent" },
        { o: "inscriptions", ic: "courrier", t: "Demandes et inscriptions", s: "Le suivi" },
        { o: "favoris", ic: "garder", t: "Offres gardées", s: "Pour comparer" }
      ]],
      ["Mes enfants", [
        { o: "enfants", ic: "enfant", t: "Mes enfants", s: "Prénom, âge" },
        { o: "carnet", ic: "bulle", t: "Carnet de séjour", s: "Les nouvelles" }
      ]],
      ["Bien préparer", [
        { u: "/enfants/aides/", ic: "argent", t: "Les aides", s: "Le reste à payer" },
        { u: "/enfants/colo-pas-chere/", ic: "budget", t: "Une colo pas chère", s: "Le guide" },
        { u: "/enfants/trousseau-de-colo/", ic: "sejours", t: "Le trousseau", s: "La liste" },
        { u: "/enfants/fiche-sanitaire-de-liaison/", ic: "fiche", t: "La fiche sanitaire", s: "Le guide" }
      ]]
    ],
    "v-admin": [
      ["Aujourd'hui", [
        { o: "qg", ic: "courrier", t: "QG demandes", s: "Ce qui attend une réponse" },
        { o: "afaire", ic: "fiche", t: "À vérifier et relancer", s: "Fiches, offres, relances" },
        { o: "sante", ic: "reglages", t: "État de santé", s: "Ce qui doit marcher" }
      ]],
      ["Membres", [
        { o: "comptes", ic: "profils", t: "Membres", s: "Tous les comptes" },
        { o: "animateurs", ic: "animateur", t: "Animateurs", s: "Les profils" },
        { o: "parents", ic: "enfant", t: "Parents", s: "Les comptes parents" },
        { o: "structures", ic: "structure", t: "Pros", s: "Structures à vérifier" },
        { o: "organismes", ic: "bafa", t: "Organismes", s: "Les formations" },
        { o: "sejours", ic: "sejours", t: "Séjours", s: "Côté familles" }
      ]],
      ["Croissance", [
        { o: "ventes", ic: "argent", t: "Ventes", s: "Abonnements, dépenses" },
        { o: "prospection", ic: "envoi", t: "Prospection", s: "Les futurs clients" },
        { o: "visibilite", ic: "chercher", t: "Visibilité", s: "Google" },
        { o: "provenance", ic: "carte", t: "Provenance", s: "D'où viennent les visiteurs" },
        { o: "indexation", ic: "lien", t: "Indexation", s: "Les pages dans Google" },
        { o: "stats", ic: "stats", t: "Statistiques", s: "Le détail" },
        { o: "reseaux", ic: "bulle", t: "Réseaux sociaux", s: "Les posts prêts" }
      ]],
      ["Contenu", [
        { o: "offres", ic: "annonce", t: "Offres", s: "Toutes les offres" },
        { o: "demandes", ic: "candidatures", t: "Toutes les demandes", s: "L'annuaire inversé" },
        { o: "annuaires", ic: "accord", t: "Annuaires inversés", s: "Étape par étape" },
        { o: "site", ic: "guide", t: "Contenus du site", s: "Articles et guides" },
        { o: "actualites", ic: "idee", t: "Actualités", s: "Publier une nouvelle" },
        { o: "contenus", ic: "outils", t: "Guides et conseils", s: "Pour les abonnés" }
      ]]
    ],
    "v-organisme": [
      ["Mon partenariat", [
        { o: "fiche", ic: "fiche", t: "Ma fiche", s: "Ce que voient les jeunes" },
        { o: "zones", ic: "carte", t: "Mes départements", s: "En tête des sessions" },
        { o: "factures", ic: "chiffres", t: "Clics et factures", s: "Jour par jour" }
      ]],
      ["Sur le site", [
        { u: "/se-former/sessions/", ic: "bafa", t: "Les sessions", s: "Comme les jeunes les voient" },
        { u: "/se-former/sessions/organismes/", ic: "structure", t: "Les organismes", s: "Votre page parmi les autres" },
        { u: "/organismes-partenaires/", ic: "accord", t: "Le partenariat", s: "Comment ça marche" }
      ]]
    ]
  };

  function accueilDe(v) { return v.id === "v-admin" ? "accueil" : "tableau"; }
  function vueVisible() { return document.querySelector(".compte-vue.co-onglets:not([hidden])"); }
  function nomCompte() { var b = document.querySelector(".co-moi-t b"); return b ? b.textContent.trim() : ""; }

  function construire(v) {
    if (v.querySelector(".tel-esp-accueil")) return;
    var groupes = TUILES[v.id]; if (!groupes) return;
    var nav = v.querySelector(".co-nav");
    var s = el("section", "tel-esp-accueil"); s.dataset.onglet = accueilDe(v);
    // le bonjour : le prénom ou le nom du compte, et la date
    var t = el("div", "tel-esp-bonjour");
    var n = nomCompte(), prenom = v.id === "v-structure" || v.id === "v-organisme" ? n : n.split(" ")[0];
    var h = el("h2", null, "Bonjour"); if (prenom && !/^Mon |^Ma /.test(prenom)) { h.appendChild(document.createTextNode(" ")); h.appendChild(el("em", null, prenom)); }
    t.appendChild(h);
    t.appendChild(el("p", null, new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })));
    if (v.id !== "v-admin") s.appendChild(t);  // l'administration a déjà son « Bonjour » (le point du jour)
    groupes.forEach(function (g) {
      var bloc = el("div", "tel-esp-groupe");
      bloc.appendChild(el("h3", null, g[0]));
      var grille = el("div", "tel-esp-tuiles");
      g[1].forEach(function (x) {
        var b;
        if (x.o) {
          var cible = nav && nav.querySelector('[data-onglet-vers="' + x.o + '"]');
          if (!cible || cible.hidden) return;
          b = el("button", "tel-esp-tuile"); b.type = "button"; b.dataset.ongletVers = x.o;
          var past = cible.querySelector(".co-pastille:not([hidden])");
          if (cible.classList.contains("co-ferme")) b.classList.add("tel-esp-ferme");
          if (past && past.textContent.trim() && !past.classList.contains("co-pastille-neutre")) b.appendChild(el("i", "tel-esp-pastille", past.textContent.trim()));
        } else {
          b = el("a", "tel-esp-tuile"); b.href = x.u;
          // les outils (calculs) ont besoin de leur page : ils s'ouvrent à côté, comme les sessions
          if (/^\/outils\//.test(x.u)) { b.target = "_blank"; b.rel = "noopener"; b.setAttribute("data-sortie", ""); }
        }
        var ic = el("span", "tel-esp-ic"); ic.appendChild(icone(x.ic, 34)); b.appendChild(ic);
        b.appendChild(el("b", null, x.t));
        if (x.s) b.appendChild(el("small", null, x.s));
        grille.appendChild(b);
      });
      bloc.appendChild(grille); s.appendChild(bloc);
    });
    // juste après l'en-tête de la rubrique (ou en tête de la vue)
    var pageAdmin = v.id === "v-admin" && v.querySelector('[data-onglet="accueil"]');
    var apres = pageAdmin ? pageAdmin.firstElementChild : v.querySelector(".co-entete");
    if (apres) apres.parentNode.insertBefore(s, apres.nextSibling); else v.insertBefore(s, v.firstChild);
    var actuel = nav && nav.querySelector("[data-onglet-vers][aria-current]");
    s.classList.toggle("hors-onglet", !actuel || actuel.dataset.ongletVers !== accueilDe(v));
  }
  // les pastilles (nombres de nouveautés) arrivent après le chargement : on les recopie sur les tuiles
  function majPastilles(v) {
    var nav = v.querySelector(".co-nav"); if (!nav) return;
    Array.prototype.forEach.call(v.querySelectorAll(".tel-esp-tuile[data-onglet-vers]"), function (b) {
      var c = nav.querySelector('[data-onglet-vers="' + b.dataset.ongletVers + '"]'), p = c && c.querySelector(".co-pastille:not([hidden])");
      var i = b.querySelector(".tel-esp-pastille"), txt = p && !p.classList.contains("co-pastille-neutre") ? p.textContent.trim() : "";
      if (txt && !i) { i = el("i", "tel-esp-pastille"); b.insertBefore(i, b.firstChild); }
      if (i) { if (txt) i.textContent = txt; else i.remove(); }
      b.classList.toggle("tel-esp-ferme", !!(c && c.classList.contains("co-ferme")));
    });
  }
  // les pages vides : un bouton qui dit quoi faire (le texte reste celui du site)
  var VIDES = [
    { v: "v-structure", sel: ".co-vide", si: /publiez une offre/, b: "Mes offres", o: "offres" },
    { v: "v-parent", sel: ".og-vide", si: /^Rien de gardé/, b: "Voir les offres", u: "/enfants/" },
    { v: "v-organisme", sel: ".og-vide", si: /Mes départements/, b: "Mes départements", o: "zones" }
  ];
  function boutonsVides(v) {
    VIDES.forEach(function (x) {
      if (x.v !== v.id) return;
      Array.prototype.forEach.call(v.querySelectorAll(x.sel), function (p) {
        var bloc = p.classList.contains("co-vide") ? p : p.parentNode;
        if (!x.si.test(p.textContent.trim()) || bloc.querySelector(".tel-esp-action")) return;
        var b;
        if (x.o) { b = el("button", "bouton-r tel-esp-action", x.b); b.type = "button"; b.dataset.ongletVers = x.o; }
        else { b = el("a", "bouton-r tel-esp-action", x.b); b.href = x.u; }
        if (p.classList.contains("co-vide")) p.appendChild(b); else p.parentNode.insertBefore(b, p.nextSibling);
      });
    });
  }
  // l'administration n'a pas de barre du bas dans compte.js : sur le téléphone, la même que les autres espaces
  var DOCK_ADMIN = [["qg", "QG"], ["afaire", "À vérifier"], ["accueil", "Accueil"], ["comptes", "Membres"]];
  function dockAdmin(v, cour) {
    var d = document.getElementById("tel-dock-admin");
    if (v.id !== "v-admin") { if (d) d.hidden = true; return; }
    var nav = v.querySelector(".co-nav");
    if (!d) {
      d = el("nav", "app-dock"); d.id = "tel-dock-admin"; d.setAttribute("aria-label", "Rubriques principales");
      DOCK_ADMIN.forEach(function (x) {
        var cible = nav.querySelector('[data-onglet-vers="' + x[0] + '"]'); if (!cible) return;
        var b = el("button", "app-dock-b" + (x[0] === "accueil" ? " app-dock-logo" : "")); b.type = "button"; b.dataset.dock = x[0];
        if (x[0] === "accueil") { var im = el("img"); im.src = "/marque-sombre.png"; im.alt = ""; b.appendChild(im); }
        else { var ic = cible.querySelector("svg"); if (ic) b.appendChild(ic.cloneNode(true)); }
        b.appendChild(el("span", null, x[1]));
        b.addEventListener("click", function () { document.body.classList.remove("menu-ouvert"); cible.click(); window.scrollTo(0, 0); });
        d.appendChild(b);
      });
      var m = el("button", "app-dock-b app-dock-menu"); m.type = "button"; m.setAttribute("aria-label", "Toutes les rubriques");
      m.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
      m.appendChild(el("span", null, "Menu"));
      m.addEventListener("click", function () { document.body.classList.toggle("menu-ouvert"); m.setAttribute("aria-expanded", document.body.classList.contains("menu-ouvert") ? "true" : "false"); });
      d.appendChild(m);
      (document.getElementById("espace-compte") || document.body).appendChild(d);
    }
    d.hidden = false;
    Array.prototype.forEach.call(d.querySelectorAll("[data-dock]"), function (b) {
      if (cour && cour.dataset.ongletVers === b.dataset.dock) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }
  function regarder() {
    var v = vueVisible();
    if (!v || !document.body.classList.contains("en-app")) { racine.classList.remove("tel-espace"); var d = document.getElementById("tel-dock-admin"); if (d) d.hidden = true; return; }
    racine.classList.add("tel-espace");
    racine.dataset.espace = v.id;
    construire(v); majPastilles(v); boutonsVides(v);
    var cour = v.querySelector(".co-nav [data-onglet-vers][aria-current]");
    racine.classList.toggle("tel-esp-tableau", !!(cour && cour.dataset.ongletVers === accueilDe(v)));
    dockAdmin(v, cour);
    // l'accueil en tuiles suit l'onglet ouvert, même s'il est né après le premier affichage
    var acc = v.querySelector(".tel-esp-accueil");
    if (acc && cour) acc.classList.toggle("hors-onglet", cour.dataset.ongletVers !== accueilDe(v));
  }
  var attente = null;
  new MutationObserver(function () { clearTimeout(attente); attente = setTimeout(regarder, 60); })
    .observe(document.body, { attributes: true, subtree: true, attributeFilter: ["hidden", "class"] });
  regarder();
})();

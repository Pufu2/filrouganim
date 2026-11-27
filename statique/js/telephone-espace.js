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
        { u: "/recruter/remplir-ses-sejours/", ic: "guide", t: "Remplir ses séjours", s: "Le guide" }
      ]],
      ["Ma structure", [
        { o: "page", ic: "maison", t: "Ma page et mes centres", s: "Ce que voient les candidats" },
        { o: "abonnement", ic: "carte-bancaire", t: "Abonnement et factures", s: "Formules, paiements" },
        { o: "outils", ic: "outils", t: "Boîte à outils", s: "Conseils, annonces" },
        { u: "/recruter/structures/", ic: "structure", t: "L'annuaire", s: "Les autres structures" }
      ]],
      ["Outils gratuits", [
        { u: "/outils/taux-d-encadrement/", ic: "calcul", t: "Taux d'encadrement", s: "Combien d'animateurs" },
        { u: "/outils/salaire-cee/", ic: "argent", t: "Vérifier un CEE", s: "Le minimum par jour" },
        { u: "/recruter/declarer-son-accueil/", ic: "fiche", t: "Déclarer son accueil", s: "Le guide ACM" }
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

  function vueVisible() { return document.querySelector(".compte-vue.co-onglets:not([hidden])"); }
  function nomCompte() { var b = document.querySelector(".co-moi-t b"); return b ? b.textContent.trim() : ""; }

  function construire(v) {
    if (v.querySelector(".tel-esp-accueil")) return;
    var groupes = TUILES[v.id]; if (!groupes) return;
    var nav = v.querySelector(".co-nav");
    var s = el("section", "tel-esp-accueil"); s.dataset.onglet = "tableau";
    // le bonjour : le prénom ou le nom du compte, et la date
    var t = el("div", "tel-esp-bonjour");
    var n = nomCompte(), prenom = v.id === "v-structure" || v.id === "v-organisme" ? n : n.split(" ")[0];
    var h = el("h2", null, "Bonjour"); if (prenom && !/^Mon |^Ma /.test(prenom)) { h.appendChild(document.createTextNode(" ")); h.appendChild(el("em", null, prenom)); }
    t.appendChild(h);
    t.appendChild(el("p", null, new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })));
    s.appendChild(t);
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
        } else { b = el("a", "tel-esp-tuile"); b.href = x.u; }
        var ic = el("span", "tel-esp-ic"); ic.appendChild(icone(x.ic, 34)); b.appendChild(ic);
        b.appendChild(el("b", null, x.t));
        if (x.s) b.appendChild(el("small", null, x.s));
        grille.appendChild(b);
      });
      bloc.appendChild(grille); s.appendChild(bloc);
    });
    // juste après l'en-tête de la rubrique (ou en tête de la vue)
    var apres = v.querySelector(".co-entete");
    if (apres) apres.parentNode.insertBefore(s, apres.nextSibling); else v.insertBefore(s, v.firstChild);
    var actuel = nav && nav.querySelector("[aria-current]");
    s.classList.toggle("hors-onglet", !actuel || actuel.dataset.ongletVers !== "tableau");
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
  function regarder() {
    var v = vueVisible();
    if (!v || !document.body.classList.contains("en-app")) { racine.classList.remove("tel-espace"); return; }
    racine.classList.add("tel-espace");
    racine.dataset.espace = v.id;
    construire(v); majPastilles(v); boutonsVides(v);
    var cour = v.querySelector(".co-nav [aria-current]");
    racine.classList.toggle("tel-esp-tableau", !!(cour && cour.dataset.ongletVers === "tableau"));
  }
  var attente = null;
  new MutationObserver(function () { clearTimeout(attente); attente = setTimeout(regarder, 60); })
    .observe(document.body, { attributes: true, subtree: true, attributeFilter: ["hidden", "class"] });
  regarder();
})();

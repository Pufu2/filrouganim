/* Fil Roug'Anim : la visite guidée de chaque espace (animateur, structure, organisme, parent, admin).
   À la première ouverture d'un espace, une suite de fenêtres montre les rubriques du menu une par une
   (la rubrique est mise en lumière, la fenêtre s'affiche à côté). On avance, on revient, ou on ignore :
   dans tous les cas, la visite ne revient pas toute seule (mémorisé dans ce navigateur, par compte et par espace).
   « Revoir la visite guidée » (dans le guide de chaque espace) la relance. */
(function () {
  "use strict";
  var VISITES = {
    "v-candidat": { nom: "votre espace animateur", etapes: [
      [null, "Bienvenue dans votre espace", "En une minute, voici où trouver chaque chose. Vous pourrez revoir cette visite à tout moment dans « Guide de l'espace »."],
      ["profil", "Commencez par votre profil", "C'est votre fiche, vue par les structures vérifiées de votre secteur. Plus elle est complète (diplômes, dates, CV), plus on vous écrit."],
      ["offres", "Les offres pour vous", "Les offres près de chez vous et là où vous pouvez travailler. Vous postulez en un clic, avec votre profil."],
      ["candidatures", "Suivez vos candidatures", "Envoyée, vue, retenue : vous voyez où en est chacune. La structure vous écrit directement quand elle est intéressée."],
      ["demandes", "Ou laissez les structures venir à vous", "Décrivez le poste que vous cherchez : votre demande part chez les 3 structures les plus proches."],
      ["tableau", "Votre tableau de bord", "À chaque visite, commencez ici : ce qui a bougé, vos réponses et les nouvelles offres de votre secteur."],
      [null, "C'est parti !", "Complétez votre profil : c'est ce qui fait la différence. Bonne recherche !", "profil"]
    ] },
    "v-structure": { nom: "votre espace structure", etapes: [
      [null, "Bienvenue dans votre espace", "En une minute, voici comment il est rangé : recruter, accueillir les familles, et votre structure. Vous pourrez revoir cette visite dans « Guide de l'espace »."],
      ["tableau", "Votre tableau de bord", "Il commence par « À faire » : seulement ce qui attend une action, avec un lien direct. Puis vos chiffres et l'activité récente."],
      ["page", "Votre page et vos centres", "C'est ce que lisent les animateurs et les familles : présentation, photos, une journée type, votre équipe. Une page complète attire bien plus."],
      ["offres", "Vos offres", "Écrivez une offre en quelques minutes : elle paraît sur le site et dans l'alerte du lundi des animateurs de votre secteur."],
      ["candidats", "Les candidatures", "Les animateurs qui postulent arrivent ici. Donnez un statut à chacun : il le voit dans son espace."],
      ["demandes", "Les demandes des animateurs", "Des animateurs décrivent le poste qu'ils cherchent : leur demande arrive chez 3 structures proches. Répondez vite."],
      ["sejours", "Vos séjours et accueils", "Publiez vos colos, mini-séjours et accueils de loisirs gratuitement : les familles vous demandent une place en ligne."],
      ["abonnement", "L'abonnement", "Votre page et une offre restent gratuites. L'abonnement ajoute les demandes, les profils complets et les offres illimitées."],
      [null, "À vous de jouer", "Le plus utile pour commencer : compléter votre page, puis publier une première offre.", "page"]
    ] },
    "v-organisme": { nom: "votre espace organisme", etapes: [
      [null, "Bienvenue dans votre espace", "Vos sessions sont déjà comparées sur Fil Roug'Anim. Voici comment les mettre en avant, en quatre étapes."],
      ["fiche", "Votre fiche", "Présentez votre organisme et ajoutez le lien vers vos inscriptions : nous la relions à vos sessions sous 2 jours ouvrés."],
      ["zones", "Vos départements", "Choisissez sur la carte les départements où vos sessions passent en tête. Un seul partenaire par département."],
      ["factures", "Clics et factures", "Chaque clic compté est visible jour par jour, et la facture arrive une fois par mois."],
      ["tableau", "Votre tableau de bord", "Ce qui attend une action, vos chiffres et l'état de vos départements."],
      [null, "C'est parti !", "Commencez par votre fiche : tout le reste en découle.", "fiche"]
    ] },
    "v-parent": { nom: "votre espace parent", etapes: [
      [null, "Bienvenue dans votre espace", "Vos demandes de place, leurs réponses et les nouvelles des séjours, au même endroit. Voici le tour en une minute."],
      ["enfants", "Vos enfants", "Le prénom et l'année de naissance suffisent : vos demandes se remplissent plus vite."],
      ["inscriptions", "Vos demandes et inscriptions", "Chaque demande de place, avec la réponse de la structure. Vous pouvez lui écrire directement."],
      ["carnet", "Le carnet de séjour", "Quand une place est confirmée, l'équipe y donne des nouvelles pendant le séjour."],
      ["favoris", "Vos offres gardées", "Les séjours mis de côté pour comparer tranquillement."],
      [null, "Bonne recherche !", "Trouvez une colo, un mini-séjour ou un accueil de loisirs dans « Inscrire mon enfant », puis demandez une place."]
    ] },
    "v-admin": { nom: "l'administration", etapes: [
      [null, "Bienvenue dans l'administration", "Voici les rubriques, rangées par usage. Vous pourrez revoir cette visite dans « Guide de l'admin »."],
      ["accueil", "Aujourd'hui", "La vue d'ensemble, le QG des demandes, ce qu'il faut vérifier et l'état de santé du site : c'est votre routine quotidienne."],
      ["qg", "Le QG des demandes", "Les demandes des animateurs et des familles : donnez un suivi, transmettez-les à une structure."],
      ["comptes", "Les membres", "Tous les comptes : animateurs, parents, structures et organismes. Ouvrez l'espace de n'importe qui pour voir ce qu'il voit."],
      ["ventes", "La croissance", "Les ventes, la prospection, la visibilité sur Google et les statistiques."],
      ["offres", "Le contenu", "Les offres, les demandes, les contenus du site, les actualités et les guides pour les structures."],
      [null, "Bonne journée !", "Commencez chaque jour par la vue d'ensemble : les pastilles rouges disent où quelque chose attend."]
    ] }
  };

  var cours = null, i = 0, voile, lumiere, bulle, cible = null, menuOuvertParMoi = false;
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function cle(vue) { var m = document.getElementById("email-session"); return "fra-visite-" + vue + "-" + ((m && m.textContent) || "").trim().toLowerCase(); }
  function vue() { var v = document.querySelector(".compte-vue.co-onglets:not([hidden])"); return v && VISITES[v.id] ? v : null; }
  function vu(v) { try { return localStorage.getItem(cle(v)) === "1"; } catch (e) { return true; } }
  function marquer(v) { try { localStorage.setItem(cle(v), "1"); } catch (e) {} }
  function mobile() { return window.matchMedia("(max-width: 900px)").matches; }

  function trouver(v, nom) {
    var l = v.querySelectorAll('[data-onglet-vers="' + nom + '"]');
    for (var k = 0; k < l.length; k++) { var r = l[k].getBoundingClientRect(); if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth && !l[k].closest(".co-guide, .gd")) return l[k]; }
    return null;
  }

  function construire() {
    voile = el("div", "vg-voile"); voile.setAttribute("aria-hidden", "true");
    lumiere = el("div", "vg-lumiere"); lumiere.setAttribute("aria-hidden", "true");
    bulle = el("div", "vg-bulle"); bulle.setAttribute("role", "dialog"); bulle.setAttribute("aria-modal", "true"); bulle.setAttribute("aria-labelledby", "vg-titre");
    document.body.appendChild(voile); document.body.appendChild(lumiere); document.body.appendChild(bulle);
    document.addEventListener("keydown", function (e) {
      if (!cours) return;
      if (e.key === "Escape") fermer(); else if (e.key === "ArrowRight") aller(i + 1); else if (e.key === "ArrowLeft" && i > 0) aller(i - 1);
    });
    window.addEventListener("resize", function () { if (cours) placer(); });
    window.addEventListener("scroll", function () { if (cours) placer(); }, true);
  }

  function lancer(v) {
    v = v || vue(); if (!v) return;
    if (!voile) construire();
    cours = { v: v, def: VISITES[v.id] }; i = 0;
    document.documentElement.classList.add("vg-active");
    voile.hidden = lumiere.hidden = bulle.hidden = false;
    aller(0);
  }

  function aller(n) {
    var et = cours.def.etapes;
    if (n >= et.length) { fermer(et[et.length - 1][3]); return; }
    i = Math.max(0, n);
    var e = et[i];
    cible = e[0] ? trouver(cours.v, e[0]) : null;
    // sur mobile, le menu est replié : on l'ouvre le temps de montrer la rubrique
    if (e[0] && mobile()) {
      var deja = document.body.classList.contains("menu-ouvert");
      document.body.classList.add("menu-ouvert"); menuOuvertParMoi = menuOuvertParMoi || !deja;
      if (!deja) { cible = null; setTimeout(function () { if (cours) { cible = trouver(cours.v, e[0]); placer(); } }, 360); }
    }
    else if (!e[0] && menuOuvertParMoi) { document.body.classList.remove("menu-ouvert"); menuOuvertParMoi = false; }
    if (cible) cible.scrollIntoView({ block: "nearest" });
    // la fenêtre
    bulle.textContent = "";
    bulle.className = "vg-bulle" + (e[0] ? "" : " vg-centre");
    var haut = el("div", "vg-haut");
    haut.appendChild(el("span", "vg-etape", (i + 1) + " / " + et.length));
    var ign = el("button", "vg-ignorer", i === et.length - 1 ? "Fermer" : "Ignorer la visite"); ign.type = "button"; ign.addEventListener("click", function () { fermer(); });
    haut.appendChild(ign); bulle.appendChild(haut);
    if (!e[0] && i === 0) bulle.appendChild(el("span", "vg-icone", "👋"));
    var t = el("h2", null, e[1]); t.id = "vg-titre"; bulle.appendChild(t);
    bulle.appendChild(el("p", null, e[2]));
    var bas = el("div", "vg-bas"), pts = el("span", "vg-points");
    et.forEach(function (x, k) { pts.appendChild(el("i", k === i ? "on" : k < i ? "fait" : null)); });
    bas.appendChild(pts);
    var bt = el("span", "vg-boutons");
    if (i > 0) { var r = el("button", "vg-retour", "Retour"); r.type = "button"; r.addEventListener("click", function () { aller(i - 1); }); bt.appendChild(r); }
    var suiv = el("button", "vg-suivant", i === 0 ? "Commencer la visite" : i === et.length - 1 ? (e[3] ? "J'y vais" : "Terminer") : "Suivant"); suiv.type = "button";
    suiv.addEventListener("click", function () { aller(i + 1); }); bt.appendChild(suiv);
    bas.appendChild(bt); bulle.appendChild(bas);
    placer();
    suiv.focus({ preventScroll: true });
  }

  function placer() {
    if (!cours) return;
    var r = cible && cible.getBoundingClientRect();
    if (!r || !r.width) {
      lumiere.className = "vg-lumiere vg-sans"; voile.className = "vg-voile vg-plein";
      bulle.style.left = bulle.style.top = ""; bulle.classList.add("vg-centre"); return;
    }
    voile.className = "vg-voile"; lumiere.className = "vg-lumiere";
    var m = 6;
    lumiere.style.left = (r.left - m) + "px"; lumiere.style.top = (r.top - m) + "px";
    lumiere.style.width = (r.width + 2 * m) + "px"; lumiere.style.height = (r.height + 2 * m) + "px";
    bulle.classList.remove("vg-centre");
    var bw = bulle.offsetWidth, bh = bulle.offsetHeight, W = window.innerWidth, H = window.innerHeight, x, y;
    if (r.right + 18 + bw < W - 12) { x = r.right + 18; y = r.top + r.height / 2 - bh / 2; bulle.dataset.cote = "droite"; }
    else { x = Math.min(W - bw - 12, Math.max(12, r.left)); y = r.bottom + 14; bulle.dataset.cote = "bas"; if (y + bh > H - 12) { y = r.top - bh - 14; bulle.dataset.cote = "haut"; } }
    bulle.style.left = Math.round(x) + "px"; bulle.style.top = Math.round(Math.max(12, Math.min(H - bh - 12, y))) + "px";
  }

  function fermer(aller_vers) {
    if (!cours) return;
    marquer(cours.v.id);
    voile.hidden = lumiere.hidden = bulle.hidden = true;
    document.documentElement.classList.remove("vg-active");
    if (menuOuvertParMoi) { document.body.classList.remove("menu-ouvert"); menuOuvertParMoi = false; }
    var v = cours.v; cours = null;
    if (aller_vers) { var b = trouver(v, aller_vers) || v.querySelector('[data-onglet-vers="' + aller_vers + '"]'); if (b) b.click(); }
  }

  // la première fois qu'un espace s'ouvre (pas pendant la création du compte, ni quand l'admin regarde l'espace d'un autre)
  var dernier = null;
  function guetter() {
    if (cours) return;
    var v = vue();
    if (!v || v.id === dernier) return;
    if (document.body.classList.contains("en-parcours") || /[?&]compte=/.test(location.search)) return;
    dernier = v.id;
    if (!vu(v.id)) setTimeout(function () { if (!cours && vue() === v && !document.body.classList.contains("en-parcours")) lancer(v); }, 1200);
  }
  setInterval(guetter, 800);

  // « Revoir la visite guidée »
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-visite]");
    if (!b) return;
    e.preventDefault(); lancer(b.closest(".compte-vue"));
  });
  window.FRA_VISITE = { lancer: lancer };
})();

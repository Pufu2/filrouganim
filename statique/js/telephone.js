// Téléphone (≤ 700px) : la barre du haut façon application (recherche en pilule, catégories, compte), la feuille de recherche
// plein écran, la barre d'onglets du bas qui s'efface quand on lit. Sur ordinateur, rien de visible (tout est caché par da.css).
(function () {
  "use strict";
  /* -- la recherche qui sort de la barre et y retourne (comme l'application Airbnb) : une carte blanche « fantôme » passe
     de la pilule à la grande carte « Où ? » (ouverture) ou de la grande carte à la pilule (fermeture), en 380ms, pendant que
     le reste glisse et s'efface (telephone.css : tel-cherche-anim, tel-cherche-sort). Partagé par les trois scripts. -- */
  var DUREE = 380, COURBE = "cubic-bezier(.2, 0, 0, 1)";
  window.FRA_MORPH = function (sens, carte, pilule, fini) {
    if (!carte || !pilule || !carte.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { if (fini) fini(); return; }
    var a = pilule.getBoundingClientRect(), b = carte.getBoundingClientRect();
    if (!a.width || !b.width) { if (fini) fini(); return; }
    var f = document.createElement("div"); f.className = "tel-fantome";
    var t = pilule.querySelector("span"); if (t) { var c = t.cloneNode(true); c.className = "tel-fantome-t"; f.appendChild(c); }
    document.body.appendChild(f);
    var petit = { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px", borderRadius: (a.height / 2) + "px", boxShadow: "0 3px 12px -2px rgba(23,25,29,.14)" };
    var grand = { left: b.left + "px", top: b.top + "px", width: b.width + "px", height: b.height + "px", borderRadius: "32px", boxShadow: "0 8px 24px rgba(0,0,0,.16)" };
    var de = sens === "ouvrir" ? petit : grand, vers = sens === "ouvrir" ? grand : petit;
    carte.classList.add("tel-morph-cache");
    f.animate([de, vers], { duration: DUREE, easing: COURBE, fill: "forwards" });
    if (t) f.firstChild.animate(sens === "ouvrir" ? [{ opacity: 1 }, { opacity: 0, offset: .35 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0, offset: .55 }, { opacity: 1 }], { duration: DUREE, fill: "forwards" });
    setTimeout(function () {
      carte.classList.remove("tel-morph-cache");
      if (sens === "ouvrir" && carte.animate) carte.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
      f.remove(); if (sens === "fermer" && pilule.blur) pilule.blur(); if (fini) fini();
    }, DUREE);
  };

  var tel = window.matchMedia("(max-width: 700px)");
  var racine = document.documentElement;
  var barre = document.querySelector(".tel-barre");
  var feuille = document.querySelector(".tel-feuille");
  if (!barre || !feuille) return;
  var corps = feuille.querySelector(".tel-feuille-corps");
  var pilule = barre.querySelector(".tel-pilule");
  var lieu = barre.querySelector("[data-tel-lieu]");
  var boutonFiltres = barre.querySelector(".tel-filtres");

  // les pages de sessions (Se former) : copie de la page de résultats d'Airbnb, réglée dans telephone-sessions.js
  // pages de recherche façon Airbnb : sessions (telephone-sessions.js), offres, annuaire des structures, enfants (telephone-annuaires.js)
  var ab = !!document.querySelector("main form.recherche.rv, main #filtres-offres, main #sjc-filtres, main .an2-recherche form");
  if (ab && tel.matches) racine.classList.add("tel-ab");

  // la page Structures (/recruter/) : plus légère à lire (telephone.css, tel-recruter) — mêmes textes, rangés autrement :
  // l'essentiel en tuiles à icônes, les tarifs en trois cartes (le tableau détaillé replié), les questions toutes repliées
  if (tel.matches && /^\/recruter\/$/.test(location.pathname)) (function () {
    racine.classList.add("tel-recruter");
    var dossier = (document.querySelector(".tel-barre") || { dataset: {} }).dataset.icones || "/illus/icones/";
    function im(n) { var i = document.createElement("img"); i.src = dossier + n + ".png"; i.alt = ""; i.width = 28; i.height = 28; return i; }
    var IC = ["tout", "structure", "coin", "budget"];
    Array.prototype.forEach.call(document.querySelectorAll("main .rc2-ruban > li"), function (li, k) { li.insertBefore(im(IC[k] === "coin" ? "benevole" : IC[k]), li.firstChild); });
    var P = ["animateur", "sejours"];
    Array.prototype.forEach.call(document.querySelectorAll("main #usages .fs-porte"), function (c, k) { var t = c.querySelector(".fs-porte-t"); if (t) t.insertBefore(im(P[k] || "structure"), t.firstChild); });
    var tab = document.querySelector("main #tarifs .le-table");
    if (tab && !tab.closest("details")) {
      var d = document.createElement("details"); d.className = "tel-detail";
      var sm = document.createElement("summary"); sm.textContent = "Ce que comprend chaque formule"; d.appendChild(sm);
      tab.parentNode.insertBefore(d, tab); d.appendChild(tab);
      var prix = document.querySelector("main #tarifs .rc2-prix"); if (prix) prix.parentNode.insertBefore(prix, d);
    }
    Array.prototype.forEach.call(document.querySelectorAll("main #questions details[open]"), function (x) { x.open = false; });
    // l'annuaire des structures : une carte bien visible, juste sous les boutons du haut
    var act = document.querySelector("main .lc2-actions");
    if (act && !document.querySelector(".tel-vers-annuaire")) {
      var a = document.createElement("a"); a.className = "tel-cta tel-vers-annuaire"; a.href = "/recruter/structures/";
      var ic = document.createElement("span"); ic.className = "tel-cta-ic tel-cta-ic-clair"; ic.appendChild(im("structure")); a.appendChild(ic);
      var t = document.createElement("span"); t.className = "tel-cta-t";
      var b = document.createElement("b"); b.textContent = "L'annuaire des structures"; t.appendChild(b);
      t.appendChild(document.createTextNode("Leur page, leurs offres, leurs séjours.")); a.appendChild(t);
      var go = document.createElement("span"); go.className = "tel-cta-b"; go.textContent = "Voir"; a.appendChild(go);
      act.parentNode.insertBefore(a, act.nextSibling);
    }
  })();

  // la barre d'onglets du bas, plus fluide : l'onglet touché s'allume tout de suite (avant le chargement de la page, avec le
  // petit rebond de l'icône), et la page visée se précharge dès que le doigt se pose
  (function () {
    var ong = document.querySelector(".tel-onglets"); if (!ong) return;
    var vus = {};
    function precharger(a) {
      if (!a || vus[a.href] || a.href === location.href) return; vus[a.href] = 1;
      var l = document.createElement("link"); l.rel = "prefetch"; l.href = a.href; document.head.appendChild(l);
    }
    ong.addEventListener("touchstart", function (e) { precharger(e.target.closest("a")); }, { passive: true });
    ong.addEventListener("mouseover", function (e) { precharger(e.target.closest("a")); });
    ong.addEventListener("click", function (e) {
      var a = e.target.closest("a"); if (!a) return;
      Array.prototype.forEach.call(ong.querySelectorAll("a"), function (x) { x.removeAttribute("aria-current"); x.classList.remove("tel-pop"); });
      a.setAttribute("aria-current", "page"); void a.offsetWidth; a.classList.add("tel-pop");
    });
  })();

  // le style « lumière » (telephone.css) : des lumières floues derrière le haut de chaque page
  if (tel.matches && !document.querySelector(".tel-lumieres")) {
    var lum = document.createElement("div"); lum.className = "tel-lumieres"; lum.setAttribute("aria-hidden", "true");
    ["a", "b", "c"].forEach(function (k) { var x = document.createElement("span"); x.className = "tel-lum tel-lum-" + k; lum.appendChild(x); });
    document.body.insertBefore(lum, document.body.firstChild);
  }

  // une page qui a déjà sa barre d'action en bas (fiche séjour : « Demander une place ») garde la sienne
  if (document.querySelector(".sjf-barre")) racine.classList.add("tel-sans-onglets");

  /* -- la catégorie en cours (les liens avec ?type= se reconnaissent ici), placée en vue dans sa rangée -- */
  var ici = location.pathname + location.search;
  var cats = Array.prototype.slice.call(barre.querySelectorAll(".tel-cats a"));
  var exacte = cats.filter(function (a) { return a.dataset.cat === ici; })[0];
  // sinon, la catégorie la plus précise qui contient la page (ex. /se-former/sessions/yvelines/ → « Toutes »)
  if (!exacte && !barre.querySelector(".tel-cats [aria-current]")) exacte = cats.filter(function (a) { var c = a.dataset.cat; return c.indexOf("?") < 0 && c.indexOf("#") < 0 && location.pathname.indexOf(c) === 0; })
    .sort(function (a, b) { return b.dataset.cat.length - a.dataset.cat.length; })[0];
  if (exacte) cats.forEach(function (a) { if (a === exacte) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  var cour = barre.querySelector(".tel-cats [aria-current]");
  if (cour && cour.parentNode.scrollTo) cour.parentNode.scrollLeft = Math.max(0, cour.offsetLeft - 24);

  /* -- la recherche de la page : son formulaire passe dans la feuille, la pilule l'ouvre -- */
  var SELECTEURS = [".ac-hero-d .ac-carte", "form.recherche.rv", "#filtres-offres", "#sjc-filtres", ".an2-recherche form", ".hb-cherche"];
  var bloc = null, place = null;
  for (var i = 0; i < SELECTEURS.length && !bloc; i++) if (!ab) bloc = document.querySelector("main " + SELECTEURS[i]);
  function champ() { return bloc && bloc.querySelector('input[type="search"], input[type="text"], input:not([type])'); }
  function majLieu() {
    var c = champ();
    if (lieu && c && c.value.trim()) { lieu.textContent = c.value.trim(); lieu.classList.add("tel-lieu-plein"); }
  }
  function ranger() {
    if (!bloc) return;
    if (tel.matches && bloc.parentNode !== corps) {
      place = document.createComment("recherche"); bloc.parentNode.insertBefore(place, bloc); corps.appendChild(bloc);
      racine.classList.add("tel-a-recherche");
    } else if (!tel.matches && place) {
      place.parentNode.insertBefore(bloc, place); place.remove(); place = null; fermer();
      racine.classList.remove("tel-a-recherche");
    }
  }
  function ouvrir() {
    racine.classList.add("tel-cherche");
    window.FRA_MORPH("ouvrir", corps.firstElementChild, pilule);
  }
  var sortie = false;
  function fermer() {
    if (!racine.classList.contains("tel-cherche") || sortie) return;
    sortie = true; racine.classList.add("tel-cherche-sort");
    window.FRA_MORPH("fermer", corps.firstElementChild, pilule, function () {
      feuille.style.transition = "none"; racine.classList.remove("tel-cherche", "tel-cherche-sort"); void feuille.offsetWidth; feuille.style.transition = "";
      sortie = false; majLieu();
    });
  }
  if (bloc) {
    ranger();
    majLieu();
    pilule.addEventListener("click", function (e) { if (!tel.matches || !racine.classList.contains("tel-a-recherche")) return; e.preventDefault(); ouvrir(); });
    feuille.querySelector(".tel-feuille-fermer").addEventListener("click", fermer);
    // chercher ferme la feuille (le formulaire fait ensuite son travail, comme avant)
    var form = bloc.tagName === "FORM" ? bloc : bloc.querySelector("form");
    Array.prototype.forEach.call(bloc.querySelectorAll("form"), function (f) { f.addEventListener("submit", function () { setTimeout(fermer, 0); }); });
    if (form) form.addEventListener("submit", function () { setTimeout(fermer, 0); });
    // une ville choisie dans la liste : on revient aux résultats
    if (!bloc.matches(".ac-carte")) bloc.addEventListener("click", function (e) { if (e.target.closest && e.target.closest(".villes-choix, [role=option]")) setTimeout(fermer, 120); });
    // les filtres de la page, depuis le rond à côté de la pilule
    var f = Array.prototype.filter.call(bloc.querySelectorAll("button"), function (b) { return /filtres/i.test(b.className) || /Filtres/.test(b.textContent); })[0];
    // (la feuille s'ouvre d'abord : les filtres de la page sont dedans ; elle se referme avec eux)
    if (f && boutonFiltres) {
      boutonFiltres.hidden = false;
      var parFiltres = false;
      boutonFiltres.addEventListener("click", function () { racine.classList.add("tel-cherche"); setTimeout(function () { f.click(); parFiltres = true; }, 30); });
      new MutationObserver(function () {
        var ouverts = racine.classList.contains("ff-ouverte") || !!bloc.querySelector(".tp-voile:not([hidden]), .ff-voile:not([hidden])");
        if (parFiltres && !ouverts) { parFiltres = false; fermer(); }
      }).observe(racine, { attributes: true, attributeFilter: ["class"] });
    }
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && racine.classList.contains("tel-cherche")) fermer(); });
  }
  tel.addEventListener("change", function () { ranger(); racine.classList.remove("tel-cache", "tel-compact"); mesurer(); });

  /* -- en descendant : la barre du haut se resserre (les icônes des catégories s'effacent), les onglets du bas se cachent -- */
  function mesurer() { racine.style.setProperty("--tel-barre-h", (tel.matches ? barre.offsetHeight : 0) + "px"); }
  var dernier = window.scrollY, attente = false;
  function defiler() {
    attente = false;
    var y = window.scrollY, d = y - dernier;
    racine.classList.toggle("tel-defile", y > 4);
    var compact = y > 40;
    if (compact !== racine.classList.contains("tel-compact")) { racine.classList.toggle("tel-compact", compact); setTimeout(mesurer, 260); }
    // (pages de sessions : comme chez Airbnb, les onglets du bas restent là pendant qu'on fait défiler la liste)
    if (!tel.matches || ab || racine.classList.contains("ff-ouverte") || racine.classList.contains("tel-cherche")) { racine.classList.remove("tel-cache"); dernier = y; return; }
    if (y < 120) racine.classList.remove("tel-cache");
    else if (d > 6) racine.classList.add("tel-cache");
    else if (d < -6) racine.classList.remove("tel-cache");
    if (Math.abs(d) > 6) dernier = y;
  }
  window.addEventListener("scroll", function () { if (!attente) { attente = true; requestAnimationFrame(defiler); } }, { passive: true });
  window.addEventListener("resize", mesurer);
  mesurer(); defiler();
})();

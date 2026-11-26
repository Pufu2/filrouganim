// Téléphone (≤ 700px) : la barre du haut façon application (recherche en pilule, catégories, compte), la feuille de recherche
// plein écran, la barre d'onglets du bas qui s'efface quand on lit. Sur ordinateur, rien de visible (tout est caché par da.css).
(function () {
  "use strict";
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
    var c = champ(); if (c) setTimeout(function () { c.focus(); }, 60);
  }
  function fermer() { racine.classList.remove("tel-cherche"); majLieu(); }
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

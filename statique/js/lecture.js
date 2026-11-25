/* Fil Roug'Anim : pages de lecture (gabarits/lecture.html, docs/CHARTE.md).
   Le sommaire de côté suit la lecture : la partie en cours est soulignée. Le sommaire replié (téléphone) se referme après un clic. */
(function () {
  "use strict";
  var liens = document.querySelectorAll(".le-som:not(.le-az) a");
  if (liens.length && "IntersectionObserver" in window) {
    var parId = {};
    Array.prototype.forEach.call(liens, function (a) { parId[a.getAttribute("href").slice(1)] = a; });
    var titres = Object.keys(parId).map(function (i) { return document.getElementById(i); }).filter(Boolean);
    var actif = null;
    function marquer(id) {
      if (actif === id) return; actif = id;
      Array.prototype.forEach.call(liens, function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + id); });
    }
    function calculer() {
      var haut = 140, courant = titres[0] && titres[0].id;
      titres.forEach(function (t) { if (t.getBoundingClientRect().top < haut) courant = t.id; });
      if (titres[0] && titres[0].getBoundingClientRect().top > window.innerHeight) courant = null;
      marquer(courant);
    }
    var attente = false;
    window.addEventListener("scroll", function () { if (attente) return; attente = true; requestAnimationFrame(function () { attente = false; calculer(); }); }, { passive: true });
    calculer();
  }
  var replie = document.querySelector(".le-som-mobile");
  if (replie) replie.addEventListener("click", function (e) { if (e.target.closest("a")) replie.open = false; });
})();

/* La barre des sections (pages locales, page Structures) : la section en cours est soulignée */
(function () {
  "use strict";
  var liens = document.querySelectorAll(".fs-sections-liens a");
  if (!liens.length || !window.IntersectionObserver) return;
  var parId = {};
  Array.prototype.forEach.call(liens, function (a) { parId[a.getAttribute("href").slice(1)] = a; });
  var vu = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) {
      if (!e.isIntersecting) return;
      var a = parId[e.target.id]; if (!a) return;
      Array.prototype.forEach.call(liens, function (x) { x.classList.toggle("on", x === a); });
      a.parentNode.scrollTo({ left: Math.max(0, a.offsetLeft - 24), behavior: "smooth" });
    });
  }, { rootMargin: "-80px 0px -65% 0px" });
  Object.keys(parId).forEach(function (id) { var s = document.getElementById(id); if (s) vu.observe(s); });
})();

/* L'annuaire des structures : chercher par nom, ville ou département, filtrer par type d'accueil */
(function () {
  "use strict";
  var liste = document.getElementById("annuaire"), champ = document.getElementById("an-q");
  if (!liste || !champ) return;
  var cartes = liste.querySelectorAll("li[data-texte]"), puces = document.querySelectorAll("[data-an-type]"), nb = document.getElementById("an-nb"), vide = document.getElementById("an-vide");
  var type = "";
  function sansAccents(t) { return (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function filtrer() {
    var q = sansAccents(champ.value.trim()), n = 0;
    Array.prototype.forEach.call(cartes, function (c) {
      var ok = (!q || sansAccents(c.dataset.texte).indexOf(q) >= 0) && (!type || (" " + c.dataset.type + " ").indexOf(" " + type + " ") >= 0);
      c.hidden = !ok; if (ok && !c.classList.contains("ac-ex")) n++;
    });
    if (nb) nb.textContent = n + " structure" + (n > 1 ? "s" : "");
    if (vide) vide.hidden = n > 0;
  }
  champ.addEventListener("input", filtrer);
  var voile = document.getElementById("an-ff"), pastille = document.querySelector("[data-an-nbf]");
  function fermer() { if (voile) voile.hidden = true; }
  var ouvrir = document.querySelector("[data-an-ouvrir]");
  if (ouvrir && voile) ouvrir.addEventListener("click", function () { voile.hidden = false; });
  Array.prototype.forEach.call(document.querySelectorAll("[data-an-fermer]"), function (b) { b.addEventListener("click", fermer); });
  if (voile) voile.addEventListener("click", function (e) { if (e.target === voile) fermer(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fermer(); });
  var effacer = document.querySelector("[data-an-effacer]");
  if (effacer) effacer.addEventListener("click", function () { champ.value = ""; puces[0].click(); });
  Array.prototype.forEach.call(puces, function (b) {
    b.addEventListener("click", function () {
      type = b.dataset.anType;
      Array.prototype.forEach.call(puces, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      if (pastille) pastille.hidden = !type;
      filtrer();
    });
  });
  filtrer();
})();

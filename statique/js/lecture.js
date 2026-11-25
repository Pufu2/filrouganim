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

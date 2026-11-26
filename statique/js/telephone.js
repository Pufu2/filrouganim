// Téléphone (≤ 700px) : la barre d'onglets du bas, le menu en feuille, le haut et le bas qui s'effacent quand on lit.
// Sur ordinateur, ce script ne fait rien de visible (la barre est cachée par la feuille de style).
(function () {
  "use strict";
  var tel = window.matchMedia("(max-width: 700px)");
  var racine = document.documentElement;
  var onglets = document.querySelector(".tel-onglets");
  var nav = document.getElementById("menu-principal");
  var tiroir = document.querySelector(".mm-tiroir");
  var bouton = document.querySelector(".tel-onglet-menu");

  // une page qui a déjà sa barre d'action en bas (fiche séjour : « Demander une place ») garde la sienne, comme une fiche d'application
  if (document.querySelector(".sjf-barre")) racine.classList.add("tel-sans-onglets");

  /* -- le menu : la feuille s'ouvre depuis l'onglet « Menu » (le tiroir du menu fait le travail) -- */
  function ouvert() { return tiroir && tiroir.getAttribute("aria-expanded") === "true"; }
  function majBouton() { if (bouton) bouton.setAttribute("aria-expanded", ouvert() ? "true" : "false"); }
  if (bouton && tiroir) {
    bouton.addEventListener("click", function () { racine.classList.remove("tel-cache"); tiroir.click(); majBouton(); });
    var fermer = document.querySelector(".mm-tel-fermer");
    if (fermer) fermer.addEventListener("click", function () { if (ouvert()) tiroir.click(); majBouton(); });
    // un toucher sur le voile, hors de la feuille et de la barre, la ferme
    document.addEventListener("click", function (e) {
      if (!tel.matches || !ouvert()) return;
      if (nav.contains(e.target) || (onglets && onglets.contains(e.target)) || tiroir.contains(e.target)) return;
      tiroir.click(); majBouton();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ouvert()) { tiroir.click(); majBouton(); } });
  }

  /* -- en lisant (on descend), le haut et la barre d'onglets s'effacent ; ils reviennent dès qu'on remonte -- */
  var dernier = window.scrollY, attente = false;
  function defiler() {
    attente = false;
    var y = window.scrollY, d = y - dernier;
    if (!tel.matches || ouvert() || racine.classList.contains("ff-ouverte")) { racine.classList.remove("tel-cache"); dernier = y; return; }
    if (y < 120) racine.classList.remove("tel-cache");
    else if (d > 6) racine.classList.add("tel-cache");
    else if (d < -6) racine.classList.remove("tel-cache");
    if (Math.abs(d) > 6) dernier = y;
  }
  window.addEventListener("scroll", function () { if (!attente) { attente = true; requestAnimationFrame(defiler); } }, { passive: true });
  tel.addEventListener("change", function () { racine.classList.remove("tel-cache"); });
})();

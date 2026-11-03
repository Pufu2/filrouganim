// Le bouton « Filtres » de la page des sessions : ouvre et ferme le panneau, compte les filtres choisis,
// « Tout effacer » remet la recherche à zéro. Le filtrage lui-même reste dans filtres.js.
(function () {
  var form = document.getElementById("filtres");
  var bouton = document.getElementById("ouvrir-filtres");
  var panneau = document.getElementById("panneau-filtres");
  if (!form || !bouton || !panneau) return;
  var pastille = document.getElementById("nb-filtres");
  var champs = ["diplome", "type", "mois", "annee", "q"];

  function compter() {
    var n = champs.filter(function (c) { return form.elements[c] && form.elements[c].value; }).length;
    pastille.textContent = n;
    pastille.hidden = n === 0;
  }
  function ouvrir(oui) {
    panneau.hidden = !oui;
    bouton.setAttribute("aria-expanded", oui ? "true" : "false");
    if (oui) { var premier = panneau.querySelector("select, input"); if (premier) premier.focus(); }
  }
  bouton.addEventListener("click", function () { ouvrir(panneau.hidden); });
  document.getElementById("fermer-filtres").addEventListener("click", function () {
    ouvrir(false);
    var r = document.getElementById("resultats");
    if (r) r.scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("effacer-filtres").addEventListener("click", function () {
    champs.forEach(function (c) { if (form.elements[c]) form.elements[c].value = ""; });
    form.dispatchEvent(new Event("change", { bubbles: true }));
    compter();
  });
  panneau.addEventListener("keydown", function (e) { if (e.key === "Escape") { ouvrir(false); bouton.focus(); } });
  form.addEventListener("change", compter);
  form.addEventListener("input", compter);
  compter();
  if (/[?&]filtres=ouverts/.test(location.search)) ouvrir(true);
})();

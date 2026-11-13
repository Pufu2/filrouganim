/* Fil Roug'Anim : le compteur du tableau de bord des structures. Une vue par visite et par page (gardée le temps de
   l'onglet), et les clics sur « Postuler » et « Le site de la structure ». Rien de personnel n'est envoyé :
   l'identifiant de la structure, le type et, pour une offre, son numéro. */
(function () {
  "use strict";
  var c = document.getElementById("stat");
  if (!c || !c.dataset.s || navigator.webdriver) return;
  var o = parseInt(c.dataset.o || "0", 10) || 0;
  function compter(t) {
    try {
      fetch(c.dataset.url + "/rest/v1/rpc/compter", {
        method: "POST", keepalive: true,
        headers: { "Content-Type": "application/json", apikey: c.dataset.cle },
        body: JSON.stringify({ s: c.dataset.s, t: t, o: o })
      }).catch(function () {});
    } catch (e) {}
  }
  var cle = "fra-vu:" + location.pathname, deja = false;
  try { deja = sessionStorage.getItem(cle) === "1"; sessionStorage.setItem(cle, "1"); } catch (e) {}
  if (!deja) compter(c.dataset.t);
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-stat]");
    if (a) compter(a.dataset.stat);
  });
})();

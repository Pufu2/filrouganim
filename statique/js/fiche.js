/* Fil Roug'Anim : les fiches (structures et profils).
   - « Lire la suite » : la présentation est repliée quand elle est longue ;
   - la carte « Où » : des points (ville ou centre du département), jamais une adresse.
   window.FicheFRA.preparer(racine) sert aussi aux fiches affichées dans « Mon espace ». */
(function () {
  "use strict";
  function replier(racine) {
    Array.prototype.forEach.call(racine.querySelectorAll("[data-replie]"), function (t) {
      var b = t.parentNode.querySelector(".fp-lire");
      if (!b || t.dataset.pret) return;
      t.dataset.pret = "1";
      if (t.scrollHeight <= 190) return;
      t.classList.add("fp-replie");
      b.hidden = false;
      b.addEventListener("click", function () {
        var ouvert = t.classList.toggle("fp-replie") === false;
        b.textContent = ouvert ? "Replier" : "Lire la suite";
        b.setAttribute("aria-expanded", ouvert ? "true" : "false");
      });
    });
  }
  function carte(el) {
    if (!window.L || el.dataset.pret) return;
    var d;
    try { d = JSON.parse(el.dataset.fpCarte); } catch (e) { return; }
    if (!d.points || !d.points.length) { el.hidden = true; return; }
    el.dataset.pret = "1";
    var plan = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    L.tileLayer(el.dataset.tuiles, { maxZoom: 16, minZoom: 4, attribution: "&copy; IGN &ndash; Géoplateforme" }).addTo(plan);
    var style = getComputedStyle(el), couleur = style.getPropertyValue("--theme").trim() || "#c8102e";
    var limites = [];
    d.points.forEach(function (p) {
      var principal = p[3] === 1;
      L.circle([p[0], p[1]], { radius: principal ? 9000 : 16000, color: couleur, weight: principal ? 2 : 1.5, dashArray: principal ? null : "5 5",
        fillColor: couleur, fillOpacity: principal ? 0.28 : 0.12 }).addTo(plan).bindTooltip(p[2]);
      L.circleMarker([p[0], p[1]], { radius: principal ? 7 : 4, color: "#fff", weight: 2, fillColor: couleur, fillOpacity: 1 }).addTo(plan);
      limites.push([p[0], p[1]]);
    });
    if (limites.length === 1) plan.setView(limites[0], 9);
    else plan.fitBounds(limites, { padding: [40, 40], maxZoom: 9 });
  }
  function preparer(racine) {
    racine = racine || document;
    replier(racine);
    var cartes = racine.querySelectorAll("[data-fp-carte]");
    if (!cartes.length) return;
    if (window.L) { Array.prototype.forEach.call(cartes, carte); return; }
    // Leaflet arrive avec « defer » : on attend qu'il soit là
    var n = 0, t = setInterval(function () {
      if (window.L || ++n > 40) { clearInterval(t); Array.prototype.forEach.call(cartes, carte); }
    }, 150);
  }
  window.FicheFRA = { preparer: preparer };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { preparer(document); });
  else preparer(document);
})();

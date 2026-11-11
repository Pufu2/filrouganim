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
  // une petite carte de France, dans un coin, qui montre où se trouve l'endroit (contour simplifié, projection simple)
  var FRANCE = "M53.3 2.1 L57.8 5.0 L64.7 10.0 L69.5 12.0 L75.7 17.5 L79.8 18.5 L88.1 22.5 L92.2 23.3 L88.1 37.0 L84.0 38.0 L83.3 41.0 L77.8 47.0 L78.5 49.0 L82.6 49.0 L84.0 54.0 L82.6 56.0 L84.7 61.0 L81.2 62.0 L84.0 70.5 L88.8 75.0 L86.7 76.0 L81.9 81.0 L76.4 82.0 L70.2 79.5 L64.7 78.5 L58.5 80.5 L56.4 87.0 L49.6 89.0 L40.6 85.0 L33.7 84.5 L26.2 80.5 L23.4 79.0 L27.2 67.0 L27.5 55.0 L25.5 49.0 L21.3 44.0 L18.6 40.0 L11.7 36.0 L5.5 35.0 L2.8 29.0 L8.3 26.0 L15.1 25.0 L24.8 26.5 L22.7 16.0 L27.2 16.5 L28.2 19.5 L37.2 18.5 L36.5 16.0 L46.1 11.0 L46.8 4.0Z" +
               "M100.5 83.0 L101.5 87.0 L100.5 99.0 L99.1 99.3 L95.7 96.0 L95.0 90.0 L98.4 85.5Z";
  function miniFrance(points) {
    var NS = "http://www.w3.org/2000/svg", k = Math.cos(46.5 * Math.PI / 180);
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "-4 -4 112 110"); s.setAttribute("class", "fp-mini"); s.setAttribute("aria-hidden", "true");
    var f = document.createElementNS(NS, "path"); f.setAttribute("d", FRANCE); f.setAttribute("class", "fp-mini-fr"); s.appendChild(f);
    points.forEach(function (p) {
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", ((p[1] + 5.2) * k * 10).toFixed(1)); c.setAttribute("cy", ((51.3 - p[0]) * 10).toFixed(1));
      c.setAttribute("r", p[3] === 1 ? 7 : 4.5); c.setAttribute("class", p[3] === 1 ? "fp-mini-pt" : "fp-mini-pt fp-mini-pt2");
      s.appendChild(c);
    });
    return s;
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
    el.appendChild(miniFrance(d.points));
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

// Filtres des sessions, entièrement dans le navigateur (aucun serveur, aucun cookie).
// Sans JavaScript, toutes les sessions restent affichées.
(function () {
  var form = document.getElementById("filtres");
  if (!form) return;
  var cartes = Array.prototype.slice.call(document.querySelectorAll(".session"));
  var compte = document.getElementById("compte");
  var aucune = document.getElementById("aucune");

  // Les filtres choisis sont gardés dans l'adresse (ex. ?dep=93&periode=hiver-2027) : on peut partager le lien.
  var params = new URLSearchParams(location.search);
  Array.prototype.forEach.call(form.elements, function (el) {
    if (!el.name || !params.has(el.name)) return;
    if (el.type === "checkbox") el.checked = params.get(el.name) === "1";
    else el.value = params.get(el.name);
  });

  function appliquer() {
    var f = form.elements;
    var dep = f.dep.value, periode = f.periode.value, type = f.type.value, formule = f.formule.value;
    var prix = parseFloat(f.prix.value), libres = f.libres.checked;
    var n = 0;
    cartes.forEach(function (c) {
      var d = c.dataset;
      var ok = (!dep || d.dep === dep) && (!periode || d.periode === periode) &&
        (!type || d.type === type) && (!formule || d.formule === formule) &&
        (isNaN(prix) || (d.prix !== "" && parseFloat(d.prix) <= prix)) &&
        (!libres || d.complet !== "oui");
      c.hidden = !ok;
      if (ok) n++;
    });
    compte.textContent = n + (n > 1 ? " sessions correspondent." : " session correspond.") +
      (isNaN(prix) ? "" : " Les sessions sans prix relevé sont cachées par le filtre de prix.");
    aucune.hidden = n > 0;
    var p = new URLSearchParams();
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === "checkbox") { if (el.checked) p.set(el.name, "1"); }
      else if (el.value) p.set(el.name, el.value);
    });
    var q = p.toString();
    history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
  }
  // Dans la phrase « Je cherche… », chaque liste prend la largeur du choix affiché (et pas du plus long).
  var mesure = document.createElement("span");
  mesure.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
  document.body.appendChild(mesure);
  function ajuster() {
    Array.prototype.forEach.call(form.querySelectorAll(".phrase > label select"), function (s) {
      mesure.style.font = getComputedStyle(s).font;
      mesure.textContent = s.options[s.selectedIndex].text;
      s.style.width = Math.ceil(mesure.getBoundingClientRect().width + 30) + "px";
    });
  }
  form.addEventListener("change", ajuster);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajuster);
  ajuster();

  form.addEventListener("input", appliquer);
  form.addEventListener("change", appliquer);
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  if (params.toString()) appliquer();
})();

// Recherche, filtres et « Voir plus », entièrement dans le navigateur (aucun serveur, aucun cookie).
// Sans JavaScript, toutes les sessions restent affichées et le formulaire de l'accueil ouvre /sessions/.
(function () {
  function sansAccents(t) {
    return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  // --- « Voir plus » : chaque liste montre N sessions, puis N de plus à chaque clic
  var listes = Array.prototype.map.call(document.querySelectorAll(".sessions[data-par-page]"), function (el) {
    var bouton = el.nextElementSibling && el.nextElementSibling.querySelector(".voir-plus");
    var liste = { el: el, cartes: Array.prototype.slice.call(el.querySelectorAll(".session")),
                  par: parseInt(el.dataset.parPage, 10) || 10, bouton: bouton };
    liste.limite = liste.par;
    liste.cartes.forEach(function (c) { c.dataset.ok = "1"; c.dataset.texteNorm = sansAccents(c.dataset.texte); });
    if (bouton) bouton.addEventListener("click", function () {
      var premiereCachee = liste.cartes.filter(function (c) { return c.dataset.ok === "1"; })[liste.limite];
      liste.limite += liste.par;
      afficher(liste);
      if (premiereCachee) premiereCachee.querySelector("a").focus({ preventScroll: true });
    });
    afficher(liste);
    return liste;
  });

  function afficher(liste) {
    var n = 0;
    liste.cartes.forEach(function (c) {
      var ok = c.dataset.ok === "1";
      c.hidden = !ok || n >= liste.limite;
      if (ok) n++;
    });
    if (liste.bouton) {
      var reste = n - liste.limite;
      liste.bouton.hidden = reste <= 0;
      liste.bouton.textContent = "Voir plus de sessions (" + reste + " de plus)";
    }
    return n;
  }

  // --- Accueil : l'adresse de /sessions/ ne garde que les critères choisis
  Array.prototype.forEach.call(document.querySelectorAll("form.recherche:not(#filtres)"), function (f) {
    f.addEventListener("submit", function () {
      Array.prototype.forEach.call(f.elements, function (el) { if (el.name && !el.value) el.disabled = true; });
      setTimeout(function () { Array.prototype.forEach.call(f.elements, function (el) { el.disabled = false; }); }, 0);
    });
  });

  // --- Filtres en direct (page /sessions/)
  var form = document.getElementById("filtres");
  if (!form || !listes.length) return;
  var liste = listes[0];
  var compte = document.getElementById("compte");
  var aucune = document.getElementById("aucune");

  // Les choix sont gardés dans l'adresse (ex. ?diplome=BAFA&dep=93&quand=p:hiver-2027) : on peut partager le lien.
  var params = new URLSearchParams(location.search);
  if (params.has("periode") && !params.has("quand")) params.set("quand", "p:" + params.get("periode")); // anciens liens
  Array.prototype.forEach.call(form.elements, function (el) {
    if (!el.name || !params.has(el.name)) return;
    if (el.type === "checkbox") el.checked = params.get(el.name) === "1";
    else el.value = params.get(el.name);
  });

  // « Quelle étape ? » ne propose que les étapes du diplôme choisi (le BPJEPS, le DEJEPS… se suivent d'un bloc)
  var selEtape = form.elements.type;
  var etapes = Array.prototype.slice.call(selEtape.options, 1);
  function adapterEtapes() {
    var dip = form.elements.diplome.value;
    var visibles = 0;
    etapes.forEach(function (o) {
      var montrer = !dip || o.dataset.diplome === dip;
      o.hidden = !montrer; o.disabled = !montrer;
      if (montrer) visibles++;
    });
    if (selEtape.selectedOptions[0] && selEtape.selectedOptions[0].disabled) selEtape.value = "";
    selEtape.disabled = visibles === 0;
    selEtape.options[0].textContent = visibles === 0 ? "Formation complète" : "Toutes";
    // le parcours affiché sous les résultats suit le diplôme choisi
    Array.prototype.forEach.call(document.querySelectorAll("[data-parcours]"), function (bloc) {
      bloc.hidden = bloc.dataset.parcours !== (dip || "BAFA");
    });
  }

  function appliquer(majAdresse) {
    var f = form.elements;
    adapterEtapes();
    var dip = f.diplome.value, dep = f.dep.value, quand = f.quand.value, type = f.type.value;
    var prix = parseFloat(f.prix.value);
    var mots = sansAccents(f.q.value).split(/\s+/).filter(Boolean);
    liste.cartes.forEach(function (c) {
      var d = c.dataset;
      var okQuand = !quand || (quand.slice(0, 2) === "p:" ? d.periode === quand.slice(2) : d.mois === quand.slice(2));
      var ok = (!dip || d.diplome === dip) && (!dep || d.dep === dep) && okQuand && (!type || d.type === type) &&
        (isNaN(prix) || (d.prix !== "" && parseFloat(d.prix) <= prix)) &&
        mots.every(function (m) { return d.texteNorm.indexOf(m) !== -1; });
      d.ok = ok ? "1" : "0";
    });
    liste.limite = liste.par;
    var n = afficher(liste);
    compte.textContent = n === 0 ? "Aucune session." : n + (n > 1 ? " sessions correspondent" : " session correspond") +
      ", de la plus proche à la plus lointaine.";
    aucune.hidden = n > 0;
    if (majAdresse) {
      var p = new URLSearchParams();
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.disabled) return;
        if (el.type === "checkbox") { if (el.checked) p.set(el.name, "1"); }
        else if (el.value) p.set(el.name, el.value);
      });
      var q = p.toString();
      history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
    }
  }
  form.addEventListener("change", function () { appliquer(true); });
  form.addEventListener("input", function (e) { if (e.target.name === "q") appliquer(true); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    appliquer(true);
    document.getElementById("resultats").scrollIntoView({ behavior: "smooth" });
  });
  if (params.toString()) appliquer(false); else adapterEtapes();
})();

// Recherche, filtres et « Voir plus », entièrement dans le navigateur (aucun serveur, aucun cookie).
// Pages de listes : les sessions sont dans la page. Page de recherche : les 30 plus proches sont dans la page
// (lisibles sans JavaScript) et toutes les autres arrivent du fichier sessions.json, carte par carte quand il faut.
(function () {
  function sansAccents(t) {
    return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  function el(tag, classe, texte) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }
  var MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function euros(x) { return (Number.isInteger(x) ? String(x) : x.toFixed(2).replace(".", ",")) + " €"; }

  // --- une carte de session à partir des données (même contenu que la carte fabriquée par le site)
  function carte(x, lienOrganismes) {
    var a = el("article", "session" + (x.c ? " session-complete" : ""));
    var date = el("p", "s-date");
    date.setAttribute("aria-hidden", "true");
    date.appendChild(el("b", null, String(x.j)));
    date.appendChild(el("span", null, MOIS[parseInt(x.m.slice(5), 10) - 1]));
    a.appendChild(date);
    var corps = el("div", "s-corps");
    var h = el("h3", "s-titre", x.dn + (x.t !== "parcours" && x.t !== "session" ? " · " + x.tn.toLowerCase() : ""));
    if (x.th && x.t !== "parcours") { h.appendChild(document.createTextNode(" ")); h.appendChild(el("span", "s-theme", x.th)); }
    corps.appendChild(h);
    var infos = el("p", "s-infos");
    infos.appendChild(document.createTextNode(x.dates + " · "));
    infos.appendChild(el("b", null, x.v));
    infos.appendChild(document.createTextNode(" (" + x.d + ")" + (x.f ? " · " + x.f : "") + " · "));
    if (x.oi) { var lo = el("a", null, x.o); lo.href = lienOrganismes + x.oi + "/"; infos.appendChild(lo); }
    else infos.appendChild(document.createTextNode(x.o));
    corps.appendChild(infos);
    var verif = el("p", "s-verif");
    if (x.c) { verif.appendChild(el("b", "s-complet", "Complet")); verif.appendChild(document.createTextNode(" · ")); }
    verif.appendChild(document.createTextNode(x.n.concat([x.vf + ", à confirmer chez l'organisme"]).join(" · ")));
    corps.appendChild(verif);
    a.appendChild(corps);
    var prix = el("p", "s-prix");
    if (x.px !== null && x.px !== undefined) prix.textContent = euros(x.px); else prix.appendChild(el("span", null, "prix à voir"));
    a.appendChild(prix);
    var lien = el("a", "s-lien", "Voir");
    lien.href = x.u; lien.rel = "noopener nofollow"; lien.target = "_blank";
    lien.appendChild(el("span", "sr", " la session chez " + x.o + " (nouvel onglet)"));
    lien.appendChild(document.createTextNode(" →"));
    a.appendChild(lien);
    return a;
  }

  // --- les listes : chaque élément a ses critères (d) et sa carte (déjà dans la page, ou fabriquée au besoin)
  function depuisCarte(c) {
    var d = c.dataset;
    return { el: c, d: { dep: d.dep, region: d.region, periode: d.periode, mois: d.mois, diplome: d.diplome, type: d.type,
                         prix: d.prix, texte: sansAccents(d.texte) }, ok: true };
  }
  var listes = Array.prototype.map.call(document.querySelectorAll(".sessions[data-par-page]"), function (conteneur) {
    var bouton = conteneur.nextElementSibling && conteneur.nextElementSibling.querySelector(".voir-plus");
    var liste = { el: conteneur, items: Array.prototype.map.call(conteneur.querySelectorAll(".session"), depuisCarte),
                  par: parseInt(conteneur.dataset.parPage, 10) || 10, bouton: bouton };
    liste.limite = liste.par;
    if (bouton) bouton.addEventListener("click", function () {
      var premiere = liste.items.filter(function (i) { return i.ok; })[liste.limite];
      liste.limite += liste.par;
      afficher(liste);
      if (premiere && premiere.el) premiere.el.querySelector("a").focus({ preventScroll: true });
    });
    afficher(liste);
    return liste;
  });

  function afficher(liste) {
    var n = 0;
    liste.items.forEach(function (i) {
      var voir = i.ok && n < liste.limite;
      if (voir && !i.el) { i.el = carte(i.x, liste.lienOrganismes); liste.el.appendChild(i.el); }
      if (voir && i.el.parentNode !== liste.el) liste.el.appendChild(i.el);
      if (i.el) i.el.hidden = !voir;
      if (i.ok) n++;
    });
    // l'ordre des cartes suit l'ordre des données (date, puis prix)
    if (liste.items.some(function (i) { return i.x; })) {
      liste.items.forEach(function (i) { if (i.el && !i.el.hidden) liste.el.appendChild(i.el); });
    }
    if (liste.bouton) {
      var reste = n - liste.limite;
      liste.bouton.hidden = reste <= 0;
      liste.bouton.textContent = "Voir plus de sessions (" + reste + " de plus)";
    }
    return n;
  }

  // --- Accueil et autres formulaires : l'adresse de la recherche ne garde que les critères choisis
  Array.prototype.forEach.call(document.querySelectorAll("form.recherche:not(#filtres)"), function (f) {
    f.addEventListener("submit", function () {
      Array.prototype.forEach.call(f.elements, function (e) { if (e.name && !e.value) e.disabled = true; });
      setTimeout(function () { Array.prototype.forEach.call(f.elements, function (e) { e.disabled = false; }); }, 0);
    });
  });

  // --- Filtres en direct (page de recherche)
  var form = document.getElementById("filtres");
  if (!form || !listes.length) return;
  var liste = listes[0];
  var compte = document.getElementById("compte");
  var aucune = document.getElementById("aucune");
  liste.lienOrganismes = liste.el.dataset.organismes || "/se-former/sessions/organismes/";

  // Les choix sont gardés dans l'adresse (ex. ?diplome=BAFA&dep=93&quand=p:hiver-2027) : on peut partager le lien.
  var params = new URLSearchParams(location.search);
  if (params.has("periode") && !params.has("quand")) params.set("quand", "p:" + params.get("periode")); // anciens liens
  Array.prototype.forEach.call(form.elements, function (e) {
    if (!e.name || !params.has(e.name)) return;
    if (e.type === "checkbox") e.checked = params.get(e.name) === "1";
    else e.value = params.get(e.name);
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
    selEtape.options[0].textContent = visibles === 0 ? (dip === "PSC1" ? "Une journée" : "Formation complète") : "Toutes";
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
    liste.items.forEach(function (i) {
      var d = i.d;
      var okDep = !dep || (dep.slice(0, 2) === "r:" ? d.region === dep.slice(2) : d.dep === dep);
      var okQuand = !quand || (quand.slice(0, 2) === "p:" ? d.periode === quand.slice(2) : d.mois === quand.slice(2));
      i.ok = (!dip || d.diplome === dip) && okDep && okQuand && (!type || d.type === type) &&
        (isNaN(prix) || (d.prix !== "" && d.prix !== null && parseFloat(d.prix) <= prix)) &&
        mots.every(function (m) { return d.texte.indexOf(m) !== -1; });
    });
    liste.limite = liste.par;
    var n = afficher(liste);
    compte.textContent = n === 0 ? "Aucune session." : n + (n > 1 ? " sessions correspondent" : " session correspond") +
      ", de la plus proche à la plus lointaine.";
    aucune.hidden = n > 0;
    if (majAdresse) {
      var p = new URLSearchParams();
      Array.prototype.forEach.call(form.elements, function (e) {
        if (!e.name || e.disabled) return;
        if (e.type === "checkbox") { if (e.checked) p.set(e.name, "1"); }
        else if (e.value) p.set(e.name, e.value);
      });
      var q = p.toString();
      history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
    }
  }

  function brancher() {
    form.addEventListener("change", function () { appliquer(true); });
    form.addEventListener("input", function (e) { if (e.target.name === "q") appliquer(true); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      appliquer(true);
      document.getElementById("resultats").scrollIntoView({ behavior: "smooth" });
    });
    if (params.toString()) appliquer(false); else { adapterEtapes(); afficher(liste); }
  }

  // toutes les sessions de France : chargées une fois, puis filtrées sur place
  var source = liste.el.dataset.source;
  if (!source || !window.fetch) { brancher(); return; }
  compte.textContent = "Chargement des sessions…";
  fetch(source).then(function (r) { return r.json(); }).then(function (donnees) {
    liste.items.forEach(function (i) { if (i.el) i.el.remove(); });
    liste.items = donnees.map(function (x) {
      return { x: x, el: null, ok: true, d: {
        dep: x.d, region: x.r, periode: x.p, mois: x.m, diplome: x.di, type: x.di + "-" + x.t,
        prix: x.px === null ? "" : x.px,
        texte: sansAccents([x.v, x.dn2, x.d, x.th || "", x.o, x.tn, x.dl].join(" ")) } };
    });
    compte.textContent = donnees.length + " sessions à venir";
    brancher();
  }).catch(function () { compte.textContent = liste.items.length + " sessions"; brancher(); });
})();

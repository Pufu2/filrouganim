// Téléphone, pages de sessions (« Se former ») : la copie de la page de résultats d'Airbnb sur téléphone.
// En haut : ← retour, la pilule (le lieu ; les dates · la formation), le bouton des filtres, puis les pastilles rapides.
// Derrière : la carte avec les prix. Devant : la liste dans une feuille arrondie (poignée, « N sessions à venir ») qui monte
// sur la carte quand on fait défiler. Le bouton noir « Carte » replie la feuille en bas (mode carte, sans onglets) ;
// toucher ou tirer la feuille la remonte. Un prix touché montre la session en bas de l'écran. La pilule ouvre la recherche
// plein écran (formations en onglets, « Où ? », « Quand », « Étape », Tout effacer / Rechercher).
// Tout s'appuie sur le formulaire de la page (filtres.js, fenetre-filtres.js) : rien n'est cherché autrement.
(function () {
  "use strict";
  var racine = document.documentElement;
  if (!racine.classList.contains("tel-ab")) return;
  var tel = window.matchMedia("(max-width: 700px)");
  var barre = document.querySelector(".tel-barre");
  var form = document.querySelector("main form.recherche.rv");
  var main = document.getElementById("contenu");
  if (!barre || !form || !main) return;
  var enDirect = form.id === "filtres";
  var pilule = barre.querySelector(".tel-pilule");
  var feuille = document.querySelector(".tel-feuille");

  function el(tag, classe, texte) { var e = document.createElement(tag); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e; }
  function svg(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + "</svg>"; }
  function texteChoix(sel, vide) { var o = sel && sel.selectedOptions[0]; return sel && sel.value && o ? o.textContent.replace(/\s*\(\d+\)$/, "") : vide; }

  /* ---------- le haut : ← retour, la pilule, les filtres ---------- */
  var retour = barre.querySelector(".tel-retour");
  retour.hidden = false;
  retour.addEventListener("click", function () {
    var meme = false;
    try { meme = document.referrer && new URL(document.referrer).host === location.host; } catch (e) {}
    if (meme && history.length > 1) history.back(); else location.href = barre.dataset.accueil || "/";
  });
  var filtresBtn = barre.querySelector(".tel-filtres"), ouvrirFiltres = form.querySelector("[data-ouvrir]");
  if (filtresBtn && ouvrirFiltres) { filtresBtn.hidden = false; filtresBtn.addEventListener("click", function () { ouvrirFiltres.click(); }); }
  function majPilule() {
    pilule.querySelector("b").textContent = form.elements.ou.value.trim() || "Partout en France";
    pilule.querySelector("small").textContent = texteChoix(form.elements.mois, "Toutes les dates") + " · " + texteChoix(form.elements.diplome, "Toutes les formations");
  }
  setTimeout(majPilule, 0);
  form.addEventListener("change", function () { setTimeout(majPilule, 0); });
  form.addEventListener("input", function () { setTimeout(majPilule, 0); });

  /* ---------- la feuille : poignée et titre en haut de la liste ---------- */
  var tete = el("div", "tel-ab-tete");
  tete.appendChild(el("span", "tel-ab-poignee"));
  var titre = el("p", "tel-ab-titre");
  tete.appendChild(titre);
  main.insertBefore(tete, main.firstChild);
  var compte = document.getElementById("compte");
  function majTitre() {
    if (compte) { titre.textContent = compte.textContent; return; }
    var li = document.querySelector("main .tete .chiffres li");
    var n = main.querySelectorAll(".sessions .session").length;
    titre.textContent = li ? li.textContent.replace(/\s+/g, " ").trim() : n + (n > 1 ? " sessions" : " session");
  }
  majTitre();
  if (compte) new MutationObserver(majTitre).observe(compte, { childList: true, characterData: true, subtree: true });

  /* ---------- les hauteurs : la carte sous le haut, la feuille aux deux tiers de l'écran ---------- */
  function mesurer() {
    var h = barre.querySelector(".tel-barre-l").offsetHeight;
    racine.style.setProperty("--ab-haut", h + "px");
    racine.style.setProperty("--ab-feuille", (barre.offsetHeight + Math.round(window.innerHeight * 0.32)) + "px");
  }
  mesurer();
  window.addEventListener("resize", mesurer);

  /* ---------- la carte derrière la liste ---------- */
  var fiche = el("div", "tel-ab-fiche"); fiche.hidden = true;
  document.body.appendChild(fiche);
  function montrerFiche(contenu) {
    fiche.textContent = ""; fiche.appendChild(contenu); fiche.hidden = false;
  }
  function cacherFiche() { fiche.hidden = true; fiche.textContent = ""; }
  var planDirect = null, planListe = null;
  function redimensionner() { var p = planDirect || planListe || window.FRA_PLAN; if (p) setTimeout(function () { p.invalidateSize(); }, 360); }

  if (enDirect) {
    // la page de recherche : la carte de filtres.js passe derrière la liste ; sa fiche s'affiche en bas de l'écran
    var bloc = document.getElementById("carte-bloc");
    if (bloc) {
      document.body.insertBefore(bloc, document.body.firstChild);
      bloc.classList.add("tel-ab-carte");
      var brancher = function () {
        var plan = window.FRA_PLAN; if (!plan || planDirect) return;
        planDirect = plan;
        plan.invalidateSize();
        plan.on("popupopen", function (e) {
          var c = e.popup.getElement() && e.popup.getElement().querySelector(".pop");
          if (c) montrerFiche(c);
        });
        plan.on("popupclose", cacherFiche);
      };
      document.addEventListener("sessions:carte", function () { setTimeout(brancher, 0); });
      brancher();
      setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 60);
    }
  } else {
    // une page de liste (département, ville…) : une carte des sessions de la page, avec le prix le plus bas de chaque ville
    var cadre = el("div", "tel-ab-carte"); var zone = el("div", "carte-sessions"); cadre.appendChild(zone);
    document.body.insertBefore(cadre, document.body.firstChild);
    var cartes = Array.prototype.slice.call(main.querySelectorAll(".sessions .session"));
    var parLien = {};
    cartes.forEach(function (c) { var a = c.querySelector(".s-lien"), h = a && a.getAttribute("href"); if (h) (parLien[h] = parLien[h] || []).push(c); });
    var charger = function (src, type) {
      return new Promise(function (ok, ko) {
        var t = document.createElement(type === "css" ? "link" : "script");
        if (type === "css") { t.rel = "stylesheet"; t.href = src; ok(); } else { t.src = src; t.onload = ok; t.onerror = ko; }
        document.head.appendChild(t);
      });
    };
    var pret = window.L ? Promise.resolve() : charger(barre.dataset.leafletCss, "css").then(function () { return charger(barre.dataset.leafletJs, "js"); });
    Promise.all([pret, fetch(barre.dataset.sessions).then(function (r) { return r.json(); })]).then(function (r) {
      var donnees = r[1], villes = {};
      donnees.forEach(function (x) {
        var cs = parLien[x.u]; if (!cs || !x.g) return;
        var k = x.d + "|" + x.v, v = villes[k] || (villes[k] = { g: x.g, v: x.v, min: null, cartes: [] });
        cs.forEach(function (c) { if (v.cartes.indexOf(c) < 0) v.cartes.push(c); });
        if (x.px != null && (v.min === null || x.px < v.min)) v.min = x.px;
      });
      var L = window.L, liste = Object.keys(villes).map(function (k) { return villes[k]; });
      planListe = L.map(zone, { zoomControl: false, attributionControl: true, maxZoom: 15, minZoom: 5 });
      L.tileLayer(barre.dataset.tuiles, { maxZoom: 18, minZoom: 4, attribution: '&copy; <a href="https://www.ign.fr/">IGN</a>' }).addTo(planListe);
      // la vue d'abord (Leaflet ne dessine les étiquettes qu'une fois la carte placée)
      if (!liste.length) { planListe.fitBounds([[42.3, -4.8], [51.1, 8.2]]); return; }
      // (cadrée sur la partie de la carte visible au-dessus de la liste, comme chez Airbnb)
      var cache = Math.max(0, window.innerHeight - (parseInt(getComputedStyle(racine).getPropertyValue("--ab-feuille"), 10) || 0));
      planListe.fitBounds(liste.map(function (v) { return v.g; }), { paddingTopLeft: [40, 30], paddingBottomRight: [40, cache + 30], maxZoom: 12 });
      liste.forEach(function (v) {
        var mk = L.marker(v.g, { icon: L.divIcon({ className: "bulle-icone", iconSize: [0, 0], html: '<span class="pin pin-prix"></span>' }), riseOnHover: true }).addTo(planListe);
        var sp = mk.getElement().querySelector(".pin");
        sp.textContent = v.min != null ? (Math.round(v.min) + " €") : (v.cartes.length + (v.cartes.length > 1 ? " sessions" : " session"));
        if (v.min != null && v.cartes.length > 1) sp.appendChild(el("small", null, "· " + v.cartes.length));
        mk.on("click", function () {
          Array.prototype.forEach.call(zone.querySelectorAll(".pin.ouverte"), function (p) { p.classList.remove("ouverte"); });
          sp.classList.add("ouverte");
          var k = 0, boite = el("div", "tel-ab-fiche-in");
          var dessiner = function () {
            boite.textContent = "";
            var x = el("button", "tel-ab-fiche-x"); x.type = "button"; x.setAttribute("aria-label", "Fermer"); x.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
            x.addEventListener("click", function () { cacherFiche(); sp.classList.remove("ouverte"); });
            boite.appendChild(x);
            boite.appendChild(v.cartes[k].cloneNode(true));
            if (v.cartes.length > 1) {
              var nav = el("div", "tel-ab-fiche-nav");
              [["‹", -1, "Session précédente"], ["›", 1, "Session suivante"]].forEach(function (f, i) {
                var b = el("button", null, f[0]); b.type = "button"; b.setAttribute("aria-label", f[2]);
                b.addEventListener("click", function () { k = (k + f[1] + v.cartes.length) % v.cartes.length; dessiner(); });
                nav.appendChild(b); if (i === 0) nav.appendChild(el("span", null, (k + 1) + " / " + v.cartes.length));
              });
              boite.appendChild(nav);
            }
          };
          dessiner();
          montrerFiche(boite);
        });
      });
      planListe.on("click", function () { cacherFiche(); Array.prototype.forEach.call(zone.querySelectorAll(".pin.ouverte"), function (p) { p.classList.remove("ouverte"); }); });
    }).catch(function (e) { if (window.console) console.warn("carte", e); });
  }

  /* ---------- liste ou carte : le bouton « Carte », la feuille qu'on touche ou qu'on tire ---------- */
  var boutonCarte = el("button", "tel-ab-bouton-carte");
  boutonCarte.type = "button";
  boutonCarte.innerHTML = "<span>Carte</span>" + svg('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>');
  document.body.appendChild(boutonCarte);
  function modeCarte(oui) {
    cacherFiche();
    window.scrollTo(0, 0);
    racine.classList.toggle("tel-carte", oui);
    majBouton();
    redimensionner();
  }
  function majBouton() { boutonCarte.classList.toggle("visible", !racine.classList.contains("tel-carte") && window.scrollY > 80); }
  boutonCarte.addEventListener("click", function () { modeCarte(true); });
  tete.addEventListener("click", function () { if (racine.classList.contains("tel-carte")) modeCarte(false); });
  var y0 = null;
  tete.addEventListener("touchstart", function (e) { y0 = e.touches[0].clientY; }, { passive: true });
  tete.addEventListener("touchend", function (e) {
    if (y0 === null) return;
    var dy = e.changedTouches[0].clientY - y0; y0 = null;
    if (!racine.classList.contains("tel-carte") && dy > 50 && window.scrollY < 10) modeCarte(true);
    else if (racine.classList.contains("tel-carte") && dy < -40) modeCarte(false);
  });
  window.addEventListener("scroll", majBouton, { passive: true });
  majBouton();

  /* ---------- la recherche plein écran (la pilule), copie de celle d'Airbnb ----------
     En haut, les formations en onglets (icônes 3D en couleur, statique/illus/icones/, licence MIT), la croix ; dessous, une
     carte ouverte (« Où ? » d'abord : la case, sans ouvrir le clavier, et les villes suggérées) et les autres repliées en
     une ligne (« Quand », « Étape ») ; en bas, « Tout effacer » et « Rechercher ». À l'ouverture : le fond se floute, les
     icônes grandissent l'une après l'autre, les cartes descendent, le bas monte ; la fermeture est immédiate. */
  var ICONES = { BAFA: "bafa", BAFD: "bafd", BSB: "bsb", CPJEPS: "cpjeps", BPJEPS: "bpjeps", DEJEPS: "dejeps", DESJEPS: "desjeps", PSC1: "psc" };
  var dossier = barre.dataset.icones || "/illus/icones/";
  var populaires = [];
  try { populaires = JSON.parse(document.getElementById("villes-populaires").textContent) || []; } catch (e) {}
  var lieux = Array.prototype.map.call(form.querySelectorAll("datalist option"), function (o) { return { texte: o.value, dep: o.dataset.dep || "" }; });
  function sansAccents(t) { return (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  var etat = {};
  function lire() { ["ou", "diplome", "type", "mois", "annee"].forEach(function (k) { etat[k] = form.elements[k] ? form.elements[k].value : ""; }); }
  var m = el("div", "ab-m");
  feuille.textContent = ""; feuille.appendChild(m); feuille.classList.add("tel-ab-feuille");
  function fermerModale() { racine.classList.remove("tel-cherche", "tel-cherche-anim"); }
  function ouvrirModale() {
    lire(); dessinerModale("ou");
    racine.classList.add("tel-cherche");
    racine.classList.remove("tel-cherche-anim"); void m.offsetWidth; racine.classList.add("tel-cherche-anim");
  }
  pilule.addEventListener("click", function (e) { if (!tel.matches) return; e.preventDefault(); ouvrirModale(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && racine.classList.contains("tel-cherche")) fermerModale(); });
  function options(sel, test) { return Array.prototype.filter.call(sel.options, function (o) { return o.value && test(o); }); }
  function nomOption(o) { return o.textContent.replace(/\s*\(\d+\)$/, ""); }
  function dessinerModale(ouverte) {
    m.textContent = "";
    var haut = el("div", "ab-m-haut");
    var ong = el("div", "ab-m-onglets");
    options(form.elements.diplome, function () { return true; }).forEach(function (o, i) {
      var b = el("button", "ab-m-onglet"); b.type = "button"; b.style.setProperty("--i", i);
      var im = el("img"); im.src = dossier + (ICONES[o.value] || "bpjeps") + ".png"; im.alt = ""; im.width = 56; im.height = 56;
      b.appendChild(el("span", "ab-m-icone")).appendChild(im);
      b.appendChild(el("span", "ab-m-nom", nomOption(o)));
      if (etat.diplome === o.value) b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", function () { etat.diplome = etat.diplome === o.value ? "" : o.value; etat.type = ""; racine.classList.remove("tel-cherche-anim"); dessinerModale(ouverte); });
      ong.appendChild(b);
    });
    haut.appendChild(ong);
    var x = el("button", "ab-m-x"); x.type = "button"; x.setAttribute("aria-label", "Fermer"); x.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
    x.addEventListener("click", fermerModale);
    haut.appendChild(x);
    m.appendChild(haut);
    var corps = el("div", "ab-m-corps");
    m.appendChild(corps);
    var rang = 0;
    function carteQ(cle, question, reponse, remplir) {
      var c = el("section", "ab-m-carte" + (ouverte === cle ? " ouverte" : "")); c.style.setProperty("--i", rang++);
      if (ouverte === cle) { c.appendChild(el("h2", null, question + " ?")); remplir(c); }
      else {
        var l = el("button", "ab-m-ligne"); l.type = "button";
        l.appendChild(el("span", null, question)); l.appendChild(el("b", null, reponse));
        l.addEventListener("click", function () { racine.classList.remove("tel-cherche-anim"); dessinerModale(cle); });
        c.appendChild(l);
      }
      corps.appendChild(c);
    }
    carteQ("ou", "Où", etat.ou || "Partout en France", function (c) {
      var boite = el("label", "ab-m-champ");
      boite.innerHTML = svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>');
      var champ = el("input"); champ.type = "search"; champ.placeholder = "Ville, département ou code postal"; champ.value = etat.ou;
      champ.setAttribute("enterkeyhint", "search"); champ.autocomplete = "off"; champ.setAttribute("aria-label", "Où ?");
      boite.appendChild(champ);
      c.appendChild(boite);
      var zone = el("div", "ab-m-sugg");
      c.appendChild(zone);
      // les suggestions, dans la carte (pas de clavier à l'ouverture : la case ne prend le focus que si on la touche)
      function suggerer() {
        zone.textContent = "";
        var q = sansAccents(champ.value.trim()), liste;
        if (!q || q === sansAccents(etat.ou) && etat.ou && !champ.matches(":focus")) {
          zone.appendChild(el("p", "ab-m-sugg-t", "Les villes les plus demandées"));
          liste = populaires.map(function (v) { return [v.texte, v.n.toLocaleString("fr-FR") + (v.n > 1 ? " sessions" : " session")]; });
        } else {
          var mots = q.replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
          liste = lieux.filter(function (o) { var k = sansAccents(o.texte); return mots.every(function (w) { return k.indexOf(w) !== -1; }); })
            .sort(function (a, b) { return (sansAccents(b.texte).indexOf(q) === 0) - (sansAccents(a.texte).indexOf(q) === 0) || a.texte.length - b.texte.length; })
            .slice(0, 8).map(function (o) { return [o.texte, o.dep.slice(0, 2) === "r:" ? "Région" : o.dep.slice(0, 2) === "v:" ? "Ville" : "Département"]; });
          zone.appendChild(el("p", "ab-m-sugg-t", liste.length ? "Suggestions" : "Aucun lieu ne correspond"));
        }
        liste.forEach(function (v) {
          var b = el("button", "ab-m-sugg-l"); b.type = "button";
          var im = el("img"); im.src = dossier + "lieu.png"; im.alt = ""; im.width = 30; im.height = 30;
          b.appendChild(el("span", "ab-m-sugg-ic")).appendChild(im);
          var t = el("span"); t.appendChild(el("b", null, v[0])); t.appendChild(el("small", null, v[1])); b.appendChild(t);
          b.addEventListener("click", function () { etat.ou = v[0]; racine.classList.remove("tel-cherche-anim"); dessinerModale("quand"); });
          zone.appendChild(b);
        });
      }
      champ.addEventListener("input", function () { etat.ou = champ.value; suggerer(); });
      champ.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); etat.ou = champ.value; chercher(); } });
      suggerer();
      var bas = el("span", "ab-m-sugg-plus"); bas.innerHTML = svg('<path d="M6 9l6 6 6-6"/>'); c.appendChild(bas);
    });
    var mois = form.elements.mois, annee = form.elements.annee;
    var choixMois = Array.prototype.filter.call(mois.options, function (o) { return o.value === etat.mois; })[0];
    carteQ("quand", "Quand", etat.mois && choixMois ? choixMois.textContent + (etat.annee ? " " + etat.annee : "") : (etat.annee || "Toutes les dates"), function (c) {
      function puces(titre, liste, cle) {
        if (!liste.length) return;
        c.appendChild(el("p", "ab-m-sous", titre));
        var l = el("div", "ab-m-puces");
        liste.forEach(function (o) {
          var b = el("button", "ab-m-puce", o.textContent); b.type = "button";
          if (etat[cle] === o.value) b.setAttribute("aria-pressed", "true");
          b.addEventListener("click", function () { etat[cle] = etat[cle] === o.value ? "" : o.value; racine.classList.remove("tel-cherche-anim"); dessinerModale("quand"); });
          l.appendChild(b);
        });
        c.appendChild(l);
      }
      if (["", "BAFA", "BAFD", "BSB", "PSC1"].indexOf(etat.diplome) !== -1) puces("Vacances scolaires", options(mois, function (o) { return /^v:/.test(o.value); }), "mois");
      puces("Mois", options(mois, function (o) { return /^m:/.test(o.value); }), "mois");
      var ans = options(annee, function () { return true; });
      if (ans.length > 1) puces("Année", ans, "annee");
    });
    var etapes = options(form.elements.type, function (o) { return o.parentNode.tagName === "OPTGROUP" && o.parentNode.dataset.diplome === etat.diplome; });
    var choixType = etapes.filter(function (o) { return o.value === etat.type; })[0];
    carteQ("etape", "Étape", choixType ? nomOption(choixType) : (etat.diplome ? "Toutes" : "Choisir une formation"), function (c) {
      if (!etapes.length) { c.appendChild(el("p", "ab-m-vide", etat.diplome ? "Une seule formule pour cette formation." : "Choisissez d'abord une formation, en haut.")); return; }
      var l = el("div", "ab-m-puces");
      etapes.forEach(function (o) {
        var b = el("button", "ab-m-puce", nomOption(o)); b.type = "button";
        if (etat.type === o.value) b.setAttribute("aria-pressed", "true");
        b.addEventListener("click", function () { etat.type = etat.type === o.value ? "" : o.value; racine.classList.remove("tel-cherche-anim"); dessinerModale("etape"); });
        l.appendChild(b);
      });
      c.appendChild(l);
    });
    var pied = el("div", "ab-m-pied");
    var eff = el("button", "ab-m-effacer", "Tout effacer"); eff.type = "button";
    eff.addEventListener("click", function () { etat = { ou: "", diplome: "", type: "", mois: "", annee: "" }; racine.classList.remove("tel-cherche-anim"); dessinerModale(ouverte); });
    var go = el("button", "ab-m-chercher"); go.type = "button";
    go.innerHTML = svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>'); go.appendChild(el("span", null, "Rechercher"));
    go.addEventListener("click", chercher);
    pied.appendChild(eff); pied.appendChild(go);
    m.appendChild(pied);
  }
  function chercher() {
    var f = form.elements;
    ["diplome", "type", "mois", "annee"].forEach(function (k) { if (f[k] && f[k].value !== etat[k]) { f[k].value = etat[k]; f[k].dispatchEvent(new Event("change", { bubbles: true })); } });
    if (f.ou.value !== etat.ou) {
      f.ou.value = etat.ou;
      f.ou.dispatchEvent(new Event("input", { bubbles: true }));
      f.ou.dispatchEvent(new Event("change", { bubbles: true }));
    }
    fermerModale();
    majPilule();
    if (enDirect) { racine.classList.remove("tel-carte"); window.scrollTo(0, 0); }
    else if (form.requestSubmit) form.requestSubmit(); else form.submit();
  }
})();

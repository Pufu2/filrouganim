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

  /* ---------- la recherche plein écran (la pilule) : formations en onglets, « Où ? », « Quand », « Étape » ---------- */
  var ICONES = { BAFA: '<path d="M3 9l9-4 9 4-9 4-9-4z"/><path d="M7 11v4c0 1.5 2.2 3 5 3s5-1.5 5-3v-4"/>',
    BAFD: '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z"/>',
    PSC1: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>',
    BSB: '<path d="M3 15c2 0 2-1.5 4.5-1.5S10 15 12 15s2-1.5 4.5-1.5S19 15 21 15M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2-1.5 4.5-1.5S19 19 21 19"/><circle cx="12" cy="7" r="2.5"/>' };
  var ECOLE = '<path d="M4 10l8-5 8 5M6 10v8h12v-8M10 18v-4h4v4"/>';
  var etat = {};
  function lire() { ["ou", "diplome", "type", "mois", "annee"].forEach(function (k) { etat[k] = form.elements[k] ? form.elements[k].value : ""; }); }
  var m = el("div", "ab-m");
  feuille.textContent = ""; feuille.appendChild(m); feuille.classList.add("tel-ab-feuille");
  function fermerModale() { racine.classList.remove("tel-cherche"); }
  function ouvrirModale() { lire(); dessinerModale("ou"); racine.classList.add("tel-cherche"); }
  pilule.addEventListener("click", function (e) { if (!tel.matches) return; e.preventDefault(); ouvrirModale(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && racine.classList.contains("tel-cherche")) fermerModale(); });
  function options(sel, test) { return Array.prototype.filter.call(sel.options, function (o) { return o.value && test(o); }); }
  function dessinerModale(ouverte) {
    m.textContent = "";
    // en haut : les formations, comme les onglets Logements / Hôtels / Expériences, et la croix
    var haut = el("div", "ab-m-haut");
    var ong = el("div", "ab-m-onglets");
    options(form.elements.diplome, function () { return true; }).forEach(function (o) {
      var b = el("button", "ab-m-onglet"); b.type = "button";
      b.innerHTML = svg(ICONES[o.value] || ECOLE);
      b.appendChild(el("span", null, o.textContent.replace(/\s*\(\d+\)$/, "")));
      if (etat.diplome === o.value) b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", function () { etat.diplome = etat.diplome === o.value ? "" : o.value; etat.type = ""; dessinerModale(ouverte); });
      ong.appendChild(b);
    });
    haut.appendChild(ong);
    var x = el("button", "ab-m-x"); x.type = "button"; x.setAttribute("aria-label", "Fermer"); x.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
    x.addEventListener("click", fermerModale);
    haut.appendChild(x);
    m.appendChild(haut);
    var corps = el("div", "ab-m-corps");
    m.appendChild(corps);
    // une carte par question : ouverte (grand titre et choix) ou repliée (une ligne : la question, la réponse)
    function carteQ(cle, question, reponse, remplir) {
      var c = el("section", "ab-m-carte" + (ouverte === cle ? " ouverte" : ""));
      if (ouverte === cle) { c.appendChild(el("h2", null, question + " ?")); remplir(c); }
      else {
        var l = el("button", "ab-m-ligne"); l.type = "button";
        l.appendChild(el("span", null, question)); l.appendChild(el("b", null, reponse));
        l.addEventListener("click", function () { dessinerModale(cle); });
        c.appendChild(l);
      }
      corps.appendChild(c);
    }
    carteQ("ou", "Où", etat.ou || "Partout en France", function (c) {
      var boite = el("div", "ab-m-champ");
      boite.innerHTML = svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>');
      var champ = el("input"); champ.type = "search"; champ.placeholder = "Ville, département ou code postal"; champ.value = etat.ou; champ.setAttribute("data-villes", "");
      champ.setAttribute("enterkeyhint", "search"); champ.autocomplete = "off";
      champ.addEventListener("input", function () { etat.ou = champ.value; });
      champ.addEventListener("change", function () { etat.ou = champ.value; });
      champ.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); etat.ou = champ.value; chercher(); } });
      boite.appendChild(champ);
      var dl = form.querySelector("datalist"); if (dl) boite.appendChild(dl.cloneNode(true));
      c.appendChild(boite);
      if (window.FRA_VILLES) window.FRA_VILLES(champ);
      setTimeout(function () { champ.focus(); }, 80);
    });
    var mois = form.elements.mois, annee = form.elements.annee;
    var choixMois = Array.prototype.filter.call(mois.options, function (o) { return o.value === etat.mois; })[0];
    carteQ("quand", "Quand", etat.mois && choixMois ? choixMois.textContent + (etat.annee ? " " + etat.annee : "") : (etat.annee || "Toutes les dates"), function (c) {
      var vacs = options(mois, function (o) { return /^v:/.test(o.value); });
      if (vacs.length && ["", "BAFA", "BAFD", "BSB", "PSC1"].indexOf(etat.diplome) !== -1) {
        c.appendChild(el("p", "ab-m-sous", "Vacances scolaires"));
        var l = el("div", "ab-m-puces");
        vacs.forEach(function (o) {
          var b = el("button", "ab-m-puce", o.textContent); b.type = "button";
          if (etat.mois === o.value) b.setAttribute("aria-pressed", "true");
          b.addEventListener("click", function () { etat.mois = etat.mois === o.value ? "" : o.value; dessinerModale("quand"); });
          l.appendChild(b);
        });
        c.appendChild(l);
      }
      c.appendChild(el("p", "ab-m-sous", "Mois"));
      var l2 = el("div", "ab-m-puces");
      options(mois, function (o) { return /^m:/.test(o.value); }).forEach(function (o) {
        var b = el("button", "ab-m-puce", o.textContent); b.type = "button";
        if (etat.mois === o.value) b.setAttribute("aria-pressed", "true");
        b.addEventListener("click", function () { etat.mois = etat.mois === o.value ? "" : o.value; dessinerModale("quand"); });
        l2.appendChild(b);
      });
      c.appendChild(l2);
      var ans = options(annee, function () { return true; });
      if (ans.length > 1) {
        c.appendChild(el("p", "ab-m-sous", "Année"));
        var l3 = el("div", "ab-m-puces");
        ans.forEach(function (o) {
          var b = el("button", "ab-m-puce", o.textContent); b.type = "button";
          if (etat.annee === o.value) b.setAttribute("aria-pressed", "true");
          b.addEventListener("click", function () { etat.annee = etat.annee === o.value ? "" : o.value; dessinerModale("quand"); });
          l3.appendChild(b);
        });
        c.appendChild(l3);
      }
    });
    var etapes = options(form.elements.type, function (o) { return o.parentNode.tagName === "OPTGROUP" && o.parentNode.dataset.diplome === etat.diplome; });
    var choixType = etapes.filter(function (o) { return o.value === etat.type; })[0];
    carteQ("etape", "Étape", choixType ? choixType.textContent : (etat.diplome ? "Toutes" : "Choisissez une formation"), function (c) {
      if (!etapes.length) { c.appendChild(el("p", "ab-m-vide", etat.diplome ? "Une seule formule pour cette formation." : "Choisissez d'abord une formation, en haut.")); return; }
      var l = el("div", "ab-m-puces");
      etapes.forEach(function (o) {
        var b = el("button", "ab-m-puce", o.textContent.replace(/\s*\(\d+\)$/, "")); b.type = "button";
        if (etat.type === o.value) b.setAttribute("aria-pressed", "true");
        b.addEventListener("click", function () { etat.type = etat.type === o.value ? "" : o.value; dessinerModale("etape"); });
        l.appendChild(b);
      });
      c.appendChild(l);
    });
    // en bas : Tout effacer, Rechercher
    var pied = el("div", "ab-m-pied");
    var eff = el("button", "ab-m-effacer", "Tout effacer"); eff.type = "button";
    eff.addEventListener("click", function () { etat = { ou: "", diplome: "", type: "", mois: "", annee: "" }; dessinerModale(ouverte); });
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

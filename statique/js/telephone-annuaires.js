// Téléphone : les autres pages de recherche (Animateurs : les offres ; Structures : l'annuaire ; Parents : /enfants/)
// prennent exactement la page de résultats de « Se former » (telephone-sessions.js), copie de celle d'Airbnb :
// ← retour, la pilule (lieu ; choix), les filtres ; la carte derrière ; la liste dans une feuille arrondie ; « Carte » ;
// la fiche en bas quand on touche une étiquette ; la recherche plein écran (onglets à icônes, « Où ? », questions repliées,
// Tout effacer / Rechercher), avec les mêmes effets. Chaque page garde son propre filtre : ce script ne fait que le régler.
// Et sur toutes ces pages (sessions comprises), les fenêtres « Filtres » prennent de la couleur : icônes 3D, premier
// groupe en tuiles (comme « Nos recommandations » d'Airbnb).
(function () {
  "use strict";
  var racine = document.documentElement;
  if (!racine.classList.contains("tel-ab")) return;
  var tel = window.matchMedia("(max-width: 700px)");
  var barre = document.querySelector(".tel-barre");
  if (!barre) return;
  var dossier = barre.dataset.icones || "/illus/icones/";

  function el(tag, classe, texte) { var e = document.createElement(tag); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e; }
  function svg(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + "</svg>"; }
  function sans(t) { return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function json(id) { try { return JSON.parse(document.getElementById(id).textContent); } catch (e) { return null; } }
  function icone(nom, taille) { var im = el("img"); im.src = dossier + nom + ".png"; im.alt = ""; im.width = taille; im.height = taille; im.loading = "lazy"; return im; }

  /* ---------- les fenêtres « Filtres » en couleur (toutes les pages de recherche) ---------- */
  var MOIS_SAISON = { janvier: "hiver", fevrier: "hiver", mars: "printemps", avril: "printemps", mai: "printemps", juin: "ete", juillet: "ete", aout: "ete",
    septembre: "automne", octobre: "automne", novembre: "automne", decembre: "noel" };
  var ICONES_TEXTE = { bafa: "bafa", bafd: "bafd", bsb: "bsb", cpjeps: "cpjeps", bpjeps: "bpjeps", dejeps: "dejeps", desjeps: "desjeps", psc: "psc",
    "formation generale": "generale", approfondissement: "approfondissement", perfectionnement: "perfectionnement", qualification: "baignade",
    noel: "noel", hiver: "hiver", printemps: "printemps", ete: "ete", toussaint: "toussaint", "vacances d'hiver": "hiver", "vacances de printemps": "printemps",
    "stage pratique bafa": "stagiaire", animateur: "animateur", "directeur adjoint": "adjoint", directeur: "directeur", "surveillant de baignade": "baignade", coordinateur: "coordinateur",
    "contrat d'engagement educatif": "contrat", cdd: "duree", cdi: "contrat", apprentissage: "diplome", benevolat: "benevole",
    tout: "tout", toutes: "tout", "sejours et colos": "sejours", sejours: "sejours", "accueils de loisirs": "accueils", periscolaire: "periscolaire" };
  function iconeDe(texte) {
    var t = sans(texte).replace(/\s*\(\d+\)$/, "");
    if (ICONES_TEXTE[t]) return ICONES_TEXTE[t];
    var m = t.split(" ")[0]; if (MOIS_SAISON[m]) return MOIS_SAISON[m];
    if (/€/.test(texte)) return "budget";
    if (/^20\d\d$/.test(t)) return "calendrier";
    return null;
  }
  function decorer(fenetre) {
    Array.prototype.forEach.call(fenetre.querySelectorAll(".ff-puce:not([data-tel-ic])"), function (b) {
      b.setAttribute("data-tel-ic", "1");
      var nom = iconeDe(b.textContent);
      if (nom) { b.insertBefore(icone(nom, 40), b.firstChild); b.classList.add("tel-puce-ic"); }
    });
    var g = fenetre.querySelector(".ff-groupe");
    if (g && !g.classList.contains("tel-tuiles") && g.querySelectorAll(".tel-puce-ic").length >= 3) g.classList.add("tel-tuiles");
    Array.prototype.forEach.call(fenetre.querySelectorAll(".ff-groupe h3:not([data-tel-ic])"), function (h) {
      h.setAttribute("data-tel-ic", "1");
      if (/mot-cl/i.test(h.textContent)) { var x = h.closest(".ff-groupe"); if (x) x.classList.add("tel-mot"); }
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll(".ff-voile, .tp-voile"), function (v) {
    decorer(v);
    new MutationObserver(function () { decorer(v); }).observe(v, { childList: true, subtree: true });
  });

  /* ---------- les trois pages ---------- */
  var cfg = null;
  var ofForm = document.getElementById("filtres-offres"), sjForm = document.getElementById("sjc-filtres"), anForm = document.querySelector("main .an2-recherche form");
  var POSTES_IC = { "animateur-stagiaire": "stagiaire", animateur: "animateur", "directeur-adjoint": "adjoint", directeur: "directeur", "surveillant-baignade": "baignade", coordinateur: "coordinateur" };
  var POSTES_COURT = { "animateur-stagiaire": "Stage BAFA", animateur: "Animateur", "directeur-adjoint": "Direction", directeur: "Direction", "surveillant-baignade": "Baignade", coordinateur: "Coordination" };
  function puces(voile, champ) {
    return Array.prototype.map.call(voile.querySelectorAll('[data-of-champ="' + champ + '"] .ff-puce'), function (b) { return { v: b.dataset.v, nom: b.textContent.trim() }; });
  }

  if (ofForm) {
    var ofVoile = document.getElementById("of-ff"), ofOu = document.getElementById("of-ou");
    var ofPostes = puces(ofVoile, "poste"), ofContrats = puces(ofVoile, "contrat"), ofMois = puces(ofVoile, "mois");
    var nomDe = function (liste, v, vide) { var x = liste.filter(function (o) { return o.v === v; })[0]; return x ? x.nom : vide; };
    cfg = {
      voile: ofVoile, deplacer: [ofVoile], liste: document.querySelector(".tp-cartes-bande"),
      lire: function () { return { ou: ofOu.value, poste: ofForm.elements.poste.value, contrat: ofForm.elements.contrat.value, mois: ofForm.elements.mois.value }; },
      vide: { ou: "", poste: "", contrat: "", mois: "" },
      pilule: function (e) { return [e.ou || "Partout en France", nomDe(ofPostes, e.poste, "Tous les postes") + " · " + nomDe(ofContrats, e.contrat, "Tous les contrats")]; },
      onglets: { cle: "poste", liste: ofPostes.map(function (o) { return { v: o.v, nom: POSTES_COURT[o.v] === "Direction" ? o.nom.replace("Directeur adjoint", "Adjoint") : o.nom.replace("Stage pratique BAFA", "Stage BAFA").replace("Surveillant de baignade", "Baignade"), ic: POSTES_IC[o.v] || "animateur" }; }) },
      questions: [
        { cle: "mois", titre: "Quand", vide: "Toutes les dates", liste: ofMois },
        { cle: "contrat", titre: "Contrat", vide: "Tous les contrats", liste: ofContrats }
      ],
      appliquer: function (e) {
        ["poste", "contrat", "mois"].forEach(function (k) { ofForm.elements[k].value = e[k]; });
        ofOu.value = e.ou; ofOu.dispatchEvent(new Event("change", { bubbles: true }));
      },
      titre: function () {
        var c = document.getElementById("compte-offres"), n = document.querySelectorAll("#animateurs-of .an-carte").length;
        var t = c && !c.hidden ? c.textContent.trim() : "";
        return (t ? t + " · " : "") + (n ? n + " animateur" + (n > 1 ? "s" : "") : "Les animateurs");
      },
      points: function (centres) {
        var p = [];
        Array.prototype.forEach.call(document.querySelectorAll("#liste-offres-publiques .offre"), function (c) {
          if (c.hidden) return; var g = null; try { g = JSON.parse(c.dataset.g); } catch (e) {}
          if (g) p.push({ g: g, etiq: POSTES_COURT[c.dataset.poste] || "Offre", el: c, cadre: "sessions" });
        });
        Array.prototype.forEach.call(document.querySelectorAll("#animateurs-of .an-carte"), function (c) {
          if (c.hidden) return; var l = c.querySelector(".tp-carte-lieu"), m = l && l.textContent.match(/\((\w{2,3})\)/), g = m && centres[m[1]];
          var h = c.querySelector("h2");
          if (g) p.push({ g: g, etiq: (h ? h.textContent.trim() : "Animateur"), el: c, cadre: "tp-cartes", profil: true });
        });
        return p;
      },
      filtres: function () { ofForm.querySelector(".tp-filtres").click(); }
    };
  } else if (anForm) {
    var anQ = document.getElementById("an-q"), anVoile = document.getElementById("an-ff");
    var anTypes = Array.prototype.map.call(document.querySelectorAll("[data-an-type]"), function (b) { return { v: b.dataset.anType, nom: b.textContent.trim(), b: b }; });
    var anType = function () { var x = anTypes.filter(function (o) { return o.b.getAttribute("aria-pressed") === "true"; })[0]; return x ? x.v : ""; };
    cfg = {
      voile: anVoile, deplacer: [anForm], liste: document.getElementById("annuaire"),
      lire: function () { return { ou: anQ.dataset.telOu || anQ.value, type: anType() }; },
      vide: { ou: "", type: "" },
      pilule: function (e) { var t = anTypes.filter(function (o) { return o.v === e.type; })[0]; return [e.ou || "Partout en France", (t && t.v ? t.nom : "Toutes les structures")]; },
      onglets: { cle: "type", sansVide: true, liste: anTypes.map(function (o) { return { v: o.v, nom: o.nom, ic: iconeDe(o.nom) || "structure" }; }) },
      questions: [],
      appliquer: function (e) {
        var t = anTypes.filter(function (o) { return o.v === e.type; })[0]; if (t) t.b.click();
        // « Paris (75) » : l'annuaire cherche dans le nom, la ville et le département ; on garde le nom, ou le numéro
        var m = (e.ou || "").match(/^(.*?)\s*\((\w{2,3})\)\s*$/);
        anQ.dataset.telOu = e.ou || "";
        anQ.value = m ? (m[1] && !/^\d/.test(m[1]) && document.querySelector('#annuaire li[data-texte*="' + m[1].replace(/"/g, "") + '"]') ? m[1] : m[2]) : (e.ou || "");
        anQ.dispatchEvent(new Event("input", { bubbles: true }));
      },
      titre: function () { var n = document.getElementById("an-nb"); return n ? n.textContent.trim() : "Les structures"; },
      points: function () {
        var p = [];
        Array.prototype.forEach.call(document.querySelectorAll("#annuaire li[data-g]"), function (c) {
          if (c.hidden) return; var g = null; try { g = JSON.parse(c.dataset.g); } catch (e) {}
          var nom = c.querySelector("h2, h3, b"); var t = nom ? nom.textContent.trim() : "Structure";
          if (g) p.push({ g: g, etiq: t.length > 18 ? t.slice(0, 17) + "…" : t, el: c, cadre: "annuaire-cartes an2-cartes" });
        });
        return p;
      },
      filtres: function () { anForm.querySelector(".tp-filtres").click(); }
    };
  } else if (sjForm) {
    var D = json("sjc-donnees") || {}, sjOu = sjForm.elements.ou, sjTypes = Array.prototype.map.call(sjForm.querySelectorAll("[data-type]"), function (b) { return { v: b.dataset.type, nom: b.textContent.trim(), b: b }; });
    var sjType = function () { var x = sjTypes.filter(function (o) { return o.b.getAttribute("aria-pressed") === "true"; })[0]; return x ? x.v : ""; };
    var parLien = {};
    (D.cartes || []).concat(D.exemple ? [D.exemple] : []).forEach(function (c) { parLien[c.u] = c; });
    cfg = {
      voile: document.getElementById("sjc-ff"), deplacer: [sjForm], liste: document.getElementById("sjc-resultats"),
      lire: function () { return { ou: sjOu.value, type: sjType() }; },
      vide: { ou: "", type: "" },
      pilule: function (e) { var t = sjTypes.filter(function (o) { return o.v === e.type; })[0]; return [e.ou || "Partout en France", (t && t.v ? t.nom : "Colos, accueils de loisirs, périscolaire")]; },
      onglets: { cle: "type", sansVide: true, liste: sjTypes.map(function (o) { return { v: o.v, nom: o.nom.replace("Séjours et colos", "Colos"), ic: iconeDe(o.nom) || "tout" }; }) },
      questions: [],
      appliquer: function (e) {
        var t = sjTypes.filter(function (o) { return o.v === e.type; })[0]; if (t) t.b.click();
        sjOu.value = e.ou; sjOu.dispatchEvent(new Event("input", { bubbles: true }));
      },
      titre: function () { var n = document.getElementById("sjc-nb"); var t = n ? n.textContent.trim() : ""; return t || (D.cartes && D.cartes.length ? "Les offres" : "Un exemple d'offre"); },
      points: function () {
        var p = [];
        Array.prototype.forEach.call(document.querySelectorAll("#sjc-resultats a.sjc-carte"), function (a) {
          var c = parLien[a.getAttribute("href")]; if (!c || !c.g) return;
          p.push({ g: c.g, etiq: c.px != null ? Math.round(c.px) + " €" : "Prix ?", el: a, cadre: "sjc-grille" });
        });
        return p;
      },
      filtres: function () { sjForm.querySelector(".tp-filtres").click(); }
    };
  }
  if (!cfg) return;

  var main = document.getElementById("contenu"), pilule = barre.querySelector(".tel-pilule"), feuille = document.querySelector(".tel-feuille");
  // les formulaires et fenêtres de la page sortent du haut (caché) : leurs scripts les retrouvent où qu'ils soient
  (cfg.deplacer || []).forEach(function (x) { if (x) { document.body.appendChild(x); x.classList.add("tel-deplace"); } });

  /* ---------- le haut : ← retour, la pilule, les filtres ---------- */
  var retour = barre.querySelector(".tel-retour");
  retour.hidden = false;
  retour.addEventListener("click", function () {
    var meme = false;
    try { meme = document.referrer && new URL(document.referrer).host === location.host; } catch (e) {}
    if (meme && history.length > 1) history.back(); else location.href = barre.dataset.accueil || "/";
  });
  var filtresBtn = barre.querySelector(".tel-filtres");
  if (filtresBtn && cfg.voile) { filtresBtn.hidden = false; filtresBtn.addEventListener("click", cfg.filtres); }
  function majPilule() { var t = cfg.pilule(cfg.lire()); pilule.querySelector("b").textContent = t[0]; pilule.querySelector("small").textContent = t[1]; }
  majPilule();

  /* ---------- la feuille : poignée et titre ---------- */
  var tete = el("div", "tel-ab-tete"); tete.appendChild(el("span", "tel-ab-poignee"));
  var titre = el("p", "tel-ab-titre"); tete.appendChild(titre);
  main.insertBefore(tete, main.firstChild);
  function mesurer() {
    racine.style.setProperty("--ab-haut", barre.querySelector(".tel-barre-l").offsetHeight + "px");
    racine.style.setProperty("--ab-feuille", (barre.offsetHeight + Math.round(window.innerHeight * 0.32)) + "px");
  }
  mesurer(); window.addEventListener("resize", mesurer);

  /* ---------- la carte ---------- */
  var fiche = el("div", "tel-ab-fiche"); fiche.hidden = true; document.body.appendChild(fiche);
  function cacherFiche() { fiche.hidden = true; fiche.textContent = ""; if (zone) Array.prototype.forEach.call(zone.querySelectorAll(".pin.ouverte"), function (p) { p.classList.remove("ouverte"); }); }
  var cadreCarte = el("div", "tel-ab-carte"), zone = el("div", "carte-sessions"); cadreCarte.appendChild(zone);
  document.body.insertBefore(cadreCarte, document.body.firstChild);
  var plan = null, calque = null, signature = "", centres = json("tel-centres") || {};
  function charger(src, type) {
    return new Promise(function (ok, ko) {
      var t = document.createElement(type === "css" ? "link" : "script");
      if (type === "css") { t.rel = "stylesheet"; t.href = src; ok(); } else { t.src = src; t.onload = ok; t.onerror = ko; }
      document.head.appendChild(t);
    });
  }
  function dessinerCarte() {
    if (!plan) return;
    var pts = cfg.points(centres), groupes = {};
    pts.forEach(function (p) { var k = p.g[0].toFixed(3) + "," + p.g[1].toFixed(3); (groupes[k] = groupes[k] || []).push(p); });
    var sig = Object.keys(groupes).sort().join("|") + "#" + pts.length;
    if (sig === signature) return;
    signature = sig; calque.clearLayers(); cacherFiche();
    var L = window.L, coins = Object.keys(groupes).map(function (k) { return groupes[k][0].g; });
    // la vue d'abord (Leaflet ne dessine les étiquettes qu'une fois la carte placée), sur la partie visible au-dessus de la liste
    var cache = Math.max(0, window.innerHeight - (parseInt(getComputedStyle(racine).getPropertyValue("--ab-feuille"), 10) || 0));
    if (coins.length) plan.fitBounds(coins, { paddingTopLeft: [40, 30], paddingBottomRight: [40, cache + 30], maxZoom: 11 });
    else plan.fitBounds([[42.3, -4.8], [51.1, 8.2]], { paddingBottomRight: [0, cache] });
    Object.keys(groupes).forEach(function (k) {
      var g = groupes[k], p0 = g[0];
      var mk = L.marker(p0.g, { icon: L.divIcon({ className: "bulle-icone", iconSize: [0, 0], html: '<span class="pin pin-prix' + (p0.profil ? " pin-profil" : "") + '"></span>' }), riseOnHover: true }).addTo(calque);
      var sp = mk.getElement().querySelector(".pin");
      sp.textContent = p0.etiq; if (g.length > 1) sp.appendChild(el("small", null, "· " + g.length));
      mk.on("click", function () {
        cacherFiche(); sp.classList.add("ouverte");
        var k2 = 0, boite = el("div", "tel-ab-fiche-in");
        var dessiner = function () {
          boite.textContent = "";
          var x = el("button", "tel-ab-fiche-x"); x.type = "button"; x.setAttribute("aria-label", "Fermer"); x.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
          x.addEventListener("click", cacherFiche); boite.appendChild(x);
          var cadre = el(g[k2].cadre === "annuaire-cartes an2-cartes" || g[k2].cadre === "tp-cartes" ? "ul" : "div", g[k2].cadre);
          var copie = g[k2].el.cloneNode(true); copie.hidden = false; copie.removeAttribute("id"); cadre.appendChild(copie); boite.appendChild(cadre);
          // les boutons de la copie (« Voir le profil »…) font ce que font ceux de la carte d'origine
          var orig = g[k2].el;
          copie.addEventListener("click", function (e) {
            var b = e.target.closest && e.target.closest("button"); if (!b || b.classList.contains("tel-ab-fiche-x")) return;
            var i = Array.prototype.indexOf.call(copie.querySelectorAll("button"), b), o2 = orig.querySelectorAll("button")[i];
            if (o2) { e.preventDefault(); cacherFiche(); o2.click(); }
          });
          if (g.length > 1) {
            var nav = el("div", "tel-ab-fiche-nav");
            [["‹", -1, "Précédent"], ["›", 1, "Suivant"]].forEach(function (f, i) {
              var b = el("button", null, f[0]); b.type = "button"; b.setAttribute("aria-label", f[2]);
              b.addEventListener("click", function () { k2 = (k2 + f[1] + g.length) % g.length; dessiner(); });
              nav.appendChild(b); if (i === 0) nav.appendChild(el("span", null, (k2 + 1) + " / " + g.length));
            });
            boite.appendChild(nav);
          }
        };
        dessiner(); fiche.appendChild(boite); fiche.hidden = false;
      });
    });
  }
  var attente = null;
  function plusTard() { clearTimeout(attente); attente = setTimeout(function () { dessinerCarte(); titre.textContent = cfg.titre(); majPilule(); }, 120); }
  (window.L ? Promise.resolve() : charger(barre.dataset.leafletCss, "css").then(function () { return charger(barre.dataset.leafletJs, "js"); })).then(function () {
    var L = window.L;
    plan = L.map(zone, { zoomControl: false, attributionControl: true, maxZoom: 15, minZoom: 5 });
    L.tileLayer(barre.dataset.tuiles, { maxZoom: 18, minZoom: 4, attribution: '&copy; <a href="https://www.ign.fr/">IGN</a>' }).addTo(plan);
    calque = L.layerGroup().addTo(plan);
    plan.on("click", cacherFiche);
    dessinerCarte();
  }).catch(function (e) { if (window.console) console.warn("carte", e); });
  titre.textContent = cfg.titre();
  // la liste change (filtre de la page, animateurs arrivés du serveur) : la carte et le titre suivent
  if (cfg.liste) new MutationObserver(plusTard).observe(cfg.liste, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  Array.prototype.forEach.call(document.querySelectorAll("#compte-offres, #an-nb, #sjc-nb"), function (x) { new MutationObserver(plusTard).observe(x, { childList: true, characterData: true, subtree: true }); });

  /* ---------- liste ou carte ---------- */
  var boutonCarte = el("button", "tel-ab-bouton-carte"); boutonCarte.type = "button";
  boutonCarte.innerHTML = "<span>Carte</span>" + svg('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>');
  document.body.appendChild(boutonCarte);
  function redim() { if (plan) setTimeout(function () { plan.invalidateSize(); }, 360); }
  function modeCarte(oui) { cacherFiche(); window.scrollTo(0, 0); racine.classList.toggle("tel-carte", oui); majBouton(); redim(); }
  function majBouton() { boutonCarte.classList.toggle("visible", !racine.classList.contains("tel-carte") && window.scrollY > 80); }
  boutonCarte.addEventListener("click", function () { modeCarte(true); });
  tete.addEventListener("click", function () { if (racine.classList.contains("tel-carte")) modeCarte(false); });
  var y0 = null;
  tete.addEventListener("touchstart", function (e) { y0 = e.touches[0].clientY; }, { passive: true });
  tete.addEventListener("touchend", function (e) {
    if (y0 === null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null;
    if (!racine.classList.contains("tel-carte") && dy > 50 && window.scrollY < 10) modeCarte(true);
    else if (racine.classList.contains("tel-carte") && dy < -40) modeCarte(false);
  });
  window.addEventListener("scroll", majBouton, { passive: true }); majBouton();

  /* ---------- la recherche plein écran (même fenêtre et mêmes effets que « Se former ») ---------- */
  var populaires = json("villes-populaires") || [], lieux = json("tel-deps") || [];
  var etat = {};
  var m = el("div", "ab-m");
  feuille.textContent = ""; feuille.appendChild(m); feuille.classList.add("tel-ab-feuille");
  var sortie = null;
  function fermerModale() {
    if (!racine.classList.contains("tel-cherche") || sortie) return;
    racine.classList.remove("tel-cherche-anim"); racine.classList.add("tel-cherche-sort");
    sortie = setTimeout(function () { racine.classList.remove("tel-cherche", "tel-cherche-sort"); sortie = null; }, 320);
  }
  function ouvrirModale() {
    if (sortie) { clearTimeout(sortie); sortie = null; racine.classList.remove("tel-cherche-sort"); }
    etat = cfg.lire(); dessiner("ou");
    racine.classList.add("tel-cherche"); racine.classList.remove("tel-cherche-anim"); void m.offsetWidth; racine.classList.add("tel-cherche-anim");
  }
  pilule.addEventListener("click", function (e) { if (!tel.matches) return; e.preventDefault(); ouvrirModale(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && racine.classList.contains("tel-cherche")) fermerModale(); });
  function redessiner(cle) { racine.classList.remove("tel-cherche-anim"); dessiner(cle); }
  function dessiner(ouverte) {
    m.textContent = ""; m.classList.remove("ab-m-grand");
    var haut = el("div", "ab-m-haut"), ong = el("div", "ab-m-onglets"), o = cfg.onglets;
    o.liste.forEach(function (x, i) {
      var b = el("button", "ab-m-onglet"); b.type = "button"; b.style.setProperty("--i", i);
      b.appendChild(el("span", "ab-m-icone")).appendChild(icone(x.ic, 56));
      b.appendChild(el("span", "ab-m-nom", x.nom));
      if (etat[o.cle] === x.v) b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", function () { etat[o.cle] = o.sansVide ? x.v : (etat[o.cle] === x.v ? "" : x.v); redessiner(ouverte); });
      ong.appendChild(b);
    });
    haut.appendChild(ong);
    var x = el("button", "ab-m-x"); x.type = "button"; x.setAttribute("aria-label", "Fermer"); x.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');
    x.addEventListener("click", fermerModale); haut.appendChild(x);
    m.appendChild(haut);
    var corps = el("div", "ab-m-corps"); m.appendChild(corps);
    var rang = 0;
    function carteQ(cle, question, reponse, remplir) {
      var c = el("section", "ab-m-carte" + (ouverte === cle ? " ouverte" : "")); c.style.setProperty("--i", rang++);
      if (ouverte === cle) { c.appendChild(el("h2", null, question + " ?")); remplir(c); }
      else {
        var l = el("button", "ab-m-ligne"); l.type = "button";
        l.appendChild(el("span", null, question)); l.appendChild(el("b", null, reponse));
        l.addEventListener("click", function () { redessiner(cle); }); c.appendChild(l);
      }
      corps.appendChild(c);
      return c;
    }
    carteQ("ou", "Où", etat.ou || "Partout en France", function (c) {
      var boite = el("label", "ab-m-champ");
      boite.innerHTML = svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>');
      var champ = el("input"); champ.type = "search"; champ.placeholder = "Ville ou département"; champ.value = etat.ou;
      champ.setAttribute("enterkeyhint", "search"); champ.autocomplete = "off"; champ.setAttribute("aria-label", "Où ?");
      boite.appendChild(champ); c.appendChild(boite);
      var zoneS = el("div", "ab-m-sugg"); c.appendChild(zoneS);
      function suggerer() {
        zoneS.textContent = "";
        var q = sans(champ.value), liste;
        if (!q || (q === sans(etat.ou) && document.activeElement !== champ)) {
          zoneS.appendChild(el("p", "ab-m-sugg-t", "Les villes les plus demandées"));
          liste = populaires.map(function (v) { return [v.texte, "Ville"]; });
        } else {
          var mots = q.replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
          liste = lieux.concat(populaires.map(function (v) { return v.texte; })).filter(function (t, i, a) { return a.indexOf(t) === i; })
            .filter(function (t) { var k = sans(t); return mots.every(function (w) { return k.indexOf(w) !== -1; }); })
            .sort(function (a, b) { return (sans(b).indexOf(q) === 0) - (sans(a).indexOf(q) === 0) || a.length - b.length; })
            .slice(0, 8).map(function (t) { return [t, lieux.indexOf(t) >= 0 ? "Département" : "Ville"]; });
          zoneS.appendChild(el("p", "ab-m-sugg-t", liste.length ? "Suggestions" : "Aucun lieu ne correspond"));
        }
        liste.forEach(function (v) {
          var b = el("button", "ab-m-sugg-l"); b.type = "button";
          b.appendChild(el("span", "ab-m-sugg-ic")).innerHTML = svg('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>');
          var t = el("span"); t.appendChild(el("b", null, v[0])); t.appendChild(el("small", null, v[1])); b.appendChild(t);
          b.addEventListener("click", function () { etat.ou = v[0]; if (cfg.questions.length) redessiner(cfg.questions[0].cle); else chercher(); });
          zoneS.appendChild(b);
        });
      }
      champ.addEventListener("input", function () { etat.ou = champ.value; suggerer(); });
      champ.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); etat.ou = champ.value; chercher(); } });
      suggerer();
      var bas = el("span", "ab-m-sugg-plus"); bas.innerHTML = svg('<path d="M6 9l6 6 6-6"/>'); c.appendChild(bas);
      zoneS.addEventListener("scroll", function () {
        var grand = zoneS.scrollTop > 6;
        if (grand === m.classList.contains("ab-m-grand")) return;
        if (grand) { c.style.height = c.offsetHeight + "px"; void c.offsetHeight; m.classList.add("ab-m-grand"); c.style.height = (corps.clientHeight - 16) + "px"; }
        else { m.classList.remove("ab-m-grand"); c.style.height = ""; }
      }, { passive: true });
    });
    cfg.questions.forEach(function (q) {
      if (!q.liste.length) return;
      var choix = q.liste.filter(function (o) { return o.v === etat[q.cle]; })[0];
      carteQ(q.cle, q.titre, choix ? choix.nom : q.vide, function (c) {
        var l = el("div", "ab-m-puces");
        q.liste.forEach(function (o) {
          var b = el("button", "ab-m-puce"); b.type = "button";
          var ic = iconeDe(o.nom); if (ic) b.appendChild(icone(ic, 22));
          b.appendChild(document.createTextNode(o.nom));
          if (etat[q.cle] === o.v) b.setAttribute("aria-pressed", "true");
          b.addEventListener("click", function () { etat[q.cle] = etat[q.cle] === o.v ? "" : o.v; redessiner(q.cle); });
          l.appendChild(b);
        });
        c.appendChild(l);
      });
    });
    var pied = el("div", "ab-m-pied");
    var eff = el("button", "ab-m-effacer", "Tout effacer"); eff.type = "button";
    eff.addEventListener("click", function () { etat = JSON.parse(JSON.stringify(cfg.vide)); redessiner(ouverte); });
    var go = el("button", "ab-m-chercher"); go.type = "button";
    go.innerHTML = svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>'); go.appendChild(el("span", null, "Rechercher"));
    go.addEventListener("click", chercher);
    pied.appendChild(eff); pied.appendChild(go); m.appendChild(pied);
  }
  function chercher() {
    cfg.appliquer(etat);
    fermerModale(); majPilule(); racine.classList.remove("tel-carte"); window.scrollTo(0, 0); plusTard();
  }
})();

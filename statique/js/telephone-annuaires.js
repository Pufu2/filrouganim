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

  /* ---------- pas de carte ici (elle est réservée à « Se former ») : la liste commence sous la barre ---------- */
  racine.classList.add("tel-sans-carte");
  tete.querySelector(".tel-ab-poignee").remove();
  var attente = null;
  function plusTard() { clearTimeout(attente); attente = setTimeout(function () { titre.textContent = cfg.titre(); majPilule(); }, 120); }
  titre.textContent = cfg.titre();
  if (cfg.liste) new MutationObserver(plusTard).observe(cfg.liste, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  Array.prototype.forEach.call(document.querySelectorAll("#compte-offres, #an-nb, #sjc-nb"), function (x) { new MutationObserver(plusTard).observe(x, { childList: true, characterData: true, subtree: true }); });

  /* ---------- Animateurs (/trouver-un-poste/offres/) : le style « lumière » (docs/CHARTE.md § 7) ----------
     Des lumières floues derrière le haut et la barre (transparente), un titre en Fraunces, le profil en petite carte de verre,
     les animateurs en petites cartes de couleur rangées par poste (une rangée qui défile par poste), et la fin « Vous
     recrutez ? » en carte claire. Les cartes d'origine (animateurs.js) restent dans la page, cachées : « Voir » ouvre leur fiche. */
  if (ofForm) (function () {
    racine.classList.add("tel-anim");
    // le haut : surtitre, titre ; puis le profil en petite carte
    var bandeau = el("div", "tel-anim-tete");
    var h = el("h2", "tel-titre");  // (le titre n'est plus affiché : seule la carte du profil reste en haut)
    var cta = el("a", "tel-cta"); cta.href = (document.querySelector(".tp-bande-bouton") || {}).href || "/compte/?inscription=1";
    cta.innerHTML = '<span class="tel-cta-ic">' + svg('<path d="M4 12l16-8-6 16-2-6z"/>') + '</span>';
    var t = el("span", "tel-cta-t"); t.appendChild(el("b", null, "Les structures viennent à vous")); t.appendChild(el("span", null, "Votre profil, vu dans votre secteur.")); cta.appendChild(t);
    cta.appendChild(el("span", "tel-cta-b", "Créer mon profil"));
    bandeau.appendChild(cta);
    tete.parentNode.insertBefore(bandeau, tete.nextSibling);
    // les rangées par poste
    var ul = document.getElementById("animateurs-of"); if (!ul) return;
    var vue = el("div", "tel-anims"); ul.parentNode.insertBefore(vue, ul);
    var TEINTES = ["rose", "lavande", "ciel", "peche", "menthe", "sable"];
    var MOIS = { janvier: "janv.", fevrier: "févr.", mars: "mars", avril: "avr.", mai: "mai", juin: "juin", juillet: "juil.", aout: "août", septembre: "sept.", octobre: "oct.", novembre: "nov.", decembre: "déc." };
    function lire(li) {
      var n = li.querySelector("h2"), lieu = (li.querySelector(".tp-carte-lieu") || {}).textContent || "", det = (li.querySelector(".tp-carte-detail") || {}).textContent || "";
      var parts = det.split(" · "), dispo = parts.filter(function (x) { return /^disponible/i.test(x.trim()); })[0] || "";
      var dips = parts.filter(function (x) { return x && !/^disponible/i.test(x.trim()); });
      var m = lieu.match(/^(.*?)\s*\((\w{2,3})\)/), poste = lieu.split(" · ").slice(1).join(" · ");
      var d = sans(dispo).match(/du (\d+)(?:er)? ([a-z]+)/), tag = d ? "Dès le " + (d[1] === "1" ? "1er" : d[1]) + " " + (MOIS[d[2]] || d[2]) : "";
      var tout = sans(det + " " + poste), groupe = /bafd|direct/.test(tout) ? "Direction" : /stagiaire bafa|stage pratique/.test(tout) ? "Stage pratique BAFA" : "Animateurs";
      return { nom: n ? n.textContent.trim() : "", lieu: m ? m[1] + " · " + m[2] : lieu.split(" · ")[0], dips: dips.slice(0, 2), tag: tag, groupe: groupe,
        exemple: li.classList.contains("tp-carte-exemple"), lien: li.querySelector("h2 a"), voir: li.querySelector(".an-voir") };
    }
    function dessiner() {
      var lis = Array.prototype.filter.call(ul.children, function (li) { return li.matches(".an-carte, .tp-carte-exemple") && !li.hidden; });
      var groupes = { "Stage pratique BAFA": [], "Animateurs": [], "Direction": [] };
      lis.forEach(function (li) { var x = lire(li); groupes[x.groupe].push(x); });
      var n = lis.filter(function (li) { return !li.classList.contains("tp-carte-exemple"); }).length;
      vue.textContent = ""; var k = 0;
      Object.keys(groupes).forEach(function (g) {
        if (!groupes[g].length) return;
        var sec = el("section", "tel-anim-groupe"), ht = el("div", "tel-anim-gt");
        var h3 = el("h3", null, g); h3.appendChild(el("small", null, String(groupes[g].length))); ht.appendChild(h3);
        var rail = el("div", "tel-rail");
        if (groupes[g].length > 2) { var tv = el("button", "tel-tout", "Tout voir"); tv.type = "button"; tv.addEventListener("click", function () { var o = sec.classList.toggle("tel-grille"); tv.textContent = o ? "Moins" : "Tout voir"; }); ht.appendChild(tv); }
        sec.appendChild(ht);
        groupes[g].forEach(function (x) {
          var c = el("article", "tel-pc tel-t-" + TEINTES[k++ % TEINTES.length]);
          var hd = el("div", "tel-pc-h"); hd.appendChild(el("span", "tel-pc-tag", x.exemple ? "Exemple" : (x.tag || "Inscrit sur le site"))); c.appendChild(hd);
          c.appendChild(el("span", "tel-pc-av", (x.nom || "?").charAt(0).toUpperCase()));
          var co = el("div", "tel-pc-c"); co.appendChild(el("b", null, x.nom)); co.appendChild(el("span", "tel-pc-l", x.lieu));
          var ch = el("div", "tel-pc-chips"); x.dips.forEach(function (d0, i) { ch.appendChild(el("span", "tel-chip" + (i === 0 ? " tel-chip-r" : ""), d0.replace(/^stagiaire /i, "Stagiaire "))); }); co.appendChild(ch);
          var bt = el("div", "tel-pc-bt"); var v = el(x.exemple ? "a" : "button", "tel-pc-voir", "Voir →");
          if (x.exemple && x.lien) v.href = x.lien.href; else { v.type = "button"; v.addEventListener("click", function () { if (x.voir) x.voir.click(); }); }
          bt.appendChild(v); var cad = el("span", "tel-pc-cad"); cad.innerHTML = svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'); cad.appendChild(document.createTextNode("abonnés")); bt.appendChild(cad);
          co.appendChild(bt); c.appendChild(co);
          rail.appendChild(c);
        });
        sec.appendChild(rail); vue.appendChild(sec);
      });
      majFin(lis);
    }
    // la fin « Vous recrutez ? » : la carte claire, avec les initiales des animateurs
    var fin = null, avant = document.querySelector(".tp-sans-offre");
    function majFin(lis) {
      if (!avant) return;
      var lienFin = avant.querySelector("a");
      if (!fin) { fin = el("section", "tel-fin"); avant.parentNode.insertBefore(fin, avant.nextSibling); }
      fin.textContent = "";
      var pile = el("div", "tel-pile"), noms = lis.filter(function (li) { return !li.classList.contains("tp-carte-exemple"); }).map(function (li) { return lire(li).nom; });
      noms.slice(0, 4).forEach(function (nm, i) { pile.appendChild(el("span", "tel-pile-av tel-t-" + TEINTES[i % TEINTES.length], nm.charAt(0).toUpperCase())); });
      if (noms.length > 4) pile.appendChild(el("span", "tel-pile-plus", "+" + (noms.length - 4)));
      fin.appendChild(pile);
      var h3 = el("h3", null, "Vous recrutez ? "); h3.appendChild(el("em", null, "Ils sont prêts.")); fin.appendChild(h3);
      fin.appendChild(el("p", null, avant.firstChild && avant.firstChild.nodeType === 3 ? avant.firstChild.textContent.trim() : "Chaque animateur en résumé : la fiche complète, le CV et l'e-mail sont réservés aux structures vérifiées et abonnées."));
      var bts = el("div", "tel-fin-b"), a1 = el("a", "tel-fin-n", "Voir l'offre fondateurs"); a1.href = lienFin ? lienFin.href : "/recruter/";
      var a2 = el("a", "tel-fin-c", "En savoir plus"); a2.href = (barre.dataset.accueil || "/") + "comment-ca-marche/#structure";
      bts.appendChild(a1); bts.appendChild(a2); fin.appendChild(bts);
    }
    // la fiche d'un animateur (animateurs.js) : en feuille compacte (telephone.css), avec ce que le compte gratuit d'une structure ouvre
    new MutationObserver(function () {
      var b = document.querySelector(".an-voile:not([hidden]) .an-bulle");
      if (!b || b.querySelector(".tel-gratuit")) return;
      var g = el("p", "tel-gratuit");
      g.innerHTML = svg('<path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>');
      var t2 = el("span"); t2.appendChild(el("b", null, "Compte gratuit pour les structures")); t2.appendChild(document.createTextNode(" : 2 demandes d'animateurs offertes, sans carte bancaire."));
      g.appendChild(t2);
      var bt = b.querySelector(".an-boutons"); b.insertBefore(g, bt);
    }).observe(document.body, { childList: true, subtree: true });
    dessiner();
    new MutationObserver(function () { clearTimeout(dessiner._t); dessiner._t = setTimeout(dessiner, 80); }).observe(ul, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    ofOu.addEventListener("change", function () { setTimeout(dessiner, 50); });
  })();

  /* ---------- la recherche plein écran (même fenêtre et mêmes effets que « Se former ») ---------- */
  var populaires = json("villes-populaires") || [], lieux = json("tel-deps") || [];
  var etat = {};
  var m = el("div", "ab-m");
  feuille.textContent = ""; feuille.appendChild(m); feuille.classList.add("tel-ab-feuille");
  var sortie = null;
  function fermerModale() {
    if (!racine.classList.contains("tel-cherche") || sortie) return;
    racine.classList.remove("tel-cherche-anim"); racine.classList.add("tel-cherche-sort");
    sortie = true;
    // la grande carte remonte dans la barre de recherche (telephone.js, FRA_MORPH), le reste glisse et s'efface
    window.FRA_MORPH("fermer", m.querySelector(".ab-m-carte.ouverte"), pilule, function () { racine.classList.remove("tel-cherche", "tel-cherche-sort"); sortie = null; });
  }
  function ouvrirModale() {
    if (sortie) return;
    etat = cfg.lire(); dessiner("ou");
    racine.classList.add("tel-cherche"); racine.classList.remove("tel-cherche-anim"); void m.offsetWidth; racine.classList.add("tel-cherche-anim");
    // la barre de recherche s'ouvre en grande carte « Où ? »
    window.FRA_MORPH("ouvrir", m.querySelector(".ab-m-carte.ouverte"), pilule);
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
    fermerModale(); majPilule(); window.scrollTo(0, 0); plusTard();
  }
})();

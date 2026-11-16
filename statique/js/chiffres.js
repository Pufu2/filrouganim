// La page des chiffres : les demandes des animateurs en direct (poste, département, mois : rien sur la personne)
// et « Votre ville sur Google » (les villes en première page, et la place de la page dans les résultats).
(function () {
  var D = JSON.parse(document.getElementById("cj-donnees").textContent);
  var MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var MOIS_L = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  // les postes, regroupés comme les métiers sur jasonmarinho.com
  var GROUPES = [
    ["stage", "Stage pratique BAFA", ["animateur-stagiaire"], '<path d="M4 18c4 0 3-8 8-8s4 8 8 8"/><circle cx="4" cy="18" r="1.6"/><circle cx="12" cy="10" r="1.6"/><circle cx="20" cy="18" r="1.6"/>'],
    ["anim", "Animateur", ["animateur"], '<circle cx="9" cy="8" r="3"/><path d="M3 20c.8-3.4 3.2-5 6-5s5.2 1.6 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15c2.4 0 4.2 1.3 5 4"/>'],
    ["dir", "Direction", ["directeur", "directeur-adjoint", "coordinateur"], '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>'],
    ["autre", "Autres postes", ["surveillant-baignade", "autre"], '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>']
  ];
  function groupe(poste) { for (var i = 0; i < GROUPES.length; i++) if (GROUPES[i][2].indexOf(poste) >= 0) return GROUPES[i]; return GROUPES[3]; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function ico(svg) { var s = el("span", "cj-ico"); s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + svg + "</svg>"; return s; }
  function moisFr(m) { return m ? MOIS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4) : ""; }
  function nb(x) { return (x || 0).toLocaleString("fr-FR"); }
  var ETATS = { ouverte: ["Ouverte par une structure", "cj-e-ouverte"], transmise: ["Transmise", "cj-e-transmise"], attente: ["En attente d'une structure", "cj-e-attente"] };
  var SOURCES = { demande: "Formulaire « Décrire ce que je cherche »", candidature: "Bouton « Postuler » d'une offre" };
  var filtre = null;

  /* ---------- les demandes ---------- */
  function lieu(d) { return d.ville || D.deps[d.dep] || "Autre lieu"; }
  function demandes() {
    var tout = D.demandes || [], liste = filtre ? tout.filter(function (d) { return groupe(d.poste)[0] === filtre; }) : tout;
    // la carte du haut
    var n = document.getElementById("cj-dem-n"); if (n) n.textContent = tout.length;
    var premier = tout.length ? tout[tout.length - 1].mois : null;
    var tt = document.getElementById("cj-dem-titre"); if (tt) tt.textContent = "Demandes d'animateurs" + (premier ? " · depuis " + MOIS[+premier.slice(5, 7) - 1] : "");
    var der = document.getElementById("cj-dem-der");
    if (der) der.textContent = tout.length ? "Dernière : " + groupe(tout[0].poste)[1].toLowerCase().replace(/^stage/, "un stage").replace(/^animateur/, "un poste d'animateur").replace(/^direction/, "un poste de direction").replace(/^autres postes/, "un autre poste") + ", " + moisFr(tout[0].mois) : "La première arrive bientôt";
    // les postes
    var bp = document.getElementById("cj-postes"); bp.textContent = "";
    GROUPES.forEach(function (g) {
      var k = tout.filter(function (d) { return groupe(d.poste)[0] === g[0]; }).length;
      var b = el("button", "cj-poste"); b.type = "button"; b.setAttribute("aria-pressed", filtre === g[0] ? "true" : "false");
      b.appendChild(ico(g[3])); b.appendChild(el("b", null, String(k))); b.appendChild(el("span", null, g[1]));
      b.addEventListener("click", function () { filtre = filtre === g[0] ? null : g[0]; demandes(); });
      bp.appendChild(b);
    });
    // le fil
    var fil = document.getElementById("cj-fil"); fil.textContent = "";
    liste.slice(0, 8).forEach(function (d) {
      var g = groupe(d.poste), li = el("li"), c = el("div", "cj-f-carte");
      c.appendChild(ico(g[3]));
      var t = el("div", "cj-f-t"); t.appendChild(el("b", null, (D.postes[d.poste] || g[1]) + (d.ville ? " à " + d.ville : " · " + lieu(d))));
      t.appendChild(el("small", null, moisFr(d.mois) + " · " + (SOURCES[d.source] || "Formulaire")));
      c.appendChild(t);
      var e = ETATS[d.etat] || ETATS.attente; c.appendChild(el("span", "cj-etat " + e[1], e[0]));
      li.appendChild(c); fil.appendChild(li);
    });
    var prochain = el("li", "cj-f-prochain"); prochain.appendChild(el("div", "cj-f-carte", "La prochaine demande s'affichera ici.")); fil.appendChild(prochain);
    // par département
    var bd = document.getElementById("cj-deps"); bd.textContent = "";
    var parDep = {};
    liste.forEach(function (d) { var k = d.dep || "?"; (parDep[k] = parDep[k] || []).push(d); });
    Object.keys(parDep).sort(function (a, b) { return parDep[b].length - parDep[a].length || (D.deps[a] || "").localeCompare(D.deps[b] || ""); }).forEach(function (k) {
      var l = parDep[k], c = el("div", "cj-dep");
      var h = el("div", "cj-dep-h"); h.appendChild(el("h4", null, D.deps[k] || "Autre lieu")); h.appendChild(el("b", null, String(l.length))); c.appendChild(h);
      var puces = el("p", "cj-puces"), compte = {};
      l.forEach(function (d) { var g = groupe(d.poste); compte[g[0]] = compte[g[0]] || [g, 0]; compte[g[0]][1]++; });
      Object.keys(compte).forEach(function (x) { puces.appendChild(el("span", "cj-puce cj-p-" + x, compte[x][1] + " · " + compte[x][0][1])); });
      c.appendChild(puces);
      var st = (D.structures_dep || {})[k] || 0;
      if (st) c.appendChild(el("p", "cj-dep-st", st + (st > 1 ? " structures inscrites sur place" : " structure inscrite sur place")));
      else c.appendChild(el("p", "cj-libre", "Aucune structure inscrite : la place est libre"));
      bd.appendChild(c);
    });
    if (!liste.length) bd.appendChild(el("p", "cj-vide", "Aucune demande pour ce poste pour l'instant."));
    // les compteurs
    var cp = document.getElementById("cj-compteurs"); cp.textContent = "";
    function compteur(t, v, cl) { var s = el("span", cl); s.appendChild(document.createTextNode(t + " ")); s.appendChild(el("b", null, String(v))); cp.appendChild(s); }
    compteur(SOURCES.demande, tout.filter(function (d) { return d.source === "demande"; }).length);
    compteur(SOURCES.candidature, tout.filter(function (d) { return d.source === "candidature"; }).length);
    compteur("Ouvertes par une structure", tout.filter(function (d) { return d.etat === "ouverte"; }).length, "cj-k cj-k-ouverte");
    compteur("Transmises", tout.filter(function (d) { return d.etat === "transmise"; }).length, "cj-k cj-k-transmise");
    compteur("En attente d'une structure", tout.filter(function (d) { return d.etat === "attente"; }).length, "cj-k cj-k-attente");
  }
  demandes();
  // en direct : la base ne renvoie que le poste, le département, le mois et l'état
  if (window.fetch && D.sb) {
    fetch(D.sb + "/rest/v1/rpc/chiffres_publics", { headers: { apikey: D.cle } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (x) {
      if (x && x.demandes) { D.demandes = x.demandes; D.structures_dep = x.structures_par_dep || {}; demandes(); }
    }).catch(function () {});
  }

  /* ---------- votre ville sur Google ---------- */
  var famille = (D.onglets[0] || [])[0], villeChoisie = null, lieux = null;
  var MOT = { bafa: "bafa", bafd: "bafd", bsb: "bsb", psc: "psc1", ecoles: "bpjeps" };
  function recherche(titre, ville, fam) {
    var m = (titre || "").match(/\b(BAFA|BAFD|BSB|PSC1?|CPJEPS|BPJEPS|DEJEPS|DESJEPS)\b/i);
    return ((m ? m[1] : MOT[fam] || "bafa") + " " + ville).toLowerCase();
  }
  function onglet(fam) {
    famille = fam;
    Array.prototype.forEach.call(document.querySelectorAll(".cj-onglet"), function (b) { b.setAttribute("aria-selected", b.dataset.famille === fam ? "true" : "false"); });
    var o = D.onglets.filter(function (x) { return x[0] === fam; })[0], villes = o ? o[2] : [];
    document.getElementById("cj-nb-villes").textContent = villes.length + (villes.length > 1 ? " villes" : " ville");
    var ol = document.getElementById("cj-villes"); ol.textContent = "";
    villes.slice(0, 13).forEach(function (v, i) {
      var li = el("li"), b = el("button"); b.type = "button";
      b.appendChild(el("span", null, v.v)); b.appendChild(el("b", null, String(v.p).replace(".", ",")));
      b.addEventListener("click", function () { choisir(v, b); });
      li.appendChild(b); ol.appendChild(li);
      if (i === 0) choisir(v, b);
    });
    if (!villes.length) { ol.appendChild(el("li", "cj-vide", "Pas encore de ville en première page pour " + (o ? o[1] : "cette formation") + " : ça vient.")); serp(null); }
  }
  function choisir(v, bouton) {
    Array.prototype.forEach.call(document.querySelectorAll("#cj-villes button"), function (b) { b.classList.toggle("on", b === bouton); });
    villeChoisie = v; serp(v);
  }
  // un faux écran de résultats Google, avec la page du site à sa place
  function serp(v, note) {
    var box = document.getElementById("cj-serp"), trois = document.getElementById("cj-trois"), liens = document.getElementById("cj-liens");
    box.textContent = ""; trois.textContent = ""; liens.textContent = "";
    var q = v ? recherche(v.t, v.v, famille) : "";
    var barre = el("div", "cj-s-barre");
    barre.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>';
    barre.appendChild(el("span", null, q || "Choisissez une ville"));
    if (q) { var cp = el("button", "cj-copier", "Copier"); cp.type = "button"; cp.addEventListener("click", function () { if (navigator.clipboard) navigator.clipboard.writeText(q).then(function () { cp.textContent = "Copié"; setTimeout(function () { cp.textContent = "Copier"; }, 1500); }); }); barre.appendChild(cp); }
    box.appendChild(barre);
    var tete = el("p", "cj-s-tete"); tete.appendChild(el("span", null, "Résultats")); tete.appendChild(el("span", null, v && v.p > 10 ? "Page " + Math.ceil(v.p / 10) : "Page 1")); box.appendChild(tete);
    var place = v && v.p ? Math.max(1, Math.round(v.p)) : null, rang = place && place <= 10 ? place : null;
    var ol = el("ol", "cj-s-liste");
    for (var i = 1; i <= 10; i++) {
      var li = el("li");
      if (i === rang) {
        li.className = "cj-s-nous";
        li.appendChild(el("span", "cj-s-rang", String(i)));
        var t = el("div"); t.appendChild(el("small", null, "filrouganim.fr › " + v.u.replace(/^\/|\/$/g, "").split("/").join(" › ")));
        var a = el("a", null, v.t); a.href = v.u; t.appendChild(a);
        var d = el("p"); d.appendChild(document.createTextNode("Votre page sort ici : " + String(v.p).replace(".", ",") + (Math.round(v.p) === 1 ? "re" : "e") + " place en moyenne")); t.appendChild(d);
        li.appendChild(t);
      } else { li.appendChild(el("span", "cj-s-n", String(i))); li.appendChild(el("span", "cj-s-gris")); }
      ol.appendChild(li);
    }
    box.appendChild(ol);
    if (note) box.appendChild(el("p", "cj-s-note", note));
    if (!v) return;
    [v.p ? String(v.p).replace(".", ",") : "—", "place moyenne"], [nb(v.i), v.i > 1 ? "affichages" : "affichage"], [nb(v.c), v.c > 1 ? "clics" : "clic"]].forEach(function (x) {
      var c = el("div"); c.appendChild(el("b", null, x[0])); c.appendChild(el("span", null, x[1])); trois.appendChild(c);
    });
    var l1 = el("a", "cj-lien", "Voir la page " + v.t + " →"); l1.href = v.u; liens.appendChild(l1);
    var l2 = el("button", "cj-lien", "Tous les chiffres de " + v.v + " ↓"); l2.type = "button"; l2.addEventListener("click", function () { tousLesChiffres(v.v); }); liens.appendChild(l2);
  }
  function sans(t) { return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[-']/g, " ").trim(); }
  function avecLieux(f) { if (lieux) return f(); fetch(D.lieux).then(function (r) { return r.json(); }).then(function (d) { lieux = d; f(); }).catch(function () {}); }
  function trouver(q) {
    var k = sans(q);
    return lieux.filter(function (e) { return sans(e.n) === k || e.d === q.trim().toUpperCase(); })
      .concat(lieux.filter(function (e) { return k.length > 2 && sans(e.n).indexOf(k) === 0 && sans(e.n) !== k; })).slice(0, 4);
  }
  function tousLesChiffres(q) {
    avecLieux(function () {
      var box = document.getElementById("cj-detail"), l = trouver(q);
      box.hidden = false; box.textContent = "";
      if (!l.length) { box.appendChild(el("p", "cj-vide", "Pas encore de page pour « " + q + " ». Elle arrive dès qu'une formation y est prévue.")); return; }
      l.forEach(function (e) {
        var c = el("div", "cj-d-lieu"), imp = 0, cl = 0;
        e.p.forEach(function (x) { imp += x[2]; cl += x[3]; });
        c.appendChild(el("h3", null, e.n + (e.d && e.g === "ville" ? " (" + e.d + ")" : "") + (e.g === "departement" ? " · département" : e.g === "region" ? " · région" : "")));
        c.appendChild(el("p", "cj-d-total", e.p.length + " page" + (e.p.length > 1 ? "s" : "") + " · " + nb(imp) + " affichage" + (imp > 1 ? "s" : "") + " · " + nb(cl) + " clic" + (cl > 1 ? "s" : "") + " sur 28 jours"));
        var ul = el("ul");
        e.p.forEach(function (x) {
          var li = el("li"), a = el("a", null, x[0]); a.href = x[1]; li.appendChild(a);
          li.appendChild(el("span", null, x[2] ? nb(x[2]) + " aff. · " + x[3] + " clic" + (x[3] > 1 ? "s" : "") + (x[4] ? " · place " + String(x[4]).replace(".", ",") : "") : "pas encore vue dans Google"));
          ul.appendChild(li);
        });
        c.appendChild(ul); box.appendChild(c);
      });
      box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
  // une ville tapée : sa page de la formation choisie, à sa place dans Google
  document.getElementById("cj-cherche").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var q = document.getElementById("cj-lieu").value; if (!q.trim()) return;
    avecLieux(function () {
      var e = trouver(q)[0];
      Array.prototype.forEach.call(document.querySelectorAll("#cj-villes button"), function (b) { b.classList.remove("on"); });
      if (!e) { serp(null, "Pas encore de page pour « " + q + " ». Elle arrive dès qu'une formation y est prévue."); tousLesChiffres(q); return; }
      var pages = e.p.filter(function (x) { return famillePage(x[1]) === famille; }), x = (pages.length ? pages : e.p).slice().sort(function (a, b) { return (a[4] || 99) - (b[4] || 99); })[0];
      var v = { v: e.n, t: x[0], u: x[1], i: x[2], c: x[3], p: x[4] };
      if (!x[4]) serp(Object.assign({}, v, { p: 0 }), "Cette page n'est pas encore apparue dans Google sur 28 jours : elle est toute neuve, ou la recherche est rare.");
      else if (x[4] > 10) serp(v, "Cette page sort au-delà de la première page (" + String(x[4]).replace(".", ",") + "e place en moyenne) : elle monte avec le temps.");
      else serp(v);
      tousLesChiffres(q);
    });
  });
  function famillePage(u) {
    if (u.indexOf("/se-former/ecoles/") === 0) return "ecoles";
    if (/\/psc1\//.test(u)) return "psc"; if (/\/bsb\//.test(u)) return "bsb"; if (/\/bafd\//.test(u)) return "bafd";
    return "bafa";
  }
  Array.prototype.forEach.call(document.querySelectorAll(".cj-onglet"), function (b) { b.addEventListener("click", function () { onglet(b.dataset.famille); }); });
  if (famille) onglet(famille);
})();

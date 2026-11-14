/* Fil Roug'Anim : les statistiques de l'espace admin, en tableau de bord.
   Une période (7 jours, 30 jours, 3 mois, 12 mois) comparée à la précédente, six thèmes, et pour chacun :
   des chiffres clés avec leur évolution et leur courbe, un grand graphique, des répartitions et des tableaux.
   Tout est calculé ici à partir de admin_donnees ; les graphiques sont dessinés en SVG, sans bibliothèque. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var COUL = ["#d61f35", "#3f5b4b", "#d6a400", "#2f6f73", "#5b3f86", "#8a5a2b", "#c2185b", "#6b7280"];
  var D, E, racine, P = 30, theme = "ensemble";
  var POSTES_D = { "animateur-stagiaire": "Stage pratique BAFA", "animateur": "Animateur", "directeur": "Direction", "directeur-adjoint": "Direction adjointe", "surveillant-baignade": "Baignade", "autre": "Autre" };
  var PERIODES = { "ete": "Été", "petites-vacances": "Petites vacances", "mercredis": "Mercredis", "periscolaire": "Périscolaire", "annee": "Toute l'année", "stage-pratique": "Stage pratique" };
  var STATUTS = { envoyee: "Nouvelle", vue: "Vue", retenue: "Retenue", "non-retenue": "Non retenue" };

  /* -- dates et périodes -- */
  var auj = new Date(); auj.setHours(12, 0, 0, 0);
  function jour(n) { var d = new Date(auj); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
  function iso(x) { return (x || "").slice(0, 10); }
  function dans(x, debut, fin) { var j = iso(x); return j && j >= debut && j <= fin; }
  function periode() { return { debut: jour(P - 1), fin: jour(0), avDebut: jour(2 * P - 1), avFin: jour(P) }; }
  // les tranches du graphique : par jour jusqu'à 3 mois, par semaine sur 12 mois
  function tranches() {
    var pas = P > 92 ? 7 : 1, n = Math.ceil(P / pas), t = [];
    for (var i = n - 1; i >= 0; i--) t.push({ debut: jour(i * pas + pas - 1), fin: jour(i * pas) });
    return t;
  }
  function serie(liste, champ, filtre) {
    return tranches().map(function (t) { return liste.filter(function (x) { return (!filtre || filtre(x)) && dans(x[champ], t.debut, t.fin); }).length; });
  }
  function serieVues(types, liste) {
    liste = liste || D.vues;
    return tranches().map(function (t) { return liste.filter(function (v) { return types.indexOf(v.type) >= 0 && v.jour >= t.debut && v.jour <= t.fin; }).reduce(function (a, v) { return a + v.n; }, 0); });
  }
  function etiquette(t) {
    var d = new Date(t.fin + "T12:00:00");
    return P > 92 ? "sem. du " + new Date(t.debut + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  /* -- formats -- */
  function fr(n) { return Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 }); }
  function euros(n) { return Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €"; }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function el(tag, classe, texte) { var e = document.createElement(tag); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e; }
  function sv(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function lib(liste, v) { try { return E.libelle(liste, v); } catch (e) { return v; } }
  function nomDep(k) { return E.nomDep(k) + " (" + k + ")"; }
  function paye(s) { return !!(s.abonnement_fin && s.abonnement_fin >= jour(0)); }
  function enLigne(o) { return o.publiee && o.expire_le >= jour(0); }
  function compte(l, f) { return l.filter(f).length; }
  function repartir(liste, cle, nommer, limite) {
    var c = {};
    liste.forEach(function (x) {
      var v = typeof cle === "function" ? cle(x) : x[cle];
      (Array.isArray(v) ? v : [v]).forEach(function (k) { if (k === null || k === undefined || k === "") return; c[k] = (c[k] || 0) + 1; });
    });
    return Object.keys(c).map(function (k) { return { nom: nommer ? nommer(k) : k, n: c[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, limite || 10);
  }

  /* -- les briques : carte, chiffre clé, graphique, anneau, barres, entonnoir, tableau -- */
  function grille(parent) { var g = el("div", "st-grille"); parent.appendChild(g); return g; }
  function carte(g, taille, titre, sous, droite) {
    var c = el("section", "st-carte st-" + taille);
    if (titre) {
      var h = el("header", "st-carte-tete"), t = el("div");
      t.appendChild(el("h3", null, titre)); if (sous) t.appendChild(el("p", null, sous));
      h.appendChild(t); if (droite) h.appendChild(droite);
      c.appendChild(h);
    }
    g.appendChild(c); return c;
  }
  function evolution(n, avant) {
    if (!avant && !n) return el("span", "st-delta st-delta-neutre", "–");
    if (!avant) return el("span", "st-delta st-delta-haut", "nouveau");
    var d = Math.round((n - avant) / avant * 100);
    return el("span", "st-delta " + (d > 0 ? "st-delta-haut" : d < 0 ? "st-delta-bas" : "st-delta-neutre"), (d > 0 ? "▲ +" : d < 0 ? "▼ " : "") + d + " %");
  }
  function etincelle(valeurs, couleur) {
    var w = 120, h = 34, max = Math.max.apply(null, valeurs.concat([1])), n = valeurs.length;
    var s = sv("svg", { viewBox: "0 0 " + w + " " + h, preserveAspectRatio: "none", class: "st-etincelle", "aria-hidden": "true" });
    if (n < 2) return s;
    var pts = valeurs.map(function (v, i) { return [i / (n - 1) * w, h - 2 - v / max * (h - 6)]; });
    var ligne = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    s.appendChild(sv("path", { d: ligne + " L" + w + " " + h + " L0 " + h + " Z", fill: couleur, "fill-opacity": ".12" }));
    s.appendChild(sv("path", { d: ligne, fill: "none", stroke: couleur, "stroke-width": "1.8", "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round" }));
    return s;
  }
  // k = { titre, valeur, avant, serie, couleur, aide, format }
  function chiffre(g, k) {
    var c = el("section", "st-carte st-c2 st-kpi");
    c.appendChild(el("p", "st-kpi-titre", k.titre));
    var v = el("div", "st-kpi-ligne"); v.appendChild(el("b", null, k.format ? k.format(k.valeur) : fr(k.valeur)));
    if (k.avant !== undefined) v.appendChild(evolution(k.valeur, k.avant));
    c.appendChild(v);
    c.appendChild(el("p", "st-kpi-aide", k.aide || (k.avant !== undefined ? "contre " + (k.format ? k.format(k.avant) : fr(k.avant)) + " la période d'avant" : "")));
    if (k.serie) c.appendChild(etincelle(k.serie, k.couleur || COUL[0]));
    g.appendChild(c); return c;
  }
  function arrondiHaut(m) { if (m <= 5) return 5; var p = Math.pow(10, Math.floor(Math.log10(m))), r = m / p; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p; }
  // series = [{ nom, valeurs, couleur }]
  function graphe(parent, series, hauteur) {
    var boite = el("div", "st-graphe"); parent.appendChild(boite);
    var legende = el("div", "st-legende");
    series.forEach(function (s, i) {
      var b = el("button", "st-leg"); b.type = "button"; b.setAttribute("aria-pressed", s.cache ? "false" : "true");
      var p = el("i"); p.style.background = s.couleur; b.appendChild(p); b.appendChild(document.createTextNode(s.nom + " · " + fr(s.valeurs.reduce(function (a, v) { return a + v; }, 0))));
      b.addEventListener("click", function () { s.cache = !s.cache; dessiner(); b.setAttribute("aria-pressed", s.cache ? "false" : "true"); });
      legende.appendChild(b);
    });
    if (series.length > 1) boite.appendChild(legende);
    var zone = el("div", "st-graphe-zone"); boite.appendChild(zone);
    var bulle = el("div", "st-bulle"); bulle.hidden = true; zone.appendChild(bulle);
    var t = tranches();
    function dessiner() {
      Array.prototype.forEach.call(zone.querySelectorAll("svg"), function (x) { x.remove(); });
      var W = Math.max(320, zone.clientWidth || 800), H = hauteur || 260, gL = 44, gD = 12, gH = 12, gB = 28;
      var vis = series.filter(function (s) { return !s.cache; });
      var max = arrondiHaut(Math.max.apply(null, [1].concat(vis.map(function (s) { return Math.max.apply(null, s.valeurs); }))));
      var n = t.length, dx = (W - gL - gD) / Math.max(1, n - 1);
      var X = function (i) { return gL + i * dx; }, Y = function (v) { return gH + (H - gH - gB) * (1 - v / max); };
      var s = sv("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "st-svg", role: "img", "aria-label": series.map(function (x) { return x.nom; }).join(", ") });
      // des graduations rondes : 0, 1, 2… pour les petits nombres, sinon 4 ou 5 paliers entiers
      var premier = String(max).charAt(0), paliers = max <= 5 ? max : premier === "2" ? 4 : 5;
      for (var k = 0; k <= paliers; k++) {
        var vy = max * k / paliers, y = Y(vy);
        s.appendChild(sv("line", { x1: gL, x2: W - gD, y1: y, y2: y, class: "st-grille-ligne" }));
        var tx = sv("text", { x: gL - 8, y: y + 4, "text-anchor": "end", class: "st-axe" }); tx.textContent = fr(vy); s.appendChild(tx);
      }
      var pasX = Math.max(1, Math.ceil(n / 7));
      for (var i = 0; i < n; i += pasX) { var tt = sv("text", { x: X(i), y: H - 8, "text-anchor": i === 0 ? "start" : "middle", class: "st-axe" }); tt.textContent = etiquette(t[i]); s.appendChild(tt); }
      vis.forEach(function (se, idx) {
        var d = se.valeurs.map(function (v, j) { return (j ? "L" : "M") + X(j).toFixed(1) + " " + Y(v).toFixed(1); }).join(" ");
        if (idx === 0) {
          var gid = "g" + Math.random().toString(36).slice(2);
          var defs = sv("defs", {}), lg = sv("linearGradient", { id: gid, x1: "0", y1: "0", x2: "0", y2: "1" });
          lg.appendChild(sv("stop", { offset: "0", "stop-color": se.couleur, "stop-opacity": ".22" })); lg.appendChild(sv("stop", { offset: "1", "stop-color": se.couleur, "stop-opacity": "0" }));
          defs.appendChild(lg); s.appendChild(defs);
          s.appendChild(sv("path", { d: d + " L" + X(n - 1) + " " + Y(0) + " L" + X(0) + " " + Y(0) + " Z", fill: "url(#" + gid + ")" }));
        }
        s.appendChild(sv("path", { d: d, fill: "none", stroke: se.couleur, "stroke-width": "2.2", "stroke-linejoin": "round", "stroke-linecap": "round" }));
      });
      var repere = sv("line", { x1: 0, x2: 0, y1: gH, y2: H - gB, class: "st-repere", visibility: "hidden" }); s.appendChild(repere);
      var points = vis.map(function (se) { var c = sv("circle", { r: 4, fill: "#fff", stroke: se.couleur, "stroke-width": 2, visibility: "hidden" }); s.appendChild(c); return c; });
      var capte = sv("rect", { x: gL, y: 0, width: W - gL - gD, height: H, fill: "transparent" }); s.appendChild(capte);
      function survol(ev) {
        var r = s.getBoundingClientRect(), x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
        var i = Math.max(0, Math.min(n - 1, Math.round((x - gL) / dx)));
        repere.setAttribute("x1", X(i)); repere.setAttribute("x2", X(i)); repere.setAttribute("visibility", "visible");
        bulle.textContent = ""; bulle.appendChild(el("b", null, P > 92 ? etiquette(t[i]) + " → " + new Date(t[i].fin + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : new Date(t[i].fin + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" })));
        vis.forEach(function (se, j) {
          points[j].setAttribute("cx", X(i)); points[j].setAttribute("cy", Y(se.valeurs[i])); points[j].setAttribute("visibility", "visible");
          var l = el("span"); var p = el("i"); p.style.background = se.couleur; l.appendChild(p); l.appendChild(document.createTextNode(se.nom + " : ")); l.appendChild(el("b", null, fr(se.valeurs[i]))); bulle.appendChild(l);
        });
        bulle.hidden = false;
        var bx = X(i) + 14; if (bx + 200 > W) bx = X(i) - 214; bulle.style.left = bx + "px"; bulle.style.top = "10px";
      }
      capte.addEventListener("mousemove", survol); capte.addEventListener("touchstart", survol, { passive: true });
      capte.addEventListener("mouseleave", function () { bulle.hidden = true; repere.setAttribute("visibility", "hidden"); points.forEach(function (p) { p.setAttribute("visibility", "hidden"); }); });
      zone.appendChild(s);
    }
    requestAnimationFrame(dessiner);
    redessins.push(dessiner);
  }
  function anneau(parent, parts) {
    var tot = parts.reduce(function (a, p) { return a + p.n; }, 0);
    var b = el("div", "st-anneau"); parent.appendChild(b);
    var s = sv("svg", { viewBox: "0 0 120 120", class: "st-anneau-svg", role: "img", "aria-label": parts.map(function (p) { return p.nom + " " + p.n; }).join(", ") });
    var r = 46, circ = 2 * Math.PI * r, debut = 0;
    s.appendChild(sv("circle", { cx: 60, cy: 60, r: r, fill: "none", stroke: "#f1e6dc", "stroke-width": 16 }));
    parts.forEach(function (p, i) {
      if (!p.n) return;
      var long = p.n / tot * circ;
      s.appendChild(sv("circle", { cx: 60, cy: 60, r: r, fill: "none", stroke: p.couleur || COUL[i % COUL.length], "stroke-width": 16, "stroke-dasharray": long + " " + (circ - long), "stroke-dashoffset": -debut, transform: "rotate(-90 60 60)" }));
      debut += long;
    });
    var t1 = sv("text", { x: 60, y: 58, "text-anchor": "middle", class: "st-anneau-total" }); t1.textContent = fr(tot); s.appendChild(t1);
    var t2 = sv("text", { x: 60, y: 74, "text-anchor": "middle", class: "st-axe" }); t2.textContent = "au total"; s.appendChild(t2);
    b.appendChild(s);
    var ul = el("ul", "st-anneau-legende");
    parts.forEach(function (p, i) { var li = el("li"); var c = el("i"); c.style.background = p.couleur || COUL[i % COUL.length]; li.appendChild(c); li.appendChild(el("span", null, p.nom)); li.appendChild(el("b", null, fr(p.n))); li.appendChild(el("small", null, pct(p.n, tot) + " %")); ul.appendChild(li); });
    b.appendChild(ul);
  }
  function liste(parent, items, total, couleur, colonne) {
    var b = el("div", "st-liste"); parent.appendChild(b);
    var tete = el("div", "st-liste-tete"); tete.appendChild(el("span", null, colonne || "")); tete.appendChild(el("span", null, "Nombre")); b.appendChild(tete);
    if (!items.length) { b.appendChild(el("p", "st-vide", "Pas encore de donnée sur cette période.")); return; }
    var max = Math.max.apply(null, items.map(function (x) { return x.n; }));
    items.forEach(function (x) {
      var l = el("div", "st-liste-ligne");
      var barre = el("i"); barre.style.width = Math.max(1.5, x.n / max * 100) + "%"; if (couleur) barre.style.background = couleur; l.appendChild(barre);
      l.appendChild(el("span", null, x.nom));
      var v = el("b", null, fr(x.n)); if (total) v.appendChild(el("small", null, " " + pct(x.n, total) + " %")); l.appendChild(v);
      b.appendChild(l);
    });
  }
  function entonnoir(parent, etapes, couleur) {
    var b = el("div", "st-entonnoir"); parent.appendChild(b);
    var premier = etapes[0][1] || 0;
    etapes.forEach(function (e, i) {
      var col = el("div", "st-et");
      col.appendChild(el("b", null, fr(e[1])));
      col.appendChild(el("small", null, i ? pct(e[1], premier) + " % du départ" : "point de départ"));
      var h = el("div", "st-et-barre"); var r = el("i"), part = (premier ? Math.max(3, e[1] / premier * 100) : 3) + "%"; r.style.height = part; r.style.setProperty("--l", part); if (couleur) r.style.background = couleur; h.appendChild(r); col.appendChild(h);
      col.appendChild(el("span", null, e[0]));
      b.appendChild(col);
    });
  }
  function tableau(parent, colonnes, lignes, vide) {
    var w = el("div", "st-tableau-boite"); parent.appendChild(w);
    if (!lignes.length) { w.appendChild(el("p", "st-vide", vide || "Rien sur cette période.")); return; }
    var t = el("table", "st-tableau"), th = el("thead"), tr = el("tr");
    colonnes.forEach(function (c) { var x = el("th", c[1] ? "st-num" : null, c[0]); tr.appendChild(x); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el("tbody");
    lignes.forEach(function (l) { var r = el("tr"); l.forEach(function (v, i) { r.appendChild(el("td", colonnes[i][1] ? "st-num" : null, v)); }); tb.appendChild(r); });
    t.appendChild(tb); w.appendChild(t);
  }

  /* -- les thèmes -- */
  var redessins = [];
  function ensemble(g) {
    var p = periode(), u = D.comptes, pr = D.profils, s = D.structures, ca = D.candidatures, de = D.demandes;
    var nb = function (l, champ, d, f) { return compte(l, function (x) { return dans(x[champ], d, f); }); };
    var vues = function (types, d, f) { return D.vues.filter(function (v) { return types.indexOf(v.type) >= 0 && v.jour >= d && v.jour <= f; }).reduce(function (a, v) { return a + v.n; }, 0); };
    chiffre(g, { titre: "Nouveaux comptes", valeur: nb(u, "cree_le", p.debut, p.fin), avant: nb(u, "cree_le", p.avDebut, p.avFin), serie: serie(u, "cree_le"), couleur: COUL[0] });
    chiffre(g, { titre: "Profils d'animateurs créés", valeur: nb(pr, "cree_le", p.debut, p.fin), avant: nb(pr, "cree_le", p.avDebut, p.avFin), serie: serie(pr, "cree_le"), couleur: COUL[1] });
    chiffre(g, { titre: "Structures inscrites", valeur: nb(s, "cree_le", p.debut, p.fin), avant: nb(s, "cree_le", p.avDebut, p.avFin), serie: serie(s, "cree_le"), couleur: COUL[3] });
    chiffre(g, { titre: "Candidatures", valeur: nb(ca, "cree_le", p.debut, p.fin), avant: nb(ca, "cree_le", p.avDebut, p.avFin), serie: serie(ca, "cree_le"), couleur: COUL[2] });
    chiffre(g, { titre: "Demandes (annuaire inversé)", valeur: nb(de, "cree_le", p.debut, p.fin), avant: nb(de, "cree_le", p.avDebut, p.avFin), serie: serie(de, "cree_le"), couleur: COUL[4] });
    chiffre(g, { titre: "Vues des pages et des offres", valeur: vues(["page", "offre"], p.debut, p.fin), avant: vues(["page", "offre"], p.avDebut, p.avFin), serie: serieVues(["page", "offre"]), couleur: COUL[5] });

    var c1 = carte(g, "c8", "L'activité du site", "Inscriptions et actions, " + (P > 92 ? "semaine par semaine" : "jour par jour") + ". Cliquez une légende pour la masquer.");
    graphe(c1, [{ nom: "Comptes", valeurs: serie(u, "cree_le"), couleur: COUL[0] }, { nom: "Profils", valeurs: serie(pr, "cree_le"), couleur: COUL[1] },
                { nom: "Structures", valeurs: serie(s, "cree_le"), couleur: COUL[3] }, { nom: "Candidatures", valeurs: serie(ca, "cree_le"), couleur: COUL[2] }, { nom: "Demandes", valeurs: serie(de, "cree_le"), couleur: COUL[4] }], 300);

    var payees = s.filter(paye);
    var revenu = payees.reduce(function (a, x) { var base = x.fondatrice ? 39.5 : 79; return a + base + Math.max(0, (x.centres_payes || 1) - 1) * base / 2; }, 0);
    var c2 = carte(g, "c4", "Le revenu", "Abonnements en cours, centres compris");
    var r = el("div", "st-revenu");
    r.appendChild(el("b", null, euros(revenu))); r.appendChild(el("span", null, "par an · soit " + euros(revenu / 12) + " par mois"));
    c2.appendChild(r);
    anneau(c2, [{ nom: "Tarif fondateur", n: compte(payees, function (x) { return x.fondatrice; }), couleur: COUL[0] }, { nom: "Tarif normal", n: compte(payees, function (x) { return !x.fondatrice; }), couleur: COUL[1] },
                { nom: "Inscrites sans paiement", n: compte(s, function (x) { return !paye(x); }), couleur: "#e8ddd0" }]);

    var c3 = carte(g, "c6", "Le parcours des animateurs", "Du compte à l'action : où ils s'arrêtent");
    var ont = function (l) { var o = {}; l.forEach(function (x) { o[x.candidat_id] = 1; }); return Object.keys(o).length; };
    entonnoir(c3, [["Profil créé", pr.length], ["Visible", compte(pr, function (x) { return x.publie; })], ["Avec CV", compte(pr, function (x) { return x.cv_nom; })], ["A postulé", ont(ca)], ["A fait une demande", ont(de)]], COUL[1]);
    var avecOffre = {}; D.offres.filter(enLigne).forEach(function (x) { avecOffre[x.structure_id] = 1; });
    var c4 = carte(g, "c6", "Le parcours des structures", "De l'inscription à la première offre");
    entonnoir(c4, [["Inscrite", s.length], ["A payé", payees.length], ["Vérifiée", compte(s, function (x) { return x.verifiee; })], ["En ligne", compte(s, function (x) { return x.verifiee && paye(x); })], ["Avec une offre", Object.keys(avecOffre).length]], COUL[3]);

    var idsP = {}, idsS = {}; pr.forEach(function (x) { idsP[x.id] = 1; }); s.forEach(function (x) { idsS[x.id] = 1; });
    var c5 = carte(g, "c4", "Les comptes", fr(u.length) + " au total");
    anneau(c5, [{ nom: "Animateurs", n: compte(u, function (x) { return idsP[x.id] && !idsS[x.id]; }) }, { nom: "Structures", n: compte(u, function (x) { return idsS[x.id] && !idsP[x.id]; }) },
                { nom: "Les deux", n: compte(u, function (x) { return idsP[x.id] && idsS[x.id]; }) }, { nom: "Sans profil", n: compte(u, function (x) { return !idsP[x.id] && !idsS[x.id]; }), couleur: "#e8ddd0" }]);
    var c6 = carte(g, "c4", "Où sont les animateurs", "Les départements des profils");
    liste(c6, repartir(pr, "departement", nomDep, 8), pr.length, COUL[1], "Département");
    var c7 = carte(g, "c4", "Où sont les structures", "Les départements des structures");
    liste(c7, repartir(s, "departement", nomDep, 8), s.length, COUL[3], "Département");
  }

  function animateurs(g) {
    var p = periode(), pr = D.profils, n = pr.length;
    var ages = pr.filter(function (x) { return x.annee_naissance; }).map(function (x) { return auj.getFullYear() - x.annee_naissance; });
    chiffre(g, { titre: "Profils", valeur: n, aide: compte(pr, function (x) { return dans(x.cree_le, p.debut, p.fin); }) + " créés sur la période", serie: serie(pr, "cree_le"), couleur: COUL[1] });
    chiffre(g, { titre: "Visibles des structures", valeur: pct(compte(pr, function (x) { return x.publie; }), n), format: function (v) { return v + " %"; }, aide: compte(pr, function (x) { return x.publie; }) + " profils sur " + n });
    chiffre(g, { titre: "Avec un CV", valeur: pct(compte(pr, function (x) { return x.cv_nom; }), n), format: function (v) { return v + " %"; }, aide: compte(pr, function (x) { return x.cv_nom; }) + " profils" });
    chiffre(g, { titre: "Âge moyen", valeur: ages.length ? Math.round(ages.reduce(function (a, v) { return a + v; }, 0) / ages.length * 10) / 10 : 0, format: function (v) { return v ? fr(v) + " ans" : "–"; }, aide: ages.length + " profils avec l'année de naissance" });
    chiffre(g, { titre: "Mineurs (16-17 ans)", valeur: pct(ages.filter(function (a) { return a < 18; }).length, ages.length), format: function (v) { return v + " %"; }, aide: ages.filter(function (a) { return a < 18; }).length + " profils" });
    chiffre(g, { titre: "Prêts à bouger", valeur: pct(compte(pr, function (x) { return (x.mobilite || []).length; }), n), format: function (v) { return v + " %"; }, aide: "travaillent aussi hors de leur département" });
    var c1 = carte(g, "c8", "Les profils créés", "Avec ceux qui ajoutent un CV");
    graphe(c1, [{ nom: "Profils créés", valeurs: serie(pr, "cree_le"), couleur: COUL[1] }, { nom: "Avec CV", valeurs: serie(pr, "cree_le", function (x) { return x.cv_nom; }), couleur: COUL[2] }]);
    var c2 = carte(g, "c4", "Les âges");
    anneau(c2, ["16-17 ans", "18-20 ans", "21-25 ans", "26-35 ans", "36 ans et plus"].map(function (t, i) {
      var b = [[16, 17], [18, 20], [21, 25], [26, 35], [36, 99]][i]; return { nom: t, n: ages.filter(function (a) { return a >= b[0] && a <= b[1]; }).length };
    }));
    liste(carte(g, "c4", "Les diplômes"), repartir(pr, "diplomes", function (k) { return lib("diplomes", k); }), n, COUL[1], "Diplôme");
    liste(carte(g, "c4", "Ce qu'ils cherchent"), repartir(pr, "recherche", function (k) { return PERIODES[k] || lib("recherche", k); }), n, COUL[1], "Recherche");
    liste(carte(g, "c4", "Les qualifications"), repartir(pr, function (x) { return (x.qualifications || []).map(function (q) { return q.q; }); }, function (k) { return (E.L.qualifs || {})[k] || k; }), n, COUL[1], "Qualification");
    liste(carte(g, "c6", "Les départements", "Où habitent les animateurs"), repartir(pr, "departement", nomDep, 12), n, COUL[1], "Département");
    var der = pr.slice().sort(function (a, b) { return (b.cree_le || "").localeCompare(a.cree_le || ""); }).slice(0, 10);
    tableau(carte(g, "c6", "Les derniers profils"), [["Prénom"], ["Département"], ["Diplômes"], ["Créé le", 1]],
      der.map(function (x) { return [x.prenom || "?", nomDep(x.departement), (x.diplomes || []).map(function (d) { return lib("diplomes", d); }).join(", ") || "–", E.dateFr(iso(x.cree_le))]; }));
  }

  function structures(g) {
    var p = periode(), s = D.structures, payees = s.filter(paye);
    var revenu = payees.reduce(function (a, x) { var base = x.fondatrice ? 39.5 : 79; return a + base + Math.max(0, (x.centres_payes || 1) - 1) * base / 2; }, 0);
    chiffre(g, { titre: "Structures inscrites", valeur: s.length, aide: compte(s, function (x) { return dans(x.cree_le, p.debut, p.fin); }) + " sur la période", serie: serie(s, "cree_le"), couleur: COUL[3] });
    chiffre(g, { titre: "Abonnements payés", valeur: payees.length, aide: pct(payees.length, s.length) + " % des inscrites" });
    chiffre(g, { titre: "Vérifiées et en ligne", valeur: compte(s, function (x) { return x.verifiee && paye(x); }), aide: compte(s, function (x) { return paye(x) && !x.verifiee; }) + " en attente de vérification" });
    chiffre(g, { titre: "Revenu annuel", valeur: revenu, format: euros, aide: euros(payees.length ? revenu / payees.length : 0) + " par structure payée" });
    chiffre(g, { titre: "Places fondatrices prises", valeur: compte(s, function (x) { return x.fondatrice; }), aide: "tarif à 39,50 € à vie" });
    chiffre(g, { titre: "Centres en plus", valeur: payees.reduce(function (a, x) { return a + Math.max(0, (x.centres_payes || 1) - 1); }, 0), aide: "payés à moitié prix" });
    var c1 = carte(g, "c8", "Les inscriptions", "Les nouvelles structures sur la période");
    graphe(c1, [{ nom: "Structures inscrites", valeurs: serie(s, "cree_le"), couleur: COUL[3] }]);
    anneau(carte(g, "c4", "Les types de structures"), repartir(s, "type", function (k) { return lib("types", k); }, 7));
    // le classement par vues, sur la période
    var vs = {};
    D.vues_structures.forEach(function (v) { if (v.jour < p.debut || v.jour > p.fin) return; var o = vs[v.structure_id] = vs[v.structure_id] || { page: 0, offre: 0, clic: 0 }; if (v.type === "page") o.page += v.n; else if (v.type === "offre") o.offre += v.n; else o.clic += v.n; });
    var classe = s.map(function (x) { var v = vs[x.id] || { page: 0, offre: 0, clic: 0 }; return { x: x, v: v, t: v.page + v.offre }; }).sort(function (a, b) { return b.t - a.t; }).slice(0, 12);
    tableau(carte(g, "c8", "Les structures les plus vues", "Sur la période choisie"), [["Structure"], ["Département"], ["Vues de la page", 1], ["Vues des offres", 1], ["Clics", 1], ["Taux de clic", 1], ["Offres en ligne", 1]],
      classe.filter(function (c) { return c.t || c.v.clic; }).map(function (c) {
        return [c.x.nom, nomDep(c.x.departement), fr(c.v.page), fr(c.v.offre), fr(c.v.clic), c.t ? pct(c.v.clic, c.t) + " %" : "–", fr(compte(D.offres, function (o) { return o.structure_id === c.x.id && enLigne(o); }))];
      }), "Pas encore de vue sur cette période.");
    liste(carte(g, "c4", "Les départements"), repartir(s, "departement", nomDep, 10), s.length, COUL[3], "Département");
  }

  function offres(g) {
    var p = periode(), o = D.offres, ca = D.candidatures;
    var caP = ca.filter(function (x) { return dans(x.cree_le, p.debut, p.fin); });
    var remu = o.filter(function (x) { return x.remuneration_montant && (x.remuneration_unite || "jour") === "jour"; }).map(function (x) { return Number(x.remuneration_montant); });
    chiffre(g, { titre: "Offres en ligne", valeur: compte(o, enLigne), aide: o.length + " offres au total" });
    chiffre(g, { titre: "Offres publiées", valeur: compte(o, function (x) { return dans(x.cree_le, p.debut, p.fin); }), avant: compte(o, function (x) { return dans(x.cree_le, p.avDebut, p.avFin); }), serie: serie(o, "cree_le"), couleur: COUL[0] });
    chiffre(g, { titre: "Candidatures", valeur: caP.length, avant: compte(ca, function (x) { return dans(x.cree_le, p.avDebut, p.avFin); }), serie: serie(ca, "cree_le"), couleur: COUL[2] });
    chiffre(g, { titre: "Candidatures par offre", valeur: compte(o, enLigne) ? Math.round(ca.length / Math.max(1, o.length) * 10) / 10 : 0, aide: "en moyenne, depuis le début" });
    chiffre(g, { titre: "Taux de réponse positive", valeur: pct(compte(ca, function (x) { return x.statut === "retenue"; }), ca.length), format: function (v) { return v + " %"; }, aide: "candidatures retenues" });
    chiffre(g, { titre: "Rémunération moyenne", valeur: remu.length ? remu.reduce(function (a, v) { return a + v; }, 0) / remu.length : 0, format: function (v) { return v ? euros(Math.round(v * 100) / 100) + " / jour" : "–"; }, aide: remu.length ? "de " + euros(Math.min.apply(null, remu)) + " à " + euros(Math.max.apply(null, remu)) : "aucune offre avec un montant" });
    var c1 = carte(g, "c8", "Offres et candidatures");
    graphe(c1, [{ nom: "Candidatures", valeurs: serie(ca, "cree_le"), couleur: COUL[2] }, { nom: "Offres publiées", valeurs: serie(o, "cree_le"), couleur: COUL[0] }]);
    anneau(carte(g, "c4", "Les réponses aux candidatures"), ["envoyee", "vue", "retenue", "non-retenue"].map(function (k, i) { return { nom: STATUTS[k], n: compte(ca, function (x) { return x.statut === k; }), couleur: ["#d6a400", "#2f6f73", "#3f5b4b", "#d61f35"][i] }; }));
    liste(carte(g, "c4", "Par contrat"), repartir(o, "contrat", function (k) { return lib("contrats", k); }), o.length, COUL[0], "Contrat");
    liste(carte(g, "c4", "Par poste"), repartir(o, "poste", function (k) { return lib("postes", k); }), o.length, COUL[0], "Poste");
    var nbCa = {}; ca.forEach(function (x) { nbCa[x.offre_id] = (nbCa[x.offre_id] || 0) + 1; });
    var vO = {}; D.vues_structures.forEach(function (v) { if (v.type === "offre" && v.jour >= p.debut && v.jour <= p.fin) vO[v.offre_id] = (vO[v.offre_id] || 0) + v.n; });
    var nomSt = {}; D.structures.forEach(function (x) { nomSt[x.id] = x.nom; });
    tableau(carte(g, "c4", "Les offres qui marchent", "Vues sur la période, candidatures depuis la publication"), [["Offre"], ["Vues", 1], ["Candidatures", 1]],
      o.slice().sort(function (a, b) { return ((vO[b.id] || 0) + 10 * (nbCa[b.id] || 0)) - ((vO[a.id] || 0) + 10 * (nbCa[a.id] || 0)); }).slice(0, 8)
        .map(function (x) { return [x.intitule + (nomSt[x.structure_id] ? " · " + nomSt[x.structure_id] : ""), fr(vO[x.id] || 0), fr(nbCa[x.id] || 0)]; }));
  }

  function demandes(g) {
    var p = periode(), d = D.demandes, dP = d.filter(function (x) { return dans(x.cree_le, p.debut, p.fin); });
    var envoyees = compte(d, function (x) { return (x.destinataires || []).length; });
    chiffre(g, { titre: "Demandes", valeur: dP.length, avant: compte(d, function (x) { return dans(x.cree_le, p.avDebut, p.avFin); }), serie: serie(d, "cree_le"), couleur: COUL[4] });
    chiffre(g, { titre: "Envoyées à une structure", valeur: pct(envoyees, d.length), format: function (v) { return v + " %"; }, aide: envoyees + " demandes sur " + d.length });
    chiffre(g, { titre: "En attente", valeur: d.length - envoyees, aide: "aucune structure abonnée dans leur zone" });
    chiffre(g, { titre: "Structures prévenues", valeur: d.reduce(function (a, x) { return a + (x.notifiees || []).length; }, 0), aide: "e-mails envoyés aux structures" });
    chiffre(g, { titre: "Avec un message", valeur: pct(compte(d, function (x) { return x.message; }), d.length), format: function (v) { return v + " %"; }, aide: "écrivent quelques lignes" });
    chiffre(g, { titre: "Toute la région", valeur: pct(compte(d, function (x) { return (x.zone || []).length > 1; }), d.length), format: function (v) { return v + " %"; }, aide: "acceptent de bouger dans leur région" });
    graphe(carte(g, "c8", "Les demandes", "L'annuaire inversé sur la période"), [{ nom: "Demandes", valeurs: serie(d, "cree_le"), couleur: COUL[4] }, { nom: "Restées sans structure", valeurs: serie(d, "cree_le", function (x) { return !(x.destinataires || []).length; }), couleur: "#c9b8a8" }]);
    anneau(carte(g, "c4", "Les postes demandés"), repartir(d, "poste", function (k) { return POSTES_D[k] || k; }, 6));
    liste(carte(g, "c4", "Les départements"), repartir(d, "departement", nomDep, 10), d.length, COUL[4], "Département");
    liste(carte(g, "c4", "Les périodes"), repartir(d, "periodes", function (k) { return PERIODES[k] || k; }), d.length, COUL[4], "Période");
    var att = d.filter(function (x) { return !(x.destinataires || []).length; }).slice(0, 10);
    tableau(carte(g, "c4", "À démarcher", "Les demandes sans structure : allez chercher une structure dans ces zones"), [["Poste"], ["Où"], ["Le", 1]],
      att.map(function (x) { return [POSTES_D[x.poste] || x.poste, (x.ville ? x.ville + ", " : "") + nomDep(x.departement), E.dateFr(iso(x.cree_le))]; }), "Toutes les demandes ont trouvé une structure.");
  }

  function trafic(g) {
    var p = periode();
    var vues = function (types, d, f) { return D.vues.filter(function (v) { return types.indexOf(v.type) >= 0 && v.jour >= d && v.jour <= f; }).reduce(function (a, v) { return a + v.n; }, 0); };
    var k = function (titre, types, c) { chiffre(g, { titre: titre, valeur: vues(types, p.debut, p.fin), avant: vues(types, p.avDebut, p.avFin), serie: serieVues(types), couleur: c }); };
    k("Vues des pages de structures", ["page"], COUL[0]);
    k("Vues des offres", ["offre"], COUL[3]);
    k("Clics « Postuler »", ["clic_candidater"], COUL[2]);
    k("Clics e-mail", ["clic_email"], COUL[4]);
    k("Clics vers les sites", ["clic_site"], COUL[1]);
    var tot = vues(["page", "offre"], p.debut, p.fin), clics = vues(["clic_candidater", "clic_email", "clic_site"], p.debut, p.fin);
    chiffre(g, { titre: "Taux de clic", valeur: pct(clics, tot), format: function (v) { return v + " %"; }, aide: fr(clics) + " clics pour " + fr(tot) + " vues" });
    graphe(carte(g, "c12", "Les vues et les clics", "Sur les pages des structures et des offres. Les visites de tout le site et les recherches Google sont sur la page des chiffres publics."),
      [{ nom: "Vues des pages", valeurs: serieVues(["page"]), couleur: COUL[0] }, { nom: "Vues des offres", valeurs: serieVues(["offre"]), couleur: COUL[3] }, { nom: "Clics", valeurs: serieVues(["clic_candidater", "clic_email", "clic_site"]), couleur: COUL[2] }], 320);
  }

  var THEMES = [["ensemble", "Vue d'ensemble", ensemble], ["animateurs", "Animateurs", animateurs], ["structures", "Structures", structures], ["offres", "Offres et candidatures", offres], ["demandes", "Demandes", demandes], ["trafic", "Vues et clics", trafic]];
  function rendre(c, donnees, espace) {
    if (donnees) D = donnees; if (espace) E = espace; if (c) racine = c;
    redessins = [];
    racine.textContent = ""; racine.classList.add("st");
    var tete = el("div", "st-tete");
    var t = el("div"); t.appendChild(el("h2", null, "Statistiques")); t.appendChild(el("p", "st-maj", "Données à jour à " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + " · comparées à la période précédente de même durée"));
    tete.appendChild(t);
    var per = el("div", "st-periodes"); per.setAttribute("role", "group"); per.setAttribute("aria-label", "Période");
    [[7, "7 jours"], [30, "30 jours"], [90, "3 mois"], [365, "12 mois"]].forEach(function (x) {
      var b = el("button", null, x[1]); b.type = "button"; b.setAttribute("aria-pressed", x[0] === P ? "true" : "false");
      b.addEventListener("click", function () { P = x[0]; rendre(); }); per.appendChild(b);
    });
    tete.appendChild(per); racine.appendChild(tete);
    var nav = el("div", "st-themes"); nav.setAttribute("role", "tablist");
    THEMES.forEach(function (x) {
      var b = el("button", null, x[1]); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", x[0] === theme ? "true" : "false");
      b.addEventListener("click", function () { theme = x[0]; rendre(); }); nav.appendChild(b);
    });
    racine.appendChild(nav);
    var g = grille(racine);
    THEMES.filter(function (x) { return x[0] === theme; })[0][2](g);
  }
  var attente;
  window.addEventListener("resize", function () { clearTimeout(attente); attente = setTimeout(function () { redessins.forEach(function (f) { f(); }); }, 150); });
  window.FRA_STATS = { rendre: rendre };
})();

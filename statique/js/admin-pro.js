/* Fil Roug'Anim : les pages « pro » de l'administration, sur le modèle des tableaux de bord des applis pros :
   la vue d'ensemble, le QG des demandes, l'état de santé et les ventes. Elles complètent les listes et les
   statistiques d'admin.js, avec les mêmes données (admin_donnees) et l'état de santé (admin_sante).
   Ce qui vient des personnes est toujours écrit avec textContent. */
(function () {
  "use strict";
  var D = null, A = null, S = null, E = null;
  var DEPOT = "Pufu2/filrouganim";
  function $(id) { return document.getElementById(id); }
  function el(tag, classe, texte) { var e = document.createElement(tag); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e; }
  var auj = new Date(); auj.setHours(12, 0, 0, 0);
  var AUJ = auj.toISOString().slice(0, 10);
  function joursAvant(n) { var d = new Date(auj); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
  function iso(x) { return (x || "").slice(0, 10); }
  function fr(n) { return Number(n || 0).toLocaleString("fr-FR"); }
  function euros(n, sansCentimes) { return Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: sansCentimes ? 0 : 2, maximumFractionDigits: sansCentimes ? 0 : 2 }) + " €"; }
  function pct(a, b) { return b ? String(Math.round(a / b * 1000) / 10).replace(".", ",") + " %" : "–"; }
  function compte(l, f) { return l.filter(f).length; }
  function lib(liste, v) { try { return E.libelle(liste, v); } catch (e) { return v; } }
  function nomDep(c) { try { return E.nomDep(c); } catch (e) { return c; } }
  function paye(s) { return !!(s.abonnement_fin && s.abonnement_fin >= AUJ); }
  function prixAn(s) { var b = s.fondatrice ? 39.5 : 79; return b + Math.max(0, (s.centres_payes || 1) - 1) * b / 2; }
  function depuis(x) {
    if (!x) return "";
    var j = Math.round((auj - new Date(iso(x) + "T12:00:00")) / 864e5);
    return j <= 0 ? "aujourd'hui" : j === 1 ? "hier" : j < 31 ? "il y a " + j + " j" : "il y a " + Math.round(j / 30) + " mois";
  }
  function heure(x) { return new Date(x).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  var ICO = {
    euro: '<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10.5h9M4 13.5h9"/>', courbe: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    pct: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>', personne: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.9-3.8 3.6-5.6 7-5.6s6.1 1.8 7 5.6"/>',
    boite: '<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>', coeur: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    maison: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>', groupe: '<circle cx="9" cy="8" r="3"/><path d="M3 20c.8-3.4 3.2-5 6-5s5.2 1.6 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15c2.4 0 4.2 1.3 5 4"/>',
    offre: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>', avion: '<path d="M4 12l16-8-6 16-2-6z"/>',
    livre: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>', oeil: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    loupe: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>', coche: '<path d="M5 12l5 5 9-10"/>', alerte: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    lien: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    base: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', photo: '<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l2-3h4l2 3"/>',
    horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', google: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 5v4h-4"/>'
  };
  function ic(nom, classe) { var s = el("span", "ap-ic" + (classe ? " " + classe : "")); s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICO[nom] || ICO.coche) + "</svg>"; return s; }
  function vers(onglet) { var b = el("button", "ap-vers"); b.type = "button"; b.dataset.ongletVers = onglet; return b; }

  /* ---------- briques ---------- */
  function hero(c, sur, titre, em, texte, actions, cote) {
    var h = el("div", "ap-hero"), g = el("div", "ap-hero-t");
    var k = el("p", "ap-sur"); k.appendChild(ic("coeur", "ap-ic-mini")); k.appendChild(el("span", "ap-sur-pre", "Administration · ")); k.appendChild(document.createTextNode(sur)); g.appendChild(k);
    var t = el("h2"); t.appendChild(document.createTextNode(titre)); t.appendChild(el("em", null, em)); g.appendChild(t);
    if (texte) g.appendChild(el("p", "ap-hero-p", texte));
    if (actions && actions.length) { var a = el("div", "ap-hero-actions"); actions.forEach(function (x) { a.appendChild(x); }); g.appendChild(a); }
    h.appendChild(g); if (cote) h.appendChild(cote); c.appendChild(h);
  }
  function bouton(texte, onglet, plein, icone) {
    var b = vers(onglet); b.className = plein ? "ap-bouton" : "ap-lien"; if (icone) b.appendChild(ic(icone, "ap-ic-mini")); b.appendChild(document.createTextNode(texte)); return b;
  }
  function carte(c, titre, sous, classe) {
    var k = el("section", "ap-carte" + (classe ? " " + classe : ""));
    if (titre) { var h = el("div", "ap-carte-h"); h.appendChild(el("h3", null, titre)); if (sous) h.appendChild(el("span", "ap-carte-sous", sous)); k.appendChild(h); }
    c.appendChild(k); return k;
  }
  function grille(c, classe) { var g = el("div", "ap-grille " + (classe || "")); c.appendChild(g); return g; }
  function kpi(c, icone, titre, valeur, sous, ton) {
    var k = el("div", "ap-kpi" + (ton ? " ap-kpi-" + ton : "")); k.appendChild(ic(icone));
    var t = el("div"); t.appendChild(el("small", null, titre)); t.appendChild(el("b", null, valeur)); if (sous) t.appendChild(el("span", null, sous));
    k.appendChild(t); c.appendChild(k); return k;
  }
  function evol(n, avant) {
    if (!avant && !n) return ["stable", ""];
    if (!avant) return ["nouveau", "ap-hausse"];
    var v = Math.round((n - avant) / avant * 100);
    return [(v > 0 ? "+" : "") + v + " % vs période d'avant", v > 0 ? "ap-hausse" : v < 0 ? "ap-baisse" : ""];
  }
  function barresH(c, lignes, total) {
    var ul = el("ul", "ap-barres"), max = Math.max.apply(null, lignes.map(function (l) { return l[1]; }).concat([1]));
    lignes.forEach(function (l, i) {
      var li = el("li"); li.appendChild(el("span", "ap-b-nom", l[0]));
      var b = el("span", "ap-b-barre"), r = el("i"); r.style.width = Math.max(2, l[1] / max * 100) + "%"; if (l[2]) r.style.background = l[2]; b.appendChild(r); li.appendChild(b);
      li.appendChild(el("b", null, fr(l[1]))); ul.appendChild(li);
    });
    if (!lignes.length) ul.appendChild(el("li", "ap-vide", "Rien pour l'instant."));
    c.appendChild(ul);
  }
  // une courbe en SVG : series = [{points: [n…], classe, nom}], etiquettes = [texte…]
  function courbe(c, series, etiquettes, hauteur) {
    var W = 600, H = hauteur || 150, n = etiquettes.length, max = 1;
    series.forEach(function (s) { s.points.forEach(function (v) { max = Math.max(max, v); }); });
    var x = function (i) { return n > 1 ? 8 + i * (W - 16) / (n - 1) : W / 2; }, y = function (v) { return H - 18 - v / max * (H - 34); };
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" class="ap-svg" role="img" aria-label="' + series.map(function (s) { return s.nom; }).join(", ") + '">';
    for (var g = 0; g <= 3; g++) { var gy = 16 + g * (H - 34) / 3; svg += '<line x1="0" x2="' + W + '" y1="' + gy + '" y2="' + gy + '" class="ap-grid"/>'; }
    series.forEach(function (s) {
      var d = s.points.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
      if (s.aire) svg += '<path class="ap-aire" d="' + d + " L" + x(s.points.length - 1).toFixed(1) + " " + (H - 18) + " L" + x(0) + " " + (H - 18) + 'Z"/>';
      svg += '<path class="' + s.classe + '" d="' + d + '"/>';
      if (s.points_visibles) s.points.forEach(function (v, i) { svg += '<circle class="ap-pt" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.5"><title>' + etiquettes[i] + " : " + v + "</title></circle>"; });
    });
    svg += "</svg>";
    var f = el("div", "ap-courbe"); f.innerHTML = svg;
    var ax = el("div", "ap-axe"), pas = Math.max(1, Math.ceil(n / 7));
    etiquettes.forEach(function (t, i) { if (i % pas === 0 || i === n - 1) { var s = el("span", null, t); s.style.left = (x(i) / W * 100) + "%"; ax.appendChild(s); } });
    f.appendChild(ax); c.appendChild(f);
  }
  function legende(c, items) { var p = el("p", "ap-legende"); items.forEach(function (x) { var s = el("span"); var i = el("i", x[1]); s.appendChild(i); s.appendChild(document.createTextNode(x[0])); p.appendChild(s); }); c.appendChild(p); }
  function etiquette(texte, ton) { return el("span", "ap-etiq" + (ton ? " ap-etiq-" + ton : ""), texte); }

  /* ---------- données communes ---------- */
  function types() {
    var pr = {}, st = {};
    D.profils.forEach(function (p) { pr[p.id] = p; }); D.structures.forEach(function (s) { st[s.id] = s; });
    return D.comptes.filter(function (c) { return D.admins.indexOf(c.id) < 0; }).map(function (c) {
      return { c: c, p: pr[c.id], s: st[c.id], type: st[c.id] ? "structure" : pr[c.id] ? "animateur" : "aucun" };
    });
  }
  function nomDe(t) { return t.s ? t.s.nom || "Structure sans nom" : t.p ? t.p.prenom || "Animateur" : (t.c.email || "").replace(/@.*/, "@…"); }
  function aTraiter() {
    var l = [];
    var dem = compte(D.demandes, function (d) { return (d.suivi || "a_traiter") === "a_traiter"; });
    var verif = compte(D.structures, function (s) { return !s.verifiee; });
    var cand = compte(D.candidatures, function (x) { return x.statut === "envoyee" && iso(x.cree_le) <= joursAvant(3); });
    if (dem) l.push([dem, dem > 1 ? "demandes d'animateurs à traiter" : "demande d'animateur à traiter", "qg"]);
    if (verif) l.push([verif, verif > 1 ? "structures à vérifier" : "structure à vérifier", "afaire"]);
    if (cand) l.push([cand, cand > 1 ? "candidatures sans réponse depuis 3 jours" : "candidature sans réponse depuis 3 jours", "afaire"]);
    if (S && S.emails && S.emails.en_attente && S.emails.plus_ancien && (Date.now() - new Date(S.emails.plus_ancien)) > 3 * 3600e3) l.push([S.emails.en_attente, "e-mails d'alerte pas encore partis", "sante"]);
    if (S && S.offres_expirees_publiees) l.push([S.offres_expirees_publiees, "offres expirées encore publiées", "offres"]);
    return l;
  }
  function boiteATraiter(titre) {
    var b = el("div", "ap-hero-cote"); b.appendChild(el("p", "ap-cote-t", titre || "À traiter"));
    var l = aTraiter();
    if (!l.length) { var ok = el("p", "ap-ok"); ok.appendChild(ic("coche", "ap-ic-ok")); ok.appendChild(document.createTextNode("Rien en attente, tout est à jour.")); b.appendChild(ok); }
    l.forEach(function (x) { var r = vers(x[2]); r.className = "ap-cote-ligne"; r.appendChild(el("span", null, x[1])); r.appendChild(el("b", null, String(x[0]))); r.appendChild(el("i", null, "→")); b.appendChild(r); });
    return b;
  }

  /* ---------- 1. la vue d'ensemble ---------- */
  var periode = 7, filtreMembres = "tous";
  function accueil() {
    var c = $("ad-accueil"); if (!c) return; c.textContent = "";
    var T = types(), st = D.structures, payees = st.filter(paye);
    var an = payees.reduce(function (a, s) { return a + prixAn(s); }, 0);
    var debutMois = AUJ.slice(0, 8) + "01", ceMois = compte(T, function (t) { return iso(t.c.cree_le) >= debutMois; });
    var date = auj.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    var nAt = compte(D.demandes, function (d) { return (d.suivi || "a_traiter") === "a_traiter"; });
    hero(c, date, "Bonjour, ", nAt ? nAt + " demande" + (nAt > 1 ? "s" : "") + " à traiter" : "tout est à jour",
      fr(D.comptes.length) + " comptes (le vôtre compris) : " + compte(T, function (t) { return t.type === "animateur"; }) + " animateurs, " + st.length + " structures dont " + payees.length + " payée" + (payees.length > 1 ? "s" : "") + ", +" + ceMois + " ce mois-ci.",
      [bouton("Ouvrir le QG demandes", "qg", true, "boite"), bouton("Structures", "structures"), bouton("Ventes", "ventes")], boiteATraiter());
    // les revenus
    var g = grille(c, "ap-g4");
    kpi(g, "euro", "Revenu mensuel", euros(an / 12), payees.length + " abonnement" + (payees.length > 1 ? "s" : "") + " · " + compte(payees, function (s) { return s.fondatrice; }) + " au tarif fondateur");
    kpi(g, "courbe", "Revenu annuel", euros(an), "abonnements en cours, centres compris");
    kpi(g, "pct", "Conversion", pct(payees.length, st.length), payees.length + " payante" + (payees.length > 1 ? "s" : "") + " sur " + st.length + " structure" + (st.length > 1 ? "s" : "") + " inscrite" + (st.length > 1 ? "s" : ""));
    kpi(g, "personne", "Par abonné", payees.length ? euros(an / 12 / payees.length) : "–", "par mois");
    // le dernier relevé des visites
    var au = S && S.audience && S.audience.donnees || {}, maj = S && S.audience && S.audience.maj;
    var r = carte(c, null, null, "ap-releve");
    var rh = el("div", "ap-releve-h"); var pt = el("span", "ap-point"); rh.appendChild(pt);
    rh.appendChild(el("b", null, "Sur filrouganim.fr")); rh.appendChild(el("span", null, maj ? "au dernier relevé, " + heure(maj) + " · toutes les 6 heures" : "le détail arrive avec le prochain relevé des chiffres"));
    r.appendChild(rh);
    var trois = el("div", "ap-releve-3"); r.appendChild(trois);
    var c1 = el("div"); c1.appendChild(el("p", "ap-mini-t", "Ce qu'ils lisent")); var ol = el("ol", "ap-mini-liste");
    (au.pages_lues || []).slice(0, 6).forEach(function (x) { var li = el("li"); li.appendChild(el("b", null, fr(x[2]))); li.appendChild(el("span", null, x[1] || x[0])); ol.appendChild(li); });
    if (!ol.children.length) ol.appendChild(el("li", "ap-vide", "Pas encore de détail."));
    c1.appendChild(ol); trois.appendChild(c1);
    var c2 = el("div"); c2.appendChild(el("p", "ap-mini-t", "D'où ils viennent")); var ol2 = el("ol", "ap-mini-liste");
    (au.provenances || []).slice(0, 6).forEach(function (x) { var li = el("li"); li.appendChild(el("b", null, fr(x[1]))); li.appendChild(el("span", null, x[0])); ol2.appendChild(li); });
    if (!ol2.children.length) ol2.appendChild(el("li", "ap-vide", "Pas encore de détail."));
    c2.appendChild(ol2); trois.appendChild(c2);
    var c3 = el("div"); c3.appendChild(el("p", "ap-mini-t", "La journée"));
    var pj = au.visiteurs_par_jour || [], vAuj = (pj.filter(function (x) { return x[0] === AUJ; })[0] || [0, 0])[1], vHier = (pj.filter(function (x) { return x[0] === joursAvant(1); })[0] || [0, 0])[1];
    var big = el("p", "ap-jour"); big.appendChild(el("b", null, fr(vAuj))); big.appendChild(document.createTextNode(" visiteurs aujourd'hui")); c3.appendChild(big);
    c3.appendChild(el("p", "ap-petit", "Hier, journée entière : " + fr(vHier) + " visiteurs. La journée n'est pas finie : c'est un repère, pas une comparaison."));
    c3.appendChild(el("p", "ap-petit", "Inscriptions : " + compte(T, function (t) { return iso(t.c.cree_le) === AUJ; }) + " aujourd'hui, " + compte(T, function (t) { return iso(t.c.cree_le) === joursAvant(1); }) + " hier."));
    trois.appendChild(c3);
    // les accès rapides, par partie
    var g4 = grille(c, "ap-g4");
    var vues30 = D.vues.filter(function (v) { return v.jour >= joursAvant(29) && (v.type === "page" || v.type === "offre"); }).reduce(function (a, v) { return a + v.n; }, 0);
    [["Pilotage", [["qg", "boite", "QG demandes", aTraiter().length ? aTraiter().length + " point" + (aTraiter().length > 1 ? "s" : "") + " à traiter" : "Rien en attente"],
                   ["ventes", "courbe", "Ventes", euros(an / 12) + " par mois"], ["sante", "coeur", "État de santé", "Relevés, e-mails, base, stockage"], ["afaire", "coche", "À traiter", "Structures, demandes, offres"]]],
     ["Utilisateurs", [["comptes", "personne", "Membres", fr(D.comptes.length) + " comptes, +" + ceMois + " ce mois-ci"], ["structures", "maison", "Structures", st.length + " fiches, " + payees.length + " payées"],
                       ["animateurs", "groupe", "Animateurs", D.profils.length + " profils, " + compte(D.profils, function (p) { return p.publie; }) + " visibles"]]],
     ["Acquisition", [["stats", "courbe", "Statistiques détaillées", "Vues, clics, entonnoirs, trafic"], ["stats", "oeil", "Vues des pages structures", fr(vues30) + " sur 30 jours"],
                      ["visibilite", "google", "Visibilité", "Google, page par page"], ["provenance", "lien", "Provenance", "Canaux, liens suivis, inscrits"], ["prospection", "avion", "Prospection", "Organismes, structures, contacts"]]],
     ["Contenu", [["offres", "offre", "Offres", compte(D.offres, function (o) { return o.publiee && o.expire_le >= AUJ; }) + " en ligne"], ["demandes", "avion", "Toutes les demandes", D.demandes.length + " reçues"],
                  ["contenus", "livre", "Guides et conseils", D.ressources.length + " ressources"]]]].forEach(function (p) {
      var k = carte(g4, null, null, "ap-acces"); k.appendChild(el("p", "ap-mini-t", p[0]));
      p[1].forEach(function (x) {
        var b = x[0] ? vers(x[0]) : el("a"); if (!x[0]) { b.href = x[4]; b.target = "_blank"; b.rel = "noopener"; }
        b.className = "ap-acces-l"; b.appendChild(ic(x[1]));
        var t = el("span", "ap-acces-t"); t.appendChild(el("b", null, x[2])); t.appendChild(el("small", null, x[3])); b.appendChild(t); b.appendChild(el("i", null, "→"));
        k.appendChild(b);
      });
    });
    audience(c, T);
    membres(c, T);
  }
  function audience(c, T) {
    var k = carte(c, "Audience du site", null, "ap-audience");
    var per = el("div", "ap-periodes");
    [[7, "7 jours"], [30, "30 jours"]].forEach(function (p) {
      var b = el("button", null, p[1]); b.type = "button"; b.setAttribute("aria-pressed", periode === p[0] ? "true" : "false");
      b.addEventListener("click", function () { periode = p[0]; accueil(); }); per.appendChild(b);
    });
    k.querySelector(".ap-carte-h").appendChild(per);
    var au = S && S.audience && S.audience.donnees || {}, pj = {};
    (au.visiteurs_par_jour || []).forEach(function (x) { pj[x[0]] = x[1]; });
    var jours = [], avant = []; for (var i = periode - 1; i >= 0; i--) { jours.push(joursAvant(i)); avant.push(joursAvant(i + periode)); }
    var somme = function (l, f) { return l.reduce(function (a, j) { return a + f(j); }, 0); };
    var vis = somme(jours, function (j) { return pj[j] || 0; }), visA = somme(avant, function (j) { return pj[j] || 0; });
    var insc = compte(T, function (t) { return iso(t.c.cree_le) >= jours[0]; }), inscA = compte(T, function (t) { var d = iso(t.c.cree_le); return d >= avant[0] && d < jours[0]; });
    var cli = compte(D.structures, function (s) { return paye(s) && iso(s.cree_le) >= jours[0]; }), cliA = compte(D.structures, function (s) { var d = iso(s.cree_le); return paye(s) && d >= avant[0] && d < jours[0]; });
    var vues = function (debut, fin) { return D.vues.filter(function (v) { return v.jour >= debut && v.jour <= fin && (v.type === "page" || v.type === "offre"); }).reduce(function (a, v) { return a + v.n; }, 0); };
    var vu = vues(jours[0], AUJ), vuA = vues(avant[0], avant[avant.length - 1]);
    var g = el("div", "ap-aud-kpi"); k.appendChild(g);
    [["Visiteurs", vis, visA, (au.visiteurs_par_jour || []).length ? "" : "dès le prochain relevé"], ["Inscriptions", insc, inscA, vis ? pct(insc, vis) + " des visiteurs" : ""],
     ["Devenues clientes", cli, cliA, insc ? pct(cli, insc) + " des inscrits" : "structures payées"], ["Vues des pages structures", vu, vuA, "pages et offres des structures"]].forEach(function (x, i) {
      var e = evol(x[1], x[2]), d = el("div", i === 3 ? "ap-aud-une" : null);
      d.appendChild(el("small", null, x[0])); d.appendChild(el("b", null, fr(x[1]))); d.appendChild(el("span", e[1], e[0])); if (x[3]) d.appendChild(el("span", "ap-petit", x[3]));
      g.appendChild(d);
    });
    k.appendChild(el("p", "ap-mini-t", "Visiteurs par jour, " + periode + " jours"));
    courbe(k, [{ nom: "période d'avant", classe: "ap-l-avant", points: avant.map(function (j) { return pj[j] || 0; }) },
               { nom: "visiteurs", classe: "ap-l-vis", aire: true, points_visibles: true, points: jours.map(function (j) { return pj[j] || 0; }) },
               { nom: "inscriptions", classe: "ap-l-insc", points_visibles: true, points: jours.map(function (j) { return compte(T, function (t) { return iso(t.c.cree_le) === j; }); }) }],
      jours.map(function (j) { return new Date(j + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); }), 170);
    legende(k, [["Visiteurs", "ap-c-vis"], ["Inscriptions", "ap-c-insc"], [periode + " jours d'avant", "ap-c-avant"]]);
    var deux = el("div", "ap-deux"); k.appendChild(deux);
    var g1 = el("div"); g1.appendChild(el("p", "ap-mini-t", "D'où ils viennent · 30 jours"));
    var couleurs = ["#a8162a", "#d61f35", "#e76f7c", "#d6a400", "#4f6b54", "#7d6f69"];
    barresH(g1, (au.provenances || []).slice(0, 7).map(function (x, i) { return [x[0], x[1], couleurs[i % couleurs.length]]; }));
    deux.appendChild(g1);
    var g2 = el("div"); g2.appendChild(el("p", "ap-mini-t", "Ce qu'ils lisent · 30 jours"));
    var ol = el("ol", "ap-lus"), max = Math.max.apply(null, (au.pages_lues || []).map(function (x) { return x[2]; }).concat([1]));
    (au.pages_lues || []).slice(0, 7).forEach(function (x, i) {
      var li = el("li"); li.appendChild(el("span", "ap-lus-n", String(i + 1)));
      var t = el("span", "ap-lus-t"); var a = el("a", null, x[1] || x[0]); a.href = x[0]; a.target = "_blank"; a.rel = "noopener"; t.appendChild(a);
      var bar = el("i"); bar.style.width = (x[2] / max * 100) + "%"; t.appendChild(bar); li.appendChild(t); li.appendChild(el("b", null, fr(x[2]))); ol.appendChild(li);
    });
    if (!ol.children.length) ol.appendChild(el("li", "ap-vide", "Pas encore de détail : il arrive avec le prochain relevé des chiffres."));
    g2.appendChild(ol); deux.appendChild(g2);
  }
  function membres(c, T) {
    var k = carte(c, "Membres", null, "ap-membres");
    var h = k.querySelector(".ap-carte-h"); var tous = vers("comptes"); tous.className = "ap-lien"; tous.textContent = "Tous les membres →"; h.appendChild(tous);
    var F = { tous: ["Tous", function () { return true; }], animateur: ["Animateurs", function (t) { return t.type === "animateur"; }],
              structure: ["Structures", function (t) { return t.type === "structure"; }], aucun: ["Sans fiche", function (t) { return t.type === "aucun"; }] };
    var puces = el("div", "ap-puces"); k.appendChild(puces);
    Object.keys(F).forEach(function (cle) {
      var b = el("button", null, F[cle][0] + " " + compte(T, F[cle][1])); b.type = "button"; b.setAttribute("aria-pressed", filtreMembres === cle ? "true" : "false");
      b.addEventListener("click", function () { filtreMembres = cle; accueil(); }); puces.appendChild(b);
    });
    var L = T.filter(F[filtreMembres][1]);
    var corps = el("div", "ap-m-corps"); k.appendChild(corps);
    var g = el("div", "ap-m-g");
    g.appendChild(el("b", "ap-m-n", fr(L.length)));
    g.appendChild(el("p", "ap-hausse", "+" + compte(L, function (t) { return iso(t.c.cree_le) >= AUJ.slice(0, 8) + "01"; }) + " ce mois-ci · +" + compte(L, function (t) { return iso(t.c.cree_le) >= joursAvant(365); }) + " en 12 mois"));
    var segs = [["Animateurs", compte(T, function (t) { return t.type === "animateur"; }), "ap-s1"], ["Structures payantes", compte(T, function (t) { return t.s && paye(t.s); }), "ap-s2"],
                ["Structures sans abonnement", compte(T, function (t) { return t.s && !paye(t.s); }), "ap-s3"], ["Sans fiche", compte(T, function (t) { return t.type === "aucun"; }), "ap-s4"]];
    var barre = el("div", "ap-seg"), tot = T.length || 1;
    segs.forEach(function (s) { if (!s[1]) return; var i = el("i", s[2]); i.style.width = (s[1] / tot * 100) + "%"; i.title = s[0] + " : " + s[1]; barre.appendChild(i); });
    g.appendChild(barre); legende(g, segs.map(function (s) { return [s[0] + " " + s[1], s[2]]; }));
    corps.appendChild(g);
    // la croissance, mois par mois (12 mois, en cumul)
    var mois = [], noms = []; for (var i = 11; i >= 0; i--) { var d = new Date(auj.getFullYear(), auj.getMonth() - i, 1); mois.push(d.toISOString().slice(0, 7)); noms.push(d.toLocaleDateString("fr-FR", { month: "short" })); }
    var cumul = mois.map(function (m) { return compte(L, function (t) { return iso(t.c.cree_le).slice(0, 7) <= m; }); });
    var cg = el("div", "ap-m-courbe"); courbe(cg, [{ nom: "comptes en cumul", classe: "ap-l-vis", aire: true, points: cumul }], noms, 120); corps.appendChild(cg);
    k.appendChild(el("p", "ap-mini-t", "Derniers inscrits"));
    var der = el("div", "ap-derniers"); k.appendChild(der);
    L.slice().sort(function (a, b) { return (b.c.cree_le || "").localeCompare(a.c.cree_le || ""); }).slice(0, 6).forEach(function (t) {
      var b = el("button", "ap-inscrit"); b.type = "button";
      if (t.s) b.addEventListener("click", function () { location.href = "/compte/?role=structure&compte=" + encodeURIComponent(t.c.id); });
      else if (t.p) b.addEventListener("click", function () { location.href = "/compte/?role=candidat&compte=" + encodeURIComponent(t.c.id); });
      else b.dataset.ongletVers = "comptes";
      var nom = nomDe(t); b.appendChild(el("span", "ap-av", (nom[0] || "?").toUpperCase()));
      var tx = el("span"); tx.appendChild(el("b", null, nom)); tx.appendChild(el("small", null, ({ structure: "Structure", animateur: "Animateur", aucun: "Sans fiche" })[t.type] + " · " + depuis(t.c.cree_le))); b.appendChild(tx);
      der.appendChild(b);
    });
    if (!der.children.length) der.appendChild(el("p", "ap-vide", "Personne pour l'instant."));
  }

  /* ---------- 2. le QG des demandes ---------- */
  var qg = { filtre: "a_traiter", sel: null, q: "", ton: "vous" };
  var PERIODES = { "ete": "l'été", "petites-vacances": "les petites vacances", "mercredis": "les mercredis", "periscolaire": "le périscolaire", "annee": "toute l'année", "stage-pratique": "un stage pratique" };
  var POSTES = { "animateur-stagiaire": "Stage pratique BAFA", "animateur": "Animateur", "directeur": "Direction", "directeur-adjoint": "Direction adjointe", "surveillant-baignade": "Surveillant de baignade", "coordinateur": "Coordination", "autre": "Autre poste" };
  function lieuDe(d) { return d.ville ? d.ville + " (" + d.departement + ")" : nomDep(d.departement) || "Lieu non précisé"; }
  function QG() {
    var c = $("ad-qg"); if (!c) return; c.textContent = "";
    var dem = D.demandes;
    var nb = { a_traiter: compte(dem, function (d) { return (d.suivi || "a_traiter") === "a_traiter"; }), sans: compte(dem, function (d) { return !(d.destinataires || []).length && d.suivi !== "traitee"; }),
               en_cours: compte(dem, function (d) { return d.suivi === "en_cours"; }), traitee: compte(dem, function (d) { return d.suivi === "traitee"; }), toutes: dem.length };
    var cote = el("div", "ap-hero-cote"); cote.appendChild(el("p", "ap-cote-t", (nb.a_traiter + compte(D.structures, function (s) { return paye(s) && !s.verifiee; })) + " à traiter"));
    [["Demandes d'animateurs", nb.a_traiter, "qg"], ["Structures à vérifier", compte(D.structures, function (s) { return paye(s) && !s.verifiee; }), "afaire"],
     ["Candidatures sans réponse", compte(D.candidatures, function (x) { return x.statut === "envoyee" && iso(x.cree_le) <= joursAvant(3); }), "afaire"],
     ["Comptes sans fiche", compte(types(), function (t) { return t.type === "aucun"; }), "comptes"]].forEach(function (x) {
      var r = vers(x[2]); r.className = "ap-cote-ligne"; r.appendChild(el("span", null, x[0])); r.appendChild(el("b", null, String(x[1]))); r.appendChild(el("i", null, "→")); cote.appendChild(r);
    });
    hero(c, "QG demandes", "Tout ce qui attend ", "votre réponse",
      "Les demandes de l'annuaire inversé : à qui elles sont parties, si une structure a été prévenue, et ce que vous pouvez faire. Une fiche par demande.", [bouton("← Vue d'ensemble", "accueil")], cote);
    var corps = el("div", "ap-qg"); c.appendChild(corps);
    // à gauche : les boîtes
    var boites = el("div", "ap-qg-boites"); corps.appendChild(boites);
    [["Demandes d'animateurs", "Envoyées aux structures", nb.a_traiter, null, "avion"], ["Structures à vérifier", "Fiches pas encore en ligne", compte(D.structures, function (s) { return !s.verifiee; }), "afaire", "maison"],
     ["Candidatures", "Sans réponse depuis 3 jours", compte(D.candidatures, function (x) { return x.statut === "envoyee" && iso(x.cree_le) <= joursAvant(3); }), "afaire", "offre"],
     ["Comptes sans fiche", "Inscrits, rien rempli", compte(types(), function (t) { return t.type === "aucun"; }), "comptes", "personne"]].forEach(function (x, i) {
      var b = x[3] ? vers(x[3]) : el("button"); b.type = "button"; b.className = "ap-boite" + (i === 0 ? " on" : "");
      b.appendChild(ic(x[4])); var t = el("span"); t.appendChild(el("b", null, x[0])); t.appendChild(el("small", null, x[1])); b.appendChild(t); b.appendChild(el("i", x[2] ? "ap-pastille" : "ap-pastille ap-zero", String(x[2])));
      boites.appendChild(b);
    });
    // au milieu : la liste
    var milieu = el("div", "ap-qg-liste"); corps.appendChild(milieu);
    milieu.appendChild(el("h3", null, "Demandes d'animateurs"));
    milieu.appendChild(el("p", "ap-petit", "Chaque besoin décrit sur « Décrire ce que je cherche » : à qui il est parti, et ce que vous pouvez en faire."));
    var f = el("div", "ap-puces");
    [["a_traiter", "À traiter"], ["sans", "Sans structure"], ["en_cours", "En cours"], ["traitee", "Traitées"], ["toutes", "Toutes"]].forEach(function (x) {
      var b = el("button", null, x[1] + " " + nb[x[0]]); b.type = "button"; b.setAttribute("aria-pressed", qg.filtre === x[0] ? "true" : "false");
      b.addEventListener("click", function () { qg.filtre = x[0]; qg.sel = null; QG(); }); f.appendChild(b);
    });
    milieu.appendChild(f);
    var q = el("input", "ap-recherche"); q.type = "search"; q.placeholder = "Ville, département, prénom, e-mail…"; q.value = qg.q; milieu.appendChild(q);
    var liste = el("div", "ap-qg-items"); milieu.appendChild(liste);
    var detail = el("div", "ap-qg-detail"); corps.appendChild(detail);
    function filtre(d) {
      var s = d.suivi || "a_traiter";
      if (qg.filtre === "a_traiter" && s !== "a_traiter") return false;
      if (qg.filtre === "en_cours" && s !== "en_cours") return false;
      if (qg.filtre === "traitee" && s !== "traitee") return false;
      if (qg.filtre === "sans" && ((d.destinataires || []).length || s === "traitee")) return false;
      var m = qg.q.trim().toLowerCase(); if (!m) return true;
      return [d.prenom, d.ville, d.departement, nomDep(d.departement), d.email_contact, POSTES[d.poste]].join(" ").toLowerCase().indexOf(m) >= 0;
    }
    function remplir() {
      liste.textContent = "";
      var l = dem.filter(filtre);
      if (!l.length) { liste.appendChild(el("p", "ap-vide", "Rien ici.")); detail.textContent = ""; detail.appendChild(el("p", "ap-vide ap-qg-rien", "Choisissez une demande à gauche.")); return; }
      if (!qg.sel || !l.some(function (d) { return d.id === qg.sel; })) qg.sel = l[0].id;
      l.forEach(function (d) {
        var b = el("button", "ap-qg-item" + (d.id === qg.sel ? " on" : "")); b.type = "button";
        b.appendChild(ic("avion"));
        var t = el("span"); t.appendChild(el("b", null, (POSTES[d.poste] || d.poste) + " · " + lieuDe(d)));
        t.appendChild(el("small", null, ((d.periodes || []).map(function (p) { return PERIODES[p] || p; }).join(", ") || "Période non précisée") + " · " + (d.prenom || "?")));
        var bad = el("span", "ap-qg-badges"); var n = (d.destinataires || []).length;
        bad.appendChild(etiquette(n ? n + " structure" + (n > 1 ? "s" : "") : "Sans structure", n ? "ok" : "rouge"));
        bad.appendChild(el("small", null, depuis(d.cree_le))); t.appendChild(bad); b.appendChild(t);
        b.addEventListener("click", function () { qg.sel = d.id; remplir(); });
        liste.appendChild(b);
      });
      ficheDemande(detail, dem.filter(function (d) { return d.id === qg.sel; })[0]);
    }
    q.addEventListener("input", function () { qg.q = q.value; remplir(); });
    remplir();
  }
  function texteBesoin(d, tu) {
    var lieu = d.ville ? "à " + d.ville : "dans " + (nomDep(d.departement) || "votre secteur");
    var quand = (d.periodes || []).map(function (p) { return PERIODES[p] || p; }).join(", ");
    var dispo = d.dispo_debut ? " (disponible " + (d.dispo_fin ? "du " + E.dateFr(d.dispo_debut) + " au " + E.dateFr(d.dispo_fin) : "à partir du " + E.dateFr(d.dispo_debut)) + ")" : "";
    var dip = (d.diplomes || []).length ? "\nDiplômes : " + d.diplomes.map(function (x) { return lib("diplomes", x); }).join(", ") + "." : "";
    return "Bonjour,\n\n" + "Un animateur cherche un poste " + (POSTES[d.poste] || "").toLowerCase().replace(/^stage pratique bafa$/, "de stage pratique BAFA").replace(/^animateur$/, "d'animateur").replace(/^direction/, "de direction") + " " + lieu + (quand ? ", pour " + quand : "") + dispo + "." + dip + "\n\n" +
      (tu ? "Si tu recrutes, crée la page de ta structure sur Fil Roug'Anim : les demandes des animateurs de ton secteur arrivent directement chez toi, sans commission.\n"
          : "Si vous recrutez, créez la page de votre structure sur Fil Roug'Anim : les demandes des animateurs de votre secteur arrivent directement chez vous, sans commission.\n") +
      "https://filrouganim.fr/recruter/\n\n" + (tu ? "À bientôt,\n" : "Bonne journée,\n") + "Fil Roug'Anim";
  }
  function ficheDemande(c, d) {
    c.textContent = ""; if (!d) return;
    var h = el("div", "ap-carte ap-qg-tete");
    var t = el("div"); t.appendChild(el("p", "ap-sur", "Demande d'animateur · reçue " + depuis(d.cree_le)));
    t.appendChild(el("h3", null, (POSTES[d.poste] || d.poste) + " · " + lieuDe(d)));
    var bad = el("p", "ap-qg-badges"); var n = (d.destinataires || []).length;
    bad.appendChild(etiquette(n ? "Transmise à " + n + " structure" + (n > 1 ? "s" : "") : "Sans structure", n ? "ok" : "rouge"));
    bad.appendChild(etiquette(({ a_traiter: "À traiter", en_cours: "En cours", traitee: "Traitée" })[d.suivi || "a_traiter"]));
    t.appendChild(bad); h.appendChild(t);
    var acts = el("div", "ap-qg-actions");
    function suivi(v, texte, plein) { var b = el("button", plein ? "ap-bouton" : "ap-lien-b", texte); b.type = "button"; b.addEventListener("click", function () { A.modifier("demandes", d.id, { suivi: v }); }); acts.appendChild(b); }
    if ((d.suivi || "a_traiter") !== "en_cours" && d.suivi !== "traitee") suivi("en_cours", "Je m'en occupe");
    if (d.suivi !== "traitee") suivi("traitee", "✓ Marquer traitée", true); else suivi("a_traiter", "Rouvrir");
    h.appendChild(acts); c.appendChild(h);
    var g = el("div", "ap-qg-g"); c.appendChild(g);
    var gauche = el("div", "ap-col"), droite = el("div", "ap-col"); g.appendChild(gauche); g.appendChild(droite);
    // le besoin
    var b = carte(gauche, "Le besoin"); var tb = el("dl", "ap-dl");
    var ligne = function (k, v) { if (!v) return; tb.appendChild(el("dt", null, k)); tb.appendChild(el("dd", null, v)); };
    ligne("Poste", POSTES[d.poste] || d.poste);
    ligne("Lieu", lieuDe(d));
    ligne("Zone", d.partout ? "Partout en France" : (d.zone || []).map(nomDep).join(", "));
    ligne("Quand", (d.periodes || []).map(function (p) { return PERIODES[p] || p; }).join(", "));
    ligne("Disponible", d.dispo_debut ? (d.dispo_fin ? "du " + E.dateFr(d.dispo_debut) + " au " + E.dateFr(d.dispo_fin) : "à partir du " + E.dateFr(d.dispo_debut)) : "");
    ligne("Diplômes", (d.diplomes || []).map(function (x) { return lib("diplomes", x); }).join(", "));
    ligne("Expériences", (d.experiences || []).map(function (x) { return lib("experiences", x); }).join(", "));
    ligne("Âge", d.annee_naissance ? (auj.getFullYear() - d.annee_naissance) + " ans" : "");
    b.appendChild(tb);
    if (d.message) b.appendChild(el("blockquote", "ap-message", d.message));
    // l'animateur
    var a = carte(gauche, "L'animateur"); a.appendChild(el("p", "ap-nom", d.prenom || "Prénom non donné"));
    if (d.email_contact) {
      a.appendChild(el("p", "ap-petit", d.email_contact));
      var ecr = el("a", "ap-lien-b", "✉ Écrire"); ecr.href = "mailto:" + d.email_contact + "?subject=" + encodeURIComponent("Votre demande sur Fil Roug'Anim"); a.appendChild(ecr);
    }
    // les structures sollicitées
    var s = carte(gauche, "Structures sollicitées");
    if (!n) s.appendChild(el("p", "ap-petit", "Aucune structure abonnée dans sa zone pour l'instant. Transmettez-la à une structure ci-contre, ou partagez le besoin."));
    (d.destinataires || []).forEach(function (id) {
      var st = D.structures.filter(function (x) { return x.id === id; })[0], p = el("p", "ap-sollicitee");
      p.appendChild(el("b", null, st ? st.nom : "Structure supprimée"));
      p.appendChild(etiquette((d.notifiees || []).indexOf(id) >= 0 ? "prévenue par e-mail" : "e-mail au prochain envoi", (d.notifiees || []).indexOf(id) >= 0 ? "ok" : null));
      s.appendChild(p);
    });
    // transmettre
    var tr = carte(droite, "Transmettre à une structure de l'annuaire");
    tr.appendChild(el("p", "ap-petit", "La structure la voit dans « Demandes reçues » (si elle est vérifiée) et reçoit un e-mail au prochain envoi, dans le quart d'heure."));
    var champ = el("input", "ap-recherche"); champ.type = "search"; champ.placeholder = "Nom ou ville de la structure…"; tr.appendChild(champ);
    var res = el("div", "ap-resultats"); tr.appendChild(res);
    function chercher() {
      res.textContent = "";
      var m = champ.value.trim().toLowerCase();
      var l = D.structures.filter(function (x) { return (d.destinataires || []).indexOf(x.id) < 0; })
        .filter(function (x) { return !m || [x.nom, x.ville, x.departement].join(" ").toLowerCase().indexOf(m) >= 0; })
        .sort(function (a2, b2) { return (b2.departement === d.departement) - (a2.departement === d.departement) || (b2.verifiee ? 1 : 0) - (a2.verifiee ? 1 : 0); }).slice(0, 5);
      if (!l.length) { res.appendChild(el("p", "ap-vide", D.structures.length ? "Aucune structure ne correspond." : "Aucune structure dans l'annuaire pour l'instant.")); return; }
      l.forEach(function (x) {
        var r = el("div", "ap-res"); var tx = el("span"); tx.appendChild(el("b", null, x.nom || "Sans nom")); tx.appendChild(el("small", null, (x.ville || "") + " (" + (x.departement || "?") + ")" + (x.verifiee && paye(x) ? " · en ligne" : " · pas encore en ligne"))); r.appendChild(tx);
        var bt = el("button", "ap-lien-b", "Transmettre"); bt.type = "button";
        bt.addEventListener("click", function () { if (confirm("Transmettre cette demande à « " + x.nom + " » ?")) A.modifier("demandes", d.id, { destinataires: (d.destinataires || []).concat([x.id]), suivi: "en_cours" }); });
        r.appendChild(bt); res.appendChild(r);
      });
    }
    champ.addEventListener("input", chercher); chercher();
    // partager sans les coordonnées
    var pa = carte(droite, "Partager le besoin, sans les coordonnées");
    pa.appendChild(el("p", "ap-petit", "Pour une structure qui n'est pas encore sur le site, ou un groupe d'animation : ni le prénom, ni l'e-mail, ni le message de l'animateur."));
    var tons = el("div", "ap-puces");
    [["vous", "Vouvoiement"], ["tu", "Tutoiement"]].forEach(function (x) { var bt = el("button", null, x[1]); bt.type = "button"; bt.setAttribute("aria-pressed", qg.ton === x[0] ? "true" : "false"); bt.addEventListener("click", function () { qg.ton = x[0]; ficheDemande(c, d); }); tons.appendChild(bt); });
    pa.appendChild(tons);
    var ta = el("textarea", "ap-texte"); ta.rows = 9; ta.value = texteBesoin(d, qg.ton === "tu"); pa.appendChild(ta);
    var bts = el("div", "ap-boutons");
    var cp = el("button", "ap-bouton", "Copier"); cp.type = "button"; cp.addEventListener("click", function () { if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(function () { cp.textContent = "Copié"; setTimeout(function () { cp.textContent = "Copier"; }, 1500); }); }); bts.appendChild(cp);
    var ml = el("a", "ap-lien-b", "E-mail"); ml.href = "mailto:?subject=" + encodeURIComponent("Un animateur cherche un poste près de chez vous") + "&body=" + encodeURIComponent(ta.value); bts.appendChild(ml);
    var wa = el("a", "ap-lien-b", "WhatsApp"); wa.href = "https://wa.me/?text=" + encodeURIComponent(ta.value); wa.target = "_blank"; wa.rel = "noopener"; bts.appendChild(wa);
    ta.addEventListener("input", function () { ml.href = "mailto:?subject=" + encodeURIComponent("Un animateur cherche un poste près de chez vous") + "&body=" + encodeURIComponent(ta.value); wa.href = "https://wa.me/?text=" + encodeURIComponent(ta.value); });
    pa.appendChild(bts);
    // la note interne
    var no = carte(droite, "Note interne");
    var tn = el("textarea", "ap-texte"); tn.rows = 3; tn.maxLength = 2000; tn.placeholder = "Ce qui a été fait, à qui vous avez écrit… (visible par l'administration seulement)"; tn.value = d.note_admin || ""; no.appendChild(tn);
    var en = el("button", "ap-lien-b", "Enregistrer la note"); en.type = "button"; en.addEventListener("click", function () { A.modifier("demandes", d.id, { note_admin: tn.value.trim() || null }); }); no.appendChild(en);
  }

  /* ---------- 3. l'état de santé ---------- */
  var ACTIONS = [["publier.yml", "Publication du site", "toutes les heures, de 6 h à 23 h", 3], ["relever.yml", "Relevé des sessions", "chaque nuit", 30],
                 ["chiffres.yml", "Relevé des chiffres (Google, visites)", "toutes les 6 heures", 9], ["abonnements.yml", "Paiements Stripe et e-mails des demandes", "tous les quarts d'heure", 2],
                 ["alertes.yml", "Alertes du lundi aux animateurs", "chaque lundi", 24 * 8]];
  var gh = null, verifieA = null;
  async function lireGithub() {
    gh = {};
    await Promise.all(ACTIONS.map(async function (a) {
      try {
        var r = await fetch("https://api.github.com/repos/" + DEPOT + "/actions/workflows/" + a[0] + "/runs?per_page=1&exclude_pull_requests=true");
        if (!r.ok) throw new Error(r.status);
        var j = await r.json(); gh[a[0]] = (j.workflow_runs || [])[0] || null;
      } catch (e) { gh[a[0]] = { erreur: String(e.message || e) }; }
    }));
  }
  function bloc(c, icone, titre, etat, texte, lignes, lien) {
    var k = el("section", "ap-carte ap-sante-c ap-etat-" + etat[0]);
    var h = el("div", "ap-carte-h"); var t = el("h3"); t.appendChild(ic(icone, "ap-ic-mini")); t.appendChild(document.createTextNode(titre)); h.appendChild(t);
    h.appendChild(etiquette(etat[1], etat[0] === "ok" ? "ok" : etat[0] === "panne" ? "rouge" : "jaune")); k.appendChild(h);
    if (texte) k.appendChild(el("p", "ap-petit", texte));
    (lignes || []).forEach(function (l) { var p = el("p", "ap-sante-l"); p.appendChild(el("i", "ap-dot ap-dot-" + (l[2] || "ok"))); var s = el("span"); s.appendChild(el("b", null, l[0])); if (l[1]) s.appendChild(el("small", null, l[1])); p.appendChild(s); k.appendChild(p); });
    if (lien) { var a = el("a", "ap-lien", lien[0] + " ↗"); a.href = lien[1]; a.target = "_blank"; a.rel = "noopener"; k.appendChild(a); }
    c.appendChild(k); return etat[0];
  }
  function sante() {
    var c = $("ad-sante"); if (!c) return; c.textContent = "";
    var g = el("div", "ap-sante-g"), etats = [];
    // les tâches automatiques (GitHub Actions)
    var lignes = [], pire = "ok";
    ACTIONS.forEach(function (a) {
      var r = gh && gh[a[0]];
      if (!gh) { lignes.push([a[1], "lecture en cours…", "neutre"]); return; }
      if (!r || r.erreur) { lignes.push([a[1], r && r.erreur ? "GitHub ne répond pas (" + r.erreur + ")" : "jamais lancée", "neutre"]); return; }
      var h = (Date.now() - new Date(r.updated_at || r.created_at)) / 3600e3, e = "ok", txt;
      if (r.status !== "completed") { txt = "en cours, lancée " + heure(r.created_at); e = "neutre"; }
      else if (r.conclusion !== "success") { txt = "échec le " + heure(r.updated_at); e = "panne"; }
      else { txt = "réussie " + heure(r.updated_at) + " · " + a[2]; if (h > a[3]) e = "surveiller", txt = "dernière réussite " + heure(r.updated_at) + " : en retard (" + a[2] + ")"; }
      if (e === "panne") pire = "panne"; else if (e === "surveiller" && pire === "ok") pire = "surveiller";
      lignes.push([a[1], txt, e]);
    });
    etats.push(bloc(g, "horloge", "Tâches automatiques", [pire, pire === "ok" ? "OK" : pire === "panne" ? "En panne" : "À surveiller"],
      "Les relevés et la publication tournent tout seuls sur GitHub.", lignes, ["Ouvrir GitHub Actions", "https://github.com/" + DEPOT + "/actions"]));
    // les chiffres Google et les visites
    var au = S.audience, h2 = au ? (Date.now() - new Date(au.maj)) / 3600e3 : null;
    etats.push(bloc(g, "google", "Chiffres Google et visites", !au ? ["surveiller", "À surveiller"] : h2 > 13 ? ["surveiller", "À surveiller"] : ["ok", "OK"],
      au ? "Dernier relevé détaillé : " + heure(au.maj) + "." : "Pas encore de relevé détaillé : il arrive au prochain passage (toutes les 6 heures).",
      au ? [["Visiteurs jour par jour", (au.donnees.visiteurs_par_jour || []).length + " jours"], ["Pages lues", (au.donnees.pages_lues || []).length + " pages suivies"], ["Provenances", (au.donnees.provenances || []).length + " sources"]] : []));
    // les e-mails d'alerte à l'administration
    var em = S.emails || {}, retard = em.plus_ancien ? (Date.now() - new Date(em.plus_ancien)) / 3600e3 : 0;
    etats.push(bloc(g, "mail", "E-mails à l'administration", retard > 3 ? ["surveiller", "À surveiller"] : ["ok", "OK"],
      "Chaque nouvelle fiche, structure, paiement ou demande vous est envoyé par e-mail (Brevo).",
      [[em.en_attente ? em.en_attente + " pas encore parti" + (em.en_attente > 1 ? "s" : "") : "Aucun en attente", em.plus_ancien ? "le plus ancien : " + heure(em.plus_ancien) : "", em.en_attente && retard > 3 ? "surveiller" : "ok"],
       ["Dernier envoi", em.dernier_envoi ? heure(em.dernier_envoi) : "aucun pour l'instant"], ["Sur 30 jours", fr(em.total_30j) + " événements"]]));
    // la base et le stockage (offre gratuite de Supabase : 500 Mo de base, 1 Go de fichiers)
    var mo = (S.base_octets || 0) / 1048576, sto = (S.stockage || []).reduce(function (a, x) { return a + (x.octets || 0); }, 0) / 1048576;
    etats.push(bloc(g, "base", "Base de données", mo > 400 ? ["surveiller", "À surveiller"] : ["ok", "OK"], "Supabase, offre gratuite : 500 Mo pour la base.",
      [["Taille de la base", mo.toFixed(1).replace(".", ",") + " Mo sur 500 Mo (" + Math.round(mo / 5) + " %)"], ["Comptes non confirmés", fr(S.comptes_non_confirmes)]], ["Ouvrir Supabase", "https://supabase.com/dashboard/project/abjimkhwbuhsfdnhweyy"]));
    etats.push(bloc(g, "photo", "Photos et CV", sto > 800 ? ["surveiller", "À surveiller"] : ["ok", "OK"], "Supabase, offre gratuite : 1 Go pour les fichiers.",
      (S.stockage || []).map(function (x) { return [x.bucket === "structures" ? "Photos et logos des structures" : x.bucket === "cv" ? "CV des animateurs" : x.bucket, fr(x.fichiers) + " fichiers · " + (x.octets / 1048576).toFixed(1).replace(".", ",") + " Mo"]; })
        .concat([["Total", sto.toFixed(1).replace(".", ",") + " Mo sur 1 024 Mo"]])));
    // les demandes, les structures, les offres
    etats.push(bloc(g, "avion", "Demandes des animateurs", S.demandes_sans_structure_48h ? ["surveiller", "À surveiller"] : ["ok", "OK"], "Une demande sans structure depuis 48 heures attend votre coup de main (QG demandes).",
      [["À traiter", fr(S.demandes_a_traiter)], ["Sans structure depuis 48 h", fr(S.demandes_sans_structure_48h), S.demandes_sans_structure_48h ? "surveiller" : "ok"]]));
    etats.push(bloc(g, "maison", "Structures et abonnements", S.structures_payees_non_verifiees ? ["surveiller", "À surveiller"] : ["ok", "OK"], null,
      [["Payées, pas encore vérifiées", fr(S.structures_payees_non_verifiees), S.structures_payees_non_verifiees ? "surveiller" : "ok"], ["Abonnements à renouveler dans 30 jours", fr(S.abonnements_30j)]]));
    etats.push(bloc(g, "offre", "Offres", S.offres_expirees_publiees ? ["surveiller", "À surveiller"] : ["ok", "OK"], null,
      [["Expirées mais encore marquées publiées", fr(S.offres_expirees_publiees), S.offres_expirees_publiees ? "surveiller" : "ok"], ["En ligne", fr(compte(D.offres, function (o) { return o.publiee && o.expire_le >= AUJ; }))]]));
    // les derniers événements
    var ev = el("section", "ap-carte ap-sante-c ap-evts"); var eh = el("div", "ap-carte-h"); var et = el("h3"); et.appendChild(ic("coche", "ap-ic-mini")); et.appendChild(document.createTextNode("Derniers événements")); eh.appendChild(et); ev.appendChild(eh);
    (S.evenements || []).slice(0, 8).forEach(function (x) { var p = el("p", "ap-sante-l"); p.appendChild(el("i", "ap-dot ap-dot-" + (x.envoye ? "ok" : "neutre"))); var s = el("span"); s.appendChild(el("b", null, ({ profil: "Profil", structure: "Structure", paiement: "Paiement", demande: "Demande" })[x.type] || x.type)); s.appendChild(el("small", null, (x.resume || "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "(e-mail)") + " · " + heure(x.cree_le))); p.appendChild(s); ev.appendChild(p); });
    if (!(S.evenements || []).length) ev.appendChild(el("p", "ap-vide", "Aucun événement pour l'instant."));
    g.appendChild(ev);
    var nb = etats.filter(function (e) { return e !== "ok"; }).length;
    var cote = el("div", "ap-hero-cote"); cote.appendChild(el("p", "ap-mini-t", "En ce moment"));
    cote.appendChild(el("p", nb ? "ap-cote-gros ap-jaune" : "ap-cote-gros ap-vert", nb ? nb + " point" + (nb > 1 ? "s" : "") + " à surveiller" : "Tout va bien"));
    cote.appendChild(el("p", "ap-petit", etats.length + " blocs sur " + etats.length + " vérifiés · " + (verifieA ? "à " + verifieA.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "")));
    var rev = el("button", "ap-lien-b", "↻ Revérifier"); rev.type = "button";
    rev.addEventListener("click", async function () { rev.disabled = true; await toutLire(); sante(); });
    hero(c, "État de santé", "Tout ce qui doit marcher, ", "au même endroit",
      "Publication, relevés, chiffres, e-mails, base et fichiers : chaque bloc dit ce qui se passe et quoi faire.", [rev, bouton("Vue d'ensemble", "accueil")], cote);
    c.appendChild(g);
    var p = document.querySelector('[data-pastille-admin="sante"]'); if (p) { p.hidden = !nb; p.textContent = nb; }
  }

  /* ---------- 4. les ventes ---------- */
  function ventes() {
    var c = $("ad-ventes"); if (!c) return; c.textContent = "";
    var st = D.structures, payees = st.filter(paye), an = payees.reduce(function (a, s) { return a + prixAn(s); }, 0);
    var fond = compte(payees, function (s) { return s.fondatrice; });
    var cote = el("div", "ap-hero-cote"); cote.appendChild(el("p", "ap-mini-t", "Par an aujourd'hui"));
    cote.appendChild(el("p", "ap-cote-gros", euros(an)));
    cote.appendChild(el("p", "ap-petit", payees.length + " abonnement" + (payees.length > 1 ? "s" : "") + " · environ " + euros(an * 0.985 - payees.length * 0.25) + " après les frais Stripe"));
    var j = el("div", "ap-jauge"); var ji = el("i"); ji.style.width = Math.min(100, fond / 10 * 100) + "%"; j.appendChild(ji); cote.appendChild(j);
    cote.appendChild(el("p", "ap-petit", "Offre fondateurs : " + fond + " place" + (fond > 1 ? "s" : "") + " prise" + (fond > 1 ? "s" : "") + " sur 10"));
    hero(c, "Ventes", "Ce que rapportent vos abonnements, ", "mois après mois",
      "Où en sont les structures, de l'inscription à la page payée, et à qui écrire cette semaine.", [bouton("← Vue d'ensemble", "accueil")], cote);
    var g = grille(c, "ap-g2");
    // l'entonnoir des structures
    var e = carte(g, "Structures : de l'inscription à la page en ligne");
    var avecOffre = {}; D.offres.forEach(function (o) { if (o.publiee && o.expire_le >= AUJ) avecOffre[o.structure_id] = 1; });
    var remplie = function (s) { return [s.nom, s.ville, s.presentation, s.projet, (s.photos || []).length, s.logo, (s.accueils || []).length || s.type, s.age_min != null || (s.publics || []).length, s.email_contact, s.identifiant].filter(Boolean).length >= 7; };
    var etapes = [["Fiche créée", st.length], ["Fiche bien remplie", compte(st, remplie)], ["Abonnement payé", payees.length], ["Vérifiée", compte(st, function (s) { return paye(s) && s.verifiee; })],
                  ["Page publique", compte(st, function (s) { return paye(s) && s.verifiee && s.page_publique && s.slug; })], ["Avec une offre en ligne", Object.keys(avecOffre).length]];
    var ul = el("ul", "ap-entonnoir");
    etapes.forEach(function (x, i) { var li = el("li"); li.appendChild(el("span", null, x[0])); var b = el("span", "ap-b-barre"), r = el("i"); r.style.width = (st.length ? Math.max(2, x[1] / st.length * 100) : 2) + "%"; b.appendChild(r); li.appendChild(b); li.appendChild(el("b", null, x[1] + (i ? " · " + pct(x[1], st.length) : ""))); ul.appendChild(li); });
    e.appendChild(ul);
    // les animateurs, côté activité
    var a = carte(g, "Animateurs : de l'inscription à la candidature");
    var T = types(), ani = T.filter(function (t) { return t.type === "animateur" || (t.type === "aucun"); });
    var ontPostule = {}; D.candidatures.forEach(function (x) { ontPostule[x.candidat_id] = 1; });
    var ontDemande = {}; D.demandes.forEach(function (x) { if (x.candidat_id) ontDemande[x.candidat_id] = 1; });
    var et2 = [["Comptes (hors structures)", ani.length], ["Profil créé", D.profils.length], ["Profil visible", compte(D.profils, function (p) { return p.publie; })], ["Avec CV", compte(D.profils, function (p) { return p.cv_nom; })],
               ["Ont postulé", Object.keys(ontPostule).length], ["Ont envoyé une demande", Object.keys(ontDemande).length]];
    var ul2 = el("ul", "ap-entonnoir");
    et2.forEach(function (x, i) { var li = el("li"); li.appendChild(el("span", null, x[0])); var b = el("span", "ap-b-barre"), r = el("i"); r.style.width = (et2[0][1] ? Math.max(2, x[1] / et2[0][1] * 100) : 2) + "%"; b.appendChild(r); li.appendChild(b); li.appendChild(el("b", null, String(x[1]))); ul2.appendChild(li); });
    a.appendChild(ul2);
    // les inscriptions par semaine
    var s = carte(c, "Inscriptions par semaine", "8 dernières semaines");
    var sem = [], noms = []; for (var i = 7; i >= 0; i--) { var d = new Date(auj); d.setDate(d.getDate() - d.getDay() + 1 - i * 7); sem.push(d.toISOString().slice(0, 10)); noms.push(d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })); }
    var dans = function (t, k) { var x = iso(t.c.cree_le); return x >= sem[k] && (k === 7 || x < sem[k + 1]); };
    var cols = el("div", "ap-colonnes"), mx = 1;
    var vals = sem.map(function (_, k) { var an2 = compte(T, function (t) { return dans(t, k) && t.type !== "structure"; }), st2 = compte(T, function (t) { return dans(t, k) && t.type === "structure"; }); mx = Math.max(mx, an2 + st2); return [an2, st2]; });
    vals.forEach(function (v, k) { var col = el("div", "ap-col-s"); col.appendChild(el("b", null, String(v[0] + v[1]))); var pile = el("div", "ap-pile"); var a1 = el("i", "ap-s1"); a1.style.height = (v[0] / mx * 100) + "%"; var a2 = el("i", "ap-s2"); a2.style.height = (v[1] / mx * 100) + "%"; pile.appendChild(a2); pile.appendChild(a1); col.appendChild(pile); col.appendChild(el("small", null, noms[k])); cols.appendChild(col); });
    s.appendChild(cols); legende(s, [["Animateurs et comptes sans fiche", "ap-s1"], ["Structures", "ap-s2"]]);
    // à qui écrire
    var g2 = grille(c, "ap-g2");
    function listeRelance(titre, sous, l, objet, corps) {
      var k = carte(g2, titre, String(l.length)); k.appendChild(el("p", "ap-petit", sous));
      l.slice(0, 12).forEach(function (x) {
        var r = el("div", "ap-res"); var tx = el("span"); tx.appendChild(el("b", null, x.nom || "Sans nom")); tx.appendChild(el("small", null, (x.ville || "") + (x.departement ? " (" + x.departement + ")" : "") + " · inscrite " + depuis(x.cree_le) + (x.abonnement_fin ? " · abonnement jusqu'au " + E.dateFr(x.abonnement_fin) : ""))); r.appendChild(tx);
        var bs = el("span", "ap-boutons");
        if (x.email_contact) { var m = el("a", "ap-bouton", "✉ Écrire"); m.href = "mailto:" + x.email_contact + "?subject=" + encodeURIComponent(objet) + "&body=" + encodeURIComponent(corps(x)); bs.appendChild(m); }
        var f2 = el("button", "ap-lien-b", "Fiche"); f2.type = "button"; f2.addEventListener("click", function () { location.href = "/compte/?role=structure&compte=" + encodeURIComponent(x.id); }); bs.appendChild(f2);
        r.appendChild(bs); k.appendChild(r);
      });
      if (!l.length) k.appendChild(el("p", "ap-vide", "Personne pour l'instant."));
    }
    listeRelance("Fiches sans abonnement", "Elles ont rempli leur page sans payer : un mot pour les aider à franchir le pas.", st.filter(function (x) { return !paye(x); }),
      "Votre page sur Fil Roug'Anim", function (x) { return "Bonjour,\n\nMerci d'avoir créé la page de " + (x.nom || "votre structure") + " sur Fil Roug'Anim. Il ne reste qu'une étape pour la mettre en ligne avec vos offres : l'abonnement (" + (compte(st, function (y) { return y.fondatrice && paye(y); }) < 10 ? "39,50 € par an au tarif fondateur, à vie" : "79 € par an") + ", sans commission).\n\nUne question ? Répondez simplement à ce message.\n\nBonne journée,\nFil Roug'Anim"; });
    listeRelance("Abonnements à renouveler", "Ils se terminent dans les 60 jours : prévenez avant la coupure.", st.filter(function (x) { return x.abonnement_fin && x.abonnement_fin >= AUJ && x.abonnement_fin <= new Date(auj.getTime() + 60 * 864e5).toISOString().slice(0, 10); }),
      "Votre abonnement Fil Roug'Anim", function (x) { return "Bonjour,\n\nL'abonnement de " + (x.nom || "votre structure") + " se termine le " + E.dateFr(x.abonnement_fin) + ". Pour garder votre page et vos offres en ligne, pensez à le renouveler depuis votre espace.\n\nBonne journée,\nFil Roug'Anim"; });
  }


  /* ====================================================================================
     Partie 2 : membres, annuaires (structures, animateurs, organismes), visibilité,
     provenance et prospection
     ==================================================================================== */
  var G = null, ORG = null, PROS = null, SORG = {}, CORG = [];
  function slugOrg(t) { return (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function statsOrg(cle) { return SORG[cle] || { vue_page: 0, clic_session: 0, clic_site: 0 }; }
  function clicsOrg(cle) { var x = statsOrg(cle); return x.clic_session + x.clic_site; }
  function rapportOrg(nom, cle, email) {
    var x = statsOrg(cle);
    var corps = "Bonjour,\n\nVoici ce que vos sessions ont reçu sur Fil Roug'Anim (filrouganim.fr) ces 30 derniers jours :\n\n"
      + "- " + x.clic_session + " clics vers vos pages de sessions\n- " + x.clic_site + " clics vers votre site\n- " + x.vue_page + " vues de votre page organisme\n\n"
      + "Ces visiteurs sont des jeunes qui comparent les sessions BAFA, BAFD et PSC près de chez eux. La formule partenaire met vos sessions en avant dans vos régions et vous envoie ces chiffres chaque mois.\n\n"
      + "Le détail : https://filrouganim.fr/organismes-partenaires/\n\nBonne journée,\nRafael · Fil Roug'Anim";
    return "mailto:" + (email || "") + "?subject=" + encodeURIComponent(nom + " sur Fil Roug'Anim : vos chiffres du mois") + "&body=" + encodeURIComponent(corps);
  }   // Google (chiffres/google.json), organismes (compte/organismes.json), prospects
  function tableau(c, entetes, lignes) {
    var t = el("table", "ap-table"), th = el("thead"), tr = el("tr");
    entetes.forEach(function (h) { tr.appendChild(el("th", null, h)); }); th.appendChild(tr); t.appendChild(th);
    var tb = el("tbody"); lignes.forEach(function (l) { var r = el("tr"); l.forEach(function (x) { var td = el("td"); if (x && x.nodeType) td.appendChild(x); else td.textContent = x == null ? "" : x; r.appendChild(td); }); tb.appendChild(r); });
    t.appendChild(tb); var w = el("div", "ap-table-boite"); w.appendChild(t); c.appendChild(w);
    if (!lignes.length) w.appendChild(el("p", "ap-vide ap-table-vide", "Rien ici pour l'instant."));
  }
  function cellule(titre, sous) { var d = el("div", "ap-cel"); d.appendChild(el("b", null, titre || "–")); if (sous) d.appendChild(el("small", null, sous)); return d; }
  function actions(liste) { var d = el("div", "ap-boutons ap-boutons-fin"); liste.forEach(function (a) { if (!a) return; var b;
      if (a[2]) { b = el("a", "ap-lien-b", a[0]); b.href = a[2]; if (!/^mailto:/.test(a[2])) { b.target = "_blank"; b.rel = "noopener"; } }
      else { b = el("button", "ap-lien-b" + (a[3] ? " " + a[3] : ""), a[0]); b.type = "button"; b.addEventListener("click", a[1]); }
      d.appendChild(b); }); return d; }
  function ouvrirEspace(role, id) { location.href = "/compte/?role=" + role + "&compte=" + encodeURIComponent(id); }
  function chiffres(c, liste) { var g = el("div", "ap-chiffres"); liste.forEach(function (x) { var d = el("div", x[2] ? "ap-chiffre-" + x[2] : null); d.appendChild(el("b", null, x[0])); d.appendChild(el("span", null, x[1])); g.appendChild(d); }); c.appendChild(g); }
  function vues30(id) { var v = 0, k = 0; D.vues_structures && D.vues_structures.forEach(function (x) { if (x.structure_id === id && x.jour >= joursAvant(29)) { if (x.type === "page" || x.type === "offre") v += x.n; else if (x.type.indexOf("clic_") === 0) k += x.n; } }); return [v, k]; }

  /* ---------- Membres ---------- */
  var mb = { f: "tous", q: "", tri: "recent", vue: "grille" };
  function derniereAction(t) {
    var l = [];
    if (t.p && t.p.maj_le) l.push([t.p.maj_le, "a mis à jour son profil"]);
    if (t.s && t.s.maj_le) l.push([t.s.maj_le, "a mis à jour sa page"]);
    D.candidatures.forEach(function (x) { if (x.candidat_id === t.c.id) l.push([x.cree_le, "a postulé à une offre"]); });
    D.demandes.forEach(function (x) { if (x.candidat_id === t.c.id) l.push([x.cree_le, "a envoyé une demande"]); });
    D.offres.forEach(function (x) { if (x.structure_id === t.c.id) l.push([x.cree_le, "a publié une offre"]); });
    l.sort(function (a, b) { return (b[0] || "").localeCompare(a[0] || ""); });
    return l[0] ? l[0][1] + " · " + E.dateFr(iso(l[0][0])) : "Rien dans l'espace pour l'instant";
  }
  function membresPage() {
    var c = $("ad-comptes"); if (!c) return; c.textContent = "";
    var T = types(), adm = D.comptes.filter(function (x) { return D.admins.indexOf(x.id) >= 0; });
    var an = D.structures.filter(paye).reduce(function (a, s) { return a + prixAn(s); }, 0);
    hero(c, "Membres", "Tous vos membres, ", "au même endroit",
      fr(D.comptes.length) + " comptes, dont " + compte(T, function (t) { return t.type === "animateur"; }) + " animateurs et " + compte(T, function (t) { return t.type === "structure"; }) + " structures. Cliquez sur un membre pour ouvrir son espace.", [bouton("← Vue d'ensemble", "accueil")]);
    var k = el("div", "ap-carte"); c.appendChild(k);
    chiffres(k, [[fr(T.length), "membres"], [fr(compte(T, function (t) { return t.type === "animateur"; })), "animateurs"], [fr(compte(T, function (t) { return t.s && paye(t.s); })), "structures payantes", "rouge"],
                 [fr(compte(T, function (t) { return t.s && !paye(t.s); })), "structures sans abonnement"], [fr(compte(T, function (t) { return t.type === "aucun"; })), "sans fiche"],
                 [fr(compte(T, function (t) { return (t.p && t.p.provenance) || (t.s && t.s.provenance); })), "provenance connue"], [euros(an / 12), "par mois", "rouge"]]);
    // la barre d'outils
    var barre = el("div", "ap-barre-outils"); c.appendChild(barre);
    var csv = el("button", "ap-lien-b", "⇩ Exporter CSV"); csv.type = "button"; barre.appendChild(csv);
    var q = el("input", "ap-recherche"); q.type = "search"; q.placeholder = "Nom ou e-mail…"; q.value = mb.q; barre.appendChild(q);
    var F = { tous: ["Tous", function () { return true; }], animateur: ["Animateurs", function (t) { return t.type === "animateur"; }], payante: ["Structures payantes", function (t) { return t.s && paye(t.s); }],
              gratuite: ["Structures sans abonnement", function (t) { return t.s && !paye(t.s); }], aucun: ["Sans fiche", function (t) { return t.type === "aucun"; }], inactif: ["Jamais revenus", function (t) { return !t.c.derniere || iso(t.c.derniere) === iso(t.c.cree_le); }] };
    var puces = el("div", "ap-puces"); barre.appendChild(puces);
    Object.keys(F).forEach(function (cle) { var b = el("button", null, F[cle][0] + " " + compte(T, F[cle][1])); b.type = "button"; b.setAttribute("aria-pressed", mb.f === cle ? "true" : "false"); b.addEventListener("click", function () { mb.f = cle; membresPage(); }); puces.appendChild(b); });
    var tri = el("select", "ap-select"); [["recent", "Inscription la plus récente"], ["ancien", "Inscription la plus ancienne"], ["visite", "Dernière visite"], ["nom", "Nom"]].forEach(function (x) { var o = el("option", null, x[1]); o.value = x[0]; if (mb.tri === x[0]) o.selected = true; tri.appendChild(o); });
    tri.addEventListener("change", function () { mb.tri = tri.value; membresPage(); }); barre.appendChild(tri);
    var vue = el("div", "ap-periodes"); [["grille", "▦"], ["liste", "☰"]].forEach(function (x) { var b = el("button", null, x[1]); b.type = "button"; b.title = x[0] === "grille" ? "En cartes" : "En liste"; b.setAttribute("aria-pressed", mb.vue === x[0] ? "true" : "false"); b.addEventListener("click", function () { mb.vue = x[0]; membresPage(); }); vue.appendChild(b); }); barre.appendChild(vue);
    var zone = el("div", mb.vue === "grille" ? "ap-cartes-m" : "ap-liste-m"); c.appendChild(zone);
    function liste() {
      var m = mb.q.trim().toLowerCase();
      var L = T.filter(F[mb.f][1]).filter(function (t) { return !m || (nomDe(t) + " " + (t.c.email || "")).toLowerCase().indexOf(m) >= 0; });
      L.sort(function (a, b) {
        if (mb.tri === "ancien") return (a.c.cree_le || "").localeCompare(b.c.cree_le || "");
        if (mb.tri === "visite") return (b.c.derniere || "").localeCompare(a.c.derniere || "");
        if (mb.tri === "nom") return nomDe(a).localeCompare(nomDe(b));
        return (b.c.cree_le || "").localeCompare(a.c.cree_le || "");
      });
      return L;
    }
    function remplir() {
      zone.textContent = "";
      var L = liste();
      L.slice(0, 120).forEach(function (t) {
        var k2 = el("article", "ap-membre"), nom = nomDe(t);
        var h = el("div", "ap-membre-h"); h.appendChild(el("span", "ap-av", nom.split(/\s+/).map(function (x) { return x[0]; }).join("").slice(0, 2).toUpperCase()));
        var tx = el("div", "ap-membre-t"); tx.appendChild(el("b", null, nom)); tx.appendChild(el("small", null, t.c.email || "")); h.appendChild(tx);
        h.appendChild(etiquette(t.type === "structure" ? (paye(t.s) ? (t.s.fondatrice ? "Fondatrice" : "Abonnée") : "Structure") : t.type === "animateur" ? "Animateur" : "Sans fiche", t.s && paye(t.s) ? "ok" : t.type === "aucun" ? "jaune" : null));
        k2.appendChild(h);
        var info = el("div", "ap-membre-i");
        var bloc2 = function (titre, valeur, pastille) { var d = el("div"); d.appendChild(el("small", null, titre)); if (pastille) d.appendChild(etiquette(valeur, pastille)); else d.appendChild(el("b", null, valeur)); info.appendChild(d); };
        bloc2("Inscrit", E.dateFr(iso(t.c.cree_le)));
        var dv = t.c.derniere && iso(t.c.derniere) !== iso(t.c.cree_le) ? depuis(t.c.derniere) : "Jamais revenu";
        bloc2("Dernière visite", dv.charAt(0).toUpperCase() + dv.slice(1), dv === "aujourd'hui" ? "ok" : dv === "Jamais revenu" ? "jaune" : "neutre");
        var da = el("div", "ap-membre-a"); da.appendChild(el("small", null, "Dernière action")); da.appendChild(el("span", null, derniereAction(t))); info.appendChild(da);
        k2.appendChild(info);
        var tags = el("p", "ap-membre-tags");
        if (t.p) (t.p.diplomes || []).slice(0, 3).forEach(function (x) { tags.appendChild(etiquette(lib("diplomes", x))); });
        if (t.s) { (t.s.accueils || []).slice(0, 2).forEach(function (x) { tags.appendChild(etiquette(lib("accueils_st", x))); }); if (t.s.ville) tags.appendChild(etiquette(t.s.ville)); }
        if (t.p && t.p.departement) tags.appendChild(etiquette(nomDep(t.p.departement)));
        var prov = (t.p && t.p.provenance) || (t.s && t.s.provenance);
        if (prov) tags.appendChild(etiquette("via " + canal(prov), "rose"));
        if (tags.children.length) k2.appendChild(tags);
        k2.appendChild(actions([t.s ? ["Espace", function () { ouvrirEspace("structure", t.c.id); }] : t.p ? ["Espace", function () { ouvrirEspace("candidat", t.c.id); }] : null,
          t.c.email ? ["✉ Écrire", null, "mailto:" + t.c.email] : null, t.p ? ["Fiche", function () { E.ouvrirFiche(E.ficheProfil(t.p, {})); }] : null]));
        zone.appendChild(k2);
      });
      if (!L.length) zone.appendChild(el("p", "ap-vide", "Personne ici."));
    }
    q.addEventListener("input", function () { mb.q = q.value; remplir(); });
    csv.addEventListener("click", function () {
      var lignes = [["nom", "email", "type", "inscrit", "derniere_visite", "departement", "abonnement_fin", "provenance"]].concat(liste().map(function (t) {
        return [nomDe(t), t.c.email || "", t.type, iso(t.c.cree_le), iso(t.c.derniere), (t.p && t.p.departement) || (t.s && t.s.departement) || "", (t.s && t.s.abonnement_fin) || "", (t.p && t.p.provenance) || (t.s && t.s.provenance) || ""];
      }));
      var txt = lignes.map(function (l) { return l.map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(";"); }).join("\n");
      var a = el("a"); a.href = URL.createObjectURL(new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" })); a.download = "membres-filrouganim-" + AUJ + ".csv"; document.body.appendChild(a); a.click(); a.remove();
    });
    remplir();
  }

  /* ---------- en-têtes des annuaires : structures et animateurs ---------- */
  function enteteStructures() {
    var c = $("ad-structures"); if (!c) return;
    var w = el("div", "ap-entete-annuaire"), st = D.structures;
    var enLigne = st.filter(function (s) { return s.verifiee; }), aVerif = st.filter(function (s) { return !s.verifiee; }), abonnees = enLigne.filter(paye);
    enLigne.sort(function (a, b) { return paye(b) - paye(a); });
    hero(w, "Annuaire des structures", "Les structures ", "de l'annuaire",
      "Une structure remplit sa fiche, vous la vérifiez, elle est en ligne gratuitement (sa page et une offre). L'abonnement ajoute les demandes, les profils et les offres illimitées. Ici : celles à vérifier, celles en ligne, et les abonnées.", [bouton("← Vue d'ensemble", "accueil")]);
    chiffres(w, [[String(aVerif.length), "à vérifier", aVerif.length ? "rouge" : null], [String(enLigne.length), "en ligne"], [String(abonnees.length), "abonnées"],
                 [compte(st, function (s) { return s.fondatrice && paye(s); }) + "/10", "fondatrices"], [String(compte(enLigne, function (s) { return !s.page_publique; })), "pages cachées"]]);
    var s2 = el("p", "ap-titre-s"); s2.appendChild(el("i", "ap-dot ap-dot-surveiller")); s2.appendChild(document.createTextNode("À vérifier · " + aVerif.length)); w.appendChild(s2);
    w.appendChild(el("p", "ap-petit", "Vérifiez le SIRET, le RNA ou la déclaration d'accueil, puis mettez en ligne : la page et l'offre paraissent à la publication suivante. Une fiche vide ou douteuse : écrivez à la structure avant."));
    tableau(w, ["Structure", "Ville", "Identifiant", "Inscrite", ""], aVerif.map(function (s) {
      return [cellule(s.nom || "Sans nom", s.email_contact), cellule(s.ville, s.departement), cellule(s.identifiant || "non donné", s.site || ""), cellule(depuis(s.cree_le), paye(s) ? "abonnée jusqu'au " + E.dateFr(s.abonnement_fin) : "formule gratuite"),
        actions([["✓ Vérifier", function () { A.modifier("structures", s.id, { verifiee: true }); }, null, "ap-fort"], ["Espace", function () { ouvrirEspace("structure", s.id); }],
                 s.email_contact ? ["✉ Écrire", null, "mailto:" + s.email_contact + "?subject=" + encodeURIComponent("Votre page sur Fil Roug'Anim")] : null,
                 ["Supprimer", function () { A.supprimer("structures", s.id, s.nom); }, null, "ap-danger"]])];
    }));
    var s1 = el("p", "ap-titre-s"); s1.appendChild(el("i", "ap-dot")); s1.appendChild(document.createTextNode("En ligne dans l'annuaire · " + enLigne.length + " dont " + abonnees.length + " abonnée" + (abonnees.length > 1 ? "s" : ""))); w.appendChild(s1);
    tableau(w, ["Structure", "Ville", "Accueils · âges", "Stats 30 jours", ""], enLigne.map(function (s) {
      var v = vues30(s.id);
      return [cellule((s.fondatrice ? "★ " : "") + s.nom, s.email_contact), cellule(s.ville, s.departement ? nomDep(s.departement) : ""),
        cellule((s.accueils || []).map(function (x) { return lib("accueils_st", x); }).join(", ") || lib("types", s.type), s.age_min != null ? s.age_min + " à " + s.age_max + " ans" : ""),
        cellule("👁 " + v[0] + " · ↗ " + v[1], paye(s) ? "abonnée jusqu'au " + E.dateFr(s.abonnement_fin) : "formule gratuite"),
        actions([["Espace", function () { ouvrirEspace("structure", s.id); }], s.slug && s.page_publique ? ["Page", null, "/trouver-un-poste/structures/" + s.slug + "/"] : null,
                 [s.page_publique ? "Masquer" : "Afficher", function () { A.modifier("structures", s.id, { page_publique: !s.page_publique }); }]])];
    }));
    w.appendChild(el("p", "ap-titre-s", "Toutes les fiches, étape par étape"));
    c.insertBefore(w, c.firstChild);
  }
  function enteteAnimateurs() {
    var c = $("ad-animateurs"); if (!c) return;
    var w = el("div", "ap-entete-annuaire"), P = D.profils.filter(function (p) { return D.admins.indexOf(p.id) < 0; });
    var post = {}; D.candidatures.forEach(function (x) { post[x.candidat_id] = (post[x.candidat_id] || 0) + 1; });
    var dem = {}; D.demandes.forEach(function (x) { if (x.candidat_id) dem[x.candidat_id] = (dem[x.candidat_id] || 0) + 1; });
    hero(w, "Annuaire des animateurs", "Les animateurs ", "de l'annuaire",
      "Inscription libre et gratuite : vous n'intervenez que pour cacher un profil, ou aider quelqu'un qui n'a pas fini le sien.", [bouton("← Vue d'ensemble", "accueil")]);
    chiffres(w, [[String(P.length), "profils"], [String(compte(P, function (p) { return p.publie; })), "visibles", "rouge"], [String(compte(P, function (p) { return p.cv_nom; })), "avec CV"],
                 [String(Object.keys(post).length), "ont postulé"], [String(Object.keys(dem).length), "ont envoyé une demande"], [String(compte(P, function (p) { return p.annee_naissance && auj.getFullYear() - p.annee_naissance < 18; })), "mineurs"]]);
    var s1 = el("p", "ap-titre-s"); s1.appendChild(el("i", "ap-dot")); s1.appendChild(document.createTextNode("Les derniers profils · " + Math.min(P.length, 25) + " sur " + P.length)); w.appendChild(s1);
    tableau(w, ["Animateur", "Lieu", "Diplômes", "Activité", ""], P.slice().sort(function (a, b) { return (b.maj_le || "").localeCompare(a.maj_le || ""); }).slice(0, 25).map(function (p) {
      return [cellule(p.prenom + (p.annee_naissance ? ", " + (auj.getFullYear() - p.annee_naissance) + " ans" : ""), p.email_contact), cellule(p.ville || nomDep(p.departement), p.departement),
        cellule((p.diplomes || []).map(function (x) { return lib("diplomes", x); }).join(", ") || "–", p.poste_recherche || ""),
        cellule((post[p.id] || 0) + " candidature" + ((post[p.id] || 0) > 1 ? "s" : "") + " · " + (dem[p.id] || 0) + " demande" + ((dem[p.id] || 0) > 1 ? "s" : ""), (p.publie ? "visible" : "caché") + " · maj " + depuis(p.maj_le)),
        actions([["Espace", function () { ouvrirEspace("candidat", p.id); }], ["Fiche", function () { E.ouvrirFiche(E.ficheProfil(p, {})); }], [p.publie ? "Cacher" : "Afficher", function () { A.modifier("profils", p.id, { publie: !p.publie }); }]])];
    }));
    w.appendChild(el("p", "ap-titre-s", "Tous les profils"));
    c.insertBefore(w, c.firstChild);
  }

  /* ---------- Organismes de formation (les futurs clients) ---------- */
  var STATUTS_P = { a_contacter: ["À contacter", null], contacte: ["Contacté", "jaune"], repondu: ["A répondu", "rose"], interesse: ["Intéressé", "ok"], client: ["Client", "ok"], pas_interesse: ["Pas intéressé", "neutre"] };
  function prospect(cle) { return (PROS || []).filter(function (x) { return x.cle === cle; })[0] || null; }
  async function enregistrerProspect(x) {
    // seulement les colonnes de la table (les fiches affichées portent aussi des infos calculées)
    var p = { cle: x.cle, type: x.type, nom: x.nom || null, email: x.email || null, ville: x.ville || null, statut: x.statut || "a_contacter", etapes: x.etapes || [], note: x.note || null };
    p.maj = new Date().toISOString();
    var r = await E.sb.from("admin_prospects").upsert(p);
    if (r && r.error) { E.message(E.erreur(r.error), true); return; }
    var i = (PROS || []).findIndex(function (x) { return x.cle === p.cle; }); if (i >= 0) PROS[i] = p; else (PROS = PROS || []).push(p);
    E.message("Enregistré."); organismes(); prospection();
  }
  function selectStatut(p) {
    var s2 = el("select", "ap-select"); Object.keys(STATUTS_P).forEach(function (k) { var o = el("option", null, STATUTS_P[k][0]); o.value = k; if ((p.statut || "a_contacter") === k) o.selected = true; s2.appendChild(o); });
    s2.addEventListener("change", function () { enregistrerProspect(Object.assign({}, p, { statut: s2.value })); }); return s2;
  }
  function organismes() {
    var c = $("ad-organismes"); if (!c) return; c.textContent = "";
    var o = ORG || { suivis: [], autres: [] };
    var sessions = o.suivis.reduce(function (a, x) { return a + x.n; }, 0);
    var clients = compte(PROS || [], function (p) { return p.type === "organisme" && p.statut === "client"; });
    hero(c, "Organismes de formation", "Les organismes, ", "vos futurs clients",
      "Les organismes du BAFA, du BAFD, du BSB et du PSC dont le site compare les sessions. Le projet : une formule payante pour eux (mise en avant, page soignée, statistiques). Suivez ici qui vous avez contacté.", [bouton("Prospection", "prospection", true, "avion"), bouton("← Vue d'ensemble", "accueil")]);
    var totalClics = Object.keys(SORG).reduce(function (a, k) { return a + clicsOrg(k); }, 0);
    chiffres(c, [[fr(totalClics), "clics envoyés · 30 j", "rouge"], [String(CORG.length), "demandes reçues"], [String(o.suivis.length), "organismes suivis"], [fr(sessions), "sessions comparées"], [String(o.autres.length), "autres repérés"],
                 [String(compte(PROS || [], function (p) { return p.type === "organisme" && p.statut !== "a_contacter"; })), "contactés"], [String(clients), "clients", "rouge"]]);
    if (CORG.length) {
      var s0 = el("p", "ap-titre-s"); s0.appendChild(el("i", "ap-dot")); s0.appendChild(document.createTextNode("Demandes reçues par la page « Organismes partenaires » · " + CORG.length)); c.appendChild(s0);
      tableau(c, ["Organisme", "Contact", "Message", "Reçue", ""], CORG.map(function (x) {
        var cle = SORG[x.organisme.toLowerCase()] ? x.organisme.toLowerCase() : "x-" + slugOrg(x.organisme);
        var connu = (o.suivis || []).filter(function (y) { return slugOrg(y.nom) === slugOrg(x.organisme); })[0];
        if (connu) cle = connu.id;
        return [cellule(x.organisme), cellule(x.nom || "–", [x.email, x.telephone].filter(Boolean).join(" · ")), cellule((x.message || "–").slice(0, 140)), cellule(depuis(x.cree_le)),
          actions([["✉ Envoyer ses chiffres", null, rapportOrg(x.organisme, cle, x.email)]])];
      }));
    }
    var s1 = el("p", "ap-titre-s"); s1.appendChild(el("i", "ap-dot")); s1.appendChild(document.createTextNode("Organismes avec leur page sur le site · " + o.suivis.length + " · triés par clics reçus")); c.appendChild(s1);
    c.appendChild(el("p", "ap-petit", "Les clics comptent depuis la mise en place du compteur. « Ses chiffres » prépare un e-mail avec ses vues et ses clics des 30 derniers jours : votre meilleur argument pour la formule partenaire."));
    var tri = o.suivis.slice().sort(function (a, b) { return clicsOrg(b.id) - clicsOrg(a.id) || b.n - a.n; });
    tableau(c, ["Organisme", "Sessions", "30 jours", "Prix dès", "Prospection", ""], tri.map(function (x) {
      var cle = "org:" + x.id, p = prospect(cle) || { cle: cle, type: "organisme", nom: x.nom, statut: "a_contacter", etapes: [] }, st = statsOrg(x.id);
      return [cellule(x.nom, (x.habilitation ? "habilitation " + x.habilitation : "")), cellule(fr(x.n), x.villes + " villes · " + x.diplomes.join(", ")),
        cellule(fr(st.clic_session + st.clic_site) + " clics", fr(st.vue_page) + " vues de sa page"), cellule(x.prix_min ? x.prix_min + " €" : "–"),
        selectStatut(p), actions([["✉ Ses chiffres", null, rapportOrg(x.nom, x.id, p.email)], x.page ? ["Sa page", null, x.page] : null, x.site ? ["Son site", null, x.site] : null])];
    }));
    var s2 = el("p", "ap-titre-s"); s2.appendChild(el("i", "ap-dot ap-dot-neutre")); s2.appendChild(document.createTextNode("Autres organismes repérés dans les sessions · " + o.autres.length)); c.appendChild(s2);
    c.appendChild(el("p", "ap-petit", "Ils ont des sessions sur le site sans page à eux : des clients possibles aussi."));
    tableau(c, ["Organisme", "Sessions", "30 jours", "Prospection", ""], o.autres.slice(0, 60).map(function (x) {
      var cle = "org-autre:" + x.nom.toLowerCase().replace(/[^a-z0-9]+/g, "-"), p = prospect(cle) || { cle: cle, type: "organisme", nom: x.nom, statut: "a_contacter", etapes: [] }, k = ("x-" + slugOrg(x.nom)).slice(0, 80);
      return [cellule(x.nom), cellule(fr(x.n)), cellule(fr(clicsOrg(k)) + " clics"), selectStatut(p), actions([["✉ Ses chiffres", null, rapportOrg(x.nom, k, p.email)]])];
    }));
  }

  /* ---------- Visibilité (Google, page par page) ---------- */
  var IA = [["ChatGPT", /chatgpt|openai/i], ["Perplexity", /perplexity/i], ["Gemini", /gemini|bard/i], ["Copilot", /copilot|bing\.com\/chat/i], ["Claude", /claude/i], ["Mistral", /mistral|lechat/i]];
  function visibilite() {
    var c = $("ad-visibilite"); if (!c) return; c.textContent = "";
    var g = G || {}, P = g.pages || [];
    var cote = el("div", "ap-hero-cote"); cote.appendChild(el("p", "ap-mini-t", "Clics depuis Google · 28 j"));
    cote.appendChild(el("p", "ap-cote-gros", fr(g.clics_28j))); cote.appendChild(el("p", "ap-petit", fr(g.impressions_28j) + " affichages" + (g.gsc_du ? " du " + E.dateFr(g.gsc_du) + " au " + E.dateFr(g.gsc_au) : "")));
    cote.appendChild(el("p", "ap-mini-t", "Visiteurs du site · 30 j")); cote.appendChild(el("p", "ap-cote-gros", fr(g.visiteurs_30j)));
    hero(c, "Visibilité", "Où l'on vous trouve, ", "recherche par recherche",
      "Ce que Google montre de chaque page, sa place, et les pages qui sont à deux doigts de la première page : c'est là qu'un peu de travail rapporte le plus.", [bouton("← Vue d'ensemble", "accueil")], cote);
    var g4 = grille(c, "ap-g4");
    var prem = P.filter(function (x) { return x[4] && x[4] <= 10; });
    kpi(g4, "google", "Clics depuis Google", fr(g.clics_28j), g.clics_evolution != null ? (g.clics_evolution > 0 ? "+" : "") + g.clics_evolution + " % vs 28 j d'avant" : "premier mois mesuré");
    kpi(g4, "loupe", "Pages en première page", fr(prem.length), "sur " + fr(P.length) + " pages vues dans Google");
    kpi(g4, "coche", "Recherches en première page", fr(g.recherches_premiere_page), "sur " + fr(g.recherches_total) + " recherches");
    kpi(g4, "personne", "Visiteurs du site", fr(g.visiteurs_30j), g.visiteurs_evolution != null ? (g.visiteurs_evolution > 0 ? "+" : "") + g.visiteurs_evolution + " % vs 30 j d'avant" : "sur 30 jours");
    // Google jour par jour
    var k = carte(c, "Google, sur 28 jours", "clics et affichages par jour");
    var pj = (g.par_jour || []).slice(-28);
    if (pj.length > 1) {
      courbe(k, [{ nom: "affichages", classe: "ap-l-avant", points: pj.map(function (x) { return x[1]; }) }], pj.map(function (x) { return new Date(x[0] + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); }), 130);
      courbe(k, [{ nom: "clics", classe: "ap-l-vis", aire: true, points_visibles: true, points: pj.map(function (x) { return x[2]; }) }], pj.map(function (x) { return new Date(x[0] + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); }), 110);
      legende(k, [["Affichages (en haut)", "ap-c-avant"], ["Clics (en bas)", "ap-c-vis"]]);
    } else k.appendChild(el("p", "ap-vide", "Le détail jour par jour arrive avec le prochain relevé des chiffres."));
    // où sont nos pages
    var tr = [["1 à 3", function (p) { return p <= 3; }, "ap-s2"], ["4 à 10", function (p) { return p > 3 && p <= 10; }, "ap-s1"], ["11 à 20", function (p) { return p > 10 && p <= 20; }, "ap-s3"], ["21 à 50", function (p) { return p > 20 && p <= 50; }, "ap-s4"], ["Au-delà", function (p) { return p > 50; }, "ap-s5"]];
    var avecPlace = P.filter(function (x) { return x[4]; });
    var seg = el("div", "ap-seg ap-seg-gros"); tr.forEach(function (t) { var n = compte(avecPlace, function (x) { return t[1](x[4]); }); if (!n) return; var i = el("i", t[2]); i.style.width = (n / (avecPlace.length || 1) * 100) + "%"; i.title = t[0] + " : " + n; seg.appendChild(i); });
    var kp = carte(c, "Où sont nos pages dans Google", "place moyenne sur 28 jours");
    kp.appendChild(seg); legende(kp, tr.map(function (t) { return [t[0] + " : " + compte(avecPlace, function (x) { return t[1](x[4]); }), t[2]]; }));
    kp.appendChild(el("p", "ap-petit", pct(prem.length, avecPlace.length) + " des pages vues dans Google sont en première page."));
    // formation par formation
    var fams = [["bafa", "BAFA"], ["bafd", "BAFD"], ["bsb", "BSB"], ["psc", "PSC"], ["ecoles", "Écoles pros"], ["conseils", "Guides et blog"]];
    tableau(kp, ["Formation", "Pages vues", "En 1re page", "Affichages", "Clics"], fams.map(function (f) {
      var l = P.filter(function (x) { return x[5] === f[0]; });
      return [f[1], fr(l.length), fr(compte(l, function (x) { return x[4] && x[4] <= 10; })), fr(l.reduce(function (a, x) { return a + x[2]; }, 0)), fr(l.reduce(function (a, x) { return a + x[3]; }, 0))];
    }));
    // en tête, et à un pas de la première page
    var deux = grille(c, "ap-g2");
    function listePages(titre, sous, l, ton) {
      var k3 = carte(deux, titre); k3.appendChild(el("p", "ap-petit", sous)); var ol = el("ol", "ap-pages-g");
      l.slice(0, 12).forEach(function (x) { var li = el("li"); li.appendChild(el("span", "ap-place " + ton, String(x[4]).replace(".", ","))); var t = el("span", "ap-lus-t"); var a = el("a", null, x[1]); a.href = x[0]; a.target = "_blank"; a.rel = "noopener"; t.appendChild(a); t.appendChild(el("small", null, x[0])); li.appendChild(t); li.appendChild(el("b", null, fr(x[2]) + " aff." + (x[3] ? " · " + x[3] + " clic" + (x[3] > 1 ? "s" : "") : ""))); ol.appendChild(li); });
      if (!l.length) ol.appendChild(el("li", "ap-vide", "Aucune pour l'instant."));
      k3.appendChild(ol);
    }
    listePages("Nos pages en tête", "Places 1 à 3 : les plus vues d'abord.", P.filter(function (x) { return x[4] && x[4] <= 3; }).sort(function (a, b) { return b[2] - a[2]; }), "ap-place-top");
    listePages("À un pas de la première page", "Places 11 à 20, les plus vues d'abord : un lien depuis une autre page ou un texte plus complet peut les faire passer en page 1.", P.filter(function (x) { return x[4] > 10 && x[4] <= 20; }).sort(function (a, b) { return b[2] - a[2]; }), "ap-place-pas");
    // les recherches
    var kr = carte(c, "Recherches en première page", fr((g.recherches || []).length) + " suivies");
    tableau(kr, ["Recherche dans Google", "Place", "Affichages", "Clics"], (g.recherches || []).slice(0, 30).map(function (r) { return [r.recherche, String(r.place).replace(".", ","), fr(r.impressions), fr(r.clics)]; }));
    // les IA
    var ki = carte(c, "Les visiteurs envoyés par une IA", "30 jours");
    var prov = (S && S.audience && S.audience.donnees && S.audience.donnees.provenances) || [];
    var gi = el("div", "ap-ia"); IA.forEach(function (x) { var n = prov.filter(function (p) { return x[1].test(p[0]); }).reduce(function (a, p) { return a + p[1]; }, 0); var d = el("div", n ? "on" : null); d.appendChild(el("small", null, x[0])); d.appendChild(el("b", null, fr(n))); gi.appendChild(d); });
    ki.appendChild(gi); ki.appendChild(el("p", "ap-petit", "Quand ChatGPT, Perplexity ou Gemini citent une page du site et qu'on clique dessus. Encore rare, mais ça monte vite."));
  }

  /* ---------- Provenance (d'où viennent les visiteurs et les inscrits) ---------- */
  function canal(s) {
    s = (s || "").toLowerCase();
    if (!s || /^direct|^\(direct\)|accès direct/.test(s)) return "Accès direct";
    if (/^lien:/.test(s)) return "Liens suivis";
    if (/chatgpt|openai|perplexity|gemini|copilot|claude|mistral/.test(s)) return "IA";
    if (/google|bing|qwant|duckduckgo|ecosia|yahoo|search|lilo/.test(s)) return "Moteurs de recherche";
    if (/facebook|fb\.|messenger/.test(s)) return "Facebook";
    if (/instagram/.test(s)) return "Instagram";
    if (/tiktok|linkedin|t\.co|twitter|x\.com|youtube|snapchat|pinterest|whatsapp/.test(s)) return "Autres réseaux";
    if (/mail|outlook|gmail|brevo|sendinblue|laposte|orange\.fr|free\.fr|yahoo/.test(s)) return "E-mails";
    return "Autres sites";
  }
  var CANAUX = ["Moteurs de recherche", "Facebook", "Instagram", "Autres réseaux", "IA", "Liens suivis", "E-mails", "Autres sites", "Accès direct"];
  function provenance() {
    var c = $("ad-provenance"); if (!c) return; c.textContent = "";
    var au = (S && S.audience && S.audience.donnees) || {}, prov = au.provenances || [];
    var T = types(), insc = T.filter(function (t) { return (t.p && t.p.provenance) || (t.s && t.s.provenance); });
    var cote = el("div", "ap-hero-cote"); cote.appendChild(el("p", "ap-mini-t", "Inscriptions · 30 jours"));
    var i30 = compte(T, function (t) { return iso(t.c.cree_le) >= joursAvant(29); }); cote.appendChild(el("p", "ap-cote-gros", String(i30)));
    var parCanal = {}; insc.forEach(function (t) { var k2 = canal((t.p && t.p.provenance) || (t.s && t.s.provenance)); parCanal[k2] = (parCanal[k2] || 0) + 1; });
    var premier = Object.keys(parCanal).sort(function (a, b) { return parCanal[b] - parCanal[a]; })[0];
    cote.appendChild(el("p", "ap-petit", premier ? "Premier canal des inscrits : " + premier : "Le canal des inscrits est noté depuis cette mise à jour."));
    hero(c, "Provenance", "D'où viennent ", "vos visiteurs et vos inscrits",
      "Google, les réseaux, les e-mails, les IA, vos liens : jugé sur les inscriptions et les structures clientes, pas seulement sur les clics.", [bouton("← Vue d'ensemble", "accueil")], cote);
    // par canal
    var k = carte(c, "Par canal", "visiteurs (30 jours), inscriptions et clientes de chaque canal");
    var g = el("div", "ap-canaux"); k.appendChild(g);
    CANAUX.forEach(function (nom) {
      var vis = prov.filter(function (p) { return canal(p[0]) === nom; }).reduce(function (a, p) { return a + p[1]; }, 0);
      var ins = compte(insc, function (t) { return canal((t.p && t.p.provenance) || (t.s && t.s.provenance)) === nom; });
      var cli = compte(insc, function (t) { return t.s && paye(t.s) && canal(t.s.provenance) === nom; });
      var d = el("div", "ap-canal"); var h = el("p", "ap-canal-n"); h.appendChild(el("i", "ap-dot")); h.appendChild(document.createTextNode(nom)); d.appendChild(h);
      var tr = el("div", "ap-canal-3"); [[vis, "visiteurs"], [ins, ins > 1 ? "inscriptions" : "inscription"], [cli, cli > 1 ? "clientes" : "cliente"]].forEach(function (x) { var e = el("div"); e.appendChild(el("b", null, fr(x[0]))); e.appendChild(el("small", null, x[1])); tr.appendChild(e); });
      d.appendChild(tr);
      var noms = prov.filter(function (p) { return canal(p[0]) === nom; }).slice(0, 3).map(function (p) { return p[0] + " " + p[1]; }).join(" · ");
      if (noms) d.appendChild(el("p", "ap-petit", noms));
      g.appendChild(d);
    });
    k.appendChild(el("p", "ap-petit", "Le canal d'une inscription est celui du premier passage de la personne sur le site, noté depuis cette mise à jour : les comptes plus anciens n'en ont pas."));
    // les liens suivis (campagnes)
    var deux = grille(c, "ap-g2");
    var kc = carte(deux, "Vos liens suivis", "30 jours");
    barresH(kc, (au.campagnes || []).map(function (x) { return [x[0], x[1]]; }));
    kc.appendChild(el("p", "ap-petit", "Pour suivre un lien partagé sur Facebook, Instagram ou par e-mail, ajoutez-lui ?utm_source=facebook&utm_campaign=nom-du-post. Exemple :"));
    var ex = el("code", "ap-code", "https://filrouganim.fr/trouver-un-poste/?utm_source=instagram&utm_campaign=stage-ete"); kc.appendChild(ex);
    // les dernières inscriptions et leur canal
    var kd = carte(deux, "Les dernières inscriptions et leur canal");
    var ol = el("ol", "ap-mini-liste ap-insc");
    insc.sort(function (a, b) { return (b.c.cree_le || "").localeCompare(a.c.cree_le || ""); }).slice(0, 10).forEach(function (t) {
      var pv = (t.p && t.p.provenance) || (t.s && t.s.provenance), li = el("li");
      li.appendChild(etiquette(canal(pv), "rose")); var tx = el("span"); tx.appendChild(el("b", null, nomDe(t))); tx.appendChild(el("small", null, " · " + pv.split(" · ")[0] + " · arrivée sur " + (pv.split(" · ")[1] || "/") + " · " + depuis(t.c.cree_le))); li.appendChild(tx); ol.appendChild(li);
    });
    if (!ol.children.length) ol.appendChild(el("li", "ap-vide", "Les prochaines inscriptions s'afficheront ici avec leur canal."));
    kd.appendChild(ol);
  }

  /* ---------- Prospection ---------- */
  var pr = { onglet: "organisme", q: "" };
  var MODELES = {
    organisme: [["Premier contact", "Vos sessions BAFA sur Fil Roug'Anim",
      "Bonjour,\n\nJe suis Rafael, de Fil Roug'Anim (filrouganim.fr), le comparateur des sessions BAFA, BAFD et PSC. Vos sessions y sont déjà, avec un lien vers votre site : {sessions} sessions en ce moment.\n\nLe site reçoit chaque mois des milliers de jeunes qui cherchent leur formation près de chez eux. Je prépare une formule pour les organismes : votre page mise en avant, vos sessions en tête dans votre région, et vos statistiques (vues, clics vers votre site).\n\nEst-ce que ça vous intéresserait d'en parler 10 minutes ?\n\nBonne journée,\nRafael · Fil Roug'Anim"],
      ["Relance (7 jours)", "Re : vos sessions BAFA sur Fil Roug'Anim",
      "Bonjour,\n\nJe me permets de revenir vers vous au sujet de vos sessions sur Fil Roug'Anim. Voici votre page : {page}\n\nUn retour, même court, m'aiderait beaucoup à construire la formule organismes.\n\nBonne journée,\nRafael"],
      ["Dernière relance (14 jours)", "Dernière question",
      "Bonjour,\n\nDernier message de ma part : souhaitez-vous que je vous tienne au courant de la formule organismes quand elle sera prête ? Un simple oui ou non me suffit.\n\nMerci et bonne journée,\nRafael"]],
    structure: [["Premier contact", "Votre page sur Fil Roug'Anim",
      "Bonjour,\n\nMerci d'avoir créé la page de {nom} sur Fil Roug'Anim. Elle est en ligne gratuitement, avec une offre à la fois.\n\nSi vous recrutez pour les vacances, l'abonnement vous envoie directement les demandes des animateurs de votre secteur (ils décrivent le poste qu'ils cherchent), vous ouvre leurs profils complets et rend vos offres illimitées : 39,50 € par an au tarif fondateur, à vie, sans commission.\n\nUne question ? Répondez simplement à ce message.\n\nBonne journée,\nRafael · Fil Roug'Anim"],
      ["Relance (7 jours)", "Des animateurs cherchent dans votre secteur",
      "Bonjour,\n\nDes animateurs de votre secteur décrivent chaque semaine le poste qu'ils cherchent sur Fil Roug'Anim. Avec l'abonnement, leurs demandes arrivent directement chez {nom}.\n\nJe peux vous montrer comment ça marche en 5 minutes si vous voulez.\n\nBonne journée,\nRafael"],
      ["Dernière relance (14 jours)", "On garde votre place de fondateur ?",
      "Bonjour,\n\nIl reste quelques places au tarif fondateur (39,50 € par an, à vie). Voulez-vous que je vous en garde une ? Votre page reste gratuite dans tous les cas.\n\nBonne journée,\nRafael"]],
    contact: [["Premier contact", "Fil Roug'Anim : vos recrutements d'animateurs",
      "Bonjour,\n\nJe suis Rafael, de Fil Roug'Anim (filrouganim.fr) : les animateurs et les stagiaires BAFA de votre secteur y décrivent le poste qu'ils cherchent, et leur demande arrive chez les structures les plus proches.\n\nCréer la page de {nom} prend 6 minutes et c'est gratuit (la page et une offre) : https://filrouganim.fr/recruter/\n\nBonne journée,\nRafael · Fil Roug'Anim"],
      ["Relance (7 jours)", "Re : vos recrutements d'animateurs", "Bonjour,\n\nJe reviens vers vous : avez-vous pu jeter un œil ? Je peux créer la page avec vous au téléphone si c'est plus simple.\n\nBonne journée,\nRafael"],
      ["Dernière relance (14 jours)", "Dernière question", "Bonjour,\n\nDernier message : est-ce que vos recrutements de l'été sont déjà bouclés ? Un oui ou un non me suffit.\n\nMerci,\nRafael"]]
  };
  function contactsDe(type) {
    if (type === "organisme") return ((ORG && ORG.suivis) || []).map(function (x) { var p = prospect("org:" + x.id); return Object.assign({ cle: "org:" + x.id, type: "organisme", nom: x.nom, statut: "a_contacter", etapes: [], infos: x.n + " sessions · " + x.villes + " villes", sessions: x.n, page: "https://filrouganim.fr" + (x.page || "/se-former/sessions/organismes/"), site: x.site }, p || {}); })
      .concat(((ORG && ORG.autres) || []).slice(0, 40).map(function (x) { var cle = "org-autre:" + x.nom.toLowerCase().replace(/[^a-z0-9]+/g, "-"), p = prospect(cle); return Object.assign({ cle: cle, type: "organisme", nom: x.nom, statut: "a_contacter", etapes: [], infos: x.n + " sessions (sans page)", sessions: x.n, page: "https://filrouganim.fr/se-former/sessions/" }, p || {}); }));
    if (type === "structure") return D.structures.filter(function (s) { return !paye(s); }).map(function (s) { var cle = "st:" + s.id, p = prospect(cle); return Object.assign({ cle: cle, type: "structure", nom: s.nom || "Sans nom", email: s.email_contact, ville: s.ville, statut: "a_contacter", etapes: [], infos: (s.ville || "") + " · inscrite " + depuis(s.cree_le) }, p || {}); });
    return (PROS || []).filter(function (p) { return p.type === "contact"; }).map(function (p) { return Object.assign({ infos: p.ville || "" }, p); });
  }
  function aRelancer(p) { var e = p.etapes || []; return p.statut === "contacte" && e.length && e.length < 3 && (Date.now() - new Date(e[e.length - 1].date)) > 7 * 864e5; }
  function prospection() {
    var c = $("ad-prospection"); if (!c) return; c.textContent = "";
    var tous = contactsDe("organisme").concat(contactsDe("structure"), contactsDe("contact"));
    var cote = el("div", "ap-hero-cote"); cote.appendChild(el("p", "ap-mini-t", "À relancer"));
    cote.appendChild(el("p", "ap-cote-gros", String(compte(tous, aRelancer))));
    [["Contactés", compte(tous, function (p) { return p.statut !== "a_contacter"; })], ["Ont répondu", compte(tous, function (p) { return ["repondu", "interesse", "client"].indexOf(p.statut) >= 0; })], ["Clients", compte(tous, function (p) { return p.statut === "client"; })]].forEach(function (x) {
      var r = el("p", "ap-cote-l"); r.appendChild(el("span", null, x[0])); r.appendChild(el("b", null, String(x[1]))); cote.appendChild(r); });
    hero(c, "Prospection", "Trouvez vos clients, ", "écrivez-leur au bon moment",
      "Les organismes de formation, les structures qui n'ont pas payé, et les contacts que vous ajoutez. Trois messages prêts par type (premier contact, relance à 7 jours, dernière relance) : un clic ouvre votre messagerie, et l'étape est notée.", [bouton("← Vue d'ensemble", "accueil")], cote);
    var on = el("div", "ap-puces ap-onglets-p"); c.appendChild(on);
    [["organisme", "Organismes de formation"], ["structure", "Structures sans abonnement"], ["contact", "Contacts ajoutés"]].forEach(function (x) {
      var b = el("button", null, x[1] + " " + contactsDe(x[0]).length); b.type = "button"; b.setAttribute("aria-pressed", pr.onglet === x[0] ? "true" : "false"); b.addEventListener("click", function () { pr.onglet = x[0]; prospection(); }); on.appendChild(b); });
    var g = el("div", "ap-pros"); c.appendChild(g);
    // à gauche : la séquence de messages
    var seq = carte(g, "La séquence", "3 messages");
    MODELES[pr.onglet].forEach(function (m, i) { var d = el("div", "ap-etape-m"); d.appendChild(el("span", "ap-pastille ap-zero", String(i + 1))); var t = el("div"); t.appendChild(el("b", null, m[0])); t.appendChild(el("small", null, m[1])); d.appendChild(t); seq.appendChild(d); });
    seq.appendChild(el("p", "ap-petit", "{nom}, {sessions} et {page} se remplacent tout seuls. Vous pouvez retoucher le message dans votre messagerie avant de l'envoyer."));
    // à droite : les contacts
    var droite = el("div", "ap-col"); g.appendChild(droite);
    if (pr.onglet === "contact") {
      var ajout = carte(droite, "Ajouter un contact", "une structure repérée, un accueil de loisirs, une mairie…");
      var f = el("form", "ap-form"); [["nom", "Nom de la structure"], ["email", "E-mail"], ["ville", "Ville"]].forEach(function (x) { var i = el("input", "ap-recherche"); i.name = x[0]; i.placeholder = x[1]; if (x[0] === "email") i.type = "email"; f.appendChild(i); });
      var bt = el("button", "ap-bouton", "Ajouter"); bt.type = "submit"; f.appendChild(bt);
      f.addEventListener("submit", function (e) { e.preventDefault(); if (!f.nom.value.trim()) return; enregistrerProspect({ cle: "contact:" + Date.now(), type: "contact", nom: f.nom.value.trim(), email: f.email.value.trim() || null, ville: f.ville.value.trim() || null, statut: "a_contacter", etapes: [] }); });
      ajout.appendChild(f);
    }
    var lc = carte(droite, pr.onglet === "organisme" ? "Organismes de formation" : pr.onglet === "structure" ? "Structures sans abonnement" : "Vos contacts");
    var q = el("input", "ap-recherche"); q.type = "search"; q.placeholder = "Chercher…"; q.value = pr.q; lc.appendChild(q);
    var zone = el("div", "ap-pros-l"); lc.appendChild(zone);
    function remplir() {
      zone.textContent = "";
      var m = pr.q.trim().toLowerCase();
      var l = contactsDe(pr.onglet).filter(function (p) { return !m || (p.nom + " " + (p.email || "") + " " + (p.ville || "")).toLowerCase().indexOf(m) >= 0; });
      l.sort(function (a, b) { return aRelancer(b) - aRelancer(a) || (a.statut === "a_contacter") - (b.statut === "a_contacter"); });
      l.slice(0, 80).forEach(function (p) {
        var r = el("div", "ap-pro"); var t = el("div", "ap-pro-t"); t.appendChild(el("b", null, p.nom));
        var e = p.etapes || [];
        t.appendChild(el("small", null, [p.infos, p.email, e.length ? "étape " + e.length + " le " + E.dateFr(iso(e[e.length - 1].date)) : "jamais contacté"].filter(Boolean).join(" · ")));
        if (aRelancer(p)) t.appendChild(etiquette("à relancer", "jaune"));
        r.appendChild(t);
        r.appendChild(selectStatut(p));
        var mail = el("input", "ap-recherche ap-mail"); mail.type = "email"; mail.placeholder = "E-mail"; mail.value = p.email || "";
        mail.addEventListener("change", function () { enregistrerProspect(Object.assign({}, p, { email: mail.value.trim() || null })); });
        r.appendChild(mail);
        var n = Math.min(e.length, 2), mod = MODELES[pr.onglet][n];
        var corps = mod[2].replace(/\{nom\}/g, p.nom).replace(/\{sessions\}/g, p.sessions || "").replace(/\{page\}/g, p.page || "https://filrouganim.fr");
        var ecrire = el("a", "ap-bouton", "✉ " + mod[0]); ecrire.href = "mailto:" + (p.email || "") + "?subject=" + encodeURIComponent(mod[1]) + "&body=" + encodeURIComponent(corps);
        ecrire.addEventListener("click", function () {
          var propre = { cle: p.cle, type: p.type, nom: p.nom, email: p.email || null, ville: p.ville || null, note: p.note || null, statut: p.statut === "a_contacter" ? "contacte" : p.statut, etapes: e.concat([{ n: n + 1, date: new Date().toISOString() }]) };
          setTimeout(function () { enregistrerProspect(propre); }, 300);
        });
        var cp = el("button", "ap-lien-b", "Copier"); cp.type = "button"; cp.addEventListener("click", function () { if (navigator.clipboard) navigator.clipboard.writeText(corps).then(function () { cp.textContent = "Copié"; }); });
        var bs = el("div", "ap-boutons"); bs.appendChild(ecrire); bs.appendChild(cp); if (p.site) { var si = el("a", "ap-lien-b", "Site"); si.href = p.site; si.target = "_blank"; si.rel = "noopener"; bs.appendChild(si); }
        r.appendChild(bs);
        zone.appendChild(r);
      });
      if (!l.length) zone.appendChild(el("p", "ap-vide", pr.onglet === "contact" ? "Ajoutez votre premier contact ci-dessus." : "Personne ici."));
    }
    q.addEventListener("input", function () { pr.q = q.value; remplir(); });
    remplir();
  }

  /* ---------- Indexation (Google page par page) ---------- */
  var IDX = null, PLAN = null, CONT = null, POSTS = null, PUB = null, ACT = null;
  var ix = { f: "a_soumettre", q: "", rub: "" };
  var COUV = [[/submitted and indexed/i, "Indexée"], [/indexed, not submitted/i, "Indexée (hors plan du site)"], [/discovered/i, "Découverte, pas encore explorée"],
              [/crawled/i, "Explorée, pas encore indexée"], [/unknown/i, "Inconnue de Google"], [/duplicate|canonical/i, "Doublon d'une autre page"],
              [/noindex/i, "Exclue (noindex)"], [/redirect/i, "Redirection"], [/not found|404/i, "Introuvable (404)"], [/soft 404/i, "Page jugée vide"], [/blocked/i, "Bloquée"]];
  function couv(x) { if (!x) return "Pas encore vérifiée"; for (var i = 0; i < COUV.length; i++) if (COUV[i][0].test(x)) return COUV[i][1]; return x; }
  function indexee(r) { return !!(r && r.couverture && /indexed|indexée/i.test(r.couverture) && !/not indexed|currently|non indexée/i.test(r.couverture)); }
  function rubrique(u) { var p = u.replace(/^https:\/\/[^/]+/, "").split("/").filter(Boolean); if (!p.length) return "Accueil"; if (p[0] === "se-former" && p[1] === "sessions") return "Sessions"; if (p[0] === "se-former" && p[1] === "ecoles") return "Écoles"; return { "se-former": "Se former", "trouver-un-poste": "Postes et structures", blog: "Blog", lexique: "Lexique", chiffres: "Chiffres" }[p[0]] || "Autres pages"; }
  function lienGsc(u) { return "https://search.google.com/search-console/inspect?resource_id=" + encodeURIComponent("sc-domain:filrouganim.fr") + "&id=" + encodeURIComponent(u); }
  function indexation() {
    var c = $("ad-indexation"); if (!c) return; c.textContent = "";
    var parUrl = {}; (IDX || []).forEach(function (r) { parUrl[r.url] = r; });
    var urls = (PLAN && PLAN.length ? PLAN : Object.keys(parUrl));
    var L = urls.map(function (u) { var r = parUrl[u] || { url: u }; return Object.assign({ etatIx: !r.verifie_le ? "jamais" : indexee(r) ? "indexee" : r.demandee_le ? "demandee" : "a_soumettre" }, r, { url: u }); });
    var n = function (k) { return compte(L, function (x) { return x.etatIx === k; }); };
    var verifiees = L.length - n("jamais");
    var cote = el("div", "ap-hero-cote"); cote.appendChild(el("p", "ap-mini-t", "Pages indexées"));
    cote.appendChild(el("p", "ap-cote-gros", verifiees ? pct(n("indexee"), verifiees) : "–"));
    [["Vérifiées", fr(verifiees) + " / " + fr(L.length)], ["Dernière vérification", IDX && IDX.length ? depuis(IDX.reduce(function (a, r) { return r.verifie_le > a ? r.verifie_le : a; }, "")) : "pas encore"]].forEach(function (x) {
      var r = el("p", "ap-cote-l"); r.appendChild(el("span", null, x[0])); r.appendChild(el("b", null, x[1])); cote.appendChild(r); });
    hero(c, "Indexation", "Vos pages ", "dans Google",
      "Une page qui n'est pas indexée ne sort jamais dans Google. Toutes les 6 heures, environ 300 pages du plan du site sont vérifiées auprès de Google (2 000 par jour au plus). Pour une page pas encore indexée : « Inspecter » ouvre la Search Console, cliquez sur « Demander l'indexation » (une dizaine par jour), puis « C'est fait » ici.",
      [bouton("Visibilité", "visibilite", true, "loupe"), bouton("← Vue d'ensemble", "accueil")], cote);
    var g = grille(c, "ap-g4");
    kpi(g, "base", "Pages du plan du site", fr(L.length), "dans sitemap.xml");
    kpi(g, "coche", "Indexées", fr(n("indexee")), verifiees ? pct(n("indexee"), verifiees) + " des pages vérifiées" : "en attente du premier relevé", "ok");
    kpi(g, "alerte", "Pas encore dans Google", fr(n("a_soumettre") + n("demandee")), n("demandee") + " déjà demandées", n("a_soumettre") ? "jaune" : null);
    kpi(g, "horloge", "Pas encore vérifiées", fr(n("jamais")), "vues au fil des relevés");
    if (!IDX || !IDX.length) {
      var v = carte(c, "Premier relevé à venir");
      v.appendChild(el("p", "ap-petit", "La vérification se fait dans « Relever les chiffres » (toutes les 6 heures), avec la même clé Search Console que vos chiffres. Les premiers résultats arrivent au prochain relevé ; tout le plan du site est vu en 2 à 3 jours."));
    }
    // par rubrique
    var rubs = {}; L.forEach(function (x) { var k = rubrique(x.url); rubs[k] = rubs[k] || [0, 0, 0]; rubs[k][0]++; if (x.etatIx === "indexee") rubs[k][1]++; if (x.etatIx !== "jamais") rubs[k][2]++; });
    var cr = carte(c, "Par rubrique", "indexées / vérifiées");
    tableau(cr, ["Rubrique", "Pages", "Vérifiées", "Indexées", "Part indexée"], Object.keys(rubs).sort(function (a, b) { return rubs[b][0] - rubs[a][0]; }).map(function (k) {
      return [cellule(k), fr(rubs[k][0]), fr(rubs[k][2]), fr(rubs[k][1]), rubs[k][2] ? etiquette(pct(rubs[k][1], rubs[k][2]), rubs[k][1] / rubs[k][2] >= .8 ? "ok" : rubs[k][1] / rubs[k][2] >= .4 ? "jaune" : "rose") : "–"];
    }));
    // la liste
    var lc = carte(c, "Les pages");
    var on = el("div", "ap-puces"); lc.appendChild(on);
    [["a_soumettre", "À soumettre"], ["demandee", "Demandées"], ["jamais", "Pas encore vérifiées"], ["indexee", "Indexées"], ["toutes", "Toutes"]].forEach(function (x) {
      var b = el("button", null, x[1] + " " + fr(x[0] === "toutes" ? L.length : n(x[0]))); b.type = "button"; b.setAttribute("aria-pressed", ix.f === x[0] ? "true" : "false");
      b.addEventListener("click", function () { ix.f = x[0]; indexation(); }); on.appendChild(b); });
    var outils = el("div", "ap-barre-outils"); lc.appendChild(outils);
    var q = el("input", "ap-recherche"); q.type = "search"; q.placeholder = "Chercher une adresse…"; q.value = ix.q; outils.appendChild(q);
    var sr = el("select", "ap-select"); [""].concat(Object.keys(rubs).sort()).forEach(function (k) { var o = el("option", null, k || "Toutes les rubriques"); o.value = k; if (ix.rub === k) o.selected = true; sr.appendChild(o); }); outils.appendChild(sr);
    var zone = el("div"); lc.appendChild(zone);
    function remplir() {
      zone.textContent = "";
      var m = ix.q.trim().toLowerCase();
      var l = L.filter(function (x) { return (ix.f === "toutes" || x.etatIx === ix.f) && (!ix.rub || rubrique(x.url) === ix.rub) && (!m || x.url.toLowerCase().indexOf(m) >= 0); });
      // d'abord les pages qui comptent : celles que Google montre déjà, puis les plus courtes (les pages mères)
      var imp = {}; ((G && G.pages) || []).forEach(function (p) { imp["https://filrouganim.fr" + p[0]] = p[2]; });
      l.sort(function (a, b) { return (imp[b.url] || 0) - (imp[a.url] || 0) || a.url.length - b.url.length; });
      tableau(zone, ["Page", "Dans Google", "Dernier passage de Google", ""], l.slice(0, 150).map(function (x) {
        var chemin = x.url.replace("https://filrouganim.fr", "") || "/";
        var t = x.etatIx === "indexee" ? "ok" : x.etatIx === "jamais" ? "neutre" : x.etatIx === "demandee" ? "rose" : "jaune";
        var d = el("div"); d.appendChild(etiquette(couv(x.couverture), t)); if (x.demandee_le && x.etatIx !== "indexee") d.appendChild(el("small", "ap-petit", " demandée " + depuis(x.demandee_le)));
        return [cellule(chemin, rubrique(x.url) + (imp[x.url] ? " · " + fr(imp[x.url]) + " affichages" : "")), d,
          cellule(x.dernier_passage ? E.dateFr(iso(x.dernier_passage)) : "–", x.verifie_le ? "vérifiée " + depuis(x.verifie_le) : null),
          actions([["Inspecter", null, lienGsc(x.url)], x.etatIx !== "indexee" ? ["C'est fait", function () { demandee(x.url); }] : null, ["Voir", null, x.url]])];
      }));
      if (l.length > 150) zone.appendChild(el("p", "ap-petit", "Les 150 premières sur " + fr(l.length) + " : affinez avec la recherche ou la rubrique."));
    }
    q.addEventListener("input", function () { ix.q = q.value; remplir(); });
    sr.addEventListener("change", function () { ix.rub = sr.value; remplir(); });
    remplir();
    var p = document.querySelector('[data-pastille-admin="indexation"]'); if (p) { p.hidden = !n("a_soumettre"); p.textContent = n("a_soumettre") > 99 ? "99+" : n("a_soumettre"); }
  }
  async function demandee(u) {
    var maintenant = new Date().toISOString();
    var r = await E.sb.from("admin_indexation").upsert({ url: u, demandee_le: maintenant });
    if (r && r.error) { E.message(E.erreur(r.error), true); return; }
    var x = (IDX || []).filter(function (y) { return y.url === u; })[0]; if (x) x.demandee_le = maintenant; else (IDX = IDX || []).push({ url: u, demandee_le: maintenant });
    E.message("Noté : Google repassera dans les jours qui viennent."); indexation();
  }

  /* ---------- Actualités du secteur ---------- */
  var CATS_ACT = ["Réglementation", "BAFA et BAFD", "Emploi et recrutement", "Aides et financement", "Vie du site"];
  var act = { edition: null };
  function actualites() {
    var c = $("ad-actualites"); if (!c) return; c.textContent = "";
    var l = ACT || [];
    hero(c, "Actualités", "Les actualités ", "du secteur",
      "Ce que vous publiez ici apparaît dans l'espace des membres connectés (animateurs, structures, ou les deux), dans une carte « Actualités du secteur ». Rien n'est écrit tout seul : ajoutez une nouvelle à partir d'une source sûre, avec son lien.",
      [bouton("← Vue d'ensemble", "accueil")]);
    chiffres(c, [[String(compte(l, function (a) { return a.publie; })), "publiées"], [String(compte(l, function (a) { return !a.publie; })), "brouillons"],
                 [String(compte(l, function (a) { return a.publie && iso(a.date) >= joursAvant(30); })), "ce mois-ci", "rouge"]]);
    var g = el("div", "ap-pros"); c.appendChild(g);
    var x = act.edition || { titre: "", resume: "", categorie: CATS_ACT[0], lien: "", source: "", pour: ["animateurs", "structures"], publie: true, date: AUJ };
    var fc = carte(g, x.id ? "Modifier l'actualité" : "Nouvelle actualité");
    var f = el("form", "ap-form-v");
    function champ(nom, titre, type, val) { var lb = el("label", "ap-champ"); lb.appendChild(el("span", null, titre)); var i = el(type === "texte" ? "textarea" : "input", "ap-recherche"); if (type === "texte") i.rows = 5; else i.type = type || "text"; i.name = nom; i.value = val || ""; lb.appendChild(i); f.appendChild(lb); return i; }
    var it = champ("titre", "Titre", "text", x.titre); it.required = true; it.maxLength = 160;
    champ("resume", "En deux ou trois phrases", "texte", x.resume).maxLength = 1200;
    var lc = el("label", "ap-champ"); lc.appendChild(el("span", null, "Catégorie")); var sc = el("select", "ap-select"); sc.name = "categorie";
    CATS_ACT.forEach(function (k) { var o = el("option", null, k); o.value = k; if (x.categorie === k) o.selected = true; sc.appendChild(o); }); lc.appendChild(sc); f.appendChild(lc);
    var il = champ("lien", "Lien vers la source (https://…)", "url", x.lien); il.pattern = "https://.*";
    champ("source", "Nom de la source (ex. jeunes.gouv.fr)", "text", x.source);
    champ("date", "Date", "date", iso(x.date));
    var pr2 = el("div", "ap-cases"); [["animateurs", "Animateurs"], ["structures", "Structures"]].forEach(function (k) { var lb = el("label"); var i = el("input"); i.type = "checkbox"; i.name = "pour"; i.value = k[0]; i.checked = (x.pour || []).indexOf(k[0]) >= 0; lb.appendChild(i); lb.appendChild(document.createTextNode(" " + k[1])); pr2.appendChild(lb); });
    var lp = el("label"); var ip = el("input"); ip.type = "checkbox"; ip.name = "publie"; ip.checked = !!x.publie; lp.appendChild(ip); lp.appendChild(document.createTextNode(" Publiée")); pr2.appendChild(lp);
    f.appendChild(pr2);
    var bs = el("div", "ap-boutons"); var ok = el("button", "ap-bouton", x.id ? "Enregistrer" : "Ajouter"); ok.type = "submit"; bs.appendChild(ok);
    if (x.id) { var an = el("button", "ap-lien-b", "Annuler"); an.type = "button"; an.addEventListener("click", function () { act.edition = null; actualites(); }); bs.appendChild(an); }
    f.appendChild(bs);
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      var pour = Array.prototype.filter.call(f.querySelectorAll('[name="pour"]'), function (i) { return i.checked; }).map(function (i) { return i.value; });
      if (!pour.length) { E.message("Choisissez au moins un public (animateurs ou structures).", true); return; }
      var v = { titre: f.titre.value.trim(), resume: f.resume.value.trim() || null, categorie: sc.value, lien: f.lien.value.trim() || null, source: f.source.value.trim() || null, date: f.date.value || AUJ, pour: pour, publie: ip.checked };
      ok.disabled = true;
      var r = x.id ? await E.sb.from("actualites").update(v).eq("id", x.id) : await E.sb.from("actualites").insert(v);
      ok.disabled = false;
      if (r.error) { E.message(E.erreur(r.error), true); return; }
      act.edition = null; await lireActualites(); E.message("Enregistré."); actualites();
    });
    fc.appendChild(f);
    var srcs = el("p", "ap-petit"); srcs.appendChild(document.createTextNode("Sources sûres : "));
    [["jeunes.gouv.fr (BAFA, BAFD)", "https://www.jeunes.gouv.fr/bafa-bafd"], ["service-public.fr", "https://www.service-public.fr/particuliers/vosdroits/F2135"], ["Légifrance", "https://www.legifrance.gouv.fr/"]].forEach(function (s, i) {
      if (i) srcs.appendChild(document.createTextNode(" · ")); var a = el("a", null, s[0]); a.href = s[1]; a.target = "_blank"; a.rel = "noopener"; srcs.appendChild(a); });
    fc.appendChild(srcs);
    var droite = el("div", "ap-col"); g.appendChild(droite);
    var lst = carte(droite, "Toutes les actualités", l.length + " au total");
    if (!l.length) lst.appendChild(el("p", "ap-vide", "Aucune actualité pour l'instant. Les membres ne voient pas la carte tant qu'il n'y en a pas."));
    l.forEach(function (a) {
      var r = el("div", "ap-act"); var t = el("div");
      var h = el("p", "ap-act-sur"); h.appendChild(etiquette(a.categorie || "Actualité", "neutre")); h.appendChild(document.createTextNode(" " + E.dateFr(iso(a.date)) + " · pour les " + (a.pour || []).join(" et "))); t.appendChild(h);
      t.appendChild(el("b", null, a.titre)); if (a.resume) t.appendChild(el("p", "ap-petit", a.resume));
      if (a.lien) { var s = el("a", "ap-petit", "Source : " + (a.source || a.lien.replace(/^https:\/\/(www\.)?/, "").split("/")[0])); s.href = a.lien; s.target = "_blank"; s.rel = "noopener"; t.appendChild(s); }
      r.appendChild(t);
      var d = el("div", "ap-col-fin"); d.appendChild(etiquette(a.publie ? "publiée" : "brouillon", a.publie ? "ok" : "jaune"));
      d.appendChild(actions([[a.publie ? "Dépublier" : "Publier", async function () { var q = await E.sb.from("actualites").update({ publie: !a.publie }).eq("id", a.id); if (q.error) return E.message(E.erreur(q.error), true); await lireActualites(); actualites(); }],
        ["Modifier", function () { act.edition = a; actualites(); window.scrollTo(0, 0); }],
        ["Supprimer", async function () { if (!window.confirm("Supprimer « " + a.titre + " » ?")) return; var q = await E.sb.from("actualites").delete().eq("id", a.id); if (q.error) return E.message(E.erreur(q.error), true); await lireActualites(); actualites(); }, null, "ap-danger"]]));
      r.appendChild(d); lst.appendChild(r);
    });
  }
  async function lireActualites() { var r = await E.sb.from("actualites").select("*").order("date", { ascending: false }).order("id", { ascending: false }); ACT = (r && !r.error && r.data) || []; }

  /* ---------- Contenus du site (articles, guides, fiches) ---------- */
  var ct = { f: "tous", tri: "impressions" };
  function contenusSite() {
    var c = $("ad-site"); if (!c) return; c.textContent = "";
    var l = CONT || [];
    var tot = l.reduce(function (a, x) { return a + (x.impressions || 0); }, 0), clics = l.reduce(function (a, x) { return a + (x.clics || 0); }, 0);
    hero(c, "Contenus du site", "Vos articles ", "et vos guides",
      "Chaque article, guide et fiche formation du site public, avec ce que Google en montre sur 28 jours. Les textes sont dans le dépôt (dossier contenu/) : « Modifier » ouvre le fichier sur GitHub. Les guides réservés aux structures abonnées sont à part, dans « Guides et conseils ».",
      [bouton("Guides et conseils (structures)", "contenus", true, "livre"), bouton("← Vue d'ensemble", "accueil")]);
    var g = grille(c, "ap-g4");
    kpi(g, "livre", "Articles du blog", String(compte(l, function (x) { return x.type === "Article"; })), "dans contenu/blog");
    kpi(g, "offre", "Guides et fiches", String(compte(l, function (x) { return x.type !== "Article"; })), "guides et fiches formations");
    kpi(g, "oeil", "Affichages dans Google", fr(tot), "sur 28 jours, ces pages seules");
    kpi(g, "lien", "Clics depuis Google", fr(clics), pct(clics, tot) + " des affichages", "ok");
    var on = el("div", "ap-puces"); c.appendChild(on);
    [["tous", "Tout"], ["Article", "Articles"], ["Guide", "Guides"], ["Fiche formation", "Fiches formations"], ["vieux", "À rafraîchir (plus de 6 mois)"], ["zero", "Pas encore vus dans Google"]].forEach(function (x) {
      var b = el("button", null, x[1]); b.type = "button"; b.setAttribute("aria-pressed", ct.f === x[0] ? "true" : "false"); b.addEventListener("click", function () { ct.f = x[0]; contenusSite(); }); on.appendChild(b); });
    var six = joursAvant(183);
    var v = l.filter(function (x) { return ct.f === "tous" || x.type === ct.f || (ct.f === "vieux" && x.date && x.date < six) || (ct.f === "zero" && !x.impressions); });
    v.sort(function (a, b) { return (b.impressions || 0) - (a.impressions || 0) || (b.date || "").localeCompare(a.date || ""); });
    tableau(c, ["Contenu", "Date", "Affichages", "Clics", "Place moyenne", ""], v.map(function (x) {
      return [cellule(x.titre, x.type + (x.categorie ? " · " + x.categorie : "") + " · " + fr(x.mots) + " mots"), cellule(x.date ? E.dateFr(x.date) : "–", x.date && x.date < six ? "à rafraîchir" : null),
        cellule(fr(x.impressions)), cellule(fr(x.clics)), cellule(x.place ? String(Math.round(x.place * 10) / 10).replace(".", ",") : "–", x.place && x.place <= 10 ? "1re page" : x.place && x.place <= 20 ? "2e page" : null),
        actions([["Voir", null, x.url], ["Modifier", null, "https://github.com/" + DEPOT + "/edit/main/" + x.fichier]])];
    }));
    // des idées de sujets : les recherches où le site sort, mais loin
    var cs = carte(c, "Des sujets à creuser", "recherches où le site apparaît après la 1re page");
    var R = ((G && G.recherches) || []).filter(function (r) { return r.place > 10; }).sort(function (a, b) { return b.impressions - a.impressions; }).slice(0, 12);
    tableau(cs, ["Recherche", "Affichages", "Place"], R.map(function (r) { return [cellule(r.recherche), cellule(fr(r.impressions)), cellule(String(Math.round(r.place * 10) / 10).replace(".", ","))]; }));
    cs.appendChild(el("p", "ap-petit", "Un article ou une section de guide qui répond exactement à l'une de ces recherches peut faire passer le site en première page."));
  }

  /* ---------- Réseaux sociaux ---------- */
  var RESEAUX = ["Instagram", "Facebook", "LinkedIn", "TikTok"];
  var rs = { reseau: "Instagram" };
  function lienPost(i) { return "https://filrouganim.fr" + i.lien + "?utm_source=" + rs.reseau.toLowerCase() + "&utm_medium=social&utm_campaign=" + encodeURIComponent(i.cle); }
  function reseaux() {
    var c = $("ad-reseaux"); if (!c) return; c.textContent = "";
    var pub = PUB || [], idees = (POSTS && POSTS.idees) || [];
    var dernier = pub.reduce(function (a, p) { return p.publie_le > a ? p.publie_le : a; }, "");
    var venus = D.structures.concat(D.profils).filter(function (x) { var k = canal(x.provenance); return k === "Facebook" || k === "Instagram" || k === "Autres réseaux"; }).length;
    var cote = el("div", "ap-hero-cote"); cote.appendChild(el("p", "ap-mini-t", "Dernier post"));
    cote.appendChild(el("p", "ap-cote-gros", dernier ? depuis(dernier) : "jamais"));
    [["Posts sur 30 jours", String(compte(pub, function (p) { return iso(p.publie_le) >= joursAvant(29); }))], ["Inscrits venus des réseaux", String(venus)]].forEach(function (x) {
      var r = el("p", "ap-cote-l"); r.appendChild(el("span", null, x[0])); r.appendChild(el("b", null, x[1])); cote.appendChild(r); });
    hero(c, "Réseaux sociaux", "Des posts prêts, ", "chaque semaine",
      "Chaque publication du site prépare des idées de posts à partir des vraies sessions et des derniers articles. Choisissez le réseau, copiez le texte (le lien est suivi : vous verrez les visites et les inscriptions dans « Provenance »), publiez, puis « C'est publié ».",
      [bouton("Provenance", "provenance", true, "lien"), bouton("← Vue d'ensemble", "accueil")], cote);
    // calendrier des 5 dernières semaines
    var cal = carte(c, "Vos 5 dernières semaines", "un point par jour où vous avez posté");
    var jours = {}; pub.forEach(function (p) { var k = iso(p.publie_le); jours[k] = (jours[k] || 0) + 1; });
    var gr = el("div", "ap-cal"); for (var i = 34; i >= 0; i--) { var j = joursAvant(i); var d = el("span", jours[j] ? "ap-cal-on" : null); d.title = E.dateFr(j) + (jours[j] ? " · " + jours[j] + " post" + (jours[j] > 1 ? "s" : "") : ""); gr.appendChild(d); }
    cal.appendChild(gr);
    cal.appendChild(el("p", "ap-petit", "Le bon rythme pour démarrer : 2 à 3 posts par semaine, surtout avant les vacances scolaires (c'est là que les jeunes cherchent leur BAFA et que les structures recrutent)."));
    var on = el("div", "ap-puces"); c.appendChild(on);
    RESEAUX.forEach(function (k) { var b = el("button", null, k); b.type = "button"; b.setAttribute("aria-pressed", rs.reseau === k ? "true" : "false"); b.addEventListener("click", function () { rs.reseau = k; reseaux(); }); on.appendChild(b); });
    var g = el("div", "ap-posts"); c.appendChild(g);
    if (!idees.length) g.appendChild(el("p", "ap-vide", "Les idées arrivent avec la prochaine publication du site."));
    idees.forEach(function (i) {
      var fait = pub.filter(function (p) { return p.cle === i.cle + ":" + rs.reseau.toLowerCase(); })[0];
      var k = el("section", "ap-carte ap-post" + (fait ? " ap-post-fait" : ""));
      var h = el("div", "ap-carte-h"); h.appendChild(el("h3", null, i.titre)); h.appendChild(etiquette({ jeunes: "jeunes en formation", structures: "structures", animateurs: "animateurs" }[i.pour] || i.pour, "neutre")); k.appendChild(h);
      var texte = i.texte + "\n" + lienPost(i);
      var t = el("p", "ap-post-t", texte); k.appendChild(t);
      var b = el("div", "ap-boutons");
      var cp = el("button", "ap-bouton", "Copier le texte"); cp.type = "button";
      cp.addEventListener("click", function () { if (navigator.clipboard) navigator.clipboard.writeText(texte).then(function () { cp.textContent = "Copié ✓"; setTimeout(function () { cp.textContent = "Copier le texte"; }, 2000); }); });
      b.appendChild(cp);
      if (fait) b.appendChild(etiquette("publié " + depuis(fait.publie_le) + " sur " + rs.reseau, "ok"));
      else { var ok = el("button", "ap-lien-b", "C'est publié"); ok.type = "button"; ok.addEventListener("click", async function () {
        var r = await E.sb.from("admin_posts").upsert({ cle: i.cle + ":" + rs.reseau.toLowerCase(), reseau: rs.reseau, titre: i.titre, texte: texte, publie_le: new Date().toISOString() });
        if (r.error) return E.message(E.erreur(r.error), true); await lirePosts(); E.message("Bravo, c'est noté."); reseaux(); }); b.appendChild(ok); }
      k.appendChild(b); g.appendChild(k);
    });
    var hist = carte(c, "Déjà publiés", pub.length + " au total");
    tableau(hist, ["Post", "Réseau", "Publié", ""], pub.slice(0, 30).map(function (p) {
      return [cellule(p.titre || p.cle), cellule(p.reseau), cellule(E.dateFr(iso(p.publie_le))),
        actions([["Retirer", async function () { var r = await E.sb.from("admin_posts").delete().eq("cle", p.cle); if (r.error) return E.message(E.erreur(r.error), true); await lirePosts(); reseaux(); }, null, "ap-danger"]])];
    }));
  }
  async function lirePosts() { var r = await E.sb.from("admin_posts").select("*").order("publie_le", { ascending: false }); PUB = (r && !r.error && r.data) || []; }

  /* ---------- Guides et conseils : en créer un ---------- */
  function enteteGuides() {
    var c = $("ad-contenus"); if (!c || c.querySelector(".ap-nouveau-guide")) return;
    var d = el("details", "ap-carte ap-nouveau-guide"); var s = el("summary", null, "+ Nouveau guide ou conseil"); d.appendChild(s);
    var f = el("form", "ap-form-v");
    [["titre", "Titre"], ["slug", "Adresse courte (ex. aides-embauche), sans espace"], ["court", "Titre court (facultatif)"]].forEach(function (x) { var lb = el("label", "ap-champ"); lb.appendChild(el("span", null, x[1])); var i = el("input", "ap-recherche"); i.name = x[0]; if (x[0] !== "court") i.required = true; if (x[0] === "slug") i.pattern = "[a-z0-9-]+"; lb.appendChild(i); f.appendChild(lb); });
    var lt = el("label", "ap-champ"); lt.appendChild(el("span", null, "Type")); var st = el("select", "ap-select"); st.name = "type"; [["guide", "Guide (une page complète)"], ["conseil", "Conseil (une phrase ou deux)"]].forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; st.appendChild(op); }); lt.appendChild(st); f.appendChild(lt);
    var lh = el("label", "ap-champ"); lh.appendChild(el("span", null, "Texte (HTML simple : <p>, <h2>, <ul><li>, <a>)")); var th = el("textarea", "ap-recherche ad-code"); th.rows = 8; th.name = "html"; th.required = true; lh.appendChild(th); f.appendChild(lh);
    var ok = el("button", "ap-bouton", "Créer"); ok.type = "submit"; f.appendChild(ok);
    f.addEventListener("submit", async function (e) {
      e.preventDefault(); ok.disabled = true;
      var r = await E.sb.from("ressources_structures").insert({ slug: f.slug.value.trim(), titre: f.titre.value.trim(), court: f.court.value.trim() || null, type: st.value, html: th.value, ordre: 9, maj: AUJ });
      ok.disabled = false;
      if (r.error) return E.message(E.erreur(r.error), true);
      E.message("Créé : les structures abonnées le voient tout de suite."); A.recharger();
    });
    d.appendChild(f); c.insertBefore(d, c.children[1] || null);
  }

  /* ---------- chargement ---------- */
  async function toutLire() {
    var lireJson = function (u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
    var r = await Promise.all([E.sb.rpc("admin_sante"), lireGithub(), lireJson("/chiffres/google.json"), lireJson("/compte/organismes.json"),
                               E.sb.from("admin_prospects").select("*"), lireIndexation(), lireJson("/compte/contenus.json"), lireJson("/compte/posts.json"),
                               lirePosts(), lireActualites(), E.sb.from("stats_organismes").select("organisme,type,n,jour").gte("jour", joursAvant(29)).limit(5000),
                               E.sb.from("contacts_organismes").select("*").order("cree_le", { ascending: false }), fetch("/sitemap.xml").then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; })]);
    S = (r[0] && !r[0].error && r[0].data) || {};
    G = r[2] || {}; ORG = r[3] || { suivis: [], autres: [] }; PROS = (r[4] && !r[4].error && r[4].data) || [];
    CONT = r[6] || []; POSTS = r[7] || { idees: [] };
    SORG = {}; ((r[10] && !r[10].error && r[10].data) || []).forEach(function (x) { var o = SORG[x.organisme] = SORG[x.organisme] || { vue_page: 0, clic_session: 0, clic_site: 0 }; o[x.type] = (o[x.type] || 0) + x.n; });
    CORG = (r[11] && !r[11].error && r[11].data) || [];
    PLAN = (r[12] || "").match(/<loc>[^<]+<\/loc>/g); PLAN = (PLAN || []).map(function (x) { return x.slice(5, -6); });
    verifieA = new Date();
  }
  async function lireIndexation() {
    var tout = [];
    for (var i = 0; i < 20; i++) {
      var r = await E.sb.from("admin_indexation").select("*").order("url").range(i * 1000, i * 1000 + 999);
      if (!r || r.error || !r.data) break;
      tout = tout.concat(r.data); if (r.data.length < 1000) break;
    }
    IDX = tout;
  }
  window.FRA_ADMIN_PRO = {
    rendre: async function (donnees, actions) {
      D = donnees; A = actions; E = window.FRA_ESPACE;
      ["comptes", "structures", "profils", "offres", "demandes", "candidatures", "vues", "ressources", "admins"].forEach(function (k) { D[k] = D[k] || []; });
      if (!S) { S = {}; QG(); ventes(); accueil(); await toutLire(); }
      accueil(); QG(); sante(); ventes();
      membresPage(); enteteStructures(); enteteAnimateurs(); organismes(); visibilite(); provenance(); prospection();
      indexation(); actualites(); contenusSite(); reseaux(); enteteGuides();
      var p = document.querySelector('[data-pastille-admin="qg"]'); var n = compte(D.demandes, function (d) { return (d.suivi || "a_traiter") === "a_traiter"; });
      if (p) { p.hidden = !n; p.textContent = n; }
    }
  };
})();

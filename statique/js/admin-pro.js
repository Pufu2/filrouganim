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
    var k = el("p", "ap-sur"); k.appendChild(ic("coeur", "ap-ic-mini")); k.appendChild(document.createTextNode("Administration · " + sur)); g.appendChild(k);
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
    var verif = compte(D.structures, function (s) { return paye(s) && !s.verifiee; });
    var cand = compte(D.candidatures, function (x) { return x.statut === "envoyee" && iso(x.cree_le) <= joursAvant(3); });
    if (dem) l.push([dem, dem > 1 ? "demandes d'animateurs à traiter" : "demande d'animateur à traiter", "qg"]);
    if (verif) l.push([verif, verif > 1 ? "structures payées à vérifier" : "structure payée à vérifier", "afaire"]);
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
    hero(c, date, "Votre plateforme, ", "en un coup d'œil",
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
     ["Utilisateurs", [["comptes", "personne", "Comptes", fr(D.comptes.length) + " comptes, +" + ceMois + " ce mois-ci"], ["structures", "maison", "Structures", st.length + " fiches, " + payees.length + " payées"],
                       ["animateurs", "groupe", "Animateurs", D.profils.length + " profils, " + compte(D.profils, function (p) { return p.publie; }) + " visibles"]]],
     ["Acquisition", [["stats", "courbe", "Statistiques détaillées", "Vues, clics, entonnoirs, trafic"], ["stats", "oeil", "Vues des pages structures", fr(vues30) + " sur 30 jours"],
                      [null, "google", "Page des chiffres publics", "Google, visiteurs, demandes", "/chiffres/"]]],
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
    var h = k.querySelector(".ap-carte-h"); var tous = vers("comptes"); tous.className = "ap-lien"; tous.textContent = "Tous les comptes →"; h.appendChild(tous);
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
    [["Demandes d'animateurs", "Envoyées aux structures", nb.a_traiter, null, "avion"], ["Structures à vérifier", "Payées, pas encore en ligne", compte(D.structures, function (s) { return paye(s) && !s.verifiee; }), "afaire", "maison"],
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

  /* ---------- chargement ---------- */
  async function toutLire() {
    var r = await Promise.all([E.sb.rpc("admin_sante"), lireGithub()]);
    S = (r[0] && !r[0].error && r[0].data) || {};
    verifieA = new Date();
  }
  window.FRA_ADMIN_PRO = {
    rendre: async function (donnees, actions) {
      D = donnees; A = actions; E = window.FRA_ESPACE;
      ["comptes", "structures", "profils", "offres", "demandes", "candidatures", "vues", "ressources", "admins"].forEach(function (k) { D[k] = D[k] || []; });
      if (!S) { S = {}; QG(); ventes(); accueil(); await toutLire(); }
      accueil(); QG(); sante(); ventes();
      var p = document.querySelector('[data-pastille-admin="qg"]'); var n = compte(D.demandes, function (d) { return (d.suivi || "a_traiter") === "a_traiter"; });
      if (p) { p.hidden = !n; p.textContent = n; }
    }
  };
})();

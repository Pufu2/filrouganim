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
    a.dataset.diplome = x.di; a.dataset.ville = x.v;
    var date = el("p", "s-date");
    date.setAttribute("aria-hidden", "true");
    date.appendChild(el("b", null, String(x.j)));
    date.appendChild(el("span", null, MOIS[parseInt(x.m.slice(5), 10) - 1]));
    a.appendChild(date);
    var corps = el("div", "s-corps");
    var h = el("h3", "s-titre", x.dn + (x.spn ? " · " + x.spn : (x.t !== "parcours" && x.t !== "session" ? " · " + x.tn.toLowerCase() : "")));
    if (x.th && x.t !== "parcours") { h.appendChild(document.createTextNode(" ")); h.appendChild(el("span", "s-theme", x.th)); }
    corps.appendChild(h);
    var infos = el("p", "s-infos");
    infos.appendChild(document.createTextNode(x.dates + " · "));
    infos.appendChild(el("b", null, x.v));
    infos.appendChild(document.createTextNode(" (" + x.d + ")" + (x.f ? " · " + x.f : "") + " · "));
    if (x.oi) { var lo = el("a", null, x.o); lo.href = lienOrganismes + x.oi + "/"; infos.appendChild(lo); }
    else infos.appendChild(document.createTextNode(x.o));
    if (x.pa) { infos.appendChild(document.createTextNode(" ")); var pa = el("span", "s-partenaire", "Partenaire"); pa.title = "Organisme partenaire de Fil Roug'Anim"; infos.appendChild(pa); }
    corps.appendChild(infos);
    var verif = el("p", "s-verif");
    if (x.c) { verif.appendChild(el("b", "s-complet", "Complet")); verif.appendChild(document.createTextNode(" · ")); }
    verif.appendChild(document.createTextNode(x.n.concat([x.vf]).join(" · ")));
    corps.appendChild(verif);
    a.appendChild(corps);
    var prix = el("p", "s-prix");
    if (x.px === 0 && x.app) { prix.textContent = "Gratuit"; prix.appendChild(el("span", "s-prix-sous", "en apprentissage")); }
    else if (x.px !== null && x.px !== undefined) prix.textContent = euros(x.px); else prix.appendChild(el("span", null, "prix à voir"));
    a.appendChild(prix);
    var lien = el("a", "s-lien", "Voir");
    lien.href = x.u; lien.rel = "noopener nofollow"; lien.target = "_blank"; if (x.ok) { lien.dataset.org = x.ok; lien.dataset.orgT = "clic_session"; lien.dataset.orgD = x.d || ""; }
    lien.appendChild(el("span", "sr", (x.lba ? " la formation sur La bonne alternance" : x.site ? " le site de " + x.o : " la session chez " + x.o) + " (nouvel onglet)"));
    lien.appendChild(document.createTextNode(" →"));
    a.appendChild(lien);
    return a;
  }

  // --- les listes : chaque élément a ses critères (d) et sa carte (déjà dans la page, ou fabriquée au besoin)
  function depuisCarte(c) {
    var d = c.dataset;
    return { el: c, d: { dep: d.dep, ville: d.ville, region: d.region, periode: d.periode, mois: d.mois, diplome: d.diplome, type: d.type,
                         prix: d.prix, formule: d.formule || "", texte: sansAccents(d.texte) }, ok: true };
  }
  var listes = Array.prototype.map.call(document.querySelectorAll(".sessions[data-par-page]"), function (conteneur) {
    var bouton = conteneur.nextElementSibling && conteneur.nextElementSibling.querySelector(".voir-plus");
    var liste = { el: conteneur, items: Array.prototype.map.call(conteneur.querySelectorAll(".session"), function (c, k) { var i = depuisCarte(c); i.rang = k; i.pz = c.dataset.pz === "1"; return i; }),
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
      if (i.el) { i.el.hidden = !voir; i.el._i = i; }
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

  // --- « Où ? » : un département (nom ou numéro) ou une région, tapé librement, avec suggestions
  function lieux(f) {
    var liste = f.querySelector("datalist");
    return liste ? Array.prototype.map.call(liste.options, function (o) {
      return { texte: o.value, cle: sansAccents(o.value), dep: o.dataset.dep };
    }) : [];
  }
  function trouverLieu(f, texte) {
    var t = sansAccents(texte).replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
    if (!t) return null;
    var tous = lieux(f);
    var exact = tous.filter(function (l) { return l.cle === sansAccents(texte).trim(); })[0];
    if (exact) return exact;
    var num = t.match(/^(\d{1,2}|2a|2b)$/);
    if (num) {
      var code = num[1].length === 1 ? "0" + num[1] : num[1].toUpperCase();
      return tous.filter(function (l) { return l.dep === code; })[0] || null;
    }
    if (t.length < 3) return null;  // « rh » ne choisit pas encore le Rhône
    var mots = t.split(" ");
    var ok = tous.filter(function (l) { return mots.every(function (m) { return l.cle.indexOf(m) !== -1; }); });
    var debut = ok.filter(function (l) { return l.cle.indexOf(t) === 0; });
    return (debut.length === 1 ? debut[0] : ok.length === 1 ? ok[0] : (debut[0] || null));
  }
  function lieuDe(f, dep) {
    return lieux(f).filter(function (l) { return l.dep === dep; })[0] || null;
  }
  // « Quel diplôme ? » décide des étapes ou spécialités proposées
  function adapterChoix(f) {
    var dip = f.elements.diplome.value;
    var selEtape = f.elements.type;
    var visibles = 0;
    Array.prototype.forEach.call(selEtape.querySelectorAll("optgroup"), function (g) {
      var montrer = !dip || g.dataset.diplome === dip;
      g.hidden = !montrer; g.disabled = !montrer;
      Array.prototype.forEach.call(g.querySelectorAll("option"), function (o) { o.hidden = !montrer; o.disabled = !montrer; });
      if (montrer) visibles += g.querySelectorAll("option").length;
    });
    if (selEtape.selectedOptions[0] && selEtape.selectedOptions[0].disabled) selEtape.value = "";
    selEtape.disabled = visibles === 0;
    var pro = dip && ["BAFA", "BAFD"].indexOf(dip) === -1;
    selEtape.options[0].textContent = visibles === 0 ? (dip === "PSC1" ? "Une journée" : "Formation complète") : (pro ? "Toutes les spécialités" : "Toutes les étapes");
    var titre = f.querySelector("[data-titre-etape]");
    if (titre) titre.textContent = !dip ? "Étape ou spécialité ?" : pro ? "Quelle spécialité ?" : "Quelle étape ?";
  }
  Array.prototype.forEach.call(document.querySelectorAll("form.recherche"), function (f) {
    if (!f.elements.ou) return;
    adapterChoix(f);
    f.elements.diplome.addEventListener("change", function () { adapterChoix(f); });
    function majLieu() {
      var l = trouverLieu(f, f.elements.ou.value);
      f.elements.dep.value = l ? l.dep : "";
      f.elements.ou.setCustomValidity(f.elements.ou.value.trim() && !l ? "Département inconnu : tapez son nom ou son numéro" : "");
      return l;
    }
    f.elements.ou.addEventListener("input", majLieu);
    f.elements.ou.addEventListener("change", function () {
      var l = majLieu();
      if (l) f.elements.ou.value = l.texte;
    });
    f._majLieu = majLieu;
  });

  // --- Accueil et autres formulaires : l'adresse de la recherche ne garde que les critères choisis
  Array.prototype.forEach.call(document.querySelectorAll("form.recherche:not(#filtres)"), function (f) {
    f.addEventListener("submit", function () {
      if (f._majLieu) f._majLieu();
      if (f.elements.ou) f.elements.ou.disabled = true;  // le département part dans « dep »
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

  // Les choix sont gardés dans l'adresse (ex. ?diplome=BAFA&dep=93&mois=v:hiver&annee=2027) : on peut partager le lien.
  var params = new URLSearchParams(location.search);
  // anciens liens : ?periode=hiver-2027, ?quand=p:hiver-2027 ou ?quand=m:2027-03
  if (params.has("periode") && !params.has("quand")) params.set("quand", "p:" + params.get("periode"));
  var quand = params.get("quand");
  if (quand && !params.has("mois")) {
    var mq = quand.match(/^p:(.+)-(\d{4})$/) || [];
    var mm = quand.match(/^m:(\d{4})-(\d{2})$/) || [];
    if (mq.length) { params.set("mois", "v:" + mq[1]); params.set("annee", mq[2]); }
    if (mm.length) { params.set("mois", "m:" + mm[2]); params.set("annee", mm[1]); }
  }
  params.delete("quand"); params.delete("periode");
  Array.prototype.forEach.call(form.elements, function (e) {
    if (!e.name || !params.has(e.name)) return;
    if (e.type === "checkbox") e.checked = params.get(e.name) === "1";
    else e.value = params.get(e.name);
  });
  adapterChoix(form);
  if (params.get("type")) form.elements.type.value = params.get("type");
  // « Où ? » : le texte tapé, ou le département reçu dans l'adresse
  if (params.get("ou") && !params.get("dep")) form._majLieu();
  else if (params.get("dep")) { var l0 = lieuDe(form, params.get("dep")); form.elements.ou.value = l0 ? l0.texte : ""; }

  // le schéma du parcours suit le diplôme choisi
  function adapterParcours() {
    var dip = form.elements.diplome.value;
    Array.prototype.forEach.call(document.querySelectorAll("[data-parcours]"), function (bloc) {
      bloc.hidden = bloc.dataset.parcours !== (dip || "BAFA");
    });
  }

  function appliquer(majAdresse) {
    var f = form.elements;
    adapterChoix(form); adapterParcours();
    var dip = f.diplome.value, dep = f.dep.value, mois = f.mois.value, annee = f.annee.value, type = f.type.value;
    var formule = f.formule ? f.formule.value : "", budget = f.budget ? f.budget.value : "";
    var okPlus = function (d) { return (!formule || d.formule === formule) && (!budget || (d.prix !== "" && +d.prix <= +budget)); };
    var mots = sansAccents(f.q.value).split(/\s+/).filter(Boolean);
    liste.items.forEach(function (i) {
      var d = i.d;
      var v = dep.slice(2), ville = sansAccents(d.ville);
      var okDep = !dep || (dep.slice(0, 2) === "r:" ? d.region === v
        : dep.slice(0, 2) === "v:" ? (ville === sansAccents(v) || ville.indexOf(sansAccents(v) + " ") === 0) : d.dep === dep);
      // les vacances gardent l'année de leur période (Noël 2026 va jusqu'en janvier 2027)
      var vac = mois.slice(0, 2) === "v:";
      var okQuand = (!annee || (vac ? (d.periode || "").slice(-4) === annee : d.mois.slice(0, 4) === annee)) &&
        (!mois || (vac ? (d.periode || "").replace(/-\d{4}$/, "") === mois.slice(2) : d.mois.slice(5) === mois.slice(2)));
      i.okSansLieu = (!dip || d.diplome === dip) && okQuand && (!type || d.type === type) && okPlus(d) &&
        mots.every(function (m) { return d.texte.indexOf(m) !== -1; });
      i.okBase = (!dip || d.diplome === dip) && okDep && okQuand && (!type || d.type === type) && okPlus(d) &&
        mots.every(function (m) { return d.texte.indexOf(m) !== -1; });
      i.ok = i.okBase && dansZone(i);
    });
    // formule partenaire : dans un lieu choisi, les sessions d'un organisme partenaire de ce département passent en premier
    liste.items.forEach(function (i, k) { if (i.rang == null) i.rang = k; });
    liste.items.sort(function (a, b) { return ((dep && b.pz) ? 1 : 0) - ((dep && a.pz) ? 1 : 0) || a.rang - b.rang; });
    liste.limite = liste.par;
    var n = afficher(liste);
    var nEcoles = afficherEcoles(dip, type, dep);
    var modeEcoles = PRO.indexOf(dip) !== -1;
    document.getElementById("resultats").classList.toggle("mode-ecoles", modeEcoles);
    if (modeEcoles) {
      document.dispatchEvent(new CustomEvent("sessions:compte", { detail: nEcoles === null ? null : nEcoles }));
    } else {
      document.dispatchEvent(new CustomEvent("sessions:compte", { detail: n }));
    }
    if (plan) { majCarte(); if (!zone) cadrer(); }
    if (modeEcoles) {
      compte.textContent = nEcoles === null ? "Chargement des écoles…" : nEcoles + (nEcoles > 1 ? " écoles forment au " : " école forme au ") + dip;
      aucune.hidden = true;
    } else {
      compte.textContent = n === 0 ? "Aucune session." : zone ? n + (n > 1 ? " sessions dans cette zone de la carte" : " session dans cette zone de la carte")
        : n + (n > 1 ? " sessions correspondent" : " session correspond") + ", de la plus proche à la plus lointaine.";
      aucune.hidden = n > 0;
    }
    if (majAdresse) {
      var p = new URLSearchParams();
      Array.prototype.forEach.call(form.elements, function (e) {
        if (!e.name || e.disabled || e.name === "ou") return;
        if (e.type === "checkbox") { if (e.checked) p.set(e.name, "1"); }
        else if (e.value) p.set(e.name, e.value);
      });
      var q = p.toString();
      history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
    }
  }

  // Les écoles qui forment à un diplôme pro (leur prochaine rentrée n'est souvent pas encore déclarée)
  // Diplômes pros (CPJEPS, BPJEPS, DEJEPS, DESJEPS) : la liste des écoles qui forment remplace les sessions.
  // Renvoie le nombre d'écoles, ou null tant que la liste n'est pas chargée.
  var PRO = ["CPJEPS", "BPJEPS", "DEJEPS", "DESJEPS"];
  var blocEcoles = document.getElementById("ecoles"), ecoles = null;
  function afficherEcoles(dip, type, dep) {
    if (!blocEcoles) return null;
    if (PRO.indexOf(dip) === -1) { blocEcoles.hidden = true; return null; }
    if (!ecoles) {
      ecoles = "chargement";
      fetch(blocEcoles.dataset.source).then(function (r) { return r.json(); }).then(function (d) {
        ecoles = d; appliquer(false);
      }).catch(function () { ecoles = []; appliquer(false); });
      return null;
    }
    if (ecoles === "chargement") return null;
    var v = sansAccents(dep.slice(2));
    var mots = sansAccents(form.elements.q.value).split(/\s+/).filter(Boolean);
    var choix = ecoles.filter(function (e) {
      var ville = sansAccents(e.v), texte = sansAccents(e.o + " " + e.v + " " + (e.spn || ""));
      return e.di === dip && (!type || type === e.di + "-" + e.sp) && (!dep ||
        (dep.slice(0, 2) === "r:" ? e.r === dep.slice(2) : dep.slice(0, 2) === "v:" ? (ville === v || ville.indexOf(v + " ") === 0) : e.d === dep)) &&
        mots.every(function (m) { return texte.indexOf(m) !== -1; });
    });
    var ul = document.getElementById("ecoles-liste");
    ul.textContent = "";
    // d'abord celles qui ont une rentrée datée, puis par département
    choix.sort(function (a, b) { return (b.pr_t ? 1 : 0) - (a.pr_t ? 1 : 0) || a.d.localeCompare(b.d) || a.o.localeCompare(b.o); });
    var euros = function (n) { return n.toLocaleString("fr-FR") + " €"; };
    choix.forEach(function (e) {
      var li = el("li", "ecole");
      var corps = el("div", "ecole-corps");
      corps.appendChild(el("b", "ecole-nom", e.o));
      corps.appendChild(el("span", "ecole-lieu", e.v + " (" + e.d + ")" + (e.spn ? " · " + e.spn : "")));
      var puces = el("span", "ecole-puces");
      if (e.pr_t) puces.appendChild(el("span", "ecole-puce ecole-rentree", "Prochaine rentrée : " + e.pr_t));
      else if (e.dr) puces.appendChild(el("span", "ecole-puce", "Dernière rentrée : " + e.dr));
      if (e.px) puces.appendChild(el("span", "ecole-puce", e.pxm && e.pxm !== e.px ? "de " + euros(e.px) + " à " + euros(e.pxm) : "dès " + euros(e.px)));
      if (e.h) puces.appendChild(el("span", "ecole-puce", e.h.toLocaleString("fr-FR") + " h"));
      if (e.cpf) puces.appendChild(el("span", "ecole-puce", "Éligible au CPF"));
      if (e.dist) puces.appendChild(el("span", "ecole-puce", "En partie à distance"));
      if (puces.childNodes.length) corps.appendChild(puces);
      li.appendChild(corps);
      var a = el("a", "ecole-lien", e.recherche ? "Chercher l'école" : /annuaire-entreprises/.test(e.u) ? "Coordonnées" : "Voir la formation");
      a.href = e.u; a.target = "_blank"; a.rel = "noopener nofollow";
      a.appendChild(el("span", "sr", " : " + e.o + " (nouvel onglet)"));
      a.appendChild(document.createTextNode(" →"));
      li.appendChild(a);
      ul.appendChild(li);
    });
    var nom = (choix[0] || ecoles.filter(function (e) { return e.di === dip; })[0] || { dn: dip }).dn;
    document.getElementById("ecoles-titre").textContent = choix.length
      ? choix.length + (choix.length > 1 ? " écoles forment" : " école forme") + " au " + nom + (dep ? " dans ce secteur" : " en France")
      : "Aucune école connue pour le " + nom + " dans ce secteur : essayez la région ou toute la France.";
    blocEcoles.hidden = false;
    return choix.length;
  }


  // --- La carte, façon Airbnb : de loin, des pastilles qui comptent les sessions ; de près, une pastille par ville avec
  // son prix le plus bas. Un clic sur un prix ouvre la fiche de la session sur la carte (flèches s'il y en a plusieurs) ;
  // la liste suit la carte quand on la déplace (« Rechercher quand je déplace la carte »).
  var carteEl = document.getElementById("carte"), plan = null, calque = null, zone = null, auto = false, autoT = null, pins = {};
  var FRANCE = [[42.3, -4.8], [51.1, 8.2]];
  function dansZone(i) { return !zone || !!(i.x && i.x.g && zone.contains(i.x.g)); }
  function bouger(fn) { auto = true; clearTimeout(autoT); autoT = setTimeout(function () { auto = false; }, 900); fn(); }
  function initCarte() {
    if (plan || !window.L || !carteEl || carteEl.offsetParent === null) return;
    plan = L.map(carteEl, { scrollWheelZoom: true, maxZoom: 15, minZoom: 5, zoomControl: false });
    L.control.zoom({ position: "topright" }).addTo(plan);
    bouger(function () { plan.fitBounds(FRANCE); });
    L.tileLayer(carteEl.dataset.tuiles, { maxZoom: 18, minZoom: 4,
      attribution: '&copy; <a href="https://www.ign.fr/">IGN</a> &ndash; Géoplateforme' }).addTo(plan);
    calque = L.layerGroup().addTo(plan);
    ajouterBoutonFrance();
    plan.on("zoomend moveend", majCarte);
    plan.on("moveend", function () {
      if (auto) return;
      var suivre = document.getElementById("carte-suivre");
      if (suivre && !suivre.checked) return;
      zone = plan.getBounds().pad(-0.02); filtrerZone();
    });
    majCarte();
    cadrer();
  }
  function filtrerZone() {
    liste.items.forEach(function (i) { i.ok = (i.okBase === undefined ? true : i.okBase) && dansZone(i); });
    liste.limite = liste.par;
    var n = afficher(liste);
    compte.textContent = n === 0 ? "Aucune session dans cette zone : dézoomez ou déplacez la carte." : n + (n > 1 ? " sessions dans cette zone de la carte" : " session dans cette zone de la carte");
    aucune.hidden = true;
  }
  function prixCourt(x) { return x.px === 0 && x.app ? "Gratuit" : x.px != null ? (Number.isInteger(x.px) ? x.px : Math.round(x.px)) + " €" : null; }
  function majCarte() {
    if (!plan) return;
    calque.clearLayers(); pins = {};
    var villes = {};
    liste.items.forEach(function (i) {
      if (!i.okSansLieu || !i.x || !i.x.g) return;
      var k = i.d.dep + "|" + i.x.v;
      var x = villes[k] || (villes[k] = { k: k, n: 0, g: i.x.g, v: i.x.v, d: i.d.dep, s: [], min: null });
      x.n++; x.s.push(i);
      if (i.x.px != null && (x.min === null || i.x.px < x.min.x.px)) x.min = i;
    });
    var amas = [], zoom = plan.getZoom(), choisie = form.elements.dep.value, detail = zoom >= 9;
    Object.keys(villes).forEach(function (k) {
      var x = villes[k], p = plan.latLngToContainerPoint(x.g), proche = null;
      for (var j = 0; j < amas.length; j++) {
        if (Math.abs(amas[j].p.x - p.x) < (detail ? 64 : 56) && Math.abs(amas[j].p.y - p.y) < 30) { proche = amas[j]; break; }
      }
      if (proche) { proche.villes.push(x); proche.n += x.n; }
      else amas.push({ p: p, n: x.n, villes: [x] });
    });
    amas.forEach(function (a) {
      var la = 0, lo = 0;
      a.villes.forEach(function (x) { la += x.g[0] * x.n; lo += x.g[1] * x.n; });
      var seule = a.villes.length === 1 ? a.villes[0] : null, pos = seule ? seule.g : [la / a.n, lo / a.n];
      var active = seule && choisie === "v:" + seule.v;
      var texte = seule && detail ? (seule.min ? prixCourt(seule.min.x) : (seule.n + (seule.n > 1 ? " sessions" : " session"))) : String(a.n);
      var mk = L.marker(pos, { icon: L.divIcon({ className: "bulle-icone", iconSize: [0, 0],
        html: '<span class="pin' + (seule && detail ? " pin-prix" : " pin-amas") + (active ? " active" : "") + '"></span>' }), riseOnHover: true, keyboard: true }).addTo(calque);
      var span = mk.getElement().querySelector(".pin");
      span.textContent = texte;
      if (seule && detail && seule.n > 1) span.appendChild(el("small", null, "· " + seule.n));
      a.villes.forEach(function (x) { pins[x.k] = mk; });
      a.villes.sort(function (u, w) { return w.n - u.n; });
      if (!(seule && detail)) {
        var noms = a.villes.slice(0, 4).map(function (x) { return x.v; }).join(", ") + (a.villes.length > 4 ? "…" : "");
        mk.bindTooltip(noms + " : " + a.n + (a.n > 1 ? " sessions" : " session"), { direction: "top", offset: [0, -16], className: "bulle-info" });
      }
      mk.on("click", function () {
        if (seule && detail) { fiche(seule, mk); return; }
        var b = L.latLngBounds(a.villes.map(function (x) { return x.g; }));
        if (seule || b.getNorthEast().distanceTo(b.getSouthWest()) < 1500) plan.setView(pos, Math.max(zoom + 2, 10));
        else plan.fitBounds(b, { padding: [60, 60], maxZoom: Math.min(zoom + 3, 12) });
      });
    });
    if (boutonFrance) boutonFrance.hidden = !choisie && !zone;
  }
  // la fiche sur la carte : comme chez Airbnb, une carte arrondie au-dessus du prix, avec des flèches s'il y a plusieurs sessions
  function fiche(v, mk) {
    var s = v.s.slice().sort(function (a, b) { return a.rang - b.rang; }), k = 0;
    var boite = L.DomUtil.create("div", "pop");
    L.DomEvent.disableClickPropagation(boite); L.DomEvent.disableScrollPropagation(boite);
    function dessiner() {
      var x = s[k].x; boite.textContent = "";
      var haut = el("div", "pop-haut"); haut.dataset.diplome = x.di;
      haut.appendChild(el("span", "pop-badge", x.dn));
      var d = el("p", "pop-date"); d.appendChild(el("b", null, String(x.j))); d.appendChild(el("span", null, MOIS[parseInt(x.m.slice(5), 10) - 1])); haut.appendChild(d);
      var ferme = el("button", "pop-x", "×"); ferme.type = "button"; ferme.setAttribute("aria-label", "Fermer"); ferme.addEventListener("click", function () { plan.closePopup(); }); haut.appendChild(ferme);
      if (s.length > 1) {
        [["pop-g", "‹", -1], ["pop-d", "›", 1]].forEach(function (f) {
          var b = el("button", "pop-fl " + f[0], f[1]); b.type = "button"; b.setAttribute("aria-label", f[2] < 0 ? "Session précédente" : "Session suivante");
          b.addEventListener("click", function () { k = (k + f[2] + s.length) % s.length; dessiner(); }); haut.appendChild(b);
        });
        var pts = el("p", "pop-pts", (k + 1) + " / " + s.length); haut.appendChild(pts);
      }
      boite.appendChild(haut);
      var c = el("div", "pop-corps");
      var t = el("p", "pop-t"); t.appendChild(el("b", null, x.v + " (" + x.d + ")"));
      c.appendChild(t);
      c.appendChild(el("p", "pop-l", x.dn + (x.spn ? " · " + x.spn : (x.t !== "parcours" && x.t !== "session" ? " · " + x.tn.toLowerCase() : "")) + (x.th ? " · " + x.th : "")));
      c.appendChild(el("p", "pop-l", x.dates + " · " + x.o));
      var bas = el("p", "pop-bas"); var px = prixCourt(x);
      bas.appendChild(px ? el("b", null, px) : el("span", null, "prix à voir"));
      if (px && px !== "Gratuit") bas.appendChild(el("span", null, " la session"));
      var voir = el("a", "pop-voir", "Voir →"); voir.href = x.u; voir.target = "_blank"; voir.rel = "noopener nofollow";
      if (x.ok) { voir.dataset.org = x.ok; voir.dataset.orgT = "clic_session"; voir.dataset.orgD = x.d || ""; }
      bas.appendChild(voir); c.appendChild(bas);
      if (s.length > 1) { var tout = el("button", "pop-tout", "Voir les " + s.length + " sessions à " + v.v); tout.type = "button"; tout.addEventListener("click", function () { plan.closePopup(); choisirVille(v.v, v.d); }); c.appendChild(tout); }
      boite.appendChild(c);
    }
    dessiner();
    bouger(function () {
      L.popup({ closeButton: false, offset: [0, -16], className: "pop-carte", maxWidth: 300, minWidth: 300, autoPanPadding: [20, 20] })
        .setLatLng(v.g).setContent(boite).openOn(plan);
    });
    var span = mk.getElement() && mk.getElement().querySelector(".pin");
    Array.prototype.forEach.call(carteEl.querySelectorAll(".pin.ouverte"), function (p) { p.classList.remove("ouverte"); });
    if (span) span.classList.add("ouverte");
  }
  // survol d'une carte de la liste : sa pastille passe en foncé sur la carte
  liste.el.addEventListener("mouseover", function (e) {
    var c = e.target.closest && e.target.closest(".session"); if (!c || !c._i || !c._i.x || !plan) return;
    var mk = pins[c._i.d.dep + "|" + c._i.x.v], sp = mk && mk.getElement() && mk.getElement().querySelector(".pin");
    Array.prototype.forEach.call(carteEl.querySelectorAll(".pin.survol"), function (p) { if (p !== sp) p.classList.remove("survol"); });
    if (sp) { sp.classList.add("survol"); mk.setZIndexOffset(1000); }
  });
  liste.el.addEventListener("mouseleave", function () { if (carteEl) Array.prototype.forEach.call(carteEl.querySelectorAll(".pin.survol"), function (p) { p.classList.remove("survol"); }); });
  var depuisCarte = false;
  function cadrer() {
    if (!plan) return;
    if (depuisCarte) { depuisCarte = false; return; }
    var pts = [];
    liste.items.forEach(function (i) { if (i.ok && i.x && i.x.g) pts.push(i.x.g); });
    if (form.elements.dep.value && pts.length) bouger(function () { plan.fitBounds(pts, { maxZoom: 11, padding: [40, 40] }); });
    else if (!form.elements.dep.value) bouger(function () { plan.fitBounds(FRANCE); });
  }
  function choisirVille(v, d) {
    form.elements.ou.value = v + " (" + d + ")";
    form.elements.dep.value = "v:" + v;
    zone = null;
    appliquer(true);
  }
  // « Toute la France » : enlève le lieu choisi et montre tout le pays
  var boutonFrance = null;
  function ajouterBoutonFrance() {
    var Ctrl = L.Control.extend({ options: { position: "bottomleft" }, onAdd: function () {
      var b = L.DomUtil.create("button", "bouton-france");
      b.type = "button"; b.textContent = "Toute la France"; b.hidden = true;
      L.DomEvent.disableClickPropagation(b);
      b.addEventListener("click", function () {
        form.elements.ou.value = ""; form.elements.dep.value = ""; zone = null;
        appliquer(true); bouger(function () { plan.fitBounds(FRANCE); });
      });
      boutonFrance = b;
      return b;
    } });
    plan.addControl(new Ctrl());
  }
  var boutonCarte = document.getElementById("bouton-carte"), blocCarte = document.getElementById("carte-bloc");
  if (boutonCarte && blocCarte) {
    boutonCarte.hidden = false;
    boutonCarte.addEventListener("click", function () {
      var ouvrir = !blocCarte.classList.contains("ouverte");
      blocCarte.classList.toggle("ouverte", ouvrir);
      boutonCarte.setAttribute("aria-expanded", ouvrir ? "true" : "false");
      boutonCarte.querySelector("span").textContent = ouvrir ? "Masquer la carte" : "Voir la carte";
      if (ouvrir) { initCarte(); if (plan) plan.invalidateSize(); }
    });
  }

  function f2dep() { return form.elements.dep.value; }
  function brancher() {
    form.addEventListener("change", function () { zone = null; appliquer(true); });
    form.addEventListener("input", function (e) {
      if (e.target.name === "q") { zone = null; appliquer(true); }
      // un département reconnu pendant la frappe filtre tout de suite ; un champ vidé remet toute la France
      if (e.target.name === "ou" && (f2dep() || !e.target.value.trim())) { zone = null; appliquer(true); }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      appliquer(true);
      document.getElementById("resultats").scrollIntoView({ behavior: "smooth" });
    });
    if (params.toString()) appliquer(false);
    else { adapterChoix(form); adapterParcours(); document.dispatchEvent(new CustomEvent("sessions:compte", { detail: afficher(liste) })); }
  }

  // toutes les sessions de France : chargées une fois, puis filtrées sur place
  var source = liste.el.dataset.source;
  if (!source || !window.fetch) { brancher(); return; }
  compte.textContent = "Chargement des sessions…";
  fetch(source).then(function (r) { return r.json(); }).then(function (donnees) {
    liste.items.forEach(function (i) { if (i.el) i.el.remove(); });
    liste.items = donnees.map(function (x, rang) {
      return { x: x, el: null, ok: true, okSansLieu: true, rang: rang, pz: !!x.pz, d: {
        dep: x.d, ville: x.v, region: x.r, periode: x.p, mois: x.m, diplome: x.di, type: x.di + "-" + (x.sp || x.t),
        prix: x.px === null ? "" : x.px, formule: x.fo || "",
        texte: sansAccents([x.v, x.dn2, x.d, x.th || "", x.o, x.tn, x.dl, x.spn || "", x.spg || ""].join(" ")) } };
    });
    compte.textContent = donnees.length + " sessions à venir";
    brancher();
    initCarte();
    window.addEventListener("resize", function () { initCarte(); if (plan) plan.invalidateSize(); });
  }).catch(function () { compte.textContent = liste.items.length + " sessions"; brancher(); });
})();

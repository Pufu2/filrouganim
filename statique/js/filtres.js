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
    var h = el("h3", "s-titre", x.dn + (x.spn ? " · " + x.spn : (x.t !== "parcours" && x.t !== "session" ? " · " + x.tn.toLowerCase() : "")));
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
    verif.appendChild(document.createTextNode(x.n.concat([x.vf]).join(" · ")));
    corps.appendChild(verif);
    a.appendChild(corps);
    var prix = el("p", "s-prix");
    if (x.px === 0 && x.app) { prix.textContent = "Gratuit"; prix.appendChild(el("span", "s-prix-sous", "en apprentissage")); }
    else if (x.px !== null && x.px !== undefined) prix.textContent = euros(x.px); else prix.appendChild(el("span", null, "prix à voir"));
    a.appendChild(prix);
    var lien = el("a", "s-lien", "Voir");
    lien.href = x.u; lien.rel = "noopener nofollow"; lien.target = "_blank";
    lien.appendChild(el("span", "sr", (x.lba ? " la formation sur La bonne alternance" : x.site ? " le site de " + x.o : " la session chez " + x.o) + " (nouvel onglet)"));
    lien.appendChild(document.createTextNode(" →"));
    a.appendChild(lien);
    return a;
  }

  // --- les listes : chaque élément a ses critères (d) et sa carte (déjà dans la page, ou fabriquée au besoin)
  function depuisCarte(c) {
    var d = c.dataset;
    return { el: c, d: { dep: d.dep, ville: d.ville, region: d.region, periode: d.periode, mois: d.mois, diplome: d.diplome, type: d.type,
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
    var mots = sansAccents(f.q.value).split(/\s+/).filter(Boolean);
    liste.items.forEach(function (i) {
      var d = i.d;
      var v = dep.slice(2), ville = sansAccents(d.ville);
      var okDep = !dep || (dep.slice(0, 2) === "r:" ? d.region === v
        : dep.slice(0, 2) === "v:" ? (ville === sansAccents(v) || ville.indexOf(sansAccents(v) + " ") === 0) : d.dep === dep);
      var okQuand = (!annee || d.mois.slice(0, 4) === annee) && (!mois || (mois.slice(0, 2) === "v:"
        ? d.periode.replace(/-\d{4}$/, "") === mois.slice(2) : d.mois.slice(5) === mois.slice(2)));
      i.okSansLieu = (!dip || d.diplome === dip) && okQuand && (!type || d.type === type) &&
        mots.every(function (m) { return d.texte.indexOf(m) !== -1; });
      i.ok = (!dip || d.diplome === dip) && okDep && okQuand && (!type || d.type === type) &&
        mots.every(function (m) { return d.texte.indexOf(m) !== -1; });
    });
    liste.limite = liste.par;
    var n = afficher(liste);
    afficherEcoles(dip, type, dep);
    if (plan) { majCarte(); cadrer(); }
    compte.textContent = n === 0 ? "Aucune session." : n + (n > 1 ? " sessions correspondent" : " session correspond") +
      ", de la plus proche à la plus lointaine.";
    aucune.hidden = n > 0;
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
  var blocEcoles = document.getElementById("ecoles"), ecoles = null;
  function afficherEcoles(dip, type, dep) {
    if (!blocEcoles) return;
    if (!dip || ["BAFA", "BAFD", "PSC1"].indexOf(dip) !== -1) { blocEcoles.hidden = true; return; }
    if (!ecoles) {
      ecoles = [];
      fetch(blocEcoles.dataset.source).then(function (r) { return r.json(); }).then(function (d) {
        ecoles = d; afficherEcoles(form.elements.diplome.value, form.elements.type.value, form.elements.dep.value);
      }).catch(function () {});
      return;
    }
    var v = sansAccents(dep.slice(2));
    var choix = ecoles.filter(function (e) {
      var ville = sansAccents(e.v);
      return e.di === dip && (!type || type === e.di + "-" + e.sp) && (!dep ||
        (dep.slice(0, 2) === "r:" ? e.r === dep.slice(2) : dep.slice(0, 2) === "v:" ? (ville === v || ville.indexOf(v + " ") === 0) : e.d === dep));
    });
    var ul = document.getElementById("ecoles-liste");
    ul.textContent = "";
    // d'abord les écoles du catalogue Mon Compte Formation (avec prix), puis celles qui ont ouvert une session dans l'année
    choix.sort(function (a, b) { return (b.cpf ? 1 : 0) - (a.cpf ? 1 : 0) || a.d.localeCompare(b.d) || a.o.localeCompare(b.o); });
    var euros = function (n) { return n.toLocaleString("fr-FR") + " €"; };
    choix.forEach(function (e) {
      var li = el("li"); li.appendChild(el("b", null, e.o));
      var infos = [e.v + " (" + e.d + ")"];
      if (e.spn) infos.push(e.spn);
      if (e.cpf) {
        if (e.h) infos.push(e.h.toLocaleString("fr-FR") + " h");
        if (e.px) infos.push(e.pxm && e.pxm !== e.px ? "de " + euros(e.px) + " à " + euros(e.pxm) : euros(e.px));
        if (e.dist) infos.push("en partie à distance");
        infos.push("éligible au CPF");
      } else infos.push("dernière rentrée : " + e.dr);
      li.appendChild(el("small", null, infos.join(" · ")));
      if (e.u) {
        var a = el("a", "ecole-lien", "Coordonnées de l'école");
        a.href = e.u; a.target = "_blank"; a.rel = "noopener nofollow";
        li.appendChild(a);
      }
      ul.appendChild(li);
    });
    document.getElementById("ecoles-titre").textContent = choix.length
      ? choix.length + (choix.length > 1 ? " écoles forment" : " école forme") + " au " + choix[0].dn + (dep ? " dans ce secteur" : " en France")
      : "Aucune autre école connue pour ce diplôme dans ce secteur";
    blocEcoles.hidden = false;
  }

  // --- La carte : des bulles qui comptent les sessions, par département de loin et par ville de près
  var carteEl = document.getElementById("carte"), plan = null, calque = null;
  var FRANCE = [[42.3, -4.8], [51.1, 8.2]];
  function initCarte() {
    if (plan || !window.L || !carteEl || carteEl.offsetParent === null) return;
    plan = L.map(carteEl, { scrollWheelZoom: true, maxZoom: 14, minZoom: 5 }).fitBounds(FRANCE);
    L.tileLayer(carteEl.dataset.tuiles, { maxZoom: 18, minZoom: 4,
      attribution: '&copy; <a href="https://www.ign.fr/">IGN</a> &ndash; G\u00e9oplateforme' }).addTo(plan);
    calque = L.layerGroup().addTo(plan);
    ajouterBoutonFrance();
    plan.on("zoomend moveend", majCarte);
    majCarte();
    cadrer();
  }
  // Les bulles : les villes proches à l'écran sont réunies en une seule bulle (seulement un chiffre, comme les
  // cartes de location) ; le nom des villes s'affiche au survol. Un clic zoome, ou choisit la ville s'il n'y en a qu'une.
  function majCarte() {
    if (!plan) return;
    calque.clearLayers();
    var villes = {};
    liste.items.forEach(function (i) {
      if (!i.okSansLieu || !i.x || !i.x.g) return;
      var k = i.d.dep + "|" + i.x.v;
      var x = villes[k] || (villes[k] = { n: 0, g: i.x.g, v: i.x.v, d: i.d.dep });
      x.n++;
    });
    var amas = [], zone = plan.getBounds(), dans = 0, choisie = form.elements.dep.value;
    Object.keys(villes).forEach(function (k) {
      var x = villes[k], p = plan.latLngToContainerPoint(x.g);
      if (zone.contains(x.g)) dans += x.n;
      var proche = null;
      for (var j = 0; j < amas.length; j++) {
        if (Math.abs(amas[j].p.x - p.x) < 46 && Math.abs(amas[j].p.y - p.y) < 34) { proche = amas[j]; break; }
      }
      if (proche) { proche.villes.push(x); proche.n += x.n; }
      else amas.push({ p: p, n: x.n, villes: [x] });
    });
    amas.forEach(function (a) {
      var la = 0, lo = 0;
      a.villes.forEach(function (x) { la += x.g[0] * x.n; lo += x.g[1] * x.n; });
      var pos = [la / a.n, lo / a.n], seule = a.villes.length === 1 ? a.villes[0] : null;
      var active = seule && choisie === "v:" + seule.v;
      var mk = L.marker(pos, { icon: L.divIcon({ className: "bulle-icone", iconSize: [0, 0],
        html: '<span class="bulle' + (a.n >= 100 ? " bulle-grande" : "") + (active ? " active" : "") + '"></span>' }), riseOnHover: true }).addTo(calque);
      mk.getElement().querySelector(".bulle").textContent = a.n;
      a.villes.sort(function (u, w) { return w.n - u.n; });
      var noms = a.villes.slice(0, 4).map(function (x) { return x.v; }).join(", ") + (a.villes.length > 4 ? "\u2026" : "");
      mk.bindTooltip(noms + " : " + a.n + (a.n > 1 ? " sessions" : " session"), { direction: "top", offset: [0, -16], className: "bulle-info" });
      mk.on("click", function () {
        if (seule) { choisirVille(seule.v, seule.d); return; }
        var b = L.latLngBounds(a.villes.map(function (x) { return x.g; }));
        // des villes trop proches pour être séparées en zoomant : une petite liste à choisir
        if (plan.getZoom() >= 11 || b.getNorthEast().distanceTo(b.getSouthWest()) < 1500) {
          var div = L.DomUtil.create("div", "bulle-liste");
          a.villes.forEach(function (x) {
            var bt = L.DomUtil.create("button", "", div);
            bt.type = "button"; bt.textContent = x.v + " \u00b7 " + x.n;
            bt.addEventListener("click", function () { plan.closePopup(); choisirVille(x.v, x.d); });
          });
          L.popup({ closeButton: false, offset: [0, -14], className: "bulle-popup" }).setLatLng(pos).setContent(div).openOn(plan);
        } else {
          plan.fitBounds(b, { padding: [60, 60], maxZoom: Math.min(plan.getZoom() + 3, 12) });
        }
      });
    });
    document.getElementById("carte-zone").textContent = dans + (dans > 1 ? " sessions dans cette zone" : " session dans cette zone");
    if (boutonFrance) boutonFrance.hidden = !choisie;
  }
  var depuisCarte = false;
  function cadrer() {
    if (!plan) return;
    if (depuisCarte) { depuisCarte = false; return; }
    var pts = [];
    liste.items.forEach(function (i) { if (i.ok && i.x && i.x.g) pts.push(i.x.g); });
    if (form.elements.dep.value && pts.length) plan.fitBounds(pts, { maxZoom: 10, padding: [40, 40] });
    else if (!form.elements.dep.value) plan.fitBounds(FRANCE);
  }
  function choisirVille(v, d) {
    form.elements.ou.value = v + " (" + d + ")";
    form.elements.dep.value = "v:" + v;
    depuisCarte = true;
    appliquer(true);
  }
  // « Toute la France » : enlève le lieu choisi et montre tout le pays
  var boutonFrance = null;
  function ajouterBoutonFrance() {
    var Ctrl = L.Control.extend({ options: { position: "topleft" }, onAdd: function () {
      var b = L.DomUtil.create("button", "bouton-france");
      b.type = "button"; b.textContent = "Toute la France"; b.hidden = true;
      L.DomEvent.disableClickPropagation(b);
      b.addEventListener("click", function () {
        form.elements.ou.value = ""; form.elements.dep.value = "";
        appliquer(true); plan.fitBounds(FRANCE);
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
    form.addEventListener("change", function () { appliquer(true); });
    form.addEventListener("input", function (e) {
      if (e.target.name === "q") appliquer(true);
      // un département reconnu pendant la frappe filtre tout de suite ; un champ vidé remet toute la France
      if (e.target.name === "ou" && (f2dep() || !e.target.value.trim())) appliquer(true);
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      appliquer(true);
      document.getElementById("resultats").scrollIntoView({ behavior: "smooth" });
    });
    if (params.toString()) appliquer(false); else { adapterChoix(form); adapterParcours(); afficher(liste); }
  }

  // toutes les sessions de France : chargées une fois, puis filtrées sur place
  var source = liste.el.dataset.source;
  if (!source || !window.fetch) { brancher(); return; }
  compte.textContent = "Chargement des sessions…";
  fetch(source).then(function (r) { return r.json(); }).then(function (donnees) {
    liste.items.forEach(function (i) { if (i.el) i.el.remove(); });
    liste.items = donnees.map(function (x) {
      return { x: x, el: null, ok: true, okSansLieu: true, d: {
        dep: x.d, ville: x.v, region: x.r, periode: x.p, mois: x.m, diplome: x.di, type: x.di + "-" + (x.sp || x.t),
        prix: x.px === null ? "" : x.px,
        texte: sansAccents([x.v, x.dn2, x.d, x.th || "", x.o, x.tn, x.dl, x.spn || "", x.spg || ""].join(" ")) } };
    });
    compte.textContent = donnees.length + " sessions à venir";
    brancher();
    initCarte();
    window.addEventListener("resize", function () { initCarte(); if (plan) plan.invalidateSize(); });
  }).catch(function () { compte.textContent = liste.items.length + " sessions"; brancher(); });
})();

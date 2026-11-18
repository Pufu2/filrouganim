/* Fil Roug'Anim : « Inscrire mon enfant » (/enfants/). Quatre questions en gros boutons, les résultats en cartes sans
   recharger la page, chaque réponse gardée dans l'adresse (on peut la partager), le tri, et l'alerte quand rien ne
   correspond (creer_alerte, avec double confirmation par e-mail). Les séjours sont dans la page (build.py, carte_sejour). */
(function () {
  "use strict";
  // arrivé depuis un e-mail d'alerte : on note que l'alerte sert encore (sinon elle est effacée au bout d'un an)
  (function () { var m = location.search.match(/[?&]alerte=([0-9a-f]{20,64})/); var r = document.querySelector("[data-cle][data-url]");
    if (!m || !r) return;
    try { fetch(r.dataset.url + "/rest/v1/rpc/alerte_vue", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", apikey: r.dataset.cle }, body: JSON.stringify({ j: m[1] }) }).catch(function () {}); } catch (e) {}
    history.replaceState(null, "", location.pathname + location.search.replace(/[?&]alerte=[0-9a-f]+/, "").replace(/^&/, "?") + location.hash); })();
  var racine = document.getElementById("sjc"), brut = document.getElementById("sjc-donnees");
  if (!racine || !brut) return;
  var D = JSON.parse(brut.textContent), cartes = D.cartes || [];
  var form = document.getElementById("sjc-questions"), res = document.getElementById("sjc-resultats"), nb = document.getElementById("sjc-nb");
  var tri = document.getElementById("sjc-tri"), effacer = document.getElementById("sjc-effacer");
  var alerte = document.getElementById("sjc-alerte");
  var MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  // les périodes, en jours de l'année (mois-jour) : assez large pour couvrir les trois zones de vacances
  var PERIODES = { hiver: [["02-01", "03-15"]], printemps: [["04-01", "05-15"]], juillet: [["07-01", "07-31"]], aout: [["08-01", "08-31"]],
                   toussaint: [["10-15", "11-10"]], noel: [["12-18", "12-31"], ["01-01", "01-06"]] };
  var BANDES = { "3-5": [3, 5], "6-8": [6, 8], "9-11": [9, 11], "12-14": [12, 14], "15-17": [15, 17] };
  var etat = { age: [], quand: [], genre: "", envie: [] };

  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sansAccent(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function jour(iso) { var d = new Date(iso + "T12:00:00"); return d.getDate() + " " + MOIS[d.getMonth()]; }
  function periode(d) { return d[0] === d[1] ? "le " + jour(d[0]) : jour(d[0]) + " → " + jour(d[1]) + " " + d[1].slice(0, 4); }
  function euros(n) { return Number(n).toLocaleString("fr-FR") + " €"; }
  function libre(d) { return !d[3] && d[2] !== 0; }

  /* ---------- l'adresse <-> les réponses ---------- */
  function lireAdresse() {
    var q = new URLSearchParams(location.search);
    ["age", "quand", "envie"].forEach(function (k) { etat[k] = (q.get(k) || "").split(",").filter(Boolean); });
    etat.genre = q.get("genre") || "";
    ["dep", "depart", "dest", "budget"].forEach(function (k) { if (form.elements[k]) form.elements[k].value = q.get(k) || ""; });
    ["passcolo", "vacaf", "places"].forEach(function (k) { form.elements[k].checked = q.get(k) === "1"; });
    tri.value = q.get("tri") === "prix" ? "prix" : "date";
    if (form.elements.budget.value || form.elements.passcolo.checked || form.elements.vacaf.checked || form.elements.places.checked) form.querySelector(".sjc-plus").open = true;
  }
  function ecrireAdresse() {
    var q = new URLSearchParams();
    ["age", "quand", "envie"].forEach(function (k) { if (etat[k].length) q.set(k, etat[k].join(",")); });
    if (etat.genre) q.set("genre", etat.genre);
    ["dep", "depart", "dest", "budget"].forEach(function (k) { var v = form.elements[k].value.trim(); if (v) q.set(k, v); });
    ["passcolo", "vacaf", "places"].forEach(function (k) { if (form.elements[k].checked) q.set(k, "1"); });
    if (tri.value === "prix") q.set("tri", "prix");
    var s = q.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : ""));
    effacer.hidden = !s;
  }

  /* ---------- les boutons ---------- */
  Array.prototype.forEach.call(form.querySelectorAll(".sjc-choix"), function (g) {
    var k = g.dataset.q, multi = g.hasAttribute("data-multi");
    g.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var v = b.dataset.v;
      if (multi) { var i = etat[k].indexOf(v); if (i >= 0) etat[k].splice(i, 1); else etat[k].push(v); }
      else etat[k] = etat[k] === v ? "" : v;
      maj();
    });
  });
  function majBoutons() {
    Array.prototype.forEach.call(form.querySelectorAll(".sjc-choix"), function (g) {
      var k = g.dataset.q;
      Array.prototype.forEach.call(g.querySelectorAll("button"), function (b) {
        var on = Array.isArray(etat[k]) ? etat[k].indexOf(b.dataset.v) >= 0 : etat[k] === b.dataset.v;
        b.classList.toggle("sjc-on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    });
    // à la journée : pas de départ ni de destination à l'étranger
    var jour_ = etat.genre === "journee";
    form.querySelector(".sjc-ou-depart").hidden = jour_; form.querySelector(".sjc-ou-dest").hidden = jour_;
  }
  form.addEventListener("input", function () { maj(); });
  form.addEventListener("change", function () { maj(); });
  tri.addEventListener("change", function () { maj(); });
  effacer.addEventListener("click", function () {
    etat = { age: [], quand: [], genre: "", envie: [] }; form.reset(); tri.value = "date"; maj();
  });

  /* ---------- le filtre ---------- */
  function dansPeriode(d, cles) {
    return cles.some(function (k) {
      if (!PERIODES[k]) return false;
      return PERIODES[k].some(function (pl) {
        var a = d[0].slice(5), b = d[1].slice(5);
        // une date sur deux années (Noël) : on regarde le début et la fin
        return (a <= pl[1] && b >= pl[0]) || (a > b && (pl[0] <= b || pl[1] >= a));
      });
    });
  }
  function filtrer() {
    var f = form.elements, dep = f.dep.value, depart = sansAccent(f.depart.value), dest = f.dest.value, budget = parseFloat(f.budget.value);
    var periodes = etat.quand.filter(function (k) { return k !== "mercredis"; }), mercredis = etat.quand.indexOf("mercredis") >= 0;
    return cartes.map(function (c) {
      if (etat.age.length && !etat.age.some(function (b) { var r = BANDES[b]; return c.a[0] <= r[1] && c.a[1] >= r[0]; })) return null;
      var journee = c.ty.indexOf("accueil") === 0;
      if (etat.genre === "sejour" && journee) return null;
      if (etat.genre === "journee" && !journee) return null;
      if (etat.envie.length && !etat.envie.some(function (e) { return c.e.indexOf(e) >= 0; })) return null;
      if (dep && c.dep !== dep) return null;
      if (journee && etat.genre !== "journee" && (depart || dest)) return null;
      if (!journee && depart && !c.tr.concat([c.v]).some(function (v) { return sansAccent(v).indexOf(depart) >= 0; })) return null;
      if (!journee && dest === "fr" && c.p !== "FR") return null;
      if (!journee && dest === "etranger" && c.p === "FR") return null;
      if (!isNaN(budget) && (c.px == null || c.px > budget)) return null;
      if (f.passcolo.checked && c.pc == null) return null;
      if (f.vacaf.checked && c.ai.indexOf("vacaf") < 0) return null;
      var dates = c.d;
      if (etat.quand.length) {
        dates = c.d.filter(function (d) { return dansPeriode(d, periodes); });
        if (c.ty === "accueil_mercredis") dates = mercredis ? c.d : [];
        if (!dates.length) return null;
      }
      if (f.places.checked) { dates = dates.filter(libre); if (!dates.length) return null; }
      return { c: c, dates: dates };
    }).filter(Boolean);
  }

  /* ---------- les cartes ---------- */
  function carte(r, exemple) {
    var c = r.c, a = el("a", "sjc-carte" + (exemple ? " sjc-carte-ex" : "")); a.href = c.u;
    var ph = el("span", "sjc-photo sjc-b-" + (c.e[0] || "decouverte"));
    if (c.ph) ph.style.backgroundImage = "url(" + JSON.stringify(racine.dataset.photos + c.ph) + ")";
    else ph.appendChild(el("span", "sjc-photo-t", (D.types[c.ty] || [""])[0]));
    var et = el("span", "sjc-etiquettes");
    if (exemple) et.appendChild(el("span", "sjc-et-ex", "Exemple"));
    if (c.une) et.appendChild(el("span", "sjc-et-une", "Partenaire"));
    var prochaine = r.dates.filter(libre)[0];
    if (!r.dates.some(libre)) et.appendChild(el("span", "sjc-et-complet", "Complet"));
    else if (prochaine && prochaine[2] != null && prochaine[2] <= 5) et.appendChild(el("span", "sjc-et-peu", "Plus que " + prochaine[2] + " place" + (prochaine[2] > 1 ? "s" : "")));
    if (c.pc) et.appendChild(el("span", "sjc-et-aide", "Pass Colo"));
    else if (c.ai.indexOf("vacaf") >= 0) et.appendChild(el("span", "sjc-et-aide", "VACAF"));
    ph.appendChild(et); a.appendChild(ph);
    var co = el("span", "sjc-corps");
    var journee = c.ty.indexOf("accueil") === 0;
    var nuits = !journee && c.d[0] ? Math.round((new Date(c.d[0][1]) - new Date(c.d[0][0])) / 864e5) + 1 : 0;
    co.appendChild(el("span", "sjc-sur", c.a[0] + "-" + c.a[1] + " ans · " + (journee ? "À la journée" : (D.types[c.ty] || [""])[0] + (nuits ? " " + nuits + " jours" : ""))));
    co.appendChild(el("b", "sjc-titre", c.t));
    var lieu = c.p === "FR" ? c.v + (c.dep ? " (" + c.dep + ")" : "") : (c.r ? c.r + ", " : "") + c.p;
    co.appendChild(el("span", "sjc-ligne sjc-lieu", lieu + (c.tr.length ? " · départ de " + c.tr.slice(0, 2).join(", ") + (c.tr.length > 2 ? "…" : "") : "")));
    co.appendChild(el("span", "sjc-ligne sjc-quand", r.dates.slice(0, 2).map(periode).join(" · ") + (r.dates.length > 2 ? " · +" + (r.dates.length - 2) : "")));
    var pied = el("span", "sjc-pied");
    var px = el("span", "sjc-prix");
    if (c.px != null) { px.appendChild(document.createTextNode("dès ")); px.appendChild(el("b", null, euros(c.px))); if (c.pu === "jour") px.appendChild(document.createTextNode(" la journée")); }
    else px.textContent = "Prix sur demande";
    pied.appendChild(px);
    if (c.pc) pied.appendChild(el("span", "sjc-pc", "jusqu'à " + euros(c.pc) + " d'aide Pass Colo"));
    co.appendChild(pied);
    co.appendChild(el("span", "sjc-st", c.s + " · vérifiée"));
    a.appendChild(co);
    return a;
  }

  function maj() {
    majBoutons(); ecrireAdresse();
    var r = filtrer();
    r.sort(function (x, y) {
      if (tri.value === "prix") return (x.c.px == null) - (y.c.px == null) || (x.c.px || 0) - (y.c.px || 0);
      return (y.c.une ? 1 : 0) - (x.c.une ? 1 : 0) || (x.dates[0] ? x.dates[0][0] : "9").localeCompare(y.dates[0] ? y.dates[0][0] : "9");
    });
    res.textContent = "";
    var actif = !effacer.hidden;
    if (!cartes.length) {
      nb.textContent = "Les premiers séjours arrivent : les structures commencent à publier les leurs.";
      var v = el("div", "sjc-vide");
      v.appendChild(el("p", null, "Laissez votre e-mail ci-dessous : vous serez prévenu dès qu'un séjour correspond. En attendant, voici à quoi ressemble une fiche."));
      res.appendChild(v);
      if (D.exemple) { var g0 = el("div", "sjc-grille"); g0.appendChild(carte({ c: D.exemple, dates: D.exemple.d }, true)); res.appendChild(g0); }
    } else if (!r.length) {
      nb.textContent = "Aucun séjour pour ces critères.";
      var v2 = el("div", "sjc-vide"); v2.appendChild(el("p", null, "Élargissez l'âge ou la période, ou recevez une alerte dès qu'un séjour correspond."));
      res.appendChild(v2);
    } else {
      nb.textContent = r.length + (r.length > 1 ? " séjours et accueils" : " séjour") + (actif ? " pour vos critères" : " à venir");
      var g = el("div", "sjc-grille"); r.forEach(function (x) { g.appendChild(carte(x)); }); res.appendChild(g);
      if (r.some(function (x) { return x.c.une; })) res.appendChild(el("p", "fp-note", "« Partenaire » : structure abonnée à Fil Roug'Anim, mise en avant dans les résultats."));
    }
    alerte.hidden = !!(cartes.length && r.length && r.length >= 3);
    document.getElementById("sjc-alerte-t").textContent = r.length ? "Prévenez-moi des nouveaux séjours de ce genre" : "Recevez une alerte dès qu'un séjour correspond";
  }

  /* ---------- l'alerte ---------- */
  var fa = document.getElementById("sjc-alerte-f"), ra = document.getElementById("sjc-alerte-retour");
  fa.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!fa.checkValidity()) { fa.reportValidity(); return; }
    var crit = { age: etat.age, periode: etat.quand, envie: etat.envie, type: etat.genre || null, departement: form.elements.dep.value || null };
    var b = fa.querySelector("button"); b.disabled = true; ra.hidden = false; ra.className = "sjc-alerte-retour"; ra.textContent = "Envoi…";
    fetch(racine.dataset.url + "/rest/v1/rpc/creer_alerte", { method: "POST", headers: { "Content-Type": "application/json", apikey: racine.dataset.cle },
      body: JSON.stringify({ email: fa.elements.email.value.trim(), criteres: crit }) })
      .then(function (r) { if (r.ok) return; return r.json().then(function (j) { throw new Error(j && j.message || "erreur"); }); })
      .then(function () { fa.reset(); ra.className = "sjc-alerte-retour sjc-ok"; ra.textContent = "C'est noté ! Confirmez votre adresse avec le lien que nous venons de vous envoyer (pensez aux courriers indésirables)."; })
      .catch(function (err) { ra.className = "sjc-alerte-retour sjc-ko"; var t = String(err && err.message || ""); ra.textContent = /[a-zé]/i.test(t) && t !== "erreur" && !/fetch/i.test(t) ? t : "L'envoi n'a pas marché. Réessayez dans un instant."; })
      .then(function () { b.disabled = false; });
  });

  // les villes de départ proposées
  var villes = {}; cartes.forEach(function (c) { c.tr.forEach(function (v) { villes[v] = 1; }); });
  var dl = document.getElementById("sjc-villes"); Object.keys(villes).sort().forEach(function (v) { var o = el("option"); o.value = v; dl.appendChild(o); });

  lireAdresse(); maj();
})();

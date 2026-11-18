/* Fil Roug'Anim : « Inscrire mon enfant » (/enfants/). Toutes les offres des structures (séjours, accueils de loisirs,
   périscolaire) en cartes, avec deux filtres : le type et le lieu (ville ou département). Les réponses se gardent dans
   l'adresse. Quand rien ne correspond : « Décrire mon besoin » et l'alerte. La version par âge et par période est en
   réserve dans sejours-questions.js. Les offres sont dans la page (build.py, carte_sejour). */
(function () {
  "use strict";
  var racine = document.getElementById("sjc"), brut = document.getElementById("sjc-donnees");
  if (!racine || !brut) return;
  // arrivé depuis un e-mail d'alerte : on note que l'alerte sert encore (sinon elle est effacée au bout d'un an)
  (function () { var m = location.search.match(/[?&]alerte=([0-9a-f]{20,64})/);
    if (!m) return;
    try { fetch(racine.dataset.url + "/rest/v1/rpc/alerte_vue", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", apikey: racine.dataset.cle }, body: JSON.stringify({ j: m[1] }) }).catch(function () {}); } catch (e) {}
    history.replaceState(null, "", location.pathname + location.search.replace(/[?&]alerte=[0-9a-f]+/, "").replace(/^&/, "?") + location.hash); })();
  var D = JSON.parse(brut.textContent), cartes = D.cartes || [];
  var form = document.getElementById("sjc-filtres"), res = document.getElementById("sjc-resultats"), nb = document.getElementById("sjc-nb");
  var tri = document.getElementById("sjc-tri"), effacer = document.getElementById("sjc-effacer"), alerte = document.getElementById("sjc-alerte");
  var MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  var GROUPES = { sejours: ["sejour", "mini_sejour"], accueils: ["accueil_vacances", "accueil_mercredis"], periscolaire: ["accueil_periscolaire"] };
  var type = "";

  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sansAccent(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function jour(iso) { var d = new Date(iso + "T12:00:00"); return d.getDate() + " " + MOIS[d.getMonth()]; }
  function periode(d) { return d[0] === d[1] ? "le " + jour(d[0]) : jour(d[0]) + " → " + jour(d[1]) + " " + d[1].slice(0, 4); }
  function euros(n) { return Number(n).toLocaleString("fr-FR") + " €"; }
  function libre(d) { return !d[3] && d[2] !== 0; }

  function lireAdresse() {
    var q = new URLSearchParams(location.search);
    type = GROUPES[q.get("type")] ? q.get("type") : "";
    form.elements.ou.value = q.get("ou") || "";
    tri.value = q.get("tri") === "prix" ? "prix" : "date";
  }
  function ecrireAdresse() {
    var q = new URLSearchParams();
    if (type) q.set("type", type);
    if (form.elements.ou.value.trim()) q.set("ou", form.elements.ou.value.trim());
    if (tri.value === "prix") q.set("tri", "prix");
    var s = q.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : ""));
    effacer.hidden = !s;
  }
  Array.prototype.forEach.call(form.querySelectorAll("[data-type]"), function (b) {
    b.addEventListener("click", function () { type = b.dataset.type; maj(); });
  });
  form.addEventListener("input", maj); tri.addEventListener("change", maj);
  effacer.addEventListener("click", function () { type = ""; form.reset(); tri.value = "date"; maj(); });
  // la fenêtre « Filtres » (comme sur la page des animateurs)
  var voile = document.getElementById("sjc-ff");
  if (voile) {
    var ouvrir = function (oui) { voile.hidden = !oui; document.documentElement.classList.toggle("ff-ouverte", oui); if (oui) voile.querySelector("[data-sjc-fermer]").focus(); };
    form.querySelector(".tp-filtres").addEventListener("click", function () { ouvrir(true); });
    Array.prototype.forEach.call(voile.querySelectorAll("[data-sjc-fermer]"), function (b) { b.addEventListener("click", function () { ouvrir(false); }); });
    voile.addEventListener("click", function (e) { if (e.target === voile) ouvrir(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !voile.hidden) ouvrir(false); });
    voile.querySelector("[data-sjc-effacer]").addEventListener("click", function () { type = ""; maj(); });
  }

  function filtrer() {
    var ou = sansAccent(form.elements.ou.value), dep = (ou.match(/\(([0-9ab]{2,3})\)\s*$/) || ou.match(/^([0-9]{2,3}|2a|2b)$/) || [])[1];
    var nomDep = dep ? "" : ou;
    return cartes.filter(function (c) {
      if (type && GROUPES[type].indexOf(c.ty) < 0) return false;
      if (dep) return c.dep.toLowerCase() === dep;
      if (nomDep) return [c.v, c.r].concat(c.tr).some(function (v) { return sansAccent(v).indexOf(nomDep) >= 0; }) || sansAccent(D.deps[c.dep] || "").indexOf(nomDep) === 0;
      return true;
    }).map(function (c) { return { c: c, dates: c.d }; });
  }

  function carte(r, exemple) {
    var c = r.c, a = el("a", "sjc-carte" + (exemple ? " sjc-carte-ex" : "")); a.href = c.u;
    var ph = el("span", "sjc-photo sjc-b-" + (c.e[0] || "decouverte"));
    if (c.ph) ph.style.backgroundImage = "url(" + JSON.stringify(racine.dataset.photos + c.ph) + ")";
    else ph.appendChild(el("span", "sjc-photo-t", (D.types[c.ty] || [""])[0]));
    var et = el("span", "sjc-etiquettes");
    if (exemple) et.appendChild(el("span", "sjc-et-ex", "Exemple"));
    if (c.une) et.appendChild(el("span", "sjc-et-une", "Partenaire"));
    var prochaine = r.dates.filter(libre)[0];
    if (r.dates.length && !r.dates.some(libre)) et.appendChild(el("span", "sjc-et-complet", "Complet"));
    else if (prochaine && prochaine[2] != null && prochaine[2] <= 5) et.appendChild(el("span", "sjc-et-peu", "Plus que " + prochaine[2] + " place" + (prochaine[2] > 1 ? "s" : "")));
    if (c.pc) et.appendChild(el("span", "sjc-et-aide", "Pass Colo"));
    else if (c.ai.indexOf("vacaf") >= 0) et.appendChild(el("span", "sjc-et-aide", "VACAF"));
    ph.appendChild(et); a.appendChild(ph);
    var co = el("span", "sjc-corps"), journee = c.ty.indexOf("accueil") === 0;
    var nuits = !journee && c.d[0] ? Math.round((new Date(c.d[0][1]) - new Date(c.d[0][0])) / 864e5) + 1 : 0;
    co.appendChild(el("span", "sjc-sur", c.a[0] + "-" + c.a[1] + " ans · " + (D.types[c.ty] || [""])[0] + (nuits ? " · " + nuits + " jours" : "")));
    co.appendChild(el("b", "sjc-titre", c.t));
    var lieu = c.p === "FR" ? c.v + (c.dep ? " (" + c.dep + ")" : "") : (c.r ? c.r + ", " : "") + c.p;
    co.appendChild(el("span", "sjc-ligne sjc-lieu", lieu + (c.tr.length ? " · départ de " + c.tr.slice(0, 2).join(", ") + (c.tr.length > 2 ? "…" : "") : "")));
    if (r.dates.length) co.appendChild(el("span", "sjc-ligne sjc-quand", r.dates.slice(0, 2).map(periode).join(" · ") + (r.dates.length > 2 ? " · +" + (r.dates.length - 2) : "")));
    var pied = el("span", "sjc-pied"), px = el("span", "sjc-prix");
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
    Array.prototype.forEach.call(form.querySelectorAll("[data-type]"), function (b) { var on = b.dataset.type === type; b.classList.toggle("sjc-on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    ecrireAdresse();
    var pn = form.querySelector("[data-sjc-nb]"); if (pn) { pn.hidden = !type; pn.textContent = "1"; }
    var r = filtrer();
    r.sort(function (x, y) {
      if (tri.value === "prix") return (x.c.px == null) - (y.c.px == null) || (x.c.px || 0) - (y.c.px || 0);
      return (y.c.une ? 1 : 0) - (x.c.une ? 1 : 0) || (x.dates[0] ? x.dates[0][0] : "9").localeCompare(y.dates[0] ? y.dates[0][0] : "9");
    });
    res.textContent = "";
    if (!cartes.length) {
      nb.textContent = "Les premières offres arrivent : les structures commencent à publier les leurs.";
      var v = el("div", "sjc-vide"); v.appendChild(el("p", null, "Décrivez ce que vous cherchez (ci-dessus) ou laissez votre e-mail ci-dessous : vous serez prévenu. En attendant, voici à quoi ressemble une fiche."));
      res.appendChild(v);
      if (D.exemple) { var g0 = el("div", "sjc-grille"); g0.appendChild(carte({ c: D.exemple, dates: D.exemple.d }, true)); res.appendChild(g0); }
    } else if (!r.length) {
      nb.textContent = "Aucune offre pour ces critères.";
      var v2 = el("div", "sjc-vide"); v2.appendChild(el("p", null, "Essayez un autre lieu, ou décrivez ce que vous cherchez : les structures proches de chez vous reçoivent votre demande."));
      res.appendChild(v2);
    } else {
      nb.textContent = r.length + (r.length > 1 ? " offres" : " offre") + (effacer.hidden ? "" : " pour vos critères");
      var g = el("div", "sjc-grille"); r.forEach(function (x) { g.appendChild(carte(x)); }); res.appendChild(g);
      if (r.some(function (x) { return x.c.une; })) res.appendChild(el("p", "fp-note", "« Partenaire » : structure abonnée à Fil Roug'Anim, mise en avant dans les résultats."));
    }
    alerte.hidden = !!(cartes.length && r.length >= 3);
  }

  // l'alerte (double confirmation par e-mail)
  var fa = document.getElementById("sjc-alerte-f"), ra = document.getElementById("sjc-alerte-retour");
  fa.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!fa.checkValidity()) { fa.reportValidity(); return; }
    var ou = form.elements.ou.value.match(/\(([0-9AB]{2,3})\)\s*$/);
    var crit = { type: type === "sejours" ? "sejour" : type ? "journee" : null, departement: ou ? ou[1] : null };
    var b = fa.querySelector("button"); b.disabled = true; ra.hidden = false; ra.className = "sjc-alerte-retour"; ra.textContent = "Envoi…";
    fetch(racine.dataset.url + "/rest/v1/rpc/creer_alerte", { method: "POST", headers: { "Content-Type": "application/json", apikey: racine.dataset.cle },
      body: JSON.stringify({ email: fa.elements.email.value.trim(), criteres: crit }) })
      .then(function (r) { if (r.ok) return; return r.json().then(function (j) { throw new Error(j && j.message || "erreur"); }); })
      .then(function () { fa.reset(); ra.className = "sjc-alerte-retour sjc-ok"; ra.textContent = "C'est noté ! Confirmez votre adresse avec le lien que nous venons de vous envoyer (pensez aux courriers indésirables)."; })
      .catch(function (err) { ra.className = "sjc-alerte-retour sjc-ko"; var t = String(err && err.message || ""); ra.textContent = /[a-zé]/i.test(t) && t !== "erreur" && !/fetch/i.test(t) ? t : "L'envoi n'a pas marché. Réessayez dans un instant."; })
      .then(function () { b.disabled = false; });
  });

  lireAdresse(); maj();
})();

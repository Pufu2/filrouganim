/* Fil Roug'Anim : la fiche d'un séjour. Le choix de la date, la fenêtre « Demander une place » (envoyée par la
   fonction demander_place de la base, sans compte), le calculateur de reste à charge (tout se calcule ici, rien
   n'est envoyé), la galerie en plein écran et le compteur de vues (un par visite). */
(function () {
  "use strict";
  // arrivé depuis un e-mail d'alerte : on note que l'alerte sert encore (sinon elle est effacée au bout d'un an)
  (function () { var m = location.search.match(/[?&]alerte=([0-9a-f]{20,64})/); var r = document.querySelector("[data-cle][data-url]");
    if (!m || !r) return;
    try { fetch(r.dataset.url + "/rest/v1/rpc/alerte_vue", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", apikey: r.dataset.cle }, body: JSON.stringify({ j: m[1] }) }).catch(function () {}); } catch (e) {}
    history.replaceState(null, "", location.pathname + location.search.replace(/[?&]alerte=[0-9a-f]+/, "").replace(/^&/, "?") + location.hash); })();
  var racine = document.getElementById("sjf");
  if (!racine) return;
  var id = racine.dataset.sejour, exemple = !!racine.dataset.exemple;
  var voile = document.getElementById("sjf-voile"), form = document.getElementById("sjf-form"), retour = document.getElementById("sjf-retour");
  var dateChoisie = null, dernierFocus = null;

  function rpc(nom, corps) {
    return fetch(racine.dataset.url + "/rest/v1/rpc/" + nom, { method: "POST", keepalive: nom !== "demander_place",
      headers: { "Content-Type": "application/json", apikey: racine.dataset.cle }, body: JSON.stringify(corps) });
  }

  // une vue par visite
  if (id && !navigator.webdriver) {
    var cle = "fra-vu-sj:" + id, deja = false;
    try { deja = sessionStorage.getItem(cle) === "1"; sessionStorage.setItem(cle, "1"); } catch (e) {}
    if (!deja) rpc("compter_sejour", { i: parseInt(id, 10), t: "vue" }).catch(function () {});
  }

  // « Postuler pour encadrer » : seulement pour les comptes animateur (le rôle est retenu par Mon espace)
  try { if (localStorage.getItem("fra-role") === "candidat") Array.prototype.forEach.call(racine.querySelectorAll("[data-anim]"), function (x) { x.hidden = false; }); } catch (e) {}

  // le choix de la date dans le cadre « Réserver »
  Array.prototype.forEach.call(racine.querySelectorAll(".sjf-date"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(racine.querySelectorAll(".sjf-date"), function (x) { x.classList.toggle("sjf-date-choisie", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      dateChoisie = b.dataset.date;
    });
  });

  // la fenêtre de demande
  function ouvrir(question) {
    dernierFocus = document.activeElement;
    voile.hidden = false; document.body.classList.add("sjf-ouvert");
    form.hidden = false; document.getElementById("sjf-merci").hidden = true; retour.hidden = true;
    document.getElementById("sjf-f-t").textContent = question ? "Poser une question" : "Demander une place";
    var sel = form.elements.date_id;
    if (sel && sel.tagName === "SELECT") { sel.required = !question; if (dateChoisie != null && !question) sel.value = dateChoisie; }
    form.elements.message.required = !!question;
    setTimeout(function () { (form.querySelector("select:not([disabled]), input:not([type=hidden])") || form).focus(); }, 30);
  }
  function fermer() {
    voile.hidden = true; document.body.classList.remove("sjf-ouvert");
    if (dernierFocus && dernierFocus.focus) dernierFocus.focus();
  }
  Array.prototype.forEach.call(racine.querySelectorAll("[data-ouvrir-demande]"), function (b) {
    b.addEventListener("click", function () { ouvrir(b.dataset.ouvrirDemande === "question"); });
  });
  Array.prototype.forEach.call(voile.querySelectorAll("[data-fermer]"), function (b) { b.addEventListener("click", fermer); });
  voile.addEventListener("click", function (e) { if (e.target === voile) fermer(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !voile.hidden) fermer(); });
  if (/#demander$/.test(location.hash)) ouvrir(false);

  function dire(t, ko) { retour.hidden = false; retour.textContent = t; retour.className = "sjf-f-retour " + (ko ? "sjf-ko" : "sjf-ok"); }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (form.elements.site_web.value) { fermer(); return; } // un robot : on ne dit rien
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (exemple) { dire("C'est une fiche d'exemple : rien n'est envoyé. Sur un vrai séjour, la demande part chez l'organisateur."); return; }
    var f = form.elements, d = {
      sejour_id: parseInt(id, 10), date_id: f.date_id && f.date_id.value ? parseInt(f.date_id.value, 10) : null,
      enfant_age: parseInt(f.enfant_age.value, 10), nb_enfants: parseInt(f.nb_enfants.value, 10) || 1, enfant_prenom: f.enfant_prenom.value.trim(),
      ville: f.ville.value.trim(), parent_nom: f.parent_nom.value.trim(), email: f.email.value.trim(), telephone: f.telephone.value.trim(),
      message: f.message.value.trim(), consentement: f.consentement.checked,
      aides: Array.prototype.map.call(form.querySelectorAll("input[name=aides]:checked"), function (x) { return x.value; })
    };
    var b = form.querySelector("button[type=submit]"); b.disabled = true; dire("Envoi…");
    rpc("demander_place", { d: d }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && (j.message || j.hint)) || "erreur");
        form.reset(); form.hidden = true; document.getElementById("sjf-merci").hidden = false;
      });
    }).catch(function (err) {
      var t = String(err && err.message || "");
      dire(/[a-zé]/i.test(t) && t !== "erreur" && !/fetch|network/i.test(t) ? t : "L'envoi n'a pas marché. Vérifiez votre connexion et réessayez.", true);
    }).then(function () { b.disabled = false; });
  });

  // partager le séjour (le menu de partage du téléphone, sinon le lien copié)
  Array.prototype.forEach.call(racine.querySelectorAll("[data-partager]"), function (b) {
    b.addEventListener("click", function () {
      var url = location.href.split("#")[0], fait = function (t) { var x = b.textContent; b.textContent = t; setTimeout(function () { b.textContent = x; }, 2500); };
      if (id && !navigator.webdriver) rpc("compter_sejour", { i: parseInt(id, 10), t: "partage" }).catch(function () {});
      if (navigator.share) navigator.share({ title: b.dataset.titre, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { fait("Lien copié !"); }, function () { fait(url); });
      else fait(url);
    });
  });

  // le calculateur de reste à charge
  var calc = document.getElementById("sjf-calcul");
  if (calc) {
    var prix = parseFloat(calc.dataset.prix), regles = {}, res = document.getElementById("sjf-calcul-res");
    try { regles = JSON.parse(calc.dataset.regles || "{}"); } catch (e) {}
    var pc = regles.pass_colo || {};
    function euros(n) { return Math.round(n).toLocaleString("fr-FR") + " €"; }
    function calculer() {
      var nai = parseInt(calc.querySelector("[name=naissance]").value, 10), qf = parseInt(calc.querySelector("[name=qf]").value, 10),
          autres = parseFloat(calc.querySelector("[name=autres]").value) || 0, annee = parseInt(calc.dataset.annee, 10) || new Date().getFullYear();
      var pass = 0, note = "";
      var ageAnnee = nai ? annee - nai : null;
      if (calc.dataset.pass === "1" && nai && (ageAnnee === pc.age || ageAnnee === pc.age + 1)) {
        if (ageAnnee === pc.age + 1) note = "Votre enfant a " + ageAnnee + " ans en " + annee + " : le Pass Colo est possible s'il ne l'a pas utilisé l'an dernier. ";
        if (!isNaN(qf)) { var bar = (pc.baremes || []).filter(function (x) { return qf <= x.qf_max; })[0]; pass = bar ? bar.montant : 0;
          note += bar ? "Votre enfant peut avoir droit au Pass Colo : " + euros(pass) + ". " : "Avec ce quotient (plus de 1 500 €), le Pass Colo ne s'applique pas. "; }
        else note += (ageAnnee === pc.age ? "Votre enfant a " + pc.age + " ans en " + annee + " : il peut avoir droit au Pass Colo. " : "") + "Indiquez votre quotient. ";
      } else if (nai && calc.dataset.pass === "1") note = "Le Pass Colo concerne les enfants qui ont " + pc.age + " ans dans l'année du séjour (ou 12 ans, en report). ";
      if (!nai && !autres) { res.textContent = "Remplissez les cases : le calcul se fait ici, rien n'est envoyé."; return; }
      var reste = Math.max(0, prix - pass - autres);
      res.textContent = "";
      res.appendChild(document.createTextNode(note + "Reste à payer estimé : "));
      var b = document.createElement("b"); b.textContent = euros(reste); res.appendChild(b);
      res.appendChild(document.createTextNode(" (sur " + euros(prix) + ")."));
    }
    calc.addEventListener("input", calculer);
  }

  // la galerie en plein écran
  var gal = racine.querySelector("[data-galerie]");
  if (gal) {
    var liens = Array.prototype.slice.call(gal.querySelectorAll("a.fp-photo")), i = 0, boite = null;
    function montrer(n) {
      i = (n + liens.length) % liens.length;
      if (!boite) {
        boite = document.createElement("div"); boite.className = "sjf-plein"; boite.setAttribute("role", "dialog"); boite.setAttribute("aria-modal", "true"); boite.setAttribute("aria-label", "Photos");
        boite.innerHTML = '<button type="button" class="sjf-p-x" aria-label="Fermer">×</button><button type="button" class="sjf-p-g" aria-label="Photo précédente">‹</button><img alt=""><button type="button" class="sjf-p-d" aria-label="Photo suivante">›</button>';
        document.body.appendChild(boite);
        boite.querySelector(".sjf-p-x").addEventListener("click", function () { boite.hidden = true; });
        boite.querySelector(".sjf-p-g").addEventListener("click", function () { montrer(i - 1); });
        boite.querySelector(".sjf-p-d").addEventListener("click", function () { montrer(i + 1); });
        boite.addEventListener("click", function (e) { if (e.target === boite) boite.hidden = true; });
        document.addEventListener("keydown", function (e) { if (boite.hidden) return; if (e.key === "Escape") boite.hidden = true; if (e.key === "ArrowLeft") montrer(i - 1); if (e.key === "ArrowRight") montrer(i + 1); });
      }
      boite.hidden = false;
      var img = boite.querySelector("img"); img.src = liens[i].href; img.alt = liens[i].querySelector("img").alt;
    }
    liens.forEach(function (a, n) { a.addEventListener("click", function (e) { e.preventDefault(); montrer(n); }); });
  }
})();

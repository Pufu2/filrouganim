/* Fil Roug'Anim : l'annuaire inversé (page « Décrivez le poste que vous cherchez »).
   Une étape à la fois, l'aperçu de ce que les structures liront, la liste des structures qui recevront la demande,
   puis l'envoi (connecté) par la fonction envoyer_demande de la base. Sans compte, le brouillon est gardé dans le
   navigateur le temps de se connecter (Google ou lien par e-mail), puis la demande part toute seule au retour.
   Ce qui vient des personnes est écrit avec textContent, jamais comme du HTML. */
(function () {
  "use strict";
  var racine = document.getElementById("demande");
  if (!racine || !window.supabase) return;
  var L = JSON.parse(document.getElementById("dm-libelles").textContent);
  var sb = window.supabase.createClient(racine.dataset.url, racine.dataset.cle, { auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true } });
  var BROUILLON = "fra-demande";
  var form = document.getElementById("f-demande"), etapes = Array.prototype.slice.call(form.querySelectorAll(".etape"));
  var n = 0, utilisateur = null;
  function $(id) { return document.getElementById(id); }
  function el(tag, classe, texte) { var e = document.createElement(tag); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e; }
  function libelle(liste, v) { var t = L[liste].filter(function (x) { return x[0] === v; })[0]; return t ? t[1] : v; }
  function nomDep(c) { var i = L.deps.indexOf(c); return i < 0 ? c : L.noms_deps[i]; }
  function message(t, erreur) { var m = $("dm-message"); m.textContent = t || ""; m.hidden = !t; m.classList.toggle("erreur", !!erreur); }
  function dateFr(iso) { return iso ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : ""; }
  function garder(v) { try { if (v === null) localStorage.removeItem(BROUILLON); else localStorage.setItem(BROUILLON, JSON.stringify(v)); } catch (e) {} }
  function relire() { try { return JSON.parse(localStorage.getItem(BROUILLON) || "null"); } catch (e) { return null; } }

  /* -- lire et remplir le formulaire -- */
  function lire() {
    var d = {};
    ["poste", "etendue"].forEach(function (k) { var c = form.querySelector('[name="' + k + '"]:checked'); d[k] = c ? c.value : null; });
    ["departement", "ville", "dispo_debut", "dispo_fin", "prenom", "annee_naissance", "message", "email_contact"].forEach(function (k) { d[k] = (form.elements[k].value || "").trim(); });
    ["periodes", "diplomes", "experiences"].forEach(function (k) {
      d[k] = Array.prototype.filter.call(form.querySelectorAll('[name="' + k + '"]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
    });
    d.seize_ans = form.elements.seize_ans.checked;
    return d;
  }
  function remplir(d) {
    Array.prototype.forEach.call(form.elements, function (c) {
      if (!c.name || !(c.name in d)) return;
      var v = d[c.name];
      if (c.type === "radio") c.checked = c.value === v;
      else if (c.type === "checkbox") c.checked = Array.isArray(v) ? v.indexOf(c.value) >= 0 : !!v;
      else c.value = v == null ? "" : v;
    });
  }
  // la zone : le département, ou toute la région (« partout » garde la région pour choisir les structures, et le dit aux structures)
  function zone(d) {
    if (!d.departement) return [];
    if (d.etendue === "departement") return [d.departement];
    var opt = form.elements.departement.selectedOptions[0], reg = opt && opt.dataset.region;
    var deps = L.deps_region[L.regions.indexOf(reg)] || [];
    return [d.departement].concat(deps.filter(function (x) { return x !== d.departement; })).slice(0, 20);
  }

  /* -- l'aperçu -- */
  function apercu() {
    var d = lire();
    function ap(k) { return document.querySelector('[data-dm="' + k + '"]'); }
    ap("titre").textContent = d.poste ? libelle("postes_paires", d.poste) + (d.prenom ? ", " + d.prenom : "") : "Votre demande se construit ici";
    ap("poste").textContent = d.poste ? libelle("postes_paires", d.poste) : "à préciser";
    ap("age").textContent = d.annee_naissance ? (new Date().getFullYear() - d.annee_naissance) + " ans" : "à préciser";
    ap("ou").textContent = d.departement ? (d.ville ? d.ville + ", " : "") + nomDep(d.departement) + " (" + d.departement + ")" +
      (d.etendue === "region" ? " · toute la région" : d.etendue === "partout" ? " · partout en France" : "") : "à préciser";
    var q = d.periodes.map(function (x) { return libelle("periodes", x).toLowerCase(); });
    if (d.dispo_debut) q.push((d.dispo_fin ? "du " : "dès le ") + dateFr(d.dispo_debut) + (d.dispo_fin ? " au " + dateFr(d.dispo_fin) : ""));
    ap("quand").textContent = q.join(" · ") || "à préciser";
    ap("diplomes").textContent = d.diplomes.map(function (x) { return libelle("diplomes", x); }).join(" · ") || "à préciser";
    ap("experiences").textContent = d.experiences.map(function (x) { return libelle("experiences", x); }).join(" · ") || "à préciser";
    var msg = ap("message"); msg.textContent = d.message ? "« " + d.message + " »" : ""; msg.hidden = !d.message;
  }
  L.postes_paires = L.postes.map(function (v, i) { return [v, L.postes_noms[i]]; });

  /* -- qui recevra la demande -- */
  async function destinataires() {
    var d = lire(), boite = $("dm-destinataires");
    boite.textContent = "";
    boite.appendChild(el("p", "petit", "Recherche des structures de votre secteur…"));
    var r = await sb.rpc("destinataires_possibles", { z: zone(d), dep: d.departement });
    boite.textContent = "";
    var liste = (r.data || []);
    if (r.error || !liste.length) {
      var v = el("div", "dm-attente");
      v.appendChild(el("b", null, "Pas encore de structure abonnée dans votre secteur."));
      v.appendChild(el("span", null, "Votre demande attend, jusqu'à 30 jours : elle part dès qu'une structure de votre zone s'inscrit, et vous êtes prévenu par e-mail quand elle vous répond. En attendant, regardez les offres et les sessions près de chez vous."));
      boite.appendChild(v);
      return;
    }
    var ul = el("ul", "dm-liste");
    liste.forEach(function (s) {
      var li = el("li"), ic = el("span", "dm-liste-ic", (s.nom || "?").replace(/^L['’]/, "").charAt(0).toUpperCase());
      var t = el("span"); t.appendChild(el("b", null, s.nom)); t.appendChild(el("small", null, s.ville + " (" + s.departement + ")"));
      li.appendChild(ic); li.appendChild(t);
      if (s.slug) { var a = el("a", null, "Voir la page"); a.href = L.lien_structures + s.slug + "/"; a.target = "_blank"; a.rel = "noopener"; li.appendChild(a); }
      ul.appendChild(li);
    });
    boite.appendChild(ul);
    boite.appendChild(el("p", "petit", liste.length > 1 ? "Ces " + liste.length + " structures recevront votre demande, et elles seules." : "Cette structure recevra votre demande, et elle seule."));
  }

  /* -- les étapes -- */
  function aller(i) {
    n = Math.max(0, Math.min(etapes.length - 1, i));
    etapes.forEach(function (f, k) { f.hidden = k !== n; });
    document.querySelector("#dm-assistant .as-n").textContent = "Étape " + (n + 1) + " sur " + etapes.length;
    document.querySelector("#dm-assistant .as-titre").textContent = etapes[n].dataset.titre;
    document.querySelector("#dm-assistant .as-barre span").style.width = ((n + 1) / etapes.length * 100) + "%";
    form.querySelector(".as-retour").hidden = n === 0;
    var fin = n === etapes.length - 1;
    form.querySelector(".as-suivant").hidden = fin;
    form.querySelector(".as-fin").hidden = !fin;
    $("dm-connexion").hidden = !fin || !!utilisateur;
    $("dm-envoyer").hidden = !fin || !utilisateur;
    if (etapes[n].dataset.titre === "Qui la reçoit") destinataires();
    garder(lire());
  }
  function valide(i) {
    var champs = etapes[i].querySelectorAll("input, select, textarea");
    for (var k = 0; k < champs.length; k++) { if (!champs[k].checkValidity()) { champs[k].reportValidity(); return false; } }
    return true;
  }
  form.querySelector(".as-suivant").addEventListener("click", function () { if (valide(n)) { aller(n + 1); racine.scrollIntoView({ block: "start", behavior: "smooth" }); } });
  form.querySelector(".as-retour").addEventListener("click", function () { aller(n - 1); });
  form.addEventListener("input", apercu);
  form.addEventListener("change", function () { apercu(); garder(lire()); });
  // un choix de poste fait passer tout de suite à la suite, comme sur jasonmarinho.com
  Array.prototype.forEach.call(form.querySelectorAll('[name="poste"]'), function (r) {
    r.addEventListener("change", function () { if (n === 0) setTimeout(function () { aller(1); }, 150); });
  });

  /* -- l'envoi -- */
  async function envoyer() {
    var d = lire();
    for (var i = 0; i < etapes.length; i++) { if (!valide(i)) { aller(i); return; } }
    var z = zone(d);
    var corps = { poste: d.poste, departement: d.departement, ville: d.ville, zone: z, partout: d.etendue === "partout", periodes: d.periodes,
                  dispo_debut: d.dispo_debut, dispo_fin: d.dispo_fin, diplomes: d.diplomes, experiences: d.experiences,
                  message: d.message, prenom: d.prenom, annee_naissance: d.annee_naissance, email_contact: d.email_contact, seize_ans: d.seize_ans };
    var b = $("dm-envoyer"); b.disabled = true;
    var r = await sb.rpc("envoyer_demande", { d: corps });
    b.disabled = false;
    if (r.error) { message((r.error.message || "").replace(/^.*?: /, "") || "L'envoi n'a pas marché : réessayez dans un instant.", true); return; }
    garder(null);
    $("dm-assistant").hidden = true;
    $("dm-fini").hidden = false;
    $("dm-fini-titre").textContent = r.data > 0 ? "C'est parti : votre demande est chez " + r.data + (r.data > 1 ? " structures." : " structure.") : "C'est noté : votre demande attend une structure de votre secteur.";
    $("dm-fini-texte").textContent = r.data > 0 ? "Elles vous répondent directement à " + d.email_contact + ". Pensez à regarder vos indésirables." :
      "Elle part dès qu'une structure de votre zone s'inscrit (30 jours au plus). Elle vous répondra directement à " + d.email_contact + ".";
    message("");
    racine.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  form.addEventListener("submit", function (e) { e.preventDefault(); if (utilisateur) envoyer(); });

  // sans compte : on garde le brouillon, on se connecte, et la demande part au retour (?envoyer=1)
  var retour = location.origin + location.pathname + "?envoyer=1";
  document.querySelector("[data-google]").addEventListener("click", async function () {
    if (!valide(n)) return;
    garder(lire());
    try { localStorage.setItem("fra-inscription", JSON.stringify({ role: "candidat" })); } catch (e) {}
    var r = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: retour } });
    if (r.error) message("La connexion avec Google n'a pas marché : " + r.error.message, true);
  });
  $("dm-lien").addEventListener("click", async function () {
    var email = form.elements.email_contact.value.trim();
    if (!form.elements.email_contact.checkValidity() || !email) { form.elements.email_contact.reportValidity(); return; }
    if (!valide(n)) return;
    garder(lire());
    var r = await sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: retour } });
    message(r.error ? "Ça n'a pas marché : " + r.error.message : "C'est envoyé : ouvrez l'e-mail reçu à " + email + " et cliquez sur le lien, votre demande partira toute seule.", !!r.error);
  });

  /* -- démarrage : la session, le brouillon, ce qui vient de l'accueil (?poste=…&dep=…) -- */
  (async function () {
    var p = new URLSearchParams(location.search);
    var br = relire();
    if (br) remplir(br);
    if (p.get("poste")) remplir({ poste: p.get("poste") });
    if (p.get("dep")) remplir({ departement: p.get("dep") });
    if (p.get("ville")) remplir({ ville: p.get("ville") });
    // depuis l'accueil : la famille de structure coche les périodes qui vont avec
    var PERIODES_DE = { periscolaire: ["periscolaire"], extrascolaire: ["mercredis", "petites-vacances"], sejours: ["ete", "petites-vacances"] };
    if (PERIODES_DE[p.get("type")]) remplir({ periodes: PERIODES_DE[p.get("type")] });
    var s = await sb.auth.getSession();
    utilisateur = s.data && s.data.session ? s.data.session.user : null;
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    if (utilisateur && !form.elements.email_contact.value) form.elements.email_contact.value = utilisateur.email || "";
    if (utilisateur && !form.elements.prenom.value) form.elements.prenom.value = (utilisateur.user_metadata && utilisateur.user_metadata.given_name) || "";
    apercu();
    if (p.get("envoyer") && utilisateur && br) { aller(etapes.length - 1); envoyer(); return; }
    var debut = p.get("poste") ? (p.get("dep") ? 2 : 1) : 0;
    aller(debut);
  })();
})();

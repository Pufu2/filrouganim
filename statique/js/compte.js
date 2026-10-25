/* Fil Roug'Anim : la page « Mon compte ».
   Connexion par lien reçu par e-mail (Supabase), puis profil candidat ou fiche de structure et offres.
   Ce qui vient des personnes est toujours écrit avec textContent, jamais comme du HTML. */
(function () {
  "use strict";
  var racine = document.getElementById("espace-compte");
  if (!racine || !window.supabase) return;

  var L = JSON.parse(document.getElementById("libelles").textContent);
  var sb = window.supabase.createClient(racine.dataset.url, racine.dataset.cle, {
    auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true }
  });
  var params = new URLSearchParams(location.search);
  var utilisateur = null, profil = null, structure = null, offreEnCours = null;

  function $(id) { return document.getElementById(id); }
  function libelle(liste, v) { var t = L[liste].filter(function (x) { return x[0] === v; })[0]; return t ? t[1] : v; }
  function nomDep(code) { var i = L.deps.indexOf(code); return i < 0 ? (code === "france" ? "partout en France" : code) : L.noms_deps[i]; }
  function el(tag, classe, texte) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }
  function dateFr(iso) {
    if (!iso) return "";
    return new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }
  function aujourdhui() { return new Date().toISOString().slice(0, 10); }

  var VUES = ["v-chargement", "v-connexion", "v-choix", "v-candidat", "v-structure", "v-session"];
  function montrer() {
    var ids = Array.prototype.slice.call(arguments);
    VUES.forEach(function (v) { $(v).hidden = ids.indexOf(v) < 0; });
  }
  function message(texte, erreur) {
    var m = $("message");
    m.textContent = texte || "";
    m.hidden = !texte;
    m.classList.toggle("erreur", !!erreur);
    if (texte) m.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function erreurLisible(e) {
    var t = (e && (e.message || e.error_description)) || String(e);
    if (e && (e.status === 429 || /rate limit/i.test(t))) return "Trop de demandes d'un coup : réessayez dans quelques minutes.";
    if (/check constraint/i.test(t)) return "Un champ n'est pas au bon format (adresse e-mail, lien commençant par https://, dates, longueur du texte…).";
    if (/déjà/.test(t)) return t;
    if (/fetch|network/i.test(t)) return "Connexion au service impossible. Vérifiez votre connexion internet et réessayez.";
    return "Ça n'a pas marché : " + t;
  }

  /* -- formulaires : remplir et lire, sans HTML -- */
  function remplir(form, donnees) {
    Array.prototype.forEach.call(form.elements, function (c) {
      if (!c.name || !(c.name in donnees)) return;
      var v = donnees[c.name];
      if (c.type === "checkbox") c.checked = Array.isArray(v) ? v.indexOf(c.value) >= 0 : !!v;
      else c.value = v == null ? "" : v;
    });
  }
  function lire(form, champs) {
    var o = {};
    champs.forEach(function (nom) {
      var liste = form.querySelectorAll('[name="' + nom + '"]');
      if (!liste.length) return;
      if (liste[0].type === "checkbox" && liste.length > 1) {
        o[nom] = Array.prototype.filter.call(liste, function (c) { return c.checked; }).map(function (c) { return c.value; });
      } else if (liste[0].type === "checkbox") {
        o[nom] = liste[0].checked;
      } else {
        var v = liste[0].value.trim();
        o[nom] = v === "" ? null : v;
      }
    });
    return o;
  }
  function occupe(form, oui) {
    var b = form.querySelector('[type="submit"]');
    if (b) { b.disabled = oui; b.setAttribute("aria-busy", oui ? "true" : "false"); }
  }

  /* -- démarrage -- */
  async function demarrer() {
    var h = new URLSearchParams(location.hash.slice(1));
    if (h.get("error_description")) {
      message("Ce lien de connexion n'est plus valable (il sert une seule fois, pendant une heure). Demandez-en un nouveau.", true);
      history.replaceState(null, "", location.pathname + location.search);
    }
    var r = await sb.auth.getSession();
    var session = r.data && r.data.session;
    if (!session) { montrer("v-connexion"); return; }
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    utilisateur = session.user;
    $("email-session").textContent = utilisateur.email;
    var rep = await Promise.all([
      sb.from("profils").select("*").eq("id", utilisateur.id).maybeSingle(),
      sb.from("structures").select("*").eq("id", utilisateur.id).maybeSingle()
    ]);
    if (rep[0].error || rep[1].error) { montrer("v-session"); message(erreurLisible(rep[0].error || rep[1].error), true); return; }
    profil = rep[0].data; structure = rep[1].data;
    if (profil) return voirCandidat();
    if (structure) return voirStructure();
    if (params.get("role") === "candidat") return voirCandidat();
    if (params.get("role") === "structure") return voirStructure();
    montrer("v-choix", "v-session");
  }

  $("f-connexion").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = this, email = form.email.value.trim();
    occupe(form, true);
    var retour = location.origin + location.pathname + (params.get("role") ? "?role=" + encodeURIComponent(params.get("role")) : "");
    var r = await sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: retour } });
    occupe(form, false);
    if (r.error) message(erreurLisible(r.error), true);
    else message("C'est envoyé. Ouvrez l'e-mail reçu à " + email + " et cliquez sur le lien (regardez aussi dans les indésirables).");
  });

  Array.prototype.forEach.call(document.querySelectorAll(".role"), function (b) {
    b.addEventListener("click", function () {
      message("");
      if (b.dataset.role === "candidat") voirCandidat(); else voirStructure();
    });
  });

  /* -- candidat -- */
  var CHAMPS_PROFIL = ["prenom", "email_contact", "departement", "disponibilites", "diplomes", "recherche", "mobilite", "presentation", "publie", "seize_ans"];
  function voirCandidat() {
    montrer("v-candidat", "v-session");
    $("chapo-compte").textContent = profil ? "Votre profil, que seules les structures vérifiées peuvent voir." : "Créez votre profil en deux minutes. C'est gratuit, et ça le restera.";
    remplir($("f-profil"), profil || { email_contact: utilisateur.email, publie: true });
  }
  $("f-profil").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = this, d = lire(form, CHAMPS_PROFIL);
    occupe(form, true);
    var r = profil
      ? await sb.from("profils").update(d).eq("id", utilisateur.id).select().single()
      : await sb.from("profils").insert(d).select().single();
    occupe(form, false);
    if (r.error) { message(erreurLisible(r.error), true); return; }
    var nouveau = !profil;
    profil = r.data;
    message(nouveau ? "Votre profil est créé. Les structures vérifiées de votre secteur peuvent maintenant vous écrire."
                    : (profil.publie ? "Profil enregistré." : "Profil enregistré. Il est caché : les structures ne le voient plus."));
    voirCandidat();
  });

  /* -- structure -- */
  var CHAMPS_STRUCTURE = ["nom", "type", "ville", "departement", "email_contact", "site", "identifiant", "presentation"];
  function voirStructure() {
    montrer("v-structure", "v-session");
    var f = $("f-structure");
    remplir(f, structure || { email_contact: utilisateur.email });
    $("accord-structure").hidden = !!structure;
    f.accord.required = !structure;
    var st = $("statut-structure");
    st.hidden = false;
    st.className = "statut";
    if (!structure) {
      $("chapo-compte").textContent = "Présentez votre structure. Nous la vérifions avant que ses offres soient en ligne.";
      st.textContent = "Étape 1 : la fiche de votre structure. Ensuite, vous pourrez écrire vos offres.";
    } else if (!structure.verifiee) {
      $("chapo-compte").textContent = "Votre espace structure.";
      st.textContent = "Vérification en cours (en général sous 2 jours ouvrés). Vous pouvez déjà préparer vos offres : elles seront en ligne dès que la structure sera vérifiée.";
      st.className = "statut statut-attente";
    } else {
      $("chapo-compte").textContent = "Votre espace structure.";
      st.textContent = "Structure vérifiée : vos offres en ligne sont visibles par tous, et vous voyez les profils des candidats.";
      st.className = "statut statut-ok";
    }
    $("bloc-offres").hidden = !structure;
    $("bloc-candidats").hidden = !(structure && structure.verifiee);
    if (structure) chargerOffres();
    if (structure && structure.verifiee) chargerCandidats();
  }
  $("f-structure").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = this, d = lire(form, CHAMPS_STRUCTURE);
    occupe(form, true);
    var r = structure
      ? await sb.from("structures").update(d).eq("id", utilisateur.id).select().single()
      : await sb.from("structures").insert(d).select().single();
    occupe(form, false);
    if (r.error) { message(erreurLisible(r.error), true); return; }
    var nouveau = !structure;
    structure = r.data;
    message(nouveau ? "Fiche enregistrée. Nous vérifions la structure, puis vos offres pourront être en ligne." : "Fiche enregistrée.");
    voirStructure();
  });

  /* -- offres de la structure -- */
  var CHAMPS_OFFRE = ["intitule", "poste", "contrat", "ville", "departement", "debut", "fin", "public", "diplomes",
                      "remuneration_montant", "remuneration_unite", "candidater", "expire_le", "texte", "loge", "publiee"];
  async function chargerOffres() {
    var r = await sb.from("offres").select("*").eq("structure_id", utilisateur.id).order("debut");
    var liste = $("liste-offres");
    liste.textContent = "";
    if (r.error) { liste.appendChild(el("p", "aucune", erreurLisible(r.error))); return; }
    if (!r.data.length) { liste.appendChild(el("p", "aucune", "Pas encore d'offre. Les structures recrutent souvent dès l'hiver pour l'été.")); return; }
    r.data.forEach(function (o) {
      var item = el("article", "ligne-compte");
      var corps = el("div");
      corps.appendChild(el("h3", null, o.intitule));
      corps.appendChild(el("p", "petit", o.ville + " (" + o.departement + ") · à partir du " + dateFr(o.debut) + " · " + libelle("contrats", o.contrat)));
      var etat, classe;
      if (o.expire_le < aujourdhui()) { etat = "Expirée le " + dateFr(o.expire_le); classe = "etat etat-off"; }
      else if (!o.publiee) { etat = "En pause"; classe = "etat etat-off"; }
      else if (!structure.verifiee) { etat = "En attente de la vérification"; classe = "etat etat-attente"; }
      else { etat = "En ligne jusqu'au " + dateFr(o.expire_le); classe = "etat etat-ok"; }
      corps.appendChild(el("p", classe, etat));
      item.appendChild(corps);
      var actions = el("div", "boutons");
      var modif = el("button", "bouton-texte", "Modifier");
      modif.type = "button";
      modif.addEventListener("click", function () { ouvrirOffre(o); });
      var suppr = el("button", "bouton-texte bouton-danger", "Supprimer");
      suppr.type = "button";
      suppr.addEventListener("click", async function () {
        if (!confirm("Supprimer l'offre « " + o.intitule + " » ?")) return;
        var d = await sb.from("offres").delete().eq("id", o.id);
        if (d.error) message(erreurLisible(d.error), true); else { message("Offre supprimée. Elle disparaît du site dans l'heure."); chargerOffres(); }
      });
      actions.appendChild(modif); actions.appendChild(suppr);
      item.appendChild(actions);
      liste.appendChild(item);
    });
  }
  function ouvrirOffre(o) {
    offreEnCours = o || null;
    var f = $("f-offre");
    f.reset();
    remplir(f, o || { ville: structure.ville, departement: structure.departement, candidater: structure.email_contact, publiee: true, remuneration_unite: "jour" });
    $("titre-f-offre").textContent = o ? "Modifier l'offre" : "Nouvelle offre";
    f.hidden = false;
    f.querySelector("input").focus();
  }
  $("nouvelle-offre").addEventListener("click", function () { ouvrirOffre(null); });
  $("annuler-offre").addEventListener("click", function () { $("f-offre").hidden = true; offreEnCours = null; });
  $("f-offre").debut.addEventListener("change", function () {
    var f = $("f-offre");
    if (!f.expire_le.value) f.expire_le.value = f.debut.value;
  });
  $("f-offre").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = this, d = lire(form, CHAMPS_OFFRE);
    if (!d.remuneration_montant) d.remuneration_unite = null;
    if (d.fin && d.fin < d.debut) { message("La date de fin est avant la date de début.", true); return; }
    occupe(form, true);
    var r = offreEnCours
      ? await sb.from("offres").update(d).eq("id", offreEnCours.id)
      : await sb.from("offres").insert(d);
    occupe(form, false);
    if (r.error) { message(erreurLisible(r.error), true); return; }
    form.hidden = true; offreEnCours = null;
    message(structure.verifiee ? "Offre enregistrée. Elle apparaît sur le site dans l'heure." : "Offre enregistrée. Elle sera en ligne dès que la structure sera vérifiée.");
    chargerOffres();
  });

  /* -- candidats (structures vérifiées seulement : la base refuse les autres) -- */
  async function chargerCandidats() {
    var f = $("f-candidats");
    var q = sb.from("profils").select("prenom,departement,mobilite,diplomes,recherche,disponibilites,presentation,email_contact,maj_le")
      .eq("publie", true).order("maj_le", { ascending: false }).limit(100);
    if (f.dep.value) q = q.or("departement.eq." + f.dep.value + ",mobilite.cs.{" + f.dep.value + "}");
    if (f.diplome.value) q = q.contains("diplomes", [f.diplome.value]);
    if (f.cherche.value) q = q.contains("recherche", [f.cherche.value]);
    var r = await q;
    var liste = $("liste-candidats");
    liste.textContent = "";
    if (r.error) { liste.appendChild(el("p", "aucune", erreurLisible(r.error))); return; }
    $("compte-candidats").textContent = r.data.length ? r.data.length + " profil" + (r.data.length > 1 ? "s" : "") + (r.data.length === 100 ? " (les 100 plus récents)" : "") : "";
    if (!r.data.length) { liste.appendChild(el("p", "aucune", "Aucun profil ne correspond pour l'instant.")); return; }
    r.data.forEach(function (p) {
      var c = el("article", "ligne-compte profil-candidat");
      var corps = el("div");
      corps.appendChild(el("h3", null, p.prenom + " · " + nomDep(p.departement)));
      if (p.diplomes.length) corps.appendChild(el("p", null, p.diplomes.map(function (x) { return libelle("diplomes", x); }).join(", ")));
      if (p.recherche.length) corps.appendChild(el("p", "petit", "Cherche : " + p.recherche.map(function (x) { return libelle("recherche", x); }).join(", ")));
      if (p.mobilite.length) corps.appendChild(el("p", "petit", "Peut aussi travailler : " + p.mobilite.map(nomDep).join(", ")));
      if (p.disponibilites) corps.appendChild(el("p", "petit", "Disponible : " + p.disponibilites));
      if (p.presentation) corps.appendChild(el("p", "presentation", p.presentation));
      corps.appendChild(el("p", "petit", "Profil mis à jour le " + dateFr(p.maj_le)));
      c.appendChild(corps);
      var a = el("a", "bouton-r", "Écrire");
      a.href = "mailto:" + encodeURIComponent(p.email_contact).replace(/%40/g, "@") + "?subject=" + encodeURIComponent("Votre profil Fil Roug'Anim : " + structure.nom);
      c.appendChild(a);
      liste.appendChild(c);
    });
  }
  Array.prototype.forEach.call($("f-candidats").elements, function (c) { c.addEventListener("change", chargerCandidats); });
  $("f-candidats").addEventListener("submit", function (e) { e.preventDefault(); });

  /* -- session -- */
  $("deconnexion").addEventListener("click", async function () {
    await sb.auth.signOut();
    location.href = location.pathname;
  });
  $("supprimer").addEventListener("click", async function () {
    if (!confirm("Supprimer définitivement votre compte" + (structure ? ", votre fiche et toutes vos offres" : " et votre profil") + " ? Ce n'est pas réversible.")) return;
    var r = await sb.rpc("supprimer_mon_compte");
    if (r.error) { message(erreurLisible(r.error) + " Écrivez-nous pour que nous le supprimions.", true); return; }
    await sb.auth.signOut();
    profil = structure = utilisateur = null;
    montrer("v-connexion");
    message("Votre compte et vos données sont supprimés.");
  });

  demarrer().catch(function (e) { montrer("v-connexion"); message(erreurLisible(e), true); });
})();

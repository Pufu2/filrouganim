/* Fil Roug'Anim : la page « Mon espace ».
   Connexion avec Google, avec un e-mail et un mot de passe, ou par lien reçu par e-mail (Supabase).
   Puis le profil (animateur, directeur) ou la fiche de structure, remplis pas à pas avec un aperçu, les offres et les candidatures.
   Ce qui vient des personnes est toujours écrit avec textContent, jamais comme du HTML. */
(function () {
  "use strict";
  var racine = document.getElementById("espace-compte");
  if (!racine || !window.supabase) return;

  var L = JSON.parse(document.getElementById("libelles").textContent);
  var recuperation = /type=recovery/.test(location.hash);
  var sb = window.supabase.createClient(racine.dataset.url, racine.dataset.cle, {
    auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true }
  });
  var params = new URLSearchParams(location.search);
  var utilisateur = null, profil = null, structure = null, offreEnCours = null;
  var MEMOIRE = "fra-inscription";

  function $(id) { return document.getElementById(id); }

  /* -- les onglets de « Mon espace » : un menu à gauche (en haut sur téléphone), une partie à la fois -- */
  var VIDES = {
    "v-structure": { candidats: "Les profils des candidats et les candidatures à vos offres s'ouvrent ici dès que votre page est en ligne (abonnement réglé et structure vérifiée).",
                     demandes: "Les demandes de l'annuaire inversé arrivent ici dès que votre page est en ligne : les animateurs de votre secteur décrivent le poste qu'ils cherchent.",
                     offres: "Enregistrez d'abord votre page (onglet « Ma page ») : vous pourrez ensuite publier vos offres.",
                     abonnement: "Enregistrez d'abord votre page (onglet « Ma page ») : l'abonnement se règle juste après.",
                     tableau: "Enregistrez d'abord votre page (onglet « Ma page ») : votre tableau de bord apparaîtra ici." },
    "v-candidat": { candidatures: "Pas encore de candidature : créez votre profil, puis postulez aux offres en un clic.",
                    demandes: "Décrivez le poste que vous cherchez : votre demande part chez les 3 structures les plus proches.",
                    offres: "Créez votre profil (onglet « Mon profil ») : les offres de votre secteur apparaîtront ici.",
                    tableau: "Créez votre profil (onglet « Mon profil ») : votre tableau de bord apparaîtra ici." }
  };
  var ongletActuel = {};
  function majVide(vue) {
    var v = $(vue), nom = ongletActuel[vue]; if (!v || !nom) return;
    var vide = v.querySelector(".co-vide");
    if (!vide) { vide = document.createElement("div"); vide.className = "carte-compte co-vide"; vide.appendChild(document.createElement("p")); v.appendChild(vide); }
    var visibles = Array.prototype.filter.call(v.querySelectorAll('[data-onglet="' + nom + '"]'), function (b) { return !b.hidden && b.children.length; });
    var texte = (VIDES[vue] || {})[nom];
    var cacher = visibles.length > 0 || !texte;
    if (vide.hidden !== cacher) vide.hidden = cacher;
    if (vide.firstChild.textContent !== (texte || "")) vide.firstChild.textContent = texte || "";
    if (nom === "demandes" && vue === "v-candidat" && !vide.hidden && !vide.querySelector("a")) {
      var a = document.createElement("a"); a.className = "bouton-r"; a.href = L.lien_demande || "/trouver-un-poste/demande/"; a.textContent = "Décrire ce que je cherche"; vide.appendChild(a);
    }
  }

  /* -- l'en-tête de chaque onglet (comme l'espace de jasonmarinho.com) : sur-titre, grand titre, actions, et « À faire » à droite -- */
  var ICO = {
    tableau: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    page: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    offres: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
    candidats: '<circle cx="9" cy="8" r="3"/><path d="M3 20c.8-3.4 3.2-5 6-5s5.2 1.6 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15c2.4 0 4.2 1.3 5 4"/>',
    demandes: '<path d="M4 12l16-8-6 16-2-6z"/>',
    abonnement: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
    outils: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'
  };
  function iconeOnglet(nom) { var sv = document.createElementNS("http://www.w3.org/2000/svg", "svg"); sv.setAttribute("viewBox", "0 0 24 24"); sv.setAttribute("aria-hidden", "true"); sv.innerHTML = ICO[nom] || ICO.page; return sv; }
  function enteteDonnees(vue, nom) {
    var pl = function (n, mot, motPl) { return n + " " + (n > 1 ? (motPl || mot + "s") : mot); };
    if (vue === "v-structure") {
      var st = structure || {}, auj = aujourdhui();
      var enLigne = mesOffres.filter(function (o) { return o.publiee && o.expire_le >= auj; });
      var bientot = enLigne.filter(function (o) { return (new Date(o.expire_le) - new Date(auj)) / 864e5 <= 7; }).length;
      var nouvelles = recues.filter(function (c) { return c.statut === "envoyee"; }).length;
      var afaire = [];
      if (structure && !paye(structure)) afaire.push(["!", "abonnement à régler", "abonnement"]);
      if (nouvelles) afaire.push([nouvelles, pl(nouvelles, "nouvelle candidature", "nouvelles candidatures"), "candidats"]);
      if (demandesRecues.length) afaire.push([demandesRecues.length, pl(demandesRecues.length, "demande reçue", "demandes reçues").replace(/^\d+ /, ""), "demandes"]);
      if (bientot) afaire.push([bientot, (bientot > 1 ? "offres expirent" : "offre expire") + " cette semaine", "offres"]);
      var nomSt = st.nom || "votre structure";
      return {
        tableau: { sur: "Tableau de bord", t: "Bonjour, ", em: nomSt, p: "Votre recrutement en un coup d'œil : les vues de votre page, les candidats et ce qu'il reste à faire.",
                   actions: [["Nouvelle offre", "#nouvelle-offre", 1], ["Voir les candidats", "candidats"]], guide: ["Réussir son recrutement", "#guide-reussir-son-recrutement"],
                   resume: { t: "À faire", lignes: afaire, vide: "Rien d'urgent : tout est à jour.", mini: [[enLigne.length, enLigne.length > 1 ? "offres en ligne" : "offre en ligne"], [recues.length, recues.length > 1 ? "candidatures" : "candidature"], [favoris.length, favoris.length > 1 ? "favoris" : "favori"]] } },
        page: { sur: "Ma page", t: "Votre page, ", em: "à votre image", p: "Présentation, projet, photos, avantages : c'est ce que les animateurs lisent avant de postuler.",
                actions: [["Voir l'aperçu", ".as-voir-fiche", 1]].concat(actif(structure) && st.slug && st.page_publique ? [["Ma page en ligne", L.lien_structures + st.slug + "/", 2]] : []), guide: ["Un exemple de page", "/recruter/exemple-de-page-structure/"],
                resume: { t: "Votre page", jauge: true } },
        offres: { sur: "Mes offres", t: "Vos offres, ", em: "là où les jeunes cherchent", p: "Elles paraissent sur la page des offres, sur votre page, et dans les alertes du lundi des animateurs de votre secteur.",
                  actions: [["Nouvelle offre", "#nouvelle-offre", 1], ["Écrire mon annonce", "#outil-annonce", 2]], guide: ["Une annonce qui donne envie", "#guide-reussir-son-recrutement"],
                  resume: { t: "Vos offres", lignes: bientot ? [[bientot, (bientot > 1 ? "expirent" : "expire") + " dans 7 jours", "offres"]] : [], mini: [[enLigne.length, "en ligne"], [mesOffres.length - enLigne.length, "hors ligne"]] } },
        candidats: { sur: "Candidats", t: "Les animateurs ", em: "de votre secteur", p: "Les candidatures à vos offres, et les profils des animateurs qui cherchent près de chez vous. Mettez les meilleurs en favoris.",
                     actions: [], guide: ["Accueillir un stagiaire BAFA", "#guide-accueillir-un-stagiaire-bafa"],
                     resume: { t: "Candidatures", lignes: nouvelles ? [[nouvelles, nouvelles > 1 ? "nouvelles à lire" : "nouvelle à lire", "candidats"]] : [], vide: "Pas de nouvelle candidature.", mini: [[recues.length, "reçues"], [favoris.length, favoris.length > 1 ? "favoris" : "favori"]] } },
        demandes: { sur: "Demandes reçues", t: "Ils décrivent leur besoin, ", em: "vous répondez", p: "Les animateurs qui cherchent un poste envoient leur demande aux 3 structures les plus proches. Répondez vite : vous n'êtes que trois.",
                    actions: [], guide: ["Comment ça marche", "/trouver-un-poste/demande/"],
                    resume: { t: "Demandes", mini: [[demandesRecues.length, demandesRecues.length > 1 ? "reçues" : "reçue"]] } },
        abonnement: { sur: "Abonnement et centres", t: "Votre abonnement, ", em: "sans commission", p: "Un prix à l'année pour votre page, vos offres et les profils des candidats. Chaque centre en plus est à moitié prix.",
                      actions: [], guide: ["Conditions de vente", "/conditions-de-vente/"],
                      resume: { t: "Abonnement", lignes: structure && !paye(structure) ? [["!", "à régler pour être en ligne", "abonnement"]] : [], vide: structure && st.abonnement_fin ? "Réglé jusqu'au " + dateFr(st.abonnement_fin) + "." : "", mini: [[st.centres_payes || 1, (st.centres_payes || 1) > 1 ? "centres payés" : "centre payé"]] } },
        outils: { sur: "Boîte à outils", t: "Vos outils, ", em: "déjà prêts", p: "Écrire une annonce, calculer l'encadrement ou le budget de l'équipe, et les guides pour recruter un service civique ou un apprenti. Réservés aux structures abonnées.",
                  actions: [], guide: null, resume: null }
      }[nom];
    }
    var pr = profil || {};
    var enCours = mesCandidatures.filter(function (c) { return c.statut === "envoyee" || c.statut === "vue"; }).length;
    var retenues = mesCandidatures.filter(function (c) { return c.statut === "retenue"; }).length;
    return {
      tableau: { sur: "Tableau de bord", t: "Bonjour" + (pr.prenom ? " " : ""), em: pr.prenom || "", p: "Vos candidatures, vos demandes et les offres de votre secteur, au même endroit.",
                 actions: [["Voir les offres", L.lien_offre, 2], ["Décrire ce que je cherche", L.lien_demande, 2]], guide: ["Trouver son stage pratique", "/trouver-un-poste/trouver-son-stage-pratique/"],
                 resume: { t: "En ce moment", lignes: retenues ? [[retenues, retenues > 1 ? "candidatures retenues" : "candidature retenue", "candidatures"]] : [], vide: "Pas de nouvelle réponse.", mini: [[mesCandidatures.length, mesCandidatures.length > 1 ? "candidatures" : "candidature"], [enCours, "en attente"]] } },
      profil: { sur: "Mon profil", t: "Votre profil, ", em: "vu par les structures", p: "Les structures vérifiées de votre secteur le consultent et vous écrivent directement. Plus il est complet, plus on vous contacte.",
                actions: [["Voir ma fiche", "#bloc-profil .as-voir-fiche", 1]], guide: ["Un exemple de profil", "/trouver-un-poste/exemple-de-profil/"], resume: null },
      candidatures: { sur: "Mes candidatures", t: "Vos candidatures, ", em: "suivies de près", p: "Envoyée, vue, retenue : vous voyez où en est chacune.", actions: [["Voir les offres", L.lien_offre, 2]], guide: ["Préparer son entretien", "/trouver-un-poste/preparer-son-entretien/"],
                      resume: { t: "Suivi", mini: [[mesCandidatures.length, "envoyées"], [retenues, retenues > 1 ? "retenues" : "retenue"]] } },
      demandes: { sur: "Mes demandes", t: "Décrivez, ", em: "les structures viennent à vous", p: "Votre demande part chez les 3 structures les plus proches, qui vous répondent par e-mail.", actions: [["Nouvelle demande", L.lien_demande, 2]], guide: null, resume: null },
      offres: { sur: "Offres pour moi", t: "Les offres ", em: "de votre secteur", p: "Les offres en ligne près de chez vous et dans les départements où vous pouvez travailler.", actions: [["Toutes les offres", L.lien_offre, 2]], guide: null, resume: null }
    }[nom];
  }
  function majEntete(vue) {
    var v = $(vue), nom = ongletActuel[vue]; if (!v || !nom) return;
    var d = enteteDonnees(vue, nom), e = v.querySelector(".co-entete");
    if (!e) { e = el("section", "co-entete"); var nav = v.querySelector(".co-nav"); v.insertBefore(e, nav.nextSibling); }
    e.textContent = "";
    if (!d) { e.hidden = true; return; }
    e.hidden = false;
    var g = el("div", "co-e-texte");
    var sur = el("p", "co-e-sur"); sur.appendChild(iconeOnglet(nom === "profil" ? "page" : nom === "candidatures" ? "offres" : nom)); sur.appendChild(document.createTextNode(d.sur)); g.appendChild(sur);
    var h = el("h2"); h.appendChild(document.createTextNode(d.t)); if (d.em) h.appendChild(el("em", null, d.em)); g.appendChild(h);
    g.appendChild(el("p", "co-e-p", d.p));
    var acts = el("div", "co-e-actions");
    (d.actions || []).forEach(function (a, i) {
      var b;
      if (a[2] === 2) { b = el("a", i === 0 ? "bouton-r" : "bouton-blanc", a[0]); b.href = a[1]; if (/^\/|^http/.test(a[1]) && a[1].indexOf("/compte/") < 0) { b.target = "_blank"; b.rel = "noopener"; } }
      else if (a[2] === 1) { b = el("button", i === 0 ? "bouton-r" : "bouton-blanc", a[0]); b.type = "button"; b.addEventListener("click", function () { var c = v.querySelector(a[1]); if (c) { c.click(); var bl = c.closest("[data-onglet]"); if (bl) allerA(bl.id); } }); }
      else { b = el("button", i === 0 ? "bouton-r" : "bouton-blanc", a[0]); b.type = "button"; b.dataset.ongletVers = a[1]; }
      acts.appendChild(b);
    });
    if (d.guide) { var gd = el("a", "co-e-guide", "✦ " + d.guide[0]); gd.href = d.guide[1]; gd.target = "_blank"; gd.rel = "noopener"; acts.appendChild(gd); }
    if (acts.children.length) g.appendChild(acts);
    e.appendChild(g);
    var r = d.resume;
    if (r) {
      var c = el("div", "co-e-resume");
      c.appendChild(el("p", "co-e-r-t", r.t));
      if (r.jauge) {
        var pc = $("bloc-structure").querySelector('[data-ap="pourcent"]');
        var pct = pc ? parseInt(pc.textContent, 10) || 0 : 0;
        var big = el("p", "co-e-r-pc"); big.appendChild(el("b", null, pct + " %")); big.appendChild(el("span", null, " complétée")); c.appendChild(big);
        var j = el("div", "co-e-jauge"); var jj = el("span"); jj.style.width = pct + "%"; j.appendChild(jj); c.appendChild(j);
      }
      (r.lignes || []).forEach(function (l) {
        var b = el("button", "co-e-ligne"); b.type = "button"; b.dataset.ongletVers = l[2];
        b.appendChild(el("b", null, String(l[0]))); b.appendChild(el("span", null, l[1])); b.appendChild(el("i", null, "›"));
        c.appendChild(b);
      });
      if (!(r.lignes || []).length && r.vide) c.appendChild(el("p", "co-e-r-vide", r.vide));
      if (r.mini && r.mini.length) {
        var m = el("p", "co-e-mini");
        r.mini.forEach(function (x) { var s2 = el("span"); s2.appendChild(el("b", null, String(x[0]))); s2.appendChild(document.createTextNode(" " + x[1])); m.appendChild(s2); });
        c.appendChild(m);
      }
      e.appendChild(c);
    } else e.classList.add("co-entete-seul");
    if (r) e.classList.remove("co-entete-seul");
  }

  function montrerOnglet(vue, nom, remonter) {
    var v = $(vue), nav = v && v.querySelector(".co-nav");
    if (!nav) return;
    if (!nav.querySelector('[data-onglet-vers="' + nom + '"]')) nom = nav.querySelector("[data-onglet-vers]").dataset.ongletVers;
    ongletActuel[vue] = nom;
    Array.prototype.forEach.call(nav.querySelectorAll("[data-onglet-vers]"), function (b) {
      if (b.dataset.ongletVers === nom) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    Array.prototype.forEach.call(v.querySelectorAll("[data-onglet]"), function (b) { b.classList.toggle("hors-onglet", b.dataset.onglet !== nom); });
    try { sessionStorage.setItem("fra-onglet-" + vue, nom); } catch (e) {}
    majVide(vue);
    try { majEntete(vue); } catch (err) {}
    if (remonter) window.scrollTo({ top: Math.max(0, v.getBoundingClientRect().top + window.scrollY - 100), behavior: "smooth" });
  }
  function ongletDepart(vue, defaut, force) {
    var mem = null;
    try { mem = sessionStorage.getItem("fra-onglet-" + vue); } catch (e) {}
    montrerOnglet(vue, force ? defaut : (params.get("onglet") || mem || defaut));
  }
  function allerA(id) {
    var e = $(id); if (!e) return;
    var vue = e.closest(".compte-vue"), b = e.closest("[data-onglet]");
    if (vue && b) montrerOnglet(vue.id, b.dataset.onglet);
    setTimeout(function () { e.scrollIntoView({ behavior: "smooth", block: "start" }); }, 30);
  }
  // une partie qui s'affiche ou se cache (chargement, abonnement) : on remet à jour le message « rien ici »
  if (window.MutationObserver) ["v-structure", "v-candidat"].forEach(function (vue) {
    var v = $(vue); if (!v) return;
    new MutationObserver(function (ms) {
      if (ms.some(function (m) { return !m.target.classList || !m.target.classList.contains("co-vide"); })) majVide(vue);
    }).observe(v, { attributes: true, attributeFilter: ["hidden"], subtree: true });
  });
  function pastille(nom, valeur) {
    var p = document.querySelector('#v-structure [data-pastille="' + nom + '"]');
    if (!p) return;
    p.hidden = !valeur; p.textContent = valeur === true ? "!" : String(valeur || "");
    p.classList.toggle("co-pastille-neutre", nom === "offres");
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-onglet-vers]");
    if (b) { montrerOnglet(b.closest(".compte-vue").id, b.dataset.ongletVers, true); return; }
    var a = e.target.closest && e.target.closest('a[href^="#bloc-"]');
    if (a && $(a.getAttribute("href").slice(1))) { e.preventDefault(); allerA(a.getAttribute("href").slice(1)); }
  });
  function libelle(liste, v) { var t = L[liste].filter(function (x) { return x[0] === v; })[0]; return t ? t[1] : v; }
  function nomDep(code) { var i = L.deps.indexOf(code); return i < 0 ? (code === "france" ? "partout en France" : code) : L.noms_deps[i]; }
  function el(tag, classe, texte) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }
  function dateFr(iso, annee) {
    if (!iso) return "";
    var o = { day: "numeric", month: "long" };
    if (annee !== false) o.year = "numeric";
    return new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR", o);
  }
  function jourMois(iso) { return iso ? new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""; }
  function aujourdhui() { return new Date().toISOString().slice(0, 10); }
  function majuscule(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
  function initiales(nom) {
    var mots = (nom || "").replace(/^L['’]/i, "").replace(/['’]/g, " ").split(/\s+/).filter(function (m) { return m && ["des", "de", "du", "la", "le", "les", "et", "d", "l"].indexOf(m.toLowerCase()) < 0; });
    return ((mots[0] || "?").charAt(0) + (mots[1] ? mots[1].charAt(0) : "")).toUpperCase();
  }
  function memoire(v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(MEMOIRE) || "null");
      if (v === null) localStorage.removeItem(MEMOIRE); else localStorage.setItem(MEMOIRE, JSON.stringify(v));
    } catch (e) { return null; }
  }

  var VUES = ["v-chargement", "v-connexion", "v-lien", "v-mdp-oublie", "v-nouveau-mdp", "v-inscription", "v-choix", "v-candidat", "v-structure", "v-session"];
  var VUES_AUTH = ["v-connexion", "v-lien", "v-mdp-oublie", "v-nouveau-mdp", "v-inscription"];
  function montrer() {
    var ids = Array.prototype.slice.call(arguments);
    VUES.forEach(function (v) { $(v).hidden = ids.indexOf(v) < 0; });
    // connexion et inscription : la page passe en deux colonnes, sans le haut de page
    var auth = ids.some(function (v) { return VUES_AUTH.indexOf(v) >= 0; });
    $("auth").hidden = !auth;
    document.body.classList.toggle("page-auth", auth);
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
    if (/invalid login credentials/i.test(t)) return "Adresse e-mail ou mot de passe incorrect. Vous vous étiez inscrit avec Google ? Utilisez le bouton « Continuer avec Google ».";
    if (/email not confirmed/i.test(t)) return "Votre adresse n'est pas encore confirmée : cliquez sur le lien reçu par e-mail (regardez aussi dans les indésirables).";
    if (/password should be|weak password/i.test(t)) return "Mot de passe trop simple : 8 caractères au moins, sans votre adresse e-mail.";
    if (/user already registered|already been registered/i.test(t)) return "Un compte existe déjà avec cette adresse : connectez-vous.";
    if (/provider is not enabled|unsupported provider/i.test(t)) return "La connexion avec Google arrive bientôt. En attendant, utilisez votre adresse e-mail.";
    if (/mime type|invalid_mime/i.test(t)) return "Ce type de fichier n'est pas accepté (PDF pour le CV, JPEG, PNG ou WebP pour les images).";
    if (/payload too large|maximum allowed size|exceeded/i.test(t)) return "Le fichier est trop lourd (2 Mo au plus).";
    if (/check constraint/i.test(t)) return "Un champ n'est pas au bon format (adresse e-mail, lien commençant par https://, dates, longueur du texte…).";
    if (/déjà/.test(t)) return t;
    if (/structures_slug_key|duplicate key/i.test(t)) return "Cette adresse de page est déjà prise : choisissez-en une autre.";
    if (/fetch|network/i.test(t)) return "Connexion au service impossible. Vérifiez votre connexion internet et réessayez.";
    return "Ça n'a pas marché : " + t;
  }

  /* -- formulaires : remplir et lire, sans HTML -- */
  function remplir(form, donnees) {
    Array.prototype.forEach.call(form.elements, function (c) {
      if (!c.name || !(c.name in donnees) || c.type === "file") return;
      var v = donnees[c.name];
      if (c.type === "checkbox") c.checked = Array.isArray(v) ? v.indexOf(c.value) >= 0 : !!v;
      else if (c.type === "radio") c.checked = c.value === v;
      else c.value = v == null ? "" : (Array.isArray(v) ? v.join(", ") : v);
    });
  }
  function lire(form, champs) {
    var o = {};
    champs.forEach(function (nom) {
      var liste = form.querySelectorAll('[name="' + nom + '"]');
      if (!liste.length) return;
      if (liste[0].type === "radio") {
        var c = Array.prototype.filter.call(liste, function (x) { return x.checked; })[0];
        o[nom] = c ? c.value : null;
      } else if (liste[0].type === "checkbox" && liste.length > 1) {
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
    Array.prototype.forEach.call(form.querySelectorAll('[type="submit"]'), function (b) { b.disabled = oui; b.setAttribute("aria-busy", oui ? "true" : "false"); });
  }

  /* -- mots de passe : l'œil pour les afficher -- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-oeil]"), function (b) {
    b.addEventListener("click", function () {
      var i = b.parentNode.querySelector("input"), voir = i.type === "password";
      i.type = voir ? "text" : "password";
      b.setAttribute("aria-pressed", voir ? "true" : "false");
      b.setAttribute("aria-label", voir ? "Cacher le mot de passe" : "Afficher le mot de passe");
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-vers]"), function (b) {
    b.addEventListener("click", function () {
      message("");
      montrer(b.dataset.vers);
      var email = ($("f-connexion").email.value || "").trim();
      var champ = $(b.dataset.vers).querySelector('input[type="email"]');
      if (champ && email && !champ.value) champ.value = email;
      if (champ) champ.focus();
    });
  });
  function adresseRetour(role) {
    var garder = new URLSearchParams();
    if (role) garder.set("role", role);
    ["role", "postuler", "profil", "type"].forEach(function (k) { if (params.get(k) && !garder.get(k)) garder.set(k, params.get(k)); });
    return location.origin + location.pathname + (garder.toString() ? "?" + garder.toString() : "");
  }

  /* -- démarrage -- */
  async function demarrer() {
    var h = new URLSearchParams(location.hash.slice(1));
    if (h.get("error_description")) {
      message(/expired|invalid/i.test(h.get("error_description")) ? "Ce lien n'est plus valable (il sert une seule fois, pendant une heure). Demandez-en un nouveau."
                                                                    : "La connexion n'a pas abouti : " + h.get("error_description"), true);
      history.replaceState(null, "", location.pathname + location.search);
    }
    var r = await sb.auth.getSession();
    var session = r.data && r.data.session;
    if (!session) {
      if (params.get("inscription")) { montrer("v-inscription"); preparerInscription(); }
      else montrer("v-connexion");
      return;
    }
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    utilisateur = session.user;
    $("email-session").textContent = utilisateur.email;
    if (recuperation) { montrer("v-nouveau-mdp"); $("f-nouveau-mdp").mdp.focus(); return; }
    var rep = await Promise.all([
      sb.from("profils").select(CHAMPS_VUS + ",publie,resume_public,seize_ans,alertes").eq("id", utilisateur.id).maybeSingle(),
      sb.from("structures").select("*").eq("id", utilisateur.id).maybeSingle()
    ]);
    if (rep[0].error || rep[1].error) { montrer("v-session"); message(erreurLisible(rep[0].error || rep[1].error), true); return; }
    profil = rep[0].data; structure = rep[1].data;
    if (profil) return voirCandidat();
    if (structure) return voirStructure();
    var m = memoire() || {};
    var role = params.get("role") || (params.get("postuler") ? "candidat" : m.role);
    if (role === "candidat") return voirCandidat();
    if (role === "structure") return voirStructure();
    montrer("v-choix", "v-session");
  }

  /* -- connexion -- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-google]"), function (b) {
    b.addEventListener("click", async function () {
      if (roleChoisi) memoire({ role: roleChoisi, poste: posteChoisi });
      b.disabled = true;
      var r = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: adresseRetour(roleChoisi) } });
      if (r.error) { b.disabled = false; message(erreurLisible(r.error), true); }
    });
  });
  $("f-connexion").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = this;
    occupe(form, true);
    var r = await sb.auth.signInWithPassword({ email: form.email.value.trim(), password: form.mdp.value });
    occupe(form, false);
    if (r.error) { message(erreurLisible(r.error), true); return; }
    message("");
    form.mdp.value = "";
    demarrer();
  });
  $("f-lien").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = this, email = form.email.value.trim();
    occupe(form, true);
    var r = await sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: adresseRetour(null) } });
    occupe(form, false);
    if (r.error) message(erreurLisible(r.error), true);
    else message("C'est envoyé. Ouvrez l'e-mail reçu à " + email + " et cliquez sur le lien (regardez aussi dans les indésirables).");
  });
  $("f-mdp-oublie").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = this, email = form.email.value.trim();
    occupe(form, true);
    var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    occupe(form, false);
    if (r.error) message(erreurLisible(r.error), true);
    else message("Si un compte existe à " + email + ", un lien pour choisir un nouveau mot de passe vient de partir (regardez aussi dans les indésirables).");
  });
  $("f-nouveau-mdp").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = this;
    occupe(form, true);
    var r = await sb.auth.updateUser({ password: form.mdp.value });
    occupe(form, false);
    if (r.error) { message(erreurLisible(r.error), true); return; }
    recuperation = false;
    form.mdp.value = "";
    message("Mot de passe enregistré.");
    demarrer();
  });
  sb.auth.onAuthStateChange(function (evenement) {
    if (evenement === "PASSWORD_RECOVERY") { recuperation = true; montrer("v-nouveau-mdp"); }
  });

  /* -- inscription en trois étapes : profil, compte, confirmation -- */
  var roleChoisi = null, posteChoisi = null;
  var TEXTES = {
    candidat: ["Votre profil en 3 étapes", "Votre profil", "Diplômes, dates, ce que vous cherchez, votre CV si vous voulez : un aperçu se met à jour pendant que vous écrivez.",
               "C'est en ligne", "Les structures vérifiées de votre secteur peuvent vous écrire, et vous postulez en un clic.",
               "Les structures de votre secteur vous trouvent."],
    structure: ["Votre fiche en 3 étapes", "Votre fiche", "Photos, projet, publics, activités : un aperçu de votre page se met à jour pendant que vous écrivez.",
                "La vérification", "Nous vérifions la structure (en général sous 2 jours ouvrés), puis vos offres et votre page sont en ligne.",
                "Les animateurs de votre secteur vous trouvent."]
  };
  function etapeInscription(n) {
    [1, 2, 3].forEach(function (i) {
      $("ins-" + i).hidden = i !== n;
      var li = $("ea-" + i);
      if (i === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
      li.classList.toggle("fait", i < n);
    });
    if (n === 2 && roleChoisi) {
      var t = TEXTES[roleChoisi], b = document.querySelector('.profil-choix[aria-checked="true"] b');
      $("ins-choisi-nom").textContent = b ? b.textContent : "";
      $("ins-2-titre").textContent = t[0];
      $("ins-e2").textContent = t[1]; $("ins-e2-t").textContent = t[2];
      $("ins-e3").textContent = t[3]; $("ins-e3-t").textContent = t[4];
      $("auth-titre").textContent = t[5];
    } else $("auth-titre").textContent = "Votre espace dans l'animation.";
  }
  function choisir(b) {
    Array.prototype.forEach.call(document.querySelectorAll(".profil-choix"), function (x) { x.setAttribute("aria-checked", x === b ? "true" : "false"); });
    roleChoisi = b.dataset.role;
    posteChoisi = b.dataset.poste || null;
    $("ins-continuer").disabled = false;
  }
  Array.prototype.forEach.call(document.querySelectorAll(".profil-choix"), function (b) {
    b.addEventListener("click", function () { choisir(b); });
  });
  // arrivée depuis la page Structures (?role=structure) : le profil est déjà choisi
  function preparerInscription() {
    var role = params.get("role");
    var b = role && document.querySelector('.profil-choix[data-role="' + role + '"]');
    if (b) { choisir(b); etapeInscription(2); }
  }
  $("ins-continuer").addEventListener("click", function () { if (roleChoisi) { etapeInscription(2); $("f-inscription").email.focus(); } });
  $("ins-retour").addEventListener("click", function () { etapeInscription(1); });
  var emailInscrit = "";
  $("f-inscription").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = this;
    emailInscrit = form.email.value.trim();
    memoire({ role: roleChoisi, poste: posteChoisi });
    occupe(form, true);
    var r = await sb.auth.signUp({ email: emailInscrit, password: form.mdp.value, options: { emailRedirectTo: adresseRetour(roleChoisi) } });
    occupe(form, false);
    if (r.error) { message(erreurLisible(r.error), true); return; }
    message("");
    form.mdp.value = "";
    if (r.data && r.data.session) { demarrer(); return; }                 // la confirmation par e-mail est désactivée
    if (r.data && r.data.user && r.data.user.identities && !r.data.user.identities.length) {
      message("Un compte existe déjà avec cette adresse : connectez-vous (ou utilisez « Mot de passe oublié »).", true);
      montrer("v-connexion"); $("f-connexion").email.value = emailInscrit; return;
    }
    $("ins-envoye").textContent = "Nous avons envoyé un e-mail à " + emailInscrit + ". Cliquez sur le lien qu'il contient : votre espace s'ouvre, et vous remplissez votre " + (roleChoisi === "structure" ? "fiche" : "profil") + ".";
    etapeInscription(3);
  });
  $("ins-renvoyer").addEventListener("click", async function () {
    var r = await sb.auth.resend({ type: "signup", email: emailInscrit, options: { emailRedirectTo: adresseRetour(roleChoisi) } });
    message(r.error ? erreurLisible(r.error) : "C'est renvoyé.", !!r.error);
  });

  Array.prototype.forEach.call(document.querySelectorAll(".role"), function (b) {
    b.addEventListener("click", function () {
      message("");
      if (b.dataset.role === "candidat") voirCandidat(); else voirStructure();
    });
  });

  /* ====================================================================================
     L'assistant : une étape à la fois (création), ou des onglets (modification)
     ==================================================================================== */
  function Assistant(bloc, quandChange) {
    var form = bloc.querySelector("form"), etapes = Array.prototype.slice.call(form.querySelectorAll(".etape"));
    var n = 0, creation = true;
    var nav = bloc.querySelector(".as-onglets");
    etapes.forEach(function (f, i) {
      var b = el("button", null, f.dataset.titre);
      b.type = "button";
      b.addEventListener("click", function () { aller(i); });
      nav.appendChild(b);
    });
    function aller(i) {
      n = Math.max(0, Math.min(etapes.length - 1, i));
      etapes.forEach(function (f, k) { f.hidden = k !== n; });
      Array.prototype.forEach.call(nav.children, function (b, k) { if (k === n) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
      bloc.querySelector(".as-n").textContent = creation ? "Étape " + (n + 1) + " sur " + etapes.length : (bloc.id === "bloc-profil" ? "Mon profil" : "Ma fiche");
      bloc.querySelector(".as-titre").textContent = etapes[n].dataset.titre;
      bloc.querySelector(".as-barre span").style.width = ((n + 1) / etapes.length * 100) + "%";
      bloc.querySelector(".as-retour").hidden = n === 0;
      var derniere = n === etapes.length - 1;
      bloc.querySelector(".as-suivant").hidden = derniere;
      bloc.querySelector(".as-fin").hidden = !derniere;
      bloc.querySelector(".as-enregistrer").hidden = creation || derniere;
      if (quandChange) quandChange();
    }
    // les champs de l'étape sont-ils bons ? (le navigateur montre le premier problème)
    function valide(i) {
      var champs = etapes[i].querySelectorAll("input, select, textarea");
      for (var k = 0; k < champs.length; k++) {
        if (!champs[k].checkValidity()) { champs[k].reportValidity(); return false; }
      }
      return true;
    }
    bloc.querySelector(".as-suivant").addEventListener("click", function () {
      if (!valide(n)) return;
      aller(n + 1);
      bloc.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    bloc.querySelector(".as-retour").addEventListener("click", function () { aller(n - 1); });
    // à l'envoi : tout doit être bon, on montre l'étape du premier problème
    form.addEventListener("submit", function (e) {
      for (var i = 0; i < etapes.length; i++) {
        var champs = etapes[i].querySelectorAll("input, select, textarea");
        for (var k = 0; k < champs.length; k++) {
          if (!champs[k].checkValidity()) { e.preventDefault(); e.stopImmediatePropagation(); aller(i); champs[k].reportValidity(); return; }
        }
      }
    }, true);
    form.addEventListener("input", function () { if (quandChange) quandChange(); });
    form.addEventListener("change", function () { if (quandChange) quandChange(); });
    return {
      ouvrir: function (enCreation) { creation = enCreation; nav.hidden = creation; bloc.querySelector(".as-duree").hidden = !creation; aller(0); }
    };
  }

  /* -- dépôt de fichiers par glisser-déposer -- */
  Array.prototype.forEach.call(document.querySelectorAll(".depot"), function (d) {
    ["dragenter", "dragover"].forEach(function (t) { d.addEventListener(t, function () { d.classList.add("survol"); }); });
    ["dragleave", "drop"].forEach(function (t) { d.addEventListener(t, function () { d.classList.remove("survol"); }); });
  });
  // une image réduite (1600 px au plus) et réencodée en JPEG : plus légère, et sans les données de lieu de l'appareil photo
  function reduireImage(fichier, cote) {
    return new Promise(function (ok, ko) {
      if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) { ko(new Error("mime type")); return; }
      var img = new Image(), url = URL.createObjectURL(fichier);
      img.onload = function () {
        var k = Math.min(1, cote / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok(b) : ko(new Error("image")); }, "image/jpeg", 0.84);
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error("Cette image ne peut pas être lue.")); };
      img.src = url;
    });
  }
  function nomAuHasard(prefixe) { return prefixe + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + ".jpg"; }

  /* ====================================================================================
     Candidat (animateur, directeur)
     ==================================================================================== */
  var CHAMPS_PROFIL = ["prenom", "annee_naissance", "email_contact", "departement", "ville", "poste_recherche", "dispo_debut", "dispo_fin", "disponibilites",
                       "diplomes", "recherche", "experiences", "activites", "permis_b", "mobilite", "presentation", "publie", "resume_public", "seize_ans", "alertes"];
  var assistantProfil = Assistant($("bloc-profil"), apercuProfil);
  var cvAEnvoyer = null;
  function voirCandidat() {
    montrer("v-candidat", "v-session");
    var nouveau = !profil, m = memoire() || {};
    $("chapo-compte").textContent = nouveau ? "Votre profil en quelques minutes. C'est gratuit, et ça le restera." : "Votre espace : vos candidatures, les offres pour vous et votre profil.";
    var depart = profil || { email_contact: utilisateur.email, publie: true, resume_public: true, prenom: (utilisateur.user_metadata && (utilisateur.user_metadata.given_name || "")) || "" };
    if (nouveau && m.poste === "directeur") { depart.recherche = ["direction"]; depart.poste_recherche = "Direction de séjour ou d'accueil"; }
    $("f-profil").reset();
    remplir($("f-profil"), depart);
    remplirQualifs(depart.qualifications);
    cvAEnvoyer = null;
    montrerCv();
    montrerMobilite();
    assistantProfil.ouvrir(nouveau);
    ongletDepart("v-candidat", nouveau ? "profil" : "tableau", nouveau);
    $("bloc-mes-candidatures").hidden = $("bloc-offres-pour-toi").hidden = nouveau;
    $("tuiles-candidat").hidden = nouveau;
    if (nouveau) {
      if (params.get("postuler")) message("Créez d'abord votre profil : votre candidature partira juste après.");
      // une demande déjà envoyée sans profil : on la montre, pour la suivre ou la retirer
      mesDemandes().then(function (d) { $("bloc-mes-demandes").hidden = !d.length; });
      return;
    }
    tableauCandidat();
    mesDemandes();
    if (params.get("postuler")) ouvrirPostuler(params.get("postuler"));
  }
  // « Je peux aussi travailler… » : les départements de la région du candidat (et ceux déjà cochés)
  function montrerMobilite() {
    var f = $("f-profil"), i = L.deps.indexOf(f.departement.value), region = i < 0 ? null : L.regions_deps[i];
    Array.prototype.forEach.call(document.querySelectorAll("#cases-mobilite label"), function (l) {
      var c = l.querySelector("input");
      l.hidden = !(l.dataset.region === "toutes" || l.dataset.region === region || c.checked) || c.value === f.departement.value;
    });
  }
  $("f-profil").departement.addEventListener("change", montrerMobilite);
  Array.prototype.forEach.call(document.querySelectorAll(".puces-idees"), function (p) {
    var champ = $("f-profil").elements[p.dataset.remplir];
    Array.prototype.forEach.call(p.querySelectorAll(".puce-idee"), function (b) {
      b.addEventListener("click", function () { champ.value = b.textContent; champ.dispatchEvent(new Event("input", { bubbles: true })); });
    });
  });
  // les qualifications : une case par qualification, et sa date de fin (mois) facultative
  function lireQualifs() {
    return Array.prototype.filter.call(document.querySelectorAll("[data-qualif]"), function (c) { return c.checked; }).map(function (c) {
      var fin = document.querySelector('[data-qualif-fin="' + c.dataset.qualif + '"]').value;
      return fin ? { q: c.dataset.qualif, fin: fin } : { q: c.dataset.qualif };
    });
  }
  function remplirQualifs(liste) {
    var parQ = {};
    (liste || []).forEach(function (x) { parQ[x.q] = x; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-qualif]"), function (c) {
      var x = parQ[c.dataset.qualif];
      c.checked = !!x;
      var f = document.querySelector('[data-qualif-fin="' + c.dataset.qualif + '"]');
      f.value = x && x.fin ? x.fin : "";
      c.closest(".qualif").classList.toggle("on", !!x);
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-qualif]"), function (c) {
    c.addEventListener("change", function () { c.closest(".qualif").classList.toggle("on", c.checked); });
  });
  function age(annee) { return annee ? new Date().getFullYear() - annee : null; }
  function lireProfil() {
    var d = lire($("f-profil"), CHAMPS_PROFIL);
    d.annee_naissance = d.annee_naissance ? parseInt(d.annee_naissance, 10) : null;
    d.qualifications = lireQualifs();
    d.activites = (d.activites || "").split(",").map(function (x) { return x.trim().slice(0, 30); }).filter(Boolean).slice(0, 10);
    return d;
  }
  // l'aperçu de la carte, et le profil complet à X %
  function apercuProfil() {
    var d = lireProfil(), b = $("bloc-profil");
    function ap(nom) { return b.querySelector('[data-ap="' + nom + '"]'); }
    ap("initiale").textContent = (d.prenom || "?").charAt(0).toUpperCase();
    ap("nom").textContent = d.prenom || "Votre prénom";
    ap("lieu").textContent = [(d.ville ? d.ville + " " : "") + (d.departement ? "(" + d.departement + ")" : ""), d.annee_naissance ? age(d.annee_naissance) + " ans" : "", d.poste_recherche].filter(Boolean).join(" · ") || "Votre ville";
    var det = (d.diplomes || []).map(function (x) { return libelle("diplomes", x); });
    if (d.dispo_debut) det.push("disponible dès le " + dateFr(d.dispo_debut, false));
    ap("detail").textContent = det.join(" · ") || "Vos diplômes";
    ap("badge").textContent = d.publie === false ? "Profil caché" : (cvAEnvoyer || (profil && profil.cv_nom) ? "CV joint" : "Disponible");
    ap("note").textContent = d.publie === false ? "Les structures ne le voient pas" : "Vu par les structures vérifiées";
    var points = [d.prenom, d.departement, (d.diplomes || []).length, (d.recherche || []).length, d.poste_recherche, d.dispo_debut, d.disponibilites,
                  (d.experiences || []).length, (d.activites || []).length, (d.mobilite || []).length, d.presentation && d.presentation.length > 40,
                  cvAEnvoyer || (profil && profil.cv_nom), d.email_contact];
    var p = Math.round(points.filter(Boolean).length / points.length * 100);
    ap("pourcent").textContent = p + " %";
    ap("jauge").style.width = p + "%";
  }
  $("bloc-profil").querySelector(".as-voir-fiche").addEventListener("click", function () {
    var d = lireProfil();
    d.cv_nom = cvAEnvoyer ? cvAEnvoyer.name : (profil && profil.cv_nom);
    d.maj_le = profil ? profil.maj_le : new Date().toISOString();
    ouvrirFiche(ficheProfil(d, { apercu: true }));
  });

  // le CV : un PDF de 2 Mo au plus, dans le dossier du candidat (lisible par lui et par les structures vérifiées)
  function montrerCv() {
    var nom = cvAEnvoyer ? cvAEnvoyer.name + " (envoyé à l'enregistrement)" : (profil && profil.cv_nom);
    $("cv-actuel").hidden = !nom;
    $("cv-nom").textContent = nom || "";
    $("cv-voir").hidden = !!cvAEnvoyer || !nom;
  }
  $("f-profil").cv_fichier.addEventListener("change", function () {
    var f = this.files[0];
    this.value = "";
    if (!f) return;
    if (f.type !== "application/pdf") { message("Le CV doit être un fichier PDF.", true); return; }
    if (f.size > 2 * 1024 * 1024) { message("Le CV fait plus de 2 Mo : enregistrez-le en PDF plus léger (« Réduire la taille du fichier »).", true); return; }
    message("");
    cvAEnvoyer = f;
    montrerCv(); apercuProfil();
  });
  $("cv-voir").addEventListener("click", function () { ouvrirCv(utilisateur.id); });
  $("cv-retirer").addEventListener("click", async function () {
    if (cvAEnvoyer) { cvAEnvoyer = null; montrerCv(); apercuProfil(); return; }
    if (!confirm("Retirer votre CV ? Les structures ne le verront plus.")) return;
    var r = await sb.storage.from("cv").remove([utilisateur.id + "/cv.pdf"]);
    var u = r.error ? r : await sb.from("profils").update({ cv_nom: null }).eq("id", utilisateur.id).select(CHAMPS_VUS + ",publie,resume_public,seize_ans,alertes").single();
    if (u.error) { message(erreurLisible(u.error), true); return; }
    profil = u.data;
    message("CV retiré.");
    montrerCv(); apercuProfil();
  });
  async function ouvrirCv(id) {
    var fen = window.open("", "_blank");
    var r = await sb.storage.from("cv").createSignedUrl(id + "/cv.pdf", 120);
    if (r.error || !r.data) { if (fen) fen.close(); message("Le CV ne peut pas être ouvert : " + erreurLisible(r.error || "introuvable"), true); return; }
    if (fen) fen.location = r.data.signedUrl; else location.href = r.data.signedUrl;
  }

  $("f-profil").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = this, d = lireProfil();
    if (d.dispo_fin && d.dispo_debut && d.dispo_fin < d.dispo_debut) { message("La fin de vos disponibilités est avant le début.", true); return; }
    occupe(form, true);
    var r = profil
      ? await sb.from("profils").update(d).eq("id", utilisateur.id).select(CHAMPS_VUS + ",publie,resume_public,seize_ans,alertes").single()
      : await sb.from("profils").insert(d).select(CHAMPS_VUS + ",publie,resume_public,seize_ans,alertes").single();
    if (!r.error && cvAEnvoyer) {
      var u = await sb.storage.from("cv").upload(utilisateur.id + "/cv.pdf", cvAEnvoyer, { upsert: true, contentType: "application/pdf", cacheControl: "60" });
      if (u.error) { occupe(form, false); profil = r.data; message("Profil enregistré, mais le CV n'est pas parti : " + erreurLisible(u.error), true); voirCandidat(); return; }
      r = await sb.from("profils").update({ cv_nom: cvAEnvoyer.name.slice(0, 120) }).eq("id", utilisateur.id).select(CHAMPS_VUS + ",publie,resume_public,seize_ans,alertes").single();
    }
    occupe(form, false);
    if (r.error) { message(erreurLisible(r.error), true); return; }
    var nouveau = !profil;
    profil = r.data;
    memoire(null);
    message(nouveau ? "Votre profil est créé. Les structures vérifiées de votre secteur peuvent maintenant vous écrire."
                    : (profil.publie ? "Profil enregistré." : "Profil enregistré. Il est caché : les structures ne le voient plus (sauf celles à qui vous avez postulé)."));
    voirCandidat();
  });

  /* ====================================================================================
     Structure
     ==================================================================================== */
  var CHAMPS_STRUCTURE = ["nom", "type", "ville", "departement", "email_contact", "site", "identifiant", "presentation",
                          "page_publique", "slug", "accroche", "couleur", "publics", "activites", "lieux", "projet", "avantages"];
  var assistantStructure = Assistant($("bloc-structure"), apercuStructure);
  var photos = [], logo = null, aSupprimer = [];
  function enSlug(t) {
    return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  }
  function urlPhoto(chemin) { return L.photos + chemin; }
  function voirStructure() {
    montrer("v-structure", "v-session");
    var f = $("f-structure"), nouveau = !structure;
    f.reset();
    var typeVoulu = { periscolaire: "periscolaire", extrascolaire: "accueil-de-loisirs", sejours: "sejours" }[params.get("type")];
    remplir(f, structure || { email_contact: utilisateur.email, page_publique: true, couleur: "rouge", type: typeVoulu });
    if (!structure || !structure.couleur) remplir(f, { couleur: "rouge" });
    photos = (structure && structure.photos || []).slice();
    logo = structure && structure.logo || null;
    aSupprimer = [];
    montrerPhotos();
    var voir = $("voir-ma-page");
    voir.hidden = !(actif(structure) && structure.slug && structure.page_publique);
    if (!voir.hidden) voir.href = L.lien_structures + structure.slug + "/";
    $("accord-structure").hidden = !nouveau;
    f.accord.required = nouveau;
    assistantStructure.ouvrir(nouveau);
    ongletDepart("v-structure", nouveau ? "page" : !paye(structure) ? "abonnement" : "tableau", nouveau);
    var st = $("statut-structure");
    st.hidden = false;
    st.className = "statut";
    $("chapo-compte").textContent = nouveau ? "Présentez votre structure, étape par étape. Votre page est en ligne une fois l'abonnement réglé et la structure vérifiée." : "Votre espace structure.";
    if (nouveau) st.hidden = true;
    else if (!paye(structure)) {
      st.textContent = "Votre fiche est enregistrée. Dernière étape : l'abonnement. Nous vérifions ensuite la structure, et votre page et vos offres sont en ligne.";
      st.className = "statut statut-attente";
    } else if (!structure.verifiee) {
      st.textContent = "Abonnement réglé, merci ! Nous vérifions la structure (en général sous 2 jours ouvrés). Vous pouvez déjà préparer vos offres : elles seront en ligne dès la vérification.";
      st.className = "statut statut-attente";
    } else {
      st.textContent = "Structure en ligne : votre page et vos offres sont visibles par tous, et vous voyez les profils des candidats.";
      st.className = "statut statut-ok";
    }
    if (st.classList.contains("statut-ok")) st.dataset.onglet = "tableau"; else { delete st.dataset.onglet; st.classList.remove("hors-onglet"); }
    montrerOnglet("v-structure", ongletActuel["v-structure"]);
    $("bloc-offres").hidden = nouveau;
    $("bloc-centres").hidden = nouveau;
    $("bloc-candidats").hidden = !actif(structure);
    $("tuiles-structure").hidden = nouveau;
    if (structure) chargerCentres().then(montrerAbonnement);
    else $("bloc-abonnement").hidden = true;
    if (structure) chargerOffres().then(tableauStructure).then(function () { tableauDeBord(); });
    $("bloc-tableau").hidden = nouveau;
    // les conseils : pour les structures abonnées ; un conseil de la semaine en tête, 4 visibles, les autres au clic
    $("bloc-conseils").hidden = nouveau || !paye(structure);
    $("bloc-conseils-verrou").hidden = nouveau || paye(structure);
    $("bloc-outils").hidden = nouveau || !paye(structure);
    $("bloc-outils-verrou").hidden = nouveau || paye(structure);
    $("tb-outils").hidden = !paye(structure);
    if (!nouveau && paye(structure)) chargerRessources();
    if (actif(structure)) chargerCandidats();
    if (structure) chargerDemandesRecues().then(function () { tableauStructure(); if (!$("tb-conseils").firstChild) return; conseilsStructure(); });
    if (params.get("profil") && !profilDemande) { profilDemande = true; ouvrirProfilDemande(params.get("profil")); }
  }

  /* -- un profil choisi dans la liste publique des animateurs (?profil=…) : la fiche complète pour une structure
        vérifiée et abonnée ; sinon, ce qu'il reste à faire pour la voir -- */
  var profilDemande = false;
  async function ouvrirProfilDemande(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return;
    if (!actif(structure)) {
      message(!structure ? "Créez l'espace de votre structure : la fiche complète des animateurs est réservée aux structures vérifiées et abonnées."
        : !paye(structure) ? "La fiche complète des animateurs est réservée aux structures abonnées : réglez l'abonnement ci-dessous, puis vous verrez tous les profils."
        : "Abonnement réglé : la fiche complète s'ouvre dès que nous avons vérifié votre structure (en général sous 2 jours ouvrés).");
      var ab = $("bloc-abonnement");
      if (structure && ab) allerA("bloc-abonnement");
      return;
    }
    var r = await sb.from("profils").select(CHAMPS_VUS).eq("id", id).eq("publie", true).maybeSingle();
    if (r.error || !r.data) { message("Ce profil n'est plus en ligne.", true); return; }
    var p = r.data;
    if (!favoris.length) { var fav = await sb.from("favoris").select("profil_id"); favoris = (fav.data || []).map(function (x) { return x.profil_id; }); }
    ouvrirFiche(ficheProfil(p, { ecrire: true, cvId: p.cv_nom ? p.id : null, favori: boutonFavori(p, "fp-bouton-second") }));
  }

  /* -- l'abonnement (Stripe) : payé si la fin de période n'est pas passée ; en ligne si payé ET vérifié -- */
  function paye(s) { return !!(s && s.abonnement_fin && s.abonnement_fin >= aujourdhui()); }
  function actif(s) { return !!(s && s.verifiee && paye(s)); }
  var placesFondatrices = null;
  function euros(n) { return n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €"; }
  async function montrerAbonnement() {
    var A = L.abonnement || {}, b = $("bloc-abonnement");
    if (!A.paiement) { b.hidden = true; return; }
    b.hidden = false;
    var nbCentres = 1 + mesCentres.length;
    $("abo-portail").hidden = !paye(structure);
    if (paye(structure)) {
      // abonnement en cours : ce qui est payé, et l'espace abonnés pour les factures, la carte, le nombre de centres ou l'arrêt
      $("abo-sur").textContent = "Votre abonnement";
      $("abo-titre").textContent = "En cours jusqu'au " + dateFr(structure.abonnement_fin);
      var n = structure.centres_payes || 1;
      $("abo-detail").textContent = n + (n > 1 ? " centres payés" : " centre payé (votre structure)") + (structure.fondatrice ? " · tarif fondateur, à vie" : "") +
        (nbCentres > n ? ". Vous avez " + nbCentres + " centres : ajoutez-en " + (nbCentres - n) + " à l'abonnement depuis l'espace abonnés (quantité), ou écrivez-nous." : ".");
      ["abo-nb-champ", "abo-total", "abo-payer", "abo-facture"].forEach(function (id) { $(id).hidden = true; });
      return;
    }
    ["abo-nb-champ", "abo-total", "abo-payer", "abo-facture"].forEach(function (id) { $(id).hidden = false; });
    if (placesFondatrices === null) {
      var r = await sb.rpc("places_fondatrices");
      placesFondatrices = r.error ? 0 : r.data;
    }
    var fond = placesFondatrices > 0;
    var p1 = fond ? 39.5 : 79, p2 = fond ? 19.75 : 39.5;
    $("abo-sur").textContent = fond ? "Offre fondateurs · plus que " + placesFondatrices + " place" + (placesFondatrices > 1 ? "s" : "") : "Mettre votre structure en ligne";
    $("abo-titre").textContent = euros(p1) + " par an" + (fond ? ", à vie" : "");
    $("abo-detail").textContent = (fond ? "Moitié prix, à vie, pour les 10 premières structures. " : "") + "Votre page, vos offres là où les jeunes cherchent leur BAFA, et les profils des candidats. Chaque centre en plus : " + euros(p2) + " par an. Sans commission, arrêt à tout moment.";
    var champ = $("abo-nb");
    if (!champ.dataset.touche) champ.value = nbCentres;
    function maj() {
      var nb = Math.max(1, Math.min(30, parseInt(champ.value, 10) || 1));
      $("abo-total").textContent = nb > 1 ? "Total : " + euros(p1 + (nb - 1) * p2) + " par an pour " + nb + " centres (à indiquer en « quantité » sur la page de paiement)." : "Total : " + euros(p1) + " par an.";
      var q = new URLSearchParams({ client_reference_id: utilisateur.id, prefilled_email: utilisateur.email, locale: "fr" });
      $("abo-payer").href = (fond ? A.paiement_fondateur : A.paiement) + "?" + q.toString();
      var corps = "Bonjour,\n\nNous souhaitons régler l'abonnement Fil Roug'Anim sur facture.\n\n" +
        "Structure : " + (structure.nom || "") + "\nSIRET, RNA ou n° de déclaration : " + (structure.identifiant || "") +
        "\nNombre de centres : " + nb + "\nAdresse de facturation : \nService et n° d'engagement (Chorus Pro, si besoin) : \n" +
        "Mode de paiement (virement, mandat administratif) : \n\nRéférence du compte : " + utilisateur.id + "\n";
      $("abo-facture").href = "mailto:" + L.email_site + "?subject=" + encodeURIComponent("Abonnement sur facture : " + (structure.nom || "")) + "&body=" + encodeURIComponent(corps);
    }
    if (!champ.dataset.ecoute) { champ.dataset.ecoute = "1"; champ.addEventListener("input", function () { champ.dataset.touche = "1"; maj(); }); }
    maj();
  }

  /* -- les centres de la structure : chacun sa page et ses offres, dans la limite des centres payés -- */
  var mesCentres = [], centreEnCours = null;
  var CHAMPS_CENTRE = ["nom", "type", "ville", "departement", "accroche", "presentation", "publics", "activites"];
  async function chargerCentres() {
    var r = await sb.from("centres").select("*").eq("structure_id", utilisateur.id).order("cree_le");
    mesCentres = r.error ? [] : (r.data || []);
    var liste = $("liste-centres");
    liste.textContent = "";
    var sel = $("f-offre").centre_id, garde = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    mesCentres.forEach(function (c) { var o = el("option", null, c.nom + " (" + c.ville + ")"); o.value = c.id; sel.appendChild(o); });
    sel.value = garde;
    $("champ-centre-offre").hidden = !mesCentres.length;
    if (r.error) { liste.appendChild(el("p", "aucune", erreurLisible(r.error))); return; }
    if (!mesCentres.length) { liste.appendChild(el("p", "aucune", "Un seul lieu ? Rien à faire ici : la page de votre structure suffit.")); return; }
    var payes = (structure && paye(structure)) ? (structure.centres_payes || 1) - 1 : 0;
    mesCentres.forEach(function (c, i) {
      var item = el("article", "ligne-compte"), corps = el("div");
      corps.appendChild(el("h3", null, c.nom));
      corps.appendChild(el("p", "petit", libelle("types", c.type || structure.type) + " · " + c.ville + " (" + c.departement + ")"));
      var etat = i < payes ? (actif(structure) ? ["En ligne", "etat etat-ok"] : ["Payé, en attente de la vérification", "etat etat-attente"])
                           : ["À ajouter à l'abonnement (moitié prix)", "etat etat-attente"];
      corps.appendChild(el("p", etat[1], etat[0]));
      if (i < payes && actif(structure) && structure.slug) {
        var a = el("a", "petit", "Voir la page du centre");
        a.href = L.lien_structures + structure.slug + "/" + c.slug + "/"; a.target = "_blank"; a.rel = "noopener";
        corps.appendChild(a);
      }
      item.appendChild(corps);
      var actions = el("div", "boutons");
      var m = el("button", "bouton-texte", "Modifier"); m.type = "button";
      m.addEventListener("click", function () { ouvrirCentre(c); });
      var d = el("button", "bouton-texte bouton-danger", "Supprimer"); d.type = "button";
      d.addEventListener("click", async function () {
        if (!confirm("Supprimer le centre « " + c.nom + " » ? Ses offres restent, rattachées à la structure.")) return;
        var x = await sb.from("centres").delete().eq("id", c.id);
        if (x.error) message(erreurLisible(x.error), true); else { message("Centre supprimé."); chargerCentres().then(montrerAbonnement); }
      });
      actions.appendChild(m); actions.appendChild(d);
      item.appendChild(actions);
      liste.appendChild(item);
    });
  }
  function ouvrirCentre(c) {
    centreEnCours = c || null;
    var f = $("f-centre");
    f.reset();
    remplir(f, c || { ville: structure.ville, departement: structure.departement });
    $("titre-f-centre").textContent = c ? "Modifier le centre" : "Nouveau centre";
    f.hidden = false;
    f.nom.focus();
  }
  $("nouveau-centre").addEventListener("click", function () { ouvrirCentre(null); });
  $("annuler-centre").addEventListener("click", function () { $("f-centre").hidden = true; centreEnCours = null; });
  $("f-centre").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = this;
    var champs = form.querySelectorAll("[required]");
    for (var k = 0; k < champs.length; k++) { if (!champs[k].checkValidity()) { champs[k].reportValidity(); return; } }
    var d = lire(form, CHAMPS_CENTRE);
    d.activites = (d.activites || "").split(",").map(function (x) { return x.trim().slice(0, 40); }).filter(Boolean).slice(0, 12);
    var base = enSlug(d.nom).slice(0, 56) || "centre", slug = base, n = 2;
    while (mesCentres.some(function (c) { return c.slug === slug && (!centreEnCours || c.id !== centreEnCours.id); })) slug = base + "-" + n++;
    d.slug = centreEnCours && centreEnCours.nom === d.nom ? centreEnCours.slug : slug;
    occupe(form, true);
    var r = centreEnCours ? await sb.from("centres").update(d).eq("id", centreEnCours.id) : await sb.from("centres").insert(d);
    occupe(form, false);
    if (r.error) { message(erreurLisible(r.error), true); return; }
    form.hidden = true;
    message(centreEnCours ? "Centre enregistré." : "Centre ajouté." + (paye(structure) ? " Ajoutez-le à votre abonnement pour qu'il soit en ligne." : ""));
    centreEnCours = null;
    chargerCentres().then(montrerAbonnement);
  });
  if (params.get("paiement") === "ok") {
    setTimeout(function () { message("Merci ! Votre paiement est bien parti. Il apparaît ici d'ici 15 minutes environ ; nous vérifions ensuite la structure, puis votre page et vos offres sont en ligne."); }, 1200);
  }

  function lireStructure() {
    var d = lire($("f-structure"), CHAMPS_STRUCTURE);
    d.couleur = d.couleur || "rouge";
    d.activites = (d.activites || "").split(",").map(function (x) { return x.trim().slice(0, 40); }).filter(Boolean).slice(0, 12);
    d.slug = enSlug(d.slug || d.nom);
    if (d.slug.length < 3) d.slug = null;
    d.photos = photos.slice(0, 5);
    d.logo = logo;
    return d;
  }
  function apercuStructure() {
    var d = lireStructure(), b = $("bloc-structure");
    function ap(nom) { return b.querySelector('[data-ap="' + nom + '"]'); }
    var haut = ap("haut");
    haut.className = "tp-carte-haut rc-carte-structure theme-" + d.couleur;
    haut.style.backgroundImage = d.photos.length ? "linear-gradient(rgba(35,31,32,.15), rgba(35,31,32,.15)), url(" + JSON.stringify(urlPhoto(d.photos[0])) + ")" : "";
    haut.style.backgroundSize = "cover"; haut.style.backgroundPosition = "center";
    var ini = ap("initiale");
    ini.textContent = "";
    if (d.logo) { var im = el("img"); im.src = urlPhoto(d.logo); im.alt = ""; ini.appendChild(im); } else ini.textContent = d.nom ? initiales(d.nom) : "?";
    ap("badge").textContent = d.type ? libelle("types", d.type) : "Structure";
    ap("nom").textContent = d.nom || "Votre structure";
    ap("lieu").textContent = d.ville ? d.ville + (d.departement ? " (" + d.departement + ")" : "") : "Votre ville";
    ap("detail").textContent = (d.publics || []).map(function (x) { return libelle("publics", x); }).join(" · ") || "Vos publics";
    ap("note").textContent = d.page_publique ? "filrouganim.fr/…/" + (d.slug || "votre-page") : "Page cachée";
    var points = [d.type, d.nom, d.ville, d.departement, d.accroche, (d.publics || []).length, d.activites.length, d.lieux, d.presentation, d.projet,
                  d.photos.length, d.logo, d.avantages, d.site, d.email_contact, d.identifiant];
    var p = Math.round(points.filter(Boolean).length / points.length * 100);
    ap("pourcent").textContent = p + " %";
    ap("jauge").style.width = p + "%";
  }
  $("bloc-structure").querySelector(".as-voir-fiche").addEventListener("click", function () {
    var d = lireStructure();
    d.offres = mesOffres.filter(function (o) { return o.publiee && o.expire_le >= aujourdhui(); });
    d.fondatrice = structure && structure.fondatrice;
    ouvrirFiche(ficheStructure(d));
  });
  // les photos et le logo, envoyés dès qu'on les choisit (dans le dossier de la structure)
  function montrerPhotos() {
    var g = $("photos-grille");
    g.textContent = "";
    photos.forEach(function (ch, i) {
      var li = el("li", i === 0 ? "photo-une" : null), im = el("img");
      im.src = urlPhoto(ch); im.alt = "Photo " + (i + 1); im.loading = "lazy";
      var x = el("button", null, "×");
      x.type = "button"; x.setAttribute("aria-label", "Retirer la photo " + (i + 1));
      x.addEventListener("click", function () { aSupprimer.push(ch); photos.splice(i, 1); montrerPhotos(); apercuStructure(); });
      li.appendChild(im); li.appendChild(x); g.appendChild(li);
    });
    $("photos-depot").hidden = photos.length >= 5;
    var a = $("logo-apercu");
    a.style.backgroundImage = logo ? "url(" + JSON.stringify(urlPhoto(logo)) + ")" : "";
    $("logo-retirer").hidden = !logo;
  }
  async function envoyerImage(fichier, prefixe, cote) {
    var blob = await reduireImage(fichier, cote);
    if (blob.size > 2 * 1024 * 1024) throw new Error("exceeded");
    var chemin = utilisateur.id + "/" + nomAuHasard(prefixe);
    var r = await sb.storage.from("structures").upload(chemin, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (r.error) throw r.error;
    return chemin;
  }
  $("f-structure").photos_fichier.addEventListener("change", async function () {
    var liste = Array.prototype.slice.call(this.files, 0, 5 - photos.length), champ = this;
    champ.value = "";
    if (!liste.length) return;
    message("Envoi des photos…");
    try {
      for (var i = 0; i < liste.length; i++) photos.push(await envoyerImage(liste[i], "photo", 1600));
      message("Photos ajoutées. Pensez à enregistrer votre fiche.");
    } catch (e) { message(erreurLisible(e), true); }
    montrerPhotos(); apercuStructure();
  });
  $("f-structure").logo_fichier.addEventListener("change", async function () {
    var f = this.files[0];
    this.value = "";
    if (!f) return;
    try {
      var ancien = logo;
      logo = await envoyerImage(f, "logo", 400);
      if (ancien) aSupprimer.push(ancien);
      message("Logo ajouté. Pensez à enregistrer votre fiche.");
    } catch (e) { message(erreurLisible(e), true); }
    montrerPhotos(); apercuStructure();
  });
  $("logo-retirer").addEventListener("click", function () { if (logo) aSupprimer.push(logo); logo = null; montrerPhotos(); apercuStructure(); });

  $("f-structure").addEventListener("submit", async function (e) {
    e.preventDefault();
    var form = this, d = lireStructure();
    occupe(form, true);
    var r = structure
      ? await sb.from("structures").update(d).eq("id", utilisateur.id).select().single()
      : await sb.from("structures").insert(d).select().single();
    occupe(form, false);
    if (r.error) { message(erreurLisible(r.error), true); return; }
    if (aSupprimer.length) { sb.storage.from("structures").remove(aSupprimer); aSupprimer = []; }
    var nouveau = !structure;
    structure = r.data;
    memoire(null);
    message(nouveau ? "Fiche enregistrée. Nous vérifions la structure, puis vos offres pourront être en ligne." : "Fiche enregistrée.");
    voirStructure();
  });

  /* -- offres de la structure -- */
  var CHAMPS_OFFRE = ["centre_id", "intitule", "poste", "contrat", "type_accueil", "nb_postes", "age_min", "age_max", "ville", "departement", "debut", "fin", "public", "diplomes",
                      "remuneration_montant", "remuneration_unite", "candidater", "expire_le", "texte", "loge", "publiee"];
  var mesOffres = [];
  async function chargerOffres() {
    var r = await sb.from("offres").select("*").eq("structure_id", utilisateur.id).order("debut");
    mesOffres = r.data || [];
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
      else if (!actif(structure)) { etat = paye(structure) ? "En attente de la vérification" : "En attente de l'abonnement"; classe = "etat etat-attente"; }
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
    if (d.age_min && d.age_max && +d.age_max < +d.age_min) { message("L'âge maximum des enfants est plus petit que l'âge minimum.", true); return; }
    occupe(form, true);
    var r = offreEnCours
      ? await sb.from("offres").update(d).eq("id", offreEnCours.id)
      : await sb.from("offres").insert(d);
    occupe(form, false);
    if (r.error) { message(erreurLisible(r.error), true); return; }
    form.hidden = true; offreEnCours = null;
    message(actif(structure) ? "Offre enregistrée. Elle apparaît sur le site dans l'heure." : "Offre enregistrée. Elle sera en ligne dès que l'abonnement sera réglé et la structure vérifiée.");
    chargerOffres().then(tableauStructure);
  });

  /* ====================================================================================
     Les fiches (même mise en page que les pages du site : classes fp-*)
     ==================================================================================== */
  function icone(chemin) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "icone"); s.setAttribute("aria-hidden", "true");
    s.innerHTML = chemin;   // chemins fixes, écrits ici : jamais de texte venu d'une personne
    return s;
  }
  var IC = { badge: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
             lettre: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 7l9 6 9-6" fill="none" stroke="currentColor" stroke-width="1.8"/>' };
  function bloc(titre) { var s = el("section", "fp-bloc"); s.appendChild(el("h2", null, titre)); return s; }
  function coches(liste, douces) { var ul = el("ul", "fp-coches" + (douces ? " fp-coches-douces" : "")); liste.forEach(function (t) { ul.appendChild(el("li", null, t)); }); return ul; }
  function chiffres(liste) {
    var ul = el("ul", "fp-chiffres");
    liste.forEach(function (c) { var li = el("li"); li.appendChild(el("b", null, c[0])); li.appendChild(el("span", null, c[1])); ul.appendChild(li); });
    return ul;
  }
  function texteReplie(sec, paragraphes) {
    var t = el("div", "fp-texte");
    t.setAttribute("data-replie", "");
    paragraphes.forEach(function (p, i) {
      if (Array.isArray(p)) { t.appendChild(el("h3", null, p[1])); return; }
      (p || "").split(/\n\s*\n/).forEach(function (x) { if (x.trim()) t.appendChild(el("p", i === 0 && sec.dataset.accroche ? "fp-accroche" : null, x.trim())); });
    });
    sec.appendChild(t);
    var b = el("button", "fp-lire", "Lire la suite"); b.type = "button"; b.hidden = true;
    sec.appendChild(b);
  }
  function carteOu(points, libelleCarte) {
    var c = el("div", "fp-carte");
    c.setAttribute("data-fp-carte", JSON.stringify({ points: points }));
    c.setAttribute("data-tuiles", L.tuiles);
    c.setAttribute("role", "img"); c.setAttribute("aria-label", libelleCarte);
    return c;
  }
  function entete(racineFiche, o) {
    if (o.photos && o.photos.length) {
      var g = el("div", "fp-galerie fp-galerie-" + Math.min(o.photos.length, 5));
      o.photos.slice(0, 5).forEach(function (ch, i) { var a = el("span", "fp-photo"), im = el("img"); im.src = urlPhoto(ch); im.alt = "Photo " + (i + 1); a.appendChild(im); g.appendChild(a); });
      racineFiche.appendChild(g);
    } else {
      var ban = el("div", "fp-banniere"); ban.setAttribute("aria-hidden", "true"); ban.appendChild(el("span", null, o.banniere || ""));
      racineFiche.appendChild(ban);
    }
    var id = el("div", "fp-identite");
    var av = el("span", "fp-avatar");
    if (o.logo) { var im2 = el("img"); im2.src = urlPhoto(o.logo); im2.alt = ""; av.appendChild(im2); } else av.textContent = o.initiale;
    id.appendChild(av);
    var t = el("div");
    t.appendChild(el("h1", null, o.nom));
    t.appendChild(el("p", "fp-sous", o.sous));
    var ul = el("ul", "fp-badges");
    o.badges.forEach(function (b) { var li = el("li"); li.appendChild(icone(IC.badge)); li.appendChild(document.createTextNode(b)); ul.appendChild(li); });
    t.appendChild(ul);
    id.appendChild(t);
    racineFiche.appendChild(id);
  }
  function contactTete(aside, initiale, nom, sous, logoChemin) {
    var tete = el("div", "fp-contact-tete"), av = el("span", "fp-avatar fp-avatar-petit");
    if (logoChemin) { var im = el("img"); im.src = urlPhoto(logoChemin); im.alt = ""; av.appendChild(im); } else av.textContent = initiale;
    var s = el("span"); s.appendChild(el("b", null, nom)); s.appendChild(el("small", null, sous));
    tete.appendChild(av); tete.appendChild(s); aside.appendChild(tete);
  }

  // la fiche d'un profil de candidat : pour une structure (avec Écrire, Favori, CV), ou en aperçu pour le candidat
  var RECH_DETAIL = { "stage-pratique": "Les 14 jours de stage pratique du BAFA, dans un accueil déclaré.", "ete": "En séjour ou en centre de loisirs, juillet et août.",
    "petites-vacances": "Toussaint, Noël, hiver, printemps.", "mercredis": "Les mercredis, hors vacances scolaires.", "periscolaire": "Matins, midis et soirs des jours d'école.",
    "annee": "Un poste toute l'année.", "direction": "Direction ou direction adjointe.", "alternance": "BPJEPS ou DEJEPS en alternance." };
  var MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function moisAnnee(ym) { var x = ym.split("-"); return ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][+x[1] - 1] + " " + x[0]; }
  // 12 mois à partir d'aujourd'hui : en couleur, ceux où le candidat est disponible (ses dates, ou ce qu'il cherche)
  function bandeMois(p) {
    var r = p.recherche || [], debut = p.dispo_debut ? p.dispo_debut.slice(0, 7) : null, fin = p.dispo_fin ? p.dispo_fin.slice(0, 7) : null;
    var parMois = function (m) { // m : 1 à 12
      if (r.indexOf("annee") >= 0 || r.indexOf("mercredis") >= 0 || r.indexOf("periscolaire") >= 0) return m !== 8;
      return (r.indexOf("ete") >= 0 && (m === 7 || m === 8)) || (r.indexOf("petites-vacances") >= 0 && [2, 4, 10, 12].indexOf(m) >= 0);
    };
    if (!debut && !r.length) return null;
    var ul = el("ol", "fp-mois"), d = new Date(), n = 0;
    for (var i = 0; i < 12; i++) {
      var y = d.getFullYear() + Math.floor((d.getMonth() + i) / 12), m = (d.getMonth() + i) % 12 + 1, ym = y + "-" + (m < 10 ? "0" : "") + m;
      var dispo = debut ? (ym >= debut && (!fin || ym <= fin)) : parMois(m);
      var li = el("li", dispo ? "on" : null); li.appendChild(el("span", null, MOIS_COURTS[m - 1])); if (m === 1 || i === 0) li.appendChild(el("small", null, String(y)));
      li.setAttribute("aria-label", MOIS_COURTS[m - 1] + " " + y + (dispo ? " : disponible" : ""));
      if (dispo) n++;
      ul.appendChild(li);
    }
    return n ? ul : null;
  }
  function ficheProfil(p, opts) {
    opts = opts || {};
    var f = el("div", "fp theme-sauge"), c = el("div", "cadre");
    f.appendChild(c);
    if (opts.apercu) c.appendChild(el("p", "fp-exemple", "Aperçu : voici votre profil tel que le voient les structures vérifiées et abonnées. Les autres visiteurs n'en voient qu'un résumé, sans contact."));
    var badges = (p.diplomes || []).map(function (x) { return libelle("diplomes", x); });
    if (p.permis_b) badges.push("Permis B");
    (p.qualifications || []).forEach(function (q) { var b = libelle("qualifs", q.q).replace(/ \(.*\)$/, ""); if (badges.indexOf(b) < 0) badges.push(b); });
    if (p.cv_nom) badges.push("CV joint");
    if (p.annee_naissance) badges.unshift(age(p.annee_naissance) + " ans");
    entete(c, { banniere: p.poste_recherche || "", initiale: (p.prenom || "?").charAt(0).toUpperCase(), nom: p.prenom || "Votre prénom",
                sous: [p.poste_recherche, p.ville || nomDep(p.departement)].filter(Boolean).join(" · "), badges: badges });
    var grille = el("div", "fp-grille"), pr = el("div", "fp-principal");
    grille.appendChild(pr); c.appendChild(grille);
    var mob = (p.mobilite || []);
    pr.appendChild(chiffres([
      [p.dispo_debut ? jourMois(p.dispo_debut) : "À voir", p.dispo_debut ? (p.dispo_fin ? "disponible jusqu'au " + dateFr(p.dispo_fin) : "disponible à partir de cette date") : "les dates, avec " + (p.prenom || "le candidat")],
      p.annee_naissance ? [age(p.annee_naissance) + " ans", "né" + "·e en " + p.annee_naissance + (age(p.annee_naissance) >= 18 ? " · majeur·e" : " · mineur·e")]
                        : [String((p.experiences || []).length), (p.experiences || []).length > 1 ? "types d'expérience" : "type d'expérience"],
      [String(mob.length + 1), mob.length ? "zones où travailler" : "zone où travailler"]
    ]));
    var bande = bandeMois(p);
    if (bande) { var sd = bloc("Ses disponibilités sur l'année"); sd.appendChild(bande); pr.appendChild(sd); }
    if ((p.qualifications || []).length) {
      var sq = bloc("Ses qualifications"), ql = el("ul", "fp-qualifs");
      p.qualifications.forEach(function (q) {
        var li = el("li"), perime = q.fin && q.fin < new Date().toISOString().slice(0, 7);
        li.appendChild(icone(IC.badge));
        var t = el("span"); t.appendChild(el("b", null, libelle("qualifs", q.q)));
        t.appendChild(el("small", perime ? "fp-qualif-perime" : null, q.fin ? (perime ? "à renouveler (fin " : "valable jusqu'en ") + moisAnnee(q.fin) + (perime ? ")" : "") : "date de fin non précisée"));
        li.appendChild(t); ql.appendChild(li);
      });
      sq.appendChild(ql); pr.appendChild(sq);
    }
    if ((p.recherche || []).length) {
      var s1 = bloc("Ce que " + (p.prenom || "le candidat") + " cherche"), fo = el("div", "fp-formules");
      p.recherche.forEach(function (r, i) {
        var a = el("article", "fp-formule" + (i === 0 ? " fp-formule-une" : ""));
        if (i === 0) a.appendChild(el("span", "fp-formule-badge", "En priorité"));
        a.appendChild(el("h3", null, libelle("recherche", r)));
        a.appendChild(el("p", "fp-formule-lieu", RECH_DETAIL[r] || ""));
        fo.appendChild(a);
      });
      s1.appendChild(fo);
      if (p.disponibilites) s1.appendChild(el("p", "fp-note", "Disponibilités : " + p.disponibilites));
      pr.appendChild(s1);
    }
    if (p.presentation || p.cv_nom) {
      var s2 = bloc("Présentation");
      if (p.presentation) texteReplie(s2, [p.presentation]);
      if (p.cv_nom) {
        var cv = el("div", "fp-cv"), ic = el("span", "fichier-icone", "PDF"), t = el("span");
        t.appendChild(el("b", null, "Le CV de " + (p.prenom || "ce candidat"))); t.appendChild(el("small", null, p.cv_nom));
        cv.appendChild(ic); cv.appendChild(t);
        if (opts.cvId) {
          var bcv = el("button", "fp-cv-bouton", "Ouvrir le CV"); bcv.type = "button";
          bcv.addEventListener("click", function () { ouvrirCv(opts.cvId); });
          cv.appendChild(bcv);
        }
        s2.appendChild(cv);
      }
      pr.appendChild(s2);
    }
    if ((p.experiences || []).length || (p.activites || []).length) {
      var s3 = bloc("Ce que " + (p.prenom || "le candidat") + " sait faire");
      if ((p.experiences || []).length) { s3.appendChild(el("p", "fp-sous-titre", "Ses expériences")); s3.appendChild(coches(p.experiences.map(function (x) { return libelle("experiences", x); }))); }
      if ((p.activites || []).length) { s3.appendChild(el("p", "fp-sous-titre", "Ses activités et talents")); s3.appendChild(coches(p.activites.map(majuscule).concat(p.permis_b ? ["Permis B"] : []), true)); }
      pr.appendChild(s3);
    }
    if (p.departement) {
      var s4 = bloc("Où " + (p.prenom || "le candidat") + " peut travailler"), ou = el("ul", "fp-ou"), pts = [];
      [p.departement].concat(mob).forEach(function (d, i) {
        var li = el("li");
        li.appendChild(el("b", null, d === "france" ? "Partout en France" : (i === 0 && p.ville ? p.ville : nomDep(d))));
        li.appendChild(el("span", null, d === "france" ? "pour les séjours" : (i === 0 && p.ville ? nomDep(d) + " (" + d + ")" : "département (" + d + ")")));
        ou.appendChild(li);
        if (L.centres[d]) pts.push([L.centres[d][0], L.centres[d][1], nomDep(d), i === 0 ? 1 : 0]);
      });
      s4.appendChild(ou);
      if (pts.length) s4.appendChild(carteOu(pts, "Carte des départements où " + (p.prenom || "le candidat") + " peut travailler"));
      s4.appendChild(el("p", "fp-note", "Points au centre de chaque département, jamais l'adresse. Fond de carte IGN (Géoplateforme)."));
      pr.appendChild(s4);
    }
    if (p.maj_le) pr.appendChild(el("p", "fp-bon", "Profil mis à jour le " + dateFr(p.maj_le) + ". Ces profils vous sont confiés pour recruter, rien d'autre : ne les copiez pas, ne les transmettez pas."));

    var aside = el("aside", "fp-contact");
    contactTete(aside, (p.prenom || "?").charAt(0).toUpperCase(), p.prenom || "Votre prénom", [p.ville, nomDep(p.departement)].filter(Boolean).join(" · "));
    var dispo = el("p", "fp-contact-chiffre");
    if (p.dispo_debut) { dispo.appendChild(document.createTextNode((p.dispo_fin ? "Disponible du " : "Disponible à partir du "))); dispo.appendChild(el("b", null, jourMois(p.dispo_debut))); if (p.dispo_fin) { dispo.appendChild(document.createTextNode(" au ")); dispo.appendChild(el("b", null, jourMois(p.dispo_fin))); } }
    else dispo.textContent = p.disponibilites || "Dates à voir ensemble";
    aside.appendChild(dispo);
    if ((p.diplomes || []).length) {
      var ul = el("ul", "fp-contact-liste");
      p.diplomes.forEach(function (d) { var li = el("li"); li.appendChild(el("span", null, libelle("diplomes", d))); li.appendChild(el("b", null, "✓")); ul.appendChild(li); });
      aside.appendChild(ul);
    }
    if (opts.ecrire && p.email_contact) {
      var a = el("a", "fp-bouton-principal");
      a.href = "mailto:" + encodeURIComponent(p.email_contact).replace(/%40/g, "@") + "?subject=" + encodeURIComponent("Votre profil Fil Roug'Anim : " + structure.nom);
      a.appendChild(icone(IC.lettre)); a.appendChild(document.createTextNode("Écrire à " + p.prenom));
      aside.appendChild(a);
    } else aside.appendChild(el("span", "fp-bouton-principal fp-inerte", "Écrire à " + (p.prenom || "vous")));
    if (opts.favori) aside.appendChild(opts.favori);
    aside.appendChild(el("p", "fp-contact-note", opts.apercu ? "Les structures vérifiées vous écrivent à l'adresse de votre profil ; vous répondez si vous voulez." : "Réservé aux structures vérifiées. Beaucoup de candidats ont 16 ou 17 ans : restez dans le cadre du recrutement."));
    grille.appendChild(aside);
    return f;
  }

  // l'aperçu de la page de la structure, avant la vérification
  function ficheStructure(d) {
    var f = el("div", "fp theme-" + (d.couleur || "rouge")), c = el("div", "cadre");
    f.appendChild(c);
    c.appendChild(el("p", "fp-exemple", "Aperçu : voici votre page telle qu'elle sera en ligne une fois la structure vérifiée."));
    var type = d.type ? libelle("types", d.type) : "Structure d'animation";
    entete(c, { photos: d.photos, logo: d.logo, banniere: type, initiale: initiales(d.nom), nom: d.nom || "Votre structure",
                sous: type + (d.ville ? " à " + d.ville : ""), badges: ["Vérifiée par Fil Roug'Anim"].concat(d.offres.length ? ["Recrute en ce moment"] : []).concat(d.fondatrice ? ["Structure fondatrice"] : []).concat(["Sans commission"]) });
    var grille = el("div", "fp-grille"), pr = el("div", "fp-principal");
    grille.appendChild(pr); c.appendChild(grille);
    pr.appendChild(chiffres([[String(d.offres.length), d.offres.length === 1 ? "offre en ce moment" : "offres en ce moment"],
      [(d.publics || []).length ? libelle("publics", d.publics[0]).replace(" ans", "") + (d.publics.length > 1 ? " et +" : "") : "Tous", (d.publics || []).length ? "ans, les publics" : "les publics"],
      [d.departement || "—", nomDep(d.departement) || "le département"]]));
    var s1 = bloc(d.offres.length ? "Ses offres" : "Pas d'offre en ce moment");
    if (d.offres.length) {
      var fo = el("div", "fp-formules");
      d.offres.slice(0, 6).forEach(function (o, i) {
        var a = el("article", "fp-formule" + (i === 0 && d.offres.length > 1 ? " fp-formule-une" : ""));
        a.appendChild(el("p", "fp-formule-sur", libelle("contrats", o.contrat)));
        var dt = el("p", "fp-formule-date"); dt.appendChild(el("b", null, jourMois(o.debut))); dt.appendChild(document.createTextNode(" " + o.debut.slice(0, 4))); a.appendChild(dt);
        a.appendChild(el("h3", null, o.intitule)); a.appendChild(el("p", "fp-formule-lieu", o.ville + " (" + o.departement + ")"));
        fo.appendChild(a);
      });
      s1.appendChild(fo);
    } else s1.appendChild(el("p", null, "Vos offres en ligne apparaîtront ici, en cartes."));
    pr.appendChild(s1);
    if (d.presentation || d.projet || d.accroche) {
      var s2 = bloc("Présentation");
      if (d.accroche) s2.dataset.accroche = "1";
      var morceaux = [];
      if (d.accroche) morceaux.push(d.accroche);
      if (d.presentation) morceaux.push(d.presentation);
      if (d.projet) { morceaux.push(["h3", "Notre projet"]); morceaux.push(d.projet); }
      texteReplie(s2, morceaux);
      pr.appendChild(s2);
    }
    if (d.avantages || (d.publics || []).length || d.activites.length) {
      var s3 = bloc("Ce que la structure propose");
      if (d.avantages) { s3.appendChild(el("p", "fp-sous-titre", "À l'équipe")); s3.appendChild(coches(d.avantages.split("\n").map(function (x) { return x.trim().replace(/\.$/, ""); }).filter(Boolean))); }
      if ((d.publics || []).length) { s3.appendChild(el("p", "fp-sous-titre", "Aux enfants et aux jeunes")); s3.appendChild(coches(d.publics.map(function (x) { return libelle("publics", x); }), true)); }
      if (d.activites.length) { s3.appendChild(el("p", "fp-sous-titre", "Les activités")); s3.appendChild(coches(d.activites.map(majuscule), true)); }
      pr.appendChild(s3);
    }
    if (d.departement) {
      var s4 = bloc("Où elle accueille"), ou = el("ul", "fp-ou");
      [[d.ville || "Votre ville", type.toLowerCase()], [nomDep(d.departement), "département (" + d.departement + ")"]].forEach(function (x) { var li = el("li"); li.appendChild(el("b", null, x[0])); li.appendChild(el("span", null, x[1])); ou.appendChild(li); });
      s4.appendChild(ou);
      if (L.centres[d.departement]) s4.appendChild(carteOu([[L.centres[d.departement][0], L.centres[d.departement][1], nomDep(d.departement), 1]], "Carte : " + nomDep(d.departement)));
      if (d.lieux) s4.appendChild(el("p", "fp-lieux", d.lieux));
      pr.appendChild(s4);
    }
    var aside = el("aside", "fp-contact");
    contactTete(aside, initiales(d.nom), d.nom || "Votre structure", type + (d.ville ? " · " + d.ville : ""), d.logo);
    aside.appendChild(el("p", "fp-contact-chiffre", d.offres.length ? d.offres.length + (d.offres.length > 1 ? " offres en ce moment" : " offre en ce moment") : "Recrute toute l'année"));
    aside.appendChild(el("span", "fp-bouton-principal fp-inerte", "Postuler avec mon profil"));
    if (d.site) { var s = el("span", "fp-bouton-second fp-inerte", "Le site de la structure"); s.appendChild(el("small", null, d.site.replace(/^https?:\/\//, "").replace(/\/$/, ""))); aside.appendChild(s); }
    aside.appendChild(el("p", "fp-contact-note", "Les candidats postulent avec leur profil (et leur CV) : vous les retrouvez dans « Candidatures reçues »."));
    grille.appendChild(aside);
    return f;
  }

  var dernierFocus = null;
  function ouvrirFiche(fiche) {
    dernierFocus = document.activeElement;
    var cont = $("fiche-contenu");
    cont.textContent = "";
    cont.appendChild(fiche);
    $("fiche-voile").hidden = false;
    document.documentElement.classList.add("fiche-ouverte");
    $("fiche-voile").scrollTop = 0;
    $("fiche-fermer").focus();
    if (window.FicheFRA) window.FicheFRA.preparer(cont);
  }
  function fermerFiche() {
    $("fiche-voile").hidden = true;
    $("fiche-contenu").textContent = "";
    document.documentElement.classList.remove("fiche-ouverte");
    if (dernierFocus) dernierFocus.focus();
  }
  $("fiche-fermer").addEventListener("click", fermerFiche);
  $("fiche-voile").addEventListener("click", function (e) { if (e.target === this) fermerFiche(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("fiche-voile").hidden) fermerFiche(); });

  /* -- un profil de candidat, en ligne dans la liste d'une structure -- */
  var favoris = [];
  function boutonFavori(p, classe) {
    var f = el("button", classe);
    f.type = "button";
    var maj = function () { var oui = favoris.indexOf(p.id) >= 0; f.textContent = oui ? "★ Favori" : "☆ Mettre en favori"; f.setAttribute("aria-pressed", oui); };
    maj();
    f.addEventListener("click", async function () {
      var oui = favoris.indexOf(p.id) >= 0;
      var r = oui ? await sb.from("favoris").delete().eq("profil_id", p.id) : await sb.from("favoris").insert({ profil_id: p.id });
      if (r.error) { message(erreurLisible(r.error), true); return; }
      if (oui) favoris.splice(favoris.indexOf(p.id), 1); else favoris.push(p.id);
      maj(); tableauStructure();
      Array.prototype.forEach.call(document.querySelectorAll('[data-favori="' + p.id + '"]'), function (b) { if (b !== f) b.dispatchEvent(new CustomEvent("maj")); });
    });
    f.setAttribute("data-favori", p.id);
    f.addEventListener("maj", maj);
    return f;
  }
  function carteProfil(p, avecFavori) {
    var c = el("article", "ligne-compte profil-candidat");
    var corps = el("div");
    var tete = el("div", "pc-tete");
    var COUL = ["#3f5b4b", "#a8162a", "#8a5a2b", "#2f6f73", "#5b3f86"];
    var av = el("span", "pc-avatar", (p.prenom || "?").charAt(0).toUpperCase());
    av.style.background = COUL[((p.prenom || "").charCodeAt(0) || 0) % COUL.length];
    tete.appendChild(av);
    var tt = el("div");
    tt.appendChild(el("h3", null, p.prenom + (p.annee_naissance ? ", " + age(p.annee_naissance) + " ans" : "")));
    tt.appendChild(el("p", "pc-lieu", (p.ville ? p.ville + ", " : "") + nomDep(p.departement)));
    tete.appendChild(tt);
    corps.appendChild(tete);
    if (p.poste_recherche) corps.appendChild(el("p", "accroche-profil", p.poste_recherche));
    if (p.diplomes && p.diplomes.length) {
      var ul = el("ul", "pastilles");
      p.diplomes.forEach(function (x) { ul.appendChild(el("li", null, libelle("diplomes", x))); });
      if (p.permis_b) ul.appendChild(el("li", null, "Permis B"));
      if (p.cv_nom) ul.appendChild(el("li", null, "CV joint"));
      corps.appendChild(ul);
    }
    var dispo = [];
    if (p.dispo_debut) dispo.push((p.dispo_fin ? "du " : "à partir du ") + dateFr(p.dispo_debut) + (p.dispo_fin ? " au " + dateFr(p.dispo_fin) : ""));
    if (p.disponibilites) dispo.push(p.disponibilites);
    if (dispo.length) corps.appendChild(el("p", "petit", "Disponible : " + dispo.join(" · ")));
    if (p.recherche && p.recherche.length) corps.appendChild(el("p", "petit", "Cherche : " + p.recherche.map(function (x) { return libelle("recherche", x); }).join(", ")));
    if (p.maj_le) corps.appendChild(el("p", "petit", "Profil mis à jour le " + dateFr(p.maj_le)));
    c.appendChild(corps);
    var actions = el("div", "boutons boutons-colonne");
    var voir = el("button", "bouton-r", "Voir la fiche");
    voir.type = "button";
    voir.addEventListener("click", function () {
      ouvrirFiche(ficheProfil(p, { ecrire: true, cvId: p.cv_nom ? p.id : null, favori: avecFavori && p.id ? boutonFavori(p, "fp-bouton-second") : null }));
    });
    actions.appendChild(voir);
    var a = el("a", "bouton-texte", "Écrire");
    a.href = "mailto:" + encodeURIComponent(p.email_contact).replace(/%40/g, "@") + "?subject=" + encodeURIComponent("Votre profil Fil Roug'Anim : " + structure.nom);
    actions.appendChild(a);
    if (avecFavori && p.id) actions.appendChild(boutonFavori(p, "bouton-texte bouton-favori"));
    c.appendChild(actions);
    return c;
  }

  /* -- candidats (structures vérifiées seulement : la base refuse les autres) -- */
  var CHAMPS_VUS = "id,prenom,departement,ville,poste_recherche,mobilite,diplomes,recherche,experiences,activites,permis_b," +
                   "dispo_debut,dispo_fin,disponibilites,presentation,email_contact,maj_le,cv_nom,annee_naissance,qualifications";
  async function chargerCandidats() {
    var f = $("f-candidats");
    var fav = await sb.from("favoris").select("profil_id");
    favoris = (fav.data || []).map(function (x) { return x.profil_id; });
    var q = sb.from("profils").select(CHAMPS_VUS).eq("publie", true).order("maj_le", { ascending: false }).limit(100);
    if (f.dep.value) q = q.or("departement.eq." + f.dep.value + ",mobilite.cs.{" + f.dep.value + "}");
    if (f.diplome.value) q = q.contains("diplomes", [f.diplome.value]);
    if (f.cherche.value) q = q.contains("recherche", [f.cherche.value]);
    if (f.favoris.checked) q = q.in("id", favoris.length ? favoris : ["00000000-0000-0000-0000-000000000000"]);
    var r = await q;
    var liste = $("liste-candidats");
    liste.textContent = "";
    if (r.error) { liste.appendChild(el("p", "aucune", erreurLisible(r.error))); return; }
    $("compte-candidats").textContent = r.data.length ? r.data.length + " profil" + (r.data.length > 1 ? "s" : "") + (r.data.length === 100 ? " (les 100 plus récents)" : "") : "";
    if (!r.data.length) { liste.appendChild(el("p", "aucune", f.favoris.checked ? "Aucun favori pour l'instant : cliquez sur « Mettre en favori » sous un profil." : "Aucun profil ne correspond pour l'instant.")); return; }
    r.data.forEach(function (p) { liste.appendChild(carteProfil(p, true)); });
    tableauStructure();
  }

  /* -- candidatures reçues par la structure -- */
  var STATUTS = [["envoyee", "Nouvelle"], ["vue", "Vue"], ["retenue", "Retenue"], ["non-retenue", "Non retenue"]];
  var recues = [];
  async function chargerCandidaturesRecues() {
    var ids = mesOffres.map(function (o) { return o.id; });
    var blocR = $("bloc-candidatures-recues"), liste = $("liste-candidatures-recues");
    if (!ids.length) { blocR.hidden = true; recues = []; return; }
    if (actif(structure) && !favoris.length) {
      var fav = await sb.from("favoris").select("profil_id");
      favoris = (fav.data || []).map(function (x) { return x.profil_id; });
    }
    var r = await sb.from("candidatures").select("id,offre_id,message,statut,cree_le,profils(" + CHAMPS_VUS + ")")
      .in("offre_id", ids).order("cree_le", { ascending: false });
    recues = r.data || [];
    blocR.hidden = false;
    liste.textContent = "";
    if (r.error) { liste.appendChild(el("p", "aucune", erreurLisible(r.error))); return; }
    if (!recues.length) { liste.appendChild(el("p", "aucune", "Pas encore de candidature. Elles arrivent ici dès qu'un candidat postule à l'une de vos offres en ligne.")); return; }
    recues.forEach(function (c) {
      var offre = mesOffres.filter(function (o) { return o.id === c.offre_id; })[0];
      var bloc1 = el("div", "candidature");
      var tete = el("div", "candidature-tete");
      tete.appendChild(el("p", null, "Pour « " + (offre ? offre.intitule : "offre supprimée") + " », le " + dateFr(c.cree_le)));
      var sel = el("select", "statut-select");
      sel.setAttribute("aria-label", "Statut de la candidature");
      STATUTS.forEach(function (st) { var o = el("option", null, st[1]); o.value = st[0]; sel.appendChild(o); });
      sel.value = c.statut;
      sel.addEventListener("change", async function () {
        var u = await sb.from("candidatures").update({ statut: sel.value }).eq("id", c.id);
        if (u.error) message(erreurLisible(u.error), true); else { c.statut = sel.value; tableauStructure(); }
      });
      tete.appendChild(sel);
      bloc1.appendChild(tete);
      if (c.message) bloc1.appendChild(el("p", "presentation message-candidat", "« " + c.message + " »"));
      if (c.profils) bloc1.appendChild(carteProfil(c.profils, actif(structure)));
      liste.appendChild(bloc1);
      if (c.statut === "envoyee") {
        // ouverte par la structure : le candidat voit « vue »
        sb.from("candidatures").update({ statut: "vue" }).eq("id", c.id).then(function () { c.statut = "vue"; });
      }
    });
  }

  /* -- tableaux de bord -- */
  function tuile(conteneur, chiffre, texte, cible) {
    var a = el("a", "tuile");
    a.href = "#" + cible;
    a.appendChild(el("b", null, String(chiffre)));
    a.appendChild(el("span", null, texte));
    conteneur.appendChild(a);
  }
  var tableauEnCours = false;
  async function tableauStructure() {
    if (!structure || tableauEnCours) return;
    tableauEnCours = true;
    if (!recues.length && mesOffres.length && !tableauStructure.fait) { tableauStructure.fait = true; await chargerCandidaturesRecues(); }
    var t = $("tuiles-structure");
    t.textContent = "";
    var enLigne = mesOffres.filter(function (o) { return o.publiee && o.expire_le >= aujourdhui(); }).length;
    var nouvelles = recues.filter(function (c) { return c.statut === "envoyee"; }).length;
    tuile(t, enLigne, enLigne > 1 ? "offres en ligne" : "offre en ligne", "bloc-offres");
    tuile(t, recues.length, (recues.length > 1 ? "candidatures" : "candidature") + (nouvelles ? " dont " + nouvelles + " nouvelle" + (nouvelles > 1 ? "s" : "") : ""), "bloc-candidatures-recues");
    if (actif(structure)) tuile(t, demandesRecues.length, demandesRecues.length > 1 ? "demandes reçues" : "demande reçue", "bloc-demandes-recues");
    if (actif(structure)) tuile(t, favoris.length, favoris.length > 1 ? "favoris" : "favori", "bloc-candidats");
    tableauEnCours = false;
    pastille("offres", enLigne);
    pastille("candidats", nouvelles);
    pastille("demandes", demandesRecues.length);
    pastille("abonnement", !paye(structure));
    majVide("v-structure");
    apercuStructure();
    try { majEntete("v-structure"); } catch (err) {}
  }


  /* -- le tableau de bord de la structure : vues, clics, offres les plus vues, secteur, conseils -- */
  var tbJours = 30;
  Array.prototype.forEach.call(document.querySelectorAll("#bloc-tableau [data-jours]"), function (b) {
    b.addEventListener("click", function () {
      tbJours = parseInt(b.dataset.jours, 10);
      Array.prototype.forEach.call(document.querySelectorAll("#bloc-tableau [data-jours]"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      tableauDeBord();
    });
  });
  function jourIso(d) { return d.toISOString().slice(0, 10); }
  async function tableauDeBord() {
    if (!structure) return;
    var J = tbJours, auj = new Date(aujourdhui() + "T12:00:00");
    var debut = new Date(auj); debut.setDate(debut.getDate() - J + 1);
    var avant = new Date(debut); avant.setDate(avant.getDate() - J);
    var r = await sb.rpc("mes_stats", { jours: J * 2 });
    var lignes = (r && r.data) || [];
    var d0 = jourIso(debut), dA = jourIso(avant);
    function somme(types, depuis, jusque) {
      return lignes.filter(function (l) { return types.indexOf(l.type) >= 0 && l.jour >= depuis && (!jusque || l.jour < jusque); })
        .reduce(function (a, l) { return a + l.n; }, 0);
    }
    var CH = [["page", ["page"], "vues de votre page"], ["offre", ["offre"], "vues de vos offres"],
              ["postuler", ["clic_candidater", "clic_email"], "clics pour postuler"], ["site", ["clic_site"], "clics vers votre site"]];
    var box = $("tb-chiffres"); box.textContent = "";
    CH.forEach(function (c) {
      var n = somme(c[1], d0), p = somme(c[1], dA, d0);
      var t = el("div", "tb-chiffre");
      t.appendChild(el("b", null, n.toLocaleString("fr-FR")));
      t.appendChild(el("span", null, c[2]));
      if (p || n) {
        var ev = p ? Math.round((n - p) / p * 100) : null;
        t.appendChild(el("small", ev === null ? "tb-neutre" : ev >= 0 ? "tb-hausse" : "tb-baisse", ev === null ? "nouveau" : (ev >= 0 ? "+" : "") + ev + " % sur la période d'avant"));
      }
      box.appendChild(t);
    });
    // le graphe, jour par jour
    var g = $("tb-graphe"); g.textContent = "";
    var parJour = {}, max = 0;
    lignes.forEach(function (l) { if ((l.type === "page" || l.type === "offre") && l.jour >= d0) parJour[l.jour] = (parJour[l.jour] || 0) + l.n; });
    for (var i = 0; i < J; i++) { var d = new Date(debut); d.setDate(d.getDate() + i); max = Math.max(max, parJour[jourIso(d)] || 0); }
    for (i = 0; i < J; i++) {
      var dd = new Date(debut); dd.setDate(dd.getDate() + i);
      var v = parJour[jourIso(dd)] || 0, barre = el("span", "tb-barre");
      barre.style.height = (max ? Math.max(3, Math.round(v / max * 100)) : 3) + "%";
      barre.title = dd.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " : " + v + " vue" + (v > 1 ? "s" : "");
      if (!v) barre.classList.add("tb-zero");
      g.appendChild(barre);
    }
    g.setAttribute("aria-label", "Vues par jour sur " + J + " jours : " + somme(["page", "offre"], d0) + " au total");
    var enLigne = actif(structure);
    $("tb-sous").textContent = enLigne ? "Les vues de votre page et de vos offres, et les clics des candidats, sur " + J + " jours." :
      "Les chiffres commencent dès que votre page est en ligne (abonnement réglé et structure vérifiée).";
    // les offres les plus vues
    var ol = $("tb-offres"); ol.textContent = "";
    var vuesOffre = {};
    lignes.forEach(function (l) { if (l.type === "offre" && l.jour >= d0) vuesOffre[l.offre_id] = (vuesOffre[l.offre_id] || 0) + l.n; });
    var classees = mesOffres.map(function (o) { return { o: o, n: vuesOffre[o.id] || 0 }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
    if (!classees.length) ol.appendChild(el("li", "tb-vide", "Pas encore d'offre : publiez-en une pour la voir ici."));
    classees.forEach(function (x) { var li = el("li"); li.appendChild(el("span", null, x.o.intitule)); li.appendChild(el("b", null, x.n + " vue" + (x.n > 1 ? "s" : ""))); ol.appendChild(li); });
    // le secteur : les animateurs inscrits dans le département
    var sec = $("tb-secteur"); sec.textContent = "";
    var rp = await sb.rpc("profils_resume", { dep: structure.departement, n: 100 });
    var nb = ((rp && rp.data) || []).length;
    var p1 = el("p"); p1.appendChild(el("b", null, nb + (nb === 100 ? "+" : ""))); p1.appendChild(el("span", null, " animateur" + (nb > 1 ? "s" : "") + " dans votre département ou prêt" + (nb > 1 ? "s" : "") + " à y travailler"));
    sec.appendChild(p1);
    var p2 = el("p"); p2.appendChild(el("b", null, String(demandesRecues.length))); p2.appendChild(el("span", null, " demande" + (demandesRecues.length > 1 ? "s" : "") + " de l'annuaire inversé reçue" + (demandesRecues.length > 1 ? "s" : "")));
    sec.appendChild(p2);
    if (enLigne) { var a = el("a", "bouton-texte", "Voir les profils"); a.href = "#bloc-candidats"; sec.appendChild(a); }
    conseilsStructure();
  }
  function conseilsStructure() {
    var ul = $("tb-conseils"); ul.textContent = "";
    var st = structure, ok = 0, tout = 0;
    function conseil(fait, texte, cible, lienTexte) {
      tout++; if (fait) ok++;
      var li = el("li", fait ? "tb-fait" : "tb-a-faire");
      li.appendChild(el("span", null, texte));
      if (!fait && cible) { var a = el("a", null, lienTexte || "Le faire"); a.href = cible; if (/^http|^\//.test(cible)) { a.target = "_blank"; a.rel = "noopener"; } li.appendChild(a); }
      ul.appendChild(li);
    }
    var enLigne = mesOffres.filter(function (o) { return o.publiee && o.expire_le >= aujourdhui(); });
    var bientot = enLigne.filter(function (o) { return (new Date(o.expire_le) - new Date(aujourdhui())) / 864e5 <= 7; });
    conseil(!!st.logo, "Ajoutez votre logo : votre carte se reconnaît dans la liste.", "#bloc-structure");
    conseil((st.photos || []).length >= 3, "Mettez au moins 3 photos (locaux, activités, équipe) : les jeunes veulent voir où ils vont.", "#bloc-structure");
    conseil(!!(st.projet && st.projet.length > 80), "Racontez votre projet en quelques lignes : c'est ce qui vous distingue.", "#bloc-structure");
    conseil(!!st.avantages, "Listez ce que vous offrez (préparation payée, repas, BAFA financé…).", "#bloc-structure");
    conseil(enLigne.length > 0, "Publiez au moins une offre : elle apparaît sur la page des offres et sur votre page.", "#bloc-offres", "Publier une offre");
    conseil(!enLigne.some(function (o) { return !o.remuneration_montant; }), "Indiquez la rémunération dans chaque offre : c'est la première question des candidats.", "#bloc-offres", "Compléter mes offres");
    conseil(!bientot.length, bientot.length ? "Une offre expire dans moins de 7 jours : prolongez-la si vous recrutez encore." : "Vos offres ne sont pas sur le point d'expirer.", "#bloc-offres", "Voir mes offres");
    if (demandesRecues.length) conseil(false, "Répondez aux demandes de l'annuaire inversé : chacune n'est envoyée qu'à 3 structures.", "#bloc-demandes-recues", "Voir les demandes");
    $("tb-score").textContent = ok + " sur " + tout;
    // le conseil du moment, selon le mois et le type de structure
    var m = new Date().getMonth() + 1, type = st.type || "";
    var saison = m >= 2 && m <= 4 ? ["C'est le moment de publier vos offres d'été : les animateurs signent au printemps.", "#guide-reussir-son-recrutement"]
      : m === 5 || m === 6 ? [type === "periscolaire" ? "Recrutez maintenant votre équipe périscolaire de la rentrée." : "Bouclez l'équipe d'été et pensez déjà au périscolaire de la rentrée.", "#guide-reussir-son-recrutement"]
      : m === 7 || m === 8 ? ["Faites le bilan avec chaque animateur et reproposez dès maintenant un poste pour l'été prochain.", "#guide-reussir-son-recrutement"]
      : m === 9 ? ["Faites le point sur les aides de l'année avec votre conseiller CAF et votre SDJES.", "#guide-aides-pour-recruter"]
      : m === 10 || m === 11 ? ["Publiez vos offres pour les vacances d'hiver, et pensez à un apprenti BPJEPS pour l'an prochain.", "#guide-recruter-un-apprenti"]
      : ["Préparez les vacances de printemps, et accueillez les stagiaires BAFA qui sortent de formation générale.", "#guide-accueillir-un-stagiaire-bafa"];
    if (type === "sejours" && m >= 1 && m <= 4) saison = ["Séjours d'été : cherchez vos surveillants de baignade dès maintenant, ils partent vite.", "#guide-reussir-son-recrutement"];
    var li = el("li", "tb-moment"); li.appendChild(el("span", null, "Ce mois-ci : " + saison[0]));
    var a = el("a", null, "Le guide"); a.href = saison[1]; li.appendChild(a);
    ul.insertBefore(li, ul.firstChild);
  }


  /* -- les ressources des structures abonnées (guides, conseils) : seulement dans la base, que la base
        ne donne qu'au compte d'une structure à l'abonnement en cours ; les outils s'ouvrent ici, en fenêtre -- */
  var ressources = null;
  async function chargerRessources() {
    var r = await sb.from("ressources_structures").select("slug,type,titre,court,resume,html,ordre,maj").order("ordre");
    ressources = r.error ? [] : (r.data || []);
    var conseils = ressources.filter(function (x) { return x.type === "conseil"; });
    var ol = $("liste-conseils"); ol.textContent = "";
    if (conseils.length) {
      var semaine = Math.floor(Date.now() / (7 * 864e5)) % conseils.length;
      conseils.slice(semaine).concat(conseils.slice(0, semaine)).forEach(function (c, k) {
        var li = el("li", k === 0 ? "co-c-semaine" : null); li.appendChild(el("b", null, c.titre)); li.appendChild(el("span", null, c.html)); ol.appendChild(li);
      });
    }
    $("bloc-conseils").hidden = !conseils.length;
    var ul = $("liste-guides"); ul.textContent = "";
    ressources.filter(function (x) { return x.type === "guide"; }).forEach(function (g) {
      var li = el("li"), a = el("a"); a.href = "#guide-" + g.slug;
      var t = el("span", "bo-t"); t.appendChild(el("b", null, g.court || g.titre)); t.appendChild(el("span", null, g.resume || "")); a.appendChild(t);
      a.appendChild(el("span", "bo-go", "→")); li.appendChild(a); ul.appendChild(li);
    });
    if (!ul.children.length) ul.appendChild(el("li", "tb-vide", r.error ? "Les guides n'ont pas pu être chargés : réessayez dans un instant." : "Les guides arrivent bientôt."));
  }
  function ouvrirGuide(slug) {
    var g = (ressources || []).filter(function (x) { return x.type === "guide" && x.slug === slug; })[0];
    if (!g) { allerA("bloc-outils"); return; }
    var art = el("article", "co-guide texte");
    art.appendChild(el("p", "co-e-sur", "Guide · réservé aux structures abonnées"));
    art.appendChild(el("h1", null, g.titre));
    if (g.maj) art.appendChild(el("p", "petit", "Mis à jour le " + dateFr(g.maj)));
    var corps = el("div"); corps.innerHTML = g.html;   // écrit par Fil Roug'Anim dans la base, que personne d'autre ne peut modifier
    Array.prototype.forEach.call(corps.querySelectorAll('a[href^="/"], a[href^="http"]'), function (a) { a.target = "_blank"; a.rel = "noopener"; });
    art.appendChild(corps);
    ouvrirFiche(art);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#guide-"], a[href^="#outil-"]');
    if (!a) return;
    e.preventDefault();
    var h = a.getAttribute("href").slice(1);
    if (!structure || !paye(structure)) { allerA("bloc-outils-verrou"); return; }
    if (h.indexOf("guide-") === 0) ouvrirGuide(h.slice(6)); else ouvrirOutil(h.slice(6));
  });
  function ouvrirOutil(nom) {
    var smic = 12.31, coef = 4.30, minimum = Math.round(smic * coef * 100) / 100;
    var euros = function (x) { return x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; };
    var art = el("article", "co-outil");
    art.appendChild(el("p", "co-e-sur", "Outil · réservé aux structures abonnées"));
    var f = el("form", "formulaire"), res = el("div", "carte-compte resultat"); res.setAttribute("aria-live", "polite");
    f.addEventListener("submit", function (e) { e.preventDefault(); });
    function champ(lib, nom2, type, val, opts) {
      var l = el("label", "champ" + (opts && opts.large ? " champ-large" : "")); l.appendChild(el("span", null, lib));
      var i;
      if (type === "select") { i = el("select"); opts.liste.forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; i.appendChild(op); }); }
      else if (type === "textarea") { i = el("textarea"); i.rows = 3; }
      else { i = el("input"); i.type = type; if (type === "number") { i.min = "0"; i.step = "any"; i.inputMode = "decimal"; } }
      i.name = nom2; if (val != null) i.value = val; if (opts && opts.ph) i.placeholder = opts.ph;
      l.appendChild(i); return l;
    }
    function n(k) { var v = parseFloat(String(f.elements[k].value).replace(",", ".")); return isNaN(v) || v < 0 ? 0 : v; }
    var g2 = el("div", "champs-2");
    if (nom === "annonce") {
      art.appendChild(el("h1", null, "Écrire son annonce"));
      art.appendChild(el("p", "petit", "Remplissez les cases : l'annonce s'écrit dans l'ordre où les jeunes la lisent. Copiez-la, puis publiez-la dans « Mes offres »."));
      g2.appendChild(champ("Le poste", "poste", "select", null, { liste: [["Animateur ou animatrice BAFA", "Animateur BAFA"], ["Animateur ou animatrice stagiaire BAFA", "Stagiaire BAFA"], ["Directeur ou directrice adjoint(e)", "Directeur adjoint"], ["Directeur ou directrice", "Directeur"], ["Surveillant ou surveillante de baignade", "Surveillant de baignade"], ["Animateur ou animatrice périscolaire", "Animateur périscolaire"]] }));
      g2.appendChild(champ("Votre structure", "structure", "text", structure && structure.nom));
      g2.appendChild(champ("Ville", "ville", "text", structure && structure.ville));
      g2.appendChild(champ("Type d'accueil", "accueil", "select", null, { liste: [["un accueil de loisirs", "Accueil de loisirs"], ["un séjour de vacances", "Séjour de vacances"], ["un accueil périscolaire", "Périscolaire"], ["des mini-camps", "Mini-camps"]] }));
      g2.appendChild(champ("Du", "debut", "date")); g2.appendChild(champ("Au", "fin", "date"));
      g2.appendChild(champ("Âge des enfants", "public", "text", null, { ph: "6-11 ans" })); g2.appendChild(champ("Taille du groupe", "groupe", "text", null, { ph: "40 enfants" }));
      g2.appendChild(champ("Contrat", "contrat", "select", null, { liste: [["contrat d'engagement éducatif (CEE)", "CEE"], ["CDD", "CDD"], ["CDI", "CDI"], ["bénévolat (stage BAFA)", "Bénévole"]] }));
      g2.appendChild(champ("Brut par jour (€)", "brut", "number"));
      g2.appendChild(champ("Votre projet en 2 ou 3 phrases", "projet", "textarea", structure && structure.projet, { large: true }));
      g2.appendChild(champ("Ce que vous offrez (une idée par ligne)", "offre", "textarea", structure && structure.avantages, { large: true }));
      g2.appendChild(champ("Pour candidater", "contact", "text", structure && structure.email_contact, { large: true }));
    } else {
      art.appendChild(el("h1", null, "Budget de l'équipe"));
      art.appendChild(el("p", "petit", "Le coût brut de l'équipe d'animation d'une période en contrat d'engagement éducatif, poste par poste. Ajoutez les cotisations patronales."));
      [["Jours d'accueil", "jours", 20], ["Jours de préparation payés", "prepa", 1], ["Animateurs diplômés", "anim", 4], ["Brut par jour, animateur (€)", "b_anim", 60],
       ["Stagiaires BAFA", "stag", 2], ["Brut par jour, stagiaire (€)", "b_stag", minimum], ["Direction", "dir", 1], ["Brut par jour, direction (€)", "b_dir", 85]].forEach(function (c) { g2.appendChild(champ(c[0], c[1], "number", c[2])); });
    }
    f.appendChild(g2); art.appendChild(f); art.appendChild(res);
    function calcul() {
      res.textContent = "";
      if (nom === "annonce") {
        var v = function (k) { return (f.elements[k].value || "").trim(); };
        var jr = function (d) { return d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""; };
        var l = [(v("poste") + (v("ville") ? " à " + v("ville") : "")).toUpperCase()];
        if (v("debut")) l.push(v("fin") ? "Du " + jr(v("debut")) + " au " + jr(v("fin")) : "À partir du " + jr(v("debut")));
        l.push("");
        var qui = (v("structure") || "Notre structure") + " recrute pour " + f.elements.accueil.value + (v("ville") ? " à " + v("ville") : "") + ".";
        if (v("public") || v("groupe")) qui += " Vous accompagnerez " + [v("groupe"), v("public") ? "de " + v("public") : ""].filter(Boolean).join(" ") + ".";
        l.push(qui);
        if (v("projet")) { l.push(""); l.push(v("projet")); }
        l.push(""); l.push("Contrat : " + f.elements.contrat.value + (n("brut") ? ", " + euros(n("brut")) + " brut par jour" : "") + ".");
        var offres = v("offre").split(/\n+/).map(function (x) { return x.replace(/^[-•\s]+/, "").trim(); }).filter(Boolean);
        if (offres.length) { l.push(""); l.push("Ce que nous offrons :"); offres.forEach(function (o) { l.push("- " + o); }); }
        l.push(""); l.push("Pour candidater : " + (v("contact") || "écrivez-nous en quelques lignes, avec vos disponibilités") + ".");
        var texte = l.join("\n"), manque = [];
        if (!v("debut")) manque.push("les dates"); if (!v("ville")) manque.push("la ville"); if (!v("public")) manque.push("l'âge des enfants");
        if (!n("brut") && f.elements.contrat.value.indexOf("bénévolat") < 0) manque.push("la rémunération"); if (!v("projet")) manque.push("votre projet"); if (!v("contact")) manque.push("comment candidater");
        var p = el("p", "grand-chiffre"); p.appendChild(el("b", null, (6 - manque.length) + "/6")); p.appendChild(el("span", null, manque.length ? "il manque : " + manque.join(", ") : "votre annonce répond à toutes les questions des candidats")); res.appendChild(p);
        if (n("brut") && f.elements.contrat.value.indexOf("CEE") >= 0 && n("brut") < minimum) res.appendChild(el("p", "alerte", "Attention : en CEE, le minimum légal est de " + euros(minimum) + " brut par jour."));
        var pre = el("pre", "annonce-texte", texte); res.appendChild(pre);
        var b = el("button", "bouton-r", "Copier l'annonce"); b.type = "button";
        b.addEventListener("click", function () { if (navigator.clipboard) navigator.clipboard.writeText(texte).then(function () { b.textContent = "Copiée !"; setTimeout(function () { b.textContent = "Copier l'annonce"; }, 1800); }); });
        res.appendChild(b);
      } else {
        var jours = Math.floor(n("jours")) + Math.floor(n("prepa")), total = 0, ul = el("ul", "etapes-dates");
        [["anim", "b_anim", "animateur"], ["stag", "b_stag", "stagiaire"], ["dir", "b_dir", "personne de direction"]].forEach(function (p2) {
          var nb = Math.floor(n(p2[0])), b2 = n(p2[1]); if (!nb) return;
          var sous = nb * jours * b2; total += sous;
          ul.appendChild(el("li", b2 < minimum ? "alerte" : "fait", nb + " " + p2[2] + (nb > 1 ? "s" : "") + " × " + jours + " jours × " + euros(b2) + " = " + euros(sous) + (b2 < minimum ? " (sous le minimum légal de " + euros(minimum) + ")" : "")));
        });
        var p3 = el("p", "grand-chiffre"); p3.appendChild(el("b", null, euros(total))); p3.appendChild(el("span", null, "brut pour l'équipe, soit " + euros(total / Math.max(1, Math.floor(n("jours")))) + " par jour d'accueil")); res.appendChild(p3);
        res.appendChild(ul);
        if (jours > 80) res.appendChild(el("p", "alerte", "Plus de 80 jours : c'est au-delà du plafond du CEE sur 12 mois."));
      }
    }
    f.addEventListener("input", calcul); f.addEventListener("change", calcul);
    calcul();
    ouvrirFiche(art);
  }

  /* -- l'annuaire inversé : les demandes du candidat, et celles que reçoit la structure -- */
  var POSTES_D = { "animateur-stagiaire": "Stage pratique BAFA", "animateur": "Animateur ou animatrice", "directeur": "Direction ou adjoint",
                   "surveillant-baignade": "Surveillance de baignade", "directeur-adjoint": "Direction adjointe", "autre": "Autre poste" };
  var PERIODES_D = { "ete": "l'été", "petites-vacances": "les petites vacances", "mercredis": "les mercredis", "periscolaire": "le périscolaire", "annee": "toute l'année" };
  function resumeDemande(d) {
    var q = (d.periodes || []).map(function (x) { return PERIODES_D[x] || x; });
    if (d.dispo_debut) q.push((d.dispo_fin ? "du " : "dès le ") + dateFr(d.dispo_debut, false) + (d.dispo_fin ? " au " + dateFr(d.dispo_fin, false) : ""));
    return (d.ville ? d.ville + ", " : "") + nomDep(d.departement) + (d.partout ? " · partout en France" : (d.zone || []).length > 1 ? " · toute la région" : "") +
      (q.length ? " · " + q.join(", ") : "");
  }
  async function mesDemandes() {
    var r = await sb.from("demandes").select("id,poste,departement,ville,zone,partout,periodes,dispo_debut,dispo_fin,destinataires,cree_le").order("cree_le", { ascending: false });
    var liste = $("liste-mes-demandes"); liste.textContent = "";
    var d = r.data || [];
    $("bloc-mes-demandes").hidden = false;
    if (r.error || !d.length) { liste.appendChild(el("p", "aucune", r.error ? erreurLisible(r.error) : "Pas encore de demande. Décrivez le poste que vous cherchez : ça prend une minute.")); return d; }
    d.forEach(function (x) {
      var item = el("article", "ligne-compte"), corps = el("div");
      corps.appendChild(el("h3", null, POSTES_D[x.poste] || x.poste));
      corps.appendChild(el("p", "petit", resumeDemande(x) + " · envoyée le " + dateFr(x.cree_le)));
      var nb = (x.destinataires || []).length;
      corps.appendChild(el("p", nb ? "etat etat-ok" : "etat etat-attente", nb ? "Reçue par " + nb + (nb > 1 ? " structures" : " structure") + " : elles vous répondent par e-mail" : "En attente d'une structure dans votre secteur (30 jours au plus)"));
      item.appendChild(corps);
      var b = el("button", "bouton-texte", "Retirer"); b.type = "button";
      b.addEventListener("click", async function () {
        if (!confirm("Retirer cette demande ? Les structures ne la verront plus.")) return;
        var x2 = await sb.from("demandes").delete().eq("id", x.id);
        if (x2.error) message(erreurLisible(x2.error), true); else { message("Demande retirée."); mesDemandes(); }
      });
      item.appendChild(b);
      liste.appendChild(item);
    });
    return d;
  }
  var demandesRecues = [];
  async function chargerDemandesRecues() {
    var blocD = $("bloc-demandes-recues");
    if (!actif(structure)) { blocD.hidden = true; return; }
    var r = await sb.from("demandes").select("id,prenom,annee_naissance,poste,departement,ville,zone,partout,periodes,dispo_debut,dispo_fin,diplomes,experiences,message,email_contact,cree_le")
      .contains("destinataires", [utilisateur.id]).order("cree_le", { ascending: false }).limit(50);
    demandesRecues = r.data || [];
    blocD.hidden = false;
    var liste = $("liste-demandes-recues"); liste.textContent = "";
    if (r.error) { liste.appendChild(el("p", "aucune", erreurLisible(r.error))); return; }
    if (!demandesRecues.length) { liste.appendChild(el("p", "aucune", "Pas encore de demande. Elles arrivent ici, et par e-mail, dès qu'un candidat de votre secteur décrit le poste qu'il cherche.")); return; }
    demandesRecues.forEach(function (x) {
      var item = el("article", "ligne-compte"), corps = el("div");
      corps.appendChild(el("h3", null, (POSTES_D[x.poste] || x.poste) + " · " + x.prenom + (x.annee_naissance ? ", " + age(x.annee_naissance) + " ans" : "")));
      corps.appendChild(el("p", "petit", resumeDemande(x) + " · le " + dateFr(x.cree_le)));
      if ((x.diplomes || []).length) {
        var ul = el("ul", "pastilles");
        x.diplomes.forEach(function (y) { ul.appendChild(el("li", null, libelle("diplomes", y))); });
        corps.appendChild(ul);
      }
      if ((x.experiences || []).length) corps.appendChild(el("p", "petit", "Expérience : " + x.experiences.map(function (y) { return libelle("experiences", y); }).join(", ")));
      if (x.message) corps.appendChild(el("p", "presentation message-candidat", "« " + x.message + " »"));
      item.appendChild(corps);
      var a = el("a", "bouton-r", "Répondre");
      a.href = "mailto:" + encodeURIComponent(x.email_contact).replace(/%40/g, "@") + "?subject=" + encodeURIComponent("Votre demande sur Fil Roug'Anim : " + structure.nom);
      item.appendChild(a);
      liste.appendChild(item);
    });
  }

  /* -- espace candidat : candidatures, offres pour toi -- */
  var mesCandidatures = [];
  async function tableauCandidat() {
    var deps = [profil.departement].concat(profil.mobilite || []).filter(function (d) { return d !== "france"; });
    var rep = await Promise.all([
      sb.from("candidatures").select("id,offre_id,statut,cree_le,offres(intitule,ville,departement,debut,structures(nom))").order("cree_le", { ascending: false }),
      sb.from("offres").select("id,intitule,ville,departement,debut,fin,contrat,poste,structures(nom)").in("departement", deps).order("debut").limit(30)
    ]);
    mesCandidatures = rep[0].data || [];
    var offres = rep[1].data || [];
    var t = $("tuiles-candidat");
    t.textContent = "";
    tuile(t, mesCandidatures.length, mesCandidatures.length > 1 ? "candidatures" : "candidature", "bloc-mes-candidatures");
    tuile(t, offres.length, offres.length > 1 ? "offres pour vous" : "offre pour vous", "bloc-offres-pour-toi");
    var vis = el("a", "tuile");
    vis.href = "#bloc-profil";
    vis.appendChild(el("b", null, profil.publie ? "Visible" : "Caché"));
    vis.appendChild(el("span", null, profil.publie ? "votre profil, pour les structures vérifiées" : "votre profil : les structures ne le voient pas"));
    t.appendChild(vis);

    var l1 = $("liste-mes-candidatures");
    l1.textContent = "";
    if (!mesCandidatures.length) l1.appendChild(el("p", "aucune", "Pas encore de candidature. Choisissez une offre ci-dessous et postulez avec votre profil."));
    mesCandidatures.forEach(function (c) {
      var o = c.offres || {};
      var item = el("article", "ligne-compte");
      var corps = el("div");
      corps.appendChild(el("h3", null, o.intitule || "Offre retirée"));
      corps.appendChild(el("p", "petit", ((o.structures && o.structures.nom) || "") + (o.ville ? " · " + o.ville : "") + " · envoyée le " + dateFr(c.cree_le)));
      var etats = { envoyee: ["Envoyée", "etat etat-attente"], vue: ["Vue par la structure", "etat etat-attente"], retenue: ["Retenue : la structure va vous contacter", "etat etat-ok"], "non-retenue": ["Non retenue", "etat etat-off"] };
      corps.appendChild(el("p", etats[c.statut][1], etats[c.statut][0]));
      item.appendChild(corps);
      var b = el("button", "bouton-texte", "Retirer");
      b.type = "button";
      b.addEventListener("click", async function () {
        if (!confirm("Retirer cette candidature ?")) return;
        var d = await sb.from("candidatures").delete().eq("id", c.id);
        if (d.error) message(erreurLisible(d.error), true); else { message("Candidature retirée."); tableauCandidat(); }
      });
      item.appendChild(b);
      l1.appendChild(item);
    });

    var l2 = $("liste-offres-pour-toi");
    l2.textContent = "";
    if (!offres.length) l2.appendChild(el("p", "aucune", "Pas d'offre en ligne dans votre secteur pour l'instant. Les structures recrutent souvent dès l'hiver pour l'été : revenez bientôt."));
    offres.forEach(function (o) {
      var deja = mesCandidatures.some(function (c) { return c.offre_id === o.id; });
      var item = el("article", "ligne-compte");
      var corps = el("div");
      var titre = el("h3");
      var a = el("a", null, o.intitule);
      a.href = L.lien_offre + o.id + "/";
      titre.appendChild(a);
      corps.appendChild(titre);
      corps.appendChild(el("p", "petit", ((o.structures && o.structures.nom) || "") + " · " + o.ville + " (" + o.departement + ") · à partir du " + dateFr(o.debut) + " · " + libelle("contrats", o.contrat)));
      item.appendChild(corps);
      if (deja) item.appendChild(el("p", "etat etat-ok", "Candidature envoyée"));
      else {
        var b = el("button", "bouton-r", "Postuler");
        b.type = "button";
        b.addEventListener("click", function () { ouvrirPostuler(o.id); });
        item.appendChild(b);
      }
      l2.appendChild(item);
    });
    try { majEntete("v-candidat"); } catch (err) {}
  }

  var offreVisee = null;
  async function ouvrirPostuler(id) {
    var r = await sb.from("offres").select("id,intitule,ville,departement,debut,contrat,structures(nom)").eq("id", id).maybeSingle();
    if (r.error || !r.data) { message("Cette offre n'est plus en ligne.", true); return; }
    if (mesCandidatures.some(function (c) { return c.offre_id === r.data.id; })) { message("Vous avez déjà postulé à cette offre : vous suivez la réponse dans « Mes candidatures »."); return; }
    offreVisee = r.data;
    $("postuler-titre").textContent = offreVisee.intitule;
    $("postuler-infos").textContent = ((offreVisee.structures && offreVisee.structures.nom) || "") + " · " + offreVisee.ville + " (" + offreVisee.departement + ") · à partir du " + dateFr(offreVisee.debut);
    $("bloc-postuler").hidden = false;
    allerA("bloc-postuler");
  }
  $("annuler-postuler").addEventListener("click", function () { $("bloc-postuler").hidden = true; offreVisee = null; });
  $("f-postuler").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!offreVisee) return;
    var form = this;
    occupe(form, true);
    var r = await sb.from("candidatures").insert({ offre_id: offreVisee.id, message: form.message.value.trim() || null });
    occupe(form, false);
    if (r.error) { message(/duplicate|unique/i.test(r.error.message) ? "Vous avez déjà postulé à cette offre." : erreurLisible(r.error), true); return; }
    form.reset();
    $("bloc-postuler").hidden = true;
    offreVisee = null;
    if (params.get("postuler")) history.replaceState(null, "", location.pathname);
    params.delete("postuler");
    message("Candidature envoyée. La structure voit votre profil" + (profil.cv_nom ? ", votre CV" : "") + " et votre message ; vous suivez sa réponse dans « Mes candidatures ».");
    tableauCandidat();
  });

  Array.prototype.forEach.call($("f-candidats").elements, function (c) { c.addEventListener("change", chargerCandidats); });
  $("f-candidats").addEventListener("submit", function (e) { e.preventDefault(); });

  /* -- session -- */
  $("deconnexion").addEventListener("click", async function () {
    await sb.auth.signOut();
    memoire(null);
    location.href = location.pathname;
  });
  // les fichiers d'un compte (CV, photos, logo) : supprimés avec lui
  async function supprimerMesFichiers() {
    var r = await Promise.all([sb.storage.from("cv").list(utilisateur.id), sb.storage.from("structures").list(utilisateur.id, { limit: 100 })]);
    var a = (r[0].data || []).map(function (f) { return utilisateur.id + "/" + f.name; });
    var b = (r[1].data || []).map(function (f) { return utilisateur.id + "/" + f.name; });
    if (a.length) await sb.storage.from("cv").remove(a);
    if (b.length) await sb.storage.from("structures").remove(b);
  }
  $("supprimer").addEventListener("click", async function () {
    if (!confirm("Supprimer définitivement votre compte" + (structure ? ", votre fiche, vos photos et toutes vos offres" : ", votre profil et votre CV") + " ? Ce n'est pas réversible.")) return;
    try { await supprimerMesFichiers(); } catch (e) { /* on supprime le compte quand même */ }
    var r = await sb.rpc("supprimer_mon_compte");
    if (r.error) { message(erreurLisible(r.error) + " Écrivez-nous pour que nous le supprimions.", true); return; }
    await sb.auth.signOut();
    memoire(null);
    profil = structure = utilisateur = null;
    montrer("v-connexion");
    message("Votre compte et vos données sont supprimés.");
  });

  demarrer().catch(function (e) { montrer("v-connexion"); message(erreurLisible(e), true); });
})();

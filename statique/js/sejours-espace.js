/* Fil Roug'Anim : dans l'espace structure, les onglets ajoutés « Mes séjours » et « Demandes des familles ».
   Les séjours (avec nuitées) et les accueils de loisirs (vacances, mercredis) se créent pas à pas, avec l'aperçu de
   la fiche ; les dates, les places restantes, la duplication et la pause se règlent depuis la liste.
   Les demandes des familles arrivent par demander_place() ; mes_demandes_sejour() masque les coordonnées au-delà des
   2 demandes gratuites tant que la structure n'a pas l'abonnement ou le Pass recrutement (docs/PLAN-SEJOURS.md). */
(function () {
  "use strict";
  var besoins = [], candidats = [];
  // toutes les colonnes lisibles (le lien secret du carnet ne se lit que par lien_carnet())
  var COLONNES = "id,structure_id,type,slug,titre,accroche,description,programme,vie_sur_place,encadrement_texte,infos_pratiques,envies,age_min,age_max,capacite,taux_encadrement,pays,region_dest,ville,departement,hebergement,transport,horaires,prix_min,prix_unite,prix_texte,inclus,aides,pass_colo,numero_declaration,photos,statut,cree_le,maj_le";
  var E = null, C = null, sejours = [], dates = {}, stats = {}, demandes = [], brouillon = null, carnetDe = null, etape = 0, filtre = "tout", envoiPhotos = 0;
  var TYPES = { sejour: ["Séjour", "Une colo avec nuitées, 5 jours ou plus"], mini_sejour: ["Mini-séjour", "2 à 4 nuits, souvent rattaché à un accueil"],
                accueil_vacances: ["Accueil de loisirs · vacances", "À la journée, pendant les vacances scolaires"], accueil_mercredis: ["Accueil de loisirs · mercredis", "À la journée, les mercredis de l'année"],
                accueil_periscolaire: ["Périscolaire", "Matins, midis et soirs, autour de l'école"] };
  var ENVIES = { nature: "Nature et animaux", mer: "Mer et plage", montagne: "Montagne", sports: "Sports", equitation: "Équitation", nautique: "Sports nautiques",
                 arts: "Arts, cirque et spectacle", sciences: "Sciences et numérique", langues: "Langues et étranger", itinerance: "Itinérance et aventure", decouverte: "Découverte" };
  var HEBERG = { centre: "Centre de vacances", camping: "Camping, sous tente", gite: "Gîte", auberge: "Auberge de jeunesse", famille: "En famille d'accueil", aucun: "Sans hébergement (à la journée)" };
  var AIDES = { pass_colo: "Pass Colo", vacaf: "VACAF (CAF)", cheques_vacances: "Chèques-Vacances", ce: "Comité d'entreprise (CSE)", mairie: "Aide de la mairie" };
  var UNITES = { sejour: "le séjour", jour: "la journée", semaine: "la semaine", quotient: "selon le quotient familial" };
  var STATUTS_D = { nouvelle: "Nouvelle", en_cours: "En cours", acceptee: "Place proposée", attente: "Liste d'attente", refusee: "Refusée", complet: "Complet" };
  var ETAPES = ["Le type", "L'essentiel", "Les dates", "Le lieu", "Le transport", "Le programme", "L'encadrement", "Les photos", "Le prix et les aides", "Relire et publier"];

  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function accueil(s) { return s && /^accueil/.test(s.type); }
  function urlPhoto(p) { return E.L.photos_sejours + p; }
  function euros(n) { n = Number(n || 0); return n.toLocaleString("fr-FR", n % 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {}) + " €"; }
  function slugifier(t) { return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "sejour"; }
  function aujourdhui() { return new Date().toISOString().slice(0, 10); }
  function paye() { var s = E.structure(); return !!(s && s.abonnement_fin && s.abonnement_fin >= aujourdhui()); }
  function periode(d) { return d.debut === d.fin ? E.dateFr(d.debut) : "du " + E.dateFr(d.debut) + " au " + E.dateFr(d.fin); }

  async function charger() {
    var r = await E.sb.from("sejours").select(COLONNES).eq("structure_id", C.id).order("cree_le", { ascending: false });
    sejours = r.data || [];
    dates = {}; stats = {};
    var ids = sejours.map(function (s) { return s.id; });
    if (ids.length) {
      var d30 = new Date(); d30.setDate(d30.getDate() - 30);
      var x = await Promise.all([E.sb.from("sejours_dates").select("*").in("sejour_id", ids).order("debut"),
                                 E.sb.from("stats_sejours").select("sejour_id,type,n").in("sejour_id", ids).gte("jour", d30.toISOString().slice(0, 10))]);
      (x[0].data || []).forEach(function (d) { (dates[d.sejour_id] = dates[d.sejour_id] || []).push(d); });
      (x[1].data || []).forEach(function (s) { var o = stats[s.sejour_id] = stats[s.sejour_id] || {}; o[s.type] = (o[s.type] || 0) + s.n; });
    }
    var m = await E.sb.rpc("mes_demandes_sejour");
    demandes = (m && m.data) || [];
    var cs = await E.sb.rpc("mes_candidatures_sejour");
    candidats = (cs && cs.data) || [];
    var bf = await E.sb.rpc("mes_besoins_familles");
    besoins = (bf && bf.data) || [];
  }
  function pastilles() {
    var n = demandes.filter(function (d) { return d.statut === "nouvelle"; }).length + besoins.filter(function (d) { return d.statut === "nouvelle"; }).length, p = document.querySelector('[data-pastille="familles"]');
    if (p) { p.hidden = !n; p.textContent = n; }
  }

  /* ---------- la liste des séjours ---------- */
  function liste() {
    var c = $("sj-liste"); c.textContent = "";
    if (brouillon) { editeur(c); return; }
    if (carnetDe) { pageCarnet(c, carnetDe); return; }
    var tete = el("div", "sj-tete");
    // le titre et l'explication sont dans l'en-tête de la page : ici, seulement ce qui change
    var t = el("div"); if (E.structure() && !E.structure().verifiee) t.appendChild(el("p", "petit", "Vos séjours seront visibles dès que nous aurons vérifié votre structure."));
    tete.appendChild(t);
    if (!paye() && !(E.estAdminF && E.estAdminF())) {
      var g = el("p", "statut sj-gratuit"); g.appendChild(document.createTextNode("Formule gratuite : "));
      g.appendChild(el("b", null, "un séjour ou accueil en ligne à la fois")); g.appendChild(document.createTextNode(" (les autres restent en brouillon), et la première demande d'une famille en entier. "));
      var gb = el("button", "bouton-texte", "Tout débloquer avec l'abonnement →"); gb.type = "button"; gb.dataset.ongletVers = "abonnement"; g.appendChild(gb);
      c.appendChild(g);
    }
    var b = el("button", "bouton-r", "+ Créer un séjour ou un accueil"); b.type = "button"; b.addEventListener("click", function () { nouveau(); }); tete.appendChild(b);
    c.appendChild(tete);
    if (!sejours.length) {
      var v = el("div", "sj-vide");
      v.appendChild(el("p", null, "Aucun séjour pour l'instant. Une colo cet été, un accueil de loisirs pendant les vacances, les mercredis ? Comptez 10 minutes pour le premier, puis « Dupliquer » pour les suivants."));
      c.appendChild(v); return;
    }
    var g = el("div", "sj-grille"); c.appendChild(g);
    sejours.forEach(function (s) { g.appendChild(carte(s)); });
    // les animateurs qui veulent encadrer vos séjours (bouton « Postuler pour encadrer » des fiches)
    var kc = el("div", "carte-compte sj-candidats"); kc.appendChild(el("h2", null, "Animateurs qui veulent encadrer vos séjours"));
    if (!candidats.length) kc.appendChild(el("p", "og-vide", "Pas encore de candidature. Sur chaque fiche, les animateurs connectés voient « Postuler pour encadrer » ; vous recevez leur profil par e-mail et ici."));
    var POSTES = { animateur: "animateur", "animateur-stagiaire": "stagiaire BAFA", directeur: "direction", "directeur-adjoint": "direction adjointe", "assistant-sanitaire": "assistant sanitaire", "surveillant-baignade": "surveillant de baignade", autre: "autre" };
    candidats.forEach(function (x) {
      var a = el("article", "sj-demande" + (x.statut === "envoyee" ? " sj-neuve" : ""));
      var h = el("div", "sj-d-tete"); h.appendChild(el("b", null, x.prenom + " · " + (POSTES[x.poste] || x.poste) + " · " + x.sejour));
      h.appendChild(el("span", "sj-etat sj-d-" + (x.statut === "retenue" ? "acceptee" : x.statut === "non-retenue" ? "refusee" : "nouvelle"), { envoyee: "Nouvelle", vue: "Vue", retenue: "Retenue", "non-retenue": "Non retenue" }[x.statut])); a.appendChild(h);
      a.appendChild(el("p", "sj-d-infos", [x.ville ? x.ville + " (" + x.departement + ")" : x.departement, (x.diplomes || []).join(", ").toUpperCase(), "reçue le " + E.dateFr(String(x.cree_le).slice(0, 10))].filter(Boolean).join(" · ")));
      if (x.message) a.appendChild(el("blockquote", "sj-d-message", x.message));
      var acts = el("div", "sj-actions");
      var m = el("a", "bouton-r", "Lui écrire"); m.href = "mailto:" + x.email + "?subject=" + encodeURIComponent("Votre candidature : " + x.sejour); acts.appendChild(m);
      [["retenue", "Retenir"], ["non-retenue", "Pas retenu"]].forEach(function (y) { var b = el("button", "bouton-texte", y[1]); b.type = "button";
        b.addEventListener("click", async function () { await E.sb.rpc("repondre_candidature_sejour", { cid: x.id, st: y[0] }); x.statut = y[0]; liste(); }); acts.appendChild(b); });
      a.appendChild(acts); kc.appendChild(a);
    });
    c.appendChild(kc);

    // la photo de bannière (facultative) en haut de la page structure
    var bn = el("details", "sj-badge"); bn.appendChild(el("summary", null, "Une photo de bannière en haut de votre page (facultatif)"));
    var stb = E.structure() || {};
    if (stb.banniere) { var ap0 = el("div", "sj-banniere-apercu"); ap0.style.backgroundImage = "url(" + JSON.stringify(E.L.photos + stb.banniere) + ")"; bn.appendChild(ap0); }
    bn.appendChild(el("p", "petit", "Une grande photo de vos séjours ou de votre centre, en largeur. Sans photo, votre page reste comme aujourd'hui."));
    var dep = el("label", "depot depot-petit"), fi = el("input"); fi.type = "file"; fi.accept = "image/jpeg,image/png,image/webp"; dep.appendChild(fi); dep.appendChild(el("span", "depot-texte", stb.banniere ? "Changer la photo" : "Choisir une photo")); bn.appendChild(dep);
    fi.addEventListener("change", async function () {
      var f = fi.files[0]; fi.value = ""; if (!f) return;
      try {
        var blob = await E.reduireImage(f, 2000); if (blob.size > 2 * 1024 * 1024) throw new Error("exceeded");
        var chemin = C.id + "/banniere-" + Date.now().toString(36) + ".jpg";
        var r = await E.sb.storage.from("structures").upload(chemin, blob, { contentType: "image/jpeg", cacheControl: "31536000" }); if (r.error) throw r.error;
        var q = await E.sb.from("structures").update({ banniere: chemin }).eq("id", C.id); if (q.error) throw q.error;
        if (stb.banniere) E.sb.storage.from("structures").remove([stb.banniere]);
        stb.banniere = chemin; E.message("Bannière enregistrée : elle apparaît sur votre page à la prochaine mise à jour du site."); liste();
      } catch (e) { E.message(E.erreur(e), true); }
    });
    if (stb.banniere) { var rb = el("button", "bouton-texte", "Retirer la bannière"); rb.type = "button"; rb.addEventListener("click", async function () {
      var q = await E.sb.from("structures").update({ banniere: null }).eq("id", C.id); if (q.error) return E.message(E.erreur(q.error), true);
      E.sb.storage.from("structures").remove([stb.banniere]); stb.banniere = null; E.message("Bannière retirée."); liste(); }); bn.appendChild(rb); }
    c.appendChild(bn);

    // le badge pour le site de la structure : un lien vers sa page, avec ses séjours
    var st = E.structure() || {};
    if (st.slug && sejours.some(function (s) { return s.statut === "publie"; })) {
      var bd = el("details", "sj-badge"); bd.appendChild(el("summary", null, "Un badge pour votre site : « Nos séjours sont sur Fil Roug'Anim »"));
      var url = location.origin + (E.L.lien_structures || "/trouver-un-poste/structures/") + st.slug + "/#sejours", img = location.origin + E.L.badge_sejours;
      var ap = el("a"); ap.href = url; ap.target = "_blank"; ap.rel = "noopener"; var im = el("img"); im.src = E.L.badge_sejours; im.alt = "Nos séjours sont sur Fil Roug'Anim"; im.width = 220; im.height = 64; ap.appendChild(im); bd.appendChild(ap);
      bd.appendChild(el("p", "petit", "Copiez ce code dans votre site (ou envoyez-le à la personne qui s'en occupe) : les familles arrivent sur votre page et vous demandent une place."));
      var ta = el("textarea", "sj-badge-code"); ta.readOnly = true; ta.rows = 3;
      ta.value = '<a href="' + url + '"><img src="' + img + '" alt="Nos séjours sont sur Fil Roug\'Anim" width="220" height="64"></a>';
      ta.addEventListener("focus", function () { ta.select(); }); bd.appendChild(ta);
      c.appendChild(bd);
    }
  }
  function etatDe(s) {
    if (s.statut === "brouillon") return ["brouillon", "Brouillon"];
    if (s.statut === "pause") return ["pause", "En pause"];
    var ds = dates[s.id] || [], avenir = ds.filter(function (d) { return d.fin >= aujourdhui(); });
    if (ds.length && !avenir.length) return ["fini", "Terminé"];
    if (avenir.length && avenir.every(function (d) { return d.complet; })) return ["complet", "Complet"];
    return ["ligne", E.structure() && E.structure().verifiee ? "En ligne" : "Publié (après vérification)"];
  }
  function carte(s) {
    var k = el("article", "sj-carte");
    var ph = el("div", "sj-photo"); if (s.photos && s.photos[0]) ph.style.backgroundImage = "url(" + JSON.stringify(urlPhoto(s.photos[0])) + ")"; else ph.appendChild(el("span", null, TYPES[s.type][0]));
    k.appendChild(ph);
    var corps = el("div", "sj-corps"); k.appendChild(corps);
    var et = etatDe(s); corps.appendChild(el("span", "sj-etat sj-" + et[0], et[1]));
    corps.appendChild(el("h3", null, s.titre));
    corps.appendChild(el("p", "sj-sous", TYPES[s.type][0] + " · " + s.age_min + "-" + s.age_max + " ans" + (s.ville ? " · " + s.ville : s.pays !== "FR" ? " · " + (s.region_dest || s.pays) : "") + (s.prix_min != null ? " · dès " + euros(s.prix_min) : "")));
    var st = stats[s.id] || {}; corps.appendChild(el("p", "sj-chiffres", (st.vue || 0) + " vues · " + (st.demande || 0) + " demandes · 30 jours"));
    // les dates, avec les places restantes
    var ul = el("ul", "sj-dates");
    (dates[s.id] || []).filter(function (d) { return d.fin >= aujourdhui(); }).slice(0, 6).forEach(function (d) {
      var li = el("li", d.complet ? "sj-complet" : null); li.appendChild(el("span", null, periode(d)));
      var pl = el("span", "sj-places");
      if (!accueil(s)) {
        var moins = el("button", "sj-pm", "−"); moins.type = "button"; moins.setAttribute("aria-label", "Une place de moins");
        var plus = el("button", "sj-pm", "+"); plus.type = "button"; plus.setAttribute("aria-label", "Une place de plus");
        moins.addEventListener("click", function () { places(d, -1); }); plus.addEventListener("click", function () { places(d, 1); });
        pl.appendChild(moins); pl.appendChild(el("b", null, d.places_restantes == null ? "?" : String(d.places_restantes))); pl.appendChild(plus);
      }
      var cp = el("button", "bouton-texte", d.complet ? "Rouvrir" : "Complet"); cp.type = "button";
      cp.addEventListener("click", async function () { var r = await E.sb.from("sejours_dates").update({ complet: !d.complet }).eq("id", d.id); if (r.error) return E.message(E.erreur(r.error), true); await tout(); });
      pl.appendChild(cp); li.appendChild(pl); ul.appendChild(li);
    });
    if (!ul.children.length) ul.appendChild(el("li", "sj-sans", "Aucune date à venir : ajoutez-en dans « Modifier »."));
    corps.appendChild(ul);
    var acts = el("div", "sj-actions");
    [["Modifier", function () { modifier(s); }, "bouton-blanc"],
     ["Carnet de séjour", function () { carnetDe = s; liste(); window.scrollTo(0, 0); }, "bouton-texte"],
     ["Dupliquer", function () { dupliquer(s); }, "bouton-texte"],
     [s.statut === "publie" ? "Mettre en pause" : "Publier", function () { basculer(s); }, "bouton-texte"],
     ["Supprimer", function () { supprimer(s); }, "bouton-texte sj-suppr"]].forEach(function (a) { var b = el("button", a[2], a[0]); b.type = "button"; b.addEventListener("click", a[1]); acts.appendChild(b); });
    corps.appendChild(acts);
    return k;
  }
  /* ---------- le carnet de séjour : les nouvelles de la journée, envoyées par e-mail aux familles qui ont une place ---------- */
  async function pageCarnet(c, s) {
    var tete = el("div", "sj-tete"), t = el("div");
    var ret = el("button", "bouton-texte", "← Mes séjours"); ret.type = "button"; ret.addEventListener("click", function () { carnetDe = null; liste(); }); t.appendChild(ret);
    t.appendChild(el("h2", null, "Carnet de séjour · " + s.titre));
    var nb = demandes.filter(function (d) { return d.sejour_id === s.id && d.statut === "acceptee"; }).length;
    t.appendChild(el("p", "petit", "Racontez la journée en quelques lignes : activités, sorties, veillée, la météo… Chaque nouvelle part par e-mail aux familles dont l'enfant a une place confirmée (« Accepter » dans les demandes), et s'affiche dans leur espace parent. " +
      (nb ? nb + " famille" + (nb > 1 ? "s" : "") + " recevr" + (nb > 1 ? "ont" : "a") + " la nouvelle." : "Aucune place confirmée pour l'instant : acceptez les demandes pour que les familles reçoivent le carnet.")));
    tete.appendChild(t); c.appendChild(tete);
    var cols = el("div", "sj-carnet"); c.appendChild(cols);
    // écrire
    var k = el("div", "carte-compte"); cols.appendChild(k); k.appendChild(el("h3", null, "La nouvelle du jour"));
    var f = el("form", "formulaire"), auj = aujourdhui();
    var ds = (dates[s.id] || []).filter(function (d) { return d.fin >= auj && d.debut <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10); });
    if ((dates[s.id] || []).length > 1) {
      var ld = el("label", "champ"); ld.appendChild(el("span", null, "Session"));
      var sd = el("select"); sd.name = "date_id"; var o0 = el("option", null, "Toutes les sessions"); o0.value = ""; sd.appendChild(o0);
      (dates[s.id] || []).forEach(function (d) { var o = el("option", null, periode(d)); o.value = d.id; if (ds[0] && ds[0].id === d.id) o.selected = true; sd.appendChild(o); });
      ld.appendChild(sd); f.appendChild(ld);
    }
    [["titre", "Titre (facultatif)", "input", "Ex. Journée au lac"], ["texte", "La journée", "textarea", "Ce matin, grand jeu dans la forêt…"], ["auteur", "Signé (facultatif)", "input", "Ex. Léa, directrice"]].forEach(function (x) {
      var l = el("label", "champ"); l.appendChild(el("span", null, x[1])); var i = el(x[2]); i.name = x[0]; i.placeholder = x[3];
      if (x[2] === "textarea") { i.rows = 6; i.required = true; i.maxLength = 4000; } else i.maxLength = x[0] === "titre" ? 120 : 80;
      l.appendChild(i); f.appendChild(l); });
    f.appendChild(el("p", "petit", "Pas de nom de famille ni d'information de santé. Les photos arriveront bientôt."));
    var env = el("button", "bouton-r", "Envoyer aux familles"); env.type = "submit"; f.appendChild(env);
    f.addEventListener("submit", async function (e) {
      e.preventDefault(); env.disabled = true;
      var r = await E.sb.rpc("ecrire_carnet", { sid: s.id, j: null, did: f.date_id && f.date_id.value ? parseInt(f.date_id.value, 10) : null, titre: f.titre.value, texte: f.texte.value, auteur: f.auteur.value });
      env.disabled = false; if (r.error) return E.message(E.erreur(r.error), true);
      E.message("C'est envoyé : les familles reçoivent la nouvelle."); liste();
    });
    k.appendChild(f);
    // le lien pour l'équipe
    var kl = el("div", "carte-compte"); cols.appendChild(kl); kl.appendChild(el("h3", null, "Le lien pour l'équipe"));
    kl.appendChild(el("p", "petit", "Le directeur ou un animateur écrit le carnet depuis son téléphone, sans compte : donnez-lui ce lien. Changez-le après le séjour."));
    var zl = el("div", "sj-lien"); kl.appendChild(zl);
    async function montrerLien(nouveau) {
      var r = await E.sb.rpc("lien_carnet", { sid: s.id, nouveau: !!nouveau });
      if (r.error) return E.message(E.erreur(r.error), true);
      zl.textContent = ""; var u = location.origin + "/enfants/carnet/?j=" + r.data;
      var ip = el("input"); ip.readOnly = true; ip.value = u; ip.addEventListener("focus", function () { ip.select(); }); zl.appendChild(ip);
      var cp = el("button", "bouton-blanc", "Copier"); cp.type = "button"; cp.addEventListener("click", function () { (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { cp.textContent = "Copié !"; }, function () { ip.select(); }); }); zl.appendChild(cp);
      var ch = el("button", "bouton-texte", "Changer le lien"); ch.type = "button"; ch.addEventListener("click", function () { if (confirm("L'ancien lien ne marchera plus. Continuer ?")) montrerLien(true); }); zl.appendChild(ch);
    }
    var vl = el("button", "bouton-blanc", "Afficher le lien"); vl.type = "button"; vl.addEventListener("click", function () { montrerLien(false); }); zl.appendChild(vl);
    // les nouvelles déjà envoyées
    var kh = el("div", "carte-compte sj-carnet-fil"); c.appendChild(kh); kh.appendChild(el("h3", null, "Déjà envoyées"));
    var r = await E.sb.from("carnet_sejour").select("id,jour,titre,texte,auteur,cree_le").eq("sejour_id", s.id).order("cree_le", { ascending: false }).limit(60);
    var l = r.data || [];
    if (!l.length) kh.appendChild(el("p", "og-vide", "Rien pour l'instant."));
    var ol = el("ol", "pa-carnet"); kh.appendChild(ol);
    l.forEach(function (x) {
      var li = el("li"); li.appendChild(el("p", "pa-c-sur", E.dateFr(x.jour) + (x.auteur ? " · " + x.auteur : "")));
      if (x.titre) li.appendChild(el("h3", null, x.titre)); li.appendChild(el("p", "pa-c-texte", x.texte));
      var sp = el("button", "bouton-texte sj-suppr", "Retirer"); sp.type = "button";
      sp.addEventListener("click", async function () { if (!confirm("Retirer cette nouvelle de l'espace des familles ? (l'e-mail est déjà parti)")) return; await E.sb.from("carnet_sejour").delete().eq("id", x.id); liste(); });
      li.appendChild(sp); ol.appendChild(li);
    });
  }
  async function places(d, n) {
    var v = Math.max(0, (d.places_restantes == null ? (d.places || 0) : d.places_restantes) + n);
    var r = await E.sb.from("sejours_dates").update({ places_restantes: v, complet: v === 0 }).eq("id", d.id);
    if (r.error) return E.message(E.erreur(r.error), true);
    await tout();
  }
  async function basculer(s) {
    if (s.statut !== "publie") { var manque = manques(Object.assign({}, s, { _dates: dates[s.id] || [] })); if (manque.length) { modifier(s); E.message("Avant de publier : " + manque.join(", ") + ".", true); return; } }
    var r = await E.sb.from("sejours").update({ statut: s.statut === "publie" ? "pause" : "publie", maj_le: new Date().toISOString() }).eq("id", s.id);
    if (r.error) return E.message(E.erreur(r.error), true);
    await tout(); E.message(s.statut === "publie" ? "En pause : il n'apparaît plus aux familles." : "Publié !");
  }
  async function supprimer(s) {
    if (!confirm("Supprimer « " + s.titre + " » ? Les demandes déjà reçues pour ce séjour seront supprimées aussi.")) return;
    var r = await E.sb.from("sejours").delete().eq("id", s.id);
    if (r.error) return E.message(E.erreur(r.error), true);
    if (s.photos && s.photos.length) E.sb.storage.from("sejours").remove(s.photos);
    await tout(); E.message("Supprimé.");
  }
  function dupliquer(s) {
    brouillon = Object.assign({}, s, { id: null, titre: (s.titre + " (copie)").slice(0, 60), statut: "brouillon", photos: (s.photos || []).slice(),
      _dates: (dates[s.id] || []).map(function (d) { return { debut: d.debut, fin: d.fin, places: d.places, places_restantes: d.places, jours: d.jours }; }), _copie: true });
    etape = 2; liste(); E.message("Copie prête : changez les dates (et le titre), puis enregistrez.");
  }
  function nouveau() {
    var st = E.structure() || {};
    brouillon = { id: null, type: "sejour", titre: "", accroche: "", envies: [], age_min: 6, age_max: 12, capacite: null, taux_encadrement: "", pays: "FR", region_dest: "",
                  ville: st.ville || "", departement: st.departement || "", hebergement: "centre", transport: [], horaires: "", description: "", programme: "", vie_sur_place: "",
                  encadrement_texte: "", infos_pratiques: "", photos: [], prix_min: null, prix_unite: "sejour", prix_texte: "", inclus: "", aides: [], pass_colo: false,
                  numero_declaration: "", statut: "brouillon", _dates: [] };
    etape = 0; liste();
  }
  function modifier(s) { brouillon = Object.assign({}, s, { _dates: (dates[s.id] || []).map(function (d) { return Object.assign({}, d); }) }); etape = 1; liste(); }

  /* ---------- l'assistant, pas à pas, avec l'aperçu ---------- */
  function sautees() { return accueil(brouillon) ? [4] : []; }
  function editeur(c) {
    var b = brouillon;
    var cadre = el("div", "sj-editeur"); c.appendChild(cadre);
    // à gauche : le plan des étapes, puis l'aperçu de la fiche ; à droite : l'étape en cours (comme « Ma page »)
    var col = el("div", "sj-col"), gauche = el("div", "sj-gauche"), droite = el("aside", "sj-apercu"); cadre.appendChild(col); cadre.appendChild(gauche);
    var fil = el("ol", "sj-fil");
    ETAPES.forEach(function (nom, i) {
      if (sautees().indexOf(i) >= 0) return;
      var li = el("li", i === etape ? "sj-ici" : i < etape ? "sj-fait" : null); var bt = el("button", null, nom); bt.type = "button";
      bt.addEventListener("click", function () { lire(); etape = i; liste(); }); li.appendChild(bt); fil.appendChild(li);
    });
    var plan = el("div", "sj-plan"); plan.appendChild(el("p", "sj-plan-t", b.id ? "Modifier le séjour" : "Nouveau séjour"));
    plan.appendChild(el("p", "sj-plan-n", "Étape " + (ETAPES.filter(function (x, i) { return sautees().indexOf(i) < 0 && i <= etape; }).length) + " sur " + ETAPES.filter(function (x, i) { return sautees().indexOf(i) < 0; }).length));
    plan.appendChild(fil); col.appendChild(plan); col.appendChild(droite);
    var f = el("form", "formulaire sj-form"); f.id = "sj-form"; f.addEventListener("submit", function (e) { e.preventDefault(); }); gauche.appendChild(f);
    f.appendChild(el("h2", null, ETAPES[etape]));
    [etapeType, etapeEssentiel, etapeDates, etapeLieu, etapeTransport, etapeProgramme, etapeEncadrement, etapePhotos, etapePrix, etapeRelire][etape](f, b);
    var nav = el("div", "sj-nav");
    var annuler = el("button", "bouton-texte", "Annuler"); annuler.type = "button";
    annuler.addEventListener("click", function () { if (confirm("Quitter sans enregistrer ?")) { brouillon = null; liste(); } }); nav.appendChild(annuler);
    if (etape > 0) { var prec = el("button", "bouton-blanc", "← Précédent"); prec.type = "button"; prec.addEventListener("click", function () { lire(); etape = suivante(-1); liste(); }); nav.appendChild(prec); }
    if (b.id || etape > 1) { var reg = el("button", "bouton-blanc", "Enregistrer le brouillon"); reg.type = "button"; reg.addEventListener("click", function () { lire(); enregistrer(false); }); nav.appendChild(reg); }
    if (etape < ETAPES.length - 1) { var suiv = el("button", "bouton-r", "Suivant →"); suiv.type = "button"; suiv.addEventListener("click", function () { if (!f.reportValidity()) return; lire(); etape = suivante(1); liste(); }); nav.appendChild(suiv); }
    else { var pub = el("button", "bouton-r", "Publier"); pub.type = "button"; pub.addEventListener("click", function () { lire(); enregistrer(true); }); nav.appendChild(pub); }
    gauche.appendChild(nav);
    apercu(droite);
    f.addEventListener("input", function () { lire(); apercu(droite); });
    f.addEventListener("change", function () { lire(); apercu(droite); });
  }
  function suivante(sens) { var i = etape + sens; while (sautees().indexOf(i) >= 0) i += sens; return Math.max(0, Math.min(ETAPES.length - 1, i)); }
  function champ(f, nom, libelle, type, val, opts) {
    opts = opts || {};
    var l = el("label", "champ" + (opts.large ? " champ-large" : "")); l.appendChild(el("span", null, libelle + (opts.aide ? "" : "")));
    var i;
    if (type === "texte") { i = el("textarea"); i.rows = opts.lignes || 5; i.maxLength = opts.max || 3000; }
    else if (type === "select") { i = el("select"); Object.keys(opts.choix).forEach(function (k) { var o = el("option", null, opts.choix[k]); o.value = k; i.appendChild(o); }); }
    else { i = el("input"); i.type = type; if (opts.max) i.maxLength = opts.max; if (opts.min != null) i.min = opts.min; if (opts.maxi != null) i.max = opts.maxi; if (opts.pas) i.step = opts.pas; }
    i.name = nom; i.value = val == null ? "" : val; if (opts.requis) i.required = true; if (opts.place) i.placeholder = opts.place;
    l.appendChild(i); if (opts.aide) l.appendChild(el("small", "sj-aide", opts.aide));
    f.appendChild(l); return i;
  }
  function cases(f, nom, libelle, choix, coches, max) {
    var fs = el("fieldset", "sj-cases"); fs.appendChild(el("legend", null, libelle));
    Object.keys(choix).forEach(function (k) {
      var l = el("label", "sj-case"), i = el("input"); i.type = "checkbox"; i.name = nom; i.value = k; i.checked = (coches || []).indexOf(k) >= 0;
      i.addEventListener("change", function () { if (max && fs.querySelectorAll("input:checked").length > max) { i.checked = false; E.message(max + " au plus.", true); } });
      l.appendChild(i); l.appendChild(el("span", null, choix[k])); fs.appendChild(l);
    });
    f.appendChild(fs);
  }
  function etapeType(f, b) {
    var g = el("div", "sj-types");
    Object.keys(TYPES).forEach(function (k) {
      var l = el("label", "sj-type"), i = el("input"); i.type = "radio"; i.name = "type"; i.value = k; i.checked = b.type === k;
      l.appendChild(i); var s = el("span"); s.appendChild(el("b", null, TYPES[k][0])); s.appendChild(el("small", null, TYPES[k][1])); l.appendChild(s); g.appendChild(l);
    });
    f.appendChild(g);
  }
  function etapeEssentiel(f, b) {
    var g = el("div", "champs-2"); f.appendChild(g);
    champ(g, "titre", "Titre (60 caractères)", "text", b.titre, { requis: true, max: 60, large: true, place: "Ex. : Cap sur la Bretagne : voile et grands jeux" });
    champ(g, "accroche", "En une phrase (140 caractères)", "text", b.accroche, { max: 140, large: true, place: "Ce qui donne envie, pour les enfants et pour les parents" });
    champ(g, "age_min", "Âge de", "number", b.age_min, { requis: true, min: 3, maxi: 17 });
    champ(g, "age_max", "à", "number", b.age_max, { requis: true, min: 3, maxi: 17 });
    champ(g, "capacite", "Nombre d'enfants accueillis", "number", b.capacite, { min: 1, maxi: 1000 });
    champ(g, "taux_encadrement", "Encadrement", "text", b.taux_encadrement, { max: 40, place: "Ex. : 1 animateur pour 8 enfants" });
    cases(f, "envies", "Il ou elle aime… (3 au plus)", ENVIES, b.envies, 3);
  }
  function etapeDates(f, b) {
    f.appendChild(el("p", "petit", accueil(b) ? "La période d'ouverture (une ligne par période de vacances, ou l'année scolaire pour les mercredis) et les jours." : "Une ligne par session. Les places restantes se règlent ensuite d'un clic depuis la liste."));
    var ul = el("ul", "sj-lignes"); f.appendChild(ul);
    (b._dates.length ? b._dates : [{}]).forEach(function (d, i) {
      if (!b._dates[i]) b._dates[i] = d;
      var li = el("li", "sj-ligne"); li.dataset.i = i;
      champ(li, "debut", "Début", "date", d.debut, { requis: i === 0 }); champ(li, "fin", "Fin", "date", d.fin, { requis: i === 0 });
      if (accueil(b)) champ(li, "jours", "Jours", "text", d.jours, { max: 120, place: "Ex. : du lundi au vendredi" });
      else champ(li, "places", "Places", "number", d.places, { min: 0, maxi: 1000 });
      var x = el("button", "og-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Retirer cette date");
      x.addEventListener("click", function () { lire(); b._dates.splice(i, 1); liste(); }); li.appendChild(x);
      ul.appendChild(li);
    });
    var a = el("button", "bouton-blanc", "+ Ajouter une date"); a.type = "button"; a.addEventListener("click", function () { lire(); b._dates.push({}); liste(); }); f.appendChild(a);
  }
  function etapeLieu(f, b) {
    var g = el("div", "champs-2"); f.appendChild(g);
    if (!accueil(b)) {
      var p = champ(g, "pays", "Pays", "select", b.pays === "FR" ? "FR" : "XX", { choix: { FR: "En France", XX: "À l'étranger" } });
      p.addEventListener("change", function () { lire(); b.pays = p.value === "FR" ? "FR" : (b.pays !== "FR" ? b.pays : "ES"); liste(); });
    }
    if (b.pays === "FR" || accueil(b)) {
      champ(g, "ville", accueil(b) ? "Ville de l'accueil" : "Ville du séjour", "text", b.ville, { requis: true, max: 80 });
      var dep = champ(g, "departement", "Département (numéro)", "text", b.departement, { requis: true, max: 3, place: "Ex. : 29" }); dep.pattern = "([0-9]{2,3}|2[ABab])";
    } else {
      var cp = champ(g, "code_pays", "Code du pays (2 lettres)", "text", b.pays, { requis: true, max: 2, place: "ES, IT, GB…" }); cp.pattern = "[A-Za-z]{2}";
      champ(g, "region_dest", "Région ou ville", "text", b.region_dest, { max: 80, place: "Ex. : Andalousie" });
    }
    if (accueil(b)) champ(g, "horaires", "Horaires, accueil échelonné, ramassage", "text", b.horaires, { max: 300, large: true, place: "Ex. : 8 h - 18 h, accueil jusqu'à 9 h 30" });
    else champ(g, "hebergement", "Hébergement", "select", b.hebergement || "centre", { choix: HEBERG });
  }
  function etapeTransport(f, b) {
    f.appendChild(el("p", "petit", "Les villes de départ proposées aux familles, avec le mode et le supplément (0 si compris). Laissez vide si les familles amènent les enfants sur place."));
    var ul = el("ul", "sj-lignes"); f.appendChild(ul);
    (b.transport || []).forEach(function (t, i) {
      var li = el("li", "sj-ligne"); li.dataset.i = i;
      champ(li, "t_ville", "Ville de départ", "text", t.ville, { max: 60 });
      champ(li, "t_mode", "Mode", "select", t.mode || "train", { choix: { train: "Train", car: "Car", avion: "Avion", autre: "Autre" } });
      champ(li, "t_prix", "Supplément (€)", "number", t.prix, { min: 0, pas: "any" });
      var x = el("button", "og-x", "×"); x.type = "button"; x.addEventListener("click", function () { lire(); b.transport.splice(i, 1); liste(); }); li.appendChild(x);
      ul.appendChild(li);
    });
    var a = el("button", "bouton-blanc", "+ Ajouter une ville de départ"); a.type = "button"; a.addEventListener("click", function () { lire(); (b.transport = b.transport || []).push({ mode: "train" }); liste(); }); f.appendChild(a);
  }
  function etapeProgramme(f, b) {
    champ(f, "description", "Présentation", "texte", b.description, { large: true, lignes: 5, aide: "Ce que vivent les enfants, l'ambiance, pour qui c'est fait." });
    var p = champ(f, "programme", "Le programme", "texte", b.programme, { large: true, lignes: 7, aide: "Jour par jour, ou en grandes lignes. Une ligne par point." });
    var mod = el("button", "bouton-texte", "Partir d'un modèle"); mod.type = "button";
    mod.addEventListener("click", function () { if (!p.value || confirm("Remplacer le programme écrit ?")) { p.value = accueil(b) ? "Matin : accueil échelonné, puis activité au choix\nMidi : repas et temps calme\nAprès-midi : grand jeu, sortie ou atelier\n17 h : goûter et départs échelonnés" : "Jour 1 : arrivée, installation, jeux pour se connaître\nJour 2 : première activité phare\nJour 3 : grand jeu et veillée\nJour 4 : excursion de la journée\nJour 5 : activité phare, veillée de fin\nDernier jour : rangement, bilan, retour"; lire(); } });
    f.appendChild(mod);
    champ(f, "vie_sur_place", accueil(b) ? "Une journée type" : "La vie sur place (repas, veillées, nuits, téléphone)", "texte", b.vie_sur_place, { large: true, lignes: 4 });
  }
  function etapeEncadrement(f, b) {
    champ(f, "encadrement_texte", "L'équipe", "texte", b.encadrement_texte, { large: true, lignes: 5, aide: "Direction (BAFD ou équivalent), animateurs, assistant sanitaire, moniteurs diplômés pour les activités encadrées." });
    champ(f, "infos_pratiques", "Infos pratiques (trousseau, santé, documents)", "texte", b.infos_pratiques, { large: true, lignes: 4 });
  }
  function etapePhotos(f, b) {
    f.appendChild(el("p", "petit", "3 à 8 photos. La première sert de vignette. Pas de visages d'enfants reconnaissables sans l'accord de leurs parents."));
    var g = el("ul", "photos-grille sj-photos"); f.appendChild(g);
    (b.photos || []).forEach(function (p, i) {
      var li = el("li"); li.style.backgroundImage = "url(" + JSON.stringify(urlPhoto(p)) + ")";
      if (i === 0) li.appendChild(el("span", "sj-une", "Vignette"));
      else { var u = el("button", "sj-mini", "En vignette"); u.type = "button"; u.addEventListener("click", function () { b.photos.splice(i, 1); b.photos.unshift(p); liste(); }); li.appendChild(u); }
      var x = el("button", "og-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Retirer la photo"); x.addEventListener("click", function () { b.photos.splice(i, 1); (b._retirees = b._retirees || []).push(p); liste(); }); li.appendChild(x);
      g.appendChild(li);
    });
    if ((b.photos || []).length < 8) {
      var d = el("label", "depot"), i = el("input"); i.type = "file"; i.accept = "image/jpeg,image/png,image/webp"; i.multiple = true; d.appendChild(i);
      d.appendChild(el("span", "depot-texte", envoiPhotos ? "Envoi en cours…" : "Ajouter des photos"));
      i.addEventListener("change", async function () {
        var fichiers = Array.prototype.slice.call(i.files, 0, 8 - b.photos.length); i.value = "";
        envoiPhotos += fichiers.length; liste();
        for (var k = 0; k < fichiers.length; k++) {
          try {
            var blob = await E.reduireImage(fichiers[k], 1600); if (blob.size > 2 * 1024 * 1024) throw new Error("exceeded");
            var chemin = C.id + "/sejour-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + ".jpg";
            var r = await E.sb.storage.from("sejours").upload(chemin, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
            if (r.error) throw r.error;
            b.photos.push(chemin);
          } catch (e) { E.message("Une photo n'a pas pu être ajoutée : " + E.erreur(e), true); }
          envoiPhotos--;
        }
        liste();
      });
      f.appendChild(d);
    }
  }
  function etapePrix(f, b) {
    var g = el("div", "champs-2"); f.appendChild(g);
    champ(g, "prix_min", "Prix à partir de (€)", "number", b.prix_min, { min: 0, pas: "any" });
    champ(g, "prix_unite", "Pour", "select", b.prix_unite, { choix: UNITES });
    champ(g, "prix_texte", "Le détail des prix (tarifs au quotient, fratries…)", "texte", b.prix_texte, { large: true, lignes: 3, max: 1000 });
    champ(g, "inclus", "Ce qui est compris", "texte", b.inclus, { large: true, lignes: 3, max: 1000, aide: "Ex. : hébergement, repas, activités, assurance ; transport en supplément." });
    cases(f, "aides", "Aides acceptées", AIDES, b.aides);
    champ(f, "numero_declaration", "Numéro de déclaration (SDJES), si vous l'avez", "text", b.numero_declaration, { max: 40 });
  }
  function etapeRelire(f, b) {
    var m = manques(b);
    if (m.length) { f.appendChild(el("p", "statut statut-attente", "Il manque encore : " + m.join(", ") + ".")); }
    else f.appendChild(el("p", "statut statut-ok", "Tout est prêt. Vérifiez l'aperçu, puis publiez : les familles pourront vous demander une place."));
    f.appendChild(el("p", "petit", "Vous recevez la première demande d'une famille en entier, gratuitement. Ensuite, les demandes continuent d'arriver, et l'abonnement (ou le Pass recrutement) affiche leurs coordonnées." + (paye() ? " Votre abonnement est actif : toutes vos demandes sont complètes." : "")));
  }
  function manques(b) {
    var m = [];
    if (!b.titre || b.titre.length < 5) m.push("le titre");
    if (!(b._dates || []).some(function (d) { return d.debut && d.fin; })) m.push("au moins une date");
    if ((b.pays === "FR" || accueil(b)) && !(b.ville && b.departement)) m.push("la ville et le département");
    if (!b.description) m.push("la présentation");
    if ((b.photos || []).length < 1) m.push("une photo");
    if (b.prix_min == null && !b.prix_texte) m.push("le prix");
    return m;
  }
  // relire le formulaire de l'étape affichée dans le brouillon
  function lire() {
    var f = $("sj-form"), b = brouillon; if (!f || !b) return;
    var v = function (n) { var x = f.elements[n]; return x ? x.value.trim() : undefined; };
    var t = f.querySelector("input[name=type]:checked"); if (t) b.type = t.value;
    ["titre", "accroche", "taux_encadrement", "ville", "region_dest", "horaires", "hebergement", "description", "programme", "vie_sur_place", "encadrement_texte",
     "infos_pratiques", "prix_unite", "prix_texte", "inclus", "numero_declaration"].forEach(function (n) { var x = v(n); if (x !== undefined) b[n] = x; });
    if (v("departement") !== undefined) b.departement = v("departement").toUpperCase();
    if (v("code_pays") !== undefined) b.pays = v("code_pays").toUpperCase();
    ["age_min", "age_max", "capacite"].forEach(function (n) { var x = v(n); if (x !== undefined) b[n] = x === "" ? null : parseInt(x, 10); });
    if (v("prix_min") !== undefined) b.prix_min = v("prix_min") === "" ? null : parseFloat(v("prix_min").replace(",", "."));
    if (f.querySelector("fieldset input[name=envies]")) b.envies = Array.prototype.map.call(f.querySelectorAll("input[name=envies]:checked"), function (x) { return x.value; });
    if (f.querySelector("fieldset input[name=aides]")) { b.aides = Array.prototype.map.call(f.querySelectorAll("input[name=aides]:checked"), function (x) { return x.value; }); b.pass_colo = b.aides.indexOf("pass_colo") >= 0; }
    Array.prototype.forEach.call(f.querySelectorAll(".sj-ligne"), function (li) {
      var i = +li.dataset.i, q = function (n) { var x = li.querySelector("[name=" + n + "]"); return x ? x.value.trim() : undefined; };
      if (q("debut") !== undefined) { var d = b._dates[i] = b._dates[i] || {}; d.debut = q("debut") || null; d.fin = q("fin") || null;
        if (q("places") !== undefined) { var p = q("places") === "" ? null : parseInt(q("places"), 10); if (d.places_restantes == null || d.places_restantes === d.places) d.places_restantes = p; d.places = p; }
        if (q("jours") !== undefined) d.jours = q("jours") || null; }
      if (q("t_ville") !== undefined) b.transport[i] = { ville: q("t_ville"), mode: q("t_mode"), prix: q("t_prix") === "" ? null : parseFloat(q("t_prix")) };
    });
  }
  async function enregistrer(publier) {
    var b = brouillon;
    if (publier) { var m = manques(b); if (m.length) { E.message("Avant de publier : " + m.join(", ") + ".", true); return; } }
    if (!b.titre || b.titre.length < 5) { etape = 1; liste(); E.message("Donnez d'abord un titre (5 caractères au moins).", true); return; }
    if (b.age_min > b.age_max) { etape = 1; liste(); E.message("L'âge minimum dépasse l'âge maximum.", true); return; }
    var champs = ["type", "titre", "accroche", "description", "programme", "vie_sur_place", "encadrement_texte", "infos_pratiques", "envies", "age_min", "age_max", "capacite",
                  "taux_encadrement", "pays", "region_dest", "ville", "departement", "hebergement", "transport", "horaires", "prix_min", "prix_unite", "prix_texte", "inclus", "aides",
                  "pass_colo", "numero_declaration", "photos"];
    var ligne = {}; champs.forEach(function (k) { var x = b[k]; ligne[k] = (x === "" ? null : x); });
    if (accueil(b)) { ligne.pays = "FR"; ligne.hebergement = "aucun"; ligne.transport = []; }
    if (ligne.pays !== "FR") { ligne.ville = ligne.ville || null; ligne.departement = null; }
    ligne.transport = (ligne.transport || []).filter(function (t) { return t && t.ville; });
    ligne.envies = ligne.envies || []; ligne.aides = ligne.aides || []; ligne.photos = ligne.photos || [];
    ligne.statut = publier ? "publie" : (b.statut === "publie" ? "publie" : "brouillon");
    ligne.maj_le = new Date().toISOString();
    var r;
    if (b.id) r = await E.sb.from("sejours").update(ligne).eq("id", b.id).select(COLONNES).single();
    else {
      var pris = sejours.map(function (s) { return s.slug; }), base = slugifier(b.titre), slug = base, n = 2;
      while (pris.indexOf(slug) >= 0) slug = base + "-" + n++;
      ligne.slug = slug; ligne.structure_id = C.id;
      r = await E.sb.from("sejours").insert(ligne).select(COLONNES).single();
    }
    if (r.error) { E.message(E.erreur(r.error), true); return; }
    var id = r.data.id, garder = [];
    for (var i = 0; i < b._dates.length; i++) {
      var d = b._dates[i]; if (!d.debut || !d.fin) continue;
      var dl = { sejour_id: id, debut: d.debut, fin: d.fin < d.debut ? d.debut : d.fin, places: d.places == null ? null : d.places, places_restantes: d.places_restantes == null ? d.places : d.places_restantes, jours: d.jours || null };
      var q = d.id ? await E.sb.from("sejours_dates").update(dl).eq("id", d.id).select().single() : await E.sb.from("sejours_dates").insert(dl).select().single();
      if (q.error) { E.message(E.erreur(q.error), true); return; }
      garder.push(q.data.id);
    }
    var avant = (dates[id] || []).map(function (d) { return d.id; }).filter(function (x) { return garder.indexOf(x) < 0; });
    if (avant.length) await E.sb.from("sejours_dates").delete().in("id", avant);
    if (b._retirees && b._retirees.length && !b._copie) E.sb.storage.from("sejours").remove(b._retirees.filter(function (p) { return !sejours.some(function (s) { return s.id !== id && (s.photos || []).indexOf(p) >= 0; }); }));
    brouillon = null; await tout();
    E.message(publier ? (E.structure() && E.structure().verifiee ? "Publié ! Les familles peuvent vous demander une place." : "Publié : il sera visible dès que nous aurons vérifié votre structure.") : "Brouillon enregistré.");
  }

  /* ---------- l'aperçu de la fiche ---------- */
  function apercu(c) {
    var b = brouillon; c.textContent = "";
    c.appendChild(el("p", "sj-apercu-t", "Aperçu de la fiche"));
    var k = el("article", "sj-fiche");
    var ph = el("div", "sj-fiche-photo"); if (b.photos && b.photos[0]) ph.style.backgroundImage = "url(" + JSON.stringify(urlPhoto(b.photos[0])) + ")"; else ph.appendChild(el("span", null, "Votre photo ici"));
    k.appendChild(ph);
    var co = el("div", "sj-fiche-corps"); k.appendChild(co);
    var tags = el("p", "sj-tags"); [TYPES[b.type][0], (b.age_min || "?") + "-" + (b.age_max || "?") + " ans"].concat((b.envies || []).map(function (e) { return ENVIES[e]; })).forEach(function (x) { tags.appendChild(el("span", null, x)); });
    if (b.pass_colo) tags.appendChild(el("span", "sj-tag-aide", "Pass Colo"));
    co.appendChild(tags);
    co.appendChild(el("h3", null, b.titre || "Le titre de votre séjour"));
    if (b.accroche) co.appendChild(el("p", "sj-accroche", b.accroche));
    var lieu = accueil(b) || b.pays === "FR" ? [b.ville, b.departement ? "(" + b.departement + ")" : ""].join(" ").trim() : [b.region_dest, b.pays].filter(Boolean).join(", ");
    var infos = el("ul", "sj-infos");
    [["Où", lieu || "–"], ["Quand", (b._dates || []).filter(function (d) { return d.debut; }).slice(0, 3).map(periode).join(" · ") || "–"],
     ["Prix", b.prix_min != null ? "dès " + euros(b.prix_min) + " " + UNITES[b.prix_unite] : (b.prix_texte ? "voir le détail" : "–")],
     [accueil(b) ? "Horaires" : "Hébergement", accueil(b) ? (b.horaires || "–") : HEBERG[b.hebergement] || "–"]].forEach(function (x) { var li = el("li"); li.appendChild(el("b", null, x[0])); li.appendChild(el("span", null, x[1])); infos.appendChild(li); });
    co.appendChild(infos);
    if (b.description) co.appendChild(el("p", "sj-desc", b.description.slice(0, 280) + (b.description.length > 280 ? "…" : "")));
    var bt = el("span", "bouton-r sj-faux-bouton", "Demander une place"); co.appendChild(bt);
    c.appendChild(k);
    c.appendChild(el("p", "og-petit", "Les familles voient aussi le programme, l'équipe, les infos pratiques, les aides et votre page structure."));
  }

  /* ---------- les demandes des familles ---------- */
  function boite() {
    var c = $("sj-demandes"); c.textContent = "";
    var st = E.structure() || {}, k = el("div", "carte-compte"); c.appendChild(k);
    var tete = el("div", "sj-tete"); var t = el("div"); t.appendChild(el("h2", null, "Demandes des familles"));
    var fermees = demandes.filter(function (d) { return !d.ouverte; }).length;
    t.appendChild(el("p", "petit", paye() ? "Votre abonnement est actif : toutes les demandes s'affichent en entier." :
      "Gratuit : " + Math.min(2, st.demandes_gratuites_utilisees || 0) + " demande" + ((st.demandes_gratuites_utilisees || 0) > 1 ? "s" : "") + " complète" + ((st.demandes_gratuites_utilisees || 0) > 1 ? "s" : "") + " reçue" + ((st.demandes_gratuites_utilisees || 0) > 1 ? "s" : "") + " sur 2. Ensuite, les demandes arrivent toujours, avec les coordonnées masquées jusqu'à l'abonnement ou au Pass recrutement."));
    tete.appendChild(t); k.appendChild(tete);
    if (fermees && !paye()) {
      var v = el("div", "sj-verrou");
      v.appendChild(el("p", null, fermees + (fermees > 1 ? " familles attendent" : " famille attend") + " votre réponse. Débloquez leurs coordonnées avec l'abonnement, ou le Pass recrutement à " + ((E.L.abonnement && E.L.abonnement.pass_mois_prix) || "15 €") + " par mois, sans engagement."));
      var bb = el("button", "bouton-r", "Débloquer les demandes"); bb.type = "button"; bb.dataset.ongletVers = "abonnement"; v.appendChild(bb);
      k.appendChild(v);
    }
    var fl = el("div", "sj-filtres");
    [["tout", "Toutes"], ["nouvelle", "Nouvelles"], ["en_cours", "En cours"], ["acceptee", "Place proposée"], ["refusee", "Refusées"]].forEach(function (x) {
      var n = x[0] === "tout" ? demandes.length : demandes.filter(function (d) { return d.statut === x[0]; }).length;
      var b = el("button", "sj-filtre" + (filtre === x[0] ? " sj-actif" : ""), x[1] + " · " + n); b.type = "button";
      b.addEventListener("click", function () { filtre = x[0]; boite(); }); fl.appendChild(b);
    });
    k.appendChild(fl);
    var liste_d = demandes.filter(function (d) { return filtre === "tout" || d.statut === filtre; });
    if (!liste_d.length) k.appendChild(el("p", "og-vide", demandes.length ? "Rien dans ce filtre." : "Pas encore de demande. Elles arrivent ici (et par e-mail) dès qu'une famille demande une place sur l'un de vos séjours publiés."));
    liste_d.forEach(function (d) { k.appendChild(demande(d)); });
    // l'annuaire inversé des parents : les familles de votre secteur qui décrivent ce qu'elles cherchent
    var kb = el("div", "carte-compte"); c.appendChild(kb);
    kb.appendChild(el("h2", null, "Familles de votre secteur qui cherchent une place"));
    kb.appendChild(el("p", "petit", "Des parents décrivent ce qu'ils cherchent (âge, accueil de loisirs, périscolaire, séjour) ; leur demande part chez 5 structures au plus de leur département. Répondez vite."));
    if (!besoins.length) kb.appendChild(el("p", "og-vide", "Pas encore de demande. Elles arrivent ici et par e-mail dès qu'une famille de votre département décrit son besoin."));
    var TYP = { sejours: "séjour", accueils: "accueil de loisirs", periscolaire: "périscolaire" };
    besoins.forEach(function (d) {
      var a = el("article", "sj-demande" + (d.ouverte ? "" : " sj-masquee") + (d.statut === "nouvelle" ? " sj-neuve" : ""));
      var h = el("div", "sj-d-tete"); h.appendChild(el("b", null, "Enfant" + (d.ages.length > 1 ? "s" : "") + " de " + d.ages.join(", ") + " ans" + ((d.types || []).length ? " · " + d.types.map(function (t) { return TYP[t] || t; }).join(", ") : "")));
      h.appendChild(el("span", "sj-etat sj-d-" + d.statut, { nouvelle: "Nouvelle", en_cours: "En cours", acceptee: "Place proposée", refusee: "Pas de place" }[d.statut] || d.statut)); a.appendChild(h);
      a.appendChild(el("p", "sj-d-infos", [d.quand, d.ville ? d.ville + " (" + d.departement + ")" : d.departement, "reçue le " + E.dateFr(String(d.cree_le).slice(0, 10))].filter(Boolean).join(" · ")));
      var co = el("p", "sj-d-contact"); co.appendChild(el("b", null, d.parent_nom));
      if (d.ouverte) {
        co.appendChild(document.createTextNode(" · ")); var ml = el("a", null, d.email); ml.href = "mailto:" + d.email; co.appendChild(ml);
        if (d.telephone) { co.appendChild(document.createTextNode(" · ")); var tl = el("a", null, d.telephone); tl.href = "tel:" + d.telephone.replace(/[^0-9+]/g, ""); co.appendChild(tl); }
        a.appendChild(co);
        if (d.message) a.appendChild(el("blockquote", "sj-d-message", d.message));
        var acts = el("div", "sj-actions");
        [["acceptee", "J'ai une place", "Bonjour " + d.parent_nom + ",\n\nSuite à votre demande sur Fil Roug'Anim, nous avons une place pour votre enfant. Voici comment l'inscrire : "],
         ["en_cours", "Demander des précisions", "Bonjour " + d.parent_nom + ",\n\nSuite à votre demande sur Fil Roug'Anim, pourriez-vous nous préciser : "]].forEach(function (x) {
          var r = el("a", x[0] === "acceptee" ? "bouton-r" : "bouton-blanc", x[1]);
          r.href = "mailto:" + d.email + "?subject=" + encodeURIComponent("Votre demande sur Fil Roug'Anim") + "&body=" + encodeURIComponent(x[2] + "\n\nBien cordialement,\n" + ((E.structure() || {}).nom || ""));
          r.addEventListener("click", function () { E.sb.rpc("repondre_besoin", { bid: d.id, st: x[0] }).then(function () { d.statut = x[0]; pastilles(); }); });
          acts.appendChild(r);
        });
        var rf = el("button", "bouton-texte", "Pas de place"); rf.type = "button"; rf.addEventListener("click", async function () { await E.sb.rpc("repondre_besoin", { bid: d.id, st: "refusee" }); d.statut = "refusee"; pastilles(); boite(); }); acts.appendChild(rf);
        a.appendChild(acts);
      } else {
        co.appendChild(document.createTextNode(" · coordonnées masquées"));
        var u = el("button", "bouton-texte", "Débloquer →"); u.type = "button"; u.dataset.ongletVers = "abonnement"; co.appendChild(u); a.appendChild(co);
      }
      kb.appendChild(a);
    });
  }
  function demande(d) {
    var b = el("article", "sj-demande" + (d.ouverte ? "" : " sj-masquee") + (d.statut === "nouvelle" ? " sj-neuve" : ""));
    var h = el("div", "sj-d-tete");
    h.appendChild(el("b", null, d.sejour + (d.debut ? " · " + periode(d) : "")));
    h.appendChild(el("span", "sj-etat sj-d-" + d.statut, STATUTS_D[d.statut] || d.statut));
    b.appendChild(h);
    var infos = [d.enfant_prenom ? d.enfant_prenom + ", " + d.enfant_age + " ans" : "Enfant de " + d.enfant_age + " ans", d.nb_enfants > 1 ? d.nb_enfants + " enfants" : null, d.ville, (d.aides || []).map(function (a) { return AIDES[a]; }).join(", ") || null, "reçue le " + E.dateFr(String(d.cree_le).slice(0, 10))].filter(Boolean);
    b.appendChild(el("p", "sj-d-infos", infos.join(" · ")));
    if (d.ouverte) {
      var co = el("p", "sj-d-contact"); co.appendChild(el("b", null, d.parent_nom)); co.appendChild(document.createTextNode(" · "));
      var a = el("a", null, d.parent_email); a.href = "mailto:" + d.parent_email; co.appendChild(a);
      if (d.parent_telephone) { co.appendChild(document.createTextNode(" · ")); var tl = el("a", null, d.parent_telephone); tl.href = "tel:" + d.parent_telephone.replace(/[^0-9+]/g, ""); co.appendChild(tl); }
      b.appendChild(co);
      if (d.message) b.appendChild(el("blockquote", "sj-d-message", d.message));
      var acts = el("div", "sj-actions");
      [["acceptee", "Place disponible", "Bonne nouvelle : il reste une place pour " + (d.enfant_prenom || "votre enfant") + " sur « " + d.sejour + " ». Voici comment finaliser l'inscription : "],
       ["attente", "Liste d'attente", "Le séjour « " + d.sejour + " » est complet pour l'instant : nous inscrivons " + (d.enfant_prenom || "votre enfant") + " sur liste d'attente et vous prévenons dès qu'une place se libère."],
       ["complet", "Complet", "Merci pour votre demande. Le séjour « " + d.sejour + " » est malheureusement complet. Nos autres séjours sont sur notre page Fil Roug'Anim."],
       ["en_cours", "Demander des précisions", "Merci pour votre demande pour « " + d.sejour + " ». Pour vous répondre au mieux, pourriez-vous nous préciser : "]].forEach(function (x) {
        var r = el("a", x[0] === "acceptee" ? "bouton-r" : "bouton-blanc", x[1]);
        r.href = "mailto:" + d.parent_email + "?subject=" + encodeURIComponent("Votre demande : " + d.sejour) + "&body=" + encodeURIComponent("Bonjour " + d.parent_nom + ",\n\n" + x[2] + "\n\nBien cordialement,\n" + ((E.structure() || {}).nom || ""));
        r.addEventListener("click", function () { E.sb.rpc("repondre_demande", { did: d.id, st: x[0] }).then(function () { d.statut = x[0]; pastilles(); setTimeout(boite, 300); }); });
        acts.appendChild(r);
      });
      var rf = el("button", "bouton-texte", "Refuser"); rf.type = "button"; rf.addEventListener("click", async function () { await E.sb.rpc("repondre_demande", { did: d.id, st: "refusee" }); d.statut = "refusee"; pastilles(); boite(); }); acts.appendChild(rf);
      b.appendChild(acts);
    } else {
      var m = el("p", "sj-d-contact"); m.appendChild(el("b", null, d.parent_nom)); m.appendChild(document.createTextNode(" · coordonnées masquées"));
      var u = el("button", "bouton-texte", "Débloquer →"); u.type = "button"; u.dataset.ongletVers = "abonnement"; m.appendChild(u);
      b.appendChild(m);
    }
    return b;
  }

  async function tout() { await charger(); liste(); boite(); pastilles(); }
  window.FRA_SEJOURS = {
    ouvrir: async function (ctx) { E = window.FRA_ESPACE; C = ctx; try { await tout(); } catch (e) { console.error(e); } },
    nouvelles: function () { return demandes.filter(function (d) { return d.statut === "nouvelle"; }).length; },
    nb: function () { return sejours.length; }
  };
})();

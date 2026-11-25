/* Fil Roug'Anim : l'espace parent. Mes enfants, mes demandes et inscriptions (rattachées par l'adresse e-mail du compte),
   le carnet de séjour (les nouvelles de l'équipe, pour les séjours où l'enfant a une place), les favoris et la valise.
   Les données viennent de la base : comptes_parents, enfants, mes_inscriptions(), mon_carnet(), lier_mes_demandes(). */
(function () {
  "use strict";
  var E = null, C = null, compte = null, enfants = [], inscriptions = [], carnet = [];
  var STATUTS = { nouvelle: ["Envoyée", ""], en_cours: ["En cours", "jaune"], acceptee: ["Place confirmée", "ok"], attente: ["Liste d'attente", "jaune"], refusee: ["Pas de place", "neutre"], complet: ["Complet", "neutre"] };
  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function favoris() { try { return JSON.parse(localStorage.getItem("fra-favoris") || "[]"); } catch (e) { return []; } }
  function age(a) { return a ? new Date().getFullYear() - a : null; }

  async function charger() {
    var r = await Promise.all([E.sb.from("comptes_parents").select("*").eq("id", C.id).maybeSingle(), E.sb.from("enfants").select("*").eq("parent_id", C.id).order("cree_le")]);
    compte = r[0].data; enfants = r[1].data || [];
    if (compte) {
      await E.sb.rpc("lier_mes_demandes");
      var x = await Promise.all([E.sb.rpc("mes_inscriptions"), E.sb.rpc("mon_carnet")]);
      inscriptions = (x[0] && x[0].data) || []; carnet = (x[1] && x[1].data) || [];
    }
  }
  function etat() {
    var st = $("statut-parent"); st.hidden = true;  // le « À suivre » du tableau de bord dit déjà tout : pas de bandeau répété sur chaque page
    if (!compte) return;
    var conf = inscriptions.filter(function (i) { return i.statut === "acceptee"; }).length;
    st.className = "statut statut-ok";
    st.textContent = conf ? conf + " place" + (conf > 1 ? "s" : "") + " confirmée" + (conf > 1 ? "s" : "") + " : les nouvelles de l'équipe arrivent dans « Carnet de séjour » et par e-mail." : "Votre espace parent est prêt. Demandez une place sur une fiche : elle apparaît ici, avec sa réponse.";
    var p = document.querySelector('[data-pastille-parent="carnet"]'); if (p) { var n = carnet.filter(function (c) { return (Date.now() - new Date(c.cree_le)) < 3 * 864e5; }).length; p.hidden = !n; p.textContent = n; }
  }

  /* ---------- l'accueil de l'espace ---------- */
  // une pastille d'état, la même que dans les autres espaces
  function pastille(statut) { var s = STATUTS[statut] || [statut, ""]; return el("span", "tb2-etat tb2-etat-" + (s[1] === "ok" ? "vert" : s[1] === "jaune" ? "jaune" : "gris"), s[0]); }
  function carte(c, titre, lien, vers) {
    var k = el("div", "carte-compte pa-k"), h = el("div", "pa-k-tete"); h.appendChild(el("h2", null, titre));
    if (lien) { var b = el("button", "tb2-lien", lien + " →"); b.type = "button"; b.dataset.ongletVers = vers; h.appendChild(b); }
    k.appendChild(h); c.appendChild(k); return k;
  }
  function tableau() {
    var c = $("pa-tableau"); c.textContent = "";
    var auj = new Date().toISOString().slice(0, 10);
    // 1. à faire / à suivre : seulement ce qui demande un geste
    var faire = [];
    if (!compte) faire.push(["Créez votre espace parent", "Votre nom et votre ville suffisent.", "enfants"]);
    else if (!enfants.length) faire.push(["Ajoutez vos enfants", "Leur prénom et leur année de naissance : vos demandes se remplissent plus vite.", "enfants"]);
    var proch = inscriptions.filter(function (i) { return i.statut === "acceptee" && i.debut && i.fin >= auj; }).sort(function (a, b) { return a.debut.localeCompare(b.debut); })[0];
    if (proch) { var j = Math.round((new Date(proch.debut) - new Date(auj)) / 864e5);
      faire.push([(j > 0 ? "Départ dans " + j + " jour" + (j > 1 ? "s" : "") : j === 0 ? "Départ aujourd'hui" : "Séjour en cours") + " : " + proch.sejour, (proch.enfant_prenom || "Votre enfant") + " · " + E.dateFr(proch.debut) + " → " + E.dateFr(proch.fin) + ". La fiche, le trousseau et les infos pratiques sont sur la page du séjour.", null, proch.url]); }
    var recentes = carnet.filter(function (x) { return (Date.now() - new Date(x.cree_le)) < 3 * 864e5; }).length;
    if (recentes) faire.push([recentes + " nouvelle" + (recentes > 1 ? "s" : "") + " de l'équipe", "Dans le carnet de séjour.", "carnet"]);
    var attente = inscriptions.filter(function (i) { return i.statut === "nouvelle" || i.statut === "en_cours"; }).length;
    if (attente) faire.push([attente + " demande" + (attente > 1 ? "s" : "") + " en attente de réponse", "La structure vous répond par e-mail : pensez à regarder vos courriers indésirables.", "inscriptions"]);
    var k1 = carte(c, "À suivre");
    if (!faire.length) k1.appendChild(el("p", "og-vide", "Rien en attente. Trouvez une colo, un mini-séjour ou un accueil de loisirs dans les offres."));
    faire.forEach(function (x) {
      var l = el("div", "pa-afaire"), t = el("div"); t.appendChild(el("b", null, x[0])); t.appendChild(el("small", null, x[1])); l.appendChild(t);
      if (x[2]) { var b = el("button", "tb2-lien", "Ouvrir →"); b.type = "button"; b.dataset.ongletVers = x[2]; l.appendChild(b); }
      else if (x[3]) { var a = el("a", "tb2-lien", "La fiche →"); a.href = x[3]; a.target = "_blank"; a.rel = "noopener"; l.appendChild(a); }
      k1.appendChild(l);
    });
    // 2. les dernières demandes
    if (inscriptions.length) { var k2 = carte(c, "Vos dernières demandes", "Toutes", "inscriptions"); k2.appendChild(tableInscriptions(inscriptions.slice(0, 4), true)); }
    // 3. la dernière nouvelle du carnet
    if (carnet.length) { var k3 = carte(c, "La dernière nouvelle", "Le carnet", "carnet"), x = carnet[0];
      k3.appendChild(el("p", "pa-c-sur", E.dateFr(x.jour) + " · " + x.sejour)); if (x.titre) k3.appendChild(el("h3", null, x.titre)); k3.appendChild(el("p", "pa-c-texte", x.texte)); }
    if (!compte) return;
    var duo = el("div", "pa-duo"); c.appendChild(duo);
    // 4. mes enfants : l'âge cette année, ce à quoi ils ont droit (Pass Colo l'année des 11 ans, report l'année des 12 ans)
    var k4 = carte(duo, "Mes enfants", enfants.length ? "Gérer" : "Ajouter", "enfants");
    if (!enfants.length) k4.appendChild(el("p", "og-vide", "Ajoutez vos enfants : vous verrez ici les aides auxquelles ils ont droit et les séjours de leur âge."));
    enfants.forEach(function (x) {
      var a = age(x.annee_naissance), l = el("div", "pa-enfant"), t = el("div");
      l.appendChild(el("span", "pa-enfant-i", (x.prenom || "?").charAt(0).toUpperCase()));
      t.appendChild(el("b", null, x.prenom)); t.appendChild(el("small", null, a ? a + " ans cette année" : "Année de naissance non précisée"));
      var badges = el("div", "pa-badges");
      if (a === 11) badges.appendChild(el("span", "tb2-etat tb2-etat-vert", "Pass Colo : jusqu'à 350 €"));
      else if (a === 12) badges.appendChild(el("span", "tb2-etat tb2-etat-jaune", "Pass Colo : encore possible s'il n'a pas servi"));
      if (a && a >= 4 && a <= 17) badges.appendChild(el("span", "tb2-etat tb2-etat-gris", a < 6 ? "Mini-séjours dès 4 ans" : a < 12 ? "Colos 6-11 ans" : "Séjours ados"));
      t.appendChild(badges); l.appendChild(t); k4.appendChild(l);
    });
    if (enfants.some(function (x) { var a = age(x.annee_naissance); return a === 11 || a === 12; })) {
      var ap = el("a", "tb2-lien pa-k-pied", "Calculer le reste à payer avec les aides →"); ap.href = "/enfants/aides/"; k4.appendChild(ap); }
    // 5. suivre un séjour avec le code donné par la structure
    var k5 = carte(duo, "Suivre un séjour", null);
    k5.appendChild(el("p", "petit", "La structure vous a donné un code pour le carnet de séjour ? Entrez-le : les nouvelles de l'équipe arrivent ici et par e-mail, même si vous avez inscrit votre enfant ailleurs."));
    k5.appendChild(formCode());
    // 6. préparer le départ : une liste à cocher, gardée dans ce navigateur
    var k6 = carte(c, "Préparer le départ");
    var cles = [["fiche", "Remplir la fiche sanitaire de liaison", "/enfants/fiche-sanitaire-de-liaison/"], ["valise", "Préparer la valise avec lui, et tout marquer à son nom", "/enfants/trousseau-de-colo/"],
                ["aides", "Demander les aides (Pass Colo, CAF, CSE)", "/enfants/aides/"], ["papiers", "Glisser les papiers : carte Vitale, ordonnances, pièce d'identité", "/enfants/trousseau-de-colo/"],
                ["parler", "En parler sans dramatiser : le programme, l'équipe, les nouvelles", "/blog/preparer-le-premier-depart-de-son-enfant/"]];
    var faits = {}; try { faits = JSON.parse(localStorage.getItem("fra-depart") || "{}"); } catch (e) {}
    var ul = el("ul", "pa-check"); k6.appendChild(ul);
    cles.forEach(function (x) {
      var li = el("li"), lab = el("label"), cb = el("input"); cb.type = "checkbox"; cb.checked = !!faits[x[0]];
      cb.addEventListener("change", function () { faits[x[0]] = cb.checked; try { localStorage.setItem("fra-depart", JSON.stringify(faits)); } catch (e) {} li.classList.toggle("fait", cb.checked); });
      lab.appendChild(cb); lab.appendChild(el("span", null, x[1])); li.appendChild(lab);
      var a = el("a", "tb2-lien", "Le guide →"); a.href = x[2]; li.appendChild(a); if (cb.checked) li.classList.add("fait"); ul.appendChild(li);
    });
  }
  // le petit formulaire « code du séjour » (accueil de l'espace et onglet carnet)
  function formCode() {
    var f = el("form", "pa-code"), ip = el("input"); ip.name = "code"; ip.placeholder = "Code du séjour"; ip.required = true; ip.maxLength = 12; ip.autocomplete = "off"; ip.setAttribute("autocapitalize", "characters");
    var b = el("button", "bouton-blanc", "Suivre"); b.type = "submit"; f.appendChild(ip); f.appendChild(b);
    f.addEventListener("submit", async function (e) { e.preventDefault(); await ajouterCode(ip.value); });
    return f;
  }
  async function ajouterCode(v) {
    var code = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (!code) return;
    var r = await E.sb.rpc("ajouter_code_carnet", { code: code });
    if (r.error) return E.message(E.erreur(r.error), true);
    E.message("C'est noté : les nouvelles de « " + r.data.titre + " » arrivent dans votre carnet et par e-mail.");
    await tout();
  }
  function tableInscriptions(liste, court) {
    var t = el("div", "ls-table ls-pa-i"), e = el("div", "ls-rang ls-entete");
    ["Séjour ou accueil", "Dates", "Enfant", "Réponse", ""].forEach(function (x) { e.appendChild(el("span", null, x)); }); t.appendChild(e);
    liste.forEach(function (i) {
      var r = el("div", "ls-rang"), q = el("span", "ls-qui"), a = el("a", null, i.sejour); a.href = i.url; a.target = "_blank"; a.rel = "noopener";
      var bb = el("b"); bb.appendChild(a); q.appendChild(bb); q.appendChild(el("small", null, i.structure + " · demandée le " + E.dateFr(String(i.cree_le).slice(0, 10)))); r.appendChild(q);
      r.appendChild(el("span", "ls-doux", i.debut ? E.dateFr(i.debut) + " → " + E.dateFr(i.fin) : "–"));
      r.appendChild(el("span", "ls-doux", (i.enfant_prenom || "Enfant") + (i.enfant_age ? ", " + i.enfant_age + " ans" : "")));
      var st = el("span"); st.appendChild(pastille(i.statut)); r.appendChild(st);
      var fin = el("span", "ls-fin");
      if (!court && i.structure_email) { var m = el("a", "tb2-lien", "Écrire"); m.href = "mailto:" + i.structure_email + "?subject=" + encodeURIComponent("Inscription : " + i.sejour); fin.appendChild(m); }
      r.appendChild(fin); t.appendChild(r);
    });
    return t;
  }

  /* ---------- mes enfants ---------- */
  function pageEnfants() {
    var c = $("pa-enfants"); c.textContent = "";
    var k = el("div", "carte-compte"); c.appendChild(k);
    if (!compte) {
      k.appendChild(el("p", "petit", "Votre nom et votre ville suffisent. Vos demandes déjà envoyées avec cette adresse e-mail apparaîtront tout de suite."));
      var f = el("form", "formulaire"), g = el("div", "champs-2"); f.appendChild(g);
      [["nom", "Votre nom", "text", true], ["telephone", "Téléphone (facultatif)", "tel"], ["ville", "Votre ville", "text"]].forEach(function (x) {
        var l = el("label", "champ"); l.appendChild(el("span", null, x[1])); var i = el("input"); i.type = x[2]; i.name = x[0]; i.maxLength = 120; if (x[3]) i.required = true; l.appendChild(i); g.appendChild(l); });
      var acc = el("label", "case-accord"), cb = el("input"); cb.type = "checkbox"; cb.required = true; acc.appendChild(cb); acc.appendChild(document.createTextNode(" J'accepte les conditions d'utilisation et la politique de confidentialité.")); f.appendChild(acc);
      var b = el("button", "bouton-r", "Créer mon espace"); b.type = "submit"; f.appendChild(b);
      f.addEventListener("submit", async function (e) {
        e.preventDefault(); b.disabled = true;
        var r = await E.sb.from("comptes_parents").insert({ id: C.id, nom: f.nom.value.trim(), telephone: f.telephone.value.trim() || null, ville: f.ville.value.trim() || null });
        b.disabled = false; if (r.error) return E.message(E.erreur(r.error), true);
        await tout(); E.message("Votre espace parent est créé. Ajoutez vos enfants ci-dessous.");
      });
      k.appendChild(f); return;
    }
    k.appendChild(el("p", "petit", "La fiche sanitaire se remplit avec l'organisateur, jamais ici."));
    var ul = el("ul", "pa-enfants");
    enfants.forEach(function (x) {
      var li = el("li"); li.appendChild(el("b", null, x.prenom)); li.appendChild(el("span", null, x.annee_naissance ? age(x.annee_naissance) + " ans cette année" : ""));
      var r = el("button", "bouton-texte", "Retirer"); r.type = "button"; r.addEventListener("click", async function () { await E.sb.from("enfants").delete().eq("id", x.id); await tout(); }); li.appendChild(r);
      ul.appendChild(li);
    });
    if (!enfants.length) ul.appendChild(el("li", "og-vide", "Aucun enfant pour l'instant."));
    k.appendChild(ul);
    var f2 = el("form", "pa-ajout"), ip = el("input"); ip.name = "prenom"; ip.placeholder = "Prénom"; ip.required = true; ip.maxLength = 60;
    var ia = el("input"); ia.name = "annee"; ia.type = "number"; ia.min = 2005; ia.max = 2030; ia.placeholder = "Année de naissance";
    var b2 = el("button", "bouton-blanc", "+ Ajouter"); b2.type = "submit"; f2.appendChild(ip); f2.appendChild(ia); f2.appendChild(b2);
    f2.addEventListener("submit", async function (e) {
      e.preventDefault(); var r = await E.sb.from("enfants").insert({ parent_id: C.id, prenom: ip.value.trim(), annee_naissance: ia.value ? parseInt(ia.value, 10) : null });
      if (r.error) return E.message(E.erreur(r.error), true); await tout();
    });
    k.appendChild(f2);
    try { localStorage.setItem("fra-enfants", JSON.stringify(enfants.map(function (x) { return { p: x.prenom, a: age(x.annee_naissance) }; }))); } catch (e) {}
  }

  /* ---------- mes demandes et inscriptions ---------- */
  function pageInscriptions() {
    var c = $("pa-inscriptions"); c.textContent = "";
    var k = el("div", "carte-compte"); c.appendChild(k);
    if (!inscriptions.length) { k.appendChild(el("p", "og-vide", "Pas encore de demande. Choisissez une offre et cliquez sur « Demander une place »."));
      var a0 = el("a", "bouton-r", "Voir les offres"); a0.href = "/enfants/"; k.appendChild(a0); return; }
    k.appendChild(tableInscriptions(inscriptions, false));
  }

  /* ---------- le carnet de séjour ---------- */
  function pageCarnet() {
    var c = $("pa-carnet"); c.textContent = "";
    if (compte) { var kc = el("div", "carte-compte pa-code-k"); kc.appendChild(el("p", "petit", "Un code donné par la structure ? Entrez-le pour suivre le séjour ici et par e-mail.")); kc.appendChild(formCode()); c.appendChild(kc); }
    var k = el("div", "carte-compte"); c.appendChild(k);
    if (!carnet.length) { k.appendChild(el("p", "og-vide", inscriptions.some(function (i) { return i.statut === "acceptee"; }) ? "Pas encore de nouvelle : elles arrivent pendant le séjour." : "Le carnet s'ouvre quand une structure confirme une place, ou avec le code du séjour qu'elle vous donne pour votre enfant.")); return; }
    var fil = el("ol", "pa-carnet");
    carnet.forEach(function (x) {
      var li = el("li"); li.appendChild(el("p", "pa-c-sur", E.dateFr(x.jour) + " · " + x.sejour + (x.auteur ? " · " + x.auteur : "")));
      if (x.titre) li.appendChild(el("h3", null, x.titre));
      li.appendChild(el("p", "pa-c-texte", x.texte)); fil.appendChild(li);
    });
    k.appendChild(fil);
  }

  /* ---------- mes offres gardées (favoris, gardés dans ce navigateur) ---------- */
  function pageFavoris() {
    var c = $("pa-favoris"); c.textContent = "";
    var k = el("div", "carte-compte"); c.appendChild(k);
    var f = favoris();
    if (!f.length) { k.appendChild(el("p", "og-vide", "Rien de gardé pour l'instant.")); return; }
    var ul = el("ul", "pa-enfants");
    f.forEach(function (x) { var li = el("li"), a = el("a", null, x.t); a.href = x.u; li.appendChild(a); li.appendChild(el("span", null, x.s || ""));
      var r = el("button", "bouton-texte", "Retirer"); r.type = "button"; r.addEventListener("click", function () { try { localStorage.setItem("fra-favoris", JSON.stringify(favoris().filter(function (y) { return y.u !== x.u; }))); } catch (e) {} pageFavoris(); }); li.appendChild(r);
      ul.appendChild(li); });
    k.appendChild(ul);
  }

  async function tout() {
    await charger();
    etat(); tableau(); pageEnfants(); pageInscriptions(); pageCarnet(); pageFavoris();
    if (window.FRA_PARENT.apres) window.FRA_PARENT.apres(compte);
  }
  window.FRA_PARENT = {
    ouvrir: async function (ctx) {
      E = window.FRA_ESPACE; C = ctx; await tout();
      var m = location.search.match(/[?&]code=([A-Za-z0-9-]{4,16})/);
      if (m && compte) { await ajouterCode(m[1]); try { history.replaceState(null, "", location.pathname + "?onglet=carnet"); } catch (e) {} }
      return compte;
    },
    compte: function () { return compte; }, inscriptions: function () { return inscriptions; }
  };
})();

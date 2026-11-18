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
    var st = $("statut-parent"); st.hidden = !compte; if (!compte) return;
    var conf = inscriptions.filter(function (i) { return i.statut === "acceptee"; }).length;
    st.className = "statut statut-ok";
    st.textContent = conf ? conf + " place" + (conf > 1 ? "s" : "") + " confirmée" + (conf > 1 ? "s" : "") + " : les nouvelles de l'équipe arrivent dans « Carnet de séjour » et par e-mail." : "Votre espace parent est prêt. Demandez une place sur une fiche : elle apparaît ici, avec sa réponse.";
    var p = document.querySelector('[data-pastille-parent="carnet"]'); if (p) { var n = carnet.filter(function (c) { return (Date.now() - new Date(c.cree_le)) < 3 * 864e5; }).length; p.hidden = !n; p.textContent = n; }
  }

  /* ---------- l'accueil de l'espace ---------- */
  function tableau() {
    var c = $("pa-tableau"); c.textContent = "";
    var h = el("div", "og-hero"), t = el("div");
    t.appendChild(el("p", "og-sur", "votre espace parent"));
    var h2 = el("h2"); h2.appendChild(document.createTextNode("Bonjour, ")); h2.appendChild(el("em", null, compte ? compte.nom : "bienvenue")); t.appendChild(h2);
    t.appendChild(el("p", "og-hero-p", "Vos demandes de place et leurs réponses, les nouvelles de l'équipe pendant le séjour, vos enfants et vos offres gardées : tout au même endroit."));
    var bs = el("div", "og-boutons");
    [["/enfants/", "Voir les offres", true], ["/enfants/demande/", "Décrire mon besoin", false]].forEach(function (x) { var a = el("a", x[2] ? "bouton-r" : "bouton-blanc", x[1]); a.href = x[0]; bs.appendChild(a); });
    t.appendChild(bs); h.appendChild(t);
    var k = el("div", "og-hero-cote"); k.appendChild(el("p", "og-mini", "En ce moment"));
    [[inscriptions.length, "demandes envoyées"], [inscriptions.filter(function (i) { return i.statut === "acceptee"; }).length, "places confirmées"], [carnet.length, "nouvelles du carnet"]].forEach(function (x) {
      var l = el("p", "og-cote-l"); l.appendChild(el("b", null, String(x[0]))); l.appendChild(el("span", null, x[1])); k.appendChild(l); });
    h.appendChild(k); c.appendChild(h);
    // le prochain départ
    var auj = new Date().toISOString().slice(0, 10);
    var proch = inscriptions.filter(function (i) { return i.statut === "acceptee" && i.debut && i.fin >= auj; }).sort(function (a, b) { return a.debut.localeCompare(b.debut); })[0];
    if (proch) {
      var d = el("article", "og-carte pa-depart"); d.appendChild(el("h3", null, "Le prochain départ"));
      var j = Math.round((new Date(proch.debut) - new Date(auj)) / 864e5);
      d.appendChild(el("p", "pa-j", j > 0 ? "J-" + j : j === 0 ? "C'est aujourd'hui !" : "En ce moment"));
      d.appendChild(el("p", null, (proch.enfant_prenom || "Votre enfant") + " · " + proch.sejour + " · " + E.dateFr(proch.debut) + " → " + E.dateFr(proch.fin)));
      var a = el("a", "bouton-blanc", "La fiche, le trousseau et les infos pratiques"); a.href = proch.url; a.target = "_blank"; a.rel = "noopener"; d.appendChild(a);
      c.appendChild(d);
    }
  }

  /* ---------- mes enfants ---------- */
  function pageEnfants() {
    var c = $("pa-enfants"); c.textContent = "";
    var k = el("div", "carte-compte"); c.appendChild(k);
    k.appendChild(el("h2", null, compte ? "Mes enfants" : "Créer mon espace parent"));
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
    k.appendChild(el("p", "petit", "Leur prénom et leur année de naissance : de quoi remplir vos demandes plus vite. Aucune information de santé ici : la fiche sanitaire se remplit avec l'organisateur."));
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
    var k = el("div", "carte-compte"); c.appendChild(k); k.appendChild(el("h2", null, "Mes demandes et inscriptions"));
    k.appendChild(el("p", "petit", "Chaque demande de place envoyée avec l'adresse de ce compte, et sa réponse. Quand la structure confirme une place, l'inscription se termine directement avec elle."));
    if (!inscriptions.length) { k.appendChild(el("p", "og-vide", "Pas encore de demande. Choisissez une offre et cliquez sur « Demander une place »."));
      var a0 = el("a", "bouton-r", "Voir les offres"); a0.href = "/enfants/"; k.appendChild(a0); return; }
    inscriptions.forEach(function (i) {
      var b = el("div", "og-facture"), t = el("div");
      var a = el("a", null, i.sejour); a.href = i.url; a.target = "_blank"; a.rel = "noopener"; var bb = el("b"); bb.appendChild(a); t.appendChild(bb);
      t.appendChild(el("small", null, i.structure + (i.debut ? " · " + E.dateFr(i.debut) + " → " + E.dateFr(i.fin) : "") + " · " + (i.enfant_prenom || "enfant") + ", " + i.enfant_age + " ans · demandée le " + E.dateFr(String(i.cree_le).slice(0, 10))));
      b.appendChild(t);
      var s = STATUTS[i.statut] || [i.statut, ""]; b.appendChild(el("span", "og-etiq og-" + (s[1] === "ok" ? "actif" : s[1] === "neutre" ? "annule" : "reserve"), s[0]));
      if (i.structure_email) { var m = el("a", "bouton-blanc", "Écrire à la structure"); m.href = "mailto:" + i.structure_email + "?subject=" + encodeURIComponent("Inscription : " + i.sejour); b.appendChild(m); }
      k.appendChild(b);
    });
  }

  /* ---------- le carnet de séjour ---------- */
  function pageCarnet() {
    var c = $("pa-carnet"); c.textContent = "";
    var k = el("div", "carte-compte"); c.appendChild(k); k.appendChild(el("h2", null, "Le carnet de séjour"));
    k.appendChild(el("p", "petit", "Pendant le séjour, l'équipe raconte la journée : activités, sorties, veillées. Vous recevez aussi chaque nouvelle par e-mail. Réservé aux familles dont l'enfant a une place confirmée."));
    if (!carnet.length) { k.appendChild(el("p", "og-vide", inscriptions.some(function (i) { return i.statut === "acceptee"; }) ? "Pas encore de nouvelle : elles arrivent pendant le séjour." : "Le carnet s'ouvre quand une structure confirme une place pour votre enfant.")); return; }
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
    var k = el("div", "carte-compte"); c.appendChild(k); k.appendChild(el("h2", null, "Mes offres gardées"));
    k.appendChild(el("p", "petit", "Sur chaque fiche, « ♡ Garder » met l'offre de côté ici, pour comparer tranquillement (gardé dans ce navigateur)."));
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
    ouvrir: async function (ctx) { E = window.FRA_ESPACE; C = ctx; await tout(); return compte; },
    compte: function () { return compte; }
  };
})();

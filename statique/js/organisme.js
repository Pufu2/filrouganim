/* Fil Roug'Anim : l'espace des organismes de formation. Leur fiche, le choix de leurs départements sur la carte
   (un seul partenaire par département, deux dans les plus grands), leurs clics, leurs factures et leurs statistiques.
   La formule est payée au clic (1 €, 0,50 € au lancement), plafonnée au prix annuel du département (zones_tarifs,
   d'après les jeunes de 15 à 24 ans, les sessions du site et les recherches Google). Un clic n'est compté qu'une fois
   par personne, par organisme et par jour, sans les robots (compter_organisme) ; la facture du mois échu est faite
   par outils/abonnements.py, et l'organisme voit chaque clic compté, jour par jour (mes_clics). */
(function () {
  "use strict";
  var E = null, C = null, compte = null, zones = [], parts = [], carte = null, choix = {}, stats = null, clics = [], fact = [];
  var PALIERS = { 1: ["Très grands départements", "p1"], 2: ["Grands départements", "p2"], 3: ["Départements moyens", "p3"], 4: ["Départements ruraux", "p4"] };
  function $(id) { return document.getElementById(id); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function euros(n) { n = Number(n || 0); return n.toLocaleString("fr-FR", n % 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {}) + " €"; }
  function prixDe(z) { return lancementOuvert ? Math.round(z.prix / 2) : z.prix; }
  function prixClic() { return lancementOuvert ? "0,50 €" : "1 €"; }
  function enCours(p) { return ["actif", "reserve", "facture"].indexOf(p.statut) >= 0; }
  var lancementOuvert = true;

  async function charger() {
    var r = await Promise.all([
      E.sb.from("comptes_organismes").select("*").eq("id", C.id).maybeSingle(),
      E.sb.rpc("zones_disponibles"),
      E.sb.from("partenariats").select("*").eq("compte", C.id).order("cree_le", { ascending: false }),
      E.sb.rpc("lancement_ouvert"),
      E.sb.from("factures_clics").select("*").eq("compte", C.id).order("mois", { ascending: false })
    ]);
    fact = (r[4] && r[4].data) || [];
    lancementOuvert = !(r[3] && r[3].data === false);
    compte = r[0].data; zones = (r[1].data || []); parts = (r[2].data || []);
    if (compte && compte.verifie && compte.organisme_id) {
      var d = new Date(); d.setDate(d.getDate() - 29);
      var s = await E.sb.from("stats_organismes").select("type,n,jour").eq("organisme", compte.organisme_id).gte("jour", d.toISOString().slice(0, 10));
      stats = { vue_page: 0, clic_session: 0, clic_site: 0 };
      (s.data || []).forEach(function (x) { stats[x.type] = (stats[x.type] || 0) + x.n; });
      var d2 = new Date(); d2.setDate(d2.getDate() - 62);
      var m = await E.sb.rpc("mes_clics", { depuis: d2.toISOString().slice(0, 10), jusqua: new Date().toISOString().slice(0, 10) });
      clics = (m && m.data) || [];
    }
    if (!carte) { try { carte = await (await fetch(E.L.carte)).json(); } catch (e) { carte = null; } }
  }
  function etat() {
    var st = $("statut-organisme"); st.hidden = true; st.className = "statut";  // le « À suivre » du tableau de bord le dit déjà
    if (!compte) { st.textContent = "Bienvenue ! Présentez votre organisme : votre fiche, puis vos départements."; st.className = "statut statut-attente"; return; }
    var actifs = parts.filter(function (p) { return p.statut === "actif"; }).length, attente = parts.filter(function (p) { return p.statut === "facture" || p.statut === "reserve"; }).length;
    if (actifs) { st.textContent = "Partenaire de Fil Roug'Anim dans " + actifs + " département" + (actifs > 1 ? "s" : "") + " : vos sessions y sont mises en avant. Vous payez seulement les clics, chaque mois."; st.className = "statut statut-ok"; }
    else if (attente) { st.textContent = "Vos départements sont réservés pour vous. Ils s'activent dès que nous avons vérifié votre fiche (sous 2 jours ouvrés)."; st.className = "statut statut-attente"; }
    else if (!compte.verifie) { st.textContent = "Fiche enregistrée. Nous la relions à vos sessions sur le site (sous 2 jours ouvrés). Vous pouvez déjà choisir vos départements."; st.className = "statut statut-attente"; }
    else st.textContent = "Votre fiche est reliée à vos sessions. Choisissez vos départements pour les mettre en avant.";
    var p = document.querySelector('[data-pastille-org="factures"]'), n = fact.filter(function (x) { return x.statut === "facture"; }).length;
    if (p) { p.hidden = !n; p.textContent = n; }
  }

  /* ---------- tableau de bord ---------- */
  var ETATS_P = { reserve: ["En vérification", "jaune"], facture: ["Actif", "vert"], actif: ["Actif", "vert"], expire: ["Terminé", "gris"], annule: ["Arrêté", "gris"] };
  var ETATS_F = { a_facturer: ["En préparation", "gris"], facture: ["À payer", "jaune"], payee: ["Payée", "vert"], offerte: ["Offerte (moins de 10 €)", "gris"], annulee: ["Annulée", "gris"] };
  function pastille(e) { return el("span", "tb2-etat tb2-etat-" + e[1], e[0]); }
  function carteK(c, titre, lien, vers) {
    var k = el("div", "carte-compte pa-k"), h = el("div", "pa-k-tete"); h.appendChild(el("h2", null, titre));
    if (lien) { var b = el("button", "tb2-lien", lien + " →"); b.type = "button"; b.dataset.ongletVers = vers; h.appendChild(b); }
    k.appendChild(h); c.appendChild(k); return k;
  }
  function tableau() {
    var c = $("og-tableau"); c.textContent = "";
    var actifs = parts.filter(enCours), aPayer = fact.filter(function (x) { return x.statut === "facture"; });
    // 1. à suivre : seulement ce qui demande un geste
    var faire = [];
    if (!compte) faire.push(["Présentez votre organisme", "Votre fiche d'abord, puis vos départements.", "fiche"]);
    else {
      if (!compte.verifie) faire.push(["Fiche en vérification", "Nous la relions à vos sessions sur le site, sous 2 jours ouvrés. Vous pouvez déjà choisir vos départements.", null]);
      if (!compte.presentation || compte.presentation.length < 80) faire.push(["Complétez votre présentation", "Pédagogie, formules, accompagnement, aides : c'est elle qui décide un futur stagiaire à cliquer chez vous.", "fiche"]);
      if (!compte.inscription) faire.push(["Ajoutez votre page d'inscription", "Le bouton « S'inscrire chez vous » y mènera.", "fiche"]);
      if (!actifs.length) faire.push(["Choisissez vos départements", "Un seul partenaire par département : les plus demandés partent en premier.", "zones"]);
      aPayer.forEach(function (x) { faire.push(["Facture à payer : " + euros(x.montant), "Clics de " + new Date(x.mois + "T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) + ", à régler sous 30 jours.", "factures"]); });
    }
    var k1 = carteK(c, "À suivre");
    if (!faire.length) k1.appendChild(el("p", "og-vide", "Rien en attente : vos sessions sont en tête de vos départements."));
    faire.forEach(function (x) {
      var l = el("div", "pa-afaire"), t = el("div"); t.appendChild(el("b", null, x[0])); t.appendChild(el("small", null, x[1])); l.appendChild(t);
      if (x[2]) { var b = el("button", "tb2-lien", "Ouvrir →"); b.type = "button"; b.dataset.ongletVers = x[2]; l.appendChild(b); }
      k1.appendChild(l);
    });
    // 2. les chiffres
    var mois = new Date().toISOString().slice(0, 7), ce = 0, tous = 0;
    clics.forEach(function (x) { if (String(x.jour).slice(0, 7) === mois) { ce += x.facturables; tous += x.tous; } });
    var ch = el("div", "tb2-chiffres pa-chiffres"); c.appendChild(ch);
    [["Vues de votre page · 30 j", stats && stats.vue_page], ["Clics vers vos sessions · 30 j", stats && stats.clic_session], ["Clics vers votre site · 30 j", stats && stats.clic_site],
     ["Clics comptés ce mois-ci", actifs.length ? ce : null, actifs.length ? "sur " + tous + " clics au total" : "dès votre premier département"]].forEach(function (x) {
      var d = el("div", "tb2-chiffre"); d.appendChild(el("p", "tb2-l", x[0])); d.appendChild(el("p", "tb2-v", x[1] == null ? "–" : Number(x[1]).toLocaleString("fr-FR")));
      d.appendChild(el("p", "tb2-s", x[2] || (stats ? "sur les 30 derniers jours" : "dès que votre fiche est reliée"))); ch.appendChild(d);
    });
    // 3. les départements
    var k2 = carteK(c, "Vos départements", actifs.length ? "Clics et factures" : "Choisir", actifs.length ? "factures" : "zones");
    if (!actifs.length) {
      k2.appendChild(el("p", "og-vide", "Aucun pour l'instant. Dans vos départements partenaires :"));
      var ul = el("ul", "og-liste");
      ["vos sessions seules en tête des pages du département et de ses villes ;", "un bouton « S'inscrire chez vous » sur chacune de ces pages ;", "l'étiquette « Partenaire » sur toutes vos sessions, partout en France ;", "vous ne payez que les clics, avec un plafond par département."].forEach(function (x) { ul.appendChild(el("li", null, x)); });
      k2.appendChild(ul);
    } else k2.appendChild(tableDeps(actifs, false));
  }
  function tableDeps(liste, avecArret) {
    var t = el("div", "ls-table ls-org-d"), e = el("div", "ls-rang ls-entete");
    ["Département", "Prix du clic", "Plafond par an", "État", ""].forEach(function (x) { e.appendChild(el("span", null, x)); }); t.appendChild(e);
    liste.forEach(function (p) {
      var z = zone(p.departement) || {}, r = el("div", "ls-rang"), q = el("span", "ls-qui");
      q.appendChild(el("b", null, (z.nom || p.departement) + " (" + p.departement + ")")); q.appendChild(el("small", null, (p.lancement ? "tarif de lancement" : "") + (p.debut ? (p.lancement ? " · " : "") + "depuis le " + E.dateFr(p.debut) : ""))); r.appendChild(q);
      r.appendChild(el("span", "ls-doux", euros(p.prix_clic || 1)));
      r.appendChild(el("span", "ls-doux", euros(p.prix)));
      var st = el("span"); st.appendChild(pastille(ETATS_P[p.statut] || [p.statut, "gris"])); r.appendChild(st);
      var fin = el("span", "ls-fin");
      if (avecArret && (p.statut === "actif" || p.statut === "reserve")) {
        var x = el("button", "tb2-lien ls-danger", "Arrêter"); x.type = "button";
        x.addEventListener("click", async function () {
          if (!confirm("Arrêter " + (z.nom || p.departement) + " ? Le mois en cours sera facturé selon les clics déjà comptés, et le département redevient libre pour les autres organismes.")) return;
          var rr = await E.sb.rpc("arreter_partenariat", { pid: p.id }); if (rr.error) { E.message(E.erreur(rr.error), true); return; }
          await tout(); E.message("C'est arrêté.");
        });
        fin.appendChild(x);
      }
      r.appendChild(fin); t.appendChild(r);
    });
    return t;
  }
  function zone(d) { return zones.filter(function (z) { return z.departement === d; })[0]; }

  /* ---------- la fiche ---------- */
  var CHAMPS = [["nom", "Nom de l'organisme", "text", true], ["habilitation", "Habilitation BAFA-BAFD", "select"], ["site", "Site internet", "lien"],
                ["inscription", "Page de vos sessions ou d'inscription", "lien"], ["email_contact", "E-mail de contact", "email"], ["telephone", "Téléphone", "tel"],
                ["presentation", "Présentation (ce qui vous distingue : pédagogie, formules, accompagnement, aides…)", "texte"]];
  function fiche() {
    var c = $("og-fiche"); c.textContent = "";
    var k = el("div", "carte-compte"); c.appendChild(k);
    var f = el("form", "formulaire"); var g = el("div", "champs-2"); f.appendChild(g);
    var x = compte || { email_contact: C.email };
    CHAMPS.forEach(function (ch) {
      var l = el("label", "champ" + (ch[2] === "texte" ? " champ-large" : "")); l.appendChild(el("span", null, ch[1]));
      var i;
      if (ch[2] === "texte") { i = el("textarea"); i.rows = 6; i.maxLength = 3000; }
      else if (ch[2] === "select") { i = el("select"); [["", "Je ne sais pas"], ["nationale", "Nationale"], ["régionale", "Régionale"]].forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; i.appendChild(op); }); }
      else { i = el("input"); i.type = ch[2] === "lien" ? "text" : ch[2]; if (ch[2] === "lien") { i.inputMode = "url"; i.placeholder = "www.votre-site.fr"; } i.maxLength = 300; }
      i.name = ch[0]; i.value = x[ch[0]] || ""; if (ch[3]) i.required = true;
      l.appendChild(i); g.appendChild(l);
    });
    if (!compte) { var acc = el("label", "case-accord"); var cb = el("input"); cb.type = "checkbox"; cb.required = true; acc.appendChild(cb); acc.appendChild(document.createTextNode(" Je représente cet organisme et j'accepte les conditions de vente.")); f.appendChild(acc); }
    var b = el("button", "bouton-r", compte ? "Enregistrer" : "Créer ma fiche"); b.type = "submit"; f.appendChild(b);
    f.addEventListener("submit", async function (e) {
      e.preventDefault(); b.disabled = true;
      var v = {}; CHAMPS.forEach(function (ch) { var val = f[ch[0]].value.trim(); v[ch[0]] = val || null; });
      ["site", "inscription"].forEach(function (k2) { if (v[k2] && !/^https?:\/\//.test(v[k2])) v[k2] = "https://" + v[k2]; });
      var r;
      if (compte) r = await E.sb.from("comptes_organismes").update(v).eq("id", C.id);
      else { try { v.provenance = localStorage.getItem("fra-provenance"); } catch (er) {} v.id = C.id; r = await E.sb.from("comptes_organismes").insert(v); }
      b.disabled = false;
      if (r.error) { E.message(E.erreur(r.error), true); return; }
      var nouveau = !compte;
      await tout(); E.message(nouveau ? "Fiche créée. Choisissez maintenant vos départements." : "Fiche enregistrée.");
      if (nouveau) E.montrerOnglet("v-organisme", "zones");
    });
    k.appendChild(f);
  }

  /* ---------- les départements, sur la carte ---------- */
  function libre(z) { return z.prises < z.places; }
  function zonesPage() {
    var c = $("og-zones"); c.textContent = "";
    var tete = el("div", "og-zones-tete");
    var t = el("div");
    t.appendChild(el("p", "petit", "Un seul partenaire par département (deux dans les six plus grands). Vous payez " + prixClic() + " par clic venu de ce département, jamais plus que son plafond annuel, qui dépend du nombre de jeunes de 15 à 24 ans qui y vivent (INSEE), des sessions et des recherches Google. Rien à payer d'avance, arrêt quand vous voulez. Premier arrivé, premier servi."));
    tete.appendChild(t);
    if (lancementOuvert) tete.appendChild(el("p", "og-lancement", "Tarif de lancement : 0,50 € le clic et plafonds à moitié prix pour les 10 premiers organismes, gardés tant que vous restez partenaire."));
    c.appendChild(tete);
    var g = el("div", "og-zones"); c.appendChild(g);
    var cg = el("div", "og-carte-boite"); g.appendChild(cg);
    // légende
    var lg = el("p", "og-legende");
    [1, 2, 3, 4].forEach(function (p) { var z = zones.filter(function (x) { return x.palier === p; })[0]; var s = el("span"); s.appendChild(el("i", "og-" + PALIERS[p][1])); s.appendChild(document.createTextNode(PALIERS[p][0] + (z ? " · plafond " + euros(prixDe(z)) + "/an" : ""))); lg.appendChild(s); });
    var s1 = el("span"); s1.appendChild(el("i", "og-pris")); s1.appendChild(document.createTextNode("Déjà pris")); lg.appendChild(s1);
    var s2 = el("span"); s2.appendChild(el("i", "og-choisi")); s2.appendChild(document.createTextNode("Votre choix")); lg.appendChild(s2);
    cg.appendChild(lg);
    if (carte) {
      var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 " + carte.largeur + " " + carte.hauteur); svg.setAttribute("class", "og-svg"); svg.setAttribute("role", "group"); svg.setAttribute("aria-label", "Carte des départements");
      Object.keys(carte.departements).forEach(function (d) {
        var z = zone(d); if (!z) return;
        var pa = document.createElementNS(ns, "path"); pa.setAttribute("d", carte.departements[d].d);
        var mien = parts.some(function (p) { return p.departement === d && enCours(p); });
        pa.setAttribute("class", "og-dep og-" + PALIERS[z.palier][1] + (mien ? " og-mien" : !libre(z) ? " og-pris" : "") + (choix[d] ? " og-choisi" : ""));
        pa.setAttribute("tabindex", "0"); pa.setAttribute("role", "button");
        var titre = document.createElementNS(ns, "title"); titre.textContent = z.nom + " (" + d + ") · " + (mien ? "le vôtre" : libre(z) ? prixClic() + " le clic, plafond " + euros(prixDe(z)) + " par an" + (z.places > 1 ? " · " + (z.places - z.prises) + " place(s) sur " + z.places : "") : "déjà pris"); pa.appendChild(titre);
        function basculer() { if (mien || !libre(z)) return; if (choix[d]) delete choix[d]; else choix[d] = true; zonesPage(); }
        pa.addEventListener("click", basculer); pa.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); basculer(); } });
        svg.appendChild(pa);
      });
      cg.appendChild(svg);
      cg.appendChild(el("p", "og-petit", "Paris et la petite couronne sont petits sur la carte : cherchez-les aussi par leur nom à droite."));
    }
    // à droite : la recherche, la sélection, le total
    var d2 = el("div", "og-panier"); g.appendChild(d2);
    var q = el("input", "og-recherche"); q.type = "search"; q.placeholder = "Ajouter un département : nom ou numéro"; q.dataset.villes = "liste"; q.dataset.villesTitre = "Départements"; q.autocomplete = "off";
    var bq = el("span", "og-recherche-boite"); bq.appendChild(q); d2.appendChild(bq);
    var dl = el("datalist"); dl.id = "og-deps"; zones.forEach(function (z) { var o = el("option"); o.value = z.nom + " (" + z.departement + ")"; dl.appendChild(o); }); bq.appendChild(dl);
    if (window.FRA_VILLES) window.FRA_VILLES(q);
    q.addEventListener("change", function () { var m = q.value.match(/\(([0-9AB]{2,3})\)\s*$/) || q.value.trim().match(/^([0-9AB]{2,3})$/i); var z = m && zone(m[1].toUpperCase()); if (z && libre(z)) { choix[z.departement] = true; zonesPage(); } else if (z) E.message(z.nom + " est déjà pris.", true); });
    d2.appendChild(el("h3", null, "Votre sélection"));
    var sel = Object.keys(choix), total = 0;
    var ul = el("ul", "og-choix");
    sel.forEach(function (d) { var z = zone(d); total += prixDe(z); var li = el("li"); li.appendChild(el("span", null, z.nom + " (" + d + ")")); li.appendChild(el("b", null, euros(prixDe(z)))); var x = el("button", "og-x", "×"); x.type = "button"; x.setAttribute("aria-label", "Retirer " + z.nom); x.addEventListener("click", function () { delete choix[d]; zonesPage(); }); li.appendChild(x); ul.appendChild(li); });
    if (!sel.length) ul.appendChild(el("li", "og-vide", "Cliquez sur la carte pour choisir vos départements."));
    d2.appendChild(ul);
    var tot = el("p", "og-total"); tot.appendChild(el("span", null, "Au plus, sur un an")); tot.appendChild(el("b", null, euros(total))); d2.appendChild(tot);
    d2.appendChild(el("p", "og-petit", "C'est un plafond, pas un prix : vous payez " + prixClic() + " par clic compté, chaque mois échu. Moins de 10 € dans le mois : rien à payer."));
    var r = el("button", "bouton-r bouton-large", compte ? "Prendre ces départements" : "Créez d'abord votre fiche"); r.type = "button"; r.disabled = !sel.length || !compte;
    r.addEventListener("click", async function () {
      r.disabled = true;
      var res = await E.sb.rpc("reserver_zones", { deps: sel });
      if (res.error) { E.message(E.erreur(res.error), true); r.disabled = false; await tout(); return; }
      choix = {}; await tout();
      E.message(compte.verifie ? "C'est fait ! Vos sessions passent en tête de ces départements dès la prochaine mise à jour du site (dans l'heure)." : "C'est réservé pour vous ! Vos départements s'activent dès que nous avons vérifié votre fiche (sous 2 jours ouvrés).");
      E.montrerOnglet("v-organisme", "tableau");
    });
    d2.appendChild(r);
    d2.appendChild(el("p", "og-petit", "Facture chaque début de mois pour le mois écoulé, payable par carte ou virement sous 30 jours. Sans engagement, sans commission sur vos inscriptions."));
    d2.appendChild(protections());
  }

  /* ---------- comment on compte : ce qui protège l'organisme ---------- */
  function protections() {
    var d = el("details", "og-protege"); d.appendChild(el("summary", null, "Clics protégés : pourquoi personne ne peut gonfler votre facture"));
    var ul = el("ul", "og-liste");
    ["Un clic n'est compté qu'une fois par personne, par jour, pour votre organisme : cliquer 50 fois sur vos sessions ne compte qu'un clic.",
     "Les robots, les aspirateurs de sites et les aperçus automatiques ne sont jamais comptés.",
     "Une personne qui clique sur plus de 5 organismes dans la même journée n'est plus comptée du tout.",
     "Un jour anormal (beaucoup plus de clics que d'habitude) n'est pas facturé au-delà de votre niveau habituel : le surplus est écarté et vérifié à la main.",
     "Seuls les clics venus de vos départements comptent, depuis les pages où vous êtes en tête.",
     "Le plafond annuel ne se dépasse jamais, quoi qu'il arrive.",
     "Vous voyez chaque clic compté, jour par jour, et vous pouvez contester une ligne : on la retire si elle paraît douteuse."].forEach(function (x) { ul.appendChild(el("li", null, x)); });
    d.appendChild(ul);
    return d;
  }

  /* ---------- les clics et les factures ---------- */
  function factures() {
    var c = $("og-factures"); c.textContent = "";
    var k = el("div", "carte-compte"); c.appendChild(k);
    if (!parts.length) { k.appendChild(el("p", "og-vide", "Rien pour l'instant : choisissez vos départements dans « Mes départements »."));  return; }
    k.appendChild(el("h3", null, "Vos départements"));
    k.appendChild(tableDeps(parts, true));
    // les clics, jour par jour
    k.appendChild(el("h3", null, "Vos clics, jour par jour"));
    k.appendChild(el("p", "petit", "« Comptés » : les clics facturables (une personne par jour, sans robots). « Tous » : tous les clics enregistrés, pour comparer. Une ligne vous paraît bizarre ? Écrivez-nous, on la retire."));
    if (!clics.length) k.appendChild(el("p", "og-vide", compte && compte.verifie ? "Aucun clic depuis vos départements ces deux derniers mois." : "Vos clics s'affichent dès que votre fiche est vérifiée."));
    else {
      var tb = el("table", "og-table"), th = el("tr");
      ["Jour", "Département", "Comptés", "Tous"].forEach(function (x) { th.appendChild(el("th", null, x)); }); tb.appendChild(th);
      clics.slice(0, 120).forEach(function (x) { var tr = el("tr"); var z = zone(x.departement) || {};
        [E.dateFr(String(x.jour).slice(0, 10)), (z.nom || x.departement) + " (" + x.departement + ")", String(x.facturables), String(x.tous)].forEach(function (v) { tr.appendChild(el("td", null, v)); }); tb.appendChild(tr); });
      var w = el("div", "og-table-boite"); w.appendChild(tb); k.appendChild(w);
    }
    // les factures mensuelles
    k.appendChild(el("h3", null, "Vos factures"));
    if (!fact.length) k.appendChild(el("p", "og-vide", "La première arrive au début du mois prochain, pour les clics de ce mois-ci."));
    if (fact.length) {
      var tf = el("div", "ls-table ls-org-f"), ef = el("div", "ls-rang ls-entete");
      ["Mois", "Clics comptés", "Montant", "État", ""].forEach(function (x) { ef.appendChild(el("span", null, x)); }); tf.appendChild(ef);
      fact.forEach(function (f) {
        var r = el("div", "ls-rang"), m = new Date(f.mois + "T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" }), q = el("span", "ls-qui");
        q.appendChild(el("b", null, m.charAt(0).toUpperCase() + m.slice(1))); if (f.clics_ecartes) q.appendChild(el("small", null, f.clics_ecartes + " clics écartés (pic anormal, non facturés)")); r.appendChild(q);
        r.appendChild(el("span", "ls-doux", String(f.clics)));
        r.appendChild(el("span", "ls-doux", euros(f.montant)));
        var st = el("span"); st.appendChild(pastille(ETATS_F[f.statut] || [f.statut, "gris"])); r.appendChild(st);
        var fin = el("span", "ls-fin");
        if (f.statut === "facture" && f.facture_url) { var a = el("a", "ls-postuler", "Payer"); a.href = f.facture_url; a.target = "_blank"; a.rel = "noopener"; fin.appendChild(a); }
        r.appendChild(fin); tf.appendChild(r);
      });
      k.appendChild(tf);
    }
    k.appendChild(protections());
  }

  async function tout() {
    await charger();
    etat(); tableau(); fiche(); zonesPage(); factures();
    if (window.FRA_ORGANISME.apres) window.FRA_ORGANISME.apres(compte);
  }
  window.FRA_ORGANISME = {
    ouvrir: async function (ctx) { E = window.FRA_ESPACE; C = ctx; await tout(); return compte; },
    compte: function () { return compte; }, parts: function () { return parts; }
  };
})();

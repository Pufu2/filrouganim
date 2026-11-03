/* Fil Roug'Anim : les outils gratuits. Tout se calcule dans le navigateur, rien n'est envoyé. */
(function () {
  "use strict";
  var racine = document.querySelector("[data-outil]");
  var f = document.getElementById("f-outil"), res = document.getElementById("resultat");
  if (!racine || !f || !res) return;
  var outil = racine.dataset.outil;

  function el(tag, classe, texte) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }
  function n(nom) { var v = parseFloat(String(f[nom].value).replace(",", ".")); return isNaN(v) || v < 0 ? 0 : v; }
  function grand(chiffre, texte) {
    var p = el("p", "grand-chiffre");
    p.appendChild(el("b", null, chiffre));
    p.appendChild(el("span", null, texte));
    return p;
  }
  function ligne(liste, texte, classe) { liste.appendChild(el("li", classe || null, texte)); }
  function pluriel(x, mot) { return x + " " + mot + (x > 1 ? "s" : ""); }
  function euros(x) { return x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }

  /* -- taux d'encadrement (CASF R227-12 à R227-20) -- */
  var TAUX = {
    extra: { court: [8, 12], long: [8, 12] },
    sejour: { court: [8, 12], long: [8, 12] },
    minicamp: { court: [8, 12], long: [8, 12] },
    peri: { court: [10, 14], long: [8, 12] },
    "peri-pedt": { court: [14, 18], long: [10, 14] }
  };
  function encadrement() {
    var type = f.accueil.value, duree = f.duree.value;
    Array.prototype.forEach.call(f.querySelectorAll("[data-si]"), function (c) { c.hidden = c.dataset.si.split(" ").indexOf(type) < 0; });
    var t = TAUX[type][type.indexOf("peri") === 0 ? duree : "long"];
    var a = Math.floor(n("moins6")), b = Math.floor(n("plus6")), total = a + b;
    res.textContent = "";
    if (!total) { res.appendChild(el("p", null, "Indiquez le nombre d'enfants pour voir l'équipe d'animation minimale.")); return; }
    var pourA = Math.ceil(a / t[0]), pourB = Math.ceil(b / t[1]);
    var anim = pourA + pourB;
    var mini2 = (type === "sejour" || type === "minicamp") && anim < 2;
    if (mini2) anim = 2;
    res.appendChild(grand(String(anim), anim > 1 ? "animateurs au minimum, en plus du directeur" : "animateur au minimum, en plus du directeur"));
    var ul = el("ul", "detail");
    if (a) ligne(ul, pluriel(a, "enfant") + " de moins de 6 ans à 1 pour " + t[0] + " : " + pluriel(pourA, "animateur"));
    if (b) ligne(ul, pluriel(b, "enfant") + " de 6 ans ou plus à 1 pour " + t[1] + " : " + pluriel(pourB, "animateur"));
    if (mini2) ligne(ul, "Au moins 2 personnes encadrent un séjour ou un mini-camp.");
    var diplomes = Math.ceil(anim / 2);
    var sans = anim === 3 || anim === 4 ? 1 : Math.floor(anim * 0.2);
    ligne(ul, "Dont au moins " + pluriel(diplomes, "diplômé") + " (BAFA ou équivalent), au plus " + sans + " sans diplôme ni formation en cours, et les autres stagiaires.");
    if (type === "sejour" && total > 100) ligne(ul, "Plus de 100 mineurs : " + pluriel(Math.ceil((total - 100) / 50), "directeur adjoint") + " en plus du directeur.");
    if (type === "extra" && total > 300) ligne(ul, "Attention : un accueil de loisirs extrascolaire accueille 300 mineurs au plus.", "alerte");
    if (type === "peri-pedt") ligne(ul, "Pendant les trajets entre l'école et les locaux : taux du périscolaire sans PEDT (1 pour 10 et 1 pour 14).");
    res.appendChild(ul);
  }

  /* -- contrat d'engagement éducatif (CASF L432-4, D432-2) -- */
  function cee() {
    var mini = Math.round(parseFloat(res.dataset.smic) * parseFloat(res.dataset.coef) * 100) / 100;
    var jours = Math.floor(n("jours")), brut = n("brut"), deja = Math.floor(n("deja"));
    res.textContent = "";
    if (!jours) { res.appendChild(el("p", null, "Indiquez le nombre de jours du contrat.")); return; }
    var paye = Math.max(brut, 0);
    res.appendChild(grand(euros(paye * jours), "brut pour " + pluriel(jours, "jour") + " à " + euros(paye)));
    var ul = el("ul", "detail");
    if (paye + 0.001 < mini) {
      ligne(ul, "Trop bas : le minimum légal est de " + euros(mini) + " brut par jour. Il manque " + euros(mini - paye) + " par jour, soit " + euros((mini - paye) * jours) + " sur le contrat.", "alerte");
      ligne(ul, "Au minimum légal, ce contrat paierait " + euros(mini * jours) + " brut.");
    } else ligne(ul, "Conforme au minimum légal de " + euros(mini) + " brut par jour.", "ok");
    var cumul = jours + deja;
    if (cumul > 80) ligne(ul, "Attention : " + cumul + " jours de CEE sur 12 mois, au-delà du plafond de 80 jours.", "alerte");
    else ligne(ul, "Plafond des 80 jours sur 12 mois : " + cumul + " jours utilisés, " + (80 - cumul) + " restants.", "ok");
    ligne(ul, "Repos : 24 heures consécutives par période de 7 jours, et 11 heures par période de 24 heures (ou un repos compensateur).");
    res.appendChild(ul);
  }

  /* -- parcours BAFA : 18 mois pour le stage pratique, 30 mois en tout -- */
  function ajouterMois(d, m) {
    var r = new Date(d.getFullYear(), d.getMonth() + m, d.getDate());
    if (r.getDate() !== d.getDate()) r.setDate(0); // 31 août + 18 mois -> dernier jour de février
    return r;
  }
  function dateFr(d) { return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
  function parcours() {
    res.textContent = "";
    if (!f.fg.value) { res.appendChild(el("p", null, "Indiquez la date de début de votre formation générale.")); return; }
    var fg = new Date(f.fg.value + "T12:00:00"), auj = new Date();
    var limStage = ajouterMois(fg, 18), limFin = ajouterMois(fg, 30);
    var jours = Math.ceil((limFin - auj) / 864e5);
    res.appendChild(grand(dateFr(limFin), "date limite pour finir votre BAFA"));
    var ul = el("ul", "etapes-dates");
    ligne(ul, "Formation générale : " + dateFr(fg), "fait");
    if (f.stage.value) {
      var st = new Date(f.stage.value + "T12:00:00");
      ligne(ul, "Stage pratique : " + dateFr(st) + (st > limStage ? " : après la limite des 18 mois, vérifiez avec votre organisme." : ""), st > limStage ? "alerte" : "fait");
    } else ligne(ul, "Stage pratique : au plus tard le " + dateFr(limStage) + (limStage < auj ? " (date dépassée : contactez votre organisme)." : "."), limStage < auj ? "alerte" : "a-faire");
    ligne(ul, "Approfondissement ou qualification : avant le " + dateFr(limFin) + (jours < 0 ? " (date dépassée)." : ", dans " + pluriel(jours, "jour") + "."), jours < 0 ? "alerte" : "a-faire");
    res.appendChild(ul);
    if (jours > 0) {
      var p = el("p");
      var a = el("a", "bouton-r", "Voir les approfondissements avant cette date");
      a.href = res.dataset.sessions + "?diplome=BAFA&type=BAFA-approfondissement";
      p.appendChild(a);
      res.appendChild(p);
    }
    try { localStorage.setItem("fra-parcours", JSON.stringify({ fg: f.fg.value, stage: f.stage.value })); } catch (e) {}
  }

  var calcul = { encadrement: encadrement, cee: cee, parcours: parcours }[outil];
  if (outil === "parcours") {
    try {
      var mem = JSON.parse(localStorage.getItem("fra-parcours") || "null");
      if (mem) { f.fg.value = mem.fg || ""; f.stage.value = mem.stage || ""; }
    } catch (e) {}
  }
  f.addEventListener("input", calcul);
  f.addEventListener("change", calcul);
  f.addEventListener("submit", function (e) { e.preventDefault(); });
  calcul();
})();

// La fenêtre « Filtres » : chaque liste du formulaire (formation, étape, budget) devient
// un groupe de boutons. Un bouton règle la liste correspondante et prévient le formulaire (événement « change ») :
// sur la page des sessions, filtres.js filtre alors en direct et renvoie le nombre de sessions (« sessions:compte »).
(function () {
  var forms = document.querySelectorAll("form[data-fenetre-filtres]");
  Array.prototype.forEach.call(forms, function (form) {
    var voile = form.querySelector("[data-voile]");
    var groupes = form.querySelector("[data-groupes]");
    var ouvrir = form.querySelector("[data-ouvrir]");
    var pastille = form.querySelector("[data-nb]");
    var afficherBtn = form.querySelector("[data-afficher]");
    var selects = Array.prototype.slice.call(form.querySelectorAll(".rv-champs select"));
    var dernierFocus = null;
    // « Quand ? » : les douze prochains mois et les vacances scolaires, chacun avec son année (mois + année d'un coup)
    var AVEC_VACANCES = ["", "BAFA", "BAFD", "BSB", "PSC1"];  // les formations courtes, qui se font pendant les vacances

    function el(tag, classe, texte) {
      var e = document.createElement(tag);
      if (classe) e.className = classe;
      if (texte !== undefined) e.textContent = texte;
      return e;
    }
    function prevenir(select) { select.dispatchEvent(new Event("change", { bubbles: true })); }
    // une option est proposée si elle est active, et (pour les budgets) si elle va avec la formation choisie
    function proposee(select, o) {
      if (!o.value || o.disabled || o.hidden) return false;
      if (o.parentNode.tagName === "OPTGROUP" && (o.parentNode.hidden || o.parentNode.disabled)) return false;
      if (select.name === "budget") {
        var dip = form.elements.diplome.value;
        return (o.dataset.diplome || "") === dip;
      }
      return true;
    }
    function bouton(select, o) {
      var b = el("button", "ff-puce", o.textContent.replace(/\s*\(\d+\)$/, ""));
      b.type = "button";
      var choisi = select.value === o.value;
      b.setAttribute("aria-pressed", choisi ? "true" : "false");
      b.addEventListener("click", function () {
        select.value = choisi ? "" : o.value;
        prevenir(select);
        if (select.name === "diplome") {  // l'étape et le budget dépendent de la formation
          form.elements.type.value = ""; form.elements.budget.value = "";
          prevenir(form.elements.type);
        }
        rendre();
      });
      return b;
    }
    // « Quand ? » : les vacances par leur nom (sans année), puis une case Mois et une case Année, indépendantes
    function choixQuand(select, valeur) {
      select.value = valeur;
      prevenir(select);
      rendre();
    }
    function boutonVacances(o) {
      var mois = form.elements.mois;
      var b = el("button", "ff-puce", o.textContent);
      b.type = "button";
      var choisi = mois.value === o.value;
      b.setAttribute("aria-pressed", choisi ? "true" : "false");
      b.addEventListener("click", function () { choixQuand(mois, choisi ? "" : o.value); });
      return b;
    }
    function caseQuand(id, titre, select, options, vide) {
      var c = el("label", "ff-case");
      c.setAttribute("for", id);
      c.appendChild(el("span", "ff-case-titre", titre));
      var s = el("select");
      s.id = id;
      s.appendChild(new Option(vide, ""));
      options.forEach(function (o) { s.appendChild(new Option(o.textContent, o.value)); });
      s.value = options.some(function (o) { return o.value === select.value; }) ? select.value : "";
      s.addEventListener("change", function () { choixQuand(select, s.value); });
      c.appendChild(s);
      return c;
    }
    function groupeQuand() {
      var g = el("div", "ff-groupe");
      g.appendChild(el("h3", null, "Quand ?"));
      var mois = form.elements.mois, annee = form.elements.annee;
      var vacs = Array.prototype.filter.call(mois.options, function (o) { return /^v:/.test(o.value); });
      var moisOpts = Array.prototype.filter.call(mois.options, function (o) { return /^m:/.test(o.value); });
      if (AVEC_VACANCES.indexOf(form.elements.diplome.value) !== -1 && vacs.length) {
        g.appendChild(el("p", "ff-sous", "Vacances scolaires"));
        var l1 = el("div", "ff-puces");
        vacs.forEach(function (o) { l1.appendChild(boutonVacances(o)); });
        g.appendChild(l1);
      }
      var cases = el("div", "ff-cases");
      cases.appendChild(caseQuand(form.id + "-ff-mois-" + Math.random().toString(36).slice(2, 7), "Mois", mois, moisOpts, "Tous les mois"));
      cases.appendChild(caseQuand(form.id + "-ff-annee-" + Math.random().toString(36).slice(2, 7), "Année", annee,
        Array.prototype.filter.call(annee.options, function (o) { return o.value; }), "Toutes les années"));
      g.appendChild(cases);
      return g;
    }
    function rendre() {
      groupes.textContent = "";
      // des vacances choisies n'ont plus de sens pour un diplôme pro : on les retire
      if (AVEC_VACANCES.indexOf(form.elements.diplome.value) === -1 && /^v:/.test(form.elements.mois.value)) {
        form.elements.mois.value = ""; form.elements.annee.value = "";
        prevenir(form.elements.mois); prevenir(form.elements.annee);
      }
      selects.forEach(function (select) {
        if (select.name === "mois") { groupes.appendChild(groupeQuand()); return; }
        if (select.name === "annee") return;  // l'année est dans « Quand ? »
        if (select.name === "type" && !form.elements.diplome.value) return;  // l'étape vient après la formation
        var options = Array.prototype.filter.call(select.options, function (o) { return proposee(select, o); });
        if (!options.length) return;
        var g = el("div", "ff-groupe");
        var titre = select.dataset.titre;
        if (select.name === "type") {
          var dip = form.elements.diplome.value;
          titre = !dip ? "Votre étape ou spécialité" : ["BAFA", "BAFD"].indexOf(dip) !== -1 ? "Votre étape" : "Votre spécialité";
        }
        g.appendChild(el("h3", null, titre));
        // les listes en plusieurs parties (mois, vacances ; étapes de chaque diplôme) gardent leurs sous-titres
        var parties = {};
        var ordre = [];
        options.forEach(function (o) {
          var p = o.parentNode.tagName === "OPTGROUP" ? o.parentNode.label : "";
          if (select.name === "type") p = "";  // les étapes du diplôme choisi suffisent
          if (!parties[p]) { parties[p] = []; ordre.push(p); }
          parties[p].push(o);
        });
        ordre.forEach(function (p) {
          if (p && ordre.length > 1) g.appendChild(el("p", "ff-sous", p));
          var ligne = el("div", "ff-puces");
          parties[p].forEach(function (o) { ligne.appendChild(bouton(select, o)); });
          g.appendChild(ligne);
        });
        groupes.appendChild(g);
      });
      compter();
    }
    function compter() {
      var n = selects.filter(function (s) { return s.value; }).length + (form.elements.q.value.trim() ? 1 : 0);
      pastille.textContent = n;
      pastille.hidden = n === 0;
    }
    function montrer(oui) {
      voile.hidden = !oui;
      document.documentElement.classList.toggle("ff-ouverte", oui);
      if (oui) {
        dernierFocus = document.activeElement;
        rendre();
        var f = voile.querySelector("[data-fermer]");
        if (f) f.focus();
      } else if (dernierFocus) {
        dernierFocus.focus();
      }
    }
    ouvrir.addEventListener("click", function () { montrer(true); });
    voile.querySelector("[data-fermer]").addEventListener("click", function () { montrer(false); });
    voile.addEventListener("click", function (e) { if (e.target === voile) montrer(false); });
    voile.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); montrer(false); }
      if (e.key === "Tab") {  // le focus reste dans la fenêtre
        var focusables = voile.querySelectorAll("button, input, a[href]");
        var premier = focusables[0], dernier = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
        else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
      }
    });
    form.querySelector("[data-effacer]").addEventListener("click", function () {
      selects.forEach(function (s) { s.value = ""; });
      form.elements.q.value = "";
      selects.forEach(prevenir);
      form.elements.q.dispatchEvent(new Event("input", { bubbles: true }));
      rendre();
    });
    if (afficherBtn) {
      afficherBtn.addEventListener("click", function () {
        montrer(false);
        var r = document.getElementById("resultats");
        if (r) r.scrollIntoView({ behavior: "smooth" });
      });
      document.addEventListener("sessions:compte", function (e) {
        var n = e.detail, ecoles = ["CPJEPS", "BPJEPS", "DEJEPS", "DESJEPS"].indexOf(form.elements.diplome.value) !== -1;
        var unite = ecoles ? ["école", "écoles"] : ["session", "sessions"];
        if (n === null || n === undefined) afficherBtn.textContent = "Afficher les " + unite[1];
        else afficherBtn.textContent = n === 0 ? (ecoles ? "Aucune école" : "Aucune session") : "Afficher " + n.toLocaleString("fr-FR") + " " + (n > 1 ? unite[1] : unite[0]);
        compter();
      });
    }
    form.elements.q.addEventListener("input", compter);
    form.addEventListener("change", compter);
    // une page de liste (région, département…) remplit d'avance le lieu et les critères de sa liste
    if (form.dataset.preset) {
      var pre = new URLSearchParams(form.dataset.preset);
      ["diplome", "type", "mois", "annee", "dep"].forEach(function (nom) {
        if (pre.get(nom) && form.elements[nom]) {
          form.elements[nom].value = pre.get(nom);
          if (form.elements[nom].tagName === "SELECT") prevenir(form.elements[nom]);
        }
      });
      if (pre.get("dep")) {
        var opt = form.querySelector('datalist option[data-dep="' + pre.get("dep") + '"]');
        if (opt) form.elements.ou.value = opt.value;
      }
    }
    // les valeurs reçues dans l'adresse (?diplome=BAFA…) sont posées par filtres.js : on recompte ensuite
    setTimeout(compter, 0);
    if (/[?&]filtres=ouverts/.test(location.search)) montrer(true);
  });
})();

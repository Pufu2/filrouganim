// La liste sous chaque case « Où ? » (une seule, à la place de celle du navigateur) :
// case vide, les villes qui ont le plus de sessions ; pendant la frappe, les départements, régions et grandes
// villes qui correspondent. Un clic remplit la case (le reste de la recherche ne change pas).
(function () {
  var source = document.getElementById("villes-populaires");
  var villes = [];
  try { villes = JSON.parse(source.textContent) || []; } catch (e) { villes = []; }
  function sansAccents(t) { return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  var ICONE = '<svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

  Array.prototype.forEach.call(document.querySelectorAll("input[data-villes]"), function (champ, k) {
    var boite = champ.parentNode;
    var lieux = boite.querySelector("datalist") || (champ.form && champ.form.querySelector("datalist"));
    var options = lieux ? Array.prototype.map.call(lieux.options, function (o) { return { texte: o.value, cle: sansAccents(o.value), dep: o.dataset.dep || "" }; }) : [];
    boite.classList.add("villes-hote");
    var liste = document.createElement("div");
    liste.className = "villes-liste";
    liste.id = "villes-" + k;
    liste.hidden = true;
    liste.setAttribute("role", "listbox");
    boite.appendChild(liste);
    champ.setAttribute("aria-controls", liste.id);
    champ.setAttribute("aria-expanded", "false");
    champ.setAttribute("aria-autocomplete", "list");
    var boutons = [];

    function choix(texte, detail) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "villes-choix";
      b.setAttribute("role", "option");
      b.innerHTML = ICONE + "<b></b><span></span>";
      b.querySelector("b").textContent = texte;
      b.querySelector("span").textContent = detail || "";
      b.addEventListener("mousedown", function (e) { e.preventDefault(); });  // le champ garde le focus
      b.addEventListener("click", function () {
        champ.value = texte;
        champ.dispatchEvent(new Event("input", { bubbles: true }));
        champ.dispatchEvent(new Event("change", { bubbles: true }));
        fermer();
        champ.focus();
      });
      return b;
    }
    function remplir(titre, elements) {
      liste.textContent = "";
      liste.classList.toggle("villes-une-colonne", titre !== "Les villes les plus demandées");
      var t = document.createElement("p");
      t.className = "villes-titre";
      t.textContent = titre;
      liste.appendChild(t);
      boutons = elements;
      elements.forEach(function (b) { liste.appendChild(b); });
    }
    function ouvrir() {
      var q = sansAccents(champ.value.trim());
      if (!q) {
        if (!villes.length) return fermer();
        remplir("Les villes les plus demandées", villes.map(function (v) {
          return choix(champ.dataset.villesValeur === "nom" ? v.nom : v.texte, v.n.toLocaleString("fr-FR") + (v.n > 1 ? " sessions" : " session"));
        }));
      } else {
        if (!options.length) return fermer();
        var mots = q.replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
        var trouves = options.filter(function (o) { return mots.every(function (m) { return o.cle.indexOf(m) !== -1; }); });
        var arr = function (o) { return /\d+(er|e)$/.test(o.cle) ? 1 : 0; };  // les arrondissements après la ville
        trouves.sort(function (a, b) { return (b.cle.indexOf(q) === 0) - (a.cle.indexOf(q) === 0) || arr(a) - arr(b) || a.cle.length - b.cle.length; });
        trouves = trouves.slice(0, 8);
        if (!trouves.length || (trouves.length === 1 && trouves[0].cle === q)) return fermer();
        remplir("Suggestions", trouves.map(function (o) {
          var genre = o.dep.slice(0, 2) === "r:" ? "Région" : o.dep.slice(0, 2) === "v:" ? "Ville" : "Département";
          return choix(o.texte, genre);
        }));
      }
      liste.hidden = false;
      champ.setAttribute("aria-expanded", "true");
    }
    function fermer() {
      liste.hidden = true;
      champ.setAttribute("aria-expanded", "false");
    }
    champ.addEventListener("focus", ouvrir);
    champ.addEventListener("click", ouvrir);
    champ.addEventListener("input", ouvrir);
    champ.addEventListener("blur", function () { setTimeout(fermer, 120); });
    champ.addEventListener("keydown", function (e) {
      if (e.key === "Escape") fermer();
      if (e.key === "ArrowDown" && !liste.hidden && boutons[0]) { e.preventDefault(); boutons[0].focus(); }
    });
    liste.addEventListener("keydown", function (e) {
      var i = boutons.indexOf(document.activeElement);
      if (e.key === "ArrowDown" && i < boutons.length - 1) { e.preventDefault(); boutons[i + 1].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); if (i > 0) boutons[i - 1].focus(); else champ.focus(); }
      if (e.key === "Escape") { fermer(); champ.focus(); }
    });
    liste.addEventListener("focusout", function (e) { if (!boite.contains(e.relatedTarget)) fermer(); });
  });
})();

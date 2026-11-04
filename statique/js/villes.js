// Les villes les plus demandées : au clic dans une case « Où ? » encore vide, une liste des grandes villes
// avec leur nombre de sessions. Un clic remplit la case (le reste de la recherche ne change pas).
(function () {
  var source = document.getElementById("villes-populaires");
  if (!source) return;
  var villes = [];
  try { villes = JSON.parse(source.textContent) || []; } catch (e) { return; }
  if (!villes.length) return;

  Array.prototype.forEach.call(document.querySelectorAll("input[data-villes]"), function (champ, k) {
    var boite = champ.parentNode;
    boite.classList.add("villes-hote");
    var liste = document.createElement("div");
    liste.className = "villes-liste";
    liste.id = "villes-" + k;
    liste.hidden = true;
    liste.setAttribute("role", "listbox");
    var titre = document.createElement("p");
    titre.className = "villes-titre";
    titre.textContent = "Les villes les plus demandées";
    liste.appendChild(titre);
    var boutons = villes.map(function (v) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "villes-choix";
      b.setAttribute("role", "option");
      b.innerHTML = '<svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg><b></b><span></span>';
      b.querySelector("b").textContent = v.nom;
      b.querySelector("span").textContent = v.n.toLocaleString("fr-FR") + (v.n > 1 ? " sessions" : " session");
      b.addEventListener("mousedown", function (e) { e.preventDefault(); });  // le champ garde le focus
      b.addEventListener("click", function () {
        champ.value = champ.dataset.villesValeur === "nom" ? v.nom : v.texte;
        champ.dispatchEvent(new Event("input", { bubbles: true }));
        champ.dispatchEvent(new Event("change", { bubbles: true }));
        fermer();
        champ.focus();
      });
      liste.appendChild(b);
      return b;
    });
    boite.appendChild(liste);
    champ.setAttribute("aria-controls", liste.id);
    champ.setAttribute("aria-expanded", "false");

    function ouvrir() {
      if (champ.value.trim()) return fermer();
      liste.hidden = false;
      champ.setAttribute("aria-expanded", "true");
    }
    function fermer() {
      liste.hidden = true;
      champ.setAttribute("aria-expanded", "false");
    }
    champ.addEventListener("focus", ouvrir);
    champ.addEventListener("click", ouvrir);
    champ.addEventListener("input", function () { if (champ.value.trim()) fermer(); else ouvrir(); });
    champ.addEventListener("blur", function () { setTimeout(fermer, 120); });
    champ.addEventListener("keydown", function (e) {
      if (e.key === "Escape") fermer();
      if (e.key === "ArrowDown" && !liste.hidden) { e.preventDefault(); boutons[0].focus(); }
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

/* Fil Roug'Anim : les pages réservées aux structures abonnées (guides et outils de « Mon espace »).
   Sans session d'une structure à l'abonnement en cours, la page se couvre d'un verrou avec le bon bouton. */
(function () {
  "use strict";
  var c = document.getElementById("reserve");
  var html = document.documentElement;
  if (!c || !window.supabase) { html.classList.remove("reserve-attente"); return; }
  var sb = window.supabase.createClient(c.dataset.url, c.dataset.cle, { auth: { persistSession: true, detectSessionInUrl: false, autoRefreshToken: true } });
  function el(tag, classe, texte) { var e = document.createElement(tag); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e; }
  function verrou(connecte, structure) {
    html.classList.add("reserve-ferme");
    var v = el("div", "reserve-voile"), b = el("div", "reserve-boite");
    b.setAttribute("role", "dialog"); b.setAttribute("aria-modal", "true"); b.setAttribute("aria-labelledby", "reserve-t");
    var t = el("p", "reserve-t", "Réservé aux structures abonnées"); t.id = "reserve-t"; b.appendChild(t);
    b.appendChild(el("p", null, structure ? "Votre structure n'a pas encore d'abonnement en cours. Il ouvre les guides, les outils et les conseils de votre espace, en plus de votre page, de vos offres et des profils des candidats."
      : "Les guides, les outils et les conseils pour recruter sont réservés aux structures abonnées, dans leur espace. Votre page, vos offres et les profils de votre secteur sont inclus."));
    var bt = el("div", "reserve-boutons"), a1 = el("a", "bouton-r"), a2 = el("a", "bouton-blanc");
    if (structure) { a1.textContent = "Voir l'abonnement"; a1.href = c.dataset.compte + "?onglet=abonnement"; }
    else { a1.textContent = "Créer l'espace de ma structure"; a1.href = c.dataset.compte + "?inscription=1&role=structure"; }
    a2.textContent = connecte ? "Retour à mon espace" : "Me connecter"; a2.href = c.dataset.compte;
    bt.appendChild(a1); bt.appendChild(a2); b.appendChild(bt);
    var a3 = el("a", "reserve-plus", "Ce que comprend l'abonnement"); a3.href = c.dataset.recruter; b.appendChild(a3);
    v.appendChild(b); document.body.appendChild(v);
    a1.focus();
  }
  sb.auth.getSession().then(async function (s) {
    var u = s.data && s.data.session && s.data.session.user, ok = false, st = null;
    if (u) {
      var r = await sb.from("structures").select("abonnement_fin").eq("id", u.id).maybeSingle();
      st = r.data;
      ok = !!(st && st.abonnement_fin && st.abonnement_fin >= new Date().toISOString().slice(0, 10));
    }
    html.classList.remove("reserve-attente");
    if (!ok) verrou(!!u, st);
  }, function () { html.classList.remove("reserve-attente"); verrou(false, null); });
})();

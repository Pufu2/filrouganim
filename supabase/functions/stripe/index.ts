// Le relais des paiements Stripe (webhook) : Stripe nous prévient dès qu'une structure paie, au lieu d'attendre le robot
// de GitHub (outils/abonnements.py), que GitHub ne lance que toutes les 4 à 8 heures.
//
// On ne croit pas le message sur parole : on relit la session de paiement et l'abonnement chez Stripe, avec la clé de
// lecture rangée dans le coffre-fort de la base par le robot (ranger_cle_stripe). Un faux message ne peut donc rien
// écrire. Puis la base applique les mêmes règles que le robot (stripe_paiement, migration v43) et prévient l'administration.
// Déployé sans vérification de jeton (Stripe n'en envoie pas). En cas d'erreur, on répond 500 : Stripe réessaie pendant 3 jours.

const SB = Deno.env.get("SUPABASE_URL")!;
const CLE_SB = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUIVIS = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];

async function rpc(nom: string, corps: unknown) {
  const r = await fetch(`${SB}/rest/v1/rpc/${nom}`, {
    method: "POST",
    headers: { apikey: CLE_SB, Authorization: `Bearer ${CLE_SB}`, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  if (!r.ok) throw new Error(`${nom} : ${r.status} ${await r.text()}`);
  return r.json();
}

async function stripe(chemin: string, cle: string) {
  const r = await fetch(`https://api.stripe.com/v1/${chemin}`, { headers: { Authorization: `Bearer ${cle}` } });
  if (!r.ok) throw new Error(`Stripe ${chemin} : ${r.status}`);
  return r.json();
}

function reponse(texte: string, status = 200) {
  return new Response(JSON.stringify({ resultat: texte }), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reponse("Relais des paiements Fil Roug'Anim");
  let evt: any;
  try { evt = await req.json(); } catch { return reponse("message illisible", 400); }
  const type = evt?.type, id = evt?.data?.object?.id;
  if (!SUIVIS.includes(type)) return reponse("ignoré");
  if (typeof id !== "string" || !/^(cs|sub)_[A-Za-z0-9_]{6,250}$/.test(id)) return reponse("identifiant inattendu", 400);
  try {
    const cle = await rpc("cle_stripe", {});
    if (!cle) return reponse("clé Stripe pas encore rangée par le robot", 503);
    let s: any = null, a: any = null;
    if (type === "checkout.session.completed") {
      if (!id.startsWith("cs_")) return reponse("identifiant inattendu", 400);
      s = await stripe(`checkout/sessions/${id}`, cle);
      if (s.status !== "complete") return reponse("paiement pas terminé");
      const sub = typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
      if (sub) a = await stripe(`subscriptions/${sub}`, cle);
    } else {
      if (!id.startsWith("sub_")) return reponse("identifiant inattendu", 400);
      a = await stripe(`subscriptions/${id}`, cle);
    }
    return reponse(await rpc("stripe_paiement", { s, a }) || "rien à changer");
  } catch (e) {
    console.error(e);
    return reponse("erreur, Stripe réessaiera", 500);
  }
});

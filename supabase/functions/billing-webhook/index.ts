// JM Transportes Financeiro — Billing webhook (Supabase Edge Function)
//
// Aceita webhooks de Stripe OU Mercado Pago e ativa o plano PRO do usuário.
// Deploy:  supabase functions deploy billing-webhook --no-verify-jwt
//
// Variáveis a configurar (Settings → Edge Functions → Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (já existem)
//   STRIPE_WEBHOOK_SECRET   (opcional — Stripe)
//   MP_ACCESS_TOKEN         (opcional — Mercado Pago)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function activatePro(userId: string, days = 30) {
  const renewsAt = new Date(Date.now() + days * 86400000).toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({ plan: 'pro', plan_renews_at: renewsAt, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

async function handleStripe(req: Request) {
  const body = await req.json();
  if (body.type === 'checkout.session.completed') {
    const userId = body.data?.object?.client_reference_id;
    if (userId) await activatePro(userId, 30);
  } else if (body.type === 'customer.subscription.deleted') {
    const userId = body.data?.object?.metadata?.user_id;
    if (userId) await supabase.from('profiles').update({ plan: 'free' }).eq('id', userId);
  }
  return new Response('ok');
}

async function handleMercadoPago(req: Request) {
  const body = await req.json();
  if (body.type !== 'payment' || !body.data?.id) return new Response('ignored');
  const token = Deno.env.get('MP_ACCESS_TOKEN');
  if (!token) return new Response('MP_ACCESS_TOKEN missing', { status: 500 });
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${body.data.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payment = await res.json();
  if (payment.status === 'approved' && payment.external_reference) {
    await activatePro(payment.external_reference, 30);
  }
  return new Response('ok');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const provider = new URL(req.url).searchParams.get('provider') || 'stripe';
    if (provider === 'mp' || provider === 'mercadopago') return await handleMercadoPago(req);
    return await handleStripe(req);
  } catch (err) {
    console.error(err);
    return new Response((err as Error).message || 'error', { status: 500 });
  }
});

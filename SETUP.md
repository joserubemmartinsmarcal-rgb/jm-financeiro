# SETUP — Login, Sync e Cobrança

Este guia ativa os modos **Cloud** (login + sync) e **PRO** (cobrança). Sem isso, o app já funciona em modo local.

---

## 1. Supabase (login + sync) — grátis

### 1.1 Criar projeto
1. Crie conta grátis em https://supabase.com
2. New project → escolha senha do banco → região São Paulo (`sa-east-1`)
3. Aguarde provisionar (~2 min)

### 1.2 Rodar o schema
1. SQL Editor → New query
2. Cole o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql)
3. Run ▶ — deve criar 4 tabelas + RLS

### 1.3 Pegar as chaves
- Settings → API
- Copie **Project URL** e **anon public key**

### 1.4 Colar no app
- Abra o app → aba **Conta** → **Configurações**
- Cole **Supabase URL** e **Supabase anon key** → Salvar
- Volte para **Conta** → Cadastrar com email + senha
- Confirme via email recebido

✅ Login ativo. Agora teste em outro dispositivo: instale o app, faça login com a mesma conta — os dados sincronizam.

---

## 2. Cobrança — Stripe (mais simples internacionalmente)

### 2.1 Criar Payment Link
1. Crie conta em https://stripe.com (modo Test enquanto testa)
2. Products → Add product → "JM Financeiro PRO" → preço recorrente mensal (ex: R$ 29,90)
3. Copie o **Payment link** gerado

### 2.2 Deploy do webhook
Instale a CLI Supabase: https://supabase.com/docs/guides/cli

```bash
supabase login
supabase link --project-ref <seu-ref>
supabase functions deploy billing-webhook --no-verify-jwt
```

URL do webhook: `https://<seu-ref>.functions.supabase.co/billing-webhook`

### 2.3 Conectar Stripe → webhook
1. Stripe → Developers → Webhooks → Add endpoint
2. URL: a do passo 2.2
3. Events: `checkout.session.completed` e `customer.subscription.deleted`
4. Copie o **Signing secret** → Supabase → Edge Functions → Secrets:
   - `STRIPE_WEBHOOK_SECRET=<signing secret>`

### 2.4 Colar link no app
- App → **Conta → Configurações** → Checkout URL → cole o Payment link → Salvar

✅ Pronto. Aba **Conta** → "Assinar PRO" abre o checkout.

---

## 3. Cobrança — Mercado Pago (alternativa Brasil)

### 3.1 Criar link de pagamento
1. Conta vendedor em https://www.mercadopago.com.br/developers
2. Suas integrações → Checkout Pro → criar **link de pagamento**
3. Copie o link

### 3.2 Configurar webhook
- Notificações → adicionar URL: `https://<seu-ref>.functions.supabase.co/billing-webhook?provider=mp`
- Eventos: `payment`

### 3.3 Token de acesso
- Credenciais de produção → copie **Access Token**
- Supabase → Edge Functions → Secrets: `MP_ACCESS_TOKEN=<access token>`

### 3.4 Colar link no app
- App → **Conta → Configurações** → Checkout URL → cole o link MP → Salvar

---

## 4. Verificação

| Teste | Resultado esperado |
|---|---|
| Abrir app, sem chaves | Funciona local, dados em localStorage |
| Colar Supabase URL+key, recarregar | Aba "Conta" mostra Login/Cadastro |
| Cadastrar + logar | Pull automático; lançamentos aparecem |
| Logar em outro dispositivo | Mesmos dados sincronizados |
| Tentar exportar CSV (free) | Modal "Assinar PRO" |
| Pagar via checkout (cartão de teste) | Em ~30s, plano vira "pro" e exportação libera |
| Modo offline (DevTools → Offline) | App continua funcionando |

---

## 5. Custo

- **Supabase**: grátis até 500 MB de banco + 50.000 requisições/mês
- **Stripe**: 3.99% + R$ 0,39 por transação aprovada
- **Mercado Pago**: ~4.99% por transação à vista, taxas menores no PIX
- **GitHub Pages**: grátis para repos públicos, ilimitado

---

## 6. Problemas comuns

**"Supabase não configurado"** — chaves vazias ou URL com erro. Confira em Configurações.

**"new row violates row-level security policy"** — não rodou o `schema.sql` completo, ou o trigger de `handle_new_user` falhou. Rode o SQL de novo.

**Webhook não dispara** — confirme que o Payment Link inclui `client_reference_id` (Stripe) ou `external_reference` (MP). O app já injeta o `user_id` automaticamente na URL.

**App não atualiza** — o service worker cacheia. Force reload (Ctrl+Shift+R) ou desinstale e reinstale o app.

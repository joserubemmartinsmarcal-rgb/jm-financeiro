# JM Transportes — Financeiro

App de controle financeiro instalável (PWA) com login, sincronização em nuvem e plano PRO.

- **Funciona offline** (service worker + localStorage)
- **Instalável** no celular (Android/iOS) e desktop como app nativo
- **Login opcional** via Supabase — sem login, app roda 100% local
- **Plano PRO** com exportação CSV e relatórios avançados, cobrança via Stripe ou Mercado Pago

## Stack

Tudo em arquivo único, sem build. React via CDN + Tailwind CDN + Recharts + Supabase JS.

## Setup rápido

1. Habilite GitHub Pages: **Settings → Pages → Source: GitHub Actions** (uma vez)
2. Faça push em `main` → o workflow `.github/workflows/pages.yml` publica automaticamente
3. Acesse `https://<seu-usuario>.github.io/<repo>/`
4. Para login + sync + cobrança: siga [SETUP.md](./SETUP.md)

## Estrutura

```
index.html                     SPA principal (React inline)
sw.js                          Service worker offline-first
manifest.webmanifest           Manifest PWA
icons/                         Ícones do app
lib/cloud.js                   Bridge Supabase + sync + billing (window.JMCloud)
supabase/schema.sql            Schema SQL (rodar 1 vez no Supabase)
supabase/functions/            Edge Functions (webhook de pagamento)
.github/workflows/pages.yml    Deploy automático
```

## Modos de operação

| Modo | O que precisa | O que funciona |
|---|---|---|
| **Local** | Nada | Tudo, mas dados ficam só no celular |
| **Cloud** | Conta Supabase + chaves coladas em "Conta → Configurações" | Login + sync entre dispositivos |
| **PRO** | Cloud + link Stripe/MP colado em Configurações | Exportação CSV + relatórios avançados |

## Roadmap

- [x] PWA instalável + offline
- [x] Login Supabase + sync
- [x] Plano PRO com gates
- [x] Webhook Stripe / Mercado Pago
- [ ] Importação OFX
- [ ] Múltiplas empresas (PRO)
- [ ] Relatório anual (PRO)
- [ ] Open Finance (Belvo / Pluggy)

## Licença

Privado — JM Transportes.

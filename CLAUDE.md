# CLAUDE.md

Este arquivo fornece orientações ao Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Visão geral do repositório

Aplicação web de controle financeiro em arquivo único para **JM Transportes**
(empresa brasileira de transporte/logística), empacotada como PWA
instalável. Toda a aplicação vive em `index.html.html` (~532 linhas — note
a extensão dupla `.html`; este é o nome real do arquivo). React, ReactDOM,
Recharts, lucide-react, Tailwind e Babel-standalone são todos carregados de
CDNs em runtime. **Não há etapa de build, gerenciador de pacotes, testes
ou linter.**

Strings de UI, categorias e comentários estão em português brasileiro.
Preserve o texto pt-BR e a formatação de moeda BRL ao editar.

## Executando e "buildando"

- **Abrir localmente:** sirva o diretório e abra `index.html.html`, por
  exemplo: `python3 -m http.server 8000` e acesse
  `http://localhost:8000/index.html.html`. Abrir o arquivo via `file://`
  funciona, mas o banner de instalação do PWA não será disparado.
- **Sem build, sem instalação, sem testes.** Não introduza um bundler,
  `package.json` ou migração de framework a menos que solicitado
  explicitamente — a propriedade "arquivo único, somente CDN, Babel no
  navegador" é intencional. JSX é compilado em runtime pelo
  `babel-standalone`; não há etapa de pré-compilação.
- **CI:** `.github/workflows/jekyll-docker.yml` executa um build Docker do
  Jekyll em push/PR para `main`. Não há conteúdo Jekyll real (`_config.yml`,
  layouts, etc.), então o build é efetivamente um no-op de site sobre o
  HTML estático.

## Arquitetura

Todo o código de aplicação está dentro de um único bloco
`<script type="text/babel">` começando por volta da linha 89.
Babel-standalone transpila JSX no navegador no carregamento — espere um
breve flash antes da árvore React montar.

**Layout de alto nível (`index.html.html`):**
- Linhas 1–51: `<head>` — meta tags, `manifest` PWA inline em data-URL,
  SVGs de ícone do app, tags de script de CDN, CSS base.
- Linhas 52–87: DOM do banner de instalação + JS não-React que captura
  `beforeinstallprompt` e persiste o descarte sob a chave
  `localStorage` `jm:install-dismissed`.
- Linhas 89–530: a aplicação React dentro de
  `<script type="text/babel">`.
- Linha 529: `ReactDOM.createRoot(...).render(<App/>)`.

**Padrão de estado:** Sem Redux/Context. O componente raiz `App` (linha
~497) mantém o estado da aba e quatro arrays de dados via o hook
customizado `useStored(key, initial)` (linha ~121), que envolve `useState`
com leitura inicial do `localStorage` e gravação via `useEffect` em
mudanças. Cada seção de topo (`Dashboard`, `Lancamentos`, `Boletos`,
`Notas`, `Dividas`) recebe props `data` e `setData` e muta substituindo o
array.

**Primitivos de UI compartilhados** (definidos inline, linhas ~127–165):
`Card`, `Button`, `Inp`, `Sel`, `Badge`, `Modal`, `Empty`, `KpiMini`.
Reutilize-os em vez de adicionar novos wrappers estilizados.

**Gráficos:** Recharts (`BarChart`, `PieChart`) — desestruturados do
objeto global `Recharts` no topo do script. Ícones lucide-react são
desestruturados do global `LucideReact`. **Não use `import` desses
módulos** — não há resolvedor de módulos; eles existem apenas como
globais do `window`.

**Estilização:** Classes utilitárias do Tailwind via o script JIT da CDN
(`cdn.tailwindcss.com`) mais `style={{...}}` inline para tokens de cor. O
objeto de paleta `C` (linha ~103) é a fonte da verdade para as cores da
marca; reutilize `C.navy`, `C.primary`, `C.green`, `C.red`, `C.amber`,
`C.purple`, etc. O array `PIE_COLORS` define a paleta dos gráficos.

## Modelo de domínio

Quatro coleções, persistidas no `localStorage` sob estas chaves exatas
(forma longa; não renomeie sem migração — note que diferem das chaves de
forma curta usadas no repositório irmão `FINANJM`):

| Estado / prop | Chave do localStorage | Formato do item (campos principais)                                                                              |
| ------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `lancamentos` | `jm:lancamentos`      | `{id, data, descricao, categoria, tipo: "Receita"\|"Despesa", valor}`                                            |
| `boletos`     | `jm:boletos`          | `{id, fornecedor, valor, vencimento, categoria, status: "A Pagar"\|"Pago"}`                                      |
| `notas`       | `jm:notas`            | `{id, cliente, numNota, valor, vencimento, status: "A Receber"\|"Recebido"}`                                     |
| `dividas`     | `jm:dividas`          | `{id, credor, tipo, valorOriginal, saldo, parcelaTotal, parcelaPaga, valorParcela, proxVenc, status: "Ativo"\|"Quitado"}` |

Convenções:

- `id` = `uid()` (timestamp + aleatório). Nunca reutilize nem reordene
  por id.
- Datas são strings ISO `YYYY-MM-DD`; agrupamento mensal usa
  `iso.slice(0,7)` contra `todayISO().slice(0,7)`. Não armazene objetos
  `Date`.
- Dinheiro é `Number`; exibição passa por `fmtBRL` (BRL completo) ou
  `fmtBRLc` (compacto, ex.: `R$ 12,5k`).
- As listas de categorias `CATS_REC` / `CATS_DESP` (linha ~167) são a
  fonte da verdade para os selects de receita/despesa.
- Strings de status são rótulos pt-BR voltados ao usuário comparados
  diretamente (`status === "Pago"`). Não traduza nem altere a
  capitalização.
- O handler "Marcar parcela paga" de `dividas` decrementa `saldo` em
  `valorParcela` (limitado em 0) e altera o status para `"Quitado"` quando
  `parcelaPaga >= parcelaTotal`. Mantenha esse invariante se mexer nesse
  fluxo.

Abas (estado `tab`): `dashboard`, `lancamentos`, `boletos`, `notas`,
`dividas`. Mantenha essas strings literais sincronizadas entre o switch
do `App` e o array `tabs` da navegação inferior.

## Notas sobre o PWA

O manifest, ícones do app e `apple-touch-icon` estão inlinados como URLs
`data:` no `<head>`. **Não há `manifest.json` separado nem service
worker**, então a aplicação funciona offline apenas via cache HTTP do
navegador; não afirme suporte offline completo sem antes adicionar um
service worker. O banner de instalação só aparece em navegadores que
disparam `beforeinstallprompt` (Chrome no Android/desktop) e respeita a
flag `jm:install-dismissed`.

## Peculiaridade do nome de arquivo

O arquivo principal é **`index.html.html`**, não `index.html`. A maioria
dos defaults de hospedagem estática serve `index.html`, então deploys
podem precisar de um caminho de URL explícito, uma regra de redirect, ou
um rename. Se renomear, atualize qualquer referência na configuração de
deploy (atualmente nenhuma existe no repositório).

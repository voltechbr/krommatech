# Kromma Tech — fundação (Etapa 1)
Site estático (HTML/CSS/JS puro). Sem dependências: abra por um servidor local (`python3 -m http.server`).
- `css/tokens.css` cores, tipografia, espaços, formas, movimento · `css/base.css` reset, tipografia, utilitários · `css/components.css` botões, cards, ícones, header, hero base
- `assets/brand/` logo (original intacto + cópia recortada das margens transparentes) · `assets/video/` vídeo original + cópia H.264 de compatibilidade + poster
- `styleguide.html` guia vivo (interno, noindex) · `index.html` casca vazia pronta para a Etapa 2

## Etapa 2 — Loading + Hero
- `css/intro.css` + `js/intro.js`: loading cinematográfico (~3,7 s, Web Animations API). Roda só na 1ª entrada da sessão (`sessionStorage`), nunca com "reduzir movimento". **Para rever: abra `index.html?intro`** (ou limpe a sessão). Botão "Pular" / Esc.
- `css/hero.css` + `js/hero.js`: hero da home (escopo `.hero--home`). Vídeo só é deslocado por CSS (roda à direita no desktop; empilhado no retrato); o arquivo não foi alterado.
- `js/main.js`: única mudança = respeita `data-hold` (o vídeo só inicia quando o loading entrega).
- Pendentes: `#produtos` (seção da próxima etapa) e `#contato` (aguarda número de WhatsApp).

## Etapa 3 — Estrutura do site
- `css/site.css` + `js/site.js`: header (nav, WhatsApp, menu mobile, some ao descer/volta ao subir), 8 seções após o hero e rodapé. Hero/loading intocados.
- Espaços de foto: `.slot[data-slot]` — troque por `<img>`. Textos "a informar/a definir" são pendências reais.
- WhatsApp: preencher `WA_NUMBER` no topo de `js/site.js` (vazio = botões levam a `#contato`).

## Etapa 4 — Vitrine
- Categorias: trilho de 6 painéis (desktop expande ao passar o mouse/foco; mobile vira mosaico). Cada uma tem foto-slot e glifo próprio (`g-*` em `sprite.svg`). "Serviços" leva a `#servicos`; as demais filtram a vitrine.
- Produtos em destaque: 5 cards em layouts diferentes (grande, faixa, 2 quadrados, panorama) + filtro por categoria. Cada card tem foto-slot, categoria, "Nome do produto" (placeholder) e botão de WhatsApp com mensagem própria (`data-wa-msg`).
- WhatsApp continua dependendo de `WA_NUMBER` em `js/site.js`.

## Etapa 5 — Sobre, Fachada/Loja, Serviços, Galeria
- `#sobre` (composição loja+equipe sobreposta), `#loja` (fachada panorâmica + 2 fotos), `#servicos` (intro fixa + lista com ícone/foto), `#galeria` (mosaico de 6: Carros, Rodas instaladas, Projetos).
- Nenhum serviço foi confirmado no conteúdo: as 4 linhas são modelos ("a confirmar"). Todas as fotos são `.slot[data-slot]`.

## Etapa 6 — Diferenciais, Localização, Contato, Rodapé
- `#diferenciais` (estrutura de 4 itens "a confirmar"), `#localizacao` (mapa Google incorporado + "Abrir no Google Maps" + "Como chegar"), `#contato` (WhatsApp, Instagram @krommatech, endereço), rodapé completo.
- Elementos com `data-wa-only` (card e item do rodapé de WhatsApp) ficam ocultos enquanto `WA_NUMBER` (js/site.js) estiver vazio.

## Integração de fotos (8 enviadas)
Fotos otimizadas em `assets/img/` (legendas/marca d'água gravadas e pontos de carrossel foram recortados). Uso, sem repetição:
categoria Rodas · categoria Pneus · destaque Rodas · destaque Pneus · galeria (picape + 2 rodas) · Sobre (pilha de pneus na porta).
Sem foto ainda: categorias Peças/Acessórios/Serviços/Veículos, destaques Veículos/Peças/Acessórios, Fachada e loja (3), foto da equipe, 1 espaço da galeria.

## Etapa 8 — Refinamento mobile + novas fotos
- Novas fotos (`assets/img/`): `fachada-kromma-tech.jpg` → #loja (fachada); `vitrine-molas-eibach.jpg` → categoria Peças; `picape-amarela-4x4-loja.jpg` → galeria (Projetos). Cada foto aparece uma única vez.
- Mobile (bloco "ETAPA 8" no fim de `css/site.css`): menu em tela cheia com itens de 64px e rolagem, botões/chips ≥ 44px, cards de produto com espaçamento único, título do contato, botões da localização, rodapé e margens em telas ≤ 380px. Hero, logo e desktop intocados.
- Ainda sem foto: categorias Acessórios/Serviços/Veículos, destaques Veículos/Peças/Acessórios, ambiente interno, atendimento, equipe, serviços.

## Etapa 9 — Revisão final
- SEO: título/descrição, `robots` index,follow, Open Graph + Twitter Card (`assets/og/kromma-og.jpg`, 1200×630), JSON-LD `AutoPartsStore` (nome, endereço, telefone, Instagram), favicon (`favicon.ico`, `assets/brand/icon-*.png`, apple-touch-icon), `robots.txt`.
- **Ao publicar:** trocar `og:image`/`twitter:image` por URL absoluta do domínio e, se quiser, adicionar `og:url`, `<link rel="canonical">` e `sitemap.xml` (domínio ainda não definido).
- Sem WhatsApp configurado (`WA_NUMBER` em `js/site.js`), os botões viram "Ligar" para o telefone da fachada (41) 3032-4864; ao preencher o número, voltam a abrir o WhatsApp.
- Textos provisórios removidos. Seções Serviços e Diferenciais (sem conteúdo oficial) saíram do `index.html` e estão em `_pendentes/` para restaurar quando houver texto real. Vitrine mostra só Rodas e Pneus (os únicos com foto).
- Economia de dados: com `saveData` o vídeo do hero não inicia (fica o poster).

## Etapa 10 — 3 novas fotos nas categorias
- Acessórios → `expositor-palhetas-rodas.jpg` · Serviços → `mecanico-alinhamento-roda.jpg` · Veículos → `picape-preta-galpao-pneus.jpg` (marca d'água do rodapé recortada). Fotos fornecidas pelo cliente, sem etiqueta de "ilustrativa".
- Todas as 6 categorias agora têm foto. Seções Serviços/Diferenciais continuam em `_pendentes/` (sem conteúdo oficial).

## Novo vídeo do hero
- `assets/video/hero-kromma.webm` (VP9, 0,65 MB) + `hero-kromma.mp4` (H.264, 1,2 MB) + `hero-poster.jpg` (quadro do novo vídeo). Vídeos anteriores removidos.
- Origem: vídeo enviado (1024×576, 5 s). Recortado em 1024×520 para eliminar a marca "Dola AI", sem áudio, com 0,6 s de fusão no fim para o loop não ter salto. Enquadramento/máscara do hero (`css/hero.css`) inalterados.

## Etapa 11 — Nova animação da roda (entrada)
- A roda do loading agora é **3D de verdade** (WebGL puro, sem bibliotecas): `js/wheel3d.js` gera em código pneu (banda de rodagem, flanco com relevo e letras/fio vermelhos), aro polido com friso vermelho, 10 raios chanfrados, cubo com 5 porcas, disco de freio furado e pinça vermelha. Iluminação com "estúdio" procedural (softboxes, faixa vermelha) refletida nos metais.
- Movimento só na horizontal, esquerda → direita: entra de fora do quadro, acelera, gira como roda rolando, cresce ~18% ao passar e sai pela direita. Câmera fixa, sem movimento de profundidade. Motion blur real (média de sub-quadros de posição + rotação + antialias por jitter).
- `js/intro.js`: trajetória única (usada pelo 3D e pelo DOM), rastros e brilho vermelhos, cortina diagonal que acompanha o eixo da roda e libera o HERO atrás dela. Duração ~2,5 s. Logo, "Pular"/Esc, header e HERO (vídeo) inalterados.
- Sem WebGL: o loading segue só com rastros/cortina e entrega o HERO normalmente. Menos sub-quadros em aparelhos lentos (adaptativo).
- QA: `index.html?intro&hold` congela; no console `__krommaIntro.seek(ms)` mostra qualquer instante (0–2540).

## Etapa 12 — Refinamento de fotos + experiência mobile
- **Fotos:** `tools/otimizar-imagens.py` trata cada foto (limpeza leve de compressão, ampliação Lanczos até 2x, nitidez por borda, sombras/realces, vibrance suave; sem IA generativa) e exporta 480/800/1200/1600 px em WebP + JPEG. Originais intactos em `assets/img/_originais/`. O HTML usa `<picture>` + `srcset/sizes`. As fotos enviadas são pequenas (máx. 1254 px): com originais maiores, coloque-os em `_originais/` e rode o script (`python3 tools/otimizar-imagens.py`).
- **Mobile:** `css/mobile.css` (carregado após `site.css`, só media queries/toque; desktop ≥961px inalterado) + `js/mobile.js`. Botão de contato no cabeçalho, menu com rolagem travada, categorias com enquadramento por foto, produtos em carrossel com indicador (celular), galeria/Sobre/fachada sem cortes, mapa que não prende a rolagem (toque para ativar), rodapé em colunas, hero sem blur animado.
- Rodapé: removido `<li>` vazio (resto da seção Serviços).
- QA: sem overflow e sem alvos <44px em 320–768 px.

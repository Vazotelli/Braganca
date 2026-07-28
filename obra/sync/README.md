# Sincronização com Google Sheets — Obra Bragança

A app guarda tudo no telemóvel (localStorage). A sincronização é **opcional** e
serve para: (a) ter cópia de segurança na tua Google Sheet e (b) partilhar os
dados entre dispositivos (ex.: telemóvel + computador).

Modelo: a app envia o **estado completo** (um documento JSON) e lê-o de volta.
Reconciliação simples **last-write-wins** pela marca de tempo `atualizadoEm`.

## ⚠️ Usa uma Sheet NOVA (não a do tracker de despesas)

O tracker de despesas tem o seu próprio Apps Script (com `doGet`/`doPost`) na
Sheet dele. **NÃO** cries este script nessa Sheet — partirias o tracker (um
projeto só admite um `doGet`/`doPost`). Cria uma **Sheet nova e vazia** só para
a obra.

## Instalar (uma vez, ~3 minutos)

1. Cria uma **Google Sheet nova e vazia** (ex.: nome "Obra Bragança — sync").
2. Menu **Extensões → Apps Script**.
3. Cola **todo** o conteúdo de `Codigo.gs` (o projeto está vazio). Guarda (💾).
4. Carrega em **Implementar → Nova implementação**.
   - Engrenagem ⚙ → tipo **App Web**.
   - **Executar como:** Eu (a tua conta).
   - **Quem tem acesso:** Qualquer pessoa.
   - **Implementar**. Autoriza os acessos quando pedir.
5. Copia o **URL da app Web** (termina em `/exec`).
6. Na app: **Painel → Sincronização**, cola o URL e toca em **Sincronizar agora**.

Pronto. A partir daí, tocas em *Sincronizar agora* sempre que quiseres enviar/
receber. Uma folha oculta `OBRA_APP` é criada na Sheet — não mexer à mão.

> Se mudares o código do `Codigo.gs`, tens de fazer **Implementar → Gerir
> implementações → editar → Nova versão** (o URL mantém-se).

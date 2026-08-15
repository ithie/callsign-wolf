# Callsign WOLF — Release TODO (v1.5 Freemium)

## 1. App Store Connect — IAP

- [ ] IAP zur Review einreichen — **aber noch NICHT aktivieren**

---

## 2. Sandbox auf echtem Gerät testen

- App Store Connect → Benutzer & Zugriff → Sandbox-Tester → neuen Sandbox-Account anlegen
- Auf iPhone: **Einstellungen → App Store → Sandbox-Account** eintragen
- App über Xcode installieren → Kaufflow läuft gegen Sandbox-Server (keine echten Kosten)

---

## 3. App Store Connect — Release koordinieren

**Reihenfolge ist kritisch** — IAP muss live sein bevor die App kostenlos wird.

- [ ] App-Update einreichen (v1.5)
- [ ] Beide von Apple genehmigen lassen (läuft getrennt)
- [ ] Sobald beide approved:
    1. **IAP veröffentlichen**
    2. ~10 Minuten warten
    3. **App-Update veröffentlichen** + App-Preis auf **Kostenlos** stellen

---

## 4. Review Notes für Apple

Beim App-Update-Submit unter **"Notes for reviewer"** eintragen:

> This update introduces a freemium model. The app is now free to download.
> A one-time non-consumable in-app purchase ("Full Version", product ID: `i.thie.softworks.wolf.fullgame`, price: €1.99) unlocks all campaigns, scenarios, and rank progression.
>
> **Free tier:** Tutorial + one Free Flight scenario ("Seenotrettung").
> **Full version:** All campaigns, all Free Flight scenarios, rank progression, full helicopter roster.
>
> Users who previously purchased the app (originalApplicationVersion < "1.5") are automatically grandfathered and receive the full version without an additional purchase.
>
> **Sandbox test account:**
> Login: [pier.verse@ithie.softworks.com]
> Password: [I4p-demonstrat]
>
> To test the purchase flow: start the app, navigate to "Kampagne wählen", tap any campaign card with the purple "VOLLVERSION" stamp.

_(Sandbox-Account-Daten vorher in App Store Connect anlegen und hier eintragen.)_

---

## 5. App Store Connect — Beschreibung anpassen

Nur der letzte Satz ändert sich jeweils (Änderung **fett**).

### DE

SAR: Callsign WOLF ist ein isometrisches Hubschrauber-Spiel mit Pixel/Pseudo-Voxel-Optik.

Du fliegst einen Search and Rescue Hubschrauber und musst Personen und Kisten bergen. Das ist im Kern alles.
Inhalt:
• 4 verschiedene Hubschrauber
• Aufstieg durch 4 Dienstgrade
• Tutorial
• 4 Szenario Missionen
• Kampagne mit 5 Missionen (zwei weitere Kampagnen sind in Arbeit und kommen kostenlos als Update)

Die Steuerung ist direkt auf Touch ausgelegt. Durch den winzigen Download passt das Spiel auf jedes Gerät. Es gibt ein paar kleinere optische Glitches (Engine-bedingt), die aber im Spiel meist nicht weiter stören.

Wer ein werbefreies Spiel sucht, ohne Schnickschnack, das man ohne Netzverbindung spielen kann, kann hier reinschauen. Die Grundversion ist kostenlos — alle Kampagnen, Szenarien und die volle Rangprogression lassen sich per einmaligem In-App-Kauf für 1,99 € freischalten.

---

### EN

SAR: Callsign WOLF is an isometric helicopter game with pixel/pseudo-voxel graphics.

You fly a search-and-rescue helicopter and must rescue people and retrieve crates. That's essentially it.
Features:
• 4 different helicopters
• Rank up through 4 ranks
• Tutorial
• 4 scenario missions
• Campaign with 5 missions (two additional campaigns are in the works and will be released as free updates)

The controls are designed specifically for touch. Thanks to its tiny download size, the game fits on any device. There are a few minor visual glitches (due to the engine), but they usually don't interfere with gameplay.

If you're looking for an ad-free game with no frills that you can play offline, check this one out. The base version is free — all campaigns, scenarios, and full rank progression can be unlocked with a one-time in-app purchase of €1.99.

---

### FR

SAR: Callsign WOLF est un jeu d'hélicoptère isométrique au rendu pixelisé/pseudo-voxel.

Vous pilotez un hélicoptère de recherche et de sauvetage et devez secourir des personnes et récupérer des caisses. C'est en gros tout ce dont il s'agit.
Contenu:
• 4 hélicoptères différents
• Progression à travers 4 grades
• Tutoriel
• 4 missions de scénario
• Campagne de 5 missions (deux autres campagnes sont en cours de développement et seront disponibles gratuitement sous forme de mise à jour)

Les commandes sont spécialement conçues pour le tactile. Grâce à sa taille de téléchargement réduite, le jeu s'adapte à tous les appareils. Il présente quelques petits bugs visuels (liés au moteur), mais ceux-ci ne gênent généralement pas le gameplay.

Si vous recherchez un jeu sans publicité, sans fioritures et jouable sans connexion Internet, n'hésitez pas à y jeter un œil. La version de base est gratuite — toutes les campagnes, les scénarios et la progression complète des grades sont débloquables via un achat unique de 1,99 €.

---

### PT-BR

SAR: Callsign WOLF é um jogo de helicóptero isométrico com visual pixel/pseudo-voxel.

Você pilota um helicóptero de Busca e Resgate (SAR) e deve resgatar pessoas e caixas. Basicamente, é isso.
Conteúdo:
• 4 helicópteros diferentes
• Progressão através de 4 patentes
• Tutorial
• 4 missões de cenário
• Campanha com 5 missões (duas campanhas adicionais estão em desenvolvimento e serão lançadas como atualização gratuita)

Os controles foram projetados diretamente para telas de toque. Graças ao download superleve, o jogo cabe em qualquer dispositivo. Existem alguns pequenos glitches visuais (limitações da engine), mas que não atrapalham a jogabilidade.

Se você procura um jogo sem anúncios, sem frescuras e que possa ser jogado totalmente offline, vale a pena conferir. A versão básica é gratuita — todas as campanhas, cenários e a progressão completa de patentes podem ser desbloqueados com uma compra única de 1,99 €.

---

### PT-PT

SAR: Callsign WOLF é um jogo isométrico de helicópteros com gráficos em pixel/pseudo-voxel.

Pilotas um helicóptero de Busca e Salvamento e tens de resgatar pessoas e caixas. Basicamente, é isso.
Conteúdo:
• 4 helicópteros diferentes
• Subida através de 4 patentes
• Tutorial
• 4 missões de cenário
• Campanha com 5 missões (duas campanhas adicionais estão em desenvolvimento e serão disponibilizadas gratuitamente como atualização)

Os controlos foram concebidos especificamente para ecrãs táteis. Graças ao tamanho reduzido do ficheiro de download, o jogo cabe em qualquer dispositivo. Existem algumas pequenas falhas visuais (devidas ao motor do jogo), mas que, na maioria das vezes, não perturbam a jogabilidade.

Quem procura um jogo sem publicidade, sem frescuras e que possa ser jogado sem ligação à Internet, pode dar uma vista de olhos aqui. A versão base é gratuita — todas as campanhas, cenários e a progressão completa de patentes podem ser desbloqueados com uma compra única de 1,99 €.

---

### ES

SAR: Callsign WOLF es un juego isométrico de helicópteros con gráficos pixelados y pseudovoxel.

Pilotas un helicóptero de búsqueda y rescate y tienes que rescatar a personas y recoger cajas. En esencia, eso es todo.
Contenido:
• 4 helicópteros diferentes
• Ascenso a través de 4 rangos
• Tutorial
• 4 misiones de escenario
• Campaña con 5 misiones (se están preparando otras dos campañas que se lanzarán de forma gratuita como actualización)

Los controles están diseñados específicamente para pantallas táctiles. Gracias a su reducido tamaño de descarga, el juego cabe en cualquier dispositivo. Hay algunos pequeños fallos gráficos (debidos al motor del juego), pero que, por lo general, no molestan demasiado durante la partida.

Si buscas un juego sin publicidad, sin florituras y al que puedas jugar sin conexión a Internet, échale un vistazo. La versión básica es gratuita — todas las campañas, escenarios y la progresión completa de rangos se pueden desbloquear con una compra única de 1,99 €.

---

## 6. App Store Connect — „Was ist neu"

### DE

Callsign WOLF ist jetzt kostenlos! Starte mit Tutorial und dem Freiflugszenario „Seenotrettung" — alle weiteren Kampagnen, Szenarien und die volle Rangprogression gibt es als einmaligen In-App-Kauf für 1,99 €. Wer die App vor Version 1.5 gekauft hat, erhält die Vollversion automatisch und ohne Aufpreis.

### EN

Callsign WOLF is now free! Start with the tutorial and the free-flight scenario "Sea Rescue" — unlock all campaigns, scenarios, and full rank progression with a one-time in-app purchase of €1.99. If you purchased the app before version 1.5, you'll automatically receive the full version at no extra charge.

### FR

Callsign WOLF est maintenant gratuit ! Commencez avec le tutoriel et le scénario « Sauvetage en mer » — débloquez toutes les campagnes, tous les scénarios et la progression complète des rangs avec un achat unique de 1,99 €. Si vous avez acheté l'application avant la version 1.5, vous recevez automatiquement la version complète sans frais supplémentaires.

### ES

¡Callsign WOLF ahora es gratis! Empieza con el tutorial y el escenario «Rescate marítimo» — desbloquea todas las campañas, escenarios y la progresión de rangos completa con una compra única de 1,99 €. Si compraste la app antes de la versión 1.5, recibirás automáticamente la versión completa sin coste adicional.

### PT-BR

Callsign WOLF agora é gratuito! Comece com o tutorial e o cenário «Resgate marítimo» — desbloqueie todas as campanhas, cenários e a progressão completa de patentes com uma compra única de 1,99 €. Se você comprou o app antes da versão 1.5, receberá automaticamente a versão completa sem custo adicional.

### PT-PT

Callsign WOLF é agora gratuito! Comece com o tutorial e o cenário «Resgate marítimo» — desbloqueie todas as campanhas, cenários e a progressão completa de patentes com uma compra única de 1,99 €. Se adquiriu a aplicação antes da versão 1.5, receberá automaticamente a versão completa sem custos adicionais.

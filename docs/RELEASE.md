# Release Process

## Branching

| Branch      | Zweck                                                          |
| ----------- | -------------------------------------------------------------- |
| `main`      | Stable — nur Bugfixes und kleine technische Anpassungen direkt |
| `feature/*` | Neue Features — immer per Pull Request auf `main` mergen       |

## Einen Release durchführen

**1. Version hochzählen** in `package.json`:

```json
"version": "25.4"
```

**2. CHANGELOG.md** — neuen Abschnitt oben einfügen:

```markdown
## v25.4 — Kurzbeschreibung

### New

-   ...

### Technical

-   ...
```

**3. Commit & Push auf `main`**:

```sh
git add -A
git commit -m "chore: release v25.4"
git push
```

→ Kein Deploy — `push` auf `main` löst nichts aus.

**4. Tag setzen & pushen** → löst Deploy auf GitHub Pages aus:

```sh
git tag v25.4
git push --tags
```

## Manueller Deploy der Promo-Seite (ohne Tag)

Über die GitHub-UI: **Actions → Deploy to GitHub Pages → Run workflow**.

Nützlich wenn die Promo-Seite aktualisiert werden soll ohne einen neuen Tag anzulegen.

## App-Build (iOS)

```sh
npm run build:ios
```

Baut `dist/index.html` mit `VITE_TARGET=app` und synchronisiert das Ergebnis ins Xcode-Projekt (`npx cap sync ios`). Danach in Xcode archivieren oder auf Gerät deployen. Siehe [INSTALL.md](../INSTALL.md) für den vollständigen Workflow.

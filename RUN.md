# Run Gativah Admin Console

Angular 20 (LTS) admin SPA for the Gativah platform (moderation · finance · staff).

> **Node:** this machine's system/default Node is too old for Angular 20
> (`@angular/build` needs Node 20.19+). Always select **Node 20 via fnm** first.
> The repo pins it in `.node-version`, so `fnm use` (no argument) picks it up
> once fnm is loaded.

---

## TL;DR

```powershell
fnm env --use-on-cd | Out-String | Invoke-Expression   # once per terminal
cd "D:\My Dream Project\masco\gativah-admin"
fnm use            # → Node 20 (reads .node-version)
npm install        # first time only
npm start          # ng serve → http://localhost:4200
```

Then sign in with the dev seed account: **admin@gativah.com / ChangeMe!123**.

---

## PowerShell (Windows default)

```powershell
# 1. Load fnm into the current shell (once per terminal)
fnm env --use-on-cd | Out-String | Invoke-Expression

# 2. Move to the project (fnm auto-switches to Node 20 via .node-version on cd)
cd "D:\My Dream Project\masco\gativah-admin"

# 3. (If fnm didn't auto-switch) pin Node 20 explicitly
fnm use

# 4. Install deps (first run) and start the dev server on :4200
npm install
npm start
```

## Git Bash / WSL

```bash
eval "$(fnm env --shell bash)"
cd "/d/My Dream Project/masco/gativah-admin"
fnm use
npm install
npm start
```

> Tip: to run a one-off command under Node 20 without switching the shell:
> `fnm exec --using=20 -- npm start` (or `-- npx ng build`).

---

## Backend it talks to

The SPA calls **gativah-admin-api** at `http://localhost:8085/api/v1`
(see `src/app/core/environment.ts`). For a working login + data you need, in order:

1. **pacegrit-service** running — its Flyway applies migrations **V87 + V88**
   (admin tables, account-status, moderation tables). Without this, the admin
   API can't boot (it runs `ddl-auto=validate`).
2. **gativah-admin-api** running on **:8085** — on first boot in the `dev`
   profile it seeds a `SUPER_ADMIN` (`admin@gativah.com` / `ChangeMe!123`).
3. **gativah-admin** (`npm start`) on **:4200**.

CORS on the admin API allows `http://localhost:4200` by default
(`cors.allowed-origins`).

---

## Common commands

| Goal                      | Command                                    |
| ------------------------- | ------------------------------------------ |
| Dev server (HMR) on :4200 | `npm start`                                |
| Production build          | `npm run build` → `dist/gativah-admin`     |
| Dev build (unminified)    | `npx ng build --configuration development` |
| Unit tests (vitest)       | `npm test`                                 |
| Different port            | `npx ng serve --port 4300`                 |

---

## Common issues

| Symptom                                           | Fix                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `ng` errors mentioning an unsupported Node engine | Default Node is too old. Run `fnm use` (Node 20) before any `npm` / `ng` command.       |
| Login fails / network errors in the console       | `gativah-admin-api` isn't running on :8085, or pacegrit-service hasn't applied V87+V88. |
| CORS error in the browser                         | Add the SPA origin to `cors.allowed-origins` in `gativah-admin-api`.                    |
| `Port 4200 is already in use`                     | `npx ng serve --port 4300`, or stop the other dev server.                               |
| Blank page after `npm install` on old Node        | Re-run with Node 20: `fnm use` then `npm start`.                                        |

---

## Quick verify checklist (~30s)

1. App loads the **Operator sign-in** screen (dark theme, ember accent).
2. Sign in with the seed account → if MFA isn't enrolled you land straight on the **Dashboard**.
3. Toggle the theme (☾/☀ in the top bar) — the content re-themes light/dark while the **sidebar stays dark**.
4. Open **Grievances** → the report queue loads; click a row → report detail with the action bar.
5. Open **Finance** → KPI cards + the Transactions / Subscriptions / Webhooks tabs render.

(Empty tables are expected until there's real data in the shared dev DB.)

## Super admin account credentials for the dev environment

user name : admin@gativah.com
password : ChangeMe!123

# Despliegue de atm-wo-manager

App solo frontend (React + Vite) que habla directamente con Supabase. Sin API, base de datos ni Redis propios.

Modelo copiado de `ariasbenraq/movilidad-dashboard-`:

```
merge a main ─► CI (lint, build, audit, docker-build, gitleaks)
             ─► build + push ghcr.io/ariasbenraq/atm-wo-manager:<sha>
             ─► el runner entra a la tailnet (tag:ci) ─► SSH a nas-lab (usuario deploy)
             ─► deploy.sh <sha>: pull ─► docker stack deploy ─► espera de salud ─► rollback si falla

Internet ─► Cloudflare ─► cloudflared ─► Caddy ─► atm-web:8080 (stack Swarm "atm")
```

Archivos: `Dockerfile`, `nginx.conf`, `docker/render-nginx-conf.mjs`, `deploy/docker-stack.yml`, `deploy/deploy.sh`, `.github/workflows/{ci,deploy}.yml`, `.github/dependabot.yml`.

> El repositorio es público: los logs de Actions los lee cualquiera. No imprimas secretos ni uses `pull_request_target`.

## Supabase en el build y en la CSP

`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` entran como `ARG` del build y acaban **dentro del bundle JS** (son públicas por diseño; la protección real son las políticas RLS). Por eso van como **variables** de GitHub, no secrets.

El origen de Supabase en la CSP no está fijo: `docker/render-nginx-conf.mjs` toma `new URL(VITE_SUPABASE_URL).origin` y lo sustituye en `nginx.conf` durante el build (`connect-src 'self' https://<proyecto>.supabase.co`). El build falla si la URL falta o no es `https`. Sin realtime ni storage, no se añade `wss://` ni `img-src` de Supabase. Si algún día se usa realtime o storage, hay que ampliar la CSP en `nginx.conf`.

## Lo que debe crear el dueño en GitHub

*Settings → Secrets and variables → Actions*

**Secrets** (los mismos valores que en `movilidad-dashboard-`; los secrets no se comparten entre repos):

| Secret | Valor |
|---|---|
| `DEPLOY_SSH_KEY` | clave privada del usuario `deploy` (completa, con BEGIN y END) |
| `DEPLOY_KNOWN_HOSTS` | salida de `ssh-keyscan -H 100.100.82.79` |
| `DEPLOY_HOST` | `100.100.82.79` |
| `DEPLOY_USER` | `deploy` |
| `TS_OAUTH_CLIENT_ID` | OAuth client de Tailscale |
| `TS_OAUTH_SECRET` | OAuth client de Tailscale |

**Variables** (pestaña *Variables*): `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

**Environment**: *Settings → Environments → New environment* → `production`.

La conexión SSH no necesita nada más en GitHub: el runner entra a la tailnet con el OAuth client, y la clave pública de `deploy` ya está en `nas-lab`.

## Servidor

```bash
sudo install -d -m 755 -o deploy -g deploy /opt/atm
```

No hay `.env` en el servidor: la app no lee variables en ejecución.

## Corte sin interrupción

Hoy Caddy sirve `atm.hamstitors.trade` con `reverse_proxy web:80` (stack viejo `atm-tool-manager`). No se toca Cloudflare ni el DNS.

1. Tras el primer deploy por CI existe el stack `atm` con el servicio `atm-web` en la red `edge`, sin tráfico.
2. Prueba interna desde nas-lab:
   ```bash
   docker run --rm --network edge curlimages/curl -s -o /dev/null -w "%{http_code}\n" http://atm-web:8080/
   ```
   Debe dar `200`.
3. Corte: en `/opt/infra/caddy/Caddyfile`, bloque de `atm.hamstitors.trade`, cambiar `reverse_proxy web:80` por `reverse_proxy atm-web:8080`. Después:
   ```bash
   docker exec caddy caddy validate --config /etc/caddy/Caddyfile
   ```
   Solo si dice `Valid configuration`:
   ```bash
   docker exec caddy caddy reload --config /etc/caddy/Caddyfile
   ```
4. **Rollback del corte:** volver a `reverse_proxy web:80` y recargar Caddy como arriba.
5. Con todo estable, eliminar el stack viejo `atm-tool-manager` en Portainer.
6. Después: restaurar la etiqueta `:latest` en `deploy.yml` (ver comentario en el paso de build) y borrar `.github/workflows/build-and-push.yml`.

Hasta el paso 5, `deploy.yml` sube **solo la etiqueta del SHA**: el stack viejo usa `:latest` en el puerto 80 y esta imagen escucha en 8080.

## Rollback de la aplicación

```bash
bash /opt/atm/deploy.sh "$(cat /opt/atm/.previous_tag)"
```

Un deploy fallido se revierte solo (`failure_action: rollback`) y `deploy.sh` termina con error. `.previous_tag` existe desde el segundo deploy.

## Diagnóstico por capas (de dentro hacia fuera)

```bash
docker stack services atm                      # ¿1/1?
docker service logs --tail 30 atm_atm-web      # ¿arranca nginx?
docker run --rm --network edge curlimages/curl -s -o /dev/null -w "%{http_code}\n" http://atm-web:8080/   # contenedor
curl -s -o /dev/null -w "%{http_code}\n" -H 'Host: atm.hamstitors.trade' http://100.100.82.79/            # Caddy + app, sin Cloudflare
getent hosts atm.hamstitors.trade              # DNS
```

Si en el navegador falla una llamada a Supabase y `curl` va bien, mira la consola: un error de CSP (`connect-src`) indica que el origen de Supabase del build no coincide con el que usa la app.

## Pruebas y CI

No hay script `test` en `package.json`, así que el CI no tiene trabajo de tests (lint, build, `npm audit --omit=dev --audit-level=high`, build de la imagen sin push y gitleaks). Cuando se añada uno, agregar `npm test` a `lint-build` en `ci.yml`.

## Revisiones de seguridad del dueño

- Revisar las políticas RLS de Supabase: el frontend es público.
- Supabase Auth: `Site URL` / redirect URLs deben seguir siendo `https://atm.hamstitors.trade`.
- Confirmar que los JWT que aparecieron en el historial de `.env` son de rol `anon` y no `service_role` (si lo fueran, rotarlos).

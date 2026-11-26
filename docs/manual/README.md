# Manual de usuario de Afilao

Fuente única del manual. Se publica en **https://manual.afilaoapp.com**.

| Archivo | Para qué |
|---|---|
| `MANUAL_DE_USUARIO.md` | El texto. Es lo único que se edita a mano. |
| `capturas/` | Las capturas de pantalla (`NN_nombre.png`) que cita el texto. |
| `generar-html.mjs` | Convierte el `.md` en página web (sin dependencias, solo Node). |
| `Dockerfile`, `nginx.conf` | Construyen y sirven el sitio estático (Easypanel). |

## Editar y ver el resultado

```bash
node docs/manual/generar-html.mjs --sitio /tmp/manual     # sitio como el de producción
npx --yes serve /tmp/manual                               # abrirlo en el navegador
node docs/manual/generar-html.mjs                         # una sola página con las capturas incrustadas (artefacto)
```

El modo `--sitio` saca las capturas a archivos con el hash del contenido en el nombre; el modo sin argumentos las incrusta
en base64 (≈ 9 MB), que es lo que se necesita para publicarlo como artefacto de Claude.

## Versiones

- La portada tiene la fila **Versión del manual**; esa cifra sale en la barra superior de la web. Súbela cuando cambie
  el contenido de forma relevante (1.0 → 1.1 para ajustes, 2.0 para una reorganización).
- El historial es el de git: `git log -- docs/manual`. Para marcar un hito: `git tag manual-v1.1 && git push --tags`.
- El artefacto de Claude es solo una copia: la fuente es este directorio.

## Publicación

Cada cambio en `docs/manual/**` que llega a `main` lo valida y despliega `.github/workflows/manual.yml`. La puesta en
marcha (servicio en Easypanel, DNS en Cloudflare y el secreto del webhook) está en
[`docs/DEPLOYMENT.md`](../DEPLOYMENT.md#manual-manualafilaoappcom).

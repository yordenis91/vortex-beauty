# Manual de usuario de Afilao (manual.afilaoapp.com): sitio estático generado desde MANUAL_DE_USUARIO.md.
# Contexto de construcción: docs/manual (en Easypanel, «Ruta de compilación» = /docs/manual).
FROM node:20-alpine AS build
WORKDIR /manual
COPY MANUAL_DE_USUARIO.md generar-html.mjs ./
COPY capturas ./capturas
RUN node generar-html.mjs --sitio /site

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site /usr/share/nginx/html
RUN nginx -t
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]

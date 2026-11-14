# frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:alpine

# Copiar el build de React
COPY --from=build /app/dist /usr/share/nginx/html

# Configuración de Nginx. Las rutas de la PWA por salón se reenvían al API: su dirección sale de VITE_API_BASE_URL
# (la misma que usa el JS) y se escribe aquí al construir, sin variables en tiempo de ejecución que puedan faltar.
ARG VITE_API_BASE_URL
COPY nginx.conf nginx-pwa-proxy.conf /tmp/
RUN set -eu; \
    api="${VITE_API_BASE_URL:-https://deploy-vortex-backend.wgteoi.easypanel.host/api}"; \
    origin=$(echo "$api" | sed -E 's#^(https?://[^/]+).*#\1#'); \
    host=${origin#*://}; \
    sed -e "s#__API_ORIGIN__#${origin}#g" -e "s#__API_HOST__#${host}#g" /tmp/nginx.conf > /etc/nginx/conf.d/default.conf; \
    sed -e "s#__API_ORIGIN__#${origin}#g" -e "s#__API_HOST__#${host}#g" /tmp/nginx-pwa-proxy.conf > /etc/nginx/pwa_proxy.conf; \
    rm /tmp/nginx.conf /tmp/nginx-pwa-proxy.conf; \
    nginx -t
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
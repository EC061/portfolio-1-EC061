# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------
# 1. build the static bundle
# ---------------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# dependency layer on its own so source edits do not re-resolve npm
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .

# BASE_PATH lets the same image serve from a sub-path behind a reverse
# proxy (e.g. BASE_PATH=/midway/ for https://example.org/midway/)
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
RUN npm run build

# ---------------------------------------------------------------------
# 2. serve it
# ---------------------------------------------------------------------
FROM nginx:1.29-alpine AS runtime

LABEL org.opencontainers.image.title="Midway — a carnival ride in WebXR" \
      org.opencontainers.image.description="three.js fairground: a Ferris wheel with self-levelling gondolas, a swing carousel and teacups, rideable in WebXR." \
      org.opencontainers.image.licenses="MIT"

RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/dist /usr/share/nginx/html

# 8080 rather than 80: nothing here needs a privileged port, and it keeps
# the container drop-in for a reverse proxy that terminates TLS.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

STOPSIGNAL SIGQUIT
CMD ["nginx", "-g", "daemon off;"]

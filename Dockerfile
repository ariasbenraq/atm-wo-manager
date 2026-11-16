# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Supabase settings are public by design (URL + anon key end up in the JS
# bundle). They come from GitHub repository variables, never from a .env file.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

# Put the Supabase origin (scheme + host of VITE_SUPABASE_URL) into the CSP.
# Fails the build if the URL is missing or is not https.
RUN node docker/render-nginx-conf.mjs nginx.conf /app/nginx.rendered.conf

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /app/nginx.rendered.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/"]

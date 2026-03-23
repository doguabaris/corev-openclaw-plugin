FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build Corev CLI and preinstall bundled local host dependencies (zero-manual setup).
RUN npm run build && npm --prefix src/host/server install

EXPOSE 3000

LABEL org.opencontainers.image.source="https://github.com/doguabaris/corev-openclaw-plugin"
LABEL org.opencontainers.image.description="Corev OpenClaw plugin with bundled local corev-host bootstrap support"
LABEL org.opencontainers.image.licenses="MIT"

ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]

# apps/api/Dockerfile

FROM node:20-alpine

WORKDIR /app

# Copia tudo (precisa do workspace)
COPY . .

# Instala pnpm
RUN npm install -g pnpm

# Instala deps do workspace
RUN CI=true pnpm install --frozen-lockfile

# Build da API
RUN pnpm --filter ./apps/api build

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/index.js"]

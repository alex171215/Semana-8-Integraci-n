FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/kong-gateway ./kong-gateway
COPY --from=builder /app/web-practica-Semana\ 8.html ./web-practica-Semana\ 8.html

# Asignar permisos al usuario no root para seguridad de contenedor
RUN chown -R node:node /app
USER node

EXPOSE 8000 3000 3001

CMD ["npm", "run", "start:prod"]

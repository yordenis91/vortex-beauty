FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Si usas TypeScript, aquí deberías compilar:
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "dev"]
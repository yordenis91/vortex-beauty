FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Run migrations
RUN npx prisma migrate deploy

# Run seed
RUN npm run seed

EXPOSE 3000

CMD ["npm", "run", "dev"]
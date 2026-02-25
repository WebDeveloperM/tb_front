# Base image
FROM node:20-alpine as build

# Working directory
WORKDIR /app

# Package.json va lock fayllarni qo'shish
COPY package.json package-lock.json ./

# NPM dependency’larni o‘rnatish
RUN npm install

# Kodni ko‘chirish
COPY . .

# Vite build qilish
RUN npm run build

# Final stage - serve qilish
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist /app/dist
RUN npm install -g serve

# Port ochish
EXPOSE 5175

# Frontend serverni ishga tushirish
CMD ["serve", "-s", "dist", "-l", "5175"]

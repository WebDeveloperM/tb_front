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

# Final stage - nginx bilan HTTPS serve
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]

FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Back4App isi port par check karega
EXPOSE 8080

# Sahi path (src/index.js) define kar diya hai
CMD ["node", "src/index.js"]
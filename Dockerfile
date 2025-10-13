FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Use the correct serve command for your Vite app
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "6890"]
FROM node:24-alpine

WORKDIR /var/node

COPY . .

RUN yarn install

ENTRYPOINT ["yarn", "start"]

FROM node:14-alpine

COPY . /inkohx/app/discordjs-share-chat

WORKDIR /inkohx/app/discordjs-share-chat

RUN npm i --production \
  npm cache clean

ENTRYPOINT [ "npm", "start" ]

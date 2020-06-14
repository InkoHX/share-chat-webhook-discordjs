FROM node:14-alpine

ENV WORKDIR_PATH "/inkohx/app/discordjs-share-chat"

COPY . ${WORKDIR_PATH}

WORKDIR ${WORKDIR_PATH}

RUN npm i --production \
  npm cache clean

VOLUME "${WORKDIR_PATH}/data"

ENTRYPOINT [ "npm", "start" ]

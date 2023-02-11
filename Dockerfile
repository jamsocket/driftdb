FROM node:16

WORKDIR /work

COPY . .

#RUN ./build_js.sh

RUN npm install

WORKDIR /work/js-pkg/demos

RUN npm run build

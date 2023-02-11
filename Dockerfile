FROM public.ecr.aws/t7o4u3y2/node-18.2.0:latest

WORKDIR /work

COPY . .

RUN ./build_js.sh

WORKDIR /work/js-pkg/demos

RUN npm run build

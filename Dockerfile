FROM golang:1.22-alpine AS go-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY internal/ ./internal/
COPY cmd/ ./cmd/
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app ./cmd/app/main.go

FROM node:20-alpine AS node-builder
WORKDIR /app
COPY package.json yarn.lock tailwind.config.js tsconfig.json ./
RUN yarn install
COPY web/ ./web/
RUN yarn run build && yarn run build:styles

FROM alpine:3.19
WORKDIR /app
COPY --from=go-builder /app/app ./
COPY --from=node-builder /app/web/ ./web/
COPY certs/ ./certs/
EXPOSE 8080
CMD ["./app"]

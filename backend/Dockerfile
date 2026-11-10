FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY *.go ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /nebeng-api .

FROM alpine:3.20
RUN adduser -D app && mkdir -p /data && chown app /data
USER app
COPY --from=build /nebeng-api /nebeng-api
ENV PORT=8080 DATA_FILE=/data/nebeng.json
EXPOSE 8080
CMD ["/nebeng-api"]

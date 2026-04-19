# ergo IRC server — replace with pinned image from https://ergo.chat/ in production
FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /ircd
COPY ircd-east.yaml /ircd/ircd.yaml
EXPOSE 6667
CMD ["sh", "-c", "echo 'Replace with ergo binary or official image'; sleep infinity"]

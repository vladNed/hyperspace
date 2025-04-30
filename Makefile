.PHONY: start gen-certs

start:
	@echo "[* HYPERSPACE NODE STARTING *]"
	@echo "=============================="
	@echo ">> Building scripts"
	@yarn run build
	@echo ">> Starting server"
	@go run ./cmd/app/main.go

gen-certs:
	@echo "[* GENERATING CERTIFICATES *]"
	@echo "=========================================="
	@echo ">> Generating certificates"
	@cd ./certs && \
	openssl genpkey -algorithm RSA -out ca.key && \
	openssl req -x509 -new -nodes -key ca.key -sha256 -days 365 -out ca.crt -subj "/CN=Redis CA" && \
	openssl genpkey -algorithm RSA -out redis.key && \
	openssl req -new -key redis.key -out redis.csr -subj "/CN=Redis Server" && \
	openssl x509 -req -in redis.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out redis.crt -days 365 -sha256 && \
	openssl genpkey -algorithm RSA -out client.key && \
	openssl req -new -key client.key -out client.csr -subj "/CN=Redis Client" && \
	openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt -days 365 -sha256 && \
	chmod 644 ./*.crt ./*.key
	@echo ">> Certificates generated"
	@echo "==========================================="
	@echo "[** Certificates are located in ./certs **]"

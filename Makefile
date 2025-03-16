.PHONY: start

start:
	@echo "[* HYPERSPACE NODE STARTING *]"
	@echo "=============================="
	@echo ">> Building scripts"
	@yarn run build
	@echo ">> Starting server"
	@go run ./cmd/app/main.go

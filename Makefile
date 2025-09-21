npm_cli ?= npm
server_workspace ?= @mr-leo/server

.PHONY: start start_project

start: start_project

start_project:
	@echo "[INFO][start_project][$$(date -u +%Y-%m-%dT%H:%M:%SZ)] launching $(server_workspace) dev server"
	@$(npm_cli) run dev --workspace $(server_workspace); \
		exit_code=$$?; \
		echo "[INFO][start_project][$$(date -u +%Y-%m-%dT%H:%M:%SZ)] dev server exited with status $$exit_code"; \
		exit $$exit_code

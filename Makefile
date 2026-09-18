# Klaviearn — one entry point for both halves of the app.
#
# Python comes from server/.venv (see .tool-versions for the interpreter).
# Node comes from your shell — run `nvm use` first (see .nvmrc).

PY := server/.venv/bin/python
NPM := npm --prefix web

.DEFAULT_GOAL := help
.PHONY: help install test test-server test-web lint lint-server lint-web fix check build dev-server dev-web clean

help: ## Show this help
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk -F':.*?## ' '{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install server and web dependencies (including dev tools)
	$(PY) -m pip install -q -r server/requirements-dev.txt
	$(NPM) install

test: test-server test-web ## Run every test

test-server: ## Run the pytest suite
	cd server && .venv/bin/python -m pytest

test-web: ## Run the vitest suite
	$(NPM) run test

lint: lint-server lint-web ## Lint everything

lint-server: ## ruff over the server
	cd server && .venv/bin/ruff check .

lint-web: ## eslint over the web app
	$(NPM) run lint

fix: ## Apply the lint fixes that are safe to automate
	cd server && .venv/bin/ruff check . --fix
	$(NPM) run lint:fix

check: lint test build ## What to run before committing

build: ## Production build of the web app
	$(NPM) run build

dev-server: ## API on :8787
	cd server && .venv/bin/uvicorn app.main:app --port 8787 --reload

dev-web: ## Vite dev server on :5173
	$(NPM) run dev

clean: ## Remove build and cache artefacts
	rm -rf web/dist web/dev-dist server/.pytest_cache server/.ruff_cache
	find server -name __pycache__ -type d -prune -exec rm -rf {} +

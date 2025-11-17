# Package Architecture Audit: @kb-labs/mind-cli

**Date**: 2025-11-16  
**Package Version**: 0.1.0

## 1. Package Purpose & Scope

CLI facade for KB Labs Mind: инициализация, обновление, упаковка и запросы к индексам Mind.

---

## 9. CLI Commands Audit

### 9.1 Product-level help

- `pnpm kb mind --help`:
  - продукт `mind` отображается в списке;
  - доступны команды:
    - `mind:feed`
    - `mind:init`
    - `mind:pack`
    - `mind:query`
    - `mind:update`
    - `mind:verify`.

### 9.2 Статус команд (уровень help)

| Command ID     | Example          | Status        | Notes                            |
|----------------|------------------|---------------|----------------------------------|
| `mind:feed`    | `kb mind feed`   | **OK (help)** | Видна в `kb mind --help`         |
| `mind:init`    | `kb mind init`   | **OK (help)** | Видна в `kb mind --help`         |
| `mind:pack`    | `kb mind pack`   | **OK (help)** | Видна в `kb mind --help`         |
| `mind:query`   | `kb mind query`  | **OK (help)** | Видна в `kb mind --help`         |
| `mind:update`  | `kb mind update` | **OK (help)** | Видна в `kb mind --help`         |
| `mind:verify`  | `kb mind verify` | **OK (help)** | Видна в `kb mind --help`         |

Полный `--help` по отдельным командам не аудировался в этом проходе (только наличие и соответствие manifest ↔ product‑help).



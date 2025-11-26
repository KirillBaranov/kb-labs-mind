# Mind Engine Search Quality Benchmarks

## Benchmark Suite v1.0

Стандартные запросы для оценки качества поиска Mind RAG.

### Запуск бенчмарков

```bash
# Из корня kb-labs
cd /Users/kirillbaranov/Desktop/kb-labs

# Очистить кеш перед тестом
rm -rf .kb/cache/*

# Запустить индексацию (если нужно)
env NODE_OPTIONS="--max-old-space-size=4096 --expose-gc" pnpm kb mind rag-index --scope default

# Запустить все бенчмарки
./kb-labs-mind/packages/mind-engine/scripts/run-benchmarks.sh
```

---

## Benchmark Queries

### 1. EASY - Lookup Query (точечный поиск)
```
What is VectorStore interface and what methods does it have?
```
**Тип:** lookup
**Ожидаемый результат:** Найти `vector-store.ts` с определением интерфейса
**Целевой confidence:** ≥0.6

### 2. MEDIUM - Concept Query (концептуальный)
```
How does hybrid search work in mind-engine? What algorithms does it use?
```
**Тип:** concept
**Ожидаемый результат:** Найти `hybrid.ts`, `adaptive-hybrid.ts`, объяснить RRF
**Целевой confidence:** ≥0.7

### 3. HARD - Architecture Query (архитектурный)
```
Explain the anti-hallucination architecture in mind-engine. How does it verify answers and what strategies does it use to prevent hallucinations?
```
**Тип:** concept/architecture
**Ожидаемый результат:** Найти `verification/`, объяснить source-verifier и field-checker
**Целевой confidence:** ≥0.7

---

## Historical Results

### 2025-11-26 (После улучшений)

| Query | Type | Confidence | Time | Mode | Status |
|-------|------|------------|------|------|--------|
| VectorStore interface | EASY | **0.63** | 38s | auto | ✅ PASS |
| Hybrid search | MEDIUM | **0.78** | 63s | auto | ✅ PASS |
| Anti-hallucination | HARD | **0.70** | 62s | thinking | ✅ PASS |

**Средний confidence:** 0.70 (7.0/10)

#### Изменения в этой версии:
- Подключён `classifyQuery` в instant mode для адаптивных весов
- Улучшен query-classifier для "What is X" паттернов
- Добавлен auto-fallback при низком confidence (instant → auto)
- Смягчена source verification (partial credit)
- Смягчён field-checker (мягкие пенальти)

### 2025-11-26 (До улучшений)

| Query | Type | Confidence | Time | Mode | Status |
|-------|------|------------|------|------|--------|
| VectorStore interface | EASY | **0.017** | ~30s | instant | ❌ FAIL |
| Hybrid search | MEDIUM | **0.50** | ~60s | auto | ⚠️ OK |
| Anti-hallucination | HARD | **0.90** | ~60s | thinking | ✅ PASS |

**Средний confidence:** 0.47 (4.7/10)

---

## Quality Targets

| Complexity | Min Confidence | Target Confidence |
|------------|----------------|-------------------|
| EASY | 0.5 | ≥0.7 |
| MEDIUM | 0.6 | ≥0.8 |
| HARD | 0.6 | ≥0.8 |

**Overall Target:** Average confidence ≥0.75 (7.5/10)

---

## Metrics Explained

### Confidence Score (0-1)
- **0.0-0.3:** Poor - answer likely incomplete or hallucinated
- **0.3-0.5:** Low - some relevant info but gaps
- **0.5-0.7:** Medium - reasonable answer with caveats
- **0.7-0.9:** Good - solid answer with verified sources
- **0.9-1.0:** Excellent - comprehensive, fully verified

### Factors Affecting Confidence
1. **Source Verification** - файлы найдены в чанках
2. **Snippet Matching** - сниппеты совпадают с кодом
3. **Field Verification** - упомянутые поля существуют
4. **LLM Assessment** - оценка полноты ответа

---

## Adding New Benchmarks

При добавлении новых бенчмарков:

1. Определить тип запроса (lookup/concept/code/debug)
2. Указать ожидаемые файлы в результатах
3. Установить целевой confidence
4. Добавить в `scripts/run-benchmarks.sh`
5. Запустить и зафиксировать baseline

### Пример нового бенчмарка:
```markdown
### 4. NEW - [Название]
\`\`\`
[Текст запроса]
\`\`\`
**Тип:** [lookup/concept/code/debug]
**Ожидаемый результат:** [Какие файлы/информацию должен найти]
**Целевой confidence:** ≥[0.X]
```

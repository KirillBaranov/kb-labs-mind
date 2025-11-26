#!/bin/bash
# Mind Engine Search Quality Benchmarks
# Run from kb-labs root directory

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Thresholds
EASY_THRESHOLD=0.5
MEDIUM_THRESHOLD=0.6
HARD_THRESHOLD=0.6

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           Mind Engine Search Quality Benchmarks               ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Change to kb-labs root
cd "$(dirname "$0")/../../../../.."
echo -e "Working directory: $(pwd)"
echo ""

# Run benchmark and extract confidence
run_benchmark() {
    local name="$1"
    local query="$2"
    local threshold="$3"

    echo -e "${YELLOW}Running: $name${NC}"
    echo -e "Query: $query"
    echo ""

    # Run query and capture output
    local start_time=$(date +%s)
    local output=$(env NODE_OPTIONS="--max-old-space-size=4096 --expose-gc" pnpm kb mind rag-query --text "$query" --agent 2>&1)
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Extract confidence
    local confidence=$(echo "$output" | grep -oE '"confidence":[0-9.]+' | head -1 | cut -d: -f2)
    local mode=$(echo "$output" | grep -oE '"mode":"[^"]+"' | head -1 | cut -d: -f2 | tr -d '"')

    # Check if passed
    local passed=$(echo "$confidence >= $threshold" | bc -l)

    if [ "$passed" -eq 1 ]; then
        echo -e "${GREEN}✓ PASS${NC} - confidence: $confidence (threshold: $threshold)"
    else
        echo -e "${RED}✗ FAIL${NC} - confidence: $confidence (threshold: $threshold)"
    fi

    echo -e "  Mode: $mode | Time: ${duration}s"
    echo ""

    # Return values for summary
    echo "$name|$confidence|$duration|$mode|$passed" >> /tmp/benchmark_results.txt
}

# Clear previous results
rm -f /tmp/benchmark_results.txt

echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}                    Running Benchmarks                         ${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo ""

# Run benchmarks
run_benchmark "EASY" "What is VectorStore interface and what methods does it have?" "$EASY_THRESHOLD"
run_benchmark "MEDIUM" "How does hybrid search work in mind-engine? What algorithms does it use?" "$MEDIUM_THRESHOLD"
run_benchmark "HARD" "Explain the anti-hallucination architecture in mind-engine. How does it verify answers and what strategies does it use to prevent hallucinations?" "$HARD_THRESHOLD"

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                         Summary                               ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

total_confidence=0
total_tests=0
passed_tests=0

printf "%-10s | %-12s | %-8s | %-10s | %-6s\n" "Test" "Confidence" "Time" "Mode" "Status"
echo "-----------|--------------|----------|------------|--------"

while IFS='|' read -r name confidence duration mode passed; do
    if [ "$passed" -eq 1 ]; then
        status="${GREEN}PASS${NC}"
        ((passed_tests++))
    else
        status="${RED}FAIL${NC}"
    fi

    printf "%-10s | %-12s | %-8s | %-10s | " "$name" "$confidence" "${duration}s" "$mode"
    echo -e "$status"

    total_confidence=$(echo "$total_confidence + $confidence" | bc -l)
    ((total_tests++))
done < /tmp/benchmark_results.txt

echo ""
avg_confidence=$(echo "scale=2; $total_confidence / $total_tests" | bc -l)
score=$(echo "scale=1; $avg_confidence * 10" | bc -l)

echo -e "Average Confidence: ${YELLOW}$avg_confidence${NC}"
echo -e "Quality Score: ${YELLOW}$score/10${NC}"
echo -e "Tests Passed: ${passed_tests}/${total_tests}"
echo ""

# Cleanup
rm -f /tmp/benchmark_results.txt

# Exit code based on pass rate
if [ "$passed_tests" -eq "$total_tests" ]; then
    echo -e "${GREEN}All benchmarks passed!${NC}"
    exit 0
else
    echo -e "${RED}Some benchmarks failed.${NC}"
    exit 1
fi

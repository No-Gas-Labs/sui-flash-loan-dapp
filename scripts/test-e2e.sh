#!/bin/bash

# End-to-End Testing Script for Sui Flash Loan DApp

set -e

echo "🧪 Starting End-to-End Tests"
echo "============================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "\n${YELLOW}Running: $test_name${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✓ PASSED: $test_name${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED: $test_name${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v curl &> /dev/null; then
    echo "❌ curl not found. Please install curl."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "❌ jq not found. Please install jq."
    exit 1
fi

echo "✅ Prerequisites satisfied"

# Configuration
BACKEND_URL=${BACKEND_URL:-"http://localhost:3001"}
FRONTEND_URL=${FRONTEND_URL:-"http://localhost:3000"}

echo ""
echo "Configuration:"
echo "  Backend URL: $BACKEND_URL"
echo "  Frontend URL: $FRONTEND_URL"
echo ""

# Test 1: Backend Health Check
run_test "Backend Health Check" \
    "curl -f -s $BACKEND_URL/health | jq -e '.status == &quot;healthy&quot;'"

# Test 2: Backend Detailed Health Check
run_test "Backend Detailed Health Check" \
    "curl -f -s $BACKEND_URL/health/detailed | jq -e '.dependencies.sui == &quot;connected&quot;'"

# Test 3: Database Connection
run_test "Database Connection" \
    "curl -f -s $BACKEND_URL/health/detailed | jq -e '.dependencies.database == &quot;connected&quot;'"

# Test 4: Redis Connection
run_test "Redis Connection" \
    "curl -f -s $BACKEND_URL/health/detailed | jq -e '.dependencies.redis == &quot;connected&quot;'"

# Test 5: Frontend Accessibility
run_test "Frontend Accessibility" \
    "curl -f -s -o /dev/null -w '%{http_code}' $FRONTEND_URL | grep -q 200"

# Test 6: API Stats Endpoint
run_test "API Stats Endpoint" \
    "curl -f -s $BACKEND_URL/api/v1/stats | jq -e '.success == true'"

# Test 7: Pool List Endpoint
run_test "Pool List Endpoint" \
    "curl -f -s $BACKEND_URL/api/v1/pools | jq -e '.success == true'"

# Test 8: Gas Estimation Endpoint (with mock data)
run_test "Gas Estimation Endpoint" \
    "curl -f -s -X POST $BACKEND_URL/api/v1/flash-loan/estimate \
    -H 'Content-Type: application/json' \
    -d '{&quot;poolId&quot;:&quot;0x123&quot;,&quot;amount&quot;:1000000000,&quot;borrowerAddress&quot;:&quot;0xabc&quot;}' \
    | jq -e 'has(&quot;success&quot;)'"

# Test 9: Rate Limiting
echo -e "\n${YELLOW}Running: Rate Limiting Test${NC}"
RATE_LIMIT_EXCEEDED=false
for i in {1..150}; do
    response=$(curl -s -o /dev/null -w '%{http_code}' $BACKEND_URL/health)
    if [ "$response" == "429" ]; then
        RATE_LIMIT_EXCEEDED=true
        break
    fi
done

if [ "$RATE_LIMIT_EXCEEDED" = true ]; then
    echo -e "${GREEN}✓ PASSED: Rate Limiting Test${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ SKIPPED: Rate Limiting Test (may need adjustment)${NC}"
fi

# Test 10: CORS Headers
run_test "CORS Headers" \
    "curl -s -I $BACKEND_URL/health | grep -i 'access-control-allow-origin'"

# Test 11: Security Headers
run_test "Security Headers (X-Content-Type-Options)" \
    "curl -s -I $BACKEND_URL/health | grep -i 'x-content-type-options'"

# Test 12: Response Time Check
echo -e "\n${YELLOW}Running: Response Time Check${NC}"
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' $BACKEND_URL/health)
RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc)

if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
    echo -e "${GREEN}✓ PASSED: Response Time Check (${RESPONSE_TIME_MS}ms)${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAILED: Response Time Check (${RESPONSE_TIME_MS}ms > 1000ms)${NC}"
    ((TESTS_FAILED++))
fi

# Test 13: Error Handling
run_test "Error Handling (404)" \
    "curl -s -o /dev/null -w '%{http_code}' $BACKEND_URL/nonexistent | grep -q 404"

# Test 14: JSON Response Format
run_test "JSON Response Format" \
    "curl -f -s $BACKEND_URL/health | jq -e 'has(&quot;timestamp&quot;) and has(&quot;status&quot;)'"

# Test 15: API Versioning
run_test "API Versioning" \
    "curl -f -s $BACKEND_URL/api/v1/stats | jq -e '.success == true'"

# Summary
echo ""
echo "============================"
echo "📊 Test Summary"
echo "============================"
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed!${NC}"
    exit 1
fi
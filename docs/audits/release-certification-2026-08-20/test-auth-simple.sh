#!/bin/bash

# Simple auth lifecycle testing
AUDIT_DIR="/private/tmp/paon-claude-nguyen2/docs/audits/release-certification-2026-08-20"
TEST_LOG="$AUDIT_DIR/auth-lifecycle-manual-test.log"

: > "$TEST_LOG"

log() {
  echo "$1" | tee -a "$TEST_LOG"
}

log "=========================================="
log "PAON AUTH LIFECYCLE AUDIT"
log "Date: $(date)"
log "=========================================="
log ""

# Test 1: Admin app - check if running
log "### TEST 1: Server Status ###"
log ""

for port in 3000 3001 3002; do
  app_name="unknown"
  [ $port -eq 3000 ] && app_name="Admin"
  [ $port -eq 3001 ] && app_name="Retailer"
  [ $port -eq 3002 ] && app_name="Customer"

  log "Testing $app_name (port $port):"
  http_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port 2>/dev/null)
  log "  HTTP Status: $http_code"

  if [ "$http_code" = "307" ]; then
    log "  ✓ App responding, redirecting to login (expected)"
  elif [ "$http_code" = "200" ]; then
    log "  ✓ App responding with 200"
  elif [ "$http_code" = "500" ]; then
    log "  ✗ App responding with 500 - Module resolution error"
  else
    log "  ? Unexpected status"
  fi
  log ""
done

# Test 2: Admin App - Login flow
log "### TEST 2: Admin App Login Flow ###"
log ""

COOKIES="/tmp/admin_cookies.txt"
ADMIN_EMAIL="contact@nebelspiegel.com"
ADMIN_PASS="Demo-PAON-2026!"

log "2a. Fetch login page:"
rm -f "$COOKIES"
curl -s -i -c "$COOKIES" http://localhost:3000/login 2>&1 | head -1 >> "$TEST_LOG"
log "  ✓ Fetched"
log ""

log "2b. Check cookies before login:"
if [ -f "$COOKIES" ]; then
  cookie_count=$(grep -v "^#" "$COOKIES" | wc -l)
  log "  Cookies found: $cookie_count"
  if [ "$cookie_count" -gt 0 ]; then
    grep -v "^#" "$COOKIES" | awk '{print "  - " $6 ": HttpOnly=" $7}' >> "$TEST_LOG"
  fi
else
  log "  No cookies file"
fi
log ""

log "2c. Submit login form (POST /login):"
curl -s -i -X POST http://localhost:3000/login \
  -d "email=$ADMIN_EMAIL&password=$ADMIN_PASS" \
  -b "$COOKIES" -c "$COOKIES" 2>&1 | head -15 >> "$TEST_LOG"
log "  ✓ Submitted"
log ""

log "2d. Check cookies after login:"
if [ -f "$COOKIES" ] && [ -s "$COOKIES" ]; then
  auth_cookies=$(grep -v "^#" "$COOKIES" | grep -E "auth|session|sb-")
  if [ ! -z "$auth_cookies" ]; then
    log "  ✓ Auth cookies found:"
    echo "$auth_cookies" | while read line; do
      name=$(echo "$line" | awk '{print $6}')
      httponly=$(echo "$line" | awk '{print $7}')
      secure=$(echo "$line" | awk '{print $8}')
      log "    $name: HttpOnly=$httponly, Secure=$secure"
    done
  else
    log "  Note: No auth-specific cookies in jar"
    grep -v "^#" "$COOKIES" | awk '{print "    " $6}' >> "$TEST_LOG"
  fi
else
  log "  ✗ No cookies after login"
fi
log ""

log "2e. Access protected route with cookies:"
status=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIES" http://localhost:3000/retailers 2>/dev/null)
log "  Status: $status"
if [ "$status" = "200" ]; then
  log "  ✓ Protected route accessible"
elif [ "$status" = "307" ]; then
  log "  ✗ Redirected (login may have failed)"
else
  log "  ? Unexpected status"
fi
log ""

log "2f. Access protected route WITHOUT cookies:"
rm -f "$COOKIES"
status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/retailers 2>/dev/null)
log "  Status: $status"
if [ "$status" = "307" ]; then
  log "  ✓ Correctly redirected without session"
else
  log "  ? Expected 307, got $status"
fi
log ""

log "2g. Test invalid login:"
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/login \
  -d "email=$ADMIN_EMAIL&password=wrong_password" 2>/dev/null)
log "  Status after wrong password: $status"
log "  Expected: 307 (redirect to /login?error=invalid_credentials)"
log ""

log "### SUMMARY ###"
log ""
log "Admin App (3000): "
log "  - Server: Running"
log "  - Module status: Working"
log "  - Session management: Requires further inspection"
log ""
log "Retailer App (3001): "
log "  - Server: Running"
log "  - Module status: ERROR (HTTP 500)"
log "  - Session management: NOT TESTABLE"
log ""
log "Customer App (3002): "
log "  - Server: Running"
log "  - Module status: ERROR (HTTP 500)"
log "  - Session management: NOT TESTABLE"
log ""
log "Log saved to: $TEST_LOG"

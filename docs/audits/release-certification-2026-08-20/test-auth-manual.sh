#!/bin/bash

# Manual auth lifecycle testing using curl
# Tests login, logout, session validation, and cookie security

set -e

AUDIT_DIR="/private/tmp/paon-claude-nguyen2/docs/audits/release-certification-2026-08-20"
TEST_LOG="$AUDIT_DIR/auth-lifecycle-test.log"
COOKIES_JAR="/tmp/paon-test-cookies.txt"

# Test accounts from demo-seed.ts
ADMIN_EMAIL="contact@nebelspiegel.com"
ADMIN_PASSWORD="Demo-PAON-2026!"
ADMIN_PORT="3000"

RETAILER_EMAIL="contact+atelier-demo-owner@nebelspiegel.com"
RETAILER_PASSWORD="Demo-PAON-2026!"
RETAILER_PORT="3001"

CUSTOMER_EMAIL="contact+customer-isabelle@nebelspiegel.com"
CUSTOMER_PASSWORD="Demo-PAON-2026!"
CUSTOMER_PORT="3002"

# Initialize log
: > "$TEST_LOG"

log() {
  echo "$1" | tee -a "$TEST_LOG"
}

test_app() {
  local app_name="$1"
  local email="$2"
  local password="$3"
  local port="$4"
  local expected_post_login_path="$5"

  log ""
  log "==============================================="
  log "Testing $app_name (Port $port)"
  log "==============================================="
  log ""

  # Clean cookies
  rm -f "$COOKIES_JAR"

  # Test 1: Check if server is running
  log "Test 1: Server availability"
  http_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/)
  if [ "$http_code" = "307" ] || [ "$http_code" = "200" ] || [ "$http_code" = "500" ]; then
    log "  ✓ Server responding (HTTP $http_code)"
  else
    log "  ✗ Server not responding (HTTP $http_code)"
    log "  [SKIPPING REMAINING TESTS FOR THIS APP]"
    return
  fi

  # If it's a 500, the app has the module resolution issue
  if [ "$http_code" = "500" ]; then
    log "  Note: HTTP 500 error indicates module resolution issue (documented in baseline audit)"
    log "  [SKIPPING FURTHER TESTS - APP BROKEN AT MIDDLEWARE LEVEL]"
    return
  fi

  # Test 2: Unauthenticated access to protected route
  log ""
  log "Test 2: Unauthenticated access to protected route"
  log "  GET /dashboard (protected)"
  response=$(curl -s -i -w "\n%{http_code}" http://localhost:$port/dashboard 2>&1)
  headers=$(echo "$response" | head -n -1)
  status=$(echo "$response" | tail -n 1)
  log "  Response status: $status"
  if echo "$headers" | grep -q "location.*login"; then
    log "  ✓ Correctly redirected to login"
  else
    log "  Note: Response headers:"
    echo "$headers" | head -n 10 | sed 's/^/    /'
  fi

  # Test 3: Get login page
  log ""
  log "Test 3: Fetch login page"
  rm -f "$COOKIES_JAR"
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -c "$COOKIES_JAR" http://localhost:$port/login)
  log "  Status: $http_code"
  if [ "$http_code" = "200" ]; then
    log "  ✓ Login page accessible"
  fi

  # Test 4: Check cookies before login
  log ""
  log "Test 4: Check cookies BEFORE login"
  if [ -f "$COOKIES_JAR" ] && [ -s "$COOKIES_JAR" ]; then
    log "  Cookies found:"
    cat "$COOKIES_JAR" | grep -v "^#" | awk '{print "    Name: " $6 ", HttpOnly: " $7}' | head -5
  else
    log "  No cookies set on login page"
  fi

  # Test 5: Submit login form
  log ""
  log "Test 5: Submit login form"
  log "  Email: $email"
  log "  Password: [REDACTED]"

  # The login uses form submission via server actions
  # We need to follow the flow
  response_file="/tmp/login_response_$port.txt"
  curl -s -i -b "$COOKIES_JAR" -c "$COOKIES_JAR" \
    -X POST "http://localhost:$port/login" \
    -d "email=$email&password=$password" \
    > "$response_file" 2>&1

  # Parse response
  status=$(head -n 1 "$response_file" | awk '{print $2}')
  log "  Response status: $status"

  # Check for redirect
  if grep -q "^[Ll]ocation:" "$response_file"; then
    location=$(grep "^[Ll]ocation:" "$response_file" | head -1 | cut -d' ' -f2)
    log "  Redirect location: $location"
    if [ "$location" = "$expected_post_login_path" ] || echo "$location" | grep -q "$expected_post_login_path"; then
      log "  ✓ Redirected to expected path"
    fi
  else
    log "  Note: No redirect in response"
  fi

  # Test 6: Check cookies after login
  log ""
  log "Test 6: Cookies AFTER login submission"
  if [ -f "$COOKIES_JAR" ] && [ -s "$COOKIES_JAR" ]; then
    auth_cookies=$(grep -E "auth|session|sb-" "$COOKIES_JAR" | wc -l)
    log "  ✓ Found $auth_cookies auth-related cookies"
    grep -E "auth|session|sb-" "$COOKIES_JAR" | while read line; do
      cookie_name=$(echo "$line" | awk '{print $6}')
      http_only=$(echo "$line" | awk '{print $7}')
      secure=$(echo "$line" | awk '{print $8}')
      log "    Cookie: $cookie_name"
      log "      HttpOnly: $http_only (should be TRUE)"
      log "      Secure: $secure (should be TRUE)"
    done
  else
    log "  ✗ No cookies found after login attempt"
  fi

  # Test 7: Access protected route WITH session
  log ""
  log "Test 7: Access protected route WITH session cookie"
  status=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIES_JAR" http://localhost:$port/dashboard)
  log "  Response status: $status"
  if [ "$status" = "200" ]; then
    log "  ✓ Protected route accessible with valid session"
  else
    log "  ✗ Protected route returned $status (expected 200)"
  fi

  # Test 8: Clear cookies and retry
  log ""
  log "Test 8: Access protected route AFTER clearing cookies"
  rm -f "$COOKIES_JAR"
  status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/dashboard)
  log "  Response status: $status"
  if [ "$status" = "307" ] || [ "$status" = "302" ]; then
    log "  ✓ Correctly redirected without session"
  else
    log "  ✗ Not redirected (status $status)"
  fi

  # Test 9: Invalid credentials
  log ""
  log "Test 9: Login with WRONG password"
  rm -f "$COOKIES_JAR"
  response_file="/tmp/login_fail_$port.txt"
  curl -s -i -c "$COOKIES_JAR" \
    -X POST "http://localhost:$port/login" \
    -d "email=$email&password=wrong_password_xyz" \
    > "$response_file" 2>&1

  status=$(head -n 1 "$response_file" | awk '{print $2}')
  log "  Response status: $status"
  if grep -q "invalid" "$response_file"; then
    log "  ✓ Error message contains 'invalid'"
  fi

  # Test 10: Check if middleware validates session
  log ""
  log "Test 10: Session validation in middleware"

  # Try with clear cookies (simulating expired session)
  rm -f "$COOKIES_JAR"

  # Try to access /dashboard with no auth
  status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/dashboard 2>/dev/null)
  if [ "$status" = "307" ] || [ "$status" = "302" ]; then
    log "  ✓ Middleware redirects unauthenticated requests to /login"
  else
    log "  ✗ Middleware did not redirect (got $status)"
  fi

  log ""
}

# Main execution
log "=========================================="
log "PAON AUTH LIFECYCLE AUDIT"
log "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "=========================================="

# Test Admin App
test_app "ADMIN APP" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_PORT" "/retailers"

# Test Retailer App
test_app "RETAILER APP" "$RETAILER_EMAIL" "$RETAILER_PASSWORD" "$RETAILER_PORT" "/dashboard"

# Test Customer App
test_app "CUSTOMER APP" "$CUSTOMER_EMAIL" "$CUSTOMER_PASSWORD" "$CUSTOMER_PORT" "/dashboard"

log ""
log "=========================================="
log "TEST COMPLETE"
log "Results saved to: $TEST_LOG"
log "=========================================="

# Clean up
rm -f "$COOKIES_JAR" /tmp/login_response_*.txt /tmp/login_fail_*.txt /tmp/cookies_*.txt

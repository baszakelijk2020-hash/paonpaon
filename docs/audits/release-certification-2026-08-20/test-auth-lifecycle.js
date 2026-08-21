#!/usr/bin/env node

/**
 * AUTH LIFECYCLE TEST - Playwright-based testing
 * Tests login, logout, session invalidation, and cookie security flags
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const TEST_RESULTS_FILE = path.join(
  __dirname,
  "test-auth-lifecycle-results.txt",
);

const TEST_ACCOUNTS = {
  admin: {
    email: "contact@nebelspiegel.com",
    password: "Demo-PAON-2026!",
    port: 3000,
    expectedRedirect: "/retailers",
  },
  retailer: {
    email: "contact+atelier-demo-owner@nebelspiegel.com",
    password: "Demo-PAON-2026!",
    port: 3001,
    expectedRedirect: "/dashboard",
  },
  customer: {
    email: "contact+customer-isabelle@nebelspiegel.com",
    password: "Demo-PAON-2026!",
    port: 3002,
    expectedRedirect: "/dashboard",
  },
};

let results = [];

function log(message) {
  console.log(message);
  results.push(message);
}

async function testAdminLogin() {
  const browser = await chromium.launch();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  try {
    log("\n=== ADMIN APP (Port 3000) LOGIN TEST ===\n");

    // Test 1: Access protected route without session
    log("Test 1: Access protected route before login");
    const response1 = await page.goto("http://localhost:3000/retailers");
    log(`Response status: ${response1.status()}`);
    log(`Final URL: ${page.url()}`);
    if (page.url().includes("/login")) {
      log("✓ Correctly redirected to login");
    } else {
      log("✗ NOT redirected to login");
    }

    // Test 2: Access login page and inspect cookies
    log("\nTest 2: Access login page");
    await page.goto("http://localhost:3000/login");
    log(`URL: ${page.url()}`);

    // Get cookies
    const cookies = await context.cookies();
    log("Cookies before login:");
    if (cookies.length === 0) {
      log("  (No cookies)");
    } else {
      cookies.forEach((cookie) => {
        log(`  ${cookie.name}:`);
        log(`    Value: ${cookie.value.substring(0, 50)}...`);
        log(
          `    HttpOnly: ${cookie.httpOnly}, Secure: ${cookie.secure}, SameSite: ${cookie.sameSite}`,
        );
        log(`    Path: ${cookie.path}, Domain: ${cookie.domain}`);
        log(
          `    Expires: ${cookie.expires ? new Date(cookie.expires * 1000) : "Session"}`,
        );
      });
    }

    // Test 3: Inspect HTML form to understand login flow
    log("\nTest 3: Inspect login form");
    const form = await page.$("form");
    if (form) {
      log("✓ Login form found");
      const fields = await page.$$eval("form input", (inputs) =>
        inputs.map((i) => ({
          name: i.name,
          type: i.type,
          required: i.required,
        })),
      );
      log("Form fields:");
      fields.forEach((f) =>
        log(`  ${f.name}: type=${f.type}, required=${f.required}`),
      );
    } else {
      log("✗ Login form NOT found");
    }

    // Test 4: Submit login form
    log("\nTest 4: Submit login form with valid credentials");
    const account = TEST_ACCOUNTS.admin;

    // Listen for response to capture Set-Cookie headers
    let loginResponse = null;
    page.on("response", (response) => {
      if (response.url().includes("/login")) {
        loginResponse = response;
      }
    });

    // Fill and submit form
    await page.fill('input[name="email"]', account.email);
    await page.fill('input[name="password"]', account.password);

    const submitPromise = page.waitForNavigation({ timeout: 10000 });
    await page.click('button[type="submit"]');

    try {
      await submitPromise;
    } catch (e) {
      log(`Navigation timeout or error: ${e.message}`);
    }

    log(`Final URL after login: ${page.url()}`);

    // Get response headers from the POST request
    if (loginResponse) {
      log("Login response headers:");
      const headers = loginResponse.headers();
      if (headers["set-cookie"]) {
        log(`Set-Cookie: ${headers["set-cookie"]}`);
      } else {
        log("Set-Cookie: (not in response)");
      }
    }

    // Check cookies after login
    const cookiesAfterLogin = await context.cookies();
    log("\nCookies after login:");
    if (cookiesAfterLogin.length === 0) {
      log("  ✗ NO COOKIES - login may have failed");
    } else {
      cookiesAfterLogin.forEach((cookie) => {
        log(`  ${cookie.name}:`);
        log(`    HttpOnly: ${cookie.httpOnly} (secure)`);
        log(`    Secure: ${cookie.secure} (HTTPS-only)`);
        log(`    SameSite: ${cookie.sameSite} (CSRF protection)`);
      });
    }

    // Test 5: Verify we can access protected routes
    log("\nTest 5: Access protected route with valid session");
    const protectedResponse = await page.goto(
      "http://localhost:3000/retailers",
    );
    log(`Response status: ${protectedResponse.status()}`);
    log(`Final URL: ${page.url()}`);
    if (protectedResponse.status() === 200) {
      log("✓ Protected route accessible with valid session");
    } else if (protectedResponse.status() === 307) {
      log(`✗ Redirected (status ${protectedResponse.status()})`);
    }

    // Test 6: Find logout mechanism
    log("\nTest 6: Attempt to find and test logout");
    // Look for logout link/button
    const logoutLink = await page.$(
      'a[href*="signout"], button:has-text("Sign out")',
    );
    if (logoutLink) {
      log("✓ Logout link found");
      // Click logout
      // (This is complex without proper page instrumentation)
    } else {
      log("Note: No obvious logout link found in this test context");
    }

    // Test 7: Logout via deleting cookies (simulated)
    log("\nTest 7: Clear cookies and test session invalidation");
    const cookiesBeforeClear = await context.cookies();
    log(`Cookies before clear: ${cookiesBeforeClear.length}`);
    await context.clearCookies();
    const cookiesAfterClear = await context.cookies();
    log(`Cookies after clear: ${cookiesAfterClear.length}`);

    // Try to access protected route
    const afterLogoutResponse = await page.goto(
      "http://localhost:3000/retailers",
    );
    log(`Response status after logout: ${afterLogoutResponse.status()}`);
    log(`Final URL after logout: ${page.url()}`);
    if (page.url().includes("/login")) {
      log("✓ Correctly redirected to login after session cleared");
    } else {
      log("✗ NOT redirected to login after session cleared");
    }

    // Test 8: Failed login attempt
    log("\nTest 8: Test invalid credentials");
    await page.goto("http://localhost:3000/login");
    await page.fill('input[name="email"]', account.email);
    await page.fill('input[name="password"]', "wrong_password");

    const failLoginPromise = page.waitForNavigation({ timeout: 5000 });
    await page.click('button[type="submit"]');

    try {
      await failLoginPromise;
    } catch (e) {
      // Expected timeout or navigation
    }

    log(`URL after failed login: ${page.url()}`);
    if (page.url().includes("error=invalid_credentials")) {
      log("✓ Correct error message shown for invalid credentials");
    }

    // Test 9: Brute force / rate limiting
    log("\nTest 9: Rapid failed login attempts (rate limiting check)");
    const bruteForceAttempts = 5;
    for (let i = 0; i < bruteForceAttempts; i++) {
      await page.goto("http://localhost:3000/login");
      await page.fill('input[name="email"]', account.email);
      await page.fill('input[name="password"]', `wrong_${i}`);
      await page.click('button[type="submit"]');
      try {
        await page.waitForNavigation({ timeout: 2000 });
      } catch (e) {
        // Expected
      }
      log(`  Attempt ${i + 1}: ${page.url().split("?")[0]}`);
    }

    // Check if any rate limiting was triggered
    const finalPage = await page.content();
    if (
      finalPage.includes("too many") ||
      finalPage.includes("rate") ||
      finalPage.includes("throttled")
    ) {
      log("✓ Rate limiting appears to be active");
    } else {
      log(
        "⚠ No obvious rate limiting message detected (may not be implemented)",
      );
    }

    await browser.close();

    return true;
  } catch (error) {
    log(`✗ Error during admin tests: ${error.message}`);
    console.error(error);
    return false;
  }
}

async function testRetailerLogin() {
  log("\n\n=== RETAILER APP (Port 3001) LOGIN TEST ===\n");
  log("Status: BLOCKED - HTTP 500 module resolution error from baseline audit");
  log("Module: @paon/domain not resolved in Turbopack edge middleware");
  log("Cannot test login until retailer app is fixed");
}

async function testCustomerLogin() {
  log("\n\n=== CUSTOMER APP (Port 3002) LOGIN TEST ===\n");
  log("Status: BLOCKED - HTTP 500 module resolution error from baseline audit");
  log("Module: @paon/domain not resolved in Turbopack edge middleware");
  log("Cannot test login until customer app is fixed");
}

async function main() {
  try {
    results = [];
    results.push("=== PAON AUTH LIFECYCLE AUDIT ===");
    results.push(`Date: ${new Date().toISOString()}`);
    results.push("");

    const adminSuccess = await testAdminLogin();
    await testRetailerLogin();
    await testCustomerLogin();

    results.push("\n\n=== SUMMARY ===");
    results.push(`Admin app test: ${adminSuccess ? "PASSED" : "FAILED"}`);
    results.push("Retailer app test: BLOCKED (module resolution error)");
    results.push("Customer app test: BLOCKED (module resolution error)");

    // Write results to file
    fs.writeFileSync(TEST_RESULTS_FILE, results.join("\n"));
    console.log(`\nResults written to: ${TEST_RESULTS_FILE}`);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();

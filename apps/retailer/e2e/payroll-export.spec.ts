import {
  createSupabaseAdminClient,
  createSupabaseDirectClient,
  RetailerBranchRepository,
  RetailerRepository,
} from "@paon/database";
import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";

async function signIn(page: Page, email = TEST_OWNER_EMAIL): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** PHASE 11.1: an approved, immutable accountant handoff is downloadable only
 * by a manager in its own tenant.  Setup uses service role solely to make the
 * prerequisite approved records deterministic; every accepted read is through
 * the authenticated browser route. */
test("manager downloads the persisted payroll handoff while advisor and foreign export access are denied", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);
  const marker = `payroll-export-${Date.now()}`;
  const advisorEmail = `${marker}@paon.test`;
  const salesAssociateEmail = `${marker}-sales@paon.test`;
  const foreignSlug = `${marker}-foreign`;

  const { data: retailer, error: retailerError } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (retailerError) throw retailerError;
  const { data: owner, error: ownerError } = await admin
    .from("retailer_staff_members")
    .select("id")
    .eq("retailer_id", retailer.id)
    .eq("email", TEST_OWNER_EMAIL)
    .is("deleted_at", null)
    .single();
  if (ownerError) throw ownerError;
  const { data: advisorAuth, error: advisorAuthError } =
    await admin.auth.admin.createUser({
      email: advisorEmail,
      password: TEST_OWNER_PASSWORD,
      email_confirm: true,
    });
  if (advisorAuthError || !advisorAuth.user) throw advisorAuthError;
  const { data: advisor, error: advisorError } = await admin
    .from("retailer_staff_members")
    .insert({
      retailer_id: retailer.id,
      user_id: advisorAuth.user.id,
      full_name: "Payroll export advisor",
      email: advisorEmail,
      role: "manager",
      accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (advisorError) throw advisorError;
  const { data: salesAssociateAuth, error: salesAssociateAuthError } =
    await admin.auth.admin.createUser({
      email: salesAssociateEmail,
      password: TEST_OWNER_PASSWORD,
      email_confirm: true,
    });
  if (salesAssociateAuthError || !salesAssociateAuth.user)
    throw salesAssociateAuthError;
  const { error: salesAssociateError } = await admin
    .from("retailer_staff_members")
    .insert({
      retailer_id: retailer.id,
      user_id: salesAssociateAuth.user.id,
      full_name: "Payroll export sales associate",
      email: salesAssociateEmail,
      role: "sales_associate",
      accepted_at: new Date().toISOString(),
    })
    .select("id");
  if (salesAssociateError) throw salesAssociateError;

  // An isolated historical date makes repeated/parallel local runs avoid the
  // period's tenant/date uniqueness constraint and ordinary fixture activity.
  const periodDay = new Date(
    Date.now() - (400 + Math.floor(Math.random() * 8_000)) * 86_400_000,
  );
  periodDay.setUTCHours(12, 0, 0, 0);
  const periodDate = periodDay.toISOString().slice(0, 10);
  const entryDate = periodDay.toISOString();
  const ownerClockOut = new Date(
    periodDay.valueOf() + 8 * 3_600_000,
  ).toISOString();
  const advisorClockOut = new Date(
    periodDay.valueOf() + 9.5 * 3_600_000,
  ).toISOString();
  const { error: homeEntriesError } = await admin
    .from("staff_time_entries")
    .insert([
      {
        retailer_id: retailer.id,
        staff_id: owner.id,
        clock_in_at: entryDate,
        clock_out_at: ownerClockOut,
      },
      {
        retailer_id: retailer.id,
        staff_id: advisor.id,
        clock_in_at: entryDate,
        clock_out_at: advisorClockOut,
      },
    ])
    .select("id");
  if (homeEntriesError) throw homeEntriesError;
  const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;
  const preparerClient = createSupabaseDirectClient(supabaseUrl, anonKey);
  const ownerClient = createSupabaseDirectClient(supabaseUrl, anonKey);
  const { error: preparerLoginError } =
    await preparerClient.auth.signInWithPassword({
      email: advisorEmail,
      password: TEST_OWNER_PASSWORD,
    });
  if (preparerLoginError) throw preparerLoginError;
  const { data: period, error: periodError } = await preparerClient.rpc(
    "open_payroll_period",
    {
      p_retailer_id: retailer.id,
      p_period_start: periodDate,
      p_period_end: periodDate,
    },
  );
  if (periodError || !period) throw periodError;
  const { data: draftVersion, error: draftVersionError } = await preparerClient
    .from("payroll_period_versions")
    .select("id")
    .eq("period_id", period)
    .single();
  if (draftVersionError) throw draftVersionError;
  const { data: homeExceptions, error: homeExceptionsError } =
    await preparerClient
      .from("payroll_period_exceptions")
      .select("id")
      .eq("version_id", draftVersion.id)
      .is("resolved_at", null);
  if (homeExceptionsError) throw homeExceptionsError;
  for (const exception of homeExceptions) {
    const { error: resolveError } = await preparerClient.rpc(
      "resolve_payroll_exception",
      { p_exception_id: exception.id },
    );
    if (resolveError) throw resolveError;
  }
  const { error: ownerLoginError } = await ownerClient.auth.signInWithPassword({
    email: TEST_OWNER_EMAIL,
    password: TEST_OWNER_PASSWORD,
  });
  if (ownerLoginError) throw ownerLoginError;
  const { data: version, error: versionError } = await ownerClient.rpc(
    "approve_payroll_period",
    { p_period_id: period },
  );
  if (versionError || !version) throw versionError;
  const { data: payrollExportId, error: exportError } = await ownerClient.rpc(
    "record_payroll_export",
    { p_version_id: version },
  );
  if (exportError || !payrollExportId) throw exportError;
  const { data: payrollExport, error: payrollExportError } = await admin
    .from("payroll_period_exports")
    .select("id, rows, row_count, checksum, created_at")
    .eq("id", payrollExportId)
    .single();
  if (payrollExportError) throw payrollExportError;
  const rows = payrollExport.rows as {
    staffId: string;
    earningCode: string;
    hours: number;
  }[];

  const foreignRetailer = await new RetailerRepository(admin).create({
    legalName: `${marker} Foreign, Inc.`,
    displayName: `${marker} Foreign`,
    slug: foreignSlug,
    tier: "house",
    defaultCurrency: "USD",
    defaultLocale: "en-US",
    billingAddress: {
      line1: "1 Export Street",
      city: "Testville",
      postalCode: "00000",
      countryCode: "US",
    },
  });
  await new RetailerBranchRepository(admin).ensureDefaultBranch({
    retailerId: foreignRetailer.id,
  });
  const { data: foreignPreparedAuth, error: foreignPreparedAuthError } =
    await admin.auth.admin.createUser({
      email: `${marker}-prepared@paon.test`,
      password: TEST_OWNER_PASSWORD,
      email_confirm: true,
    });
  if (foreignPreparedAuthError || !foreignPreparedAuth.user)
    throw foreignPreparedAuthError;
  const { data: foreignApproverAuth, error: foreignApproverAuthError } =
    await admin.auth.admin.createUser({
      email: `${marker}-approver@paon.test`,
      password: TEST_OWNER_PASSWORD,
      email_confirm: true,
    });
  if (foreignApproverAuthError || !foreignApproverAuth.user)
    throw foreignApproverAuthError;
  const { data: foreignPrepared, error: foreignPreparedError } = await admin
    .from("retailer_staff_members")
    .insert({
      retailer_id: foreignRetailer.id,
      user_id: foreignPreparedAuth.user.id,
      full_name: "Foreign payroll preparer",
      email: `${marker}-prepared@paon.test`,
      role: "manager",
      accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (foreignPreparedError) throw foreignPreparedError;
  const { error: foreignApproverError } = await admin
    .from("retailer_staff_members")
    .insert({
      retailer_id: foreignRetailer.id,
      user_id: foreignApproverAuth.user.id,
      full_name: "Foreign payroll approver",
      email: `${marker}-approver@paon.test`,
      role: "manager",
      accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (foreignApproverError) throw foreignApproverError;
  const { error: foreignEntryError } = await admin
    .from("staff_time_entries")
    .insert({
      retailer_id: foreignRetailer.id,
      staff_id: foreignPrepared.id,
      clock_in_at: entryDate,
      clock_out_at: ownerClockOut,
    });
  if (foreignEntryError) throw foreignEntryError;
  const foreignPreparerClient = createSupabaseDirectClient(
    supabaseUrl,
    anonKey,
  );
  const foreignApproverClient = createSupabaseDirectClient(
    supabaseUrl,
    anonKey,
  );
  const { error: foreignPreparerLoginError } =
    await foreignPreparerClient.auth.signInWithPassword({
      email: `${marker}-prepared@paon.test`,
      password: TEST_OWNER_PASSWORD,
    });
  if (foreignPreparerLoginError) throw foreignPreparerLoginError;
  const { data: foreignPeriod, error: foreignPeriodError } =
    await foreignPreparerClient.rpc("open_payroll_period", {
      p_retailer_id: foreignRetailer.id,
      p_period_start: periodDate,
      p_period_end: periodDate,
    });
  if (foreignPeriodError || !foreignPeriod) throw foreignPeriodError;
  const { data: foreignDraftVersion, error: foreignDraftVersionError } =
    await foreignPreparerClient
      .from("payroll_period_versions")
      .select("id")
      .eq("period_id", foreignPeriod)
      .single();
  if (foreignDraftVersionError) throw foreignDraftVersionError;
  const { data: foreignExceptions, error: foreignExceptionsError } =
    await foreignPreparerClient
      .from("payroll_period_exceptions")
      .select("id")
      .eq("version_id", foreignDraftVersion.id)
      .is("resolved_at", null);
  if (foreignExceptionsError) throw foreignExceptionsError;
  for (const exception of foreignExceptions) {
    const { error: resolveError } = await foreignPreparerClient.rpc(
      "resolve_payroll_exception",
      { p_exception_id: exception.id },
    );
    if (resolveError) throw resolveError;
  }
  const { error: foreignApproverLoginError } =
    await foreignApproverClient.auth.signInWithPassword({
      email: `${marker}-approver@paon.test`,
      password: TEST_OWNER_PASSWORD,
    });
  if (foreignApproverLoginError) throw foreignApproverLoginError;
  const { data: foreignVersion, error: foreignVersionError } =
    await foreignApproverClient.rpc("approve_payroll_period", {
      p_period_id: foreignPeriod,
    });
  if (foreignVersionError || !foreignVersion) throw foreignVersionError;
  const { data: foreignExport, error: foreignExportError } =
    await foreignApproverClient.rpc("record_payroll_export", {
      p_version_id: foreignVersion,
    });
  if (foreignExportError || !foreignExport) throw foreignExportError;

  let advisorContext: Awaited<ReturnType<Browser["newContext"]>> | undefined;
  try {
    await signIn(page);
    await page.goto("/staff/payroll");
    const csvPath = `/staff/payroll/exports/${payrollExport.id}/csv`;
    const jsonPath = `/staff/payroll/exports/${payrollExport.id}/json`;
    await expect(page.locator(`a[href="${csvPath}"]`)).toHaveText(
      "Download CSV",
    );
    await expect(page.locator(`a[href="${jsonPath}"]`)).toHaveText(
      "Download JSON",
    );

    const csv = await page.context().request.get(csvPath);
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-disposition"]).toBe(
      `attachment; filename="payroll-export-${payrollExport.id}.csv"`,
    );

    // Parse CSV and verify sorted order. Export sorts by staffId then earningCode,
    // which is non-deterministic when one staffId is randomly generated.
    const csvText = await csv.text();
    const csvLines = csvText.trim().split("\n");
    expect(csvLines[0]).toBe("staff_id,earning_code,hours"); // header

    const csvRows = csvLines.slice(1).map((line) => {
      const [staffId, earningCode, hours] = line.split(",") as [
        string,
        string,
        string,
      ];
      return {
        staffId,
        earningCode,
        hours: parseFloat(hours),
      };
    });

    // Create expected rows with actual IDs and sort them by staffId then earningCode
    // (matching the export's deterministic sort order)
    const expectedRows = [
      { staffId: owner.id, earningCode: "regular", hours: 8 },
      { staffId: advisor.id, earningCode: "overtime", hours: 1.5 },
      { staffId: advisor.id, earningCode: "regular", hours: 8 },
    ].sort((a, b) =>
      a.staffId === b.staffId
        ? a.earningCode.localeCompare(b.earningCode)
        : a.staffId.localeCompare(b.staffId),
    );

    // Verify actual rows are sorted (identical to export's sort contract)
    const sortedCsvRows = [...csvRows].sort((a, b) =>
      a.staffId === b.staffId
        ? a.earningCode.localeCompare(b.earningCode)
        : a.staffId.localeCompare(b.staffId),
    );
    expect(csvRows).toEqual(sortedCsvRows);

    // Verify all expected rows are present with correct values
    expect(csvRows).toEqual(expectedRows);

    const json = await page.context().request.get(jsonPath);
    expect(json.status()).toBe(200);
    expect(json.headers()["content-disposition"]).toBe(
      `attachment; filename="payroll-export-${payrollExport.id}.json"`,
    );
    await expect(json.json()).resolves.toEqual({
      metadata: {
        exportId: payrollExport.id,
        versionId: version,
        rowCount: payrollExport.row_count,
        checksum: payrollExport.checksum,
        createdAt: payrollExport.created_at,
      },
      rows,
    });

    const foreign = await page
      .context()
      .request.get(`/staff/payroll/exports/${foreignExport}/csv`);
    expect(foreign.status()).toBe(404);

    advisorContext = await browser.newContext({
      baseURL: "http://localhost:3001",
    });
    const advisorPage = await advisorContext.newPage();
    await signIn(advisorPage, salesAssociateEmail);
    const denied = await advisorContext.request.get(csvPath);
    expect(denied.status()).toBe(403);
  } finally {
    await advisorContext?.close();
  }
});

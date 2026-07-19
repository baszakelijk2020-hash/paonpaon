import {
  PlatformStaffRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import type { UserId } from "@paon/domain";

import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./fixtures";

/**
 * Provisions a confirmed platform_owner test account before the e2e
 * suite runs, against the local Supabase stack `supabase start` brings
 * up in CI (see .github/workflows/ci.yml). Idempotent so re-running
 * locally against the same stack doesn't fail on a duplicate user.
 */
async function globalSetup(): Promise<void> {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "e2e global setup requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — run `supabase start` and export its printed values first.",
    );
  }

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: existingUsers, error: listError } =
    await admin.auth.admin.listUsers();
  if (listError) {
    throw listError;
  }

  let userId = existingUsers.users.find(
    (user) => user.email === TEST_ADMIN_EMAIL,
  )?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(
        `Failed to create e2e admin user: ${error?.message ?? "unknown error"}`,
      );
    }
    userId = data.user.id;
  }

  const staffRepo = new PlatformStaffRepository(admin);
  const existingStaff = await staffRepo.findByUserId(userId as UserId);
  if (!existingStaff) {
    await staffRepo.create({
      userId: userId as UserId,
      fullName: "E2E Admin",
      role: "platform_owner",
    });
  }
}

export default globalSetup;

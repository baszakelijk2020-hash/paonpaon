import {
  KnowledgeRepository,
  MetadataRepository,
  ProductRepository,
  ProductVariantRepository,
  createSupabaseAdminClient,
} from "@paon/database";
import { asId } from "@paon/domain";
import { expect, test, type Page } from "@playwright/test";

import {
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  TEST_RETAILER_SLUG,
} from "./fixtures";
import { writeBrowserProofRun } from "./write-browser-proof-run";

const PHASE_ITEM_ID = "17.14";
const BROWSER_PROOF_SPEC = "apps/retailer/e2e/prospect-ai-conversation.spec.ts";
const CUSTOMER_APP_ORIGIN = "http://127.0.0.1:3002";
const RETAILER_APP_ORIGIN = "http://127.0.0.1:3001";

type BuyingIntentSignalRow = {
  readonly code: string;
  readonly label: string;
  readonly matchedText: string;
  readonly sourceMessageId?: string | null;
};

type LoadedInquiry = {
  readonly customerRow: {
    readonly id: string;
    readonly user_id: string | null;
  };
  readonly conversationRow: {
    readonly id: string;
    readonly status: string;
    readonly buying_intent_level: string | null;
    readonly buying_intent_signals: readonly BuyingIntentSignalRow[] | null;
    readonly claimed_by_staff_id: string | null;
    readonly claimed_at: string | null;
  };
};

let proofPassed = false;

function appUrl(origin: string, pathname: string): string {
  return new URL(pathname, origin).toString();
}

async function expectNoCleanupError<
  T extends { error: { message: string } | null },
>(
  cleanupErrors: string[],
  label: string,
  action: () => PromiseLike<T>,
): Promise<void> {
  try {
    const { error } = await action();
    if (error) {
      cleanupErrors.push(`${label}: ${error.message}`);
    }
  } catch (error) {
    cleanupErrors.push(
      `${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

test.afterAll(async () => {
  await writeBrowserProofRun({
    phaseItemId: PHASE_ITEM_ID,
    spec: BROWSER_PROOF_SPEC,
    status: proofPassed ? "passed" : "failed",
  });
});

async function signInOwner(page: Page): Promise<void> {
  await page.goto(appUrl(RETAILER_APP_ORIGIN, "/login"));
  await page.getByLabel("Email").fill(TEST_OWNER_EMAIL);
  await page.getByLabel("Password").fill(TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Enter the atelier" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signInCustomerByMagicLink(
  page: Page,
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties) {
    throw new Error(
      `Failed to generate magic link: ${error?.message ?? "unknown error"}`,
    );
  }

  await page.goto(
    appUrl(
      CUSTOMER_APP_ORIGIN,
      `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
    ),
  );
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function findAuthUserId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email === email)?.id ?? null;
}

async function seedGuidanceBasis(args: {
  readonly admin: ReturnType<typeof createSupabaseAdminClient>;
  readonly retailerId: string;
  readonly reviewerStaffId: string;
  readonly unique: number;
}): Promise<{
  readonly conceptId: string;
  readonly productId: string;
  readonly productVariantId: string;
  readonly knowledgeObjectId: string;
  readonly assignmentId: string;
}> {
  const retailerId = asId<"RetailerId">(args.retailerId);
  const productRepo = new ProductRepository(args.admin);
  const variantRepo = new ProductVariantRepository(args.admin);
  const metadataRepo = new MetadataRepository(args.admin);
  const knowledgeRepo = new KnowledgeRepository(args.admin);

  const product = await productRepo.create({
    retailerId,
    name: `E2E Prospect Wedding Suit ${args.unique}`,
    slug: `e2e-prospect-wedding-suit-${args.unique}`,
    description: "Seeded for the PHASE 17.14 browser proof.",
    status: "active",
    isMadeToOrder: false,
    isAlterable: false,
  });

  const variant = await variantRepo.create({
    productId: product.id,
    sku: `E2E-PROSPECT-WED-${args.unique}`,
    price: { amountMinorUnits: 125000, currency: "USD" },
    inventoryQuantity: 7,
  });

  const concept = await metadataRepo.createConcept({
    retailerId,
    kind: "occasion",
    slug: `e2e-prospect-wedding-${args.unique}`,
    canonicalName: `E2E Prospect Wedding ${args.unique}`,
    active: true,
  });

  const { data: assignment, error: assignmentError } = await args.admin
    .from("entity_metadata_assignments")
    .insert({
      retailer_id: args.retailerId,
      target_type: "product",
      target_id: product.id,
      concept_id: concept.id,
      source: "retailer",
      review_status: "accepted",
      reviewed_by_staff_id: args.reviewerStaffId,
      reviewed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (assignmentError || !assignment) {
    throw assignmentError ?? new Error("failed to seed accepted assignment");
  }

  const knowledgeObject = await knowledgeRepo.create({
    retailerId,
    topic: "occasion",
    title: `E2E Wedding Guidance ${args.unique}`,
    slug: `e2e-wedding-guidance-${args.unique}`,
    summary: "Approved guidance for wedding timing and appointment planning.",
    displayTypes: ["information_card"],
    commercialIntent: "appointment",
    active: true,
  });
  await knowledgeRepo.createConceptJoin({
    knowledgeObjectId: knowledgeObject.id,
    conceptId: concept.id,
    matchStrength: 1,
  });

  return {
    conceptId: concept.id,
    productId: product.id,
    productVariantId: variant.id,
    knowledgeObjectId: knowledgeObject.id,
    assignmentId: assignment.id,
  };
}

async function waitForLoadedInquiry(args: {
  readonly admin: ReturnType<typeof createSupabaseAdminClient>;
  readonly retailerId: string;
  readonly inquiryEmail: string;
}): Promise<LoadedInquiry> {
  const timeoutMs = 30_000;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const { data: customerRow } = await args.admin
      .from("customers")
      .select("id, user_id")
      .eq("retailer_id", args.retailerId)
      .eq("email", args.inquiryEmail)
      .maybeSingle();
    if (!customerRow) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      continue;
    }

    const { data: conversationRow } = await args.admin
      .from("conversations")
      .select(
        "id, status, buying_intent_level, buying_intent_signals, claimed_by_staff_id, claimed_at",
      )
      .eq("customer_id", customerRow.id)
      .maybeSingle();
    if (!conversationRow) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      continue;
    }

    return {
      customerRow: {
        id: customerRow.id,
        user_id: customerRow.user_id,
      },
      conversationRow: {
        id: conversationRow.id,
        status: conversationRow.status,
        buying_intent_level: conversationRow.buying_intent_level,
        buying_intent_signals: conversationRow.buying_intent_signals as
          readonly BuyingIntentSignalRow[] | null,
        claimed_by_staff_id: conversationRow.claimed_by_staff_id,
        claimed_at: conversationRow.claimed_at,
      },
    };
  }

  throw new Error("timed out waiting for seeded inquiry");
}

test("an anonymous high-intent TableService inquiry is triaged, drafted by the mock AI provider, edited, sent, and visible to the customer", async ({
  page,
}) => {
  test.setTimeout(300_000);

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey);

  const { data: retailer } = await admin
    .from("retailers")
    .select("id")
    .eq("slug", TEST_RETAILER_SLUG)
    .single();
  if (!retailer) throw new Error("fixture retailer missing");
  const retailerId = retailer.id;

  const { data: ownerStaff } = await admin
    .from("retailer_staff_members")
    .select("id, user_id")
    .eq("retailer_id", retailerId)
    .eq("email", TEST_OWNER_EMAIL)
    .single();
  if (!ownerStaff?.id || !ownerStaff.user_id) {
    throw new Error("fixture owner staff record missing");
  }
  const ownerStaffId = asId<"StaffId">(ownerStaff.id);
  const ownerUserId = ownerStaff.user_id;

  const unique = Date.now();
  const inquiryEmail = `e2e-prospect-${unique}@nebelspiegel.com`;
  const inquiryName = `E2E Prospect ${unique}`;
  const inquiryMessage =
    "I'm getting married in June and can I book an appointment by Friday?";
  const editedReply =
    "Thanks for sharing the occasion and timing. I can help you review the approved options and arrange the next step. Please bring any inspiration photos.";

  const seed = await seedGuidanceBasis({
    admin,
    retailerId,
    reviewerStaffId: ownerStaffId,
    unique,
  });

  let customerId: string | null = null;
  let conversationId: string | null = null;
  let customerAuthUserId: string | null = null;
  let mainProofCompleted = false;
  let cleanupError: Error | null = null;

  try {
    // Anonymous inquiry on the founder storefront.
    await page.goto(appUrl(CUSTOMER_APP_ORIGIN, `/r/${TEST_RETAILER_SLUG}`));
    const widget = page.locator("#gilda-chat-widget");
    await page.getByRole("button", { name: "Ask us anything" }).click();
    await expect(widget).toBeVisible();

    await widget.getByPlaceholder("Your name...").fill(inquiryName);
    await widget.getByRole("button", { name: "Send" }).click();
    await expect(widget.getByPlaceholder("Your email...")).toBeVisible();

    await widget.getByPlaceholder("Your email...").fill(inquiryEmail);
    await widget.getByRole("button", { name: "Send" }).click();
    await expect(widget.getByPlaceholder("Type a message...")).toBeVisible();

    await widget.getByPlaceholder("Type a message...").fill(inquiryMessage);
    await widget.getByRole("button", { name: "Send" }).click();
    await expect(widget.getByText(/we'll be in touch shortly/i)).toBeVisible();

    const loadedInquiry = await waitForLoadedInquiry({
      admin,
      retailerId,
      inquiryEmail,
    });

    customerId = loadedInquiry.customerRow.id;
    conversationId = loadedInquiry.conversationRow.id;
    const currentCustomerId = customerId;
    const currentConversationId = conversationId;
    if (!currentCustomerId || !currentConversationId) {
      throw new Error("seeded inquiry identifiers missing");
    }

    expect(loadedInquiry.conversationRow.status).toBe("needs_human");
    expect(loadedInquiry.conversationRow.buying_intent_level).toBe("very_high");
    expect(loadedInquiry.conversationRow.buying_intent_signals).toEqual([
      {
        code: "occasion_wedding",
        label: "Wedding",
        matchedText: "getting married",
      },
      {
        code: "deadline_mentioned",
        label: "Deadline",
        matchedText: "by Friday",
      },
      {
        code: "appointment_readiness",
        label: "Appointment readiness",
        matchedText: "book an appointment",
      },
    ]);

    const { data: inquiryMessageRow, error: inquiryMessageError } = await admin
      .from("messages")
      .select("id")
      .eq("conversation_id", currentConversationId)
      .eq("sender_type", "guest")
      .eq("body", inquiryMessage)
      .single();
    if (inquiryMessageError || !inquiryMessageRow) {
      throw inquiryMessageError ?? new Error("guest inquiry message missing");
    }

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("notifications")
            .select("title, body, category, action_href")
            .eq("recipient_user_id", ownerUserId)
            .eq("action_href", `/messages?c=${currentConversationId}`)
            .maybeSingle();
          return data ?? null;
        },
        { timeout: 30_000 },
      )
      .toMatchObject({
        category: "message",
        title: "High-intent enquiry: wedding",
        body: "A prospect message needs a human response.",
      });

    // Retailer triage: claim, generate a mock grounded draft, edit, send.
    await signInOwner(page);
    await page.goto(
      appUrl(RETAILER_APP_ORIGIN, `/messages?c=${currentConversationId}`),
    );

    const triage = page.locator('[aria-label="Conversation triage"]');
    await expect(
      triage.getByText("Needs human", { exact: true }),
    ).toBeVisible();
    await expect(triage.getByText("very high intent")).toBeVisible();
    await expect(
      triage.getByText("Wedding: “getting married”", { exact: true }),
    ).toBeVisible();
    await expect(
      triage.getByText("Deadline: “by Friday”", { exact: true }),
    ).toBeVisible();
    await expect(
      triage.getByText('Appointment readiness: “book an appointment"', {
        exact: false,
      }),
    ).toBeVisible();

    await triage.getByRole("button", { name: "Claim conversation" }).click();
    await expect(triage.getByText("Claimed", { exact: true })).toBeVisible();
    await expect(
      triage.getByText("Assigned to E2E Owner", { exact: false }),
    ).toBeVisible();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("conversations")
            .select("status, claimed_by_staff_id")
            .eq("id", currentConversationId)
            .single();
          return data ?? null;
        },
        { timeout: 30_000 },
      )
      .toMatchObject({
        status: "claimed",
        claimed_by_staff_id: ownerStaff.id,
      });

    await triage
      .getByRole("button", { name: "Generate grounded draft" })
      .click();

    const draftTextarea = triage.getByLabel("AI draft reply");
    await expect(draftTextarea).toHaveValue(
      "Thank you for sharing the occasion and timing. I can help you review the approved options and arrange the next step.",
    );

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("ai_generations")
            .select("kind, provider, model, status, input_summary, output")
            .eq("retailer_id", retailerId)
            .eq("kind", "communication_draft")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return data ?? null;
        },
        { timeout: 30_000 },
      )
      .toMatchObject({
        kind: "communication_draft",
        provider: "mock",
        model: "mock-communication-draft",
        status: "succeeded",
        input_summary: expect.stringContaining(
          `conversation=${currentConversationId}`,
        ),
      });

    await draftTextarea.fill(editedReply);
    await triage.getByRole("button", { name: "Review/edit then send" }).click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("conversations")
            .select("status, claimed_by_staff_id")
            .eq("id", currentConversationId)
            .single();
          return data ?? null;
        },
        { timeout: 30_000 },
      )
      .toMatchObject({
        status: "waiting_for_customer",
        claimed_by_staff_id: ownerStaff.id,
      });

    await page.reload();
    await expect(
      triage.getByText("Waiting for customer", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(editedReply, { exact: true })).toBeVisible();

    const { data: draftRow, error: draftError } = await admin
      .from("message_ai_drafts")
      .select(
        "status, based_on_message_id, resolved_by_staff_id, sent_message_id, draft_text, knowledge_object_ids, product_ids",
      )
      .eq("conversation_id", currentConversationId)
      .maybeSingle();
    if (draftError || !draftRow) {
      throw draftError ?? new Error("AI draft row missing");
    }
    expect(draftRow.status).toBe("edited_and_sent");
    expect(draftRow.based_on_message_id).toBe(inquiryMessageRow.id);
    expect(draftRow.resolved_by_staff_id).toBe(ownerStaff.id);
    expect(draftRow.knowledge_object_ids).toEqual([seed.knowledgeObjectId]);
    expect(draftRow.product_ids).toEqual([seed.productId]);
    expect(draftRow.draft_text).toBe(
      "Thank you for sharing the occasion and timing. I can help you review the approved options and arrange the next step.",
    );
    if (!draftRow.sent_message_id) {
      throw new Error("sent message id missing from AI draft");
    }

    const { data: sentMessage, error: sentMessageError } = await admin
      .from("messages")
      .select("id, body, sender_type, sender_staff_id")
      .eq("id", draftRow.sent_message_id)
      .single();
    if (sentMessageError || !sentMessage) {
      throw sentMessageError ?? new Error("sent advisor message missing");
    }
    expect(sentMessage.body).toBe(editedReply);
    expect(sentMessage.sender_type).toBe("staff");
    expect(sentMessage.sender_staff_id).toBe(ownerStaff.id);

    // Customer-visible proof: link the prospect account, then open the thread.
    await page.context().clearCookies();
    await signInCustomerByMagicLink(page, admin, inquiryEmail);
    customerAuthUserId = await findAuthUserId(admin, inquiryEmail);
    expect(customerAuthUserId).toBeTruthy();

    await expect
      .poll(async () => {
        const { data } = await admin
          .from("customers")
          .select("user_id")
          .eq("id", currentCustomerId)
          .maybeSingle();
        return data?.user_id ?? null;
      })
      .toBeTruthy();

    await page.goto(
      appUrl(CUSTOMER_APP_ORIGIN, `/messages/${currentConversationId}`),
    );
    await expect(page.getByText(editedReply, { exact: true })).toBeVisible();
    await expect(page.getByText(inquiryMessage, { exact: true })).toBeVisible();

    mainProofCompleted = true;
  } finally {
    const cleanupErrors: string[] = [];

    const customerIdToDelete = customerId;
    if (customerIdToDelete) {
      await expectNoCleanupError(cleanupErrors, "customers.delete", () =>
        admin.from("customers").delete().eq("id", customerIdToDelete),
      );
    }

    let authUserIdToDelete = customerAuthUserId;
    if (!authUserIdToDelete) {
      try {
        authUserIdToDelete = await findAuthUserId(admin, inquiryEmail);
      } catch (error) {
        cleanupErrors.push(
          `auth.listUsers: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (authUserIdToDelete) {
      await expectNoCleanupError(cleanupErrors, "auth.deleteUser", () =>
        admin.auth.admin.deleteUser(authUserIdToDelete),
      );
    }

    await expectNoCleanupError(
      cleanupErrors,
      "knowledge_object_concepts.delete",
      () =>
        admin
          .from("knowledge_object_concepts")
          .delete()
          .eq("knowledge_object_id", seed.knowledgeObjectId),
    );
    await expectNoCleanupError(cleanupErrors, "knowledge_objects.delete", () =>
      admin.from("knowledge_objects").delete().eq("id", seed.knowledgeObjectId),
    );
    await expectNoCleanupError(
      cleanupErrors,
      "entity_metadata_assignments.delete",
      () =>
        admin
          .from("entity_metadata_assignments")
          .delete()
          .eq("id", seed.assignmentId),
    );
    await expectNoCleanupError(cleanupErrors, "product_variants.delete", () =>
      admin.from("product_variants").delete().eq("id", seed.productVariantId),
    );
    await expectNoCleanupError(cleanupErrors, "products.delete", () =>
      admin.from("products").delete().eq("id", seed.productId),
    );
    await expectNoCleanupError(cleanupErrors, "metadata_concepts.delete", () =>
      admin.from("metadata_concepts").delete().eq("id", seed.conceptId),
    );

    proofPassed = mainProofCompleted && cleanupErrors.length === 0;
    if (cleanupErrors.length > 0) {
      cleanupError = new Error(`cleanup failed: ${cleanupErrors.join("; ")}`);
    }
  }

  if (cleanupError) {
    throw cleanupError;
  }
});

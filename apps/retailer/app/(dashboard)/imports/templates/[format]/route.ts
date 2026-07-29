import { requireRetailerRole } from "@paon/auth";
import {
  buildCatalogueImportTemplate,
  catalogueImportTemplateContentType,
  catalogueImportTemplateFilename,
  type CatalogueImportTemplateFormat,
} from "@paon/domain";

import { requireSession } from "@/lib/session";

const FORMATS = new Set<CatalogueImportTemplateFormat>([
  "csv",
  "xlsx",
  "json",
  "llm",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ format: string }> },
) {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const { format: rawFormat } = await context.params;
  if (!FORMATS.has(rawFormat as CatalogueImportTemplateFormat)) {
    return new Response("Unknown template format", { status: 404 });
  }
  const format = rawFormat as CatalogueImportTemplateFormat;
  const body = buildCatalogueImportTemplate(format);
  const payload =
    typeof body === "string"
      ? body
      : new Blob([new Uint8Array(body)], {
          type: catalogueImportTemplateContentType(format),
        });

  return new Response(payload, {
    status: 200,
    headers: {
      "Content-Type": catalogueImportTemplateContentType(format),
      "Content-Disposition": `attachment; filename="${catalogueImportTemplateFilename(format)}"`,
      "Cache-Control": "private, no-store",
      "X-PAON-Import-Contract": "v1",
    },
  });
}

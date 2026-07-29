import { buildCsvTemplate, buildJsonContractSchema } from "@paon/domain";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";

  if (format === "json") {
    return Response.json(buildJsonContractSchema(), {
      headers: {
        "Content-Disposition":
          'attachment; filename="paon-catalogue-import-contract.json"',
      },
    });
  }

  return new Response(buildCsvTemplate(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="paon-catalogue-import-template.csv"',
    },
  });
}

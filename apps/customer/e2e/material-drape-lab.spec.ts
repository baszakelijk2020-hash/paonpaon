import { expect, test } from "@playwright/test";

test("the Material & Drape Lab compares deterministic states and offers a static fallback", async ({
  page,
}) => {
  await page.goto("/material-drape-lab");

  await expect(
    page.getByRole("heading", { name: "Material & Drape Lab" }),
  ).toBeVisible();
  await page.getByText("Structured mohair", { exact: true }).click();
  await page.getByText("In reach", { exact: true }).click();
  await page.getByText("Evening", { exact: true }).click();

  await expect(page.getByText("dry grain")).toBeVisible();
  await expect(
    page.getByLabel("Jacket comparison").getByText("In reach"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Test static fallback" }).click();
  await expect(page.getByText(/Static poster mode/)).toBeVisible();
  await expect(page).toHaveScreenshot(
    "material-drape-lab-static-fallback.png",
    {
      fullPage: true,
    },
  );
});

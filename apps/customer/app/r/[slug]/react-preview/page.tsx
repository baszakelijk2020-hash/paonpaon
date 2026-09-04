import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getStorefrontPageData } from "../get-storefront-page-data";

import { Footer, Sidebar } from "./components";
import { CatalogueSection } from "./components/CatalogueSection";
import styles from "./storefront-shell.module.css";

import { getSupabaseServerClient } from "@/lib/supabase-server";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}

async function StorefrontShell({ slug }: { slug: string }) {
  const supabase = await getSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();

  const pageData = await getStorefrontPageData(slug, authData);

  if (!pageData) {
    notFound();
  }

  return (
    <div className={styles.root}>
      <style>
        {`
          :root {
            --paon-accent: ${pageData.stores[0]?.city ? "#1a1a1a" : "#1a1a1a"};
            --paon-surface: #f5f3f0;
            --paon-ink: #1a1a1a;
            --font-display: "Aviano", Georgia, serif;
            --font-sans: system-ui, sans-serif;
            --font-retailer-display: var(--font-display);
            --font-retailer-body: var(--font-sans);
            --retailer-radius: 0.25rem;
          }
        `}
      </style>

      <div className={styles.main}>
        <Sidebar
          slug={slug}
          retailerName={pageData.retailerNameRaw}
          categoryNames={pageData.categoryNames}
        />

        <div className={styles.content}>
          <CatalogueSection
            entries={pageData.entries}
            categoryNames={pageData.categoryNames}
            defaultCategory={pageData.defaultCategory}
            slug={slug}
          />

          <Footer
            slug={slug}
            retailerName={pageData.retailerNameRaw}
            stores={pageData.stores}
          />
        </div>
      </div>
    </div>
  );
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<div>Loading storefront...</div>}>
      <StorefrontShell slug={slug} />
    </Suspense>
  );
}

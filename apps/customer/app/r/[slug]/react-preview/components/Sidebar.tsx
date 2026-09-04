"use client";

import Link from "next/link";

import styles from "../storefront-shell.module.css";

interface SidebarProps {
  slug: string;
  retailerName: string;
  categoryNames: readonly string[];
}

// Category label mapping (from route.ts)
const CATEGORY_LABELS: Record<string, string> = {
  Pants: "Trousers",
  Knits: "Knitwear",
};

export function Sidebar({ slug, retailerName, categoryNames }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarLogo}>
        <Link href={`/r/${slug}`} className={styles.sidebarBrandName}>
          {retailerName}
        </Link>
      </div>

      <div className={styles.sidebarContextSwitcher}>
        <span
          className={styles.contextSwitcherLink}
          style={{ color: "#d9d9d9" }}
        >
          Store
        </span>
        <span className={styles.contextSwitcherDivider} />
        <Link
          href={`/dashboard?returnTo=${encodeURIComponent(`/r/${slug}`)}`}
          className={styles.contextSwitcherLink}
          style={{ color: "#8a8a87", opacity: 0.7 }}
        >
          My PAON
        </Link>
      </div>

      <nav className={styles.sidebarNav}>
        <Link href={`/r/${slug}`} className={styles.navHomeLink}>
          Home
        </Link>
        <p className={styles.navSectionLabel}>Collection</p>
        {categoryNames.map((category) => (
          <Link
            key={category}
            href={`/r/${slug}?category=${encodeURIComponent(category)}`}
            className={styles.navCategoryLink}
          >
            <span className={styles.navCategoryLabel}>
              {CATEGORY_LABELS[category] || category}
            </span>
          </Link>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <Link href="/discover/platform" className={styles.footerLink}>
          How it works
        </Link>
        <Link href="/founder" className={styles.footerLink}>
          About Us
        </Link>
        <Link href="/consultation" className={styles.footerLink}>
          Contact
        </Link>
        <Link href="/appointments" className={styles.appointmentButton}>
          Book Appointment
        </Link>
      </div>
    </aside>
  );
}

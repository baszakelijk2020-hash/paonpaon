"use client";

import Link from "next/link";

import type { StorefrontPageStore } from "../../storefront-page-data-types";
import styles from "../storefront-shell.module.css";

interface FooterProps {
  slug: string;
  retailerName: string;
  stores: readonly StorefrontPageStore[];
}

export function Footer({ slug, retailerName, stores }: FooterProps) {
  const footerYear = new Date().getFullYear();
  const footerCities = [...new Set(stores.map((store) => store.city))].slice(
    0,
    4,
  );

  return (
    <footer className={styles.footer}>
      <div className={styles.footerContainer}>
        <div className={styles.footerSection}>
          <h2 className={styles.footerSectionTitle}>{retailerName}</h2>
          <p className={styles.footerSectionSubtitle}>
            Tailored pieces, made to measure and kept by one house.
          </p>
        </div>

        <div className={styles.footerSection}>
          <p className={styles.footerServiceLabel}>Client Services</p>
          <p className={styles.footerServiceLink}>
            <Link href={`/r/${slug}/appointments`}>Book an appointment</Link>
          </p>
          <p className={styles.footerServiceLink}>
            <Link href="#gilda-chat-widget">Table service</Link>
          </p>
          <p className={styles.footerServiceLink}>
            <Link href="/dashboard">Your account</Link>
          </p>
        </div>

        {footerCities.length > 0 && (
          <div className={styles.footerSection}>
            <p className={styles.footerServiceLabel}>Ateliers</p>
            {footerCities.map((city) => (
              <p key={city} className={styles.footerServiceLink}>
                {city}
              </p>
            ))}
            <p className={styles.footerServiceLink}>
              <Link href={`/r/${slug}/locations`}>All locations</Link>
            </p>
          </div>
        )}
      </div>

      <div className={styles.footerCopy}>
        © {footerYear} {retailerName}. All rights reserved.
      </div>
    </footer>
  );
}

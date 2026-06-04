"use client";

/**
 * Shared accounts section — shown on the dashboard when the current user
 * has been granted viewer access to other accounts (FR-33).
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface GrantedItem {
  accessId: string;
  ownerId: string;
  ownerEmail: string;
  ownerName?: string;
  grantedAt: string;
}

export default function SharedAccountsSection() {
  const [items, setItems] = useState<GrantedItem[]>([]);

  useEffect(() => {
    fetch("/api/sharing/granted")
      .then((r) => r.json())
      .then((d: { items: GrantedItem[] }) => setItems(d.items ?? []))
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <section aria-label="Shared with you" className="mt-8">
      <h2 className="mb-3 text-lg font-semibold text-ink">Shared with you</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.accessId}>
            <Link
              href={`/shared/${item.ownerId}`}
              className="flex items-center justify-between rounded-lg border border-sand bg-card px-4 py-3 shadow-sm hover:border-green/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {item.ownerName ?? item.ownerEmail}
                </p>
                {item.ownerName && (
                  <p className="text-xs text-muted">{item.ownerEmail}</p>
                )}
              </div>
              <span className="text-xs text-green font-medium">
                View →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

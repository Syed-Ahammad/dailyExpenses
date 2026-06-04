"use client";

/**
 * Settings page — shared access management (FR-32).
 * Owners invite viewers by email; pending invites show a copy-link button
 * so the flow works even without an email provider configured.
 */

import { useEffect, useReducer, useState } from "react";
import Link from "next/link";

interface AccessItem {
  _id: string;
  granteeEmail: string;
  status: "pending" | "active";
  createdAt: string;
  expiresAt: string;
}

interface CreateResult {
  item: AccessItem;
  inviteUrl: string;
}

function useRefreshKey() {
  const [key, bump] = useReducer((n: number) => n + 1, 0);
  return [key, bump] as const;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SettingsPage() {
  const [items, setItems] = useState<AccessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, bump] = useRefreshKey();

  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/sharing")
      .then((r) => r.json())
      .then((d: { items: AccessItem[] }) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setLastInviteUrl(null);
    try {
      const res = await fetch("/api/sharing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as
        | CreateResult
        | { error: string };
      if (!res.ok) {
        setInviteError((json as { error: string }).error ?? "Could not send invite.");
        return;
      }
      const result = json as CreateResult;
      setLastInviteUrl(result.inviteUrl);
      setEmail("");
      bump();
    } catch {
      setInviteError("Something went wrong. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    try {
      await fetch(`/api/sharing/${id}`, { method: "DELETE" });
      bump();
      if (lastInviteUrl) setLastInviteUrl(null);
    } finally {
      setRevokingId(null);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const pendingItems = items.filter((i) => i.status === "pending");
  const activeItems = items.filter((i) => i.status === "active");

  return (
    <main className="min-h-dvh bg-paper px-4 py-10">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-2">
          <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
            ← Dashboard
          </Link>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Settings
        </h1>

        {/* ---------------------------------------------------------- */}
        {/* Shared access                                                */}
        {/* ---------------------------------------------------------- */}
        <section className="mt-8">
          <h2 className="text-base font-semibold text-ink">Shared access</h2>
          <p className="mt-0.5 text-sm text-muted">
            Invite an accountant or trusted person to view your data read-only.
          </p>

          {/* Invite form */}
          <form onSubmit={handleInvite} className="mt-4 flex gap-2">
            <input
              type="email"
              required
              placeholder="accountant@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink placeholder-muted focus:border-green focus:outline-none"
            />
            <button
              type="submit"
              disabled={inviting}
              className="rounded-md bg-green px-4 py-2 text-sm font-medium text-card hover:opacity-90 disabled:opacity-50"
            >
              {inviting ? "Sending…" : "Invite"}
            </button>
          </form>

          {inviteError && (
            <p className="mt-2 text-sm text-red-ink">{inviteError}</p>
          )}

          {/* Invite link (shown after creation — for when email is not configured) */}
          {lastInviteUrl && (
            <div className="mt-3 rounded-md border border-sand bg-card p-3">
              <p className="text-xs font-medium text-muted mb-1.5">
                Invite link — share this with them:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-paper px-2 py-1 text-xs text-ink">
                  {lastInviteUrl}
                </code>
                <button
                  onClick={() => copyLink(lastInviteUrl)}
                  className="shrink-0 rounded px-2.5 py-1 text-xs font-medium border border-sand hover:bg-sand"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {/* Active viewers */}
          {!loading && activeItems.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-ink mb-2">
                Active viewers
              </h3>
              <ul className="space-y-2">
                {activeItems.map((item) => (
                  <AccessRow
                    key={item._id}
                    item={item}
                    revoking={revokingId === item._id}
                    onRevoke={() => handleRevoke(item._id)}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Pending invites */}
          {!loading && pendingItems.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-ink mb-2">
                Pending invites
              </h3>
              <ul className="space-y-2">
                {pendingItems.map((item) => (
                  <AccessRow
                    key={item._id}
                    item={item}
                    revoking={revokingId === item._id}
                    onRevoke={() => handleRevoke(item._id)}
                  />
                ))}
              </ul>
            </div>
          )}

          {!loading && items.length === 0 && (
            <p className="mt-4 text-sm text-muted">
              No active invites. Use the form above to invite someone.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function AccessRow({
  item,
  revoking,
  onRevoke,
}: {
  item: AccessItem;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-sand bg-card px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">
          {item.granteeEmail}
        </p>
        <p className="text-xs text-muted">
          {item.status === "active"
            ? "Active viewer"
            : `Invite pending · expires ${formatDate(item.expiresAt)}`}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-1">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            item.status === "active"
              ? "bg-green/10 text-green"
              : "bg-sand text-muted"
          }`}
        >
          {item.status}
        </span>
        {confirm ? (
          <>
            <button
              onClick={() => { setConfirm(false); onRevoke(); }}
              disabled={revoking}
              className="rounded bg-red-bg px-2 py-1 text-xs font-medium text-red-ink hover:opacity-80 disabled:opacity-50"
            >
              {revoking ? "…" : "Revoke"}
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="rounded px-2 py-1 text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="rounded px-2 py-1 text-xs text-muted hover:text-red-ink"
          >
            Revoke
          </button>
        )}
      </div>
    </li>
  );
}

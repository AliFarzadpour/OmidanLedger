// This is the root layout for the /tenant route group.
// It is intentionally simple and does not contain authentication checks
// to ensure that public-facing pages like /tenant/accept are accessible
// to unauthenticated users. The authentication guard is now in
// /tenant/dashboard/layout.tsx.

export default function PublicTenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}


"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";

export default function TenantAcceptPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Completing sign-in...");

  useEffect(() => {
    const auth = getAuth();
    const href = window.location.href;

    if (!isSignInWithEmailLink(auth, href)) {
      setStatus("Invalid or expired link.");
      return;
    }

    // We need the email address used for the link:
    const storedEmail = window.localStorage.getItem("tenantInviteEmail");

    const email =
      storedEmail ||
      window.prompt("Confirm your email to finish sign-in:") ||
      "";

    if (!email) {
      setStatus("Email is required to finish sign-in.");
      return;
    }

    signInWithEmailLink(auth, email, href)
      .then(() => {
        window.localStorage.removeItem("tenantInviteEmail");
        setStatus("Signed in. Redirecting...");
        router.replace("/tenant"); // or your tenant home
      })
      .catch((err) => {
        console.error(err);
        setStatus("Failed to sign in. Link may be expired.");
      });
  }, [router]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Tenant Portal</h1>
      <p>{status}</p>
    </div>
  );
}

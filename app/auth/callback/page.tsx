"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // After verification, send them to login
    router.replace("/auth");
  }, [router]);

  return <div className="p-6 text-slate-700">Email verified. Redirecting...</div>;
}


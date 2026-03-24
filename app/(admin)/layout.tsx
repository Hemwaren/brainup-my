// app/(admin)/layout.tsx
import { AdminShell } from "@/app/components/AdminShell";  // ✅ named import - keep curly braces
import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
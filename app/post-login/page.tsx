"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function PostLogin() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const role = profile?.role;

      if (role === "HR") router.replace("/hr");
      else if (role === "ADMIN") router.replace("/admin");
      else router.replace("/employee");
    })();
  }, [router]);

  return <div className="p-6 text-slate-700">Loading...</div>;
}

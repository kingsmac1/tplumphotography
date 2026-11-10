import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import AdminLogin from "@/pages/admin/AdminLogin";
import { privateHead } from "@/site/AppShell";

function Login() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <AdminLogin /> : <div className="min-h-screen" />;
}

export const Route = createFileRoute("/admin/login")({
  component: Login,
  head: () => privateHead("Sign in · Tplum Photography"),
});

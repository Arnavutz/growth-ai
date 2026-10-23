import { redirect } from "next/navigation";
import { authenticated } from "../lib/auth";
import Dashboard from "./dashboard";
import { mode } from "../lib/config";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await authenticated())) redirect("/login");
  return <Dashboard mode={mode()} />;
}

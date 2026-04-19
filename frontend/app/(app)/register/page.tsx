import { redirect } from "next/navigation";

/** Legacy route; World ID verify + status live on `/verification`. */
export default function RegisterPage() {
  redirect("/verification");
}

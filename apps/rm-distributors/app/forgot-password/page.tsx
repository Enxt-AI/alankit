import { redirect } from "next/navigation";

export default function ForgotPasswordPage() {
  redirect("/change-password?portal=branch");
}

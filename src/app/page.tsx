import { redirect } from "next/navigation";

// Entry point: send users into the app. The middleware then routes them to
// /sign-in when they have no session, or shows the dashboard when they do.
export default function Home() {
  redirect("/dashboard");
}

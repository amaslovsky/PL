import { redirect } from "next/navigation";

/**
 * Back-compat redirect for the original PL-3 alias. The chat surface
 * now lives at `/`; the LLM picks the template from the user's message.
 */
export default function MutualNdaRedirect() {
  redirect("/");
}
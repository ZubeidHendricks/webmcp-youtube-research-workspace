import { redirect } from "next/navigation";

/** Every visit starts a fresh shared workspace; the URL is the invitation. */
export default function Home() {
  redirect(`/w/${Math.random().toString(36).slice(2, 10)}`);
}

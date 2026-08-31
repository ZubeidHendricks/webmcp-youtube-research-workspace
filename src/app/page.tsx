import { redirect } from "next/navigation";

/** Every visit opens a fresh room; the URL is the invitation. */
export default function Home() {
  redirect(`/r/${Math.random().toString(36).slice(2, 10)}`);
}

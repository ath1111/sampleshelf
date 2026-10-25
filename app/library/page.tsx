import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

async function LibraryContent() {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/library");
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">My library</h1>
      <p className="text-gray-600">
        Welcome, {session.user.name}. Your samples will appear here.
      </p>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Suspense fallback={<p>Loading…</p>}>
        <LibraryContent />
      </Suspense>
    </main>
  );
}
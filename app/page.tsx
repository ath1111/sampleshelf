import { Suspense } from "react";
import { auth, signIn, signOut } from "@/auth";

async function AuthStatus() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="space-y-4">
        <p>Signed in as {session.user.name}</p>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button className="rounded bg-gray-800 px-4 py-2 text-white">
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("github");
      }}
    >
      <button className="rounded bg-gray-800 px-4 py-2 text-white">
        Sign in with GitHub
      </button>
    </form>
  );
}

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Sampleshelf</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <AuthStatus />
      </Suspense>
    </main>
  );
}
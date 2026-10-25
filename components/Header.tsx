import Link from "next/link";
import { Suspense } from "react";
import { auth, signIn, signOut } from "@/auth";

async function UserMenu() {
  const session = await auth();

  if (!session?.user) {
    return (
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/library" });
        }}
      >
        <button className="rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700">
          Sign in with GitHub
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {session.user.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.user.image}
          alt=""
          className="h-8 w-8 rounded-full"
        />
      )}
      <span className="text-sm">{session.user.name}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="rounded border px-4 py-2 text-sm hover:bg-gray-100">
          Sign out
        </button>
      </form>
    </div>
  );
}

export function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold">
            Sampleshelf
          </Link>
          <Link href="/library" className="text-sm hover:underline">
            My library
          </Link>
        </nav>
        <Suspense fallback={<div className="h-8 w-32" />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="mb-4 text-4xl font-bold">Sampleshelf</h1>
      <p className="mb-8 text-lg text-gray-600">
        Organize, tag, and preview your samples and presets in one place.
      </p>
      <Link
        href="/library"
        className="rounded bg-gray-800 px-6 py-3 text-white hover:bg-gray-700"
      >
        Go to my library
      </Link>
    </main>
  );
}
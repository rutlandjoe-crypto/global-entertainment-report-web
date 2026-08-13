import type { Metadata } from "next";
import Link from "next/link";
import { getEditorialItems, parsePublishedDate, SITE_URL } from "../lib/editorial-archive";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editorial Archive | Global Entertainment Report",
  description: "Permanent Global Entertainment Report editorial coverage and source links.",
  alternates: { canonical: `${SITE_URL}/archive` },
};

export default async function ArchivePage() {
  const items = await getEditorialItems();
  return (
    <main className="bg-black px-5 py-10 text-white">
      <section className="mx-auto max-w-4xl rounded-2xl border border-purple-800 bg-neutral-950 p-6 md:p-10">
        <h1 className="text-3xl font-black">Global Entertainment Report Editorial Archive</h1>
        <ul className="mt-6 space-y-5">
          {items.map((item) => (
            <li key={item.slug} className="border-b border-neutral-800 pb-5">
              <Link className="font-bold text-fuchsia-300 hover:underline" href={`/editorial/${item.slug}`}>
                {item.headline}
              </Link>
              <time className="mt-2 block text-sm text-neutral-400" dateTime={parsePublishedDate(item.published)?.toISOString()}>
                {item.published}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

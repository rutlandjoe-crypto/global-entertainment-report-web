import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEditorialItems, parsePublishedDate, seededEditorialItems, SITE_URL } from "../../lib/editorial-archive";

type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return seededEditorialItems.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = (await getEditorialItems()).find((entry) => entry.slug === slug);
  if (!item) return {};
  return {
    title: `${item.headline} | Global Entertainment Report`,
    description: item.context.slice(0, 160),
    alternates: { canonical: `${SITE_URL}/editorial/${item.slug}` },
  };
}

export default async function EditorialPage({ params }: Props) {
  const { slug } = await params;
  const item = (await getEditorialItems()).find((entry) => entry.slug === slug);
  if (!item) notFound();
  const sections = [
    ["Key Data", item.keyData],
    ["Why It Matters", item.whyItMatters],
    ["What To Watch", item.whatToWatch],
    ["Reporting Angles", item.storyAngles],
  ] as const;

  return (
    <main className="bg-black px-5 py-10 text-white">
      <article className="mx-auto max-w-4xl rounded-2xl border border-purple-800 bg-neutral-950 p-6 md:p-10">
        <p className="text-xs font-black uppercase tracking-wide text-fuchsia-300">Global Entertainment Report Editorial</p>
        <h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">{item.headline}</h1>
        <time className="mt-4 block text-sm text-neutral-400" dateTime={parsePublishedDate(item.published)?.toISOString()}>
          {item.published}
        </time>
        <p className="mt-6 text-lg leading-8 text-neutral-300">{item.context}</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {sections.map(([title, entries]) => entries.length ? (
            <section key={title} className="rounded-xl border border-neutral-800 bg-black p-5">
              <h2 className="text-sm font-black uppercase text-fuchsia-300">{title}</h2>
              <div className="mt-3 space-y-3">
                {entries.map((entry, index) => (
                  <p key={`${title}-${index}`} className="border-b border-neutral-800 pb-3 text-sm leading-6 text-neutral-300 last:border-0 last:pb-0">{entry}</p>
                ))}
              </div>
            </section>
          ) : null)}
        </div>
        <p className="mt-8 border-t border-neutral-800 pt-5 text-sm text-neutral-300">
          Original source:{" "}
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-fuchsia-300 underline">{item.sourceName}</a>
        </p>
      </article>
    </main>
  );
}

/**
 * Turns a Greek headline into a URL segment.
 *
 * The previous implementation stripped every character outside `[a-z0-9]`,
 * which for a Greek title removes the entire title: every post was saved with
 * the slug "-", so they all collided on one URL and `/news/<slug>` resolved to
 * whichever one Mongo returned first. Greek letters have to be transliterated.
 *
 * The editor sends a slug of its own and runs the same transliteration, so in
 * practice this is the fallback for posts created without one — but it is also
 * the last line of defence, so it stays here rather than being trusted to the
 * client.
 */

const DIGRAPHS: ReadonlyArray<[RegExp, string]> = [
  [/ου/g, 'ou'],
  [/ού/g, 'ou'],
  // αυ/ευ sound as af/ef before a voiceless consonant, av/ev otherwise.
  [/α[υύ](?=[θκξπστφχψ])/g, 'af'],
  [/α[υύ]/g, 'av'],
  [/ε[υύ](?=[θκξπστφχψ])/g, 'ef'],
  [/ε[υύ]/g, 'ev'],
  [/γγ/g, 'ng'],
  [/γχ/g, 'nch'],
  [/γξ/g, 'nx'],
];

const LETTERS: Readonly<Record<string, string>> = {
  α: 'a', ά: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', έ: 'e', ζ: 'z',
  η: 'i', ή: 'i', θ: 'th', ι: 'i', ί: 'i', ϊ: 'i', ΐ: 'i', κ: 'k',
  λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', ό: 'o', π: 'p', ρ: 'r',
  σ: 's', ς: 's', τ: 't', υ: 'y', ύ: 'y', ϋ: 'y', ΰ: 'y', φ: 'f',
  χ: 'ch', ψ: 'ps', ω: 'o', ώ: 'o',
};

export function slugify(title: string): string {
  let text = title.toLowerCase().trim();

  for (const [pattern, replacement] of DIGRAPHS) {
    text = text.replace(pattern, replacement);
  }

  // The Greek and Extended Greek blocks, by code point.
  text = text.replace(/[Ͱ-Ͽἀ-῿]/g, (char) => LETTERS[char] ?? '');

  text = text.normalize('NFD').replace(/[̀-ͯ]/g, '');

  return text
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/**
 * A slug has to identify one post. `isTaken` is asked once per candidate, so a
 * title that repeats an existing one becomes `…-2`, `…-3` rather than silently
 * overwriting which article a URL points at.
 */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = base || 'arthro';

  if (!(await isTaken(root))) return root;

  for (let suffix = 2; suffix < 100; suffix++) {
    const candidate = `${root}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  // Beyond a hundred identical titles, stop guessing and make it unique.
  return `${root}-${Date.now().toString(36)}`;
}

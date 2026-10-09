#!/usr/bin/env node
/**
 * Regenerates src/generated/csceCatalog.ts from the Texas A&M graduate catalog.
 *
 *   node scripts/generate-csce-catalog.mjs              # fetch the live catalog page
 *   node scripts/generate-csce-catalog.mjs page.html    # parse a saved copy instead
 *
 * Only 600- and 700-level CSCE courses are kept. The output is committed; the
 * app never fetches the catalog at runtime. Breadth tags, course kinds, and
 * planning notes live in src/catalogOverrides.ts, not here.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_URL = 'https://catalog.tamu.edu/graduate/course-descriptions/csce/';
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/generated/csceCatalog.ts');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code === 160 ? ' ' : String.fromCodePoint(code);
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const toText = (fragment) =>
  decodeEntities(fragment.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function parseCredits(hoursText) {
  const match = /Credits\s+(\d+)(?:\s*(?:-|to)\s*(\d+))?/i.exec(hoursText);
  if (!match) throw new Error(`Could not read credits from: ${hoursText}`);
  const min = Number(match[1]);
  const max = match[2] === undefined ? min : Number(match[2]);
  return { minCredits: min, maxCredits: max };
}

/** Splits a course paragraph into description, prerequisites, and cross-listings. */
function splitBody(body) {
  const labelPattern = /<strong>\s*(Prerequisites?|Corequisites?|Cross Listings?)\s*:\s*<\/strong>/gi;
  const parts = [];
  let lastIndex = 0;
  let lastLabel = 'description';
  for (const match of body.matchAll(labelPattern)) {
    parts.push([lastLabel, body.slice(lastIndex, match.index)]);
    lastLabel = match[1].toLowerCase();
    lastIndex = match.index + match[0].length;
  }
  parts.push([lastLabel, body.slice(lastIndex)]);

  const result = { description: '', prerequisiteText: undefined, corequisiteText: undefined, crossListings: [] };
  for (const [label, fragment] of parts) {
    const text = toText(fragment);
    if (!text) continue;
    if (label === 'description') result.description = text;
    else if (label.startsWith('prerequisite')) result.prerequisiteText = text;
    else if (label.startsWith('corequisite')) result.corequisiteText = text;
    else {
      // The catalog writes cross-listings as "ECEN 758 and STAT 639." or "VIZA 670/CSCE 620."
      result.crossListings = [...text.matchAll(/\b([A-Z]{4})\s+(\d{3})\b/g)]
        .map((m) => `${m[1]} ${m[2]}`)
        .filter((code) => !code.startsWith('CSCE '));
    }
  }
  return result;
}

export function parseCatalog(html) {
  const blocks = [...html.matchAll(/<div class="courseblock">([\s\S]*?)<\/div>/g)].map((m) => m[1]);
  if (blocks.length === 0) throw new Error('No course blocks found; the catalog markup may have changed.');

  const courses = [];
  for (const block of blocks) {
    const titleMatch = /<h2 class="courseblocktitle">([\s\S]*?)<\/h2>/.exec(block);
    if (!titleMatch) continue;
    const heading = toText(titleMatch[1]);
    const headingMatch = /^CSCE (\d{3})((?:\/[A-Z]{4} \d{3})*)\s+(.+)$/.exec(heading);
    if (!headingMatch) continue;
    const number = Number(headingMatch[1]);
    if (number < 600 || number >= 800) continue;

    const descMatch = /<p class="courseblockdesc">([\s\S]*?)<\/p>/.exec(block);
    if (!descMatch) throw new Error(`No description paragraph for ${heading}`);
    const hoursMatch = /<span class="hours">([\s\S]*?)<\/span>/.exec(descMatch[1]);
    if (!hoursMatch) throw new Error(`No credit hours for ${heading}`);

    const credits = parseCredits(toText(hoursMatch[1]));
    const body = splitBody(descMatch[1].slice(hoursMatch.index + hoursMatch[0].length));
    const headingCrossListings = headingMatch[2] ? headingMatch[2].split('/').filter(Boolean) : [];
    const crossListings = [...new Set([...headingCrossListings, ...body.crossListings])];

    courses.push({
      code: `CSCE ${headingMatch[1]}`,
      title: headingMatch[3].replace(/\.$/, '').replace(/\s+/g, ' ').trim(),
      ...credits,
      description: body.description,
      ...(body.prerequisiteText ? { prerequisiteText: body.prerequisiteText } : {}),
      ...(body.corequisiteText ? { corequisiteText: body.corequisiteText } : {}),
      ...(crossListings.length ? { crossListings } : {}),
    });
  }

  courses.sort((a, b) => a.code.localeCompare(b.code));
  const seen = new Set();
  for (const course of courses) {
    if (seen.has(course.code)) throw new Error(`Duplicate course ${course.code}`);
    seen.add(course.code);
  }
  return courses;
}

function render(courses) {
  return `// Generated by scripts/generate-csce-catalog.mjs from ${SOURCE_URL}
// Do not edit by hand. Re-run \`npm run catalog:generate\` and commit the result.
// Breadth tags, course kinds, and planning notes live in src/catalogOverrides.ts.

export type GeneratedCatalogCourse = {
  code: string;
  title: string;
  minCredits: number;
  maxCredits: number;
  description: string;
  prerequisiteText?: string;
  corequisiteText?: string;
  crossListings?: string[];
};

export const generatedCatalogSource = ${JSON.stringify(SOURCE_URL)};

export const generatedCsceCourses: GeneratedCatalogCourse[] = ${JSON.stringify(courses, null, 2)};
`;
}

async function main() {
  const inputPath = process.argv[2];
  let html;
  if (inputPath) {
    html = await readFile(inputPath, 'utf8');
  } else {
    const response = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'degree-planner-catalog-generator' } });
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status} ${response.statusText}`);
    html = await response.text();
  }
  const courses = parseCatalog(html);
  await writeFile(OUTPUT, render(courses));
  console.log(`Wrote ${courses.length} CSCE 600/700-level courses to ${OUTPUT}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

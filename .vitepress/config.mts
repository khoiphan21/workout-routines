import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitepress';

type SidebarItem = {
  text: string;
  link: string;
};

const excludedDirectories = new Set([
  '.git',
  '.github',
  '.cursor',
  '.vitepress',
  'node_modules',
  'dist',
]);

function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.md$/i, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function titleFromMarkdown(relativeFilePath: string): string {
  const absolutePath = path.resolve(process.cwd(), relativeFilePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const headingMatch = content.match(/^#\s+(.+)$/m);

  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  return titleFromFileName(path.basename(relativeFilePath));
}

function getMarkdownFiles(directory: string, baseDirectory = directory): string[] {
  const markdownFiles: string[] = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) {
        continue;
      }

      const childDirectory = path.join(directory, entry.name);
      markdownFiles.push(...getMarkdownFiles(childDirectory, baseDirectory));
      continue;
    }

    if (!entry.name.endsWith('.md')) {
      continue;
    }

    const absoluteFilePath = path.join(directory, entry.name);
    const relativeFilePath = path.relative(baseDirectory, absoluteFilePath);
    markdownFiles.push(relativeFilePath);
  }

  return markdownFiles;
}

function linkFromMarkdownPath(relativePath: string): string {
  const normalizedPath = relativePath.replace(/\\/g, '/');

  if (normalizedPath === 'README.md') {
    return '/';
  }

  if (normalizedPath.endsWith('/README.md')) {
    return `/${normalizedPath.slice(0, -'/README.md'.length)}/`;
  }

  if (normalizedPath.endsWith('/index.md')) {
    return `/${normalizedPath.slice(0, -'/index.md'.length)}/`;
  }

  return `/${normalizedPath.replace(/\.md$/i, '')}`;
}

const markdownFiles = getMarkdownFiles(process.cwd()).sort((a, b) =>
  a.localeCompare(b),
);

const rootItems: SidebarItem[] = markdownFiles
  .filter((filePath) => !filePath.includes('/') && filePath !== 'README.md')
  .map((filePath) => ({
    text: titleFromMarkdown(filePath),
    link: linkFromMarkdownPath(filePath),
  }));

const directoryGroups = new Map<string, SidebarItem[]>();

for (const filePath of markdownFiles) {
  if (!filePath.includes('/')) {
    continue;
  }

  const [topLevelDirectory] = filePath.split('/');
  const groupItems = directoryGroups.get(topLevelDirectory) ?? [];

  groupItems.push({
    text: titleFromMarkdown(filePath),
    link: linkFromMarkdownPath(filePath),
  });

  directoryGroups.set(topLevelDirectory, groupItems);
}

for (const [, items] of directoryGroups) {
  items.sort((a, b) => a.text.localeCompare(b.text));
}

const navSectionOrder = ['equipment', 'exercises', 'hevy', 'research', 'plans', 'programs'];
const sectionNavLinks = navSectionOrder
  .filter((section) => directoryGroups.has(section) && section !== 'libs')
  .slice(0, 4)
  .map((section) => {
    const items = directoryGroups.get(section) ?? [];
    const indexLink = `/${section}/`;
    const link =
      items.find((item) => item.link === indexLink)?.link ?? items[0]?.link ?? '/';
    return {
      text: titleFromFileName(section),
      link,
      target: '_self',
    };
  });

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const base =
  process.env.GITHUB_ACTIONS === 'true' && repositoryName
    ? `/${repositoryName}/`
    : '/';

export default defineConfig({
  title: 'Pull-Push Program',
  description: 'Workout program docs generated from Markdown.',
  base,
  cleanUrls: true,
  ignoreDeadLinks: true, // Needed for links to program READMEs in subfolders
  lastUpdated: true,
  srcExclude: [
    '**/node_modules/**',
    '**/.git/**',
    '**/.github/**',
    '**/.cursor/**',
    '**/dist/**',
  ],
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      ...sectionNavLinks,
    ],
    sidebar: [
      {
        text: 'Program',
        items: [{ text: 'Overview', link: '/' }],
      },
      ...(rootItems.length > 0
        ? [
            {
              text: 'Root Pages',
              items: rootItems,
            },
          ]
        : []),
      ...Array.from(directoryGroups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([section, items]) => ({
          text: titleFromFileName(section),
          collapsed: section === 'exercises' || section === 'equipment',
          items,
        })),
    ],
    search: {
      provider: 'local',
    },
  },
});

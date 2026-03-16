import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitepress';

function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.md$/i, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const exercisesDir = path.resolve(process.cwd(), 'exercises');
const exerciseFiles = fs.existsSync(exercisesDir)
  ? fs
      .readdirSync(exercisesDir)
      .filter((file) => file.endsWith('.md'))
      .sort((a, b) => a.localeCompare(b))
  : [];

const exerciseItems = exerciseFiles.map((file) => ({
  text: titleFromFileName(file),
  link: `/exercises/${file.replace(/\.md$/i, '')}`,
}));

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
      ...(exerciseItems.length > 0
        ? [{ text: 'Exercises', link: exerciseItems[0].link }]
        : []),
    ],
    sidebar: [
      {
        text: 'Program',
        items: [{ text: 'Overview', link: '/' }],
      },
      ...(exerciseItems.length > 0
        ? [{ text: 'Exercises', items: exerciseItems }]
        : []),
    ],
    search: {
      provider: 'local',
    },
  },
});

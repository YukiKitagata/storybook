import type { Options } from '@storybook/types';
import { commonConfig } from './vite-config';

import { sanitizeEnvVars } from './envs';
import type { WebpackStatsPlugin } from './plugins';
import type { InlineConfig } from 'vite';
import { logger } from '@storybook/node-logger';

function findPlugin(config: InlineConfig, name: string) {
  return config.plugins?.find((p) => p && 'name' in p && p.name === name);
}

export async function build(options: Options) {
  const { build: viteBuild, mergeConfig } = await import('vite');
  const { presets } = options;

  const config = await commonConfig(options, 'build');
  config.build = mergeConfig(config, {
    build: {
      outDir: options.outputDir,
      emptyOutDir: false, // do not clean before running Vite build - Storybook has already added assets in there!
      rollupOptions: {
        // Do not try to bundle the storybook runtime, it is copied into the output dir after the build.
        external: ['./sb-preview/runtime.js'],
      },
      ...(options.test
        ? {
            reportCompressedSize: false,
            sourcemap: !options.build?.test?.disableSourcemaps,
            target: 'esnext',
            treeshake: !options.build?.test?.disableTreeShaking,
          }
        : {}),
    },
  }).build;

  const finalConfig = await presets.apply('viteFinal', config, options);

  const turbosnapPlugin = findPlugin(finalConfig, 'rollup-plugin-turbosnap');
  if (turbosnapPlugin) {
    logger.warn(`Found 'rollup-plugin-turbosnap' which is now included by default in Storybook 8.`);
    logger.warn(
      `Removing from your plugins list. Ensure you pass \`--webpack-stats-json\` to generate stats.`
    );
    finalConfig.plugins = finalConfig.plugins?.filter((p) => p !== turbosnapPlugin);
  }

  await viteBuild(await sanitizeEnvVars(options, finalConfig));

  const statsPlugin = findPlugin(finalConfig, 'rollup-plugin-webpack-stats') as WebpackStatsPlugin;
  return statsPlugin?.storybookGetStats();
}

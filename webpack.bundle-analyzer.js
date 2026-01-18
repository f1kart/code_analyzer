import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bundle analyzer configuration
export const analyze = {
  mode: 'production',
  devtool: 'source-map',
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      analyzerPort: 8888,
      openAnalyzer: false,
      reportFilename: path.resolve(__dirname, 'bundle-analysis/report.html'),
      defaultSizes: 'parsed',
      generateStatsFile: true,
      statsFilename: path.resolve(__dirname, 'bundle-analysis/stats.json'),
      statsOptions: {
        source: false,
        modules: true,
        chunks: true,
        chunkModules: true,
      },
      excludeAssets: null,
      logLevel: 'info',
    }),
  ],
};

// Development bundle analysis
export const analyzeDev = {
  mode: 'development',
  devtool: 'eval-source-map',
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'server',
      analyzerPort: 8889,
      openAnalyzer: true,
      reportFilename: path.resolve(__dirname, 'bundle-analysis/dev-report.html'),
      defaultSizes: 'parsed',
      generateStatsFile: true,
      statsFilename: path.resolve(__dirname, 'bundle-analysis/dev-stats.json'),
      excludeAssets: null,
      logLevel: 'info',
    }),
  ],
};

// Package.json scripts to add:
// "analyze": "webpack --config webpack.bundle-analyzer.js --env analyze",
// "analyze:dev": "webpack --config webpack.bundle-analyzer.js --env analyzeDev",
// "analyze:compare": "npm run analyze && npm run analyze:dev"

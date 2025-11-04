const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      console.log('🔧 CRACO: Configuring webpack polyfills...');

      // Initialize fallback if it doesn't exist
      webpackConfig.resolve.fallback = webpackConfig.resolve.fallback || {};

      // Add polyfills for Node.js modules used by XRPL
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "os": require.resolve("os-browserify"),
        "url": require.resolve("url"),
        "zlib": require.resolve("browserify-zlib"),
        "path": require.resolve("path-browserify"),
        "vm": false,
        "fs": false,
        "net": false,
        "tls": false
      };

      // Add plugins for global polyfills
      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        }),
      ];

      console.log('✅ CRACO: Webpack configuration complete');
      return webpackConfig;
    },
  },
};
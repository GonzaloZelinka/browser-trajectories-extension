const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    background: './background.js',
    content: './content.js',
    popup: './popup.js',
    localhost_content: './localhost_content.js',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'popup.html', to: 'popup.html' },
      ],
    }),
  ],
  watch: true,
  devtool: 'cheap-source-map',
  optimization: {
    minimize: false,
  },
};

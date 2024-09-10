const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'production',
  target: 'web',
  entry: {
    background: './src/background/index.ts',
    content: './src/content/index.ts',
    localhost_content: './src/content/localhost.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /.(ts|tsx)?$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-typescript'],
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    //   new HtmlWebpackPlugin({
    //     template: './src/index.html',
    //   }),
    new CopyPlugin({
      patterns: [
        { from: path.resolve('manifest.json'), to: path.resolve('dist') },
      ],
    }),
  ],
  watch: true,
  // devtool: 'cheap-source-map',
  // optimization: {
  //   minimize: false,
  // },
};

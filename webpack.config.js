/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */

//@ts-check
"use strict";

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require("path");

/** @type WebpackConfig */
const browserClientConfig = {
  context: path.join(__dirname, "client"),
  mode: "none",
  target: "webworker", // web extensions run in a webworker context
  entry: {
    extension: "./src/browser/extension.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "client", "dist", "browser"),
    libraryTarget: "commonjs",
  },
  resolve: {
    mainFields: ["browser", "module", "main"],
    extensions: [".ts", ".js"], // support ts-files and js-files
    alias: {},
    fallback: {
      path: require.resolve("path-browserify"),
      fs: false,
      url: false,
      crypto: false,
      util: false,
      https: false,
      tls:false,
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  externals: {
    vscode: "commonjs vscode", // ignored because it doesn't exist
  },
  performance: {
    hints: false,
  },
  devtool: "source-map",
};

module.exports = [browserClientConfig];

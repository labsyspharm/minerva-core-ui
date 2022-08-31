const path = require("path");
const { merge } = require("webpack-merge");
const webpackConfig = require("./webpack.common.mts");

module.exports = merge(webpackConfig, {
  mode: "production",
  output: {
    path: path.join(__dirname, "../pages"),
    filename: "bundle.js",
    publicPath: "/",
  },
});

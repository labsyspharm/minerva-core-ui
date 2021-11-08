const webpack = require('webpack');
const { merge } = require('webpack-merge');
const webpackConfig = require('./webpack.common.mts');

const PORT = 2021

module.exports = merge(webpackConfig, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: "./build",
    port: PORT,
    hot: true
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ]
});

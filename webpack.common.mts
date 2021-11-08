const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: [
    "./src/index.tsx",
  ],
  module: {
    rules: [
      {
				test: /\.m?js/,
				resolve: {
						fullySpecified: false
				}
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      }
    ]
  },
  resolve: {
    extensions: [".css", ".ts", ".tsx", ".js", ".jsx"]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{
        from: "static/image",
        to: "./image"
      }]
    }),
    new HtmlWebpackPlugin({
      template: './static/index.html',
      publicPath: '/'
    })
  ] 
};

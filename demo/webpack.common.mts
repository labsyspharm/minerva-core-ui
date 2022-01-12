const path = require("path");

const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const styledComponents =
  require("typescript-plugin-styled-components").default();

const getLocalContext = () => {
  const filePath = path.resolve(__dirname, "src/components");
  const fileName = path.basename(filePath).split(".")[0];
  return path.join(path.dirname(filePath), fileName);
};

module.exports = {
  entry: ["./demo/index.tsx"],
  module: {
    rules: [
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          getCustomTransformers: () => ({ before: [styledComponents] }),
        },
      },
      {
        test: /\.css$/i,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              sourceMap: true,
              modules: {
                auto: true,
                mode: "local",
                localIdentName: "[path]-[local]--[hash:base64:5]",
                localIdentContext: getLocalContext(),
                localIdentHashSalt: "minerva-browser",
              },
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: [".css", ".ts", ".tsx", ".js", ".jsx"],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "demo/image",
          to: "./image",
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: "./demo/index.html",
      publicPath: "/",
    }),
  ],
};

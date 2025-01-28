const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

module.exports = {
  mode: "production",
  entry: {
    popup: "./src/js/popup.js",
    background: "./src/js/background.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "js/[name].js",
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: /@license|@preserve|^!/,
          },
          compress: {
            drop_console: true,
          },
          mangle: true,
        },
        extractComments: false,
      }),
      new CssMinimizerPlugin(),
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CopyPlugin({
      patterns: [
        {
          from: "manifest.json",
          to: "manifest.json",
          transform(content) {
            const manifest = JSON.parse(content.toString());
            manifest.action.default_popup = "html/popup.html";
            manifest.background.service_worker = "js/background.js";
            manifest.version = process.env.npm_package_version;
            return Buffer.from(JSON.stringify(manifest, null, 2));
          },
        },
        { from: "src/html", to: "html" },
        { from: "src/css", to: "css" },
        { from: "assets", to: "assets" },
        { from: "LICENSE", to: "LICENSE" },
      ],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(png|jpg|jpeg|gif)$/i,
        type: "asset/resource",
        generator: {
          filename: "assets/images/[name][ext]",
        },
      },
    ],
  },
};

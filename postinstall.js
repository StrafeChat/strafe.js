// "echo \"exports.workerPath = '${PWD}/dist/worker.js'\" >> ./dist/index.js"

const path = require("path");
const fs = require("fs");

const workerPath = (path.resolve(__dirname, "./dist/worker.js")).replaceAll("\\", "\\\\");
const indexPath = path.resolve(__dirname, "./dist/index.js");

const data = fs.readFileSync(indexPath, "utf8");
const result = data + "\nexports.workerPath = '" + workerPath + "'";
fs.writeFileSync(indexPath, result, "utf8");
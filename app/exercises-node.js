// Node shim for tests.
global.window = global.window || {};
require("./exercises-data.js");
module.exports = global.window.FIT_EX;

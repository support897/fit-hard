// Node shim so tests can load the browser nutrition file.
global.window = global.window || {};
require("./meals-nutrition.js");
module.exports = global.window.MP_NUTRITION;

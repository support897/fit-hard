// Node shim so tests can load the browser data file.
global.window = {};
require("./meals-data.js");
module.exports = global.window.MP_DATA;

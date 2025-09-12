const res = require("express/lib/response");
exports.ping = async (req, res) => {

    res.send("OK");

}
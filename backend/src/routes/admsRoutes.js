const express = require("express");
const {
  handshake,
  receiveData,
  getRequest,
  deviceCommandResult,
  health,
} = require("../controllers/admsController");

const router = express.Router();

router.get("/health", health);
router.get(["/cdata", "/cdata.aspx"], handshake);
router.post(["/cdata", "/cdata.aspx"], receiveData);
router.get(["/getrequest", "/getrequest.aspx"], getRequest);
router.get(["/devicecmd", "/devicecmd.aspx"], deviceCommandResult);
router.post(["/devicecmd", "/devicecmd.aspx"], deviceCommandResult);

module.exports = router;

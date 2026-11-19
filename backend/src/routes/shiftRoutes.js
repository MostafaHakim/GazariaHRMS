const express = require('express');
const router = express.Router();
const { getShifts, createShift, updateShift } = require('../controllers/shiftController');
const { requireCompany } = require('../middleware/companyContext');
router.use(requireCompany);
router.get('/', getShifts);
router.post('/', createShift);
router.put('/:id', updateShift);
module.exports = router;

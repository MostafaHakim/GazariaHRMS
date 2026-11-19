const express = require('express');
const router = express.Router();
const { requireCompany } = require('../middleware/companyContext');
const { authorize } = require('../middleware/authMiddleware');
const {
  listDevices, createDevice, updateDevice, deleteDevice, testDevice, syncDevice, mapEmployeeDevice,
} = require('../controllers/deviceController');

router.use(requireCompany);

// দেখা: সব রোল (ACCOUNTS সহ)। পরিবর্তন/সংযোগ: শুধু ADMIN ও HR
const canManage = authorize('ADMIN', 'HR');
router.get('/', listDevices);
router.post('/', canManage, createDevice);
router.put('/:id', canManage, updateDevice);
router.delete('/:id', canManage, deleteDevice);
router.post('/:id/test', canManage, testDevice);
router.post('/:id/sync', canManage, syncDevice);
router.post('/:id/map-employee', canManage, mapEmployeeDevice);
module.exports = router;

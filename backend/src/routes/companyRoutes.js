const router = require('express').Router();
const { listCompanies, createCompany, updateCompany } = require('../controllers/companyController');
const { authorize } = require('../middleware/authMiddleware');

router.get('/', listCompanies);
router.post('/', authorize('ADMIN'), createCompany);
router.patch('/:id', authorize('ADMIN'), updateCompany);
module.exports = router;

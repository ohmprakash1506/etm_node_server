const router = require('express').Router()
const authMiddleware = require('../../middlewares/auth');
const controller = require('../../controller/employee.controller')

router.post('/search', authMiddleware, controller.employeeSearch)
router.post('/filter', authMiddleware, controller.employeeFilter)
// router.post('/shifts', authMiddleware, controller.shifts)


module.exports = router
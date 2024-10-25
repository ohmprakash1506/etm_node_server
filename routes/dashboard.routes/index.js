const router = require('express').Router()
const authMiddleware = require('../../middlewares/auth');
const controller = require('../../controller/dashboard.controller')

router.get('/list', controller.list)
router.post('/shifts', authMiddleware, controller.shifts)
router.post('/roastered', controller.roastered)
router.post('/trips', controller.trips)
router.post('/tripsByShift', controller.tripsByShift)
// router.post('/assign-admin/:username', controller.assignAdmin)
// router.get('/:id', controller.userById)
// router.post('/update', controller.update)

module.exports = router
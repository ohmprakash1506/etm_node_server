const router = require('express').Router()
const authMiddleware = require('../../middlewares/auth');
const controller = require('../../controller/rtd.controller')

router.post('/addTripDirection', controller.addTripDirection)
router.get('/getTripDirectionById/:tripId', controller.getTripDirectionById)
router.post('/getLiveData', controller.getLiveData)
router.post('/deleteLiveData', controller.deleteLiveData)
// router.post('/shifts', authMiddleware, controller.shifts)


module.exports = router
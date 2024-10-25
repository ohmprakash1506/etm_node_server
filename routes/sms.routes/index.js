const router = require('express').Router()
const authMiddleware = require('../../middlewares/auth');
const controller = require('../../controller/sms.controller')

router.post('/smsSend', controller.sendSms)
// router.post('/shifts', authMiddleware, controller.shifts)


module.exports = router
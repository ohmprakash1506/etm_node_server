const router = require('express').Router()
const controller = require('../../controller/crashreport.controller')

router.post('/', controller.addCrashReportDetails)

module.exports = router
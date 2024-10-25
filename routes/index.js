const router = require('express').Router()
const dashboard = require('./dashboard.routes')
const employee = require('./employee.routes')
const rtd = require('./rtd.routes')
const ivr = require('./ivr.routes')
const crashreports = require('./crashreport.routes')
const routeMessage = require('./routeMessage.routes')

router.use('/analytics', dashboard)
router.use('/employee', employee)
router.use('/rtd', rtd)
router.use('/ivr', ivr)
router.use('/data', crashreports)
router.use('/passangerChat', routeMessage)

module.exports = router
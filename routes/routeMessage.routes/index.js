const router = require('express').Router()
const authMiddleware = require('../../middlewares/auth');
const controlller = require('../../controller/routeMessage.controller');

router.get('/getRoutePassanger', authMiddleware, controlller.getTripPassengers);
router.get('/getGroupChat', authMiddleware, controlller.getGropuchat);

module.exports = router
const router = require('express').Router()
const authMiddleware = require('../../middlewares/auth');
const controller = require('../../controller/ivr.controller');

router.post('/ivrCall', controller.ivrCall);
router.post('/ivrCallWeb', controller.ivrCallWeb);
router.post('/ivrCallConnect', controller.ivrCallConnect);
router.get('/ivrCallDetails', controller.ivrCallDetails);
router.get('/ivrPrmConnect', controller.ivrPrmConnect);
router.post('/ivrPrmConnectInitate', controller.ivrPrmConnectInitate);
router.get('/ivrPrmConnectDrop', controller.ivrPrmConnectDrop);
router.post('/ivrCallsFilter', authMiddleware, controller.ivrCallsFilter);
router.post('/ivrCallsDataCount', authMiddleware, controller.ivrCallsDataCount);
router.post(
  '/ivrCallsDataCountByDate',
  authMiddleware,
  controller.ivrCallsDataCountByDate
);
router.post(
  '/ivrCallsDataCountForToday',
  authMiddleware,
  controller.ivrCallsDataCountForToday
);
router.post('/makeIvrCall', authMiddleware, controller.makeIvrCall);
router.post('/postIvrCall', authMiddleware, controller.postTripData);
router.get('/ivrDetails', authMiddleware, controller.getIvrCallDeatils);
router.get('/ivrAllCallDetails', authMiddleware, controller.getBulkCallDeatils);
router.get('/getAlldata', authMiddleware, controller.getAllCallDetails);
router.get('/getAllCount', authMiddleware, controller.countIvrCallApi);
// router.post('/shifts', authMiddleware, controller.shifts)


module.exports = router
const {CrashReportDetails} = require('../../models/CrashReportDetails')

exports.addCrashReportDetails = (req, res) => {
    async function run() {
        try {
            const { ipAddress, deviceType, oS, activeStatus, appVersion, osVersion, locationPermission, batteryOptimisationStatus, error, errorInfo} = req.body
            const fieldsToCheck = {
                ipAddress,
                deviceType,
                oS,
                activeStatus,
                appVersion,
                osVersion,
                locationPermission,
                batteryOptimisationStatus,
                error,
                errorInfo
            };
            
            function validateFields(fields) {
                const errors = [];
                for (const [key, value] of Object.entries(fields)) {
                    if (value === undefined || value === '') {
                    errors.push(`${key} is undefined or empty`);
                    }
                }
                return errors;
            }

            const validationErrors = validateFields(fieldsToCheck);

            if (typeof(batteryOptimisationStatus) != 'boolean') {
                validationErrors.push('batteryOptimisationStatus should be boolean');
            }
            
            if (validationErrors.length > 0) {
                // validationErrors.forEach(error => console.log(error));
                return res.status(403).json({
                    status: 403,
                    message: "Required parameters are missing or invalid",
                    errors: validationErrors,
                  });
            }

            const devicedata = new CrashReportDetails({
                ipAddress, 
                deviceType, 
                oS, 
                activeStatus, 
                appVersion, 
                osVersion, 
                locationPermission, 
                batteryOptimisationStatus, 
                error, 
                errorInfo
            })

            return devicedata.save().then(data => {
                return res.status(200).json({
                    data: devicedata,
                    status: 200,
                    message: "success",
                });
            }).catch((e) => {
                return res.status(500).json({
                    status: 500,
                    message: "Unable to make the request",
                    error: e
                });
            })
            
          
        } finally {
          //   await client.close();
        }
    }    
    run().catch(console.dir);

}
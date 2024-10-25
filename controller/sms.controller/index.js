const BSON = require("bson");
const axios = require("axios");
const request = require("request");
const client = require("../../mongodb");
// const dbName = "etravelmat"; //DEV
// const dbName = "etravelmat"; //DEV
// const dbName = 'travelmat'; //UAT
// const dbName = 'etravelmateprod'; //PROD
const dbName = process.env.DATABASE;

const database = client.db(dbName);

const key = "a8b8672edca2c84af64d377471c7149fe74eafcde007d33b";
const sid = "etravelmate1";
const token = "1203d7aa6a6bcce2f00febf522344a1df1e403bbe60a3bc9";

function dateInMillisecond(val) {
  const date = new Date(val);
  console.log("date :>> ", date);
  const milliseconds = date.getTime();
  return milliseconds;
}

const formUrlEncoded = x =>
   Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, '')

exports.sendSms = async (req, res) => {
  const from = req.body.from;
  const to = req.body.to;
  const body = req.body.body;
  var dataString = 'From='+from+'&To='+to+'&Body='+body;
  console.log('body', dataString)
  var contentLength = dataString.length;
  var options = {
      headers: {
        'Content-Length': contentLength,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      url: "https://"+key+":"+token+"@api.exotel.in/v1/Accounts/"+sid+"/Sms/send.json",
      method: 'POST',
      body: dataString
  };
  
  function callback(error, response, body) {
      if (!error && response.statusCode == 200) {
          console.log(body);
          res.json(JSON.parse(response.body))
      }else if(error){
        console.log(body);
        // console.log(error);
        res.json({error})
      }else{
        console.log(body);
        // console.log(response);
        res.json({response})
      }
  }
  
  request(options, callback);
};





require('dotenv').config();
const fetch = require('node-fetch');


const auth = async (req, res, next) => {
  console.log('called auth');
  const data = await fetch(
    `${process.env.APP_DOMAIN}/userauth/app/verifyapptoken/${req.headers.vtt_user_signature}`
  );
  const json = await data.json();
  // console.log('data', json);
  // res.json({...req, user: json});
  req.auth = json;
  return next();
  // .then(data => {
  //     console.log('data :>> ',  data.json());
  //      data.json();
  //  })
  //  .then(json => {
  //      console.log('...........', json);
  //      return next();
  //  });
}

module.exports = auth;

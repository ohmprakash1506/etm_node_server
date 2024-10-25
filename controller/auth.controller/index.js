const fetch = require('node-fetch');

exports.auth = (req, res, next) => {
   fetch(`https://uatapi.etravelmate.com/userauth/app/verifyapptoken/${req.headers.vtt_user_signature}`)
    .then(res => res.json())
    .then(json => console.log(json));
}

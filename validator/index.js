exports.isEmail = (email) => {
    var emailFormat = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
    if (email !== '' && email.match(emailFormat)) { return true; }
    
    return false;
}


exports.isNumber = (num) =>{
    let result = /^[0-9]+$/.test(num);
    return result
}

exports.isLetter = (str) => {
    let result = /^[a-zA-Z ]+$/.test(str);
    return result;
}
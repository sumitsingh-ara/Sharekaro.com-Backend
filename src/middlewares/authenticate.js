const jwt = require('jsonwebtoken');
require("dotenv").config();

function verifyToken(token) {
    return new Promise(function (resolve, reject) {
        jwt.verify(token,process.env.JWT_SECRET_KEY,function (error, user) {
            if(error) return reject(error);
          
            return resolve(user);
        })
    })
}

async function authenticate(req,res,next){
    //If we have received the bearer token in the header;
     
    try{
       // console.log(req.headers.authorization)
        //getting the bearer token from the response cookies 
    const bearerToken = req.headers.authorization;
    //If not we will throw an error
    if(!bearerToken || !bearerToken.startsWith('Bearer ')) return res.status(400).send("Please provide a bearer token");

    //else we will extract the user from the token

    const token = bearerToken.split(' ')[1];
        const {user} = await verifyToken(token)

        //checking that user is banned or not
        if(user.accountStatus.active === false) return res.status(400).send("Banned user");
        req.user = user

        //console.log(user);
       
        return next();

    }catch(err){
        //If not user thrpow error
        return res.status(400).send("Please provide a valid bearer token")
    }
}



module.exports = authenticate;
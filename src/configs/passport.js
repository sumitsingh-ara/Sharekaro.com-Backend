const dotenv = require('dotenv');
dotenv.config();
const passport = require('passport');
const GoogleStrategy = require( 'passport-google-oauth2' ).Strategy;
const {nanoid} = require('nanoid');
const User = require("../models/users.models");
const jwt = require("jsonwebtoken");

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({ //syntax to integrate own gmail with nodemailer to send emails;
    service: 'gmail',
    auth: {
           user: process.env.USER,
           pass: process.env.PASSWORD
       }
   });
const newToken = (user) => {
  return jwt.sign({user}, process.env.JWT_SECRET_KEY);
}

passport.use(new GoogleStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID ,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.ORIGIN}/auth/google/callback`,
    userProfileURL: "https://**www**.googleapis.com/oauth2/v3/userinfo",
    passReqToCallback: true
  },
  async function(request, accessToken, refreshToken, profile, done) {
     // console.log(profile);
      //console.log(accessToken);
    const email = profile?._json?.email
    const name = profile?._json?.given_name+" "+profile?._json?.family_name;
    const username = profile?._json?.name.split(" ")[0]+nanoid(3);
    const image = profile?._json?.picture;
    const password = nanoid(10);
    let user;
    try { 
      user = await User.findOne({email}).lean().exec();

      if(!user) {
        user = await User.create({
          username: username,
          email: email,
          name: name,
          password: password,
          profilePic: {
            image:image
          },
          accountStatus: {
            active:true,
            verified:true,
          }
        })
        const mailOptions = {
          from: process.env.USER, // sender address
          to:email, // list of receivers
          subject: `Welcome ${name} on Sharekaro.com`, // Subject line
          html: `<div><div> <h3>Hello ${name}</h3></div>
          <br/>
          <p>Please note down your username and password for your reference</p>
          <h4>Username : ${username}</h4>
          <h4>Password : ${password}</h4>
          <br/>
          <h5>You can change the password on logging page also</h4>
          <br/><br/>  <div>Welcome to the fast growing social service, please feel free to share your thoughts, spread the love of knowledge</div></div>`// plain text body
        };
        transporter.sendMail(mailOptions, function (err, info) {
          if(err)
            console.log(err)
          else{
               //   console.log(info);
          }
       });
      }

      const token = newToken(user);
      return done(null, {user, token})

    } catch(err) {
      console.log("err", err)
    }
  }
));

module.exports = passport
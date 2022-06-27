const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/users.models");
const authenticate = require("../middlewares/authenticate");
const bcrypt = require("bcrypt");
const upload = require("../middlewares/fileuploads.middleware");
const dotenv = require("dotenv");
dotenv.config();
const nodemailer = require("nodemailer");
const cloudinary = require("../utils/cloudinary");

const transporter = nodemailer.createTransport({
  //syntax to integrate own gmail with nodemailer to send emails;
  service: "gmail",
  auth: {
    user: process.env.USER,
    pass: process.env.PASSWORD,
  },
});

const newToken = (user) => {
  return jwt.sign({ user }, process.env.JWT_SECRET_KEY);
};

router.get("/logout", (req, res) => {
  res.clearCookie("Bearer ");
  res.send("clear cookie");
});
//checking the userName availability
router.post("/checkUsername", async (req, res) => {
  let userName;
  try {
    userName = await User.findOne({ username: req.body.username });
    if (userName) return res.status(200).send({ status: false });
    return res.status(200).send({ status: true });
  } catch (err) {
    return res.status(500).send({ message: "Galat" });
  }
});
//Register
router.post("/register", upload.single("image"), async (req, res) => {
  // console.log(req.body,req.file)
  let user;
  try {
    // First we check if user with same email already exists
    user = await User.findOne({ email: req.body.email });
    // if yes then we throw an error that email already exists
    if (user)
      return res.status(400).send({ message: "Account already exists" });

    user = await User.findOne({ username: req.body.username });

    if (user)
      return res.status(400).send({ message: "Username not available" });
    // else we will create the user with the email and password
    // but before saving the password we need to hash it
    let result;
    if (req.file) {
      result = await cloudinary.uploader.upload(req.file.path, {
        folder: "sharekarodotcom/users",
        public_id: new Date() + req.body.email + Math.random() * 10,
      });
      user = await User.create({
        ...req.body,
        profilePic: {
          public_id: result.public_id,
          image: result.url,
        },
        accountStatus: {
          active: true,
        },
      });
    } else {
      let deta = {
        name: req.body.name,
        username: req.body.username,
        profilePic: { public_id: "", image: "" },
        password: req.body.password,
        email: req.body.email,
        accountStatus: {
          active: true,
        },
      };
      user = await User.create(deta);
    }

    // we will create a token
    const token = newToken(user);
    // we will send the token to the frontend
    let msg = "Congratulations account successfully created";
    const { password, ...others } = user._doc; //avoid sending password
    //return res.status(200).send({msg,others,token});
    const mailOptions = {
      from: process.env.USER, // sender address
      to: user.email, // list of receivers
      subject: `Welcome ${req.body.name} on Sharekaro.com`, // Subject line
      html: `<div><div> <h3>Hello ${req.body.name}</h3></div>
          <br/>
         <p>You have successfully created your site on Sharekaro.com</p>
          <br/>  <div>Welcome to the fast growing social service, please feel free to share your thoughts, spread the love of knowledge</div></div>`, // plain text body
    };
    transporter.sendMail(mailOptions, function (err, info) {
      if (err) console.log(err);
      else {
        //   console.log(info);
      }
    });
    //res.cookie('Bearer ', token, {maxAge: 9000000000, httpOnly: false, secure: true });
    // res.cookie("Bearer ","Bearer "+token, {httpOnly: true});
    return res.status(200).json({ message: msg, status: true, token: token });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});
//Login
router.post("/login", async (req, res) => {
  let user;
  try {
    // First we will check if user with same email already exists
    user = await User.findOne({ email: req.body.email });
    let username = await User.findOne({ username: req.body.email });
    // if not exists we throw an error
    // console.log(req.body,username)
    if (!user && !username) return res.status(400).send("Wrong Credentials");
    // if it exists then we match the password
    let match = user
      ? user.checkPassword(req.body.password)
      : username.checkPassword(req.body.password);
    // if not match then we throw an error
    if (!match) return res.status(400).send({ message: "Wrong Credentials" });
    //we dont want to show password to user , so hiding the password using spread operator
    user = user ? user : username;
    const { password, ...others } = user._doc;

    const token = newToken(user); //if everything ok, sending json web token for the user;
    //saving the token into cookies using cookies-parser;
    //res.cookie("Bearer ","Bearer "+token, {httpOnly: true});
    return res.status(200).json({
      message: "Logged in successfully 😊 👌",
      status: true,
      token: token,
    });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});
//Forgot Password
router.post("/resetpassword", async (req, res) => {
  try {
    //console.log(req.body)
    // First we will check if user with same email already exists
    const user = await User.findOne({ email: req.body.email });
    // if not exists we throw an error
    if (!user) return res.status(400).send("User not exists");

    //User exists now create a one time reset link which will be valid for 10 minutes;
    const secret = process.env.JWT_SECRET_KEY + user.password;
    //console.log(process.env.JWT_SECRET_KEY)
    const payload = {
      email: user.email,
      id: user._id,
    };
    const token = jwt.sign(payload, secret, { expiresIn: "10m" }); //creating token with the expire time of 5 minutes
    const link = `https://socialsharekaro.herokuapp.com/social/reset-password/${user._id}/${token}`;
    const mailOptions = {
      from: process.env.USER, // sender address
      to: user.email, // list of receivers
      subject: `Hello ${user.name} , this is a mail regarding password change`, // Subject line
      html: `<div> <h1>Hey ${user.username} Please click on the given link below to reset the password</h1></br><a href=${link}>Click on this link to reset your password</a></div>`, // plain text body
    };
    transporter.sendMail(mailOptions, function (err, info) {
      if (err) console.log(err);
      else {
        // console.log(info);
      }
    });
    return res
      .status(200)
      .send({ message: "Please check your mail to reset the password" });
  } catch (err) {
    return res.status(500).send(err);
  }
});
//Getting the data from the user after making a reset password to place where he can reset password
router.get("/reset-password/:id/:token", async (req, res) => {
  try {
    const { id, token } = req.params;
    const user = await User.findOne({ _id: id });
    if (!user) return res.status(400).send("Something went wrong");
    //If user exits means valid id with valid user;

    const secret = process.env.JWT_SECRET_KEY + user.password; //since this here we havent change the password yet;
    const payload = jwt.verify(token, secret);
    if (!payload) return res.status(400).send("Token Invalid");
    res.redirect(
      `https://sharekaro-one.vercel.app/resetPassword/${id}/${token}`
    );
  } catch (err) {
    return res.status(500).send(err.message);
  }
});
//Final hit to the reset api to post new password;
router.post("/reset-password/:id/:token", async (req, res) => {
  try {
    const { id, token } = req.params;
    const { password, password2 } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(400).send("Something went wrong");
    const secret = process.env.JWT_SECRET_KEY + user.password; //since this here we havent change the password yet;

    const payload = jwt.verify(token, secret);
    if (!payload) return res.status(400).send({ message: "Token Invalid" });
    //validate password and password2 should match
    if (password != password2)
      return res.status(400).send({ message: "Invalid Password" });
    const salt = await bcrypt.genSalt(10);
    req.body.password = await bcrypt.hash(req.body.password, salt);
    const newUser = await User.findByIdAndUpdate(
      id,
      { password: req.body.password },
      { new: true }
    );
    return res.status(200).send(newUser);
  } catch (err) {
    return res.status(500).send(err);
  }
});

///------------------------------------------Banning a user -------------------------------------------------///////////

router.patch("/banuser/:username", authenticate, async (req, res) => {
  try {
    // console.log(req.user);
    if (req.user.admin === false)
      return res.status(400).send({ message: "You are not allowed for this" });

    let user = await User.findOne({ username: req.params.username });

    if (!user) return res.status(400).send({ message: "User not available" });

    const newUser = await User.findByIdAndUpdate(
      user._id,
      { accountStatus:{active:user.accountStatus.active==true?false:true,verified:false} },
      { new: true }
    );

    return res
      .status(200)
      .send({ message: "Banned / unbanned user", user: newUser });
  } catch (err) {
    return res.status(404).send({ message:err.message });
  }
});
module.exports = router;

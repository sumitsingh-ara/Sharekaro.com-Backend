const router = require("express").Router();
const User = require("../models/users.models");
const Post = require("../models/posts.models");
const Comment = require("../models/comments.models");
const jwt = require("jsonwebtoken");
const authenticate = require("../middlewares/authenticate");
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

/////------------------------------------Crud Api for Update users data except password email and username as they can set this from reset password----------------------------------///////////////////////////////

router.post(
  "/update",
  upload.single("image"),
  authenticate,
  async (req, res) => {
    if (
      req.user._id === req.headers.id 
    ) {
      //check the authenticated person email is same as the email received in body or not
      try {
        const userCheck = await User.findById(req.headers.id);
        let match = userCheck.checkPassword(req.body.password);
        // if not match then we throw an error
        if (!match) return res.status(400).send({ message: "Wrong Credentials" });
        if (req.body.admin)
          return res.status(400).send("You are not authorsied for this");
        
        
        if (!userCheck)
          return res
            .status(400)
            .send({ message: "You are not authorized to make any changes" });

        const id = req.user._id; //getting id of user, req.user coming after successful authentication

        // if(req.body.password){
        //     const salt = await bcrypt.genSalt(10);
        // //hashing the passowrd;
        // req.body.password = await bcrypt.hash(req.body.password,salt);
        // }
        let result;
        let updateData;
        if (req.file) {
           
          if (userCheck.profilePic.public_id) {
            await cloudinary.uploader.destroy(userCheck.profilePic.public_id);
          }
          result = await cloudinary.uploader.upload(req.file.path, {
            folder: "sharekarodotcom/users",
            public_id: new Date() + req.body.email + Math.random() * 10,
          });
          updateData = {
            username: req.user.username,
            name: req.body.name,
            email: req.user.email,
            aboutme: req.body.aboutme,
            password: req.user.password,
            socialLinks: {
              linkedin: req.body.linkedin,
              instagram: req.body.instagram,
              github: req.body.github,
              twitter: req.body.twitter,
            },
            profilePic: {
              public_id: result.public_id,
              image: result.url,
            },
            admin: false,
            accountStatus: {
              active: true,
              verified: true,
            },
          };
        }else{
           
            updateData = {
                username:userCheck.username,
                name: req.body.name,
                email: userCheck.email,
                aboutme: req.body.aboutme,
                password: userCheck.password,
                socialLinks: {
                  linkedin: req.body.linkedin,
                  instagram: req.body.instagram,
                  github: req.body.github,
                  twitter: req.body.twitter,
                },
                profilePic: {
                  public_id: userCheck.profilePic.public_id,
                  image: userCheck.profilePic.image,
                },
                admin: false,
                accountStatus: {
                  active: true,
                  verified: true,
                },
              };
        }
       
        const user = await User.findByIdAndUpdate(userCheck._id,{...updateData},{new:true});

        const { password, ...others } = user._doc; //avoid sending password

        return res.status(200).send({status:true});
      } catch (err) {
        return res.status(500).send(err)
      }
    } else {
      return res
        .status(500)
        .send({ message: "You can only update your account" });
    }
  }
);

////////////////////---------------------------------------Deleting the ID --------------------------------////////////////////;
// router.delete("/delete", authenticate, async (req, res) => {
//   if (req.user.email === req.body.email) {
//     //check the authenticated person email is same as the email received in body or not
//     try {
//       const user = await User.findOne({ email: req.body.email });
//       try {
//         if (user.password !== req.body.password)
//           return res.status(400).send({ message: "Something went wrong" }); //check and confirm password, as someone else can try with someone's else pc to delete his ID;

//         await Post.deleteMany({ username: user.username });
//         await Comment.deleteMany({ username: user.username });
//         await User.findOneAndDelete({ email: req.body.email });

//         return res
//           .status(200)
//           .send({ message: "User has been successfully deleted" });
//       } catch (err) {
//        return res.status(500).send(err)
//       }
//     } catch (err) {
//       return res.status(400).send({ message: "User not found" });
//     }
//   } else {
//     return res
//       .status(500)
//       .send({ message: "You are only allowed to delete your account" });
//   }
// });

//-------------------------------------Get user from token ----------------------------------;

router.get("/one",authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(400).send({ message: "User not found" });
    const { password, ...others } = req.user;
    return res.status(200).send({ user: others });
  } catch (err) {
    return res.status(400).send({ message: "User not found" });
  }
});

///-------------------------Get all user------------------------------------------------------;
router.get("/all", async (req, res) => {
  try {
    const users = await User.find().lean().exec();

    return res.status(200).send({ user: users });
  } catch (err) {
    return res.status(400).send({ message: "Something went wrong" });
  }
});

//--------------------------------------Get a specific user details to show on page post written by whom---?..------------------------;
router.get("/specificuser/:username", async (req, res) => {
  try {
    let user = await User.findOne({ username: req.params.username }); //got the user profile details
    if (!user)
      return res
        .status(400)
        .send({ message: "User not available at the moment" });

    const { password, _id, ...others } = user._doc; //destructuing to avoid sending password;

    const postCount = await Post.find({ user: user._id }).countDocuments();
    const likesCount = await Post.find({ user: user._id });
    let sum = 0;
    let views = 0;
    likesCount.forEach((item) => {
      sum += item.likes.length;
      views += item.views;
    });
    let totals = await Post.find().lean().exec();
    let totalPost = await Post.find().countDocuments().lean().exec();
    let totalLikes =0
    let totalViews =0
    totals.forEach((item) => {
      totalViews += item.views;
      totalLikes += item.likes.length;
    })
    const popularity = Math.ceil(((sum+views) / (totalViews+totalLikes) * 100)/totalPost);
    

    return res
      .status(200)
      .send({ ...others, postCount: postCount, likesCount: sum, views: views,popularity:popularity });
  } catch (err) {
    return res.status(500).send(err);
  }
});

///-------------------------------------Verify user email --------------------------------------------------------;

router.get("/specificuser/emailverify/:id", authenticate, async (req, res) => {
  try {
    if (req.user._id != req.params.id)
      return res.status(200).send("You are not authorized to make changes");
    // First we will check if user with same email already exists
    const user = await User.findById(req.params.id);
    // if not exists we throw an error
    if (!user) return res.status(400).send("User not exists");
    //User exists now create a one time reset link which will be valid for 10 minutes;
    const secret = process.env.JWT_SECRET_KEY + user.password;
    //console.log(process.env.JWT_SECRET_KEY)
    const payload = {
      email: user.email,
      id: user.id,
    };
    const token = jwt.sign(payload, secret, { expiresIn: "5m" }); //creating token with the expire time of 5 minutes
    const link = `https://socialsharekaro.herokuapp.com/social/user/specificuser/emailverifypatch/${user.id}/${token}`;
    const mailOptions = {
      from: process.env.USER, // sender address
      to: user.email, // list of receivers
      subject: "Verification of your email", // Subject line
      html: `<div> <h1>Hey ${user.name} Please click on the given link below to verify your email address</h1></br><a href=${link}>Click me</a></div>`, // plain text body
    };
    transporter.sendMail(mailOptions, function (err, info) {
      if (err) console.log(err);
      else {
        //console.log(info);
      }
    });
    return res
      .status(200)
      .send({
        message: "Password link sent to your mail successfully",
        status: true,
      });
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

router.get("/specificuser/emailverifypatch/:id/:token", async (req, res) => {
  try {
    const { id, token } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(400).send("Something went wrong");
    const secret = process.env.JWT_SECRET_KEY + user.password; //since this here we havent change the password yet;

    const payload = jwt.verify(token, secret);
    if (!payload) return res.status(400).send({ message: "Token Invalid" });
    //validate password and password2 should match
    const updateUser = await User.findByIdAndUpdate(
      id,
      { accountStatus: { verified: true, active: true } },
      { new: true }
    );
    return res.status(200).send({ message: "Email verified successfully" });
  } catch (err) {
    return res.status(500).send(err);
  }
});
module.exports = router;

const router = require("express").Router();
const authenticate = require("../middlewares/authenticate");
const Comment = require("../models/comments.models");
const { nanoid } = require("nanoid");
//make a new comment;

router.post("/newcomment", authenticate, async (req, res) => {
  if (req.user._id == req.body.user) {
    try {
      //if(!req.body.comment) return res.status(400).send({message:"You can't make an empty comment"});
      if(req.user.accountStatus.active === false) return res.status(400).send({message:"You are not allowed"})
      let comment = await Comment.create(req.body);
      return res
        .status(200)
        .send({ message: "Commented Successfully", status: true });
    } catch (err) {
      return res.status(500).send({ err: err.message, status: false });
    }
  } else {
    return res
      .status(400)
      .send({ message: "You can't comment without login", status: false });
  }
});

//get all comments of a specific post;

router.get("/allcomments/:postId", async (req, res) => {
  try {
    let comments = await Comment.find({ post: req.params.postId })
      .populate("user", { password: 0, email: 0, _id: 0 }).populate({
        path:"nestedcomments",
        populate:[
          {path:"realuser",select:{profilePic:1}}
          
        ]
      }).lean().exec()

      
    return res.status(200).send({ comments: comments, count: comments.length })
  } catch (err) {
    return res.status(500).send({ err: err.message, status: false });
  }
});

router.delete("/singlecomment/delete", authenticate, async (req, res) => {
  try {
    let comment = await Comment.findById(req.body.id).lean().exec();
    if (comment.user != req.user._id && !req.user.admin)
      return res.status(400).send({
        message: "You are not authorized to delete the comment",
        status: false,
      });

    comment = await Comment.findByIdAndDelete(req.body.id);

    return res
      .status(200)
      .send({ message: "Comment deleted successfully", status: true });
  } catch (err) {
    return res.status(500).send({ message: "Comment not available" });
  }
});

router.patch(
  "/singlecomment/update/:commentId",
  authenticate,
  async (req, res) => {
    
    try {
      const comment = await Comment.findById(req.params.commentId)
        .lean()
        .exec();

      if (req.user._id != comment.user)
        return res.status(400).send({
          message: "You are not authorised to edit this comment",
          status: false,
        });
     // console.log(req.body, comment);
      const commentupdate = await Comment.findByIdAndUpdate(
        req.params.commentId,
        { comment: req.body.editedcomment },
        { new: true }
      )
        .lean()
        .exec();

      return res.status(200).send({
        message: "Updated Successfully",
        status: true,
        comment: commentupdate,
      });
    } catch (err) {
      return res.status(500).send({
        message: "Not authorized or comment not available",
        status: false,
      });
    }
  }
);

////////////////---------Replies on commnets -------------------Nested Comments--------------------------------
router.post(
  "/singlecomment/nestedcomment/:commentId/:userId",
  authenticate,
  async (req, res) => {
    try {
      if (req.user.username != req.params.userId)
        return res
          .status(404)
          .send({ message: "Please login before comment", status: false });
          if(req.user.accountStatus.active === false) return res.status(400).send({message:"You are not allowed"})
      let deta = {
        uniqueId: nanoid(8),
        realuser:req.body.realuser,
        user: req.params.userId,
        comment: req.body.comment,
        date: new Date(),
      };
      let pushReplies = await Comment.updateOne(
        { _id: req.params.commentId },
        { $push: { nestedcomments: deta } },
        { new: true }
      )
        .lean()
        .exec();
      return res.status(200).send({ message: "Success", status: true });
    } catch (err) {
      return res.status(500).send(err);
    }
  }
);
//deleting the single replies of specific user after authentication
router.delete(
  "/singlecomment/nestedcomment/delete/:commentId/:nestedcommentId",
  authenticate,
  async (req, res) => {
    try {
      const repliedComment = await Comment.findOne(
        { _id: req.params.commentId },
        {
          nestedcomments: {
            $elemMatch: { uniqueId: req.params.nestedcommentId },
          },
        }
      )
        .lean()
        .exec();
      //   console.log(req.user.username,repliedComment.nestedcomments[0].user)//extracted the userName from db to check the authentication
      if (req.user.username != repliedComment.nestedcomments[0].user && !req.user.admin)
        return res
          .status(401)
          .send("You are not authorised to delete this comment");
      const deletedComment = await Comment.updateOne(
        { _id: req.params.commentId },
        { $pull: { nestedcomments: { uniqueId: req.params.nestedcommentId } } }
      )
        .lean()
        .exec();
      return res.status(200).send(deletedComment);
    } catch (err) {
      return res.status(500).send(err);
    }
  }
);

//editing the single replies of specific user after authentication
router.patch(
  "/singlecomment/nestedcomment/edit/:commentId/:nestedcommentId",
  authenticate,
  async (req, res) => {
    try {
      const repliedComment = await Comment.findOne(
        { _id: req.params.commentId },
        {
          nestedcomments: {
            $elemMatch: { uniqueId: req.params.nestedcommentId },
          },
        }
      )
        .lean()
        .exec();
      //   console.log(req.user.username,repliedComment.nestedcomments[0].user)//extracted the userName from db to check the authentication
      if (req.user.username != repliedComment.nestedcomments[0].user)
        return res
          .status(401)
          .send("You are not authorised to edit this comment");
      //finding the replied comment that need to be edited and then using position operator to set it;
      const editedcomments = await Comment.updateOne({
        _id: req.params.commentId,
        "nestedcomments.uniqueId": req.params.nestedcommentId,
      },{$set:{"nestedcomments.$.comment":req.body.editedcomment}});
    
      return res.status(200).send(editedcomments);
    } catch (err) {
      return res.status(500).send(err.message);
    }
  }
);
module.exports = router;

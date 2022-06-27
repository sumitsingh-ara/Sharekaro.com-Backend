const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
    post:{type:mongoose.Schema.Types.ObjectId,ref:"Post",required:true},
    comment:{type:String,required:true},
    nestedcomments:[{
        user:{type:String,required:true},
        realuser:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
        comment:{type:String,required:true},
        date:{type:Date,required:true},
        uniqueId:{type:String,required:true},
    }]
},{
    versionKey:false,
    timestamps:true
})

module.exports = mongoose.model("Comment",CommentSchema)
const express= require('express');
const mongoose = require('mongoose');
const path = require('path')
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const {newSchema, reviewSchema} = require('./errorhandling/joiSchema'); 
const asyncCatch = require('./errorhandling/asyncCatch');
const expressError = require('./errorhandling/ExpressError');
const morgan = require('morgan');
const campGround = require('./modules/campGround');
const Reviews = require('./modules/reviews');

const app = express();

mongoose.connect('mongodb://localhost:27017/yelp-camp',{
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(console.log('db connected'))
.catch(err=>console.log(err));

app.engine('ejs',ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(morgan('dev'));

function newValidate(req,res,next){
    const {error} = newSchema.validate(req.body);
    if(error){
        let msg = error.details.map(obj => obj.message).join(",");
        console.log(error.details);
        throw new expressError(msg,500);
    }
    else{
        next();
    }
};

function reviewValidate(req,res,next){
    const {error} = reviewSchema.validate(req.body);
    if(error){
        let msg = error.details.map(obj => obj.message).join(",");
        console.log(error.details);
        throw new expressError(msg,500);
    }
    else{
        next();
    }
};

app.get('/',(req,res)=>{
    res.send("hello");
});

app.get('/campgrounds',asyncCatch(async (req,res,next)=>{
    let campgrounds = await campGround.find({});
    res.render('list', {campgrounds});
}));

app.get('/campgrounds/new',(req,res)=>{
    res.render('new');
});

app.get('/campgrounds/:id/edit',asyncCatch(async (req,res,next)=>{
    let campground = await campGround.findById(req.params.id);
    res.render('edit',{campground});
}));

app.get('/campgrounds/:id',asyncCatch(async (req,res,next)=>{
    let campground = await campGround.findById(req.params.id).populate('reviews');
    res.render('show',{campground});
}));

app.post('/campgrounds',newValidate,asyncCatch(async (req,res,next)=>{
    newValidate(req.body);
    let camp = new campGround(req.body.campground);
    await camp.save();
    res.redirect(`/campgrounds/${camp._id}`);
}));

app.post('/campgrounds/:id/reviews',reviewValidate,asyncCatch(async (req,res,next) => {
    let review = new Reviews(req.body.review);
    let campground = await campGround.findById(req.params.id);
    campground.reviews.push(review);
    await review.save();
    await campground.save();
    res.redirect(`/campgrounds/${campground._id}`);
}));

app.put('/campgrounds/:id',newValidate,asyncCatch(async (req,res,next)=>{
    let {id} = req.params;
    await campGround.findByIdAndUpdate(id,{...req.body.campground});
    res.redirect(`/campgrounds/${id}`);
}));

app.delete('/campgrounds/:id',asyncCatch(async (req,res,next)=>{
    let {id} = req.params;
    await campGround.findByIdAndDelete(id);
    res.redirect('/campgrounds');
}));

app.delete('/campgrounds/:id/reviews/:reviewId',asyncCatch(async (req,res,next)=>{
    let {id,reviewId} = req.params;
    await Reviews.findByIdAndDelete(reviewId);
    let camp = await campGround.findById(id);
    await camp.updateOne({$pull:{reviews:reviewId}});    
    res.redirect(`/campgrounds/${id}`);
}));

app.all('*',(req,res,next)=>{
    next(new expressError("404 Page not Found",404));
});

app.use((err,req,res,next)=>{
    let {status=500,message="Something went wrong"} = err;
    res.status(status);
    res.render('error',{err,message});
});

app.listen(3000,()=>{
    console.log("listening at port 3000");
});

const errorHandler = (err,req,res,next)=>{
    let {statusCode , message , errors , stackk} = err;

    if(!statusCode) statusCode =500;

    res.status(statusCode).json({
        success : false,
        message : message || "Internal server error",
        errors : errors || [],
        stack : stackk   //remove in production
    })
}

export default errorHandler;
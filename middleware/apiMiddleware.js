const responseMiddleware = async(req, res, next)=>{
    let { statusCode , success , message , data} = res.locals.registerData
    console.log(success , data )
    res.status(statusCode).json({
        statusCode: statusCode || 200,
        success: success !== undefined ? success : true,
        message: message || "Successful hit",
        data: data || []
    })
}

export default responseMiddleware;
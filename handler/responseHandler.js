const responseHandler = async( statusCode , success , message , data, res, next)=>{
    
    console.log(success , data )
    
    res.status(statusCode).json({
    statusCode: statusCode || 200,
    success: success !== undefined ? success : true,
    message: message || "Successful hit",
    data: data || []
    })
}

export default responseHandler;
import {genToken} from '../config/db.js'

export const handleGoogleCallback = async (req,res)=>{
    console.log("in callback")
    const user = req.user;
    const token = await genToken(user.id , user.name , user.email)
    console.log(token)
    res.cookie('token', token, {
        httpOnly: true, 
        secure: false,  
        maxAge: 3600000 // 1 hour
      });
      res.redirect('http://localhost:5173');
}
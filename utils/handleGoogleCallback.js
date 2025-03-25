import {genToken} from '../config/db.js'

export const handleGoogleCallback = async (req,res)=>{
    console.log("in callback")
    const user = req.user;
    const token = await genToken(user.id , user.name , user.email)
    console.log(token)
    res.header('Authorization', 'Bearer ' + token);
    res.redirect('http://localhost:5173')
}
import GoogleStrategy from 'passport-google-oauth20';
import passport from "passport";
import {findOrCreateUser} from "../controllers/googleController.js";
import dotenv from 'dotenv';

dotenv.config();
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL :process.env.CALLBACK_URL
} , async (accessToken, refreshToken, profile, done)=>{
    try{
        const user = await findOrCreateUser(profile);
        if(user?.redirect){
          return done(null ,{redirect: true , email: user.email})
        }
        console.log("in passport js",user)
        return done(null,user)
    }catch(err){
        console.error('Error in Google Strategy:', err);
        return done(err, null); 
    }
}))

  
export default passport;
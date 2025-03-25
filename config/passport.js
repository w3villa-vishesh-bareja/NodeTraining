import {Strategy as JwtStrategy , ExtractJwt} from "passport-jwt";
import GoogleStrategy from 'passport-google-oauth20';
import passport from "passport";
// import errorMessages from './errorMessages.json'
import {findOrCreateUser} from "../utils/findOrCreateUser.js";
import dotenv from 'dotenv';

dotenv.config();
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL :process.env.CALLBACK_URL
} , async (accessToken, refreshToken, profile, done)=>{
    try{
        // console.log(profile)
        const user = await findOrCreateUser(profile);
        console.log("ran");
        console.log(user)
        return done(null,user)
    }catch(err){
        console.error('Error in Google Strategy:', err);
        return done(err, null); 
    }
}))
const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET_KEY,
  };
  
  passport.use(new JwtStrategy(opts, async (jwt_payload, done) => {
    try {
      const [user] = await pool.query(nativeQueries.getUserById, [jwt_payload.id]);
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    } catch (err) {
      console.error("Error in JWT Strategy:", err);
      return done(err, false);
    }
  }));
export default passport;
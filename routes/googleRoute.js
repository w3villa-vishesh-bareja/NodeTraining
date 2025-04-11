import express, { response } from 'express'
import passport from "../config/passport.js";
import {setUsername , handleGoogleCallback} from "../controllers/googleController.js"
import responseMiddleware from '../middleware/responseMiddleware.js';
const router = express.Router()

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] , session:false}));

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/', session: false}),
  handleGoogleCallback
);

router.
post('/setUsername' , setUsername , responseMiddleware); 
  
export default router;
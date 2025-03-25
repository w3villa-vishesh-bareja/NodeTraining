import express from 'express'
import passport from "../config/passport.js";
import { handleGoogleCallback } from '../utils/handleGoogleCallback.js';

const router = express.Router()

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] , session:false}));

router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/', session: false}),
    handleGoogleCallback
  );
  
export default router;
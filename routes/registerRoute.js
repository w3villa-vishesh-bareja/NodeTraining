import express from 'express'
// import { login} from '../controllers/userController.js'
import { createProfile, emailVerification, registerEmail, sendOtp, uploadProfilePhoto, verifyOtp } from '../controllers/registerController.js';
import {verifyJwt} from "../middleware/authMiddleware.js"

const router = express.Router()

router.post('/', registerEmail);
router.post('/verifyEmail',verifyJwt, emailVerification)
router.post('/sendOTP',sendOtp);
router.post('/verifyOTP',verifyOtp);
router.post('/createProfile', createProfile);
router.post('/uploadProfile', uploadProfilePhoto);


export default router;
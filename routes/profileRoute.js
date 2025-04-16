import express from 'express'
import { getProfile, getUser, updateProfile } from '../controllers/userController.js';
import { verifyJwt } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/getProfile',verifyJwt, getProfile);
router.post('/updateProfile',verifyJwt , updateProfile);
router.get('/getUser' , verifyJwt , getUser)

export default router;
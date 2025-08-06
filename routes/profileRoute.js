import express from 'express'
import { getProfile, getUser, updateProfile , editProfile } from '../controllers/userController.js';
import { verifyJwt } from '../middleware/authMiddleware.js';
import responseMiddleware from '../middleware/responseMiddleware.js';

const router = express.Router();

router.get('/getProfile',verifyJwt, getProfile , responseMiddleware);
router.post('/updateProfile',verifyJwt , updateProfile,responseMiddleware);
router.get('/getUser' , verifyJwt , getUser,responseMiddleware);
router.patch('/edit-profile' , verifyJwt , editProfile)

export default router;
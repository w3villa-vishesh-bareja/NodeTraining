import express from 'express';
import Razorpay from 'razorpay'; 
import crypto from 'crypto';
import dotenv from 'dotenv';
import pool from '../config/dbService.js';
import nativeQueries from '../nativequeries/nativeQueries.json' assert { type: 'json' };
dotenv.config();
const router = express.Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET,
});

router.post('/create-order', async (req, res) => {
    console.log(req.body);
    try {
        const { currency = 'INR', receipt = "receipt#1", userId, tier } = req.body;
        let amount
        if(tier === 'tier_2'){
             amount = 1000;
        }else if(tier === 'tier_3'){
             amount = 2000;
        }

        const options = {
            amount: amount * 100, 
            currency,
            receipt,
            notes:{
                userId: userId,
                tierPlan: tier
            }
        };
        const order = await razorpay.orders.create(options);
        res.status(200).json(order);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create Razorpay order' });
    }
});

router.post('/verify-payment', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId , tier } = req.body;

    const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (generatedSignature === razorpay_signature) {
        await pool.query(nativeQueries.updateUserSubscription, [tier, userId]);
        res.status(200).json({ success: true, message: 'Payment verified successfully' });
    } else {
        res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
});

export default router;
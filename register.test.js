import request from 'supertest';
import app from './index.js'; // Your Express app
import pool from './config/dbService.js';

let testEmail = `test_${Date.now()}@mail.com`;
let testUsername = `user_${Date.now()}`;
let testPhone = `+911234567890`;
let uniqueId;
let token;
let otp;

describe('User Registration Flow', () => {
  afterAll(async () => {
    // Cleanup test user from DB
    await pool.query('DELETE FROM users WHERE email = ?', [testEmail]);
    await pool.query('DELETE FROM otp_verifications WHERE phone_number = ?', [testPhone]);
    pool.end();
  });

  test('Step 1: Register email', async () => {
    const res = await request(app).post('/register').send({ email: testEmail });
    expect(res.statusCode).toBe(201);
    expect(res.body.data[0].user.email).toBe(testEmail);
    uniqueId = res.body.data[0].user.unique_id;
  });

  test('Step 2: Email verification (get token from DB and set password)', async () => {
    const [rows] = await pool.query('SELECT verificationToken FROM email_verifications WHERE user_id = ?', [uniqueId]);
    token = rows[0].verificationToken;
    
    const res = await request(app)
      .post('/register/verifyEmail')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: testEmail, password: 'mypassword123' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].next_action).toBe('PHONE_VERIFICATION');
  });

  test('Step 3: Send OTP', async () => {
    const res = await request(app)
      .post('/register/sendOtp')
      .send({ number: testPhone, unique_id: uniqueId });

    expect(res.statusCode).toBe(200);

    // get OTP from DB
    const [otpRow] = await pool.query('SELECT otp FROM otp_verifications WHERE phone_number = ?', [testPhone]);
    otp = otpRow[0].otp;
  });

  test('Step 4: Verify OTP', async () => {
    const res = await request(app)
      .post('/register/verifyOtp')
      .send({ number: testPhone, otp: otp, unique_id: uniqueId });

    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].next_action).toBe('CREATE_PROFILE');
  });

  test('Step 5: Create profile', async () => {
    const res = await request(app)
      .post('/register/createProfile')
      .send({
        username: testUsername,
        firstname: 'Test',
        lastname: 'User',
        email: testEmail
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].user.username).toBe(testUsername);
  });

  test('Step 6: Upload profile photo (fallback avatar)', async () => {
    const res = await request(app)
      .post('/register/uploadProfile')
      .send({ email: testEmail });

    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].user.imageUrl).toMatch(/ui-avatars\.com/);
  });
});

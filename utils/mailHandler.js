import nodemailer from "nodemailer";
import dotenv from 'dotenv';

dotenv.config();
async function mailer(email ,token) {

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  const link = `http://locahost:5173?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: "Hello",
    text: "This is a test email",
    html: `<h1>Hello </h1><p>This is a test email.<a href="http://localhost:5000/user/verifyEmail?token=${token}">Click Here To Verify</a></p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    // console.error("Error occurred:", error);
    throw new Error(error);
  }
}
export default mailer;
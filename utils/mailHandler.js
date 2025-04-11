import nodemailer from "nodemailer";
import dotenv from 'dotenv';
import { MAIL_OPTIONS } from "../config/appConstants.js";
dotenv.config();
async function mailer(email ,token , type) {
let mailOptions;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  const link = `http://locahost:5173?token=${token}`;

  if(type == MAIL_OPTIONS.VERIFY_EMAIL){
     mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: "Hello",
      text: "This is a test email",
      html: `<h1>Hello</h1><p>This is a test email.<a href="http://localhost:5173/register/verifyEmail?token=${token}">Click Here To Verify</a></p>`,
    }
  if(type == MAIL_OPTIONS.RESET_PASSWORD){

  }

}


  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    // console.error("Error occurred:", error);
    throw new Error(error);
  }
}
export default mailer;
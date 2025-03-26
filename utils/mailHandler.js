import nodemailer from "nodemailer";

async function mailer(token) {

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "your-email@gmail.com",
      pass: "",
    },
  });
  const link = `http://locahost:5173?token=${token}`;

  const mailOptions = {
    from: "your-email@gmail.com",
    to: "recipient-email@example.com",
    subject: "Hello",
    text: "This is a test email",
    html: `<h1>Hello </h1><p>This is a test email.${token}</p>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error occurred:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    // console.error("Error occurred:", error);
    throw new Error(error);
  }
}
export default mailer;
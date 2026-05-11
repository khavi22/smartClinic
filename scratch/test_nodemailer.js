const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // true for 465
    auth: {
        user: "mahlatseclayton1@gmail.com",
        pass: "jaiymuyzkvzxhfyh",
    },
});

async function testConnection() {
    try {
        console.log("Verifying transporter...");
        await transporter.verify();
        console.log("Transporter is ready to take our messages");
        
        // Optional: send a test email to the same address
        /*
        const info = await transporter.sendMail({
            from: '"SmartClinic Test" <mahlatseclayton1@gmail.com>',
            to: "mahlatseclayton1@gmail.com",
            subject: "SmartClinic Email Configuration Test",
            text: "This is a test email to verify Nodemailer configuration.",
            html: "<b>This is a test email to verify Nodemailer configuration.</b>",
        });
        console.log("Message sent: %s", info.messageId);
        */
    } catch (error) {
        console.error("Error during email verification:", error);
    }
}

testConnection();

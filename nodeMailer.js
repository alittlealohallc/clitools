// Node.js - Using Nodemailer
// Install: npm install nodemailer

import { createTransport } from 'nodemailer';

// Create transporter with iCloud SMTP
const transporter = createTransport({
    host: 'smtp.mail.me.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
        user: 'kentknows@icloud.com',
        pass: 'jhum-qtcr-srak-sqpm' // App-Specific Password
    },
    tls: {
        ciphers: 'SSLv3'
    }
});

// For SSL (port 465) use:
// const transporter = nodemailer.createTransport({
//     host: 'smtp.mail.me.com',
//     port: 465,
//     secure: true,
//     auth: { user: '...', pass: '...' }
// });

// Send email
async function sendEmail() {
    try {
        const info = await transporter.sendMail({
            from: '"vnstat Logger" <kentknows@icloud.com>',
            to: 'hello@alittlealoha.pro',
            subject: 'Hello from iCloud!',
            text: 'This email was sent via iCloud SMTP.',
            html: '<p>This email was sent via <b>iCloud SMTP</b>.</p>'
        });

        console.log('Email sent:', info.messageId);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

sendEmail();
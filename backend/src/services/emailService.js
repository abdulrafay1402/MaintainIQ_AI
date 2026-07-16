const nodemailer = require('nodemailer');
const dns = require('dns');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

const checkDnsResolution = (hostname) => {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, (err, address) => {
      if (err) {
        reject(new Error(`DNS resolution failed for host ${hostname}: ${err.message}`));
      } else {
        resolve(address);
      }
    });
  });
};

const connectEmail = async () => {
  const mailer = getTransporter();
  if (!mailer) {
    console.log('Nodemailer: SMTP_USER or SMTP_PASS missing. Email notifications disabled.');
    return;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  try {
    console.log(`Checking DNS resolution for SMTP host: ${host}...`);
    await checkDnsResolution(host);
    console.log('DNS resolution: OK');

    console.log('Verifying SMTP transporter connection...');
    await mailer.verify();
    console.log('Nodemailer connected: OK');
  } catch (error) {
    console.error('Nodemailer connection failed:', error.message);
    console.warn('⚠️ SMTP credentials verification failed. Emails will not send.');
  }
};

const sendEmail = async ({ to, subject, text, html }) => {
  const mailer = getTransporter();
  if (!mailer || !to) return false;

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || text,
    });
    return true;
  } catch (error) {
    console.error('Email send failed:', error.message);
    return false;
  }
};

module.exports = { sendEmail, connectEmail };

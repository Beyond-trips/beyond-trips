import nodemailer from 'nodemailer'

// Create Postmark SMTP transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '2525'),
    secure: false, // Postmark uses STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      ciphers: 'SSLv3',
    },
  })
}

export const sendOTPEmail = async (email: string, otp: string) => {
  try {
    const transporter = createTransporter()
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'hello@beyondtrip.co.uk',
      to: email,
      subject: 'Your OTP Code - Verify Your Email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your OTP Code</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin: 0; font-size: 28px;">Email Verification</h1>
            </div>
            
            <div style="margin-bottom: 30px;">
              <p style="color: #555; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                Hello,
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                You requested an OTP code for email verification. Please use the code below:
              </p>
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px; margin: 30px 0;">
              <h2 style="color: white; font-size: 36px; margin: 0; letter-spacing: 8px; font-weight: bold;">
                ${otp}
              </h2>
            </div>
            
            <div style="margin: 30px 0;">
              <p style="color: #555; font-size: 16px; line-height: 1.5; margin: 0 0 15px 0;">
                <strong>This code will expire in 10 minutes.</strong>
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.5; margin: 0 0 15px 0;">
                If you didn't request this verification code, please ignore this email.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
            
            <div style="text-align: center;">
              <p style="color: #999; font-size: 14px; margin: 0;">
                This is an automated message, please do not reply to this email.
              </p>
              <p style="color: #999; font-size: 14px; margin: 10px 0 0 0;">
                Sent via Postmark
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Email Verification

Hello,

You requested an OTP code for email verification. Please use the code below:

${otp}

This code will expire in 10 minutes.

If you didn't request this verification code, please ignore this email.

---
This is an automated message, please do not reply to this email.
Sent via Postmark`,
    }

    console.log('Sending email via Postmark SMTP...')
    const result = await transporter.sendMail(mailOptions)
    console.log('Email sent successfully via Postmark:', result.messageId)
    
    return { 
      success: true, 
      messageId: result.messageId,
      provider: 'Postmark SMTP'
    }
  } catch (error) {
    console.error('Failed to send email via Postmark:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'Postmark SMTP'
    }
  }
}

export const testEmailConnection = async () => {
  try {
    const transporter = createTransporter()
    await transporter.verify()
    console.log('✅ Postmark SMTP connection verified successfully')
    return { success: true, message: 'SMTP connection verified' }
  } catch (error) {
    console.error('❌ Postmark SMTP connection failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
export const sendPasswordResetEmail = async (
  email: string,
  resetUrl: string,
  firstName: string = 'User'
) => {
  try {
    const transporter = createTransporter()
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'hello@beyondtrip.co.uk',
      to: email,
      subject: 'Reset Your Password - Beyond Trip',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; margin: 0; font-size: 28px;">🔐 Reset Your Password</h1>
            </div>
            
            <div style="margin-bottom: 30px;">
              <p style="color: #555; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                Hi ${firstName},
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                We received a request to reset your password for your Beyond Trip account. If you made this request, click the button below to reset your password:
              </p>
            </div>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        text-decoration: none; 
                        padding: 15px 30px; 
                        border-radius: 8px; 
                        font-size: 16px; 
                        font-weight: bold; 
                        display: inline-block;
                        transition: all 0.3s ease;">
                Reset My Password
              </a>
            </div>
            
            <div style="margin: 30px 0;">
              <p style="color: #555; font-size: 14px; line-height: 1.5; margin: 0 0 15px 0;">
                Or copy and paste this link into your browser:
              </p>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 12px; color: #666;">
                ${resetUrl}
              </div>
            </div>
            
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
              <p style="color: #856404; font-size: 14px; margin: 0 0 10px 0; font-weight: bold;">
                ⚠️ Important Security Information:
              </p>
              <ul style="color: #856404; font-size: 14px; margin: 0; padding-left: 20px;">
                <li>This link will expire in <strong>1 hour</strong> for security reasons</li>
                <li>If you didn't request this password reset, please ignore this email</li>
                <li>Your password will remain unchanged if you don't click the link</li>
                <li>Never share this link with anyone</li>
              </ul>
            </div>
            
            <div style="margin: 30px 0;">
              <p style="color: #555; font-size: 16px; line-height: 1.5; margin: 0 0 15px 0;">
                If you're having trouble with the button above, copy and paste the URL into your web browser.
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.5; margin: 0;">
                If you need help or have questions, please contact our support team.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
            
            <div style="text-align: center;">
              <p style="color: #999; font-size: 14px; margin: 0;">
                This is an automated message, please do not reply to this email.
              </p>
              <p style="color: #999; font-size: 14px; margin: 10px 0 0 0;">
                Sent via Postmark
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Reset Your Password - Beyond Trip

Hi ${firstName},

We received a request to reset your password for your Beyond Trip account. If you made this request, click the link below to reset your password:

${resetUrl}

IMPORTANT SECURITY INFORMATION:
- This link will expire in 1 hour for security reasons
- If you didn't request this password reset, please ignore this email
- Your password will remain unchanged if you don't click the link
- Never share this link with anyone

If you're having trouble, copy and paste the URL into your web browser.

If you need help or have questions, please contact our support team.

If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.

---
This is an automated message, please do not reply to this email.
Sent via Postmark`,
    }

    console.log('Sending password reset email via Postmark SMTP...')
    const result = await transporter.sendMail(mailOptions)
    console.log('Password reset email sent successfully via Postmark:', result.messageId)
    
    return { 
      success: true, 
      message: 'Password reset email sent successfully',
      messageId: result.messageId,
      provider: 'Postmark SMTP'
    }
  } catch (error) {
    console.error('Failed to send password reset email via Postmark:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'Postmark SMTP'
    }
  }
}
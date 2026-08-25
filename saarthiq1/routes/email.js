// backend/routes/email.js - COMPLETE UPDATED VERSION WITH REPLY-TO
import express from "express";
import { Resend } from "resend";
import { requireAuth } from "../middleware/auth.js";
import { connectDB } from "../db.js";

const router = express.Router();

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// From address - using your verified domain
const FROM_EMAIL = "Talent Corner <team@saarthiq.in>";
const FROM_NAME = "Talent Corner H.R. Services";

// Helper function to get user email info
async function getUserEmailInfo(userId) {
  try {
    const db = await connectDB();
    
    const [userRows] = await db.execute(
      'SELECT id, email, name, department, employee_id, is_enabled FROM users WHERE id = ?',
      [userId]
    );
    
    if (userRows.length === 0) {
      return null;
    }
    
    const user = userRows[0];
    
    // Validate user email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      console.error(`Invalid email format for user ${userId}: ${user.email}`);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error getting user email info:', error);
    return null;
  }
}

// Add this function near the top, after other helper functions
async function checkUserCanSendEmail(userId, userEmail) {
  try {
    const db = await connectDB();
    
    // Special user who always has email automation
    const SPECIAL_USER_EMAIL = "purnaghadi923@gmail.com" ;
    
    if (userEmail === SPECIAL_USER_EMAIL) {
      console.log(`✅ SPECIAL ACCESS: Email automation always enabled for ${SPECIAL_USER_EMAIL}`);
      return { canSend: true, isSpecialUser: true };
    }
    
    // Check global setting first
    const [globalSettings] = await db.execute(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      ['emailAutomation']
    );
    
    let globalEmailAutomation = true;
    if (globalSettings.length > 0) {
      globalEmailAutomation = globalSettings[0].setting_value === 'true' || 
                             globalSettings[0].setting_value === '1';
    }
    
    if (!globalEmailAutomation) {
      return { 
        canSend: false, 
        error: "Global email automation is disabled by admin" 
      };
    }
    
    // Check user's email automation setting
    const [userSettings] = await db.execute(
      'SELECT email_automation_enabled FROM users WHERE id = ? AND is_enabled = 1',
      [userId]
    );
    
    if (userSettings.length === 0) {
      return { 
        canSend: false, 
        error: "User is disabled" 
      };
    }
    
    const canSend = userSettings[0].email_automation_enabled === 1;
    
    return { 
      canSend,
      error: canSend ? null : "Email automation is disabled for your account",
      isSpecialUser: false
    };
    
  } catch (error) {
    console.error('Error checking user email permissions:', error);
    return { 
      canSend: false, 
      error: error.message,
      isSpecialUser: false
    };
  }
}

async function canUserSendEmail(userId) {
  try {
    const userInfo = await getUserEmailInfo(userId);
    
    if (!userInfo) {
      return { 
        canSend: false, 
        userEmail: null, 
        userName: null,
        error: "User not found or invalid email"
      };
    }
    
    // ⭐ SPECIAL USER: Always allow email automation for this user
    const SPECIAL_USER_EMAIL = "ailsneha1105@gmail.com";
    
    if (userInfo.email === SPECIAL_USER_EMAIL) {
      console.log(`✅ SPECIAL ACCESS: Email automation always enabled for ${SPECIAL_USER_EMAIL}`);
      return { 
        canSend: true, 
        userEmail: userInfo.email, 
        userName: userInfo.name,
        department: userInfo.department,
        employeeId: userInfo.employee_id,
        alwaysEnabled: true
      };
    }
    
    // Check if user is enabled and has email automation enabled
    const db = await connectDB();
    const [settings] = await db.execute(
      'SELECT email_automation_enabled FROM users WHERE id = ? AND is_enabled = 1',
      [userId]
    );
    
    if (settings.length === 0) {
      return { 
        canSend: false, 
        userEmail: userInfo.email, 
        userName: userInfo.name,
        error: "User is disabled or email automation is off"
      };
    }
    
    const userSettings = settings[0];
    const canSend = userSettings.email_automation_enabled === 1;
    
    return { 
      canSend, 
      userEmail: userInfo.email, 
      userName: userInfo.name,
      department: userInfo.department,
      employeeId: userInfo.employee_id
    };
  } catch (error) {
    console.error('Error checking user email permissions:', error);
    return { 
      canSend: false, 
      userEmail: null, 
      userName: null,
      error: error.message
    };
  }
}

// ADD THIS ENDPOINT - Place it after the helper function
router.get('/check-user-permission', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    const db = await connectDB();
    
    // Special user who always has email automation
    const SPECIAL_USER_EMAIL = "ailsneha1105@gmail.com";
    
    if (userEmail === SPECIAL_USER_EMAIL) {
      console.log(`✅ SPECIAL ACCESS: Email automation always enabled for ${SPECIAL_USER_EMAIL}`);
      return res.json({
        success: true,
        emailAutomationEnabled: true,
        isSpecialUser: true,
        message: "Email automation enabled (special user)"
      });
    }
    
    // Check global setting from system_settings
    const [globalSettings] = await db.execute(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      ['emailAutomation']
    );
    
    let globalEmailAutomation = true;
    if (globalSettings.length > 0) {
      globalEmailAutomation = globalSettings[0].setting_value === 'true' || 
                             globalSettings[0].setting_value === '1';
    }
    
    if (!globalEmailAutomation) {
      return res.json({
        success: true,
        emailAutomationEnabled: false,
        isSpecialUser: false,
        message: "Global email automation is disabled by admin"
      });
    }
    
    // Check user's email automation setting from users table
    const [userSettings] = await db.execute(
      'SELECT email_automation_enabled FROM users WHERE id = ? AND is_enabled = 1',
      [userId]
    );
    
    let canSend = true;
    if (userSettings.length > 0) {
      canSend = userSettings[0].email_automation_enabled === 1;
    }
    
    return res.json({
      success: true,
      emailAutomationEnabled: canSend,
      isSpecialUser: false,
      message: canSend ? "Email automation enabled" : "Email automation is disabled for your account"
    });
    
  } catch (error) {
    console.error('Error in check-user-permission:', error);
    return res.status(200).json({  
      success: true,
      emailAutomationEnabled: false,
      isSpecialUser: false,
      message: "Error checking permission, defaulting to disabled"
    });
  }
});

/**
 * POST /api/email/send-profile-update
 * Send profile update email with reply-to functionality
 */
router.post("/send-profile-update", requireAuth, async (req, res) => {
  let db;
  try {
    const { 
      candidateEmail, 
      candidateName, 
      profile_id 
    } = req.body;

    // Get user ID from auth token
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }
    
    if (!candidateEmail) {
      return res.status(400).json({
        success: false,
        message: "Candidate email is required"
      });
    }

    // Validate candidate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(candidateEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid candidate email format"
      });
    }

    // Get user's actual email from database
    db = await connectDB();
    const [userRows] = await db.execute(
      'SELECT id, email, name, department, employee_id FROM users WHERE id = ? AND is_enabled = 1',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found or disabled"
      });
    }

    const user = userRows[0];
    const userEmail = user.email; // This is the ACTUAL email from database
    const userName = user.name;
    const department = user.department;
    const employeeId = user.employee_id;

    console.log('✅ Retrieved user email from database:', {
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      department: user.department,
      employeeId: user.employee_id
    });

    // Validate user email format
    if (!emailRegex.test(userEmail)) {
      console.error('❌ Invalid user email format:', userEmail);
      return res.status(400).json({
        success: false,
        message: "Your email address is invalid. Please update your profile.",
        userEmail: userEmail
      });
    }

    // Check if user can send emails
    const { canSend, error: permissionError, isSpecialUser } = await checkUserCanSendEmail(userId, userEmail);

    if (!canSend) {
      return res.status(403).json({ 
        success: false, 
        message: permissionError || "Email automation is disabled for your account.",
        details: permissionError
      });
    }

    console.log(`✅ Email permission granted for ${userEmail}${isSpecialUser ? ' (SPECIAL USER)' : ''}`);

    const safeCandidateName = candidateName || "Candidate";
    const safeEmployeeName = userName || "Talent Corner Team Member";

    const subject = `Update Your Profile - Talent Corner (Ref: ${employeeId || 'TC'})`;

    // Generate unique tracking ID
    const trackingId = `tc_${Date.now()}_${userId}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create email with clear reply instructions
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Update Your Profile - Talent Corner</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #f9f9f9;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #4B2E83 0%, #6B46C1 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 26px;
            font-weight: 600;
          }
          .header p {
            margin: 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .content {
            padding: 30px;
          }
          .greeting {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #4B2E83;
          }
          .highlight-box {
            background-color: #f8f5ff;
            border-left: 4px solid #4B2E83;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 8px 8px 0;
          }
          .button-container {
            text-align: center;
            margin: 35px 0;
          }
          .update-button {
            background: linear-gradient(135deg, #4B2E83 0%, #6B46C1 100%);
            color: #ffffff;
            padding: 16px 45px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            display: inline-block;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(75, 46, 131, 0.3);
          }
          .update-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(75, 46, 131, 0.4);
          }
          .reply-section {
            background: linear-gradient(135deg, #e8f4f8 0%, #d4e7ff 100%);
            padding: 25px;
            border-radius: 10px;
            border: 2px solid #4B2E83;
            margin: 30px 0;
            position: relative;
            overflow: hidden;
          }
          .reply-section::before {
            content: "💬";
            position: absolute;
            top: 10px;
            right: 10px;
            font-size: 40px;
            opacity: 0.2;
          }
          .reply-section h3 {
            color: #4B2E83;
            margin-top: 0;
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .reply-section h3::before {
            content: "📧";
            font-size: 24px;
          }
          .contact-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-top: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .contact-info {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 15px;
          }
          .contact-avatar {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #4B2E83 0%, #6B46C1 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            font-weight: bold;
          }
          .contact-details h4 {
            margin: 0 0 5px 0;
            color: #4B2E83;
          }
          .contact-details p {
            margin: 0;
            color: #666;
            font-size: 14px;
          }
          .reply-instruction {
            background: #f0f9ff;
            padding: 15px;
            border-radius: 6px;
            margin-top: 15px;
            border-left: 4px solid #3b82f6;
          }
          .footer {
            background-color: #f8f8f8;
            padding: 25px 30px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #666;
          }
          .footer strong {
            color: #4B2E83;
          }
          .company-info {
            margin-top: 15px;
            font-size: 14px;
            line-height: 1.5;
          }
          .signature {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-style: italic;
          }
          .warning-note {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 12px;
            border-radius: 6px;
            margin: 15px 0;
            font-size: 13px;
          }
          @media (max-width: 600px) {
            .content {
              padding: 20px;
            }
            .header {
              padding: 20px;
            }
            .update-button {
              padding: 14px 35px;
              font-size: 15px;
            }
            .contact-info {
              flex-direction: column;
              text-align: center;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>Talent Corner H.R. Services</h1>
            <p>Profile Update Request</p>
          </div>
          
          <div class="content">
            <div class="greeting">Dear ${safeCandidateName},</div>
            
            <div class="section">
              <p>We hope this message finds you well. To ensure we have your most current information and can connect you with the best possible opportunities, please take a moment to <strong>update your profile</strong> with your latest details.</p>
            </div>
            
            <div class="highlight-box">
              <p style="margin-top: 0; font-weight: 600; color: #4B2E83;">Why update your profile?</p>
              <ul style="margin-bottom: 0;">
                <li>Get matched with relevant job opportunities</li>
                <li>Increase your visibility to our recruiters</li>
                <li>Receive personalized job recommendations</li>
                <li>Showcase your latest skills and experience</li>
              </ul>
            </div>
            
            <div class="button-container">
              <a href="http:" class="update-button">
                Update My Profile Now
              </a>
            </div>
            
            <p style="text-align: center; color: #666; margin-top: -15px;">
              <small>Or copy this link: https://www.saarthijobs.com/</small>
            </p>
            
            <!-- REPLY-TO SECTION -->
            <div class="reply-section">
              <h3>Need to Reply or Have Questions?</h3>
              
              <div class="contact-card">
                <div class="contact-info">
                  <div class="contact-avatar">
                    ${userName ? userName.charAt(0).toUpperCase() : 'T'}
                  </div>
                  <div class="contact-details">
                    <h4>${userName || 'Talent Corner Team Member'}</h4>
                    <p>${department || 'Recruitment Team'} Department</p>
                    <p><small>Employee ID: ${employeeId || 'N/A'}</small></p>
                  </div>
                </div>
                
                <div class="reply-instruction">
                  <p style="margin: 0 0 10px 0; font-weight: 600;">📨 <strong>How to reply:</strong></p>
                  <p style="margin: 0; font-size: 14px;">
                    Simply click <strong>"Reply"</strong> in your email client. Your reply will automatically go to:<br>
                    <strong style="color: #4B2E83;">${userEmail}</strong>
                  </p>
                </div>
              </div>
              
              <div class="warning-note">
                <strong>⚠️ Important:</strong> Please do not change the "To" address when replying. 
                Your response will be delivered directly to ${userName || 'our team member'}.
              </div>
            </div>
            
            <div class="section">
              <p>Your updated information helps us serve you better and match you with opportunities that align with your career goals.</p>
              
              <p><strong>About Talent Corner:</strong><br>
              We are a professional recruitment organization working with companies across industries to help them hire the right talent and support candidates in building their careers.</p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Best Regards,</strong><br>
            Talent Corner H.R. Services Pvt. Ltd.</p>
            
            <div class="signature">
              <p>${userName || 'Talent Corner Team'}<br>
              <small>This email was sent on behalf of our recruitment team member</small></p>
            </div>
            
            <div class="company-info">
              <p><small>
                This is an automated message from Talent Corner's recruitment system.<br>
                Replies will be directed to the team member who sent this email.<br>
                Tracking ID: ${trackingId}
              </small></p>
              <p><small>© ${new Date().getFullYear()} Talent Corner H.R. Services Pvt. Ltd. All rights reserved.</small></p>
            </div>
          </div>
        </div>
        
        <!-- Email Tracking Pixel -->
        <img src="${process.env.FRONTEND_URL || 'https://www.saarthiq.in'}/api/email/track?tid=${trackingId}" 
             width="1" height="1" style="display:none;" alt="" />
      </body>
      </html>
    `;

    // Plain text version
    const text = `UPDATE YOUR PROFILE - TALENT CORNER

Dear ${safeCandidateName},

We hope this message finds you well. To ensure we have your most current information and can connect you with the best possible opportunities, please take a moment to update your profile with your latest details.

WHY UPDATE YOUR PROFILE?
- Get matched with relevant job opportunities
- Increase your visibility to our recruiters
- Receive personalized job recommendations
- Showcase your latest skills and experience

UPDATE YOUR PROFILE:
https://www.saarthijobs.com/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEED TO REPLY OR HAVE QUESTIONS?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This email was sent to you by:
${userName || 'Talent Corner Team Member'}
${department || 'Recruitment Team'} Department
Employee ID: ${employeeId || 'N/A'}

HOW TO REPLY:
Simply click "Reply" in your email client. Your reply will automatically go to:
${userEmail}

⚠️ Important: Please do not change the "To" address when replying. Your response will be delivered directly to ${userName || 'our team member'}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABOUT TALENT CORNER:
We are a professional recruitment organization working with companies across industries to help them hire the right talent and support candidates in building their careers.

Your updated information helps us serve you better and match you with opportunities that align with your career goals.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Best Regards,
Talent Corner H.R. Services Pvt. Ltd.

${userName || 'Talent Corner Team'}
(This email was sent on behalf of our recruitment team member)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated message from Talent Corner's recruitment system.
Replies will be directed to the team member who sent this email.
Tracking ID: ${trackingId}

© ${new Date().getFullYear()} Talent Corner H.R. Services Pvt. Ltd. All rights reserved.`;

    try {
      // Send email with Reply-To header
      const emailData = {
        from: `${FROM_NAME} <team@saarthiq.in>`,
        to: candidateEmail,
        replyTo: userEmail,
        subject: subject,
        html: html,
        text: text,
        headers: {
          'X-Email-Type': 'profile_update',
          'X-Sent-By-User-ID': userId.toString(),
          'X-Sent-By-User-Email': userEmail,
          'X-Sent-By-User-Name': userName || '',
          'X-Tracking-ID': trackingId,
          'X-Candidate-Email': candidateEmail,
          'X-Candidate-Name': safeCandidateName,
          'List-Unsubscribe': `<mailto:unsubscribe@saarthiq.in?subject=Unsubscribe%20${trackingId}>`,
          'Precedence': 'bulk'
        }
      };

      console.log(`📧 FINAL EMAIL CONFIGURATION:
  From: ${FROM_EMAIL}
  To: ${candidateEmail}
  Reply-To: ${userEmail}
  Subject: ${subject}
  User: ${userName} (${userEmail})
  Tracking ID: ${trackingId}
`);

      const response = await resend.emails.send(emailData);

      // Check for Resend errors
      if (response.error) {
        console.error("❌ Resend API error:", response.error);
        
        // Log failed email
        await db.execute(
          `INSERT INTO email_logs 
           (profile_id, user_id, candidate_name, candidate_email, email_type, email_subject, 
            email_content, status, tracking_id, reply_to_email, sent_from_email) 
           VALUES (?, ?, ?, ?, 'profile_update', ?, ?, 'failed', ?, ?, ?)`,
          [
            profile_id || '', 
            userId, 
            safeCandidateName, 
            candidateEmail, 
            subject,
            html,
            trackingId,
            userEmail,
            FROM_EMAIL
          ]
        );
        
        throw new Error(`Resend API error: ${response.error.message}`);
      }

      // Log successful email
      await db.execute(
        `INSERT INTO email_logs 
         (profile_id, user_id, candidate_name, candidate_email, email_type, email_subject, 
          email_content, status, tracking_id, reply_to_email, sent_from_email) 
         VALUES (?, ?, ?, ?, 'profile_update', ?, ?, 'sent', ?, ?, ?)`,
        [
          profile_id || '', 
          userId, 
          safeCandidateName, 
          candidateEmail, 
          subject, 
          html,
          trackingId,
          userEmail,
          FROM_EMAIL
        ]
      );
      
      console.log(`✅ Email sent successfully!
        Tracking ID: ${trackingId}
        Resend ID: ${response.data?.id}
        Reply-To: ${userEmail}
      `);

      res.json({ 
        success: true, 
        message: "Email sent successfully",
        data: {
          candidateEmail,
          candidateName: safeCandidateName,
          sentFrom: FROM_EMAIL,
          replyTo: userEmail,
          senderName: userName,
          timestamp: new Date().toISOString(),
          trackingId: trackingId,
          resendId: response.data?.id
        }
      });
    } catch (emailError) {
      console.error("❌ Email sending error:", emailError);
      
      // Log failed email
      if (db) {
        try {
          await db.execute(
            `INSERT INTO email_logs 
             (profile_id, user_id, candidate_name, candidate_email, email_type, email_subject, 
              status, tracking_id, reply_to_email, sent_from_email, error_message) 
             VALUES (?, ?, ?, ?, 'profile_update', ?, 'failed', ?, ?, ?, ?)`,
            [
              profile_id || '', 
              userId, 
              safeCandidateName, 
              candidateEmail, 
              subject,
              trackingId,
              userEmail,
              FROM_EMAIL,
              emailError.message
            ]
          );
        } catch (logError) {
          console.error("⚠️ Failed to log error to database:", logError);
        }
      }
      
      res.status(500).json({ 
        success: false, 
        message: "Failed to send email. Please try again.", 
        error: process.env.NODE_ENV === "development" ? emailError.message : undefined
      });
    }
  } catch (error) {
    console.error("❌ Error in send-profile-update:", error);
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to process email request", 
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
    });
  }
});

/**
 * GET /api/email/track
 * Email open tracking endpoint
 */
router.get('/track', async (req, res) => {
  try {
    const { tid } = req.query; // tracking ID
    
    if (tid) {
      const db = await connectDB();
      
      // Update email log with opened timestamp
      await db.execute(
        'UPDATE email_logs SET status = "opened" WHERE tracking_id = ? AND status = "sent"',
        [tid]
      );
      
      console.log(`📧 Email opened: ${tid}`);
    }
    
    // Return 1x1 transparent GIF
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.send(pixel);
    
  } catch (error) {
    console.error('Email tracking error:', error);
    // Still return pixel even if tracking fails
    res.setHeader('Content-Type', 'image/gif');
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.send(pixel);
  }
});

/**
 * GET /api/email/test-reply
 * Test endpoint to verify reply-to works
 */
router.get('/test-reply', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user info
    const userInfo = await getUserEmailInfo(userId);
    
    if (!userInfo) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Test email data
    const testData = {
      from: `${FROM_NAME} <team@saarthiq.in>`,
      to: userInfo.email, // Send test to user themselves
      replyTo: userInfo.email, // Reply to same user
      subject: `TEST: Reply-To Functionality - ${new Date().toLocaleString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4B2E83;">Reply-To Test Email</h2>
          <p>Hello ${userInfo.name},</p>
          <p>This is a test email to verify that the reply-to functionality is working correctly.</p>
          
          <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #4B2E83;">
            <h3 style="color: #4B2E83; margin-top: 0;">📧 Test Instructions:</h3>
            <ol>
              <li><strong>Click "Reply"</strong> in your email client</li>
              <li>Check if the "To" field shows: <strong>${userInfo.email}</strong></li>
              <li>Write a test message and send it</li>
              <li>You should receive your own reply</li>
            </ol>
          </div>
          
          <p><strong>Technical Details:</strong></p>
          <ul>
            <li><strong>From:</strong> ${FROM_EMAIL}</li>
            <li><strong>Reply-To:</strong> ${userInfo.email}</li>
            <li><strong>Your Email:</strong> ${userInfo.email}</li>
            <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
          </ul>
          
          <p>If replies come to your inbox (not to team@saarthiq.in), the system is working correctly!</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
            <p>This is a test email from Talent Corner's email system.</p>
            <p>User ID: ${userId} | Employee ID: ${userInfo.employee_id || 'N/A'}</p>
          </div>
        </div>
      `,
      text: `REPLY-TO TEST EMAIL

Hello ${userInfo.name},

This is a test email to verify reply-to functionality.

TEST INSTRUCTIONS:
1. Click "Reply" in your email client
2. Check if "To" field shows: ${userInfo.email}
3. Write a test message and send
4. You should receive your own reply

TECHNICAL DETAILS:
- From: ${FROM_EMAIL}
- Reply-To: ${userInfo.email}
- Your Email: ${userInfo.email}
- Timestamp: ${new Date().toISOString()}

If replies come to your inbox, the system is working correctly!

This is a test email from Talent Corner's email system.
User ID: ${userId} | Employee ID: ${userInfo.employee_id || 'N/A'}
`
    };

    const response = await resend.emails.send(testData);
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    res.json({
      success: true,
      message: "Test email sent successfully",
      data: {
        sentTo: userInfo.email,
        replyTo: userInfo.email,
        resendId: response.data?.id,
        instructions: "Check your email and try replying to see if it comes back to you"
      }
    });
    
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to send test email",
      error: error.message
    });
  }
});

/**
 * GET /api/email/logs
 * Get email logs for a user
 */
router.get('/logs', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const userId = req.user.id;
    const isAdmin = req.user.is_admin;
    
    let query;
    let params;
    
    if (isAdmin) {
      // Admin can see all logs
      query = `
        SELECT el.*, u.name as user_name, u.email as user_email, u.employee_id
        FROM email_logs el
        LEFT JOIN users u ON el.user_id = u.id
        ORDER BY el.sent_at DESC
        LIMIT 100
      `;
      params = [];
    } else {
      // Users can only see their own logs
      query = `
        SELECT el.*, u.name as user_name, u.email as user_email, u.employee_id
        FROM email_logs el
        LEFT JOIN users u ON el.user_id = u.id
        WHERE el.user_id = ?
        ORDER BY el.sent_at DESC
        LIMIT 50
      `;
      params = [userId];
    }
    
    const [logs] = await db.execute(query, params);
    
    res.json({
      success: true,
      logs: logs,
      count: logs.length
    });
    
  } catch (error) {
    console.error('❌ Get email logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email logs'
    });
  }
});

export default router;

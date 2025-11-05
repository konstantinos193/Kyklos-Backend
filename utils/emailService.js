const nodemailer = require('nodemailer');
const NewsletterModel = require('../models/NewsletterModel');
const { cache } = require('../config/upstash-redis');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  // Initialize email transporter
  initializeTransporter() {
    // Only create transporter if credentials are provided
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    } else {
      console.log('⚠️  Email credentials not configured - email features disabled');
      this.transporter = null;
    }
  }

  // Verify email configuration
  async verifyConnection() {
    if (!this.transporter) {
      console.log('⚠️  Email service not configured');
      return false;
    }
    
    try {
      await this.transporter.verify();
      console.log('✅ Email service ready');
      return true;
    } catch (error) {
      console.error('❌ Email service error:', error.message);
      return false;
    }
  }

  // Subscribe to newsletter
  async subscribeToNewsletter(email, name = '', source = 'website') {
    try {
      // Check if already subscribed
      const existing = await NewsletterModel.findByEmail(email);
      
      if (existing) {
        if (existing.isActive) {
          return { success: false, message: 'Email already subscribed' };
        } else {
          // Reactivate subscription
          await NewsletterModel.resubscribe(email);
          
          // Clear cache
          await cache.delPattern('newsletter:*');
          
          return { success: true, message: 'Email reactivated successfully' };
        }
      }

      // Create new subscription
      const subscriber = await NewsletterModel.create({
        email: email.toLowerCase(),
        name: name.trim(),
        source: source,
        isActive: true
      });

      // Clear cache
      await cache.delPattern('newsletter:*');

      // Send welcome email
      await this.sendWelcomeEmail(email, name);

      return { success: true, message: 'Successfully subscribed to newsletter' };
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      return { success: false, message: 'Subscription failed' };
    }
  }

  // Unsubscribe from newsletter
  async unsubscribeFromNewsletter(email) {
    try {
      const subscriber = await NewsletterModel.findOne({ 
        email: email.toLowerCase(),
        isActive: true 
      });

      if (!subscriber) {
        return { success: false, message: 'Email not found in subscription list' };
      }

      subscriber.isActive = false;
      subscriber.unsubscribedAt = new Date();
      await subscriber.save();

      // Clear cache
      await cache.delPattern('newsletter:*');

      return { success: true, message: 'Successfully unsubscribed' };
    } catch (error) {
      console.error('Newsletter unsubscription error:', error);
      return { success: false, message: 'Unsubscription failed' };
    }
  }

  // Send welcome email
  async sendWelcomeEmail(email, name = '') {
    if (!this.transporter) {
      console.log('⚠️  Email service not configured - skipping welcome email');
      return;
    }
    
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'grkyklos-@hotmail.gr',
        to: email,
        subject: '🎓 Καλώς ήρθατε στο ΚΥΚΛΟΣ Φροντιστήριο!',
        html: `
          <!DOCTYPE html>
          <html lang="el">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Καλώς ήρθατε - ΚΥΚΛΟΣ Φροντιστήριο</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
              
              <!-- Header with Logo and Branding -->
              <div style="background: linear-gradient(135deg, #0f172a 0%, #1f2937 50%, #E7B109 100%); padding: 40px 30px; text-align: center; position: relative; overflow: hidden;">
                <!-- Decorative Elements -->
                <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
                <div style="position: absolute; bottom: -30px; left: -30px; width: 80px; height: 80px; background: rgba(231, 177, 9, 0.2); border-radius: 50%;"></div>
                
                <!-- Logo Area -->
                <div style="position: relative; z-index: 2;">
                  <div style="display: inline-block; background: rgba(255,255,255,0.15); padding: 20px; border-radius: 20px; margin-bottom: 20px; backdrop-filter: blur(10px);">
                    <div style="width: 60px; height: 60px; background: linear-gradient(45deg, #E7B109, #D97706); border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                      Κ
                    </div>
                  </div>
                  <h1 style="margin: 0; font-size: 32px; font-weight: 800; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.3); letter-spacing: 1px;">
                    Καλώς ήρθατε!
                  </h1>
                  <p style="margin: 8px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 500;">
                    Στο ΚΥΚΛΟΣ Φροντιστήριο
                  </p>
                </div>
              </div>

              <!-- Main Content -->
              <div style="padding: 40px 30px;">
                <!-- Welcome Message -->
                <div style="text-align: center; margin-bottom: 30px;">
                  <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 24px; font-weight: 700;">
                    Αγαπητέ/ή ${name || 'Φίλε/η'},
                  </h2>
                  <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0;">
                    Ευχαριστούμε που εγγραφήκατε στο newsletter μας! Θα λαμβάνετε τακτικά ενημερώσεις για τα νέα μας.
                  </p>
                </div>

                <!-- Features Grid -->
                <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 16px; padding: 25px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                  <h3 style="color: #1e293b; margin: 0 0 20px 0; font-size: 18px; font-weight: 700; text-align: center;">
                    🎯 Τι θα λαμβάνετε:
                  </h3>
                  <div style="display: grid; gap: 15px;">
                    <div style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #E7B109;">
                      <span style="font-size: 20px; margin-right: 12px;">📚</span>
                      <span style="color: #1e293b; font-weight: 500;">Νέα προγράμματα και μαθήματα</span>
                    </div>
                    <div style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #CE3B49;">
                      <span style="font-size: 20px; margin-right: 12px;">💡</span>
                      <span style="color: #1e293b; font-weight: 500;">Συμβουλές μελέτης και εξετάσεων</span>
                    </div>
                    <div style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #E7B109;">
                      <span style="font-size: 20px; margin-right: 12px;">🎉</span>
                      <span style="color: #1e293b; font-weight: 500;">Ειδικές προσφορές και εκδηλώσεις</span>
                    </div>
                    <div style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #CE3B49;">
                      <span style="font-size: 20px; margin-right: 12px;">📢</span>
                      <span style="color: #1e293b; font-weight: 500;">Ενημερώσεις για τις εξετάσεις</span>
                    </div>
                  </div>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                     style="display: inline-block; background: linear-gradient(135deg, #CE3B49, #FF6B6B); color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 59, 73, 0.3); transition: all 0.3s ease;">
                    🌐 Επισκεφτείτε τον Ιστότοπό μας
                  </a>
                </div>

                <!-- Unsubscribe Notice -->
                <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center;">
                  <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                    Αν δεν επιθυμείτε να λαμβάνετε αυτά τα emails, μπορείτε να 
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${email}" 
                       style="color: #CE3B49; font-weight: 600; text-decoration: none;">απεγγραφείτε εδώ</a>.
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div style="background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 30px; text-align: center; border-radius: 0 0 16px 16px;">
                <div style="margin-bottom: 20px;">
                  <div style="display: inline-block; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 12px; margin-bottom: 15px;">
                    <div style="width: 40px; height: 40px; background: linear-gradient(45deg, #E7B109, #D97706); border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: white;">
                      Κ
                    </div>
                  </div>
                  <h4 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700;">ΚΥΚΛΟΣ Φροντιστήριο</h4>
                  <p style="margin: 0; font-size: 14px; color: #cbd5e1; font-weight: 500;">
                    Βασιλέως Κωνσταντίνου 42, Άρτα<br>
                    📞 +30 26810 26671 | 🌐 kyklosedu.gr
                  </p>
                </div>
                
                <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;">
                  <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                    © 2024 ΚΥΚΛΟΣ Φροντιστήριο. Όλα τα δικαιώματα διατηρούνται.
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${email}`);
    } catch (error) {
      console.error('Welcome email error:', error);
    }
  }

  // Send newsletter to all subscribers
  async sendNewsletterToAll(subject, content, featuredImage = null) {
    try {
      const subscribers = await NewsletterModel.find({ isActive: true });
      
      if (subscribers.length === 0) {
        return { success: false, message: 'No active subscribers found' };
      }

      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      for (const subscriber of subscribers) {
        try {
          await this.sendNewsletterEmail(subscriber.email, subject, content, featuredImage);
          results.sent++;
        } catch (error) {
          results.failed++;
          results.errors.push({ email: subscriber.email, error: error.message });
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error('Newsletter broadcast error:', error);
      return { success: false, message: 'Newsletter broadcast failed' };
    }
  }

  // Send individual newsletter email
  async sendNewsletterEmail(email, subject, content, featuredImage = null) {
    if (!this.transporter) {
      console.log('⚠️  Email service not configured - skipping newsletter email');
      return;
    }
    
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'grkyklos-@hotmail.gr',
        to: email,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #E7B109, #D97706); padding: 20px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 24px;">ΚΥΚΛΟΣ Φροντιστήριο</h1>
            </div>
            ${featuredImage ? `<div style="text-align: center; padding: 20px 0;"><img src="${featuredImage}" alt="Featured" style="max-width: 100%; height: auto; border-radius: 8px;"></div>` : ''}
            <div style="padding: 30px; background: #f8f9fa;">
              <div style="color: #333; line-height: 1.6;">
                ${content}
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                   style="background: linear-gradient(135deg, #E7B109, #D97706); color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Δείτε περισσότερα
                </a>
              </div>
            </div>
            <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${email}" 
                   style="color: #E7B109;">Απεγγραφή</a> | 
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/contact" 
                   style="color: #E7B109;">Επικοινωνία</a>
              </p>
            </div>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Newsletter email error:', error);
      throw error;
    }
  }

  // Get subscriber statistics
  async getSubscriberStats() {
    try {
      const cacheKey = 'newsletter:stats';
      let stats = await cache.get(cacheKey);
      
      if (!stats) {
        const total = await NewsletterModel.count();
        const active = await NewsletterModel.count({ isActive: true });
        const inactive = total - active;
        const thisMonth = await NewsletterModel.count({
          subscribedAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          isActive: true
        });

        stats = {
          total,
          active,
          inactive,
          thisMonth,
          lastUpdated: new Date()
        };

        await cache.set(cacheKey, stats, 300); // Cache for 5 minutes
      }

      return stats;
    } catch (error) {
      console.error('Subscriber stats error:', error);
      return null;
    }
  }

  // Send contact form email
  async sendContactForm({ name, email, phone, subject, message }) {
    if (!this.transporter) {
      console.log('⚠️  Email service not configured - skipping contact form email');
      return { success: false, message: 'Email service not available' };
    }
    
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'grkyklos-@hotmail.gr',
        to: process.env.CONTACT_EMAIL || process.env.EMAIL_USER,
        subject: `🌐 Νέο μήνυμα από την ιστοσελίδα: ${subject}`,
        html: `
          <!DOCTYPE html>
          <html lang="el">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Νέο Μήνυμα Επικοινωνίας - ΚΥΚΛΟΣ Φροντιστήριο</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
              
              <!-- Header with Logo and Branding -->
              <div style="background: linear-gradient(135deg, #0f172a 0%, #1f2937 50%, #E7B109 100%); padding: 40px 30px; text-align: center; position: relative; overflow: hidden;">
                <!-- Decorative Elements -->
                <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
                <div style="position: absolute; bottom: -30px; left: -30px; width: 80px; height: 80px; background: rgba(231, 177, 9, 0.2); border-radius: 50%;"></div>
                
                <!-- Logo Area -->
                <div style="position: relative; z-index: 2;">
                  <div style="display: inline-block; background: rgba(255,255,255,0.15); padding: 20px; border-radius: 20px; margin-bottom: 20px; backdrop-filter: blur(10px);">
                    <div style="width: 60px; height: 60px; background: linear-gradient(45deg, #E7B109, #D97706); border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                      Κ
                    </div>
                  </div>
                  <h1 style="margin: 0; font-size: 32px; font-weight: 800; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.3); letter-spacing: 1px;">
                    ΚΥΚΛΟΣ Φροντιστήριο
                  </h1>
                  <p style="margin: 8px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 500;">
                    Εξειδικευμένο Φροντιστήριο για Γυμνάσιο & Λύκειο
                  </p>
                </div>
              </div>

              <!-- Main Content -->
              <div style="padding: 40px 30px;">
                <!-- Alert Badge -->
                <div style="background: linear-gradient(135deg, #CE3B49, #FF6B6B); color: white; padding: 12px 20px; border-radius: 12px; margin-bottom: 30px; text-align: center; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 59, 73, 0.3);">
                  🔔 Νέο Μήνυμα Επικοινωνίας
                </div>

                <!-- Contact Details Card -->
                <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 16px; padding: 25px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                  <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 20px; font-weight: 700; display: flex; align-items: center;">
                    <span style="background: linear-gradient(135deg, #CE3B49, #FF6B6B); color: white; width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; margin-right: 12px; font-size: 16px;">👤</span>
                    Στοιχεία Επικοινωνίας
                  </h2>
                  
                  <div style="display: grid; gap: 15px;">
                    <div style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #E7B109;">
                      <span style="font-weight: 600; color: #64748b; min-width: 80px; font-size: 14px;">Όνομα:</span>
                      <span style="color: #1e293b; font-weight: 500;">${name}</span>
                    </div>
                    <div style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #CE3B49;">
                      <span style="font-weight: 600; color: #64748b; min-width: 80px; font-size: 14px;">Email:</span>
                      <a href="mailto:${email}" style="color: #CE3B49; font-weight: 500; text-decoration: none;">${email}</a>
                    </div>
                    <div style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #E7B109;">
                      <span style="font-weight: 600; color: #64748b; min-width: 80px; font-size: 14px;">Τηλέφωνο:</span>
                      <a href="tel:${phone}" style="color: #1e293b; font-weight: 500; text-decoration: none;">${phone}</a>
                    </div>
                    <div style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #CE3B49;">
                      <span style="font-weight: 600; color: #64748b; min-width: 80px; font-size: 14px;">Θέμα:</span>
                      <span style="color: #1e293b; font-weight: 500;">${subject}</span>
                    </div>
                  </div>
                </div>

                <!-- Message Card -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 25px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                  <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px; font-weight: 700; display: flex; align-items: center;">
                    <span style="background: linear-gradient(135deg, #CE3B49, #FF6B6B); color: white; width: 28px; height: 28px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 14px;">💬</span>
                    Μήνυμα
                  </h3>
                  <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #CE3B49;">
                    <p style="margin: 0; color: #374151; line-height: 1.7; white-space: pre-wrap; font-size: 15px;">${message}</p>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div style="text-align: center; margin: 30px 0;">
                  <a href="mailto:${email}?subject=Re: ${subject}" 
                     style="display: inline-block; background: linear-gradient(135deg, #CE3B49, #FF6B6B); color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 59, 73, 0.3); transition: all 0.3s ease; margin-right: 12px;">
                    📧 Απάντηση στο Email
                  </a>
                  <a href="tel:+302681026671" 
                     style="display: inline-block; background: linear-gradient(135deg, #E7B109, #D97706); color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(231, 177, 9, 0.3); transition: all 0.3s ease;">
                    📞 Καλέστε μας
                  </a>
                </div>
              </div>

              <!-- Footer -->
              <div style="background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 30px; text-align: center; border-radius: 0 0 16px 16px;">
                <div style="margin-bottom: 20px;">
                  <div style="display: inline-block; background: rgba(255,255,255,0.1); padding: 12px; border-radius: 12px; margin-bottom: 15px;">
                    <div style="width: 40px; height: 40px; background: linear-gradient(45deg, #E7B109, #D97706); border-radius: 50%; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: white;">
                      Κ
                    </div>
                  </div>
                  <h4 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700;">ΚΥΚΛΟΣ Φροντιστήριο</h4>
                  <p style="margin: 0; font-size: 14px; color: #cbd5e1; font-weight: 500;">
                    Βασιλέως Κωνσταντίνου 42, Άρτα<br>
                    📞 +30 26810 26671 | 🌐 kyklosedu.gr
                  </p>
                </div>
                
                <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;">
                  <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">
                    Ώρα αποστολής: ${new Date().toLocaleString('el-GR', { timeZone: 'Europe/Athens' })}
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                    Αυτό το μήνυμα στάλθηκε από την ιστοσελίδα του ΚΥΚΛΟΣ Φροντιστήριο
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Contact form email sent from ${email}`);
      return { success: true, message: 'Contact form submitted successfully' };
    } catch (error) {
      console.error('Contact form email error:', error);
      return { success: false, message: 'Failed to send contact form' };
    }
  }

  // Export subscribers (for admin use)
  async exportSubscribers(format = 'json') {
    try {
      const subscribers = await Newsletter.find({ isActive: true })
        .select('email name subscribedAt source')
        .sort({ subscribedAt: -1 });

      if (format === 'csv') {
        const csv = [
          'Email,Name,Subscribed At,Source',
          ...subscribers.map(sub => 
            `"${sub.email}","${sub.name || ''}","${sub.subscribedAt.toISOString()}","${sub.source}"`
          )
        ].join('\n');
        return csv;
      }

      return subscribers;
    } catch (error) {
      console.error('Export subscribers error:', error);
      return null;
    }
  }
}

module.exports = new EmailService();

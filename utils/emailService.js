const nodemailer = require('nodemailer');
const Newsletter = require('../models/Newsletter');
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
      const existing = await Newsletter.findOne({ email: email.toLowerCase() });
      
      if (existing) {
        if (existing.isActive) {
          return { success: false, message: 'Email already subscribed' };
        } else {
          // Reactivate subscription
          existing.isActive = true;
          existing.subscribedAt = new Date();
          existing.unsubscribedAt = null;
          await existing.save();
          
          // Clear cache
          await cache.delPattern('newsletter:*');
          
          return { success: true, message: 'Email reactivated successfully' };
        }
      }

      // Create new subscription
      const subscriber = new Newsletter({
        email: email.toLowerCase(),
        name: name.trim(),
        source: source,
        isActive: true
      });

      await subscriber.save();

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
      const subscriber = await Newsletter.findOne({ 
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
        from: process.env.EMAIL_FROM || 'noreply@kyklosedu.gr',
        to: email,
        subject: 'Καλώς ήρθατε στο ΚΥΚΛΟΣ Φροντιστήριο!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #E7B109, #D97706); padding: 30px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 28px;">Καλώς ήρθατε!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Στο ΚΥΚΛΟΣ Φροντιστήριο</p>
            </div>
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-bottom: 20px;">Αγαπητέ/ή ${name || 'Φίλε/η'},</h2>
              <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                Ευχαριστούμε που εγγραφήκατε στο newsletter μας! Θα λαμβάνετε τακτικά ενημερώσεις για:
              </p>
              <ul style="color: #666; line-height: 1.8; margin-bottom: 30px;">
                <li>Νέα προγράμματα και μαθήματα</li>
                <li>Συμβουλές μελέτης και εξετάσεων</li>
                <li>Ειδικές προσφορές και εκδηλώσεις</li>
                <li>Ενημερώσεις για τις εξετάσεις</li>
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                   style="background: linear-gradient(135deg, #E7B109, #D97706); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Επισκεφτείτε τον Ιστότοπό μας
                </a>
              </div>
              <p style="color: #999; font-size: 14px; margin-top: 30px; text-align: center;">
                Αν δεν επιθυμείτε να λαμβάνετε αυτά τα emails, μπορείτε να 
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/unsubscribe?email=${email}" 
                   style="color: #E7B109;">απεγγραφείτε εδώ</a>.
              </p>
            </div>
            <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 14px;">
              <p style="margin: 0;">© 2024 ΚΥΚΛΟΣ Φροντιστήριο. Όλα τα δικαιώματα διατηρούνται.</p>
            </div>
          </div>
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
      const subscribers = await Newsletter.find({ isActive: true });
      
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
        from: process.env.EMAIL_FROM || 'noreply@kyklosedu.gr',
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
        const total = await Newsletter.countDocuments();
        const active = await Newsletter.countDocuments({ isActive: true });
        const inactive = total - active;
        const thisMonth = await Newsletter.countDocuments({
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

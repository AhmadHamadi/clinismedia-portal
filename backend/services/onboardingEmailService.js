const EmailNotificationSettings = require('../models/EmailNotificationSettings');
const EmailService = require('./emailService');

class OnboardingEmailService {
  // Helper function to replace template variables
  static replaceTemplateVariables(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value || '');
    }
    return result;
  }

  // Send onboarding task created email
  static async sendTaskCreatedEmail(customer, task) {
    try {
      const setting = await EmailNotificationSettings.findOne({ 
        notificationType: 'onboarding_task_created',
        isEnabled: true 
      });

      if (!setting) {
        console.log('Onboarding task created email notification is disabled');
        return;
      }

      const variables = {
        clinicName: customer.name,
        taskName: task.title,
        taskDescription: task.description,
        dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'
      };

      const subject = this.replaceTemplateVariables(setting.subject, variables);
      const content = this.replaceTemplateVariables(setting.template, variables);

      await EmailService.sendEmail(
        subject,
        content,
        customer.email,
        'Failed to send onboarding task created email:'
      );

      console.log(`✅ Onboarding task created email sent to ${customer.name}`);
    } catch (error) {
      console.error('❌ Error sending onboarding task created email:', error);
    }
  }

  // Send onboarding task pending email
  static async sendTaskPendingEmail(customer, task) {
    try {
      const setting = await EmailNotificationSettings.findOne({ 
        notificationType: 'onboarding_task_pending',
        isEnabled: true 
      });

      if (!setting) {
        console.log('Onboarding task pending email notification is disabled');
        return;
      }

      const variables = {
        clinicName: customer.name,
        taskName: task.title,
        submittedDate: new Date().toLocaleDateString()
      };

      const subject = this.replaceTemplateVariables(setting.subject, variables);
      const content = this.replaceTemplateVariables(setting.template, variables);

      await EmailService.sendEmail(
        subject,
        content,
        customer.email,
        'Failed to send onboarding task pending email:'
      );

      console.log(`✅ Onboarding task pending email sent to ${customer.name}`);
    } catch (error) {
      console.error('❌ Error sending onboarding task pending email:', error);
    }
  }

  // Send onboarding task completed email
  static async sendTaskCompletedEmail(customer, task) {
    try {
      const setting = await EmailNotificationSettings.findOne({ 
        notificationType: 'onboarding_task_completed',
        isEnabled: true 
      });

      if (!setting) {
        console.log('Onboarding task completed email notification is disabled');
        return;
      }

      const variables = {
        clinicName: customer.name,
        taskName: task.title,
        completedDate: new Date().toLocaleDateString()
      };

      const subject = this.replaceTemplateVariables(setting.subject, variables);
      const content = this.replaceTemplateVariables(setting.template, variables);

      await EmailService.sendEmail(
        subject,
        content,
        customer.email,
        'Failed to send onboarding task completed email:'
      );

      console.log(`✅ Onboarding task completed email sent to ${customer.name}`);
    } catch (error) {
      console.error('❌ Error sending onboarding task completed email:', error);
    }
  }
}

module.exports = OnboardingEmailService; 
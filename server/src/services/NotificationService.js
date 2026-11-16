/*
 * NotificationService: Assignment 3, Figure 2.  Application layer.
 *
 * Attributes:  smtpHost
 * Operations:  sendInvitation(inv), sendReminder(u, a)
 *
 * Realises FR 26 and FR 32.  Invitation 0..* --- 1 NotificationService.
 *
 * STATUS: not fully implemented.
 * Assignment 3 isolates the mail server behind this one class, so nothing else
 * in the system knows how email is sent. Without SMTP credentials the methods
 * record the message and log it instead of delivering it. Wiring in a real
 * transport (nodemailer) means changing only this file.
 */

export class NotificationService {
  constructor({ smtpHost = process.env.SMTP_HOST || "not-configured" } = {}) {
    this.smtpHost = smtpHost;
    this.outbox = []; // what would have been sent; lets the UI and tests see it
  }

  get isConfigured() {
    return this.smtpHost !== "not-configured";
  }

  #record(message) {
    const entry = { ...message, sentAt: new Date(), delivered: this.isConfigured };
    this.outbox.push(entry);
    if (!this.isConfigured) {
      console.log(`[NotificationService] would email ${message.to}: ${message.subject}`);
    }
    return entry;
  }

  /* FR 26: email a study-group invitation. */
  async sendInvitation(inv) {
    return this.#record({
      to: inv.recipientEmail,
      subject: "You have been invited to a StudySync study group",
      body:
        `You have been invited to join a study group on StudySync.\n\n` +
        `This invitation expires on ${new Date(inv.expiresOn).toDateString()}.\n` +
        `Open StudySync and go to Invitations to accept or decline.`,
      invitationId: inv.inviteId,
    });
  }

  /* FR 32: email a deadline reminder. Optional feature (Could priority). */
  async sendReminder(u, a) {
    return this.#record({
      to: u.email,
      subject: `Reminder: "${a.title}" is due in ${a.daysRemaining()} day(s)`,
      body:
        `Hello ${u.name},\n\n` +
        `"${a.title}" is due on ${new Date(a.dueDate).toDateString()}.\n` +
        `Estimated effort remaining: ${a.estimatedHours} hour(s).`,
      taskId: a.taskId,
    });
  }
}

export default new NotificationService();

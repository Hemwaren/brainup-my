import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "BrainUp <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/* ─────────────────── shared styles ─────────────────── */
const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f0fdfa;
  margin: 0;
  padding: 0;
`;

const cardStyle = `
  max-width: 520px;
  margin: 40px auto;
  background: #ffffff;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,0.08);
`;

const headerStyle = `
  background: linear-gradient(135deg,#0d9488,#0891b2,#0369a1);
  padding: 32px 40px 28px;
  text-align: center;
`;

const bodyStyle = `
  padding: 36px 40px;
`;

const btnStyle = `
  display: inline-block;
  background: linear-gradient(135deg,#14b8a6,#22d3ee,#38bdf8);
  color: #ffffff !important;
  text-decoration: none;
  font-weight: 800;
  font-size: 15px;
  padding: 14px 36px;
  border-radius: 14px;
  margin: 24px 0 8px;
`;

const footerStyle = `
  padding: 20px 40px 32px;
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
`;

/* ═══════════════════════════════════════════════════
   1. EMAIL VERIFICATION
═══════════════════════════════════════════════════ */
export async function sendVerificationEmail(to: string, confirmUrl: string) {
  const html = `
    <body style="${baseStyle}">
      <div style="${cardStyle}">
        <div style="${headerStyle}">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <div style="width:42px;height:42px;background:rgba(255,255,255,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;">🧠</div>
            <span style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">BrainUp</span>
          </div>
          <p style="color:rgba(255,255,255,0.8);margin:10px 0 0;font-size:14px;">Emotional Intelligence Platform</p>
        </div>

        <div style="${bodyStyle}">
          <h1 style="font-size:24px;font-weight:900;color:#0f172a;margin:0 0 8px;">Verify your email ✅</h1>
          <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 4px;">
            Thanks for signing up! Click the button below to verify your email address and start your EI journey.
          </p>

          <div style="text-align:center;margin:28px 0;">
            <a href="${confirmUrl}" style="${btnStyle}">
              Verify Email Address →
            </a>
          </div>

          <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin-top:8px;">
            <p style="font-size:13px;color:#94a3b8;margin:0;">
              🔒 This link expires in <strong style="color:#64748b;">24 hours</strong>. 
              If you didn't create a BrainUp account, you can safely ignore this email.
            </p>
          </div>
        </div>

        <div style="${footerStyle}">
          <p style="margin:0;">© ${new Date().getFullYear()} BrainUp · Universiti Sains Malaysia</p>
          <p style="margin:6px 0 0;">Built for Malaysian SMEs 🇲🇾</p>
        </div>
      </div>
    </body>
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your BrainUp account ✅",
    html,
  });
}

/* ═══════════════════════════════════════════════════
   2. PASSWORD RESET
═══════════════════════════════════════════════════ */
export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const html = `
    <body style="${baseStyle}">
      <div style="${cardStyle}">
        <div style="${headerStyle}">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <div style="width:42px;height:42px;background:rgba(255,255,255,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;">🧠</div>
            <span style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">BrainUp</span>
          </div>
          <p style="color:rgba(255,255,255,0.8);margin:10px 0 0;font-size:14px;">Emotional Intelligence Platform</p>
        </div>

        <div style="${bodyStyle}">
          <h1 style="font-size:24px;font-weight:900;color:#0f172a;margin:0 0 8px;">Reset your password 🔑</h1>
          <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0;">
            We received a request to reset your BrainUp password. Click the button below to choose a new one.
          </p>

          <div style="text-align:center;margin:28px 0;">
            <a href="${resetUrl}" style="${btnStyle}">
              Reset My Password →
            </a>
          </div>

          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 20px;">
            <p style="font-size:13px;color:#92400e;margin:0;">
              ⚠️ This link expires in <strong>1 hour</strong>. 
              If you didn't request a password reset, please ignore this email — your account is safe.
            </p>
          </div>
        </div>

        <div style="${footerStyle}">
          <p style="margin:0;">© ${new Date().getFullYear()} BrainUp · Universiti Sains Malaysia</p>
          <p style="margin:6px 0 0;">Built for Malaysian SMEs 🇲🇾</p>
        </div>
      </div>
    </body>
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your BrainUp password 🔑",
    html,
  });
}

/* ═══════════════════════════════════════════════════
   3. WELCOME EMAIL (after signup)
═══════════════════════════════════════════════════ */
export async function sendWelcomeEmail(to: string, name: string, role: string) {
  const isHR = role?.toUpperCase() === "HR";

  const html = `
    <body style="${baseStyle}">
      <div style="${cardStyle}">
        <div style="${headerStyle}">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <div style="width:42px;height:42px;background:rgba(255,255,255,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;">🧠</div>
            <span style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">BrainUp</span>
          </div>
          <p style="color:rgba(255,255,255,0.8);margin:10px 0 0;font-size:14px;">Emotional Intelligence Platform</p>
        </div>

        <div style="${bodyStyle}">
          <h1 style="font-size:24px;font-weight:900;color:#0f172a;margin:0 0 8px;">
            Welcome to BrainUp, ${name}! 🎉
          </h1>
          <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 20px;">
            ${isHR
              ? "You've joined as an <strong>HR Manager</strong>. You can now monitor team wellbeing, view emotion insights, and schedule consultations."
              : "Your emotional intelligence journey starts today. Complete your first check-in and earn your first XP!"
            }
          </p>

          <!-- Feature highlights -->
          <div style="background:#f8fafc;border-radius:16px;padding:20px 24px;margin-bottom:24px;">
            <p style="font-size:13px;font-weight:800;color:#0f172a;margin:0 0 14px;text-transform:uppercase;letter-spacing:0.5px;">
              What you can do on BrainUp
            </p>
            ${isHR ? `
              <div style="display:flex;gap:10px;margin-bottom:10px;">
                <span style="font-size:16px;">📊</span>
                <span style="font-size:14px;color:#475569;">View real-time team emotion dashboard</span>
              </div>
              <div style="display:flex;gap:10px;margin-bottom:10px;">
                <span style="font-size:16px;">🚩</span>
                <span style="font-size:14px;color:#475569;">Get alerted when employees need support</span>
              </div>
              <div style="display:flex;gap:10px;">
                <span style="font-size:16px;">📅</span>
                <span style="font-size:14px;color:#475569;">Schedule HRBP consultation sessions</span>
              </div>
            ` : `
              <div style="display:flex;gap:10px;margin-bottom:10px;">
                <span style="font-size:16px;">🧘</span>
                <span style="font-size:14px;color:#475569;">Daily emotion check-ins & journaling</span>
              </div>
              <div style="display:flex;gap:10px;margin-bottom:10px;">
                <span style="font-size:16px;">🏆</span>
                <span style="font-size:14px;color:#475569;">Earn XP, badges and level up your EI</span>
              </div>
              <div style="display:flex;gap:10px;">
                <span style="font-size:16px;">📚</span>
                <span style="font-size:14px;color:#475569;">Access curated EI learning resources</span>
              </div>
            `}
          </div>

          <div style="text-align:center;">
            <a href="${APP_URL}/auth" style="${btnStyle}">
              Start Your Journey →
            </a>
          </div>
        </div>

        <div style="${footerStyle}">
          <p style="margin:0;">© ${new Date().getFullYear()} BrainUp · Universiti Sains Malaysia</p>
          <p style="margin:6px 0 0;">Built for Malaysian SMEs 🇲🇾</p>
        </div>
      </div>
    </body>
  `;

  return resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to BrainUp, ${name}! 🎉`,
    html,
  });
}

/* ═══════════════════════════════════════════════════
   4. HR FLAGGED EMPLOYEE ALERT
═══════════════════════════════════════════════════ */
export async function sendFlaggedAlert(
  hrEmail: string,
  hrName: string,
  employeeName: string,
  department: string,
  flagCount: number
) {
  const html = `
    <body style="${baseStyle}">
      <div style="${cardStyle}">
        <div style="background:linear-gradient(135deg,#7f1d1d,#b91c1c,#dc2626);padding:32px 40px 28px;text-align:center;">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <div style="width:42px;height:42px;background:rgba(255,255,255,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;">🧠</div>
            <span style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">BrainUp</span>
          </div>
          <p style="color:rgba(255,255,255,0.8);margin:10px 0 0;font-size:14px;">Employee Wellbeing Alert</p>
        </div>

        <div style="${bodyStyle}">
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:14px;padding:18px 22px;margin-bottom:24px;">
            <p style="font-size:13px;font-weight:800;color:#dc2626;margin:0 0 4px;">⚠️ WELLBEING ALERT</p>
            <p style="font-size:13px;color:#b91c1c;margin:0;">An employee in your department may need your support.</p>
          </div>

          <h1 style="font-size:22px;font-weight:900;color:#0f172a;margin:0 0 8px;">Hi ${hrName},</h1>
          <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 20px;">
            <strong style="color:#0f172a;">${employeeName}</strong> from the 
            <strong style="color:#0f172a;">${department}</strong> department has logged a 
            very low emotion score <strong style="color:#dc2626;">${flagCount} times</strong> in the past 7 days.
          </p>

          <div style="background:#f8fafc;border-radius:14px;padding:18px 22px;margin-bottom:24px;">
            <p style="font-size:13px;font-weight:800;color:#0f172a;margin:0 0 12px;">Suggested next steps:</p>
            <div style="font-size:13px;color:#475569;line-height:1.8;">
              <div>✅ Reach out to the employee for a check-in conversation</div>
              <div>✅ Schedule an HRBP consultation session</div>
              <div>✅ Review their recent emotion trend on your HR dashboard</div>
            </div>
          </div>

          <div style="text-align:center;">
            <a href="${APP_URL}/hr/dashboard" style="${btnStyle}">
              View HR Dashboard →
            </a>
          </div>
        </div>

        <div style="${footerStyle}">
          <p style="margin:0;">© ${new Date().getFullYear()} BrainUp · Universiti Sains Malaysia</p>
          <p style="margin:6px 0 0;">Built for Malaysian SMEs 🇲🇾</p>
        </div>
      </div>
    </body>
  `;

  return resend.emails.send({
    from: FROM,
    to: hrEmail,
    subject: `⚠️ Wellbeing Alert — ${employeeName} needs attention`,
    html,
  });
}

/* ═══════════════════════════════════════════════════
   5. CONSULTATION SCHEDULED
═══════════════════════════════════════════════════ */
export async function sendConsultationEmail(
  employeeEmail: string,
  employeeName: string,
  date: string,
  time: string,
  notes?: string
) {
  const html = `
    <body style="${baseStyle}">
      <div style="${cardStyle}">
        <div style="${headerStyle}">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <div style="width:42px;height:42px;background:rgba(255,255,255,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;">🧠</div>
            <span style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">BrainUp</span>
          </div>
          <p style="color:rgba(255,255,255,0.8);margin:10px 0 0;font-size:14px;">HRBP Consultation Scheduled</p>
        </div>

        <div style="${bodyStyle}">
          <h1 style="font-size:22px;font-weight:900;color:#0f172a;margin:0 0 8px;">
            Your consultation is confirmed 📅
          </h1>
          <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
            Hi <strong style="color:#0f172a;">${employeeName}</strong>, your HR consultation has been scheduled. Here are the details:
          </p>

          <!-- Session details card -->
          <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:16px;padding:22px 26px;margin-bottom:24px;">
            <div style="display:flex;gap:14px;margin-bottom:14px;">
              <span style="font-size:20px;">📆</span>
              <div>
                <p style="font-size:12px;font-weight:700;color:#0d9488;margin:0;text-transform:uppercase;letter-spacing:0.5px;">Date</p>
                <p style="font-size:15px;font-weight:800;color:#0f172a;margin:2px 0 0;">${date}</p>
              </div>
            </div>
            <div style="display:flex;gap:14px;margin-bottom:${notes ? "14px" : "0"};">
              <span style="font-size:20px;">⏰</span>
              <div>
                <p style="font-size:12px;font-weight:700;color:#0d9488;margin:0;text-transform:uppercase;letter-spacing:0.5px;">Time</p>
                <p style="font-size:15px;font-weight:800;color:#0f172a;margin:2px 0 0;">${time}</p>
              </div>
            </div>
            ${notes ? `
            <div style="display:flex;gap:14px;">
              <span style="font-size:20px;">📝</span>
              <div>
                <p style="font-size:12px;font-weight:700;color:#0d9488;margin:0;text-transform:uppercase;letter-spacing:0.5px;">Notes</p>
                <p style="font-size:14px;color:#475569;margin:2px 0 0;">${notes}</p>
              </div>
            </div>
            ` : ""}
          </div>

          <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 20px;">
            This session is a safe space to share how you've been feeling. Your wellbeing matters to us. 💙
          </p>

          <div style="text-align:center;">
            <a href="${APP_URL}/post-login" style="${btnStyle}">
              Open BrainUp →
            </a>
          </div>
        </div>

        <div style="${footerStyle}">
          <p style="margin:0;">© ${new Date().getFullYear()} BrainUp · Universiti Sains Malaysia</p>
          <p style="margin:6px 0 0;">Built for Malaysian SMEs 🇲🇾</p>
        </div>
      </div>
    </body>
  `;

  return resend.emails.send({
    from: FROM,
    to: employeeEmail,
    subject: `Your HRBP consultation is scheduled for ${date} 📅`,
    html,
  });
}
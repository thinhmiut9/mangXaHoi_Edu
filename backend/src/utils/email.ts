import nodemailer from 'nodemailer'
import { env } from '../config/env'

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
})

interface SendMailOptions {
  to: string
  subject: string
  html: string
}

export async function sendMail({ to, subject, html }: SendMailOptions): Promise<void> {
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
  })
}

export function resetPasswordTemplate(displayName: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đặt lại mật khẩu - EduSocial</title>
</head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1877F2;padding:32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">EduSocial</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Mạng xã hội giáo dục</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 16px;color:#1C1E21;font-size:20px;font-weight:600;">Xin chào, ${displayName}!</h2>
              <p style="margin:0 0 24px;color:#65676B;font-size:14px;line-height:1.6;">
                Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản EduSocial của bạn.
                Nhấn nút bên dưới để đặt lại mật khẩu mới.
              </p>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display:inline-block;background:#1877F2;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
                      Đặt lại mật khẩu
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;color:#65676B;font-size:13px;line-height:1.6;">
                Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Liên kết này sẽ hết hạn sau <strong>1 giờ</strong>.
              </p>
              <p style="margin:0;color:#8A8D91;font-size:12px;">
                Hoặc copy link này vào trình duyệt:<br>
                <span style="color:#1877F2;word-break:break-all;">${resetUrl}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #E4E6EB;text-align:center;">
              <p style="margin:0;color:#8A8D91;font-size:12px;">&copy; 2024 EduSocial. Tất cả quyền được bảo lưu.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export function welcomeTemplate(displayName: string): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Chào mừng đến EduSocial!</title>
</head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Inter,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1877F2;padding:32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">EduSocial</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px;">
              <h2 style="margin:0 0 12px;color:#1C1E21;font-size:20px;">Chào mừng ${displayName}! 🎉</h2>
              <p style="margin:0;color:#65676B;font-size:14px;line-height:1.6;">
                Tài khoản EduSocial của bạn đã được tạo thành công. Hãy bắt đầu kết nối với bạn bè và tham gia các nhóm học tập!
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #E4E6EB;text-align:center;">
              <p style="margin:0;color:#8A8D91;font-size:12px;">&copy; 2024 EduSocial.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

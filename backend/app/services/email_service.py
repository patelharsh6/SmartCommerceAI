import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import os
from dotenv import load_dotenv

load_dotenv()

def send_email(to_email, subject, otp):
    smtp_server = os.getenv("SMTP_SERVER", "smtp-relay.brevo.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_login = os.getenv("SMTP_LOGIN")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_email = os.getenv("SMTP_EMAIL")

    # ✅ HTML EMAIL TEMPLATE
    html_body = f"""
    <html>
    <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif;">
        
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center">
                    
                    <table width="500px" style="background:#ffffff; margin-top:40px; border-radius:10px; padding:30px;">
                        
                        <!-- HEADER -->
                        <tr>
                            <td align="center">
                                <h2 style="color:#4f46e5; margin-bottom:10px;">
                                    SmartCommerceAI
                                </h2>
                                <p style="color:#666;">Email Verification</p>
                            </td>
                        </tr>

                        <!-- MESSAGE -->
                        <tr>
                            <td style="padding:20px 0; text-align:center;">
                                <p style="font-size:16px; color:#333;">
                                    Your OTP code is:
                                </p>

                                <!-- OTP BOX -->
                                <div style="
                                    font-size:28px;
                                    font-weight:bold;
                                    letter-spacing:4px;
                                    color:#111;
                                    background:#f1f5ff;
                                    padding:15px 25px;
                                    display:inline-block;
                                    border-radius:8px;
                                    margin:10px 0;
                                ">
                                    {otp}
                                </div>

                                <p style="font-size:13px; color:#777;">
                                    This OTP is valid for 5 minutes.
                                </p>
                            </td>
                        </tr>

                        <!-- FOOTER -->
                        <tr>
                            <td style="text-align:center; padding-top:20px;">
                                <p style="font-size:12px; color:#aaa;">
                                    If you didn’t request this, you can ignore this email.
                                </p>
                                <p style="font-size:12px; color:#aaa;">
                                    © 2026 SmartCommerceAI
                                </p>
                            </td>
                        </tr>

                    </table>

                </td>
            </tr>
        </table>

    </body>
    </html>
    """

    # ✅ MULTIPART MESSAGE
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"SmartCommerceAI <{smtp_email}>"
    msg["To"] = to_email

    msg.attach(MIMEText(html_body, "html"))

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_login, smtp_password)

        server.sendmail(
            smtp_email,
            [to_email],
            msg.as_string()
        )

        server.quit()
        print(f"✅ Styled OTP sent to {to_email}")

    except Exception as e:
        print(f"❌ SMTP Error: {str(e)}")
        raise e
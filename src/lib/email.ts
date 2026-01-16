import nodemailer from 'nodemailer'

// 建立 email transporter
// 預設使用 ethereal.email 測試服務，生產環境請替換為實際 SMTP 設定
const createTransporter = () => {
  // 如果有環境變數，使用正式 SMTP
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  // 開發環境：使用 ethereal.email 測試
  // 注意：需要先建立帳號，或者使用 console 輸出
  return null
}

// 產生隨機密碼（符合規則：8字元以上、大小寫、數字）
export function generateRandomPassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const allChars = uppercase + lowercase + numbers

  let password = ''

  // 確保至少有一個大寫、一個小寫、一個數字
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]

  // 填滿剩餘長度
  for (let i = 3; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // 打亂密碼順序
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

interface SendPasswordEmailParams {
  to: string
  employeeName: string
  employeeNo: string
  password: string
  companyName: string
}

// 發送密碼通知信
export async function sendPasswordEmail({
  to,
  employeeName,
  employeeNo,
  password,
  companyName,
}: SendPasswordEmailParams): Promise<{ success: boolean; previewUrl?: string }> {
  const transporter = createTransporter()

  const subject = `[${companyName}] 您的系統帳號已建立`
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">歡迎加入 ${companyName}</h2>
      <p>親愛的 ${employeeName} 您好，</p>
      <p>您的系統帳號已建立完成，以下是您的登入資訊：</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>員工編號：</strong>${employeeNo}</p>
        <p style="margin: 5px 0;"><strong>登入帳號（Email）：</strong>${to}</p>
        <p style="margin: 5px 0;"><strong>初始密碼：</strong><code style="background: #fff; padding: 4px 8px; border-radius: 4px;">${password}</code></p>
      </div>
      <p style="color: #e74c3c;"><strong>安全提醒：</strong>請於首次登入後立即變更密碼。</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">此為系統自動發送，請勿直接回覆此郵件。</p>
    </div>
  `

  const text = `
歡迎加入 ${companyName}

親愛的 ${employeeName} 您好，

您的系統帳號已建立完成，以下是您的登入資訊：

員工編號：${employeeNo}
登入帳號（Email）：${to}
初始密碼：${password}

安全提醒：請於首次登入後立即變更密碼。

此為系統自動發送，請勿直接回覆此郵件。
  `

  // 如果沒有設定 SMTP，在開發環境輸出到 console
  if (!transporter) {
    console.log('\n========== 密碼通知信（開發模式）==========')
    console.log(`收件者: ${to}`)
    console.log(`主旨: ${subject}`)
    console.log(`內容:\n${text}`)
    console.log('==========================================\n')
    return { success: true }
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'no-reply@example.com',
      to,
      subject,
      text,
      html,
    })

    // nodemailer 回傳 preview URL（若使用 ethereal）
    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined

    return { success: true, previewUrl: previewUrl ? String(previewUrl) : undefined }
  } catch (error) {
    console.error('發送 Email 失敗:', error)
    return { success: false }
  }
}

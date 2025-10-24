// Email module - WILL NOT BE EXECUTED (dead code)

export async function sendEmail(to, subject) {
  // Simulate sending email
  await new Promise(resolve => setTimeout(resolve, 200));
  
  console.log(`📧 Email sent to ${to}: ${subject}`);
  
  return {
    success: true,
    messageId: Math.random().toString(36).substr(2, 9),
  };
}


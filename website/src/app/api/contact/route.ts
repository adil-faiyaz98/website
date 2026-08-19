import { NextRequest, NextResponse } from "next/server";

// Contact API endpoint - sends email to Adil Faiyaz
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, company, message } = body;

    // Validate required fields
    if (!name || !email || !company) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, company" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Build the email content
    const emailSubject = `Quebec Tax Calculator Inquiry from ${name} at ${company}`;
    const emailBody = `
New inquiry from Quebec Tax Calculator page:

Name: ${name}
Email: ${email}
Company: ${company}

Message:
${message || "No message provided"}

---
This email was sent from the SDA website contact form.
    `.trim();

    // Option 1: Use mailto link (client-side fallback in frontend)
    // Option 2: Use a service like Resend, SendGrid, or AWS SES
    // For production, configure one of these services:
    
    // Example with Resend (recommended for Next.js):
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: "noreply@consultsda.com",
    //   to: "adil.faiyaz@consultsda.com",
    //   subject: emailSubject,
    //   text: emailBody,
    //   replyTo: email,
    // });

    // For now, log the contact and return success
    // In production, replace with actual email sending
    console.log("Contact form submission:", {
      to: "adil.faiyaz@consultsda.com",
      subject: emailSubject,
      body: emailBody,
      replyTo: email,
    });

    // Return success with mailto fallback for immediate action
    const mailtoLink = `mailto:adil.faiyaz@consultsda.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    return NextResponse.json({
      success: true,
      message: "Contact form submitted successfully",
      mailtoLink, // Frontend can use this as fallback
    });

  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "Failed to process contact form" },
      { status: 500 }
    );
  }
}

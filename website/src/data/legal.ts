/**
 * Legal content data for Privacy Policy, Terms of Service, and Cookie Policy pages.
 * Each legal page contains structured sections with headings and content.
 */

export interface LegalSection {
  heading: string;
  content: string;
}

export interface LegalPage {
  slug: "privacy" | "terms" | "cookies";
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
}

export const privacyPolicy: LegalPage = {
  slug: "privacy",
  title: "Privacy Policy",
  lastUpdated: "2024-12-01",
  sections: [
    {
      heading: "Introduction",
      content:
        "SDA Migration WorkBench is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and share your personal information when you use our services and website.",
    },
    {
      heading: "Data Collection",
      content:
        "We collect information you provide directly, such as your name, email address, company name, and job title when you register for a demo, fill out a contact form, or subscribe to our newsletter. We also automatically collect technical data including IP address, browser type, device information, and usage analytics through cookies and similar technologies.",
    },
    {
      heading: "Data Usage",
      content:
        "We use your personal information to provide and improve our migration services, communicate with you about your account or inquiries, send relevant product updates and marketing communications (with your consent), analyze usage patterns to enhance user experience, and comply with legal obligations.",
    },
    {
      heading: "Data Storage and Security",
      content:
        "Your data is stored on secure servers within the European Economic Area (EEA). We implement industry-standard security measures including encryption in transit and at rest, access controls, and regular security audits. We retain your personal data only for as long as necessary to fulfill the purposes outlined in this policy or as required by law.",
    },
    {
      heading: "Data Sharing",
      content:
        "We do not sell your personal information. We may share data with trusted service providers who assist in delivering our services (such as cloud hosting, analytics, and email delivery), subject to strict data processing agreements. We may also disclose information when required by law or to protect our legal rights.",
    },
    {
      heading: "Your Rights",
      content:
        "You have the right to access, correct, or delete your personal data. You may also request data portability, restrict processing, or object to certain uses of your data. To exercise any of these rights, please contact us at privacy@sda-int.com. We will respond to your request within 30 days.",
    },
    {
      heading: "Changes to This Policy",
      content:
        "We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on our website or sending you an email. Your continued use of our services after changes take effect constitutes acceptance of the updated policy.",
    },
  ],
};

export const termsOfService: LegalPage = {
  slug: "terms",
  title: "Terms of Service",
  lastUpdated: "2024-12-01",
  sections: [
    {
      heading: "Service Description",
      content:
        "SDA Migration WorkBench provides automated migration tools and consulting services for transitioning SAP PI/PO integrations to modern platforms including Dell Boomi, Informatica IICS, and MuleSoft Anypoint. Our services include interface assessment, automated conversion, testing and validation, and deployment support.",
    },
    {
      heading: "Account and Access",
      content:
        "To access certain features of our services, you may be required to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information during registration and keep your account information up to date.",
    },
    {
      heading: "User Responsibilities",
      content:
        "You agree to use our services only for lawful purposes and in accordance with these Terms. You shall not: use the services to infringe on intellectual property rights; attempt to gain unauthorized access to our systems; interfere with the proper functioning of the services; or use the services to transmit harmful code or content. You are responsible for ensuring you have the necessary rights and licenses for any data you process through our platform.",
    },
    {
      heading: "Intellectual Property",
      content:
        "All content, software, and materials provided through SDA Migration WorkBench are protected by intellectual property laws. You retain ownership of your data and migration artifacts. We retain ownership of our tools, algorithms, and platform technology. You are granted a limited, non-exclusive license to use our services for the duration of your subscription.",
    },
    {
      heading: "Limitations of Liability",
      content:
        'SDA Migration WorkBench is provided on an "as is" basis. To the maximum extent permitted by law, we disclaim all warranties, express or implied. We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the services. Our total liability shall not exceed the fees paid by you in the twelve months preceding the claim.',
    },
    {
      heading: "Termination",
      content:
        "Either party may terminate this agreement with 30 days written notice. We may suspend or terminate your access immediately if you violate these Terms. Upon termination, your right to use the services ceases and we will provide a reasonable period to export your data.",
    },
    {
      heading: "Governing Law",
      content:
        "These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Germany. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of Frankfurt am Main, Germany.",
    },
    {
      heading: "Changes to Terms",
      content:
        "We reserve the right to modify these Terms at any time. Material changes will be communicated at least 30 days in advance via email or prominent notice on our website. Continued use of the services after the effective date constitutes acceptance of the modified Terms.",
    },
  ],
};

export const cookiePolicy: LegalPage = {
  slug: "cookies",
  title: "Cookie Policy",
  lastUpdated: "2024-12-01",
  sections: [
    {
      heading: "What Are Cookies",
      content:
        "Cookies are small text files stored on your device when you visit our website. They help us provide you with a better experience by remembering your preferences, understanding how you use our site, and enabling certain features to function properly.",
    },
    {
      heading: "Cookie Types We Use",
      content:
        "We use the following categories of cookies: Essential Cookies — required for the website to function (session management, security tokens, load balancing); Functional Cookies — remember your preferences such as language and display settings; Analytics Cookies — help us understand how visitors interact with our website by collecting anonymous usage data; Marketing Cookies — used to deliver relevant advertisements and track campaign performance across platforms.",
    },
    {
      heading: "Cookie Purposes",
      content:
        "Our cookies serve several purposes: ensuring website security and preventing fraud; maintaining your session state as you navigate between pages; remembering your display and accessibility preferences; measuring website traffic and user behavior patterns; improving our services based on aggregated usage insights; and personalizing content and communications.",
    },
    {
      heading: "Third-Party Cookies",
      content:
        "Some cookies on our site are placed by third-party services we use. These include: Google Analytics for website usage analysis; LinkedIn Insight Tag for professional audience targeting; HubSpot for marketing automation and form tracking. These third parties have their own privacy policies governing how they use the data collected through their cookies.",
    },
    {
      heading: "Cookie Duration",
      content:
        "Session cookies are temporary and are deleted when you close your browser. Persistent cookies remain on your device for a set period or until you delete them. Our analytics cookies expire after 12 months. Marketing cookies expire after 6 months. Functional preference cookies expire after 12 months.",
    },
    {
      heading: "Managing and Opting Out",
      content:
        "You can control cookies through your browser settings. Most browsers allow you to block or delete cookies, though this may affect website functionality. You can also manage your preferences through our cookie consent banner displayed on your first visit. To opt out of analytics tracking, you can use the Google Analytics Opt-out Browser Add-on. For marketing cookies, you can adjust your preferences in our cookie settings panel accessible from the footer.",
    },
    {
      heading: "Changes to This Policy",
      content:
        "We may update this Cookie Policy to reflect changes in our practices or for operational, legal, or regulatory reasons. We encourage you to review this page periodically for the latest information on our cookie practices.",
    },
  ],
};

export const legalPages: LegalPage[] = [
  privacyPolicy,
  termsOfService,
  cookiePolicy,
];

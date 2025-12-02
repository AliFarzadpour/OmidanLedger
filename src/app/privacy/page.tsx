'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4 md:p-8">
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
                <Logo />
            </div>
          <CardTitle className="text-3xl font-bold">Privacy Policy</CardTitle>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="space-y-6 text-sm md:text-base">
          <p>
            Welcome to FiscalFlow (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application. Please read this policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.
          </p>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">1. COLLECTION OF YOUR INFORMATION</h2>
            <p>
              We may collect information about you in a variety of ways. The information we may collect via the Application includes:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, that you voluntarily give to us when you register with the Application.</li>
              <li><strong>Financial Data from Plaid:</strong> We use Plaid Inc. (&quot;Plaid&quot;) to gather your data from financial institutions. By using our service, you grant us and Plaid the right, power, and authority to act on your behalf to access and transmit your personal and financial information from the relevant financial institution. You agree to your personal and financial information being transferred, stored, and processed by Plaid in accordance with the <a href="https://plaid.com/legal" target="_blank" rel="noopener noreferrer" className="text-primary underline">Plaid Privacy Policy</a>. This includes transaction history, account balances, and account details. We only store information necessary to provide our services, such as transaction descriptions, amounts, and dates. Sensitive information like account numbers and login credentials are not stored by us.</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">2. USE OF YOUR INFORMATION</h2>
            <p>
              Having accurate information permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Application to:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Create and manage your account.</li>
              <li>Process your transactions and automatically categorize them.</li>
              <li>Provide you with financial insights and reports.</li>
              <li>Email you regarding your account or order.</li>
              <li>Improve the efficiency and operation of the Application.</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">3. DISCLOSURE OF YOUR INFORMATION</h2>
            <p>
              We do not share, sell, rent, or trade your information with third parties for their commercial purposes. We may share information we have collected about you in certain situations:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.</li>
              <li><strong>Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us or on our behalf, including data analysis, hosting services (Google Cloud/Firebase), and customer service.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">4. SECURITY OF YOUR INFORMATION</h2>
            <p>
              We use administrative, technical, and physical security measures to help protect your personal information. Our application is built on Google's Firebase platform, which encrypts all data at rest by default. All data in transit is encrypted using Transport Layer Security (TLS). While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
            </p>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">5. POLICY FOR CHILDREN</h2>
            <p>
              We do not knowingly solicit information from or market to children under the age of 13. If you become aware of any data we have collected from children under age 13, please contact us using the contact information provided below.
            </p>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">6. CHANGES TO THIS PRIVACY POLICY</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by updating the &quot;Last updated&quot; date of this Privacy Policy.
            </p>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">7. CONTACT US</h2>
            <p>
              If you have questions or comments about this Privacy Policy, please contact us at: [Your Contact Email/Address Here].
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

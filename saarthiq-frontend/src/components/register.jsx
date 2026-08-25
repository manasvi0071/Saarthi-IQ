// src/components/Register.jsx - UPDATED WITHOUT TURNSTILE WITH FULL TERMS & CONDITIONS
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css'; 
import logo from '../assets/logo.png';
import { CheckCircle, Loader2, FileText, Check, X, ChevronRight, Eye, EyeOff } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    phone: '',
  });
  const [showPopup, setShowPopup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const validatePassword = (password) => {
    const errors = [];
    const strength = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
    
    setPasswordStrength(strength);
    
    if (!strength.length) errors.push('At least 8 characters');
    if (!strength.uppercase) errors.push('One uppercase letter (A-Z)');
    if (!strength.lowercase) errors.push('One lowercase letter (a-z)');
    if (!strength.number) errors.push('One number (0-9)');
    if (!strength.special) errors.push('One special character (!@#$%^&*)');
    
    return errors.length > 0 ? errors.join(', ') : '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    if (name === 'password') {
      const error = validatePassword(value);
      setPasswordError(error);
    }
  };

  const handlePhoneChange = (value) => {
    setFormData({ ...formData, phone: value });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    // Check if terms are accepted
    if (!acceptedTerms) {
      alert("Please accept the Terms and Conditions to register.");
      setShowTermsModal(true);
      return;
    }

    // Validate password before submitting
    const passwordValidation = validatePassword(formData.password);
    if (passwordValidation) {
      setPasswordError(passwordValidation);
      return;
    }
    
    // SIMPLIFIED PHONE PROCESSING
    let cleanedPhone = formData.phone.toString();
    cleanedPhone = cleanedPhone.replace(/\D/g, '');
    
    if (cleanedPhone.length > 10) {
      cleanedPhone = cleanedPhone.slice(-10);
    }
    
    if (cleanedPhone.length !== 10) {
      alert(`Phone number must be exactly 10 digits. You entered ${cleanedPhone.length} digits.`);
      return;
    }
    
    // Check if email already exists
    try {
      const checkResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/check-user`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email: formData.email }),
      });
      
      const checkData = await checkResponse.json();
      
      if (checkData.exists) {
        if (checkData.status === 'pending') {
          alert("This email is already registered and pending approval. Please wait for admin approval.");
          return;
        } else if (checkData.status === 'active') {
          alert("This email is already registered with an active account. Please use the login page.");
          return;
        }
      }
    } catch (checkErr) {
      console.error('❌ Email check error:', checkErr);
    }
    
    setIsSubmitting(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          phone: cleanedPhone
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setShowPopup(true);
      } else if (response.status === 409) {
        alert(data.message || "This email is already registered or pending approval.");
      } else if (response.status === 400) {
        alert(data.message || "Please check your input fields.");
      } else {
        alert(data.message || 'Registration failed. Please try again.'); 
      }
    } catch (err) {
      console.error('❌ Registration network error:', err);
      alert('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePopupClose = () => {
      setShowPopup(false);
      navigate('/login');
  };

  // Terms and Conditions Modal Component with EXACT content
  const TermsModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-800">Terms and Conditions of Use</h2>
              <p className="text-sm text-gray-600 mt-1">Talent Corner H.R. Services Pvt. Ltd.</p>
            </div>
          </div>
          <button
            onClick={() => setShowTermsModal(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-none text-gray-700 space-y-6">
            
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>By registering for an account, you agree to be legally bound by these Terms and Conditions.</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Section 1 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  1. INTRODUCTION
                </h3>
                <p className="text-gray-700">
                  These Terms and Conditions ("Terms") govern the access to and use of the internal digital portal 
                  <strong> SarthIQ</strong> ("Platform"), owned and operated by <strong>Talent Corner HR Services Private Limited</strong> 
                  ("Company", "we", "us", "our").
                </p>
                <p className="text-gray-700 mt-2">
                  By accessing or using SarthIQ, you agree to be bound by these Terms. If you do not agree, you must immediately 
                  discontinue use of the Platform.
                </p>
              </div>

              {/* Section 2 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  2. PURPOSE OF SARTHIQ
                </h3>
                <p className="text-gray-700">
                  SarthIQ is an <strong>internal and restricted-use platform</strong> intended solely to facilitate:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
                  <li>Internal collaboration, information sharing, learning, recruitment-related support, and career enhancement activities;</li>
                  <li>Access by <strong>in-house employees of Talent Corner HR Services Private Limited</strong>; and</li>
                  <li>Access by <strong>authorized Franchisee Partners</strong> of Talent Corner HR Services Private Limited.</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  The Platform is <strong>not a public portal</strong> and is <strong>not intended for general public use</strong>.
                </p>
              </div>

              {/* Section 3 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  3. ELIGIBILITY & ACCESS
                </h3>
                <p className="text-gray-700">
                  Access to SarthIQ is strictly limited to:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
                  <li>Active employees of Talent Corner HR Services Private Limited; and</li>
                  <li>Authorized Franchisee Partners and their nominated users, as approved by the Company.</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  The Company reserves the right to grant, restrict, suspend, or revoke access at its sole discretion, 
                  without notice, especially upon termination of employment, franchise arrangement, or breach of these Terms.
                </p>
              </div>

              {/* Section 4 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  4. COST OF USE
                </h3>
                <p className="text-gray-700">
                  SarthIQ is provided <strong>free of cost</strong> to all eligible users. No subscription fees, usage fees, 
                  or service charges are applicable.
                </p>
                <p className="text-gray-700 mt-2">
                  The Company reserves the right to introduce paid features or services in the future, subject to prior intimation.
                </p>
              </div>

              {/* Section 5 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  5. USER OBLIGATIONS
                </h3>
                <p className="text-gray-700">
                  Users agree to:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
                  <li>Use the Platform strictly for legitimate internal business, recruitment, training, or professional purposes;</li>
                  <li>Provide accurate, complete, and up-to-date information;</li>
                  <li>Maintain confidentiality of login credentials;</li>
                  <li>Ensure that all data, profiles, resumes, job postings, or communications uploaded are genuine and lawful.</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  Users shall be solely responsible for all activities conducted through their accounts.
                </p>
              </div>

              {/* Section 6 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  6. PROHIBITED USES
                </h3>
                <p className="text-gray-700">
                  Users shall <strong>not</strong>:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
                  <li>Share login credentials with unauthorized persons;</li>
                  <li>Copy, download, scrape, extract, reproduce, or distribute Platform data without written authorization;</li>
                  <li>Use the Platform for personal commercial gain, solicitation, or competing business activities;</li>
                  <li>Upload false, misleading, defamatory, obscene, abusive, unlawful, or infringing content;</li>
                  <li>Spam users or post repetitive or irrelevant job postings;</li>
                  <li>Use automated tools, bots, crawlers, or scripts to access or extract data;</li>
                  <li>Attempt to reverse engineer, decompile, or compromise the Platform's security;</li>
                  <li>Use Platform content for training AI or machine learning models without prior written consent.</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  Any violation may result in immediate suspension or termination of access and legal action.
                </p>
              </div>

              {/* Section 7 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  7. DATA ACCURACY & DISCLAIMER
                </h3>
                <p className="text-gray-700">
                  The Company does not guarantee the accuracy, completeness, or reliability of any information available on SarthIQ.
                </p>
                <p className="text-gray-700 mt-2">
                  Users are responsible for conducting their own verification, background checks, and due diligence before 
                  relying on any information obtained through the Platform.
                </p>
              </div>

              {/* Section 8 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  8. CONFIDENTIALITY & DATA PRIVACY
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-gray-700">
                  <li>The Company will take reasonable measures to protect user data;</li>
                  <li>However, absolute confidentiality cannot be guaranteed;</li>
                  <li>User data may be disclosed if required under applicable law, court orders, or government authorities.</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  Use of the Platform is also governed by the Company's Privacy Policy, as applicable.
                </p>
              </div>

              {/* Section 9 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  9. INTELLECTUAL PROPERTY
                </h3>
                <p className="text-gray-700">
                  All content, data, design, software, logos, trademarks, and material on SarthIQ are the exclusive property 
                  of Talent Corner HR Services Private Limited.
                </p>
                <p className="text-gray-700 mt-2">
                  Users are granted a limited, non-transferable, non-exclusive, revocable license to use the Platform 
                  strictly in accordance with these Terms.
                </p>
              </div>

              {/* Section 10 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  10. SECURITY & MONITORING
                </h3>
                <p className="text-gray-700">
                  The Company may deploy technical, administrative, and security measures to:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
                  <li>Detect misuse or unauthorized activity;</li>
                  <li>Restrict or verify access;</li>
                  <li>Monitor usage for compliance.</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  Users agree to cooperate with any verification or security requirements imposed by the Company.
                </p>
              </div>

              {/* Section 11 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  11. TERMINATION OF ACCESS
                </h3>
                <p className="text-gray-700">
                  The Company may suspend or terminate access:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
                  <li>Upon breach of these Terms;</li>
                  <li>Upon cessation of employment or franchise relationship;</li>
                  <li>For security, legal, or operational reasons.</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  Upon termination, all rights to use SarthIQ shall immediately cease.
                </p>
              </div>

              {/* Section 12 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  12. LIMITATION OF LIABILITY
                </h3>
                <p className="text-gray-700">
                  To the maximum extent permitted by law, Talent Corner HR Services Private Limited shall not be liable for:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
                  <li>Any indirect, incidental, consequential, or special damages;</li>
                  <li>Loss of data, revenue, business opportunity, or reputation;</li>
                  <li>Any reliance placed on information obtained through the Platform.</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  The Platform is provided on an <strong>"as is" and "best effort" basis</strong>.
                </p>
              </div>

              {/* Section 13 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  13. INDEMNITY
                </h3>
                <p className="text-gray-700">
                  Users agree to indemnify and hold harmless Talent Corner HR Services Private Limited, its directors, 
                  officers, employees, affiliates, and partners from any claims, losses, damages, or expenses arising out of:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
                  <li>Breach of these Terms;</li>
                  <li>Misuse of the Platform;</li>
                  <li>Violation of applicable laws or third-party rights.</li>
                </ul>
              </div>

              {/* Section 14 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  14. GOVERNING LAW, JURISDICTION & ARBITRATION
                </h3>
                <p className="text-gray-700">
                  These Terms shall be governed by and construed in accordance with the laws of India.
                </p>
                <p className="text-gray-700 mt-2">
                  Any dispute, controversy, or claim arising out of or in connection with these Terms or the use of 
                  SarthIQ shall be resolved through <strong>arbitration</strong>, in accordance with the provisions of 
                  the Arbitration and Conciliation Act, 1996, as amended from time to time.
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
                  <li>The arbitration shall be conducted by a <strong>sole arbitrator</strong> appointed by Talent Corner HR Services Private Limited.</li>
                  <li>The <strong>seat and venue of arbitration shall be Mumbai, Maharashtra</strong>.</li>
                  <li>The arbitration proceedings shall be conducted in the English language.</li>
                  <li>The arbitral award shall be final and binding on the parties.</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  Subject to the above arbitration clause, the courts at <strong>Mumbai, Maharashtra</strong>, shall have exclusive jurisdiction.
                </p>
              </div>

              {/* Section 15 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  15. AMENDMENTS
                </h3>
                <p className="text-gray-700">
                  The Company reserves the right to amend, modify, or update these Terms at any time. Continued use of 
                  SarthIQ after such changes constitutes acceptance of the revised Terms.
                </p>
              </div>

              {/* Section 16 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  16. ACCEPTANCE OF TERMS (CLICK-WRAP CONSENT)
                </h3>
                <p className="text-gray-700">
                  By accessing, logging into, or using the SarthIQ portal, including by clicking the <strong>"I Agree"</strong> 
                  or similar acceptance button during login or onboarding, you expressly acknowledge that:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-700">
                  <li>You have read and understood these Terms and Conditions;</li>
                  <li>You agree to be legally bound by them;</li>
                  <li>You are authorized (as an employee or Franchisee Partner) to access and use the Platform.</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  If you do not agree to these Terms, you must not access or use SarthIQ.
                </p>
              </div>

              {/* Section 17 */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                  <ChevronRight className="w-5 h-5 text-purple-600 mr-2" />
                  17. CONTACT
                </h3>
                <p className="text-gray-700">
                  For any questions, concerns, or clarifications regarding these Terms, users may contact the management 
                  of Talent Corner HR Services Private Limited through official internal communication channels.
                </p>
              </div>

              {/* Final Acceptance Statement */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <p className="text-blue-800 font-semibold text-center">
                  <strong>By using SarthIQ, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.</strong>
                </p>
              </div>

            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              id="acceptTermsModal"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 flex-shrink-0 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="acceptTermsModal" className="text-sm text-gray-700">
              <span className="font-semibold">I confirm that:</span> I have read, understood, and agree to all the Terms and Conditions above. 
              I acknowledge that by registering, I am agreeing to be legally bound by these terms and that my access to SarthIQ 
              is subject to compliance with these Terms and Conditions.
            </label>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowTermsModal(false)}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Close
            </button>
            <button
              onClick={() => {
                if (acceptedTerms) {
                  setShowTermsModal(false);
                } else {
                  alert("Please check the box to accept the Terms and Conditions.");
                }
              }}
              className="flex-1 py-3 bg-purple-600 text-white rounded-md font-medium hover:bg-purple-700 transition flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              I Accept & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Terms Checkbox Component
  const TermsCheckbox = () => (
    <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <div className="flex items-start">
        <input
          type="checkbox"
          id="acceptTerms"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-1 mr-3 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          disabled={isSubmitting}
        />
        <label htmlFor="acceptTerms" className="text-sm text-gray-700 select-none">
          <span className="font-medium">I agree to the</span>{' '}
          <button
            type="button"
            onClick={() => setShowTermsModal(true)}
            className="text-purple-600 font-semibold hover:underline focus:outline-none"
          >
            Terms and Conditions of Use
          </button>
          {' '}for SarthIQ (Talent Corner H.R. Services Pvt. Ltd.)
          <p className="text-xs text-gray-500 mt-1">
            You must read and accept the complete Terms and Conditions before registering.
          </p>
        </label>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-100 font-sans">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-sm flex flex-col items-center">
        
        <img src={logo} alt="Logo" className="w-20 mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Create New Account</h1>
        
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs px-3 py-2 rounded mb-6 text-center w-full">
          <strong>Note:</strong> After registering, your account will be sent to the Administrator for approval.
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-600"
              required
              disabled={isSubmitting}
              minLength={2}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email address"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-600"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Password *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter a strong password"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-600 pr-10"
                required
                disabled={isSubmitting}
                minLength={8}
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                tabIndex={-1}
                disabled={isSubmitting}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            
            {/* Password Requirements */}
            <div className="mt-2 text-xs">
              <p className="font-medium text-gray-700 mb-1">Password Requirements:</p>
              <ul className="space-y-1">
                <li className={`flex items-center ${formData.password && passwordStrength.length ? 'text-green-600' : 'text-gray-500'}`}>
                  <span className={`w-3 h-3 rounded-full mr-2 ${formData.password && passwordStrength.length ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  At least 8 characters
                </li>
                <li className={`flex items-center ${formData.password && passwordStrength.uppercase ? 'text-green-600' : 'text-gray-500'}`}>
                  <span className={`w-3 h-3 rounded-full mr-2 ${formData.password && passwordStrength.uppercase ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  One uppercase letter (A-Z)
                </li>
                <li className={`flex items-center ${formData.password && passwordStrength.lowercase ? 'text-green-600' : 'text-gray-500'}`}>
                  <span className={`w-3 h-3 rounded-full mr-2 ${formData.password && passwordStrength.lowercase ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  One lowercase letter (a-z)
                </li>
                <li className={`flex items-center ${formData.password && passwordStrength.number ? 'text-green-600' : 'text-gray-500'}`}>
                  <span className={`w-3 h-3 rounded-full mr-2 ${formData.password && passwordStrength.number ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  One number (0-9)
                </li>
                <li className={`flex items-center ${formData.password && passwordStrength.special ? 'text-green-600' : 'text-gray-500'}`}>
                  <span className={`w-3 h-3 rounded-full mr-2 ${formData.password && passwordStrength.special ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  One special character (!@#$%^&*)
                </li>
              </ul>
            </div>
            
            {passwordError && (
              <p className="text-xs text-red-500 mt-1">{passwordError}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Department *</label>
            <select
  name="department"
  value={formData.department}
  onChange={handleChange}
  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-600 bg-white"
  required
  disabled={isSubmitting}
>
  <option value="">Select Department</option>
  <option value="Business Development">Business Development</option>
  <option value="Franchise">Franchise Development</option>
  <option value="Recruitment">Recruitment(Franchise)</option>
</select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number *</label>
            <PhoneInput
              country={'in'}
              value={formData.phone}
              onChange={handlePhoneChange}
              inputClass="!w-full !h-[38px] !text-sm !border-gray-300 !rounded focus:!ring-1 focus:!ring-purple-600"
              buttonClass="!border-gray-300 !bg-gray-50 !rounded-l"
              containerClass="w-full"
              disabled={isSubmitting}
              required
              countryCodeEditable={false}
              enableSearch={true}
              inputProps={{
                name: 'phone',
                required: true,
                autoComplete: 'tel'
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter your 10-digit mobile number. Country code (+91) is automatically added.
            </p>
          </div>

          {/* Terms and Conditions Checkbox */}
          <TermsCheckbox />
          
          <button
            type="submit"
            disabled={isSubmitting || passwordError || !acceptedTerms}
            className={`w-full py-2 mt-4 text-white font-semibold rounded transition duration-150 shadow-sm flex items-center justify-center gap-2 ${
                isSubmitting || passwordError || !acceptedTerms ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isSubmitting ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending for Approval...
                </>
            ) : (
                'Register'
            )}
          </button>
        </form>
        <p className="mt-4 text-xs text-gray-600">
          Already have an account?{' '}
          <span
            className="text-purple-600 font-medium cursor-pointer hover:underline"
            onClick={() => !isSubmitting && navigate('/login')}
          >
            Log in
          </span>
        </p>
      </div>

      {/* Terms and Conditions Modal */}
      {showTermsModal && <TermsModal />}

      {/* SUCCESS POPUP */}
      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-2xl max-w-sm text-center transform transition-all scale-100">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">Request Sent!</h3>
                <div className="mt-2">
                    <p className="text-sm text-gray-500">
                        Your account has been successfully sent for approval. You will receive an email once the Administrator approves your request.
                    </p>
                </div>
                <div className="mt-5">
                    <button
                        onClick={handlePopupClose}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 sm:text-sm"
                    >
                        OK, Go to Login
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Register;
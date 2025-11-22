const BASE_URL = 'http://localhost:3000';
const email = 'advertiser.test@beyondtrips.com';
const password = 'Test@2025';

async function createTestAdvertiser() {
  console.log('🚀 Creating test advertiser account...\n');
  
  // Step 1: Start registration
  console.log('📝 Step 1: Starting registration...');
  const registerResponse = await fetch(`${BASE_URL}/api/partner/register/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyEmail: email,
      password: password,
      confirmPassword: password,
      companyName: 'Test Advertiser Company',
      companyAddress: '123 Test Street, Lagos, Nigeria',
      contact: '+2348012345678',
      industry: 'Technology'
    })
  });

  const registerData = await registerResponse.json();
  console.log('Response:', registerData);

  if (!registerResponse.ok) {
    if (registerData.error === 'Business email already registered') {
      console.log('\n✅ Account already exists!');
      console.log('\n📧 Email: advertiser.test@beyondtrips.com');
      console.log('🔐 Password: Test@2025');
      console.log('\n⚠️  Please set the following in Payload Admin:');
      console.log('   - emailVerified: true');
      console.log('   - registrationStatus: completed');
      return;
    }
    console.error('❌ Registration failed:', registerData);
    return;
  }

  console.log('✅ Registration started!');
  console.log('Business ID:', registerData.businessId);
  
  console.log('\n📧 Email: advertiser.test@beyondtrips.com');
  console.log('🔐 Password: Test@2025');
  console.log('🆔 Business ID:', registerData.businessId);
  console.log('\n⚠️  Please go to Payload Admin and set:');
  console.log('   1. emailVerified: true');
  console.log('   2. registrationStatus: completed');
  console.log('\nThen run the E2E test again!');
}

createTestAdvertiser().catch(console.error);

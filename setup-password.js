const setupClient = window.supabase.createClient('https://owkqfledeuetwwmlvnmb.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93a3FmbGVkZXVldHd3bWx2bm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMzM5MTQsImV4cCI6MjEwMDcwOTkxNH0.lOwjIzs-DyVtvKR8-b1L6RTdlb8iY9_1chgKbY2ml3c',{auth:{storageKey:'jaws-password-setup',detectSessionInUrl:false}});

const setupParams = new URLSearchParams(location.hash.slice(1));
let setupToken = setupParams.get('token');
const expectedEmail = setupParams.get('email') || '';
history.replaceState(null,'',location.pathname);
document.getElementById('accountLabel').textContent=expectedEmail;
let verifiedUser = null;
let setupBusy = false;
document.getElementById('setupForm').addEventListener('submit', async event => {
 event.preventDefault();
 if (setupBusy) return;
 const password=document.getElementById('newPassword').value;
 const confirmation=document.getElementById('confirmPassword').value;
 const message=document.getElementById('setupMessage');
 if(password.length<12 || password!==confirmation){message.textContent='Use at least 12 characters and enter the same password twice.';return;}
 setupBusy=true;document.getElementById('savePassword').disabled=true;
 try {
  if(!verifiedUser){
   if(!setupToken)throw new Error('Open your private password-setup link. Ask your administrator for a new link if it has expired.');
   const {data,error}=await setupClient.auth.verifyOtp({token_hash:setupToken,type:'invite'});
   if(error || !data.user)throw new Error('This setup link is expired or already used. Ask your administrator for a new link.');
   verifiedUser=data.user; setupToken=null;
  }
  if(expectedEmail && verifiedUser.email.toLowerCase()!==expectedEmail.toLowerCase())throw new Error('This link belongs to a different account.');
  const {error}=await setupClient.auth.updateUser({password});
  if(error)throw error;
  await setupClient.auth.signOut({scope:'local'});
  document.getElementById('setupForm').reset();
  message.textContent='Password saved. Use CRM Sign In below with your email and new password.';
  document.getElementById('savePassword').hidden=true;
 }catch(error){message.textContent=error.message;}
 finally{setupBusy=false;document.getElementById('savePassword').disabled=false;}
});

export async function getGuestList() {
  
    const response = await fetch('/api/guests/list');
    
      const data = await response.json();
    
      if(!response.ok){
        throw new Error(data.message || 'Something went wrong');
      }
      
      return data;
  }


  export async function forgotPassword(email) {
  
    const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({email: email, usertype:'guest'}),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
    
      const data = await response.json();
    
      if(!response.ok){
        throw new Error(data.message || 'Something went wrong');
      }
      
      return data;
}
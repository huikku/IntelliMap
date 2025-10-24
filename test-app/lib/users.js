// User data module - WILL BE EXECUTED

export async function getUserData(userId) {
  // Simulate database query
  await new Promise(resolve => setTimeout(resolve, 10));
  
  return {
    id: userId,
    name: 'John Doe',
    email: 'john@example.com',
  };
}

export async function getAllUsers() {
  // This function will NOT be called (dead code)
  await new Promise(resolve => setTimeout(resolve, 50));
  
  return [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];
}


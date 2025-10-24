// Logger module - WILL BE EXECUTED

export function logActivity(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

export function logError(error) {
  // This function will NOT be called (dead code)
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${error.message}`);
}


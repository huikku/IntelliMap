// Product data module - WILL BE EXECUTED

export async function getProductData() {
  // Simulate database query
  await new Promise(resolve => setTimeout(resolve, 20));
  
  return [
    { id: 1, name: 'Widget', price: 9.99 },
    { id: 2, name: 'Gadget', price: 19.99 },
  ];
}

export async function getProductById(productId) {
  // This function will NOT be called (dead code)
  await new Promise(resolve => setTimeout(resolve, 10));
  
  return {
    id: productId,
    name: 'Product',
    price: 99.99,
  };
}


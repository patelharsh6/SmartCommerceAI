export const getImageForProduct = (product) => {
  const query = encodeURIComponent(`Professional high quality product shot of ${product.name} on a clean white background studio lighting`);
  const idStr = String(product.product_id).replace(/\D/g, '');
  const lock = (parseInt(idStr || '1') % 1000) + 1;
  return `https://image.pollinations.ai/prompt/${query}?width=400&height=400&nologo=true&seed=${lock}`;
};
